# Stitch Sculpt

Design amigurumi pieces in 3D and get a round-by-round crochet pattern.

**Run it:** open `index.html` in a browser (Chrome, Edge, Firefox, Safari). It
works straight from disk or from any static web server (e.g. drop the
`crochet/` folder next to `phys/` on the droplet). No build step, no network.

## Using it
- **Add** a shape from the toolbar. Each part is one piece you crochet.
- **Move / Rotate / Scale** (W / E / R) with the gizmo, or type numbers under Placement.
- **Sculpt** (B): drag on a part. Shift inverts. Alt-drag or right-drag orbits.
- **Profile** (Shape tab): the side view of half the part. Drag points;
  double-click the line to add a point; double-click a point for a sharp corner
  (worked in BLO); Delete removes the selected point. An end on the centre line is closed.
- **Pattern** tab: the written pattern. Hover a line to see that round in 3D.
- **Settings**: gauge (or a yarn preset), US/UK terms, reference image.
- Keys: Ctrl+Z / Ctrl+Y undo/redo, Ctrl+D duplicate, Del delete, F frame,
  1 front, 3 side, 7 top, 5 three-quarter.
- Work saves itself in this browser; use **Save** for a `.stitch.json` file.

## Tests
`node tests/pattern-test.js` — checks the stitch arithmetic for every primitive.

## Rebuilding the three.js bundle
`vendor/three.bundle.js` is three.js r180 + OrbitControls + TransformControls
as one classic script that sets `window.THREE`. To rebuild:

```
npm i three@0.180.0 esbuild
# vendor-entry.js:
#   import * as T from 'three';
#   import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
#   import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
#   window.THREE = Object.assign({}, T, { OrbitControls, TransformControls });
npx esbuild vendor-entry.js --bundle --minify --format=iife --outfile=vendor/three.bundle.js
```

three.js is MIT licensed (`vendor/THREE-LICENSE.txt`).

See `PLAN.md` for the architecture and roadmap.
