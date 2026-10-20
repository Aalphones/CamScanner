import { clampPoint, isConvexQuad, quadsClose, type Point, type Quad } from './geometry';

/** Stützpunkte je Blattkante. */
const EDGE_SAMPLES = 32;

/** Nur das mittlere Stück jeder Kante: Ecken sind oft abgerundet oder geknickt. */
const EDGE_SAMPLE_START = 0.1;
const EDGE_SAMPLE_END = 0.9;

/** Schrittweite entlang der Normalen in Pixeln. */
const PROFILE_STEP = 0.5;

/** Je Profilpunkt drei Proben quer gemittelt — glättet Papierfaser und Rauschen. */
const TANGENT_OFFSETS = [-2, 0, 2] as const;

/** Stützpunkte mit weniger als der Hälfte des mittleren Kantensprungs der Seite sind Rauschen. */
const MIN_STRENGTH_RATIO = 0.5;

/** Punkte weiter als 3 × Median-Abweichung (mindestens 1 px) von der ersten Geraden fliegen raus. */
const OUTLIER_MAD_FACTOR = 3;
const OUTLIER_MIN_PX = 1;

const MIN_FIT_POINTS = 8;
const MIN_SIDE_LENGTH = 40;

/** Kreuzprodukt der Richtungen darunter: die Geraden sind praktisch parallel und haben keinen brauchbaren Schnittpunkt. */
const PARALLEL_EPSILON = 1e-6;

interface Line {
  readonly point: Point;
  readonly direction: Point;
}

interface EdgeSample {
  readonly point: Point;
  readonly strength: number;
}

function luminance(image: ImageData, x: number, y: number): number {
  const offset = (y * image.width + x) * 4;
  const data = image.data;

  return 0.299 * (data[offset] ?? 0) + 0.587 * (data[offset + 1] ?? 0) + 0.114 * (data[offset + 2] ?? 0);
}

/** Helligkeit an einer Kommastelle, bilinear zwischen den vier Nachbarpixeln; außerhalb gilt der nächste Randpixel. */
function gray(image: ImageData, x: number, y: number): number {
  const clampedX = Math.min(Math.max(x, 0), image.width - 1);
  const clampedY = Math.min(Math.max(y, 0), image.height - 1);
  const left = Math.floor(clampedX);
  const top = Math.floor(clampedY);
  const right = Math.min(left + 1, image.width - 1);
  const bottom = Math.min(top + 1, image.height - 1);
  const fractionX = clampedX - left;
  const fractionY = clampedY - top;

  const upper = luminance(image, left, top) * (1 - fractionX) + luminance(image, right, top) * fractionX;
  const lower = luminance(image, left, bottom) * (1 - fractionX) + luminance(image, right, bottom) * fractionX;

  return upper * (1 - fractionY) + lower * fractionY;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left: number, right: number) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Stärkster Helligkeitssprung auf dem Profil quer zur Kante, auf Bruchteile
 * eines Schritts genau: die Parabel durch den Spitzenwert und seine Nachbarn
 * legt die Kante zwischen die Abtastpunkte.
 */
function edgePoint(image: ImageData, base: Point, tangent: Point, normal: Point, radius: number): EdgeSample {
  const count = Math.round((2 * radius) / PROFILE_STEP) + 1;
  const profile: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const offset = -radius + index * PROFILE_STEP;
    let sum = 0;

    for (const across of TANGENT_OFFSETS) {
      sum += gray(image, base.x + normal.x * offset + tangent.x * across, base.y + normal.y * offset + tangent.y * across);
    }

    profile.push(sum / TANGENT_OFFSETS.length);
  }

  const magnitudes = new Array<number>(count).fill(0);
  let peak = 1;

  for (let index = 1; index < count - 1; index += 1) {
    const magnitude = Math.abs((profile[index + 1] ?? 0) - (profile[index - 1] ?? 0));
    magnitudes[index] = magnitude;

    if (magnitude > (magnitudes[peak] ?? 0)) {
      peak = index;
    }
  }

  const before = magnitudes[peak - 1] ?? 0;
  const center = magnitudes[peak] ?? 0;
  const after = magnitudes[peak + 1] ?? 0;
  const denominator = 2 * (before - 2 * center + after);
  let shift = 0;

  if (denominator !== 0) {
    shift = Math.min(Math.max((before - after) / denominator, -0.5), 0.5);
  }

  const offset = -radius + (peak + shift) * PROFILE_STEP;

  return { point: { x: base.x + normal.x * offset, y: base.y + normal.y * offset }, strength: center };
}

/** Gerade mit dem kleinsten quadratischen Abstand zu allen Punkten: Hauptachse der Punktwolke um ihren Schwerpunkt. */
function fitLine(points: readonly Point[]): Line {
  let centerX = 0;
  let centerY = 0;

  for (const point of points) {
    centerX += point.x / points.length;
    centerY += point.y / points.length;
  }

  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;

  for (const point of points) {
    const deltaX = point.x - centerX;
    const deltaY = point.y - centerY;

    sumXX += deltaX * deltaX;
    sumYY += deltaY * deltaY;
    sumXY += deltaX * deltaY;
  }

  const angle = 0.5 * Math.atan2(2 * sumXY, sumXX - sumYY);

  return { point: { x: centerX, y: centerY }, direction: { x: Math.cos(angle), y: Math.sin(angle) } };
}

function distanceToLine(point: Point, line: Line): number {
  return Math.abs((point.x - line.point.x) * line.direction.y - (point.y - line.point.y) * line.direction.x);
}

/** Gerade durch die echte Blattkante zwischen zwei erkannten Ecken — oder der Grund, warum es keine gibt. */
function refineSide(image: ImageData, from: Point, to: Point, radius: number): Line | string {
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  if (length < MIN_SIDE_LENGTH) {
    return 'Kante zu kurz';
  }

  const tangent: Point = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const normal: Point = { x: -tangent.y, y: tangent.x };
  const samples: EdgeSample[] = [];

  for (let index = 0; index < EDGE_SAMPLES; index += 1) {
    const ratio = EDGE_SAMPLE_START + ((EDGE_SAMPLE_END - EDGE_SAMPLE_START) * index) / (EDGE_SAMPLES - 1);
    const base: Point = { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };

    samples.push(edgePoint(image, base, tangent, normal, radius));
  }

  const minimumStrength = MIN_STRENGTH_RATIO * median(samples.map((sample: EdgeSample) => sample.strength));
  // Stärke 0 heißt: gar kein Sprung im Fenster (z. B. überbelichtete Fläche) — der „Spitzenwert“ läge dann willkürlich am Fensterrand.
  const strongPoints = samples
    .filter((sample: EdgeSample) => sample.strength > 0 && sample.strength >= minimumStrength)
    .map((sample: EdgeSample) => sample.point);

  if (strongPoints.length < MIN_FIT_POINTS) {
    return 'zu wenige Kantenpunkte';
  }

  const firstLine = fitLine(strongPoints);
  const residuals = strongPoints.map((point: Point) => distanceToLine(point, firstLine));
  const limit = Math.max(OUTLIER_MIN_PX, OUTLIER_MAD_FACTOR * median(residuals));
  const inliers = strongPoints.filter((_point: Point, index: number) => (residuals[index] ?? Infinity) <= limit);

  if (inliers.length < MIN_FIT_POINTS) {
    return 'zu wenige Kantenpunkte';
  }

  return fitLine(inliers);
}

function intersect(first: Line, second: Line): Point | null {
  const denominator = first.direction.x * second.direction.y - first.direction.y * second.direction.x;

  if (Math.abs(denominator) < PARALLEL_EPSILON) {
    return null;
  }

  const deltaX = second.point.x - first.point.x;
  const deltaY = second.point.y - first.point.y;
  const along = (deltaX * second.direction.y - deltaY * second.direction.x) / denominator;

  return { x: first.point.x + first.direction.x * along, y: first.point.y + first.direction.y * along };
}

function reject(quad: Quad, reason: string): Quad {
  console.info(`Kanten: verworfen (${reason})`);
  return quad;
}

/** Zieht erkannte Ecken auf die echten Blattkanten der vollen Auflösung: je Kante eine angepasste Gerade, Ecken als Schnittpunkte. Im Zweifel bleibt das Eingangs-Viereck (ADR-010). */
export function refineQuad(image: ImageData, quad: Quad, searchRadius: number): Quad {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;

  const top = refineSide(image, topLeft, topRight, searchRadius);
  if (typeof top === 'string') {
    return reject(quad, top);
  }

  const right = refineSide(image, topRight, bottomRight, searchRadius);
  if (typeof right === 'string') {
    return reject(quad, right);
  }

  const bottom = refineSide(image, bottomRight, bottomLeft, searchRadius);
  if (typeof bottom === 'string') {
    return reject(quad, bottom);
  }

  const left = refineSide(image, bottomLeft, topLeft, searchRadius);
  if (typeof left === 'string') {
    return reject(quad, left);
  }

  const newTopLeft = intersect(left, top);
  const newTopRight = intersect(top, right);
  const newBottomRight = intersect(right, bottom);
  const newBottomLeft = intersect(bottom, left);

  if (newTopLeft === null || newTopRight === null || newBottomRight === null || newBottomLeft === null) {
    return reject(quad, 'parallele Kanten');
  }

  const size = { width: image.width, height: image.height };
  const refined: Quad = [clampPoint(newTopLeft, size), clampPoint(newTopRight, size), clampPoint(newBottomRight, size), clampPoint(newBottomLeft, size)];

  if (!quadsClose(quad, refined, 2 * searchRadius)) {
    return reject(quad, 'Ecke zu weit gewandert');
  }

  if (!isConvexQuad(refined)) {
    return reject(quad, 'nicht konvex');
  }

  return refined;
}
