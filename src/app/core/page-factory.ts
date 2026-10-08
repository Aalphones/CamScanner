import type { FilterSettings } from './filter-settings';
import type { Quad } from './geometry';
import type { Rotation, ScannedPage } from './page-buffer';

export interface CreatePageInput {
  readonly sourceFrame: ImageBitmap;
  readonly corners: Quad;
  readonly warped: Blob;
  readonly filter: FilterSettings;
  /** Das gefilterte Ergebnis in voller Auflösung — rechnet der Aufrufer per `ImageFilters.renderFiltered`. */
  readonly output: Blob;
  /** Beim Bearbeiten das vorhandene JPEG weiterreichen — jedes Neu-Kodieren kostet Bildqualität. */
  readonly source?: Blob;
  readonly id?: string;
  readonly rotation?: Rotation;
}

const JPEG_TYPE = 'image/jpeg';
const SOURCE_QUALITY = 0.9;
const THUMBNAIL_QUALITY = 0.8;
const THUMBNAIL_EDGE = 320;

/**
 * Baut eine Seite für den Page Buffer. Das Standbild wird als JPEG gehalten statt als ImageBitmap —
 * ein 12-MP-Bitmap belegt rund 48 MB, das JPEG einen Bruchteil davon (ADR-005).
 */
export async function createPage(input: CreatePageInput): Promise<ScannedPage> {
  const rotation = input.rotation ?? 0;
  const [source, thumbnailUrl] = await Promise.all([
    input.source ?? encodeSource(input.sourceFrame),
    renderThumbnail(input.output, rotation),
  ]);

  return {
    id: input.id ?? crypto.randomUUID(),
    source,
    corners: input.corners,
    warped: input.warped,
    filter: input.filter,
    output: input.output,
    rotation,
    thumbnailUrl,
  };
}

/** Vorschaubild mit 320 px langer Kante, gedreht gezeichnet, als Object-URL — freigeben muss der Aufrufer. */
export async function renderThumbnail(image: Blob, rotation: Rotation): Promise<string> {
  const bitmap = await createImageBitmap(image);

  try {
    const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const isSideways = rotation === 90 || rotation === 270;
    const canvas = isSideways ? new OffscreenCanvas(height, width) : new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');

    if (context === null) {
      throw new Error('Kein 2D-Kontext verfügbar.');
    }

    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(bitmap, -width / 2, -height / 2, width, height);

    const blob = await canvas.convertToBlob({ type: JPEG_TYPE, quality: THUMBNAIL_QUALITY });
    return URL.createObjectURL(blob);
  } finally {
    bitmap.close();
  }
}

async function encodeSource(frame: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(frame.width, frame.height);
  const context = canvas.getContext('2d');

  if (context === null) {
    throw new Error('Kein 2D-Kontext verfügbar.');
  }

  context.drawImage(frame, 0, 0);
  return canvas.convertToBlob({ type: JPEG_TYPE, quality: SOURCE_QUALITY });
}
