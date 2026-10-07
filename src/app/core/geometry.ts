export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Vier Eckpunkte, IMMER in dieser Reihenfolge: oben-links, oben-rechts,
 *  unten-rechts, unten-links. Koordinaten in Pixeln des Quell-Standbilds. */
export type Quad = readonly [Point, Point, Point, Point];

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Punkt mit dem kleinsten bzw. größten Wert einer Bewertungsfunktion.
 * Eigene Schleife statt `reduce`, weil `noUncheckedIndexedAccess` jeden
 * Array-Zugriff als `Point | undefined` liest und der Code sonst voller
 * Non-Null-Assertions stünde.
 */
function pickExtreme(points: readonly Point[], score: (point: Point) => number, prefer: 'min' | 'max'): Point {
  let best: Point | null = null;
  let bestScore = 0;

  for (const point of points) {
    const currentScore = score(point);
    const isBetter = prefer === 'min' ? currentScore < bestScore : currentScore > bestScore;

    if (best === null || isBetter) {
      best = point;
      bestScore = currentScore;
    }
  }

  if (best === null) {
    throw new Error('Kein Punkt zum Auswählen vorhanden.');
  }

  return best;
}

function distance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function cross(origin: Point, first: Point, second: Point): number {
  return (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);
}

/**
 * Bringt vier beliebig sortierte Punkte in die Kontrakt-Reihenfolge
 * oben-links, oben-rechts, unten-rechts, unten-links.
 *
 * Trick ohne Winkelrechnung: In Bildkoordinaten (y zeigt nach unten) hat
 * oben-links die kleinste Summe `x + y` und unten-rechts die größte;
 * oben-rechts hat die kleinste Differenz `y - x`, unten-links die größte.
 */
export function sortQuadCorners(points: readonly Point[]): Quad {
  if (points.length !== 4) {
    throw new Error(`Ein Quad braucht genau vier Punkte, bekommen: ${points.length}`);
  }

  const topLeft = pickExtreme(points, (point: Point) => point.x + point.y, 'min');
  const bottomRight = pickExtreme(points, (point: Point) => point.x + point.y, 'max');
  const topRight = pickExtreme(points, (point: Point) => point.y - point.x, 'min');
  const bottomLeft = pickExtreme(points, (point: Point) => point.y - point.x, 'max');

  return [topLeft, topRight, bottomRight, bottomLeft];
}

/** Rechnet ein Quad zwischen zwei Auflösungen um — die Erkennung läuft verkleinert, das Begradigen auf dem Original. */
export function scaleQuad(quad: Quad, factor: number): Quad {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const scalePoint = (point: Point): Point => ({ x: point.x * factor, y: point.y * factor });

  return [scalePoint(topLeft), scalePoint(topRight), scalePoint(bottomRight), scalePoint(bottomLeft)];
}

/**
 * Zielgröße des begradigten Bildes: die jeweils längere der beiden
 * gegenüberliegenden Kanten. Die kürzere Kante ist die perspektivisch weiter
 * entfernte — nach ihr zu skalieren würde Auflösung wegwerfen.
 */
export function quadOutputSize(quad: Quad): Size {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;

  const width = Math.max(distance(topLeft, topRight), distance(bottomLeft, bottomRight));
  const height = Math.max(distance(topLeft, bottomLeft), distance(topRight, bottomRight));

  return { width: Math.round(width), height: Math.round(height) };
}

/** Fläche über die Trapezformel (Gaußsche Flächenformel), immer positiv. */
export function quadArea(quad: Quad): number {
  let sum = 0;

  for (let index = 0; index < quad.length; index += 1) {
    const current = quad[index % quad.length];
    const next = quad[(index + 1) % quad.length];

    if (current === undefined || next === undefined) {
      return 0;
    }

    sum += current.x * next.y - next.x * current.y;
  }

  return Math.abs(sum) / 2;
}

/**
 * Konvex heißt: alle vier Kreuzprodukte aufeinanderfolgender Kanten haben
 * dasselbe Vorzeichen. Ein über Kreuz gefaltetes Viereck (Sanduhr) fällt
 * damit raus — genau der Fall, den die Kantenerkennung gelegentlich liefert.
 */
export function isConvexQuad(quad: Quad): boolean {
  let sawPositive = false;
  let sawNegative = false;

  for (let index = 0; index < quad.length; index += 1) {
    const origin = quad[index % quad.length];
    const first = quad[(index + 1) % quad.length];
    const second = quad[(index + 2) % quad.length];

    if (origin === undefined || first === undefined || second === undefined) {
      return false;
    }

    const value = cross(origin, first, second);

    if (value > 0) {
      sawPositive = true;
    } else if (value < 0) {
      sawNegative = true;
    }

    if (sawPositive && sawNegative) {
      return false;
    }
  }

  return sawPositive !== sawNegative;
}

/** Startviereck, wenn nichts erkannt wurde: das Bild mit einem Randabstand von `ratio` je Seite. */
export function insetQuad(size: Size, ratio: number): Quad {
  const left = size.width * ratio;
  const top = size.height * ratio;
  const right = size.width - left;
  const bottom = size.height - top;

  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

/**
 * Einpassen wie `object-fit: contain`. Die einzige Umrechnung zwischen Bild-
 * und Anzeige-Koordinaten: Anzeige = Bild · scale + offset.
 */
export function fitContain(source: Size, box: Size): { readonly scale: number; readonly offsetX: number; readonly offsetY: number } {
  if (source.width <= 0 || source.height <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }

  const scale = Math.min(box.width / source.width, box.height / source.height);

  return {
    scale,
    offsetX: (box.width - source.width * scale) / 2,
    offsetY: (box.height - source.height * scale) / 2,
  };
}

/** Hält einen Punkt innerhalb des Bildes — eine Ecke außerhalb würde beim Begradigen Randpixel verschmieren. */
export function clampPoint(point: Point, size: Size): Point {
  return {
    x: Math.min(Math.max(point.x, 0), size.width),
    y: Math.min(Math.max(point.y, 0), size.height),
  };
}

/** Mitten der vier Kanten; Kante i läuft von Ecke i zu Ecke (i + 1) % 4. */
export function edgeMidpoints(quad: Quad): readonly [Point, Point, Point, Point] {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const midpoint = (from: Point, to: Point): Point => ({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });

  return [midpoint(topLeft, topRight), midpoint(topRight, bottomRight), midpoint(bottomRight, bottomLeft), midpoint(bottomLeft, topLeft)];
}
