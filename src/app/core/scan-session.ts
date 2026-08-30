import { Service, signal } from '@angular/core';

import type { Quad } from './geometry';

@Service()
export class ScanSession {
  private readonly sourceFrameSignal = signal<ImageBitmap | null>(null);
  private readonly cornersSignal = signal<Quad | null>(null);
  private readonly warpedPageSignal = signal<Blob | null>(null);

  readonly sourceFrame = this.sourceFrameSignal.asReadonly();
  readonly corners = this.cornersSignal.asReadonly();
  readonly warpedPage = this.warpedPageSignal.asReadonly();

  setSourceFrame(frame: ImageBitmap): void {
    this.sourceFrameSignal.set(frame);
  }

  setCorners(corners: Quad): void {
    this.cornersSignal.set(corners);
  }

  setWarpedPage(page: Blob): void {
    this.warpedPageSignal.set(page);
  }

  /** Gibt das gehaltene ImageBitmap frei, bevor der Zustand geleert wird — sonst hält ein 12-MP-Bitmap den Speicher. */
  reset(): void {
    this.sourceFrameSignal()?.close();
    this.sourceFrameSignal.set(null);
    this.cornersSignal.set(null);
    this.warpedPageSignal.set(null);
  }
}
