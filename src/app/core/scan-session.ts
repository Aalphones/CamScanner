import { Service, signal } from '@angular/core';

import { DEFAULT_FILTER_SETTINGS, type FilterSettings } from './filter-settings';
import type { Quad } from './geometry';
import type { ScannedPage } from './page-buffer';

/** Der Entwurf: die Seite in Arbeit zwischen Auslöser und Übernahme in den Page Buffer. */
@Service()
export class ScanSession {
  private readonly sourceFrameSignal = signal<ImageBitmap | null>(null);
  private readonly detectedCornersSignal = signal<Quad | null>(null);
  private readonly cornersSignal = signal<Quad | null>(null);
  private readonly warpedPageSignal = signal<Blob | null>(null);
  private readonly filterSignal = signal<FilterSettings>(DEFAULT_FILTER_SETTINGS);
  private readonly editingPageIdSignal = signal<string | null>(null);

  readonly sourceFrame = this.sourceFrameSignal.asReadonly();
  /** Ergebnis der Erkennung — Ziel des „Auto“-Knopfs, auch nachdem der User die Ecken verschoben hat. */
  readonly detectedCorners = this.detectedCornersSignal.asReadonly();
  readonly corners = this.cornersSignal.asReadonly();
  readonly warpedPage = this.warpedPageSignal.asReadonly();
  readonly filter = this.filterSignal.asReadonly();
  /** `null` = neue Seite. */
  readonly editingPageId = this.editingPageIdSignal.asReadonly();

  startNew(frame: ImageBitmap): void {
    this.reset();
    this.sourceFrameSignal.set(frame);
  }

  /**
   * Lädt eine Seite aus dem Page Buffer zum Nachbearbeiten. Die erkannten Ecken bleiben leer —
   * der Zuschneiden-Bildschirm erkennt nach, damit „Auto“ ein Ziel hat, ohne die gespeicherten Ecken zu überschreiben.
   */
  async startEdit(page: ScannedPage): Promise<void> {
    const frame = await createImageBitmap(page.source);

    this.reset();
    this.sourceFrameSignal.set(frame);
    this.cornersSignal.set(page.corners);
    this.filterSignal.set(page.filter);
    this.editingPageIdSignal.set(page.id);
  }

  setDetectedCorners(corners: Quad | null): void {
    this.detectedCornersSignal.set(corners);
  }

  setCorners(corners: Quad): void {
    this.cornersSignal.set(corners);
  }

  setWarpedPage(page: Blob): void {
    this.warpedPageSignal.set(page);
  }

  setFilter(settings: FilterSettings): void {
    this.filterSignal.set(settings);
  }

  /** Gibt das gehaltene ImageBitmap frei, bevor der Zustand geleert wird — sonst hält ein 12-MP-Bitmap den Speicher. */
  reset(): void {
    this.sourceFrameSignal()?.close();
    this.sourceFrameSignal.set(null);
    this.detectedCornersSignal.set(null);
    this.cornersSignal.set(null);
    this.warpedPageSignal.set(null);
    this.filterSignal.set(DEFAULT_FILTER_SETTINGS);
    this.editingPageIdSignal.set(null);
  }
}
