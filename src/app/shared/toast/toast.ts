import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Toast } from '../../core/toast';

@Component({
  selector: 'cam-toast',
  templateUrl: './toast.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastView {
  protected readonly toast = inject(Toast);
}
