# Stitch Sculpt — plan and architecture

A browser app (plain HTML/CSS/JS, no build step) for designing amigurumi and
crochet-in-the-round pieces in 3D and turning them into written patterns.
Long term it should also start a design from an uploaded image.

## Core idea

Amigurumi pieces are crocheted as spirals of rounds around an axis. So every
**part** in the app is a *surface of revolution* (a profile curve spun around
its own axis) plus a *sculpt displacement map* on top. That one representation
gives us both halves of the request:

- **TinkerCAD-style**: primitives (sphere, egg, cylinder, cone, capsule, limb,
  flat circle, open tube) that you add, move, rotate, scale, duplicate and
  mirror. Each part = one piece you crochet and then sew on.
- **Blender-style sculpting**: brushes (inflate, deflate, smooth, flatten)
  push the surface along its normal, with left/right mirror.
- **Pattern from geometry**: the profile parameter *v* runs from the start of
  the piece to the end, so the rounds are simply rings of constant *v*.

Merging parts into one mesh (boolean union) is deliberately *not* how it
works: a crocheter can't work a union, they sew pieces together. The app keeps
pieces separate and writes assembly notes instead.

## Pattern algorithm (js/pattern.js)

1. Sample the part densely (96 around × 240 along) in world size (scale counts).
2. Measure mean meridian length S(v). Split it into rounds one row-height apart
   (row height from gauge). Sharp profile points get their own round boundary;
   the round after a sharp turn is worked in **BLO** (crisp edge, e.g. the base
   of a cylinder).
3. Stitch count of each round = ring perimeter ÷ stitch width, limited to
   ½×–2× the previous round. “Tidy counts” snaps to the familiar +6/−6 per
   round when that’s within ~12%, and drops lone ±1 changes (<4.5%).
4. **Placing increases/decreases**: walk the previous round's stitches and keep
   the new round's running stitch count tracking the new ring's cumulative
   perimeter. On symmetric pieces this spaces them evenly; on sculpted pieces
   it puts increases where the bump is, and a round can have both incs and decs.
   Alternate rounds are staggered by half a repeat so pieces don't go polygonal.
5. Start: closed end → magic ring with 4–10 sc; open end → chain ring.
   Finish: closed end → gather (extra dec rounds first if it's still wide),
   stuffing note when the opening starts to close; open end → long tail.
6. Text: run-length + repeat detection: `(2 sc, inc) ×6 (24)`,
   `sc, (3 sc, inc) ×5, 2 sc`, identical rounds merged (`Rnds 6–15`).
   US/UK terms. Identical pieces are grouped as “make 2”.
7. Assembly: for each smaller part, the nearest point on a larger part to its
   open edge (preferred) or end → “Sew the open edge of Arm L to Body around
   Rnd 16, on the top, left side.”

The 3D view draws every round as a ring and marks increases (green) and
decreases (red); hovering a pattern line highlights that round.

## Files

```
apps/crochet/
  index.html            layout, toolbar, panels
  css/app.css           theme tokens (light + dark), layout, print styles
  js/shape.js           profiles, primitives, displacement grid, surface sampling (no DOM)
  js/pattern.js         rounds, counts, inc/dec placement, text, assembly (no DOM)
  js/profile-editor.js  2D canvas editor for a part's profile
  js/viewport.js        three.js scene, gizmo, picking, sculpt cursor, round overlay
  js/app.js             state, undo/redo, UI wiring, sculpt brush math, save/load
  vendor/three.bundle.js three.js r180 + OrbitControls + TransformControls as one classic script (window.THREE)
  tests/pattern-test.js node tests for the stitch arithmetic
```

`shape.js` and `pattern.js` have no DOM or three.js dependency, so they run in
Node (tests) and can later run on the server or in a Web Worker unchanged.

The three.js bundle is a classic script (not ES modules) so the app also works
when `index.html` is opened straight from disk. It was built with esbuild from
`three@0.180.0`; see README for the one-line rebuild.

## Saved file

`name.stitch.json`:

```json
{ "format": "stitch-sculpt", "version": 1,
  "settings": { "gauge": { "stitches": 20, "rows": 22 }, "terms": "US", "tidy": true },
  "parts": [ { "id", "name", "kind", "color", "visible",
               "profile": { "smooth": true, "points": [ { "r": 0, "z": 0, "sharp": false } ] },
               "disp": { "cols": 64, "rows": 72, "data": [ ... ] } | null,
               "position": [x,y,z], "rotation": [x,y,z] (radians, XYZ), "scale": [x,y,z] } ],
  "reference": { "src": "data:image/...", "height": 15, "opacity": 0.6 } }
```

Units are cm. Autosave goes to localStorage (without the reference image).

## Roadmap

### Phase 1 — MVP (built)
- [x] Primitives, move/rotate/scale gizmo, numeric placement, duplicate, mirror copy
- [x] Profile editor: drag/add/delete points, sharp corners, open/closed ends
- [x] Sculpt brushes with mirror; undo/redo; autosave; save/open file
- [x] Gauge + yarn presets, US/UK terms, tidy counts
- [x] Round-by-round pattern with smart inc/dec placement, BLO, stuffing, finishing
- [x] Rounds + inc/dec overlay in 3D; hover a line to highlight its round
- [x] Make-2 grouping, assembly notes, copy/download/print
- [x] Reference image behind the scene (front view) for tracing

### Phase 2 — better pieces
- Color changes per round range (stripes) with yarn estimate per color
- Profile-only parts that aren't closed loops: flat ovals (start with a chain,
  work around both sides) for feet, snouts, ears
- Bent tubes / tails (a curved axis instead of straight) — torus-like shapes
- Embroidery & safety-eye markers placed on the surface → “eyes between Rnd 12
  and 13, 6 sts apart”
- Joined-as-you-go legs (two legs joined into the body) like real patterns
- Per-round notes (FLO ridges, “change color”, “insert eyes now”)
- A stitch-texture material so the 3D view looks crocheted
- Move pattern generation to a Web Worker if large projects get slow

### Phase 3 — from an uploaded image
1. **Silhouette → profile (single part)**: load a side photo on a plain
   background, threshold/segment it, take the half-width at each height
   around a user-placed centre line → profile points. Works for vases, eggs,
   bodies. Cheap, no ML.
2. **Front + side photos → part**: two silhouettes give width and depth per
   height → non-uniform scale per round (an elliptical cross-section), which the
   displacement map can store.
3. **Segment into parts**: let the user click regions of the image (head,
   body, ears) and fit a primitive to each; then refine with the editor.
4. **Single photo → 3D**: an image-to-3D model (on the server, or a hosted
   API) gives a mesh; fit our parts to it by slicing along a chosen axis.
   Bigger lift; needs the server and has privacy/cost questions.

### Phase 4 — sharing
- Accounts and saved projects via the existing HappyTheta server
- Shareable read-only pattern pages; PDF export with a diagram per part
- Pattern difficulty estimate and time-to-make

## Known limits
- Patterns are geometric. Real fabric stretches and stuffing rounds things
  out, so very flat or sharp details crochet softer than they look.
- A part must be one piece of revolution: profile ends on the centre line are
  closed, others open. Shapes that branch (a hand with fingers) need several parts.
- Inc/dec placement assumes all rounds start at the same angle; real spirals
  drift a little. The counts are what matter.
- Yarn length is a rough estimate (~5 stitch widths of yarn per sc).
