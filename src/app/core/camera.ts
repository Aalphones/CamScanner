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

// `torch` fehlt in den TypeScript-DOM-Typen, obwohl Chromium-Browser es melden.
interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

interface TorchConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
}

@Service()
export class Camera {
  private readonly stateSignal = signal<CameraState>('idle');
  readonly state = this.stateSignal.asReadonly();

  private readonly torchAvailableSignal = signal(false);
  readonly torchAvailable = this.torchAvailableSignal.asReadonly();

  private readonly torchOnSignal = signal(false);
  readonly torchOn = this.torchOnSignal.asReadonly();

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
      this.torchAvailableSignal.set(this.readTorchCapability());
      this.stateSignal.set('running');
    } catch (error) {
      this.stateSignal.set(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }

  /** Schaltet die Taschenlampe; ohne laufenden Track passiert nichts, bei einem Fehler bleibt sie aus. */
  async setTorch(on: boolean): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) {
      return;
    }

    try {
      const torchConstraint: TorchConstraintSet = { torch: on };
      await track.applyConstraints({ advanced: [torchConstraint] });
      this.torchOnSignal.set(on);
    } catch {
      this.torchOnSignal.set(false);
    }
  }

  /** Standbild in voller Kamera-Auflösung, nicht in den CSS-Maßen des Video-Elements. */
  captureFrame(video: HTMLVideoElement): Promise<ImageBitmap> {
    return createImageBitmap(video);
  }

  /**
   * Kleines Vorschaubild für die Live-Erkennung. Der Browser verkleinert beim
   * Dekodieren — billiger als erst volle Auflösung holen und dann skalieren.
   * Der Aufrufer muss das Bitmap schließen.
   */
  grabPreviewFrame(video: HTMLVideoElement, maxEdge = 480): Promise<ImageBitmap> | null {
    const { videoWidth, videoHeight } = video;

    if (videoWidth === 0 || videoHeight === 0) {
      return null;
    }

    const scale = Math.min(1, maxEdge / Math.max(videoWidth, videoHeight));

    return createImageBitmap(video, {
      resizeWidth: Math.round(videoWidth * scale),
      resizeHeight: Math.round(videoHeight * scale),
      resizeQuality: 'low',
    });
  }

  /** Stoppt alle Tracks und leert `srcObject` — sonst läuft die Kamera-LED weiter, auch wenn niemand mehr zusieht. */
  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.torchAvailableSignal.set(false);
    this.torchOnSignal.set(false);
    this.stateSignal.set('idle');
  }

  private readTorchCapability(): boolean {
    const track = this.stream?.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== 'function') {
      return false;
    }

    const capabilities: TorchCapabilities = track.getCapabilities();
    return capabilities.torch === true;
  }
}
