import { inject, Service } from '@angular/core';

import type { Mat } from '@techstark/opencv-js';

import type { FilterId, FilterSettings } from './filter-settings';
import { MatScope } from './mat-scope';
import { OpencvLoader, type OpenCv } from './opencv-loader';

const FILTERED_IMAGE_TYPE = 'image/jpeg';
const FILTERED_IMAGE_QUALITY = 0.92;

/**
 * Stellschrauben der Scan-Looks — sie werden beim Feldtest mit echten Fotos
 * angefasst. Deshalb benannt und kommentiert statt als nackte Zahlen im Aufruf.
 */

/** Hintergrundschätzung auf einem Viertel der Kantenlänge: spart Rechenzeit, und Licht ändert sich ohnehin nur langsam über die Seite. */
const BG_DOWNSCALE = 4;

/** Schließen mit diesem Kern füllt Schriftstriche mit Papierfarbe auf — übrig bleibt nur die Beleuchtung. Auf der Viertel-Auflösung gemessen. */
const BG_CLOSE_KERNEL = 9;

/** Median glättet, was das Schließen an Flecken übrig lässt (dicke Überschriften, Stempel), ohne harte Schattenkanten zu verwaschen. Muss ungerade sein. */
const BG_MEDIAN_KERNEL = 21;

/** Kachelraster des CLAHE: 8 × 8 Kacheln gleichen Helligkeit lokal aus, ohne dass einzelne Kacheln sichtbar werden. */
const CLAHE_TILE_GRID = 8;

/** CLAHE-Begrenzung je Look: höher heißt mehr Kontrast, aber auch mehr verstärktes Papierrauschen. */
const AUTO_CLAHE_CLIP = 2.0;
const SCAN_CLAHE_CLIP = 2.5;
const GRAY_CLAHE_CLIP = 2.0;

/** Nachschärfen: Radius der Unschärfe, die abgezogen wird. 1,5 px trifft die Strichbreite normaler Schrift bei Kameraauflösung. */
const UNSHARP_SIGMA = 1.5;

/** Stärke des Nachschärfens. „Auto“ bleibt fotonah, „Scan“ darf härter wirken. */
const AUTO_UNSHARP_AMOUNT = 0.5;
const SCAN_UNSHARP_AMOUNT = 0.8;

/** Vor Otsu leicht glätten — sonst zerfällt Papierrauschen in schwarze Sprenkel. */
const BW_BLUR_KERNEL = 3;

/** Regler-Neutralwert und Abbildung auf `convertTo`: Kontrast 0..100 → Faktor 0,5 … 1,5, Helligkeit 0..100 → Versatz −60 … +60. */
const SLIDER_NEUTRAL = 50;
const CONTRAST_ALPHA_MIN = 0.5;
const BRIGHTNESS_BETA_STEP = 1.2;

@Service()
export class ImageFilters {
  private readonly opencvLoader = inject(OpencvLoader);

  /**
   * Rechnet einen Scan-Look auf das begradigte Bild. Mit `maxEdge` verkleinert
   * für die Vorschau, ohne auf voller Auflösung für Seite und PDF (ADR-006).
   */
  async renderFiltered(warped: Blob, settings: FilterSettings, maxEdge?: number): Promise<Blob> {
    const cv = await this.opencvLoader.load();
    const input = await this.readPixels(warped, maxEdge);
    const scope = new MatScope();
    let filteredImage: ImageData;

    try {
      const image = scope.track(cv.matFromImageData(input));

      // Ab hier ist `image` RGB oder einkanalig grau — nie RGBA, damit Kontrast und Helligkeit den Alphakanal nicht mitverschieben.
      this.applyFilter(cv, image, settings.filter, scope);
      this.adjustContrastAndBrightness(image, settings);
      this.toRgba(cv, image);

      // Kopie, weil `image.data` auf den WebAssembly-Speicher zeigt, der im `finally` freigegeben wird.
      filteredImage = new ImageData(new Uint8ClampedArray(image.data), image.cols, image.rows);
    } finally {
      scope.releaseAll();
    }

    return this.encode(filteredImage);
  }

  /** Wandelt das RGBA-Bild an Ort und Stelle in den gewählten Look um. */
  private applyFilter(cv: OpenCv, image: Mat, filter: FilterId, scope: MatScope): void {
    switch (filter) {
      case 'original':
        cv.cvtColor(image, image, cv.COLOR_RGBA2RGB);
        return;
      case 'auto':
        this.applyAuto(cv, image, scope);
        return;
      case 'scan':
        cv.cvtColor(image, image, cv.COLOR_RGBA2GRAY);
        this.backgroundDivide(cv, image, scope);
        this.clahe(cv, image, SCAN_CLAHE_CLIP);
        this.unsharp(cv, image, SCAN_UNSHARP_AMOUNT, scope);
        return;
      case 'bw':
        cv.cvtColor(image, image, cv.COLOR_RGBA2GRAY);
        this.backgroundDivide(cv, image, scope);
        cv.GaussianBlur(image, image, new cv.Size(BW_BLUR_KERNEL, BW_BLUR_KERNEL), 0);
        cv.threshold(image, image, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        return;
      case 'gray':
        cv.cvtColor(image, image, cv.COLOR_RGBA2GRAY);
        this.clahe(cv, image, GRAY_CLAHE_CLIP);
        return;
    }
  }

  /** Farbe bleibt: nur die Helligkeit (L im Lab-Farbraum) wird ausgeglichen, a und b — die Farbtöne — bleiben unberührt. */
  private applyAuto(cv: OpenCv, image: Mat, scope: MatScope): void {
    const channels = scope.track(new cv.MatVector());

    cv.cvtColor(image, image, cv.COLOR_RGBA2RGB);
    cv.cvtColor(image, image, cv.COLOR_RGB2Lab);
    cv.split(image, channels);

    const lightness = scope.track(channels.get(0));

    this.backgroundDivide(cv, lightness, scope);
    this.clahe(cv, lightness, AUTO_CLAHE_CLIP);
    channels.set(0, lightness);
    cv.merge(channels, image);
    cv.cvtColor(image, image, cv.COLOR_Lab2RGB);
    this.unsharp(cv, image, AUTO_UNSHARP_AMOUNT, scope);
  }

  /**
   * Teilt das Graubild durch eine Schätzung der Beleuchtung: Papier wird überall
   * gleich hell, Schatten und Lichtverlauf verschwinden, Schrift bleibt dunkel.
   */
  private backgroundDivide(cv: OpenCv, gray: Mat, scope: MatScope): void {
    const background = scope.track(new cv.Mat());
    const smallSize = new cv.Size(Math.max(1, Math.round(gray.cols / BG_DOWNSCALE)), Math.max(1, Math.round(gray.rows / BG_DOWNSCALE)));
    const kernel = scope.track(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(BG_CLOSE_KERNEL, BG_CLOSE_KERNEL)));

    cv.resize(gray, background, smallSize, 0, 0, cv.INTER_AREA);
    cv.morphologyEx(background, background, cv.MORPH_CLOSE, kernel);
    cv.medianBlur(background, background, BG_MEDIAN_KERNEL);
    cv.resize(background, background, new cv.Size(gray.cols, gray.rows), 0, 0, cv.INTER_LINEAR);
    // Wo der Hintergrund 0 ist, liefert OpenCV 0 statt eines Fehlers — tiefschwarze Ränder bleiben schwarz.
    cv.divide(gray, background, gray, 255);
  }

  /** Kontrastbegrenzter lokaler Histogrammausgleich auf einem Graubild. Eigenes Ziel statt an Ort und Stelle — OpenCV sichert für CLAHE kein In-place-Rechnen zu. */
  private clahe(cv: OpenCv, gray: Mat, clipLimit: number): void {
    const equalizer = new cv.CLAHE(clipLimit, new cv.Size(CLAHE_TILE_GRID, CLAHE_TILE_GRID));
    const equalized = new cv.Mat();

    try {
      equalizer.apply(gray, equalized);
      equalized.copyTo(gray);
    } finally {
      equalized.delete();
      equalizer.delete();
    }
  }

  /** Unscharfmaskierung: eine weichgezeichnete Kopie abziehen hebt Kanten — also Schrift — hervor. */
  private unsharp(cv: OpenCv, image: Mat, amount: number, scope: MatScope): void {
    const blurred = scope.track(new cv.Mat());

    cv.GaussianBlur(image, blurred, new cv.Size(0, 0), UNSHARP_SIGMA);
    cv.addWeighted(image, 1 + amount, blurred, -amount, 0, image);
  }

  private adjustContrastAndBrightness(image: Mat, settings: FilterSettings): void {
    if (settings.contrast === SLIDER_NEUTRAL && settings.brightness === SLIDER_NEUTRAL) {
      return;
    }

    const alpha = CONTRAST_ALPHA_MIN + settings.contrast / 100;
    const beta = (settings.brightness - SLIDER_NEUTRAL) * BRIGHTNESS_BETA_STEP;

    image.convertTo(image, -1, alpha, beta);
  }

  private toRgba(cv: OpenCv, image: Mat): void {
    if (image.channels() === 1) {
      cv.cvtColor(image, image, cv.COLOR_GRAY2RGBA);
      return;
    }

    cv.cvtColor(image, image, cv.COLOR_RGB2RGBA);
  }

  private async readPixels(image: Blob, maxEdge: number | undefined): Promise<ImageData> {
    const bitmap = await createImageBitmap(image);

    try {
      const scale = this.previewScale(bitmap, maxEdge);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const context = this.context2d(new OffscreenCanvas(width, height));

      context.drawImage(bitmap, 0, 0, width, height);
      return context.getImageData(0, 0, width, height);
    } finally {
      bitmap.close();
    }
  }

  /** Nur verkleinern, nie vergrößern — ein Bild unter `maxEdge` wird in Originalgröße gerechnet. */
  private previewScale(bitmap: ImageBitmap, maxEdge: number | undefined): number {
    if (maxEdge === undefined) {
      return 1;
    }

    return Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  }

  private encode(image: ImageData): Promise<Blob> {
    const canvas = new OffscreenCanvas(image.width, image.height);

    this.context2d(canvas).putImageData(image, 0, 0);
    return canvas.convertToBlob({ type: FILTERED_IMAGE_TYPE, quality: FILTERED_IMAGE_QUALITY });
  }

  private context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
    const context = canvas.getContext('2d');

    if (context === null) {
      throw new Error('Kein 2D-Kontext verfügbar.');
    }

    return context;
  }
}
