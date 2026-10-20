import { Service } from '@angular/core';

/** Ordner, in den `angular.json` die WASM-Dateien von onnxruntime-web kopiert. */
const ORT_ASSET_DIR = 'ort/';

export type Ort = typeof import('onnxruntime-web');

/** Lädt onnxruntime-web genau einmal für alle KI-Modelle der App — selbst gehostet, erst beim ersten Bedarf. */
@Service()
export class OrtRuntime {
  private ortPromise: Promise<Ort> | null = null;

  /** Jeder weitere Aufruf bekommt dieselbe Promise; nach einem Fehler darf der nächste Aufruf neu versuchen. */
  load(): Promise<Ort> {
    if (this.ortPromise === null) {
      this.ortPromise = this.createRuntime();
      this.ortPromise.catch(() => {
        this.ortPromise = null;
      });
    }

    return this.ortPromise;
  }

  private async createRuntime(): Promise<Ort> {
    const ort = await import('onnxruntime-web');
    // Selbst gehostet statt CDN: offline verfügbar und kein Netzwerkzugriff außer auf die eigene Adresse.
    ort.env.wasm.wasmPaths = new URL(ORT_ASSET_DIR, document.baseURI).href;
    // Threads nutzt ORT nur mit Cross-Origin-Isolation, sonst läuft es von selbst einfädig.
    console.info('OrtRuntime: crossOriginIsolated =', globalThis.crossOriginIsolated);

    return ort;
  }
}
