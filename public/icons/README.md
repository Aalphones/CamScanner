# App-Icon

Quelle sind `icon.svg` und `icon-maskable.svg` (gleiches Motiv, maskable auf 60 % verkleinert). Die PNGs entstehen, indem Chrome headless (`--headless=new --window-size=N,N --screenshot=…`) eine Hilfs-HTML mit dem SVG in Zielgröße fotografiert: `icon-192`, `icon-512`, `icon-maskable-192`, `icon-maskable-512`, `apple-touch-icon` (180), `favicon-32`.
