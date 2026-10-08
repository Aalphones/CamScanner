import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { DocumentDetection } from '../../core/document-detection';
import { clampPoint, edgeMidpoints, fitContain, insetQuad, isConvexQuad, type Point, type Quad, type Size } from '../../core/geometry';
import { ImageFilters } from '../../core/image-filters';
import { PageBuffer, type ScannedPage } from '../../core/page-buffer';
import { createPage } from '../../core/page-factory';
import { Perspective } from '../../core/perspective';
import { ScanSession } from '../../core/scan-session';
import { Icon } from '../../shared/icon/icon';

/** Randabstand des Startvierecks, wenn die Erkennung nichts findet. */
const FALLBACK_INSET_RATIO = 0.1;

/** Innenmaß der Lupe: 84 px Kreis minus 2 × 3 px Rand (border-box). */
const LOUPE_INNER_SIZE = 78;
const LOUPE_ZOOM = 2;

/** Liegt der gezogene Punkt in diesem Feld oben links, verdeckt ihn die Lupe — dann wechselt sie nach rechts. */
const LOUPE_AVOID_SIZE = 130;

type HandleKind = 'corner' | 'edge';

interface DragState {
  readonly kind: HandleKind;
  /** Ecke 0–3 bzw. Kante 0–3 (Kante i = Ecke i → Ecke (i + 1) % 4). */
  readonly index: number;
  readonly pointerId: number;
  /** Letzte Zeigerposition in Bild-Koordinaten. */
  readonly last: Point;
}

interface CropHint {
  readonly text: string;
  readonly isDanger: boolean;
}

const STAGE_FILL = '#0f1215';

@Component({
  selector: 'cam-crop',
  imports: [Icon],
  templateUrl: './crop.html',
  styleUrl: './crop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Crop implements OnInit {
  private readonly scanSession = inject(ScanSession);
  private readonly documentDetection = inject(DocumentDetection);
  private readonly perspective = inject(Perspective);
  private readonly imageFilters = inject(ImageFilters);
  private readonly pageBuffer = inject(PageBuffer);
  private readonly router = inject(Router);

  private readonly stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly imageCanvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('imageCanvas');
  private readonly loupeCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('loupeCanvas');

  protected readonly stageSize = signal<Size>({ width: 0, height: 0 });
  protected readonly dragging = signal<DragState | null>(null);
  protected readonly detecting = signal(false);
  protected readonly warping = signal(false);
  protected readonly warpFailed = signal(false);
  /** Beim Bearbeiten läuft die Erkennung erst auf „Auto“ — bis dahin ist „nichts erkannt“ kein Befund. */
  private readonly detectionAttempted = signal(false);

  private readonly sourceFrame = this.scanSession.sourceFrame;
  protected readonly detectedCorners = this.scanSession.detectedCorners;
  protected readonly isEditing = computed((): boolean => this.scanSession.editingPageId() !== null);

  private readonly isNothingDetected = computed((): boolean => {
    if (this.detectedCorners() !== null) {
      return false;
    }

    return !this.isEditing() || this.detectionAttempted();
  });

  private readonly imageSize = computed((): Size => {
    const frame = this.sourceFrame();

    if (frame === null) {
      return { width: 0, height: 0 };
    }

    return { width: frame.width, height: frame.height };
  });

  protected readonly view = computed(() => fitContain(this.imageSize(), this.stageSize()));

  /** Die Ecken in Bühnen-Koordinaten (CSS-Pixel) — alles, was das SVG zeichnet, kommt von hier. */
  protected readonly displayCorners = computed((): Quad | null => {
    const corners = this.scanSession.corners();

    if (corners === null) {
      return null;
    }

    const [topLeft, topRight, bottomRight, bottomLeft] = corners;
    return [this.toDisplay(topLeft), this.toDisplay(topRight), this.toDisplay(bottomRight), this.toDisplay(bottomLeft)];
  });

  protected readonly displayMidpoints = computed((): readonly Point[] => {
    const corners = this.displayCorners();

    if (corners === null) {
      return [];
    }

    return edgeMidpoints(corners);
  });

  protected readonly polygonPoints = computed((): string => {
    const corners = this.displayCorners();

    if (corners === null) {
      return '';
    }

    return corners.map((point: Point) => `${point.x},${point.y}`).join(' ');
  });

  /** Bühnen-Rechteck plus Viereck mit `evenodd`: abgedunkelt wird nur, was außerhalb des Vierecks liegt. */
  protected readonly shadePath = computed((): string => {
    const { width, height } = this.stageSize();
    const corners = this.displayCorners();
    const stageRect = `M0 0H${width}V${height}H0Z`;

    if (corners === null) {
      return stageRect;
    }

    const quadPath = corners.map((point: Point, index: number) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
    return `${stageRect} ${quadPath}Z`;
  });

  private readonly isCrossed = computed((): boolean => {
    const corners = this.scanSession.corners();
    return corners !== null && !isConvexQuad(corners);
  });

  protected readonly canApply = computed((): boolean => {
    return this.scanSession.corners() !== null && !this.isCrossed() && !this.detecting() && !this.warping();
  });

  protected readonly canAuto = computed((): boolean => !this.isNothingDetected() && !this.detecting() && !this.warping());

  protected readonly autoTitle = computed((): string | null => {
    if (this.detecting() || !this.isNothingDetected()) {
      return null;
    }

    return 'Keine Blattkanten erkannt';
  });

  protected readonly hint = computed((): CropHint => {
    if (this.detecting()) {
      return { text: 'Suche Blattkanten …', isDanger: false };
    }

    if (this.isCrossed()) {
      return { text: 'Ecken überkreuzen sich — bitte entwirren', isDanger: true };
    }

    if (this.warpFailed()) {
      return { text: 'Begradigen fehlgeschlagen — bitte nochmal versuchen', isDanger: true };
    }

    if (this.isNothingDetected()) {
      return { text: 'Keine Blattkanten erkannt — Ecken bitte von Hand setzen', isDanger: false };
    }

    return { text: 'Ecken ziehen · Lupe zeigt den Rand genau', isDanger: false };
  });

  /** Der Punkt unter der Lupe: die gezogene Ecke bzw. die Mitte der gezogenen Kante, in Bühnen-Koordinaten. */
  private readonly loupeTarget = computed((): Point | null => {
    const drag = this.dragging();
    const corners = this.displayCorners();

    if (drag === null || corners === null) {
      return null;
    }

    const points = drag.kind === 'corner' ? corners : edgeMidpoints(corners);
    return points[drag.index] ?? null;
  });

  protected readonly isLoupeRight = computed((): boolean => {
    const target = this.loupeTarget();
    return target !== null && target.x < LOUPE_AVOID_SIZE && target.y < LOUPE_AVOID_SIZE;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const observer = new ResizeObserver((entries: readonly ResizeObserverEntry[]) => {
        const rect = entries[0]?.contentRect;

        if (rect !== undefined) {
          this.stageSize.set({ width: rect.width, height: rect.height });
        }
      });

      observer.observe(this.stageRef().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });

    afterRenderEffect(() => this.drawImage());
    afterRenderEffect(() => this.drawLoupe());
  }

  ngOnInit(): void {
    void this.detectCorners();
  }

  /** Neue Seite: verwerfen und neu aufnehmen. Bearbeiten: ohne Änderung zurück in die Übersicht. */
  protected onBackClick(): void {
    const target = this.isEditing() ? '/pages' : '/capture';

    this.scanSession.reset();
    void this.router.navigate([target]);
  }

  protected async onAutoClick(): Promise<void> {
    const frame = this.sourceFrame();

    if (frame === null || !this.canAuto()) {
      return;
    }

    const detected = this.detectedCorners() ?? (await this.runDetection(frame));

    if (detected === null || this.sourceFrame() !== frame) {
      return;
    }

    this.scanSession.setCorners(detected);
    this.warpFailed.set(false);
  }

  protected async onApplyClick(): Promise<void> {
    const frame = this.sourceFrame();
    const corners = this.scanSession.corners();

    if (!this.canApply() || frame === null || corners === null) {
      return;
    }

    this.warping.set(true);
    this.warpFailed.set(false);

    try {
      const editedPage = this.findEditedPage();
      const warped = await this.perspective.warp(frame, corners);
      const filter = this.scanSession.filter();
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
      await this.router.navigate([editedPage === undefined ? '/capture' : '/pages']);
    } catch (error: unknown) {
      console.error('Begradigen fehlgeschlagen', error);
      this.warpFailed.set(true);
    } finally {
      this.warping.set(false);
    }
  }

  protected onHandlePointerDown(event: PointerEvent, kind: HandleKind, index: number): void {
    if (this.dragging() !== null || this.warping()) {
      return;
    }

    event.preventDefault();
    // Capture auf dem SVG, nicht auf dem Griff: so kommen die Move-Events auch an, wenn der Finger den kleinen Kreis verlässt.
    (event.currentTarget as SVGElement).ownerSVGElement?.setPointerCapture(event.pointerId);
    this.dragging.set({ kind, index, pointerId: event.pointerId, last: this.pointerToImage(event) });
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.dragging();
    const corners = this.scanSession.corners();

    if (drag === null || corners === null || event.pointerId !== drag.pointerId) {
      return;
    }

    const pointer = this.pointerToImage(event);
    const delta: Point = { x: pointer.x - drag.last.x, y: pointer.y - drag.last.y };
    const movedIndices = drag.kind === 'corner' ? [drag.index] : [drag.index, (drag.index + 1) % 4];
    const size = this.imageSize();

    const movePoint = (corner: Point, index: number): Point => {
      if (!movedIndices.includes(index)) {
        return corner;
      }

      return clampPoint({ x: corner.x + delta.x, y: corner.y + delta.y }, size);
    };
    const [topLeft, topRight, bottomRight, bottomLeft] = corners;

    this.scanSession.setCorners([movePoint(topLeft, 0), movePoint(topRight, 1), movePoint(bottomRight, 2), movePoint(bottomLeft, 3)]);
    this.warpFailed.set(false);
    this.dragging.set({ ...drag, last: pointer });
  }

  protected onPointerEnd(event: PointerEvent): void {
    if (this.dragging()?.pointerId === event.pointerId) {
      this.dragging.set(null);
    }
  }

  private async detectCorners(): Promise<void> {
    const frame = this.sourceFrame();

    // Bereits zugeschnitten (zurück aus dem nächsten Schritt oder Bearbeiten einer Seite): die Ecken des Users behalten.
    if (frame === null || this.scanSession.corners() !== null) {
      return;
    }

    const detected = await this.runDetection(frame);

    if (this.sourceFrame() !== frame) {
      return;
    }

    this.scanSession.setCorners(detected ?? insetQuad(this.imageSize(), FALLBACK_INSET_RATIO));
  }

  /** Erkennt die Blattkanten und legt sie als Ziel für „Auto“ in den Entwurf. */
  private async runDetection(frame: ImageBitmap): Promise<Quad | null> {
    this.detecting.set(true);
    let detected: Quad | null = null;

    try {
      detected = await this.documentDetection.detect(frame);
    } catch (error: unknown) {
      console.error('Kantenerkennung fehlgeschlagen', error);
    } finally {
      this.detecting.set(false);
      this.detectionAttempted.set(true);
    }

    // Während der Erkennung zurückgegangen: der Entwurf gehört nicht mehr zu diesem Bild.
    if (this.sourceFrame() !== frame) {
      return null;
    }

    this.scanSession.setDetectedCorners(detected);
    return detected;
  }

  private findEditedPage(): ScannedPage | undefined {
    const id = this.scanSession.editingPageId();

    if (id === null) {
      return undefined;
    }

    return this.pageBuffer.pages().find((page: ScannedPage) => page.id === id);
  }

  private toDisplay(point: Point): Point {
    const { scale, offsetX, offsetY } = this.view();
    return { x: point.x * scale + offsetX, y: point.y * scale + offsetY };
  }

  private pointerToImage(event: PointerEvent): Point {
    const rect = this.stageRef().nativeElement.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.view();

    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    };
  }

  private drawImage(): void {
    const canvas = this.imageCanvasRef().nativeElement;
    const frame = this.sourceFrame();
    const { width, height } = this.stageSize();
    const { scale, offsetX, offsetY } = this.view();
    const pixelRatio = window.devicePixelRatio;

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    const context = canvas.getContext('2d');

    if (context === null || frame === null || width === 0 || height === 0) {
      return;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.drawImage(frame, offsetX, offsetY, frame.width * scale, frame.height * scale);
  }

  private drawLoupe(): void {
    const canvas = this.loupeCanvasRef()?.nativeElement;
    const frame = this.sourceFrame();
    const drag = this.dragging();
    const corners = this.scanSession.corners();

    if (canvas === undefined || frame === null || drag === null || corners === null) {
      return;
    }

    const imagePoints = drag.kind === 'corner' ? corners : edgeMidpoints(corners);
    const center = imagePoints[drag.index];
    const context = canvas.getContext('2d');

    if (center === undefined || context === null) {
      return;
    }

    const pixelSize = Math.round(LOUPE_INNER_SIZE * window.devicePixelRatio);
    // So viele Bild-Pixel zeigt die Lupe: ihr Innenmaß, doppelt so groß wie in der Anzeige.
    const sourceSpan = LOUPE_INNER_SIZE / (LOUPE_ZOOM * this.view().scale);

    canvas.width = pixelSize;
    canvas.height = pixelSize;
    context.fillStyle = STAGE_FILL;
    context.fillRect(0, 0, pixelSize, pixelSize);
    context.drawImage(frame, center.x - sourceSpan / 2, center.y - sourceSpan / 2, sourceSpan, sourceSpan, 0, 0, pixelSize, pixelSize);
  }
}
