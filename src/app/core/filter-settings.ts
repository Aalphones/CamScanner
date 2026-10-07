export type FilterId = 'original' | 'auto' | 'scan' | 'bw' | 'gray';

export interface FilterSettings {
  readonly filter: FilterId;
  /** 0..100, 50 = neutral */
  readonly contrast: number;
  /** 0..100, 50 = neutral */
  readonly brightness: number;
  /** Erst mit der KI-Schattenentfernung schaltbar, bis dahin immer `false`. */
  readonly removeShadow: boolean;
}

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  filter: 'auto',
  contrast: 50,
  brightness: 50,
  removeShadow: false,
};
