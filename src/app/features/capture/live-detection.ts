import { signal, type Signal } from '@angular/core';

import type { Camera } from '../../core/camera';
import type { DocumentDetection } from '../../core/document-detection';
import { quadsClose, type Quad, type Size } from '../../core/geometry';

/** Pause zwischen zwei Läufen — gemessen ab dem Ende des vorigen, damit sich langsame Läufe nie stapeln. */
const LIVE_DETECTION_INTERVAL_MS = 250;

/** Längste Kante des Vorschaubilds. Klein genug für 4 Läufe/s auf dem Handy, groß genug für saubere Blattkanten. */
const PREVIEW_MAX_EDGE = 480;

/** So viele ruhige Treffer in Folge, bis der Rahmen als „stabil“ gilt. */
const STABLE_FRAMES = 3;

/** Höchstabweichung je Ecke zwischen zwei Treffern, als Anteil der Vorschau-Diagonale. */
const STABLE_TOLERANCE = 0.03;

/**
 * Erkennung auf dem laufenden Kamerabild. Liefert das zuletzt gefundene
 * Viereck in Vorschau-Koordinaten und ob es über mehrere Läufe ruhig lag.
 */
export class LiveDetection {
  private readonly quadSignal = signal<Quad | null>(null);
  readonly quad: Signal<Quad | null> = this.quadSignal.asReadonly();

  private readonly previewSizeSignal = signal<Size>({ width: 0, height: 0 });
  readonly previewSize: Signal<Size> = this.previewSizeSignal.asReadonly();

  private readonly stableSignal = signal(false);
  readonly stable: Signal<boolean> = this.stableSignal.asReadonly();

  private video: HTMLVideoElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  // Jeder start() bekommt eine neue Nummer; ein Lauf, der nach stop() zurückkommt, erkennt daran, dass er verwaist ist.
  private generation = 0;
  private calmHits = 0;

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.clearTimer();
      return;
    }

    if (this.video !== null && !this.isRunning) {
      this.schedule(this.generation, 0);
    }
  };

  constructor(
    private readonly camera: Camera,
    private readonly detection: DocumentDetection,
  ) {}

  start(video: HTMLVideoElement): void {
    if (this.video !== null) {
      return;
    }

    this.video = video;
    this.generation += 1;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.schedule(this.generation, 0);
  }

  stop(): void {
    if (this.video === null) {
      return;
    }

    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearTimer();
    this.video = null;
    this.generation += 1;
    this.isRunning = false;
    this.calmHits = 0;
    this.quadSignal.set(null);
    this.stableSignal.set(false);
  }

  private schedule(generation: number, delayMs: number): void {
    if (document.visibilityState === 'hidden') {
      return;
    }

    this.clearTimer();
    this.timer = setTimeout(() => void this.runOnce(generation), delayMs);
  }

  private async runOnce(generation: number): Promise<void> {
    this.timer = null;
    const video = this.video;

    if (video === null || generation !== this.generation) {
      return;
    }

    this.isRunning = true;

    try {
      const quad = await this.detectInPreview(video);

      if (generation === this.generation) {
        this.record(quad);
      }
    } catch {
      // Ein einzelner kaputter Lauf (Frame noch nicht dekodierbar, OpenCV lädt noch) zählt als Fehltreffer.
      if (generation === this.generation) {
        this.record(null);
      }
    } finally {
      this.isRunning = false;
    }

    if (generation === this.generation) {
      this.schedule(generation, LIVE_DETECTION_INTERVAL_MS);
    }
  }

  private async detectInPreview(video: HTMLVideoElement): Promise<Quad | null> {
    const framePromise = this.camera.grabPreviewFrame(video, PREVIEW_MAX_EDGE);

    if (framePromise === null) {
      return null;
    }

    const frame = await framePromise;

    try {
      this.previewSizeSignal.set({ width: frame.width, height: frame.height });
      return await this.detection.detect(frame);
    } finally {
      frame.close();
    }
  }

  private record(quad: Quad | null): void {
    const previous = this.quadSignal();

    if (quad === null) {
      this.calmHits = 0;
    } else if (previous !== null && quadsClose(previous, quad, this.stableTolerancePx())) {
      this.calmHits += 1;
    } else {
      this.calmHits = 1;
    }

    this.quadSignal.set(quad);
    this.stableSignal.set(this.calmHits >= STABLE_FRAMES);
  }

  private stableTolerancePx(): number {
    const { width, height } = this.previewSizeSignal();
    return Math.hypot(width, height) * STABLE_TOLERANCE;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
