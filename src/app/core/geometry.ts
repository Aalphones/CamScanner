export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Vier Eckpunkte, IMMER in dieser Reihenfolge: oben-links, oben-rechts,
 *  unten-rechts, unten-links. Koordinaten in Pixeln des Quell-Standbilds. */
export type Quad = readonly [Point, Point, Point, Point];
