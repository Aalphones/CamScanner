import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { Camera } from '../../core/camera';
import { ScanSession } from '../../core/scan-session';
import { Icon } from '../../shared/icon/icon';
import { CameraBlocked } from './camera-blocked/camera-blocked';

const GRID_STORAGE_KEY = 'cam.grid';

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

  ngOnInit(): void {
    void this.camera.start(this.videoRef().nativeElement);
  }

  ngOnDestroy(): void {
    this.camera.stop();
  }

  protected async onShutterClick(): Promise<void> {
    if (this.capturing()) {
      return;
    }

    this.capturing.set(true);

    try {
      const frame = await this.camera.captureFrame(this.videoRef().nativeElement);
      this.scanSession.setSourceFrame(frame);
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
