import { Service } from '@angular/core';

import type { CV } from '@techstark/opencv-js';

/** Voll typisiertes OpenCV.js-Modul — alle Aufrufer typisieren gegen diesen Alias, nie gegen `any`. */
export type OpenCv = CV;

/** Rohform des dynamischen Imports, bevor die Emscripten-Runtime bereit ist. */
interface OpenCvRuntimeModule {
  readonly Mat?: unknown;
  onRuntimeInitialized?: () => void;
}

@Service()
export class OpencvLoader {
  private loadPromise: Promise<OpenCv> | null = null;

  /** Lädt OpenCV.js beim ersten Aufruf per Lazy-Chunk; jeder weitere Aufruf bekommt dieselbe Promise. */
  load(): Promise<OpenCv> {
    this.loadPromise ??= this.initialize();
    return this.loadPromise;
  }

  private async initialize(): Promise<OpenCv> {
    const module = await import('@techstark/opencv-js');
    const cvModule = module.default as unknown as Promise<OpenCv> | OpenCvRuntimeModule;

    if (cvModule instanceof Promise) {
      return cvModule;
    }

    if (cvModule.Mat !== undefined) {
      return cvModule as OpenCv;
    }

    return new Promise<OpenCv>((resolve) => {
      cvModule.onRuntimeInitialized = () => resolve(cvModule as OpenCv);
    });
  }
}
