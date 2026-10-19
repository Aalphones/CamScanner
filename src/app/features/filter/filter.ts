import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { DEFAULT_FILTER_SETTINGS, type FilterId, type FilterSettings } from '../../core/filter-settings';
import { ImageFilters } from '../../core/image-filters';
import { DocShadow } from '../../core/ml/doc-shadow';
import { PageBuffer, type ScannedPage } from '../../core/page-buffer';
import { createPage } from '../../core/page-factory';
import { ScanSession } from '../../core/scan-session';
import { Toast } from '../../core/toast';
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

/** Modell (62 MB) plus komprimierte ORT-Laufzeit (7 MB), gerundet. */
const SHADOW_DOWNLOAD_MB = 70;
const SHADOW_LOAD_FAILED_MESSAGE = 'KI-Modell konnte nicht geladen werden — Internet nötig beim ersten Mal';
const SHADOW_RUN_FAILED_MESSAGE = 'Schattenentfernung hat auf diesem Gerät nicht geklappt — ausgeschaltet';

/** Lange Kante der gespeicherten Seite — rund 250 dpi auf A4, spart dem Handy Speicher und Zeit (ADR-008). */
const SAVE_MAX_EDGE = 3000;

/** Obergrenze fürs Speichern ab geladenem Modell (ADR-008). */
const SAVE_TIMEOUT_MS = 60_000;

type SaveStep = 'model' | 'shadow' | 'filter' | 'store';
type SaveError = 'timeout' | 'shadow' | 'failed';

interface SaveProgress {
  readonly label: string;
  readonly fraction: number;
}

const SAVE_STEP_LABELS: Record<Exclude<SaveStep, 'model'>, string> = {
  shadow: 'Schatten berechnen',
  filter: 'Filter anwenden',
  store: 'Seite sichern',
};

const SAVE_ERROR_MESSAGES: Record<SaveError, string> = {
  timeout: 'Speichern hat zu lange gedauert.',
  shadow: 'Schattenentfernung hat auf diesem Gerät nicht geklappt.',
  failed: 'Seite konnte nicht gespeichert werden.',
};

class SaveTimeoutError extends Error {
  constructor() {
    super('Speichern hat nicht rechtzeitig geantwortet.');
    this.name = 'SaveTimeoutError';
  }
}

// OpenCV und WASM blockieren den Hauptthread — erst malen lassen, dann rechnen.
function nextPaint(): Promise<void> {
  return new Promise((resolve: () => void) => requestAnimationFrame(() => setTimeout(resolve)));
}

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
  private readonly docShadow = inject(DocShadow);
  private readonly toast = inject(Toast);

  protected readonly chips = CHIPS;
  protected readonly sliders = SLIDERS;
  protected readonly settings = this.scanSession.filter;
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly chipUrls = signal<Partial<Record<FilterId, string>>>({});
  protected readonly isSaving = signal(false);
  protected readonly hasFailed = signal(false);
  protected readonly saveStep = signal<SaveStep | null>(null);
  protected readonly saveError = signal<SaveError | null>(null);
  protected readonly saveErrorMessages = SAVE_ERROR_MESSAGES;

  protected readonly saveProgress = computed((): SaveProgress | null => {
    const step = this.saveStep();

    if (step === null) {
      return null;
    }

    if (step === 'model') {
      const fraction = this.docShadow.loadProgress();

      return { label: `KI-Modell lädt … ${Math.round(fraction * 100)} %`, fraction };
    }

    const steps: readonly Exclude<SaveStep, 'model'>[] = this.settings().removeShadow ? ['shadow', 'filter', 'store'] : ['filter', 'store'];
    const index = steps.indexOf(step);

    return { label: `Schritt ${index + 1} von ${steps.length} · ${SAVE_STEP_LABELS[step]}`, fraction: (index + 1) / steps.length };
  });

  protected readonly description = computed((): string => FILTER_LABELS[this.settings().filter].description);

  protected readonly shadowHint = computed((): string => {
    switch (this.docShadow.loadState()) {
      case 'idle':
        return `Lädt KI-Modell · einmalig ca. ${SHADOW_DOWNLOAD_MB} MB`;
      case 'loading':
        return `Lädt … ${Math.round(this.docShadow.loadProgress() * 100)} %`;
      case 'ready':
        return 'KI-Modell ist geladen';
    }
  });

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

  /** Beim ersten Einschalten lädt das Modell; scheitert das, springt der Schalter zurück. */
  protected async onShadowToggle(): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    const removeShadow = !this.settings().removeShadow;

    this.scanSession.setFilter({ ...this.settings(), removeShadow });

    if (removeShadow) {
      try {
        await this.docShadow.load();
      } catch (error: unknown) {
        console.error('KI-Modell laden fehlgeschlagen', error);

        if (this.isDestroyed) {
          return;
        }

        this.scanSession.setFilter({ ...this.settings(), removeShadow: false });
        this.toast.show(SHADOW_LOAD_FAILED_MESSAGE);
      }
    }

    if (!this.isDestroyed) {
      this.schedulePreview(0);
    }
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
    this.saveError.set(null);

    try {
      const filter = this.settings();
      const editedPage = this.findEditedPage();
      let deadline = Date.now() + SAVE_TIMEOUT_MS;

      if (filter.removeShadow) {
        try {
          await this.setStep('model');
          await this.docShadow.load();
          // Der Download zählt nicht zur Zeitgrenze.
          deadline = Date.now() + SAVE_TIMEOUT_MS;
          await this.setStep('shadow');
          await this.withDeadline(this.docShadow.gainMap(warped), deadline);
        } catch (error: unknown) {
          console.error('Schatten berechnen fehlgeschlagen', error);
          this.docShadow.discardGainMap(warped);
          this.saveError.set(error instanceof SaveTimeoutError ? 'timeout' : 'shadow');
          return;
        }
      }

      await this.setStep('filter');
      // Die Verstärkungskarte kommt aus dem Cache.
      const output = await this.withDeadline(this.imageFilters.renderFiltered(warped, filter, SAVE_MAX_EDGE), deadline);

      await this.setStep('store');
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

      const isTimeout = error instanceof SaveTimeoutError;

      if (isTimeout && this.settings().removeShadow) {
        this.docShadow.discardGainMap(warped);
      }

      this.saveError.set(isTimeout ? 'timeout' : 'failed');
    } finally {
      this.isSaving.set(false);
      this.saveStep.set(null);
    }
  }

  protected async onSaveWithoutShadow(): Promise<void> {
    this.scanSession.setFilter({ ...this.settings(), removeShadow: false });
    this.schedulePreview(0);
    await this.onDoneClick();
  }

  private setStep(step: SaveStep): Promise<void> {
    this.saveStep.set(step);

    return nextPaint();
  }

  private async withDeadline<T>(work: Promise<T>, deadline: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<never>((_resolve: unknown, reject: (reason: unknown) => void) => {
      timer = setTimeout(() => reject(new SaveTimeoutError()), Math.max(0, deadline - Date.now()));
    });

    try {
      return await Promise.race([work, expiry]);
    } finally {
      clearTimeout(timer);
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

      if (this.settings().removeShadow) {
        this.scanSession.setFilter({ ...this.settings(), removeShadow: false });
        this.toast.show(SHADOW_RUN_FAILED_MESSAGE);
        // Die Schleife in refreshPreview rechnet dann ohne Schatten neu.
        this.isPreviewStale = true;
        return;
      }

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
