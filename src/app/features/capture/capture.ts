import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { Camera } from '../../core/camera';
import { ScanSession } from '../../core/scan-session';

@Component({
  selector: 'cam-capture',
  imports: [],
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
  protected readonly capturing = signal(false);

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
}
