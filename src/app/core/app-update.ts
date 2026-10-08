import { DestroyRef, inject, Service } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

import { Toast } from './toast';

const UPDATE_TOAST_DURATION_MS = 10_000;

/** Meldet eine fertig geladene neue App-Version und bietet das Neuladen an. */
@Service()
export class AppUpdate {
  private readonly serviceWorkerUpdate = inject(SwUpdate, { optional: true });
  private readonly toast = inject(Toast);
  private readonly destroyRef = inject(DestroyRef);

  /** Einmal beim Start aufrufen; ohne Service-Worker-Provider oder im Entwicklungsmodus passiert nichts. */
  watch(): void {
    if (this.serviceWorkerUpdate === null || !this.serviceWorkerUpdate.isEnabled) {
      return;
    }

    this.serviceWorkerUpdate.versionUpdates
      .pipe(
        filter((event: VersionEvent) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.announceUpdate());
  }

  private announceUpdate(): void {
    this.toast.show('Neue Version verfügbar', {
      actionLabel: 'Neu laden',
      action: () => document.location.reload(),
      durationMs: UPDATE_TOAST_DURATION_MS,
    });
  }
}
