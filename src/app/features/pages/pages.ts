import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { moveItem, PageBuffer, type ScannedPage } from '../../core/page-buffer';
import { ScanSession } from '../../core/scan-session';
import { Toast } from '../../core/toast';
import { Icon } from '../../shared/icon/icon';
import { PageDrag } from './page-drag';

@Component({
  selector: 'cam-pages',
  imports: [Icon],
  templateUrl: './pages.html',
  styleUrl: './pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pages {
  private readonly pageBuffer = inject(PageBuffer);
  private readonly scanSession = inject(ScanSession);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);

  private readonly gridRef = viewChild.required<ElementRef<HTMLDivElement>>('grid');

  protected readonly drag = new PageDrag((fromIndex: number, toIndex: number) => this.pageBuffer.move(fromIndex, toIndex));
  protected readonly isSelecting = signal(false);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly rotating = signal(false);
  protected readonly opening = signal(false);

  protected readonly count = this.pageBuffer.count;

  /** Während des Ziehens schon in der Reihenfolge nach dem Loslassen — die Lücke wandert mit dem Finger. */
  protected readonly displayPages = computed((): readonly ScannedPage[] => {
    const pages = this.pageBuffer.pages();
    const from = this.drag.dragIndex();
    const over = this.drag.overIndex();

    if (from === null || over === null) {
      return pages;
    }

    return moveItem(pages, from, over);
  });

  protected readonly draggedPage = computed((): ScannedPage | null => {
    const from = this.drag.dragIndex();

    if (from === null) {
      return null;
    }

    return this.pageBuffer.pages()[from] ?? null;
  });

  protected readonly title = computed((): string => {
    const count = this.count();
    return count === 1 ? '1 Seite' : `${count} Seiten`;
  });

  protected readonly canRotate = computed((): boolean => {
    if (this.rotating() || this.count() === 0) {
      return false;
    }

    return !this.isSelecting() || this.selectedIds().size > 0;
  });

  protected readonly rotateLabel = computed((): string => (this.isSelecting() ? 'Markierte Seiten drehen' : 'Alle Seiten drehen'));

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const grid = this.gridRef().nativeElement;
      // `touch-action` wirkt nur ab Fingerauflage; beginnt das Ziehen erst nach dem Halten, hält nur ein nicht-passiver touchmove das Scrollen an.
      const blockScrollWhileDragging = (event: TouchEvent): void => {
        if (this.drag.isDragging()) {
          event.preventDefault();
        }
      };

      // Auf dem Dokument statt auf dem Raster: beim Umsortieren verschiebt Angular die Kachel im DOM, das löst eine Pointer-Capture.
      const onPointerMove = (event: PointerEvent): void => this.drag.move(event);
      const onPointerUp = (event: PointerEvent): void => this.drag.end(event);
      const onPointerCancel = (): void => this.drag.cancel();

      grid.addEventListener('touchmove', blockScrollWhileDragging, { passive: false });
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerCancel);
      destroyRef.onDestroy(() => {
        grid.removeEventListener('touchmove', blockScrollWhileDragging);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerCancel);
      });
    });

    destroyRef.onDestroy(() => this.drag.cancel());
  }

  protected onBackClick(): void {
    void this.router.navigate(['/capture']);
  }

  protected onAddClick(): void {
    void this.router.navigate(['/capture']);
  }

  protected onSelectToggle(): void {
    this.drag.cancel();
    this.isSelecting.update((isSelecting: boolean) => !isSelecting);
    this.selectedIds.set(new Set());
  }

  protected onTilePointerDown(event: PointerEvent, index: number): void {
    if (this.isSelecting() || this.opening()) {
      return;
    }

    this.drag.start(event, index, event.currentTarget as HTMLElement);
  }

  protected async onTileClick(page: ScannedPage): Promise<void> {
    if (this.drag.consumeClick() || this.opening()) {
      return;
    }

    if (this.isSelecting()) {
      this.toggleSelection(page.id);
      return;
    }

    this.opening.set(true);

    try {
      await this.scanSession.startEdit(page);
      await this.router.navigate(['/crop']);
    } catch (error: unknown) {
      console.error('Seite öffnen fehlgeschlagen', error);
      this.toast.show('Seite konnte nicht geöffnet werden');
    } finally {
      this.opening.set(false);
    }
  }

  protected onDeleteClick(page: ScannedPage): void {
    const removed = this.pageBuffer.remove(page.id);

    if (removed === null) {
      return;
    }

    this.toast.show('Seite gelöscht', {
      actionLabel: 'Rückgängig',
      action: () => this.pageBuffer.restore(removed.page, removed.index),
      onExpire: () => this.pageBuffer.discard(removed.page),
    });
  }

  protected async onRotateClick(): Promise<void> {
    if (!this.canRotate()) {
      return;
    }

    const ids = this.isSelecting()
      ? [...this.selectedIds()]
      : this.pageBuffer.pages().map((page: ScannedPage) => page.id);

    this.rotating.set(true);

    try {
      await this.pageBuffer.rotate(ids);
    } catch (error: unknown) {
      console.error('Drehen fehlgeschlagen', error);
      this.toast.show('Drehen fehlgeschlagen');
    } finally {
      this.rotating.set(false);
    }
  }

  protected onExportClick(): void {
    void this.router.navigate(['/export']);
  }

  protected isSelected(page: ScannedPage): boolean {
    return this.selectedIds().has(page.id);
  }

  private toggleSelection(id: string): void {
    this.selectedIds.update((selected: ReadonlySet<string>) => {
      const next = new Set(selected);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }
}
