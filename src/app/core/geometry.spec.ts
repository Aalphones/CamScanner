import { isConvexQuad, quadArea, quadOutputSize, scaleQuad, sortQuadCorners, type Point, type Quad } from './geometry';

describe('geometry', () => {
  describe('sortQuadCorners', () => {
    it('sortiert unsortierte Punkte eines gedrehten Rechtecks in die Kontrakt-Reihenfolge', () => {
      // Rechteck, um ca. 20 Grad gedreht — bewusst in wilder Reihenfolge übergeben.
      const unsorted: readonly Point[] = [
        { x: 190, y: 90 }, // unten-rechts
        { x: 20, y: 40 }, // oben-links
        { x: 60, y: 130 }, // unten-links
        { x: 150, y: 10 }, // oben-rechts
      ];

      const sorted = sortQuadCorners(unsorted);

      expect(sorted[0]).toEqual({ x: 20, y: 40 });
      expect(sorted[1]).toEqual({ x: 150, y: 10 });
      expect(sorted[2]).toEqual({ x: 190, y: 90 });
      expect(sorted[3]).toEqual({ x: 60, y: 130 });
    });

    it('wirft, wenn nicht genau vier Punkte übergeben werden', () => {
      expect(() => sortQuadCorners([{ x: 0, y: 0 }])).toThrow();
    });
  });

  describe('scaleQuad', () => {
    it('verdoppelt mit Faktor 2 alle Koordinaten', () => {
      const quad: Quad = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
        { x: 7, y: 8 },
      ];

      expect(scaleQuad(quad, 2)).toEqual([
        { x: 2, y: 4 },
        { x: 6, y: 8 },
        { x: 10, y: 12 },
        { x: 14, y: 16 },
      ]);
    });
  });

  describe('quadOutputSize', () => {
    it('liefert für ein 100x200-Rechteck exakt 100x200', () => {
      const quad: Quad = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 200 },
        { x: 0, y: 200 },
      ];

      expect(quadOutputSize(quad)).toEqual({ width: 100, height: 200 });
    });

    it('nimmt bei perspektivisch ungleichen Kanten die längere', () => {
      const quad: Quad = [
        { x: 10, y: 0 },
        { x: 90, y: 0 },
        { x: 100, y: 200 },
        { x: 0, y: 200 },
      ];

      expect(quadOutputSize(quad).width).toBe(100);
    });
  });

  describe('quadArea', () => {
    it('berechnet die Fläche eines Rechtecks', () => {
      const quad: Quad = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 200 },
        { x: 0, y: 200 },
      ];

      expect(quadArea(quad)).toBe(20000);
    });
  });

  describe('isConvexQuad', () => {
    it('erkennt ein normales Rechteck als konvex', () => {
      const quad: Quad = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 200 },
        { x: 0, y: 200 },
      ];

      expect(isConvexQuad(quad)).toBe(true);
    });

    it('erkennt ein über Kreuz gefaltetes Viereck als nicht konvex', () => {
      const hourglass: Quad = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 200 },
        { x: 100, y: 200 },
      ];

      expect(isConvexQuad(hourglass)).toBe(false);
    });
  });
});
