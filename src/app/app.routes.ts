import { Routes } from '@angular/router';

import { draftSourceGuard } from './core/scan-flow.guards';

// Bildschirm-Fluss und Guards: docs/planning/2026-10-07_app-nach-mockup/README.md → „Bildschirm-Fluss“.
export const routes: Routes = [
  { path: '', redirectTo: 'capture', pathMatch: 'full' },
  {
    path: 'capture',
    loadComponent: () => import('./features/capture/capture').then((module) => module.Capture),
  },
  {
    path: 'crop',
    canActivate: [draftSourceGuard],
    loadComponent: () => import('./features/crop/crop').then((module) => module.Crop),
  },
  { path: '**', redirectTo: 'capture' },
];
