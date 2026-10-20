import { inject, Service } from '@angular/core';

import { MatScope } from './mat-scope';
import { OpencvLoader } from './opencv-loader';

/** Schärfe auf einer kleinen Kopie messen — Verwacklung sieht man dort genauso, die Rechnung bleibt billig. */
const SHARPNESS_MAX_EDGE = 640;

/** Nur die Bildmitte: dort liegt das Dokument, der Tisch drumherum soll nicht mitentscheiden. */
const SHARPNESS_CENTER_RATIO = 0.5;

@Service()
export class Sharpness {
  private readonly opencvLoader = inject(OpencvLoader);

  /** Varianz des Laplace-Bilds: scharfe Kanten geben große Ausschläge, Verwacklung glättet sie weg. Nur zum Vergleichen zweier Bilder derselben Szene. */
  async score(frame: ImageBitmap): Promise<number> {
    const cv = await this.opencvLoader.load();
    const centerImage = this.drawCenter(frame);
    const scope = new MatScope();

    try {
      const sourceMat = scope.track(cv.matFromImageData(centerImage));
      const grayMat = scope.track(new cv.Mat());
      const laplaceMat = scope.track(new cv.Mat());
      const mean = scope.track(new cv.Mat());
      const deviation = scope.track(new cv.Mat());

      cv.cvtColor(sourceMat, grayMat, cv.COLOR_RGBA2GRAY);
      cv.Laplacian(grayMat, laplaceMat, cv.CV_64F);
      cv.meanStdDev(laplaceMat, mean, deviation);

      const standardDeviation = deviation.data64F[0];
      if (standardDeviation === undefined) {
        throw new Error('Schärfemessung lieferte keinen Wert');
      }

      return standardDeviation ** 2;
    } finally {
      scope.releaseAll();
    }
  }

  /** Mittlere Bildhälfte, verkleinert auf höchstens `SHARPNESS_MAX_EDGE` an der langen Kante. */
  private drawCenter(frame: ImageBitmap): ImageData {
    const sourceWidth = frame.width * SHARPNESS_CENTER_RATIO;
    const sourceHeight = frame.height * SHARPNESS_CENTER_RATIO;
    const sourceX = (frame.width - sourceWidth) / 2;
    const sourceY = (frame.height - sourceHeight) / 2;
    const scale = Math.min(1, SHARPNESS_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');

    if (context === null) {
      throw new Error('Kein 2D-Kontext für die Schärfemessung');
    }

    context.drawImage(frame, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  }
}
