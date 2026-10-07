import { Service, signal } from '@angular/core';

export interface ToastState {
  readonly message: string;
  /** `null` = kein Aktionsknopf. */
  readonly actionLabel: string | null;
}

export interface ToastOptions {
  readonly actionLabel?: string;
  readonly action?: () => void;
  readonly durationMs?: number;
  /** Läuft, wenn der Toast ohne Antippen der Aktion verschwindet — auch wenn ein neuer ihn ersetzt. */
  readonly onExpire?: () => void;
}

const DEFAULT_DURATION_MS = 3000;
const ACTION_DURATION_MS = 5000;

/** Ein Toast zur Zeit; ein neuer ersetzt den alten. */
@Service()
export class Toast {
  private readonly currentSignal = signal<ToastState | null>(null);
  private options: ToastOptions = {};
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly current = this.currentSignal.asReadonly();

  show(message: string, options: ToastOptions = {}): void {
    this.expire();

    const actionLabel = options.actionLabel ?? null;
    const durationMs = options.durationMs ?? (actionLabel === null ? DEFAULT_DURATION_MS : ACTION_DURATION_MS);

    this.options = options;
    this.currentSignal.set({ message, actionLabel });
    this.timer = setTimeout(() => this.expire(), durationMs);
  }

  runAction(): void {
    const action = this.options.action;

    this.clear();
    action?.();
  }

  private expire(): void {
    const onExpire = this.options.onExpire;

    this.clear();
    onExpire?.();
  }

  private clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = null;
    this.options = {};
    this.currentSignal.set(null);
  }
}
