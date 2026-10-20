import { inject, Service } from '@angular/core';

import type { InferenceSession, Tensor } from 'onnxruntime-web';

import { isConvexQuad, quadArea, sortQuadCorners, type Point, type Quad } from '../geometry';
import { OrtRuntime, type Ort } from './ort-runtime';

/** DocAligner lcnet100, erzeugt per `npm run fetch-models` (ADR-011). */
const MODEL_URL = 'models/docaligner.onnx';

/** Eingangsgröße des Modells; das Bild wird ohne Rand gestaucht, so ist es trainiert. */
const INPUT_SIZE = 256;

/** Schwelle des Herstellers: darunter ist eine Heatmap-Zelle keine Ecke. */
const HEATMAP_THRESHOLD = 0.3;

/** Kleiner als 5 % des Bildes ist kein Dokument, sondern ein Fehlgriff — Kassenbons liegen darüber. */
const MIN_AREA_RATIO = 0.05;

/** Ein Heatmap-Kanal je Ecke; die Kontrakt-Reihenfolge stellt danach `sortQuadCorners` her. */
const CORNER_COUNT = 4;

/** 8er-Nachbarschaft: auch diagonal angrenzende Zellen gehören zur selben Fläche. */
const NEIGHBOR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

interface AlignerModel {
  readonly ort: Ort;
  readonly session: InferenceSession;
}

/** KI-Eckenerkennung mit DocAligner: eine Heatmap je Ecke, deren hellste Fläche ist die Ecke. */
@Service()
export class DocAligner {
  private readonly ortRuntime = inject(OrtRuntime);
  private sessionPromise: Promise<AlignerModel> | null = null;

  /** Laufzeit und Modell vorwärmen; wirft bei Fehler, der nächste Aufruf versucht es neu. */
  async load(): Promise<void> {
    await this.session();
  }

  /** Vier sortierte Ecken in Original-Koordinaten — oder `null`, wenn das Modell kein plausibles Blatt sieht. */
  async detect(source: ImageBitmap): Promise<Quad | null> {
    const { ort, session } = await this.session();
    const input = this.readModelInput(source);
    const results = await session.run({ img: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]) });
    const output: Tensor | undefined = results['heatmap'];

    if (output === undefined) {
      throw new Error('DocAligner lieferte keine Heatmap.');
    }

    let corners: Point[] | null;

    try {
      corners = this.readCorners(output.data as Float32Array, output.dims[3] ?? 0, source);
    } finally {
      output.dispose();
    }

    if (corners === null) {
      return null;
    }

    const quad = sortQuadCorners(corners);

    if (!isConvexQuad(quad) || quadArea(quad) < source.width * source.height * MIN_AREA_RATIO) {
      return null;
    }

    return quad;
  }

  private session(): Promise<AlignerModel> {
    if (this.sessionPromise === null) {
      this.sessionPromise = this.createSession();
      this.sessionPromise.catch(() => {
        this.sessionPromise = null;
      });
    }

    return this.sessionPromise;
  }

  private async createSession(): Promise<AlignerModel> {
    const ort = await this.ortRuntime.load();
    const response = await fetch(new URL(MODEL_URL, document.baseURI));

    if (!response.ok) {
      throw new Error(`DocAligner nicht ladbar: HTTP ${response.status}`);
    }

    const modelBytes = new Uint8Array(await response.arrayBuffer());
    // Nur WASM: das Modell ist klein, das Anlegen einer WebGPU-Sitzung kostet beim ersten Scan mehr, als der Lauf spart.
    const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });

    return { ort, session };
  }

  /** Bild auf 256 × 256 gestaucht, NCHW, RGB, Werte 0..1 — so hat DocAligner gelernt. */
  private readModelInput(source: ImageBitmap): Float32Array {
    const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
    const context = canvas.getContext('2d');

    if (context === null) {
      throw new Error('Kein 2D-Kontext verfügbar.');
    }

    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);

    const { data } = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const plane = INPUT_SIZE * INPUT_SIZE;
    const chw = new Float32Array(3 * plane);

    // `?? 0` nur für den Typprüfer: alle Indizes liegen im Puffer.
    for (let pixel = 0; pixel < plane; pixel++) {
      for (let channel = 0; channel < 3; channel++) {
        chw[pixel + channel * plane] = (data[pixel * 4 + channel] ?? 0) / 255;
      }
    }

    return chw;
  }

  /** Je Kanal eine Ecke, umgerechnet in Original-Pixel; fehlt eine, gibt es kein Viereck. */
  private readCorners(heatmap: Float32Array, grid: number, source: ImageBitmap): Point[] | null {
    const corners: Point[] = [];

    for (let channel = 0; channel < CORNER_COUNT; channel++) {
      const peak = this.peak(heatmap, channel, grid);

      if (peak === null) {
        return null;
      }

      // Zellmitte (+ 0,5) aufs Original strecken, dann zurück auf Pixelmitte (- 0,5).
      corners.push({
        x: ((peak.x + 0.5) * source.width) / grid - 0.5,
        y: ((peak.y + 0.5) * source.height) / grid - 0.5,
      });
    }

    return corners;
  }

  /** Schwerpunkt der größten Fläche über der Schwelle — wie die Auswertung des Herstellers, aber auf dem 128er-Gitter statt auf hochskalierter Heatmap (gleiches Ergebnis, ein Bruchteil der Rechenzeit). */
  private peak(data: Float32Array, channel: number, grid: number): Point | null {
    const offset = channel * grid * grid;
    const visited = new Uint8Array(grid * grid);
    const stack: number[] = [];
    let best: { readonly cells: number; readonly x: number; readonly y: number } | null = null;

    for (let start = 0; start < grid * grid; start++) {
      if (visited[start] === 1 || (data[offset + start] ?? 0) <= HEATMAP_THRESHOLD) {
        continue;
      }

      let cells = 0;
      let weightSum = 0;
      let weightedX = 0;
      let weightedY = 0;

      visited[start] = 1;
      stack.push(start);

      for (let cell = stack.pop(); cell !== undefined; cell = stack.pop()) {
        const cellX = cell % grid;
        const cellY = Math.floor(cell / grid);
        const weight = data[offset + cell] ?? 0;

        cells++;
        weightSum += weight;
        weightedX += weight * cellX;
        weightedY += weight * cellY;

        for (const [deltaX, deltaY] of NEIGHBOR_OFFSETS) {
          const neighborX = cellX + deltaX;
          const neighborY = cellY + deltaY;

          if (neighborX < 0 || neighborY < 0 || neighborX >= grid || neighborY >= grid) {
            continue;
          }

          const neighbor = neighborY * grid + neighborX;

          if (visited[neighbor] === 0 && (data[offset + neighbor] ?? 0) > HEATMAP_THRESHOLD) {
            visited[neighbor] = 1;
            stack.push(neighbor);
          }
        }
      }

      if (best === null || cells > best.cells) {
        best = { cells, x: weightedX / weightSum, y: weightedY / weightSum };
      }
    }

    if (best === null) {
      return null;
    }

    return { x: best.x, y: best.y };
  }
}
