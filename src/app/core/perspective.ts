import { inject, Service } from '@angular/core';

import { quadOutputSize, type Quad, type Size } from './geometry';
import { MatScope } from './mat-scope';
import { OpencvLoader } from './opencv-loader';

const WARPED_IMAGE_TYPE = 'image/jpeg';
const WARPED_IMAGE_QUALITY = 0.92;

@Service()
export class Perspective {
  private readonly opencvLoader = inject(OpencvLoader);

  /**
   * Schneidet das Viereck aus dem Original und zieht es zum Rechteck gerade.
   * Läuft auf voller Auflösung — die verkleinerte Arbeitskopie der Erkennung
   * würde das Ergebnis unscharf machen.
   */
  async warp(source: ImageBitmap, corners: Quad): Promise<Blob> {
    const cv = await this.opencvLoader.load();
    const sourceImage = this.readPixels(source);
    const target = quadOutputSize(corners);

    if (target.width < 1 || target.height < 1) {
      throw new Error(`Viereck zu klein zum Begradigen: ${target.width} × ${target.height}`);
    }

    const scope = new MatScope();
    let warpedImage: ImageData;

    try {
      const sourceMat = scope.track(cv.matFromImageData(sourceImage));
      const warpedMat = scope.track(new cv.Mat());
      const [topLeft, topRight, bottomRight, bottomLeft] = corners;
      const sourcePoints = scope.track(
        cv.matFromArray(4, 1, cv.CV_32FC2, [topLeft.x, topLeft.y, topRight.x, topRight.y, bottomRight.x, bottomRight.y, bottomLeft.x, bottomLeft.y]),
      );
      const targetPoints = scope.track(
        cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, target.width, 0, target.width, target.height, 0, target.height]),
      );
      const transform = scope.track(cv.getPerspectiveTransform(sourcePoints, targetPoints));

      // BORDER_REPLICATE statt Schwarz: liegt eine Ecke genau auf dem Bildrand, entsteht sonst ein dunkler Saum.
      cv.warpPerspective(sourceMat, warpedMat, transform, new cv.Size(target.width, target.height), cv.INTER_LINEAR, cv.BORDER_REPLICATE);

      // Kopie, weil `warpedMat.data` auf den WebAssembly-Speicher zeigt, der im `finally` freigegeben wird.
      warpedImage = new ImageData(new Uint8ClampedArray(warpedMat.data), target.width, target.height);
    } finally {
      scope.releaseAll();
    }

    return this.encode(warpedImage, target);
  }

  private readPixels(source: ImageBitmap): ImageData {
    const canvas = new OffscreenCanvas(source.width, source.height);
    const context = this.context2d(canvas);

    context.drawImage(source, 0, 0);
    return context.getImageData(0, 0, source.width, source.height);
  }

  private encode(image: ImageData, size: Size): Promise<Blob> {
    const canvas = new OffscreenCanvas(size.width, size.height);

    this.context2d(canvas).putImageData(image, 0, 0);
    return canvas.convertToBlob({ type: WARPED_IMAGE_TYPE, quality: WARPED_IMAGE_QUALITY });
  }

  private context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
    const context = canvas.getContext('2d');

    if (context === null) {
      throw new Error('Kein 2D-Kontext verfügbar.');
    }

    return context;
  }
}
