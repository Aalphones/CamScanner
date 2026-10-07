import { computed, signal } from '@angular/core';

import type { Point } from '../../core/geometry';

/** So lange muss der Finger ruhig liegen, bis das Ziehen beginnt. */
const HOLD_MS = 300;
/** Mehr Bewegung während des Haltens heißt: der User will scrollen. */
const MOVE_TOLERANCE_PX = 8;

interface Press {
  readonly pointerId: number;
  readonly index: number;
  readonly start: Point;
  /** Abstand des Zeigers zur linken oberen Ecke der Kachel — die schwebende Kachel bleibt so unter dem Finger, wo sie gepackt wurde. */
  readonly grabOffset: Point;
  readonly tileWidth: number;
}

/**
 * Umsortieren per Halten und Ziehen. Kurzes Antippen bleibt ein normaler Klick;
 * nach einem Ziehen schluckt `consumeClick()` den Klick, den der Browser beim Loslassen noch schickt.
 */
export class PageDrag {
  private readonly onDrop: (fromIndex: number, toIndex: number) => void;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private press: Press | null = null;
  private isClickSuppressed = false;

  readonly dragIndex = signal<number | null>(null);
  readonly overIndex = signal<number | null>(null);
  /** Linke obere Ecke der schwebenden Kachel in Viewport-Koordinaten. */
  readonly pointer = signal<Point | null>(null);
  readonly tileWidth = signal(0);
  readonly isDragging = computed((): boolean => this.dragIndex() !== null);

  constructor(onDrop: (fromIndex: number, toIndex: number) => void) {
    this.onDrop = onDrop;
  }

  start(event: PointerEvent, index: number, tile: HTMLElement): void {
    if (this.press !== null || !event.isPrimary || event.button !== 0) {
      return;
    }

    const rect = tile.getBoundingClientRect();

    // Nach langem Drücken schickt Android oft gar keinen Klick — ein liegengebliebenes Flag darf dieses Antippen nicht schlucken.
    this.isClickSuppressed = false;
    this.press = {
      pointerId: event.pointerId,
      index,
      start: { x: event.clientX, y: event.clientY },
      grabOffset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      tileWidth: rect.width,
    };
    this.pressTimer = setTimeout(() => this.beginDrag(), HOLD_MS);
  }

  move(event: PointerEvent): void {
    const press = this.press;

    if (press === null || event.pointerId !== press.pointerId) {
      return;
    }

    if (!this.isDragging()) {
      if (Math.hypot(event.clientX - press.start.x, event.clientY - press.start.y) > MOVE_TOLERANCE_PX) {
        this.cancel();
      }

      return;
    }

    this.pointer.set({ x: event.clientX - press.grabOffset.x, y: event.clientY - press.grabOffset.y });
    const target = this.indexAt(event.clientX, event.clientY);

    if (target !== null) {
      this.overIndex.set(target);
    }
  }

  end(event: PointerEvent): void {
    if (this.press === null || event.pointerId !== this.press.pointerId) {
      return;
    }

    const from = this.dragIndex();
    const to = this.overIndex();

    this.cancel();

    if (from !== null && to !== null) {
      this.isClickSuppressed = true;
      this.onDrop(from, to);
    }
  }

  cancel(): void {
    if (this.pressTimer !== null) {
      clearTimeout(this.pressTimer);
    }

    this.pressTimer = null;
    this.press = null;
    this.dragIndex.set(null);
    this.overIndex.set(null);
    this.pointer.set(null);
  }

  /** `true`, wenn der Klick zum gerade beendeten Ziehen gehört und ignoriert werden muss. */
  consumeClick(): boolean {
    const isSuppressed = this.isClickSuppressed;

    this.isClickSuppressed = false;
    return isSuppressed;
  }

  private beginDrag(): void {
    const press = this.press;

    this.pressTimer = null;

    if (press === null) {
      return;
    }

    this.tileWidth.set(press.tileWidth);
    this.pointer.set({ x: press.start.x - press.grabOffset.x, y: press.start.y - press.grabOffset.y });
    this.dragIndex.set(press.index);
    this.overIndex.set(press.index);
  }

  /** Die schwebende Kachel hat `pointer-events: none`, `elementFromPoint` trifft also die Kachel darunter. */
  private indexAt(x: number, y: number): number | null {
    const tile = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-index]');
    const index = Number(tile?.dataset['index']);

    if (tile === null || tile === undefined || Number.isNaN(index)) {
      return null;
    }

    return index;
  }
}
