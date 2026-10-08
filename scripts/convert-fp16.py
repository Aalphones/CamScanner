"""Wandelt DocShadow auf halbe Rechengenauigkeit (fp16) um — halbe Dateigröße.

Ein- und Ausgang bleiben float32, damit die App den Tensor unverändert füttert.
Aufruf über `npm run fetch-models`, nicht direkt.
"""

import sys
import warnings

import onnx
from onnxconverter_common import float16

source_path, target_path = sys.argv[1], sys.argv[2]

# Winzige Gewichte unter der fp16-Grenze werden auf 1e-7 gerundet; das meldet die Bibliothek pro Wert.
warnings.filterwarnings("ignore", category=UserWarning, module="onnxconverter_common")

model = onnx.load(source_path)
onnx.save(float16.convert_float_to_float16(model, keep_io_types=True), target_path)
