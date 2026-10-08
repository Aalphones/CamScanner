import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppUpdate } from './core/app-update';
import { ToastView } from './shared/toast/toast';

@Component({
  selector: 'cam-root',
  imports: [RouterOutlet, ToastView],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    inject(AppUpdate).watch();
  }
}
