import { inject, Service } from '@angular/core';

import type { Mat, MatVector } from '@techstark/opencv-js';

import { isConvexQuad, quadArea, scaleQuad, sortQuadCorners, type Point, type Quad } from './geometry';
import { MatScope } from './mat-scope';
import { OpencvLoader, type OpenCv } from './opencv-loader';

/**
 * Diese fünf Werte sind die Stellschrauben der Erkennung — sie werden beim
 * Feldtest angefasst. Deshalb benannt und kommentiert statt als nackte Zahlen
 * im Aufruf.
 */

/** Längste Kante der Arbeitskopie. Erkennung auf 12 Megapixel ist langsam und findet wegen Papierfaser und Druckraster mehr Kanten, nicht bessere. */
const DETECTION_MAX_EDGE = 1024;

/** Canny-Untergrenze: darunter zählt ein Helligkeitssprung nicht als Kante. Niedrig genug für Papier auf hellem Tisch. */
const EDGE_THRESHOLD_LOW = 75;

/** Canny-Obergrenze: ab hier gilt ein Sprung sicher als Kante und zieht schwächere Nachbarn mit. */
const EDGE_THRESHOLD_HIGH = 200;

/** Glättungstoleranz von `approxPolyDP`, als Anteil des Konturumfangs. 2 % bügelt Wellen im Blattrand glatt, ohne echte Ecken zu verschlucken. */
const POLYGON_EPSILON_FACTOR = 0.02;

/** Ein Blatt, das weniger als ein Fünftel des Bildes füllt, ist eher ein Fliesenrand als das Dokument. */
const MIN_AREA_RATIO = 0.2;

/** Nur die größten Konturen sind Kandidaten — der Rest ist Text, Tischkante, Schatten. */
const CONTOUR_CANDIDATES = 5;

@Service()
export class DocumentDetection {
  private readonly opencvLoader = inject(OpencvLoader);

  /**
   * Sucht das Dokument im Standbild und liefert seine vier Ecken in
   * Original-Koordinaten — oder `null`, wenn kein plausibles Viereck da ist.
   * Kein Notbehelf mit erfundenen Punkten: die Ecken korrigiert dann der User
   * von Hand.
   */
  async detect(source: ImageBitmap): Promise<Quad | null> {
    const cv = await this.opencvLoader.load();
    const scaleFactor = Math.min(1, DETECTION_MAX_EDGE / Math.max(source.width, source.height));
    const workingImage = this.drawScaled(source, scaleFactor);

    if (workingImage === null) {
      return null;
    }

    const detectedQuad = this.findLargestQuad(cv, workingImage);

    if (detectedQuad === null) {
      return null;
    }

    return scaleQuad(detectedQuad, 1 / scaleFactor);
  }

  /** Verkleinerte Arbeitskopie als `ImageData` — das ist das Format, das OpenCV.js direkt entgegennimmt. */
  private drawScaled(source: ImageBitmap, scaleFactor: number): ImageData | null {
    const width = Math.round(source.width * scaleFactor);
    const height = Math.round(source.height * scaleFactor);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');

    if (context === null) {
      return null;
    }

    context.drawImage(source, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  }

  /** Kantenbild bauen, Konturen suchen, den größten plausiblen Vierecks-Kandidaten zurückgeben. */
  private findLargestQuad(cv: OpenCv, image: ImageData): Quad | null {
    const scope = new MatScope();

    try {
      const sourceMat = scope.track(cv.matFromImageData(image));
      const grayMat = scope.track(new cv.Mat());
      const edgeMat = scope.track(new cv.Mat());
      const kernel = scope.track(cv.Mat.ones(3, 3, cv.CV_8U));

      cv.cvtColor(sourceMat, grayMat, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(grayMat, grayMat, new cv.Size(5, 5), 0);
      cv.Canny(grayMat, edgeMat, EDGE_THRESHOLD_LOW, EDGE_THRESHOLD_HIGH);
      // Dilatation schließt die Lücken, die Canny an schwach belichteten Blattkanten lässt — ohne sie zerfällt der Rahmen in vier offene Striche.
      cv.dilate(edgeMat, edgeMat, kernel);

      const contours = scope.track(new cv.MatVector());
      const hierarchy = scope.track(new cv.Mat());

      cv.findContours(edgeMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const minimumArea = image.width * image.height * MIN_AREA_RATIO;

      for (const contour of this.largestContours(cv, contours, scope)) {
        const quad = this.toQuad(cv, contour, scope);

        if (quad !== null && isConvexQuad(quad) && quadArea(quad) >= minimumArea) {
          return quad;
        }
      }

      return null;
    } finally {
      scope.releaseAll();
    }
  }

  /** Die flächengrößten Konturen zuerst — das Dokument ist im Regelfall das größte zusammenhängende Gebilde im Bild. */
  private largestContours(cv: OpenCv, contours: MatVector, scope: MatScope): Mat[] {
    const candidates: { readonly contour: Mat; readonly area: number }[] = [];

    for (let index = 0; index < contours.size(); index += 1) {
      const contour = scope.track(contours.get(index));
      candidates.push({ contour, area: cv.contourArea(contour) });
    }

    candidates.sort((left: { area: number }, right: { area: number }) => right.area - left.area);

    return candidates.slice(0, CONTOUR_CANDIDATES).map((candidate: { contour: Mat }) => candidate.contour);
  }

  /** Kontur auf ein Polygon eindampfen und, falls genau vier Ecken übrig bleiben, als sortiertes Quad zurückgeben. */
  private toQuad(cv: OpenCv, contour: Mat, scope: MatScope): Quad | null {
    const approximation = scope.track(new cv.Mat());
    const epsilon = POLYGON_EPSILON_FACTOR * cv.arcLength(contour, true);

    cv.approxPolyDP(contour, approximation, epsilon, true);

    if (approximation.rows !== 4) {
      return null;
    }

    const coordinates = Array.from(approximation.data32S);
    const points: Point[] = [];

    for (let index = 0; index < 4; index += 1) {
      const x = coordinates[index * 2];
      const y = coordinates[index * 2 + 1];

      if (x === undefined || y === undefined) {
        return null;
      }

      points.push({ x, y });
    }

    return sortQuadCorners(points);
  }
}
