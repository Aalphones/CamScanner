/** Alles aus OpenCV.js, was manuell freigegeben werden muss. */
interface CvDeletable {
  delete(): void;
}

/**
 * OpenCV.js läuft in WebAssembly ohne Speicherbereinigung: jede `Mat` muss von
 * Hand freigegeben werden, sonst schießt ein paar Scans später der Tab ab.
 * Statt einer Kaskade verschachtelter `try`/`finally`-Blöcke sammelt dieser
 * Ablagekorb alle Objekte ein; ein einziges `finally` räumt sie wieder ab.
 */
export class MatScope {
  private readonly tracked: CvDeletable[] = [];

  track<T extends CvDeletable>(value: T): T {
    this.tracked.push(value);
    return value;
  }

  releaseAll(): void {
    for (const item of this.tracked) {
      item.delete();
    }

    this.tracked.length = 0;
  }
}
