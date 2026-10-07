import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { Icon } from '../../../shared/icon/icon';

export type CameraBlockedReason = 'denied' | 'insecure' | 'unavailable';

interface StepPart {
  readonly text: string;
  readonly isBold?: boolean;
}

interface BlockedText {
  readonly title: string;
  readonly text: string;
  readonly steps: readonly (readonly StepPart[])[];
  readonly action: string;
}

const BLOCKED_TEXTS: Record<CameraBlockedReason, BlockedText> = {
  denied: {
    title: 'Kamera ist gesperrt',
    text: 'Ohne Kamera kann nichts gescannt werden.',
    steps: [
      [{ text: '1 · Schloss neben der Adresszeile antippen' }],
      [{ text: '2 · „Kamera“ auf ' }, { text: 'Zulassen', isBold: true }, { text: ' stellen' }],
      [{ text: '3 · Seite neu laden' }],
    ],
    action: 'Nochmal versuchen',
  },
  insecure: {
    title: 'Keine sichere Verbindung',
    text: 'Die Kamera funktioniert nur über eine verschlüsselte Verbindung.',
    steps: [[{ text: '1 · Adresse mit ' }, { text: 'https://', isBold: true }, { text: ' statt http:// öffnen' }]],
    action: 'Mit https öffnen',
  },
  unavailable: {
    title: 'Keine Kamera gefunden',
    text: 'Dieses Gerät hat keine Kamera, oder eine andere App benutzt sie gerade.',
    steps: [[{ text: '1 · Andere Apps mit Kamera schließen' }], [{ text: '2 · Nochmal versuchen' }]],
    action: 'Nochmal versuchen',
  },
};

@Component({
  selector: 'cam-camera-blocked',
  imports: [Icon],
  templateUrl: './camera-blocked.html',
  styleUrl: './camera-blocked.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraBlocked {
  private readonly document = inject(DOCUMENT);

  readonly reason = input.required<CameraBlockedReason>();
  readonly retry = output<void>();

  protected readonly content = computed((): BlockedText => BLOCKED_TEXTS[this.reason()]);

  protected onActionClick(): void {
    if (this.reason() === 'insecure') {
      const location = this.document.location;
      location.replace(location.href.replace(/^http:/, 'https:'));
      return;
    }

    this.retry.emit();
  }
}
