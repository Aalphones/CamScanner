import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';

import { downloadBlob, sanitizePdfFileName } from '../../core/file-save';
import { PageBuffer, type ScannedPage } from '../../core/page-buffer';
import { Pdf, type ExportQuality, type PdfPageInput } from '../../core/pdf';
import { ScanSession } from '../../core/scan-session';
import { Toast } from '../../core/toast';
import { Icon } from '../../shared/icon/icon';

interface QualityOption {
  readonly id: ExportQuality;
  readonly label: string;
}

const QUALITY_OPTIONS: readonly QualityOption[] = [
  { id: 'small', label: 'Klein' },
  { id: 'medium', label: 'Mittel' },
  { id: 'original', label: 'Original' },
];

/** Mehr Lagen zeigt der Seitenstapel nicht — Seite 1 liegt oben. */
const STACK_DEPTH = 3;
const BYTES_PER_MEGABYTE = 1_048_576;

const sizeFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

@Component({
  selector: 'cam-export',
  imports: [Icon],
  templateUrl: './export.html',
  styleUrl: './export.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Export implements OnDestroy {
  private readonly scanSession = inject(ScanSession);
  private readonly pageBuffer = inject(PageBuffer);
  private readonly pdfBuilder = inject(Pdf);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);

  protected readonly qualityOptions = QUALITY_OPTIONS;
  protected readonly fileName = signal(this.defaultFileName());
  protected readonly quality = signal<ExportQuality>('medium');
  protected readonly pdf = signal<Blob | null>(null);
  protected readonly building = signal(false);
  protected readonly buildFailed = signal(false);
  protected readonly isQualityInfoOpen = signal(false);

  /** Stand beim Öffnen — die Seiten ändern sich auf diesem Bildschirm nicht. */
  private readonly pages: readonly ScannedPage[] = this.pageBuffer.pages();
  private readonly pageInputs: readonly PdfPageInput[] = this.pages.map((page: ScannedPage) => ({
    image: page.output,
    rotation: page.rotation,
  }));

  /** Ein Bau, dessen Ergebnis nicht mehr zur gewählten Qualität passt, wird verworfen. */
  private buildToken = 0;

  /** Vorschaubilder, von unten nach oben gestapelt: die dritte Seite zuerst, die erste zuletzt. Die URLs gehören dem Page Buffer. */
  protected readonly previewUrls: readonly string[] = this.pages
    .slice(0, STACK_DEPTH)
    .map((page: ScannedPage) => page.thumbnailUrl)
    .reverse();

  protected readonly metaText = computed((): string => {
    const count = this.pageInputs.length;
    const pageLabel = count === 1 ? '1 Seite' : `${count} Seiten`;
    const pdf = this.pdf();

    if (this.building() || pdf === null) {
      return `${pageLabel} · wird berechnet … · A4`;
    }

    return `${pageLabel} · ca. ${sizeFormat.format(pdf.size / BYTES_PER_MEGABYTE)} MB · A4`;
  });

  protected readonly canDownload = computed((): boolean => !this.building() && this.pdf() !== null);

  constructor() {
    effect(() => {
      void this.rebuild(this.quality());
    });
  }

  ngOnDestroy(): void {
    this.buildToken += 1;
  }

  protected onBackClick(): void {
    void this.router.navigate(['/pages']);
  }

  protected onFileNameInput(event: Event): void {
    this.fileName.set((event.target as HTMLInputElement).value);
  }

  protected onQualitySelect(quality: ExportQuality): void {
    this.quality.set(quality);
  }

  protected onQualityKeydown(event: KeyboardEvent): void {
    const step = this.arrowStep(event.key);

    if (step === 0) {
      return;
    }

    event.preventDefault();
    const currentIndex = QUALITY_OPTIONS.findIndex((option: QualityOption) => option.id === this.quality());
    const next = QUALITY_OPTIONS[(currentIndex + step + QUALITY_OPTIONS.length) % QUALITY_OPTIONS.length];

    if (next !== undefined) {
      this.quality.set(next.id);
      (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>(`[data-quality="${next.id}"]`)?.focus();
    }
  }

  protected onQualityInfoClick(): void {
    this.isQualityInfoOpen.update((isOpen: boolean) => !isOpen);
  }

  protected onDownloadClick(): void {
    const pdf = this.pdf();

    if (pdf === null || !this.canDownload()) {
      return;
    }

    downloadBlob(pdf, sanitizePdfFileName(this.fileName(), this.defaultFileName()));
    this.toast.show('PDF gespeichert', { actionLabel: 'Neues Dokument', action: () => this.startNewDocument() });
  }

  private startNewDocument(): void {
    this.pageBuffer.clear();
    this.scanSession.reset();
    void this.router.navigate(['/capture']);
  }

  private async rebuild(quality: ExportQuality): Promise<void> {
    this.buildToken += 1;
    const token = this.buildToken;

    this.building.set(true);
    this.buildFailed.set(false);

    try {
      const pdf = await this.pdfBuilder.buildPdf(this.pageInputs, quality);

      if (token === this.buildToken) {
        this.pdf.set(pdf);
      }
    } catch (error: unknown) {
      console.error('PDF erstellen fehlgeschlagen', error);

      if (token === this.buildToken) {
        this.pdf.set(null);
        this.buildFailed.set(true);
      }
    } finally {
      if (token === this.buildToken) {
        this.building.set(false);
      }
    }
  }

  private arrowStep(key: string): number {
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      return 1;
    }

    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      return -1;
    }

    return 0;
  }

  /** `Scan_YYYY-MM-DD.pdf` mit dem lokalen Datum, nicht dem UTC-Datum. */
  private defaultFileName(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `Scan_${now.getFullYear()}-${month}-${day}.pdf`;
  }
}
