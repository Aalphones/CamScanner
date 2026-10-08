import { Service, signal } from '@angular/core';

import type { InferenceSession, Tensor } from 'onnxruntime-web';

/** fp16-Fassung von DocShadow (SD7K), erzeugt per `npm run fetch-models` (ADR-007). */
const MODEL_URL = 'models/docshadow.onnx';

/** Erwartete Dateigröße — Fortschritt, falls der Server keine `Content-Length` schickt. */
const MODEL_BYTES = 62_046_107;

/** Ordner, in den `angular.json` die WASM-Dateien von onnxruntime-web kopiert. */
const ORT_ASSET_DIR = 'ort/';

/** Das Modell ist auf 256 × 256 trainiert; Schatten sind niederfrequent, mehr Auflösung bringt der Verstärkungskarte nichts. */
export const GAIN_MAP_SIZE = 256;

/** Verhindert Division durch null in tiefschwarzen Pixeln — eine Stufe von 255. */
const GAIN_EPSILON = 1 / 255;

export type ModelLoadState = 'idle' | 'loading' | 'ready';

/**
 * Faktor je Pixel und Farbkanal, mit dem das Original multipliziert wird, um den
 * Schatten auszugleichen. RGB verschachtelt (HWC), `GAIN_MAP_SIZE` im Quadrat.
 */
export interface GainMap {
  readonly size: number;
  readonly rgb: Float32Array;
}

type Ort = typeof import('onnxruntime-web');

interface ShadowModel {
  readonly ort: Ort;
  readonly session: InferenceSession;
}

/**
 * KI-Schattenentfernung mit DocShadow. Laufzeit und Modell kommen erst beim
 * ersten Aufruf von `load()` — ohne Einschalten lädt die App nichts davon.
 */
@Service()
export class DocShadow {
  private readonly loadStateSignal = signal<ModelLoadState>('idle');
  private readonly loadProgressSignal = signal(0);
  private modelPromise: Promise<ShadowModel> | null = null;
  /** Ein Modelllauf je begradigter Seite — Regler und Filterwechsel nutzen dieselbe Karte. */
  private readonly gainMaps = new WeakMap<Blob, Promise<GainMap>>();

  readonly loadState = this.loadStateSignal.asReadonly();
  /** 0..1, nur der Modell-Download. */
  readonly loadProgress = this.loadProgressSignal.asReadonly();

  /** Jeder weitere Aufruf bekommt dieselbe Promise; nach einem Fehler darf der nächste Aufruf neu versuchen. */
  async load(): Promise<void> {
    await this.model();
  }

  gainMap(warped: Blob): Promise<GainMap> {
    let gainMap = this.gainMaps.get(warped);

    if (gainMap === undefined) {
      gainMap = this.computeGainMap(warped);
      this.gainMaps.set(warped, gainMap);
      gainMap.catch(() => this.gainMaps.delete(warped));
    }

    return gainMap;
  }

  private model(): Promise<ShadowModel> {
    if (this.modelPromise === null) {
      this.modelPromise = this.createModel();
      this.modelPromise.catch(() => {
        this.modelPromise = null;
        this.loadStateSignal.set('idle');
      });
    }

    return this.modelPromise;
  }

  private async createModel(): Promise<ShadowModel> {
    this.loadStateSignal.set('loading');
    this.loadProgressSignal.set(0);

    const ort = await import('onnxruntime-web');
    // Selbst gehostet statt CDN: offline verfügbar und kein Netzwerkzugriff außer auf die eigene Adresse.
    ort.env.wasm.wasmPaths = new URL(ORT_ASSET_DIR, document.baseURI).href;
    // Threads nutzt ORT nur mit Cross-Origin-Isolation, sonst läuft es von selbst einfädig.
    console.info('DocShadow: crossOriginIsolated =', globalThis.crossOriginIsolated);

    const modelBytes = await this.downloadModel();
    const session = await ort.InferenceSession.create(modelBytes, { executionProviders: this.executionProviders() });

    this.loadStateSignal.set('ready');
    return { ort, session };
  }

  /** Liest den Stream selbst, damit der Schalter den Fortschritt zeigen kann. */
  private async downloadModel(): Promise<Uint8Array> {
    const response = await fetch(new URL(MODEL_URL, document.baseURI));

    if (!response.ok || response.body === null) {
      throw new Error(`KI-Modell nicht ladbar: HTTP ${response.status}`);
    }

    const totalBytes = Number(response.headers.get('Content-Length')) || MODEL_BYTES;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      receivedBytes += value.length;
      this.loadProgressSignal.set(Math.min(1, receivedBytes / totalBytes));
    }

    const modelBytes = new Uint8Array(receivedBytes);
    let offset = 0;

    for (const chunk of chunks) {
      modelBytes.set(chunk, offset);
      offset += chunk.length;
    }

    return modelBytes;
  }

  /** WebGPU zuerst; scheitert es beim Anlegen der Sitzung, nimmt ORT von selbst WASM. */
  private executionProviders(): string[] {
    if ('gpu' in navigator) {
      return ['webgpu', 'wasm'];
    }

    return ['wasm'];
  }

  private async computeGainMap(warped: Blob): Promise<GainMap> {
    const { ort, session } = await this.model();
    const [inputName] = session.inputNames;
    const [outputName] = session.outputNames;

    if (inputName === undefined || outputName === undefined) {
      throw new Error('KI-Modell hat keinen Ein- oder Ausgang.');
    }

    const input = await this.readModelInput(warped);
    const results = await session.run({ [inputName]: new ort.Tensor('float32', input, [1, 3, GAIN_MAP_SIZE, GAIN_MAP_SIZE]) });
    const output: Tensor | undefined = results[outputName];

    if (output === undefined) {
      throw new Error('KI-Modell lieferte kein Ergebnis.');
    }

    try {
      return { size: GAIN_MAP_SIZE, rgb: this.toGainMap(input, output.data as Float32Array) };
    } finally {
      output.dispose();
    }
  }

  /** Seite auf 256 × 256 gestaucht, NCHW, Werte 0..1 — so hat DocShadow gelernt. */
  private async readModelInput(warped: Blob): Promise<Float32Array> {
    const bitmap = await createImageBitmap(warped);
    const canvas = new OffscreenCanvas(GAIN_MAP_SIZE, GAIN_MAP_SIZE);
    const context = canvas.getContext('2d');

    try {
      if (context === null) {
        throw new Error('Kein 2D-Kontext verfügbar.');
      }

      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, GAIN_MAP_SIZE, GAIN_MAP_SIZE);

      const { data } = context.getImageData(0, 0, GAIN_MAP_SIZE, GAIN_MAP_SIZE);
      const plane = GAIN_MAP_SIZE * GAIN_MAP_SIZE;
      const chw = new Float32Array(3 * plane);

      // `?? 0` nur für den Typprüfer: alle Indizes liegen im Puffer.
      for (let pixel = 0; pixel < plane; pixel++) {
        for (let channel = 0; channel < 3; channel++) {
          chw[pixel + channel * plane] = (data[pixel * 4 + channel] ?? 0) / 255;
        }
      }

      return chw;
    } finally {
      bitmap.close();
    }
  }

  /**
   * Verhältnis Modell-Ausgang zu Eingang je Kanal (ADR-007). Der Ausgang läuft
   * leicht über 0..1 hinaus und wird vorher begrenzt.
   */
  private toGainMap(input: Float32Array, output: Float32Array): Float32Array {
    const plane = GAIN_MAP_SIZE * GAIN_MAP_SIZE;
    const rgb = new Float32Array(3 * plane);

    for (let pixel = 0; pixel < plane; pixel++) {
      for (let channel = 0; channel < 3; channel++) {
        const index = pixel + channel * plane;
        const restored = Math.min(1, Math.max(0, output[index] ?? 0));

        rgb[pixel * 3 + channel] = (restored + GAIN_EPSILON) / ((input[index] ?? 0) + GAIN_EPSILON);
      }
    }

    return rgb;
  }
}
