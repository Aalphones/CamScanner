import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const ICON_PATHS = {
  back: 'm15 18-6-6 6-6',
  flash: 'M13 2 4 14h7l-1 8 9-12h-7z',
  grid: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18',
  rotate: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14',
  lock: 'M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  'camera-off': 'M3 3l18 18M10.5 6H14l1.5 2H19a2 2 0 0 1 2 2v7M3 8.5V17a2 2 0 0 0 2 2h11M9.9 9.9a3.5 3.5 0 0 0 4.2 4.2',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01',
} as const;

export type IconName = keyof typeof ICON_PATHS;

@Component({
  selector: 'cam-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(2);

  protected readonly path = computed((): string => ICON_PATHS[this.name()]);
}
