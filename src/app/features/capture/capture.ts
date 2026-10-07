import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { Camera } from '../../core/camera';
import { DocumentDetection } from '../../core/document-detection';
import { fitCover, mapQuad, type Point, type Quad, type Size } from '../../core/geometry';
import { ScanSession } from '../../core/scan-session';
import { Icon } from '../../shared/icon/icon';
import { CameraBlocked } from './camera-blocked/camera-blocked';
import { LiveDetection } from './live-detection';

const GRID_STORAGE_KEY = 'cam.grid';

/** Radius der Eckpunkte des Live-Rahmens (Mockup: 12 px Durchmesser). */
const CORNER_RADIUS = 6;

@Component({
  selector: 'cam-capture',
  imports: [CameraBlocked, Icon],
  templateUrl: './capture.html',
  styleUrl: './capture.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Capture implements OnInit, OnDestroy {
  private readonly camera = inject(Camera);
  private readonly scanSession = inject(ScanSession);
  private readonly router = inject(Router);

  protected readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly state = this.camera.state;
  protected readonly torchAvailable = this.camera.torchAvailable;
  protected readonly torchOn = this.camera.torchOn;
  protected readonly capturing = signal(false);
  protected readonly gridOn = signal(this.readGridPreference());

  private readonly liveDetection = new LiveDetection(this.camera, inject(DocumentDetection));
  private readonly videoSize = signal<Size>({ width: 0, height: 0 });
  private resizeObserver: ResizeObserver | null = null;

  protected readonly cornerRadius = CORNER_RADIUS;
  protected readonly documentStable = this.liveDetection.stable;

  /** Erkanntes Viereck in Bildschirm-Koordinaten des Video-Elements; das Video ist per `cover` beschnitten. */
  protected readonly liveQuad = computed((): Quad | null => {
    const quad = this.liveDetection.quad();
    const previewSize = this.liveDetection.previewSize();

    if (quad === null || previewSize.width === 0) {
      return null;
    }

    return mapQuad(quad, fitCover(previewSize, this.videoSize()));
  });

  protected readonly liveOutlinePoints = computed((): string => {
    const quad = this.liveQuad();

    if (quad === null) {
      return '';
    }

    return quad.map((corner: Point) => `${corner.x},${corner.y}`).join(' ');
  });

  constructor() {
    effect(() => {
      if (this.state() === 'running' && !this.capturing()) {
        this.liveDetection.start(this.videoRef().nativeElement);
      } else {
        this.liveDetection.stop();
      }
    });
  }

  ngOnInit(): void {
    const video = this.videoRef().nativeElement;

    this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      const entry = entries[0];

      if (entry !== undefined) {
        this.videoSize.set({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    this.resizeObserver.observe(video);

    void this.camera.start(video);
  }

  ngOnDestroy(): void {
    this.liveDetection.stop();
    this.resizeObserver?.disconnect();
    this.camera.stop();
  }

  protected async onShutterClick(): Promise<void> {
    if (this.capturing()) {
      return;
    }

    this.capturing.set(true);
    // Sofort anhalten, nicht erst über den Effekt: der Auslöser soll die volle Rechenzeit fürs Standbild bekommen.
    this.liveDetection.stop();

    try {
      const frame = await this.camera.captureFrame(this.videoRef().nativeElement);
      this.scanSession.startNew(frame);
      this.camera.stop();
      await this.router.navigate(['/crop']);
    } finally {
      this.capturing.set(false);
    }
  }

  protected onRetryClick(): void {
    void this.camera.start(this.videoRef().nativeElement);
  }

  protected onTorchClick(): void {
    void this.camera.setTorch(!this.camera.torchOn());
  }

  protected onGridClick(): void {
    const next = !this.gridOn();
    this.gridOn.set(next);

    try {
      localStorage.setItem(GRID_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Speicher gesperrt (z. B. privater Modus) — das Raster funktioniert trotzdem, nur ohne Merken.
    }
  }

  private readGridPreference(): boolean {
    try {
      return localStorage.getItem(GRID_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
