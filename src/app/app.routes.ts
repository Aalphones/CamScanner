import { Routes } from '@angular/router';

// Die drei Screens entstehen in den Phasen 2 (capture), 4 (crop) und 5 (result)
// dieses Plans — jede Phase schaltet ihren Eintrag scharf (loadComponent-Import).
export const routes: Routes = [
  { path: '', redirectTo: 'capture', pathMatch: 'full' },
  { path: '**', redirectTo: 'capture' },
];
