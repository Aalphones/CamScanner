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

/** Obergrenze fürs Foto: die Pipeline ist auf bis zu 12 MP ausgelegt (ADR-006); mehr kostet nur Speicher. */
const PHOTO_MAX_PIXELS = 12_000_000;

/** Geräte runden die angefragte Größe; erst darüber wird nachträglich verkleinert. */
const PHOTO_PIXEL_TOLERANCE = 1.05;

/** Manche Geräte beantworten takePhoto nie — danach zählt das Videobild (ADR-009). */
const PHOTO_TIMEOUT_MS = 5_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve: (value: never) => void, reject: (reason: Error) => void) => {
    timer = setTimeout(() => reject(new Error('Zeitüberschreitung')), ms);
  });

  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

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

  /** Standbild für den Scan: echtes Foto in Sensor-Auflösung, wo der Browser es kann, sonst das Videobild (ADR-009). */
  async captureFrame(video: HTMLVideoElement): Promise<ImageBitmap> {
    const photo = await this.takePhoto();
    return photo ?? createImageBitmap(video);
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

  /** `null` = kein Foto möglich oder gescheitert; der Aufrufer nimmt dann das Videobild. */
  private async takePhoto(): Promise<ImageBitmap | null> {
    const track = this.stream?.getVideoTracks()[0];

    // Taschenlampe an → Videobild: ob takePhoto die Dauerleuchte anlässt, ist ungeprüft.
    if (!track || typeof ImageCapture === 'undefined' || this.torchOn()) {
      return null;
    }

    try {
      const capture = new ImageCapture(track);
      const settings = await this.photoSettings(capture);
      const blob = await withTimeout(capture.takePhoto(settings), PHOTO_TIMEOUT_MS);
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const limited = await this.limitPixels(bitmap);
      console.info('Camera: Foto', limited.width, '×', limited.height);
      return limited;
    } catch (error: unknown) {
      console.warn('Fotoaufnahme nicht möglich, nehme das Videobild', error);
      return null;
    }
  }

  /** Fragt die größte Foto-Auflösung an, die unter der Pixelgrenze bleibt; ohne Angaben des Geräts dessen Standard. */
  private async photoSettings(capture: ImageCapture): Promise<PhotoSettings> {
    let capabilities: PhotoCapabilities;

    try {
      capabilities = await capture.getPhotoCapabilities();
    } catch {
      return {};
    }

    const maxWidth = capabilities.imageWidth?.max;
    const maxHeight = capabilities.imageHeight?.max;

    if (maxWidth === undefined || maxHeight === undefined) {
      return {};
    }

    if (maxWidth * maxHeight <= PHOTO_MAX_PIXELS) {
      return { imageWidth: maxWidth, imageHeight: maxHeight };
    }

    const factor = Math.sqrt(PHOTO_MAX_PIXELS / (maxWidth * maxHeight));
    return { imageWidth: Math.round(maxWidth * factor), imageHeight: Math.round(maxHeight * factor) };
  }

  /** Verkleinert, falls das Gerät die angefragte Größe ignoriert hat. */
  private async limitPixels(bitmap: ImageBitmap): Promise<ImageBitmap> {
    const { width, height } = bitmap;

    if (width * height < PHOTO_MAX_PIXELS * PHOTO_PIXEL_TOLERANCE) {
      return bitmap;
    }

    const factor = Math.sqrt(PHOTO_MAX_PIXELS / (width * height));

    try {
      return await createImageBitmap(bitmap, {
        resizeWidth: Math.round(width * factor),
        resizeHeight: Math.round(height * factor),
        resizeQuality: 'high',
      });
    } finally {
      bitmap.close();
    }
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
