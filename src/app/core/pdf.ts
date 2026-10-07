import { Service } from '@angular/core';

export type ExportQuality = 'small' | 'medium' | 'original';
export type Rotation = 0 | 90 | 180 | 270;

export interface PdfPageInput {
  readonly image: Blob;
  readonly rotation: Rotation;
}

interface QualityPreset {
  /** Längste Kante in Pixeln, größer wird nie skaliert. */
  readonly maxEdge: number;
  readonly jpegQuality: number;
}

export const A4_WIDTH_PT = 595;
export const A4_HEIGHT_PT = 842;

/** `original` = das vorhandene JPEG unverändert einbetten. */
export const QUALITY_PRESETS: Record<ExportQuality, QualityPreset | null> = {
  small: { maxEdge: 1240, jpegQuality: 0.7 },
  medium: { maxEdge: 2000, jpegQuality: 0.8 },
  original: null,
};

const JPEG_TYPE = 'image/jpeg';

@Service()
export class Pdf {
  /** Jede Seite wird A4 hochkant; das Bild sitzt größtmöglich eingepasst in der Mitte, die Drehung dreht die ganze Seite. */
  async buildPdf(pages: readonly PdfPageInput[], quality: ExportQuality): Promise<Blob> {
    // pdf-lib erst hier laden, damit es nicht im Start-Bundle liegt.
    const { PDFDocument, degrees } = await import('pdf-lib');
    const document = await PDFDocument.create();
    const preset = QUALITY_PRESETS[quality];

    // Seite für Seite, nicht parallel: jede verkleinerte Kopie ist ein volles Bitmap im Speicher.
    for (const pageInput of pages) {
      const jpeg = preset === null ? pageInput.image : await this.shrink(pageInput.image, preset);
      const embedded = await document.embedJpg(await jpeg.arrayBuffer());
      const scale = Math.min(A4_WIDTH_PT / embedded.width, A4_HEIGHT_PT / embedded.height);
      const drawWidth = embedded.width * scale;
      const drawHeight = embedded.height * scale;
      const page = document.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);

      page.drawImage(embedded, {
        x: (A4_WIDTH_PT - drawWidth) / 2,
        y: (A4_HEIGHT_PT - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
      });
      page.setRotation(degrees(pageInput.rotation));
    }

    const bytes = await document.save();
    // Kopie auf einen eigenen ArrayBuffer, weil `save()` einen Uint8Array<ArrayBufferLike> liefert, den Blob nicht annimmt.
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  }

  private async shrink(image: Blob, preset: QualityPreset): Promise<Blob> {
    const bitmap = await createImageBitmap(image);

    try {
      const scale = Math.min(1, preset.maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');

      if (context === null) {
        throw new Error('Kein 2D-Kontext verfügbar.');
      }

      context.drawImage(bitmap, 0, 0, width, height);
      return await canvas.convertToBlob({ type: JPEG_TYPE, quality: preset.jpegQuality });
    } finally {
      bitmap.close();
    }
  }
}
