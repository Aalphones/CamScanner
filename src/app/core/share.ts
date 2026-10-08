import { Service } from '@angular/core';

export type ShareResult = 'shared' | 'cancelled' | 'failed';

const PDF_MIME_TYPE = 'application/pdf';

/** Einziger Ort, der `navigator.share` anfasst. */
@Service()
export class Share {
  /** Nur Browser, die Dateien teilen können — Desktop-Firefox und ältere Browser fallen auf „Herunterladen“ zurück. */
  canShareFiles(): boolean {
    if (typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') {
      return false;
    }

    return navigator.canShare({ files: [new File([new Blob()], 'probe.pdf', { type: PDF_MIME_TYPE })] });
  }

  /**
   * Muss direkt im Klick-Handler mit einem fertigen Blob aufgerufen werden: ein `await` davor
   * lässt die Nutzer-Geste verfallen, und der Browser verweigert das Teilen.
   */
  async sharePdf(blob: Blob, fileName: string): Promise<ShareResult> {
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: PDF_MIME_TYPE })], title: fileName });
      return 'shared';
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }

      console.error('Teilen fehlgeschlagen', error);
      return 'failed';
    }
  }
}
