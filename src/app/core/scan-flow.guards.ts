import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';

import { PageBuffer } from './page-buffer';
import { ScanSession } from './scan-session';

const FALLBACK_URL = '/capture';

/** Nach einem Neuladen ist der Entwurf weg — dann zurück in den Sucher statt auf einen leeren Bildschirm. */
export const draftSourceGuard: CanActivateFn = (): boolean | UrlTree => {
  if (inject(ScanSession).sourceFrame() !== null) {
    return true;
  }

  return inject(Router).parseUrl(FALLBACK_URL);
};

export const draftWarpedGuard: CanActivateFn = (): boolean | UrlTree => {
  if (inject(ScanSession).warpedPage() !== null) {
    return true;
  }

  return inject(Router).parseUrl(FALLBACK_URL);
};

export const hasPagesGuard: CanActivateFn = (): boolean | UrlTree => {
  if (inject(PageBuffer).count() > 0) {
    return true;
  }

  return inject(Router).parseUrl(FALLBACK_URL);
};
