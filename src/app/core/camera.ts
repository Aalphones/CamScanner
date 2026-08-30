import { Service, signal } from '@angular/core';

export const CAMERA_STATES = ['idle', 'starting', 'running', 'denied', 'insecure', 'unavailable'] as const;
export type CameraState = (typeof CAMERA_STATES)[number];

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 3840 },
    height: { ideal: 2160 },
  },
  audio: false,
};

@Service()
export class Camera {
  private readonly stateSignal = signal<CameraState>('idle');
  readonly state = this.stateSignal.asReadonly();

  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  /** Startet den Kamera-Stream und hängt ihn an `video`. Prüft Secure Context und API-Verfügbarkeit, bevor `getUserMedia` überhaupt aufgerufen wird. */
  async start(video: HTMLVideoElement): Promise<void> {
    this.videoElement = video;

    if (!window.isSecureContext) {
      this.stateSignal.set('insecure');
      return;
    }

    if (!navigator.mediaDevices) {
      this.stateSignal.set('unavailable');
      return;
    }

    this.stateSignal.set('starting');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      video.srcObject = this.stream;
      this.stateSignal.set('running');
    } catch (error) {
      this.stateSignal.set(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }

  /** Standbild in voller Kamera-Auflösung, nicht in den CSS-Maßen des Video-Elements. */
  captureFrame(video: HTMLVideoElement): Promise<ImageBitmap> {
    return createImageBitmap(video);
  }

  /** Stoppt alle Tracks und leert `srcObject` — sonst läuft die Kamera-LED weiter, auch wenn niemand mehr zusieht. */
  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.stateSignal.set('idle');
  }
}
