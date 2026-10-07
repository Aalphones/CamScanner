const FORBIDDEN_FILE_NAME_CHARACTERS = /[\\/:*?"<>|]/g;
const PDF_EXTENSION = /\.pdf$/i;

/** Lässt den Browser die Datei speichern; der Download-Ordner ist Sache des Geräts. */
export function downloadBlob(blob: Blob, fileName: string, targetDocument: Document = document): void {
  const url = URL.createObjectURL(blob);
  const link = targetDocument.createElement('a');

  link.href = url;
  link.download = fileName;
  targetDocument.body.append(link);
  link.click();
  link.remove();

  // Erst im nächsten Tick freigeben — manche Browser lesen die URL erst nach dem Klick-Handler.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function sanitizePdfFileName(input: string, fallback: string): string {
  const cleaned = input.trim().replace(FORBIDDEN_FILE_NAME_CHARACTERS, '_');

  if (cleaned.replace(PDF_EXTENSION, '').trim() === '') {
    return fallback;
  }

  if (PDF_EXTENSION.test(cleaned)) {
    return cleaned;
  }

  return `${cleaned}.pdf`;
}
