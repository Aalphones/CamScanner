import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { DEFAULT_FILTER_SETTINGS, type FilterId, type FilterSettings } from '../../core/filter-settings';
import { ImageFilters } from '../../core/image-filters';
import { PageBuffer, type ScannedPage } from '../../core/page-buffer';
import { createPage } from '../../core/page-factory';
import { ScanSession } from '../../core/scan-session';
import { Icon } from '../../shared/icon/icon';

interface FilterLabel {
  readonly name: string;
  readonly description: string;
}

/** Reihenfolge der Chips von links nach rechts. */
const FILTER_ORDER: readonly FilterId[] = ['original', 'auto', 'scan', 'bw', 'gray'];

const FILTER_LABELS: Record<FilterId, FilterLabel> = {
  original: { name: 'Original', description: 'Unverändert, nur begradigt' },
  auto: { name: 'Auto', description: 'Farben bleiben, Schatten und Kontrast werden ausgeglichen' },
  scan: { name: 'Scan', description: 'Graustufen mit kräftigem Kontrast, wie ein Scanner' },
  bw: { name: 'S/W', description: 'Reines Schwarz-Weiß, kleinste Datei' },
  gray: { name: 'Grau', description: 'Graustufen, sonst unverändert' },
};

type SliderKey = 'contrast' | 'brightness';

interface SliderOption {
  readonly key: SliderKey;
  readonly label: string;
}

const SLIDERS: readonly SliderOption[] = [
  { key: 'contrast', label: 'Kontrast' },
  { key: 'brightness', label: 'Helligkeit' },
];

interface FilterChip {
  readonly id: FilterId;
  readonly name: string;
}

const CHIPS: readonly FilterChip[] = FILTER_ORDER.map((id: FilterId) => ({ id, name: FILTER_LABELS[id].name }));

/** Lange Kante der großen Vorschau und der Chip-Bilder in Pixeln. */
const PREVIEW_EDGE = 1200;
const CHIP_EDGE = 160;

/** Regler feuern bei jedem Pixel Fingerweg — gerechnet wird erst, wenn der Finger kurz ruht. */
const SLIDER_DEBOUNCE_MS = 150;
const SLIDER_NEUTRAL = DEFAULT_FILTER_SETTINGS.contrast;

@Component({
  selector: 'cam-filter',
  imports: [Icon],
  templateUrl: './filter.html',
  styleUrl: './filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Filter implements OnInit, OnDestroy {
  private readonly scanSession = inject(ScanSession);
  private readonly imageFilters = inject(ImageFilters);
  private readonly pageBuffer = inject(PageBuffer);
  private readonly router = inject(Router);

  protected readonly chips = CHIPS;
  protected readonly sliders = SLIDERS;
  protected readonly settings = this.scanSession.filter;
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly chipUrls = signal<Partial<Record<FilterId, string>>>({});
  protected readonly isSaving = signal(false);
  protected readonly hasFailed = signal(false);

  protected readonly description = computed((): string => FILTER_LABELS[this.settings().filter].description);

  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private isPreviewRunning = false;
  /** Während einer laufenden Rechnung kam eine neue Einstellung — das laufende Ergebnis ist veraltet. */
  private isPreviewStale = false;
  private isDestroyed = false;

  ngOnInit(): void {
    void this.renderInitialImages();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    clearTimeout(this.previewTimer);

    const previewUrl = this.previewUrl();

    if (previewUrl !== null) {
      URL.revokeObjectURL(previewUrl);
    }

    for (const url of Object.values(this.chipUrls())) {
      URL.revokeObjectURL(url);
    }
  }

  /** Der Entwurf bleibt stehen: Zuschneiden zeigt die Ecken des Users unverändert. */
  protected onBackClick(): void {
    void this.router.navigate(['/crop']);
  }

  protected onFilterSelect(filter: FilterId): void {
    if (this.isSaving() || filter === this.settings().filter) {
      return;
    }

    this.scanSession.setFilter({ ...this.settings(), filter });
    this.schedulePreview(0);
  }

  protected onSliderInput(key: SliderKey, event: Event): void {
    if (this.isSaving()) {
      return;
    }

    this.setSlider(key, Number((event.target as HTMLInputElement).value));
  }

  protected onSliderReset(key: SliderKey): void {
    if (this.isSaving()) {
      return;
    }

    this.setSlider(key, SLIDER_NEUTRAL);
  }

  protected async onDoneClick(): Promise<void> {
    const frame = this.scanSession.sourceFrame();
    const corners = this.scanSession.corners();
    const warped = this.scanSession.warpedPage();

    if (this.isSaving() || frame === null || corners === null || warped === null) {
      return;
    }

    clearTimeout(this.previewTimer);
    this.isSaving.set(true);
    this.hasFailed.set(false);

    try {
      const filter = this.settings();
      const editedPage = this.findEditedPage();
      const output = await this.imageFilters.renderFiltered(warped, filter);
      const page = await createPage({
        sourceFrame: frame,
        corners,
        warped,
        filter,
        output,
        ...(editedPage === undefined ? {} : { id: editedPage.id, rotation: editedPage.rotation, source: editedPage.source }),
      });

      if (editedPage === undefined) {
        this.pageBuffer.add(page);
      } else {
        this.pageBuffer.replace(editedPage.id, page);
      }

      this.scanSession.reset();

      if (editedPage === undefined) {
        await this.router.navigate(['/capture']);
      } else {
        await this.router.navigate(['/pages']);
      }
    } catch (error: unknown) {
      console.error('Seite speichern fehlgeschlagen', error);
      this.hasFailed.set(true);
    } finally {
      this.isSaving.set(false);
    }
  }

  private setSlider(key: SliderKey, value: number): void {
    const settings: FilterSettings = { ...this.settings(), [key]: value };

    this.scanSession.setFilter(settings);
    this.schedulePreview(SLIDER_DEBOUNCE_MS);
  }

  private schedulePreview(delayMs: number): void {
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => void this.refreshPreview(), delayMs);
  }

  /** Erst die große Vorschau, dann die Chip-Bilder — der User sieht sofort sein Ergebnis. */
  private async renderInitialImages(): Promise<void> {
    await this.refreshPreview();
    await this.renderChips();
  }

  /** OpenCV ist einfädig: laufende Rechnungen stapeln sich nicht, nach dem Lauf zählt nur der letzte Stand. */
  private async refreshPreview(): Promise<void> {
    if (this.isPreviewRunning) {
      this.isPreviewStale = true;
      return;
    }

    this.isPreviewRunning = true;

    try {
      do {
        this.isPreviewStale = false;
        await this.renderPreview();
      } while (this.isPreviewStale && !this.isDestroyed);
    } finally {
      this.isPreviewRunning = false;
    }
  }

  private async renderPreview(): Promise<void> {
    const warped = this.scanSession.warpedPage();

    if (warped === null) {
      return;
    }

    try {
      const blob = await this.imageFilters.renderFiltered(warped, this.settings(), PREVIEW_EDGE);

      if (this.isDestroyed || this.isPreviewStale) {
        return;
      }

      const previousUrl = this.previewUrl();
      this.previewUrl.set(URL.createObjectURL(blob));
      this.hasFailed.set(false);

      if (previousUrl !== null) {
        URL.revokeObjectURL(previousUrl);
      }
    } catch (error: unknown) {
      console.error('Vorschau fehlgeschlagen', error);
      this.hasFailed.set(true);
    }
  }

  /** Einmal je Filter mit den Reglern vom Einstieg, nacheinander wegen des einfädigen OpenCV. */
  private async renderChips(): Promise<void> {
    const warped = this.scanSession.warpedPage();

    if (warped === null) {
      return;
    }

    const entrySettings = this.settings();

    for (const filter of FILTER_ORDER) {
      try {
        const blob = await this.imageFilters.renderFiltered(warped, { ...entrySettings, filter }, CHIP_EDGE);

        if (this.isDestroyed) {
          return;
        }

        this.chipUrls.update((urls: Partial<Record<FilterId, string>>) => ({ ...urls, [filter]: URL.createObjectURL(blob) }));
      } catch (error: unknown) {
        console.error('Chip-Bild fehlgeschlagen', error);
      }
    }
  }

  private findEditedPage(): ScannedPage | undefined {
    const id = this.scanSession.editingPageId();

    if (id === null) {
      return undefined;
    }

    return this.pageBuffer.pages().find((page: ScannedPage) => page.id === id);
  }
}
