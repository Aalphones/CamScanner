import { computed, Service, signal } from '@angular/core';

import type { FilterSettings } from './filter-settings';
import type { Quad } from './geometry';
import { renderThumbnail } from './page-factory';

export type Rotation = 0 | 90 | 180 | 270;

export interface ScannedPage {
  readonly id: string;
  /** Original-Standbild als JPEG — Grundlage für erneutes Zuschneiden. */
  readonly source: Blob;
  /** In Koordinaten von `source`. */
  readonly corners: Quad;
  /** Begradigt, ungefiltert. */
  readonly warped: Blob;
  readonly filter: FilterSettings;
  /** Begradigt und gefiltert — das geht ins PDF. */
  readonly output: Blob;
  readonly rotation: Rotation;
  /** Object-URL, Drehung eingerechnet; Eigentümer ist der Page Buffer. */
  readonly thumbnailUrl: string;
}

/** Neue Liste, in der das Element von `fromIndex` an `toIndex` steht; ungültiger `fromIndex` = unverändert. */
export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);

  if (moved === undefined) {
    return items;
  }

  result.splice(Math.min(Math.max(toIndex, 0), result.length), 0, moved);
  return result;
}

/** Eine Vierteldrehung im Uhrzeigersinn. */
const NEXT_ROTATION: Record<Rotation, Rotation> = { 0: 90, 90: 180, 180: 270, 270: 0 };

/**
 * Alle Seiten des aktuellen Dokuments, nur im Arbeitsspeicher (ADR-005).
 * Gibt die Vorschau-URLs frei: `replace`, `discard` und `clear` sofort, `remove` nicht — die Seite kann per Rückgängig zurückkommen.
 */
@Service()
export class PageBuffer {
  private readonly pagesSignal = signal<readonly ScannedPage[]>([]);

  readonly pages = this.pagesSignal.asReadonly();
  readonly count = computed((): number => this.pagesSignal().length);

  add(page: ScannedPage): void {
    this.pagesSignal.update((pages: readonly ScannedPage[]) => [...pages, page]);
  }

  replace(id: string, page: ScannedPage): void {
    const old = this.find(id);

    if (old === undefined) {
      return;
    }

    this.pagesSignal.update((pages: readonly ScannedPage[]) => pages.map((current: ScannedPage) => (current.id === id ? page : current)));

    if (old.thumbnailUrl !== page.thumbnailUrl) {
      URL.revokeObjectURL(old.thumbnailUrl);
    }
  }

  remove(id: string): { page: ScannedPage; index: number } | null {
    const pages = this.pagesSignal();
    const index = pages.findIndex((page: ScannedPage) => page.id === id);
    const page = pages[index];

    if (page === undefined) {
      return null;
    }

    this.pagesSignal.set(pages.filter((current: ScannedPage) => current.id !== id));
    return { page, index };
  }

  restore(page: ScannedPage, index: number): void {
    this.pagesSignal.update((pages: readonly ScannedPage[]) => {
      const position = Math.min(Math.max(index, 0), pages.length);
      return [...pages.slice(0, position), page, ...pages.slice(position)];
    });
  }

  discard(page: ScannedPage): void {
    URL.revokeObjectURL(page.thumbnailUrl);
  }

  move(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) {
      return;
    }

    this.pagesSignal.set(moveItem(this.pagesSignal(), fromIndex, toIndex));
  }

  /** Dreht die Seiten um 90° im Uhrzeigersinn und zeichnet ihre Vorschau neu. */
  async rotate(ids: readonly string[]): Promise<void> {
    const targets = this.pagesSignal().filter((page: ScannedPage) => ids.includes(page.id));
    // Nacheinander, nicht parallel: jede Vorschau dekodiert das volle Ergebnisbild.
    for (const page of targets) {
      const rotation = NEXT_ROTATION[page.rotation];
      const thumbnailUrl = await renderThumbnail(page.output, rotation);
      const current = this.find(page.id);

      // Während des Drehens gelöscht oder ersetzt: die neue Vorschau gehört zu keiner Seite mehr.
      if (current !== page) {
        URL.revokeObjectURL(thumbnailUrl);
        continue;
      }

      this.replace(page.id, { ...page, rotation, thumbnailUrl });
    }
  }

  clear(): void {
    this.pagesSignal().forEach((page: ScannedPage) => URL.revokeObjectURL(page.thumbnailUrl));
    this.pagesSignal.set([]);
  }

  private find(id: string): ScannedPage | undefined {
    return this.pagesSignal().find((page: ScannedPage) => page.id === id);
  }
}
