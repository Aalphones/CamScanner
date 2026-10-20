// Holt die KI-Modelle (DocAligner, DocShadow), prüft die Prüfsummen und wandelt DocShadow auf fp16 um (ADR-007).
// Das Ergebnis liegt in public/models/ und ist nicht im Git. Braucht `uv` im PATH.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://github.com/fabio-sim/DocShadow-ONNX-TensorRT/releases/download/v1.0.0/docshadow_sd7k.onnx';
const SOURCE_SHA256 = '8c09b9320a0fb3c53806cdf9cb8410b3706c77caed81f4ec1cb0bf2cbd14b049';
const TARGET_SHA256 = '4f36771d874ee40044ee2788557fdd26d95a9cc8aa5ad700a830caeec1eb7e2d';
// Gepinnt, weil die Prüfsumme der fp16-Datei von genau diesen Versionen abhängt.
const CONVERTER_PACKAGES = ['onnx==1.23.2', 'onnxconverter-common==1.16.0'];
// DocAligner lcnet100 (Heatmap, 256 px, fp32) — die Original-Ablage der Autoren liegt auf Google Drive.
const ALIGNER_URL = 'https://drive.usercontent.google.com/download?id=1IlbLPkCv-TdaBLOPh_4J97P1_KHYYJ7a&export=download&confirm=t';
const ALIGNER_SHA256 = 'f4117b786e3a18470f3865c93f3c2bd69d9b998edd60f385574a5c665e79594e';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, 'node_modules', '.cache', 'camscanner-models');
const sourcePath = join(cacheDir, 'docshadow_sd7k.onnx');
const targetPath = join(root, 'public', 'models', 'docshadow.onnx');
const alignerTargetPath = join(root, 'public', 'models', 'docaligner.onnx');

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function fail(message) {
  console.error(`[FEHLER] ${message}`);
  process.exit(1);
}

mkdirSync(cacheDir, { recursive: true });
mkdirSync(dirname(targetPath), { recursive: true });

if (existsSync(alignerTargetPath) && sha256(alignerTargetPath) === ALIGNER_SHA256) {
  console.log('DocAligner ist schon da:', alignerTargetPath);
} else {
  console.log('Lade DocAligner (5 MB) ...');
  const response = await fetch(ALIGNER_URL);

  if (!response.ok) {
    fail(`Download von DocAligner fehlgeschlagen: HTTP ${response.status}`);
  }

  writeFileSync(alignerTargetPath, Buffer.from(await response.arrayBuffer()));

  if (sha256(alignerTargetPath) !== ALIGNER_SHA256) {
    rmSync(alignerTargetPath);
    fail('Prüfsumme von DocAligner stimmt nicht — Datei gelöscht. Google Drive liefert bei Kontingent-Sperre eine HTML-Seite statt des Modells; später erneut versuchen.');
  }

  console.log('DocAligner bereit:', alignerTargetPath);
}

if (existsSync(targetPath) && sha256(targetPath) === TARGET_SHA256) {
  console.log('KI-Modell ist schon da:', targetPath);
  process.exit(0);
}

if (!existsSync(sourcePath) || sha256(sourcePath) !== SOURCE_SHA256) {
  console.log('Lade DocShadow (120 MB) ...');
  const response = await fetch(SOURCE_URL);

  if (!response.ok) {
    fail(`Download fehlgeschlagen: HTTP ${response.status}`);
  }

  writeFileSync(sourcePath, Buffer.from(await response.arrayBuffer()));

  if (sha256(sourcePath) !== SOURCE_SHA256) {
    rmSync(sourcePath);
    fail('Prüfsumme des Downloads stimmt nicht — Datei gelöscht.');
  }
}

console.log('Wandle auf fp16 um ...');
try {
  const withArgs = CONVERTER_PACKAGES.flatMap((pkg) => ['--with', pkg]);
  execFileSync('uv', ['run', '--no-project', ...withArgs, 'python', join(root, 'scripts', 'convert-fp16.py'), sourcePath, targetPath], { stdio: 'inherit' });
} catch {
  rmSync(targetPath, { force: true });
  fail('Umwandlung fehlgeschlagen. Ist `uv` installiert (https://docs.astral.sh/uv/)?');
}

if (sha256(targetPath) !== TARGET_SHA256) {
  rmSync(targetPath);
  fail('Prüfsumme der fp16-Datei stimmt nicht — Datei gelöscht.');
}

console.log('KI-Modell bereit:', targetPath);
