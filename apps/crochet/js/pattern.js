/* Stitch Sculpt — pattern generator (no DOM, no three.js; runs in Node for tests).
 *
 * How it works, for one part:
 *  1. Sample the surface densely (columns around, fine rows along the profile)
 *     in world size (the part's scale counts; position/rotation don't).
 *  2. Mean meridian length S(v) along the profile parameter v. Split it into
 *     rounds about one row-height apart. Sharp profile points get their own
 *     round boundary, and the round after a sharp turn is worked in BLO.
 *  3. Each round is the ring of points at its v. Stitch count = ring
 *     perimeter / stitch width, limited to half..double the previous round.
 *  4. Increases and decreases go where that ring grows or shrinks most:
 *     walk the previous round's stitches and keep the new stitch count
 *     tracking the ring's cumulative perimeter (handles lopsided sculpts;
 *     on symmetric shapes it spaces them evenly). Every other round is
 *     staggered by half a repeat so the piece doesn't turn into a polygon.
 */
(function (root) {
  'use strict';
  const SS = root.SS = root.SS || {};

  const TERMS = {
    US: { sc: 'sc', inc: 'inc', dec: 'dec', mr: 'magic ring (MR)', ch: 'ch', slst: 'sl st', rnd: 'Rnd', rnds: 'Rnds', st: 'st', sts: 'sts', blo: 'BLO' },
    UK: { sc: 'dc', inc: 'inc', dec: 'dec', mr: 'magic ring (MR)', ch: 'ch', slst: 'ss', rnd: 'Rnd', rnds: 'Rnds', st: 'st', sts: 'sts', blo: 'BLO' }
  };
  const ABBREV = {
    US: [['MR', 'magic ring'], ['sc', 'single crochet'], ['inc', '2 sc in the same stitch'], ['dec', 'single crochet 2 together (invisible decrease recommended)'], ['ch', 'chain'], ['sl st', 'slip stitch'], ['BLO', 'back loop only'], ['(…) ×n', 'repeat the brackets n times'], ['(n)', 'stitch count at the end of the round']],
    UK: [['MR', 'magic ring'], ['dc', 'double crochet (US sc)'], ['inc', '2 dc in the same stitch'], ['dec', 'dc 2 together (invisible decrease recommended)'], ['ch', 'chain'], ['ss', 'slip stitch'], ['BLO', 'back loop only'], ['(…) ×n', 'repeat the brackets n times'], ['(n)', 'stitch count at the end of the round']]
  };

  const COLS = 96;   // samples around
  const FINE = 240;  // samples along the profile
  const UNIFORM = { frac: Float64Array.from({ length: COLS + 1 }, (_, i) => i / COLS) };

  function applyMatrix(m, x, y, z, out, k) {
    // column-major 4x4 (three.js Matrix4.elements)
    out[k] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }

  function partMatrix(part) {
    // Build T * R(XYZ euler) * S without three.js
    const [rx, ry, rz] = part.rotation, [sx, sy, sz] = part.scale, [px, py, pz] = part.position;
    const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
    const ae = a * e, af = a * f, be = b * e, bf = b * f;
    // three.js Euler XYZ rotation matrix
    const m11 = c * e, m12 = -c * f, m13 = d;
    const m21 = af + be * d, m22 = ae - bf * d, m23 = -b * c;
    const m31 = bf - ae * d, m32 = be + af * d, m33 = a * c;
    return [m11 * sx, m21 * sx, m31 * sx, 0, m12 * sy, m22 * sy, m32 * sy, 0, m13 * sz, m23 * sz, m33 * sz, 0, px, py, pz, 1];
  }

  /** Dense world-space grid + mean meridian length per fine row. */
  function sampleWorld(part) {
    const g = SS.buildGrid(part, COLS, FINE);
    const m = partMatrix(part);
    const n = (FINE + 1) * COLS;
    const w = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) applyMatrix(m, g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2], w, i * 3);
    const S = new Float64Array(FINE + 1);
    for (let j = 1; j <= FINE; j++) {
      let s = 0;
      for (let i = 0; i < COLS; i++) {
        const a = ((j - 1) * COLS + i) * 3, b = (j * COLS + i) * 3;
        s += Math.hypot(w[b] - w[a], w[b + 1] - w[a + 1], w[b + 2] - w[a + 2]);
      }
      S[j] = S[j - 1] + s / COLS;
    }
    return { w, S, length: S[FINE] };
  }

  /** v of each sharp profile point (arc-length fraction of the unscaled profile). */
  function sharpVs(part) {
    const pts = part.profile.points;
    const dense = SS.sampleProfile(part.profile, 32);
    const cum = [0];
    for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i].r - dense[i - 1].r, dense[i].z - dense[i - 1].z));
    const L = cum[cum.length - 1] || 1;
    const out = [];
    for (let p = 1; p < pts.length - 1; p++) {
      if (!pts[p].sharp) continue;
      let best = 0, bd = Infinity;
      dense.forEach((q, i) => { const d = Math.hypot(q.r - pts[p].r, q.z - pts[p].z); if (d < bd) { bd = d; best = i; } });
      out.push(cum[best] / L);
    }
    return out.sort((a, b) => a - b).filter((v, i, a) => v > 0.001 && v < 0.999 && (i === 0 || v - a[i - 1] > 0.001));
  }

  /** v at which the mean meridian length S reaches s. */
  function vAtLength(S, s) {
    if (s <= 0) return 0;
    if (s >= S[FINE]) return 1;
    let lo = 0, hi = FINE;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] < s) lo = mid; else hi = mid; }
    const t = (s - S[lo]) / ((S[hi] - S[lo]) || 1e-9);
    return (lo + t) / FINE;
  }
  function lengthAtV(S, v) {
    const x = v * FINE, j = Math.min(FINE - 1, Math.floor(x)), t = x - j;
    return S[j] + (S[j + 1] - S[j]) * t;
  }

  /** Ring of COLS world points at profile parameter v. */
  function ringAt(sw, v) {
    const x = Math.min(1, Math.max(0, v)) * FINE, j = Math.min(FINE - 1, Math.floor(x)), t = x - j;
    const pts = new Float64Array(COLS * 3);
    for (let i = 0; i < COLS; i++) {
      const a = (j * COLS + i) * 3, b = ((j + 1) * COLS + i) * 3;
      for (let c = 0; c < 3; c++) pts[i * 3 + c] = sw.w[a + c] + (sw.w[b + c] - sw.w[a + c]) * t;
    }
    // cumulative perimeter fraction, COLS+1 entries
    const cum = new Float64Array(COLS + 1);
    for (let i = 0; i < COLS; i++) {
      const a = i * 3, b = ((i + 1) % COLS) * 3;
      cum[i + 1] = cum[i] + Math.hypot(pts[b] - pts[a], pts[b + 1] - pts[a + 1], pts[b + 2] - pts[a + 2]);
    }
    const P = cum[COLS];
    const frac = new Float64Array(COLS + 1);
    for (let i = 0; i <= COLS; i++) frac[i] = P > 1e-6 ? cum[i] / P : i / COLS;
    return { v, pts, perimeter: P, frac };
  }

  // fraction -> column parameter (0..COLS) and back
  function fracToParam(frac, f) {
    let lo = 0, hi = COLS;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (frac[mid] < f) lo = mid; else hi = mid; }
    const d = frac[hi] - frac[lo];
    return lo + (d > 1e-12 ? (f - frac[lo]) / d : 0);
  }
  function paramToFrac(frac, p) {
    const i = Math.min(COLS - 1, Math.floor(p)), t = p - i;
    return frac[i] + (frac[i + 1] - frac[i]) * t;
  }

  /** Ops (sc / inc / dec) turning nPrev stitches on ring A into nNext on ring B. */
  function planOps(ringA, ringB, nPrev, nNext) {
    const T = new Float64Array(nPrev + 1);
    for (let i = 0; i <= nPrev; i++) {
      const p = fracToParam(ringA.frac, i / nPrev);
      T[i] = nNext * paramToFrac(ringB.frac, p);
    }
    T[nPrev] = nNext;
    const ops = [];
    let o = 0, i = 0;
    while (i < nPrev) {
      const eSc = Math.abs(T[i + 1] - (o + 1));
      const eInc = Math.abs(T[i + 1] - (o + 2)) + 1e-9;
      const eDec = i + 1 < nPrev ? Math.abs(T[i + 2] - (o + 1)) + 1e-9 : Infinity;
      if (eInc < eSc && eInc <= eDec) { ops.push('inc'); o += 2; i += 1; }
      else if (eDec < eSc) { ops.push('dec'); o += 1; i += 2; }
      else { ops.push('sc'); o += 1; i += 1; }
    }
    // exact-count fix-ups
    let guard = 0;
    while (o !== nNext && guard++ < 1000) {
      if (o < nNext) {
        let k = ops.indexOf('dec');
        if (k >= 0) { ops.splice(k, 1, 'sc', 'sc'); o += 1; continue; }
        k = pickSpread(ops, 'sc');
        if (k < 0) break;
        ops[k] = 'inc'; o += 1;
      } else {
        let k = ops.indexOf('inc');
        if (k >= 0) { ops[k] = 'sc'; o -= 1; continue; }
        k = -1;
        for (let a = 0; a < ops.length - 1; a++) if (ops[a] === 'sc' && ops[a + 1] === 'sc') { k = a; break; }
        if (k < 0) break;
        ops.splice(k, 2, 'dec'); o -= 1;
      }
    }
    return ops;
  }
  function pickSpread(ops, kind) {
    // the `kind` op furthest from any inc/dec
    let best = -1, bd = -1;
    for (let k = 0; k < ops.length; k++) {
      if (ops[k] !== kind) continue;
      let d = 0;
      while (d < ops.length && ops[(k + d) % ops.length] === 'sc' && ops[(k - d + ops.length) % ops.length] === 'sc') d++;
      if (d > bd) { bd = d; best = k; }
    }
    return best;
  }

  function period(ops) {
    const L = ops.length;
    for (let p = 1; p <= L / 2; p++) {
      if (L % p) continue;
      let ok = true;
      for (let k = p; k < L && ok; k++) if (ops[k] !== ops[k - p]) ok = false;
      if (ok) return p;
    }
    return L;
  }
  function rotate(ops, k) { k = ((k % ops.length) + ops.length) % ops.length; return ops.slice(k).concat(ops.slice(0, k)); }


  function pointOnRing(ring, p) {
    const i = Math.floor(p) % COLS, j = (i + 1) % COLS, t = p - Math.floor(p);
    return [0, 1, 2].map(c => ring.pts[i * 3 + c] + (ring.pts[j * 3 + c] - ring.pts[i * 3 + c]) * t);
  }
  /** World positions of every increase / decrease, for the 3D overlay. */
  function markers(res) {
    const out = [];
    let prevN = res.start.type === 'chain' ? res.start.n : 0;
    res.rounds.forEach(r => {
      if (r.ops && r.prevRing) {
        let c = 0;
        r.ops.forEach(op => {
          if (op === 'inc' || op === 'dec') {
            const f = op === 'inc' ? (c + 0.5) / prevN : (c + 1) / prevN;
            const p = fracToParam(r.prevRing.frac, f);
            out.push({ kind: op, p: pointOnRing(r.ring, p) });
          }
          c += op === 'dec' ? 2 : 1;
        });
      }
      prevN = r.n;
    });
    return out;
  }

  // ---------- text ----------
  function runs(ops, t) {
    const out = [];
    for (let k = 0; k < ops.length;) {
      let m = k;
      while (m < ops.length && ops[m] === ops[k]) m++;
      const n = m - k, name = t[ops[k]];
      out.push(n === 1 ? name : n + ' ' + name);
      k = m;
    }
    return out.join(', ');
  }
  function opsText(ops, t) {
    const L = ops.length;
    if (!L) return '';
    if (ops.every(o => o === 'sc')) return t.sc + ' in each ' + t.st;
    if (ops.every(o => o === 'inc')) return t.inc + ' ×' + L;
    if (ops.every(o => o === 'dec')) return t.dec + ' ×' + L;
    const p = period(ops);
    if (p < L) return '(' + runs(ops.slice(0, p), t) + ') ×' + (L / p);
    // best repeated block with a lead-in and tail
    let best = null;
    for (let p2 = 2; p2 <= L / 2; p2++) {
      for (let s = 0; s < p2 && s + 2 * p2 <= L; s++) {
        let r = 1;
        while (s + (r + 1) * p2 <= L) {
          let ok = true;
          for (let k = 0; k < p2 && ok; k++) if (ops[s + r * p2 + k] !== ops[s + k]) ok = false;
          if (!ok) break;
          r++;
        }
        const block = ops.slice(s, s + p2);
        if (r >= 2 && block.some(o => o !== 'sc') && (!best || r * p2 > best.r * best.p)) best = { s, p: p2, r };
      }
    }
    if (best && best.r * best.p >= L * 0.5) {
      const parts = [];
      if (best.s) parts.push(runs(ops.slice(0, best.s), t));
      parts.push('(' + runs(ops.slice(best.s, best.s + best.p), t) + ') ×' + best.r);
      const tail = ops.slice(best.s + best.r * best.p);
      if (tail.length) parts.push(runs(tail, t));
      return parts.join(', ');
    }
    return runs(ops, t);
  }

  // ---------- main ----------
  /**
   * gauge: {stitches, rows} per 10 cm in single crochet.
   * returns {part, startClosed, endClosed, start, rounds:[{n, ops, blo, note, ring}], finish, totalStitches, ...}
   */
  function generate(part, gauge, options) {
    const opt = options || {};
    const w = 10 / gauge.stitches, h = 10 / gauge.rows;
    const sw = sampleWorld(part);
    const L = sw.length;
    const startClosed = SS.isStartClosed(part), endClosed = SS.isEndClosed(part);

    // round boundaries in v, honouring sharp points
    const breaks = [0].concat(sharpVs(part), [1]);
    const vs = [0];
    const sharpAt = new Set();
    for (let b = 0; b < breaks.length - 1; b++) {
      const s0 = lengthAtV(sw.S, breaks[b]), s1 = lengthAtV(sw.S, breaks[b + 1]);
      const nSeg = Math.max(1, Math.round((s1 - s0) / h));
      for (let k = 1; k <= nSeg; k++) vs.push(vAtLength(sw.S, s0 + (s1 - s0) * k / nSeg));
      if (b < breaks.length - 2) sharpAt.add(vs.length - 1);
    }
    const rings = vs.map(v => ringAt(sw, v));
    const N = rings.length - 1;

    const rounds = [];
    let prev = 0;
    let start;
    if (startClosed) {
      const n1 = Math.min(10, Math.max(4, Math.round(rings[1].perimeter / w)));
      start = { type: 'mr', n: n1 };
      rounds.push({ n: n1, ops: null, ring: rings[1], first: true });
      prev = n1;
    } else {
      const n0 = Math.max(3, Math.round(rings[0].perimeter / w));
      start = { type: 'chain', n: n0 };
      prev = n0;
    }
    const firstK = startClosed ? 2 : 1;
    const lastK = endClosed ? N - 1 : N;
    for (let k = firstK; k <= lastK; k++) {
      const ring = rings[k];
      let target = Math.round(ring.perimeter / w);
      target = Math.max(3, Math.min(2 * prev, Math.max(Math.ceil(prev / 2), target)));
      if (opt.tidy !== false) {
        // crocheters expect even "+6 per round" style counts; snap when it's close
        const unit = start.type === 'mr' ? start.n : 6, delta = target - prev;
        if (Math.abs(delta) >= unit / 2) {
          const snapped = prev + Math.round(delta / unit) * unit;
          if (Math.abs(snapped - target) <= Math.max(2.5, target * 0.12) && snapped >= Math.ceil(prev / 2) && snapped <= 2 * prev) target = snapped;
        } else if (delta !== 0 && Math.abs(delta) / target <= 0.045) {
          target = prev; // a lone +1/-1 that the fabric will absorb
        }
      }
      let ops = planOps(rings[k - 1], ring, prev, target);
      const p = period(ops);
      if (p > 1 && p < ops.length && rounds.length % 2 === 1) ops = rotate(ops, Math.floor(p / 2));
      rounds.push({ n: target, ops, ring, prevRing: rings[k - 1], blo: sharpAt.has(k - 1) });
      prev = target;
    }
    // closed end: gather. Shrink first if the opening is still big.
    if (endClosed) {
      while (prev > 8) {
        const target = Math.ceil(prev / 2);
        rounds.push({ n: target, ops: planOps(UNIFORM, UNIFORM, prev, target), ring: rings[N], prevRing: rounds[rounds.length - 1].ring, extra: true });
        prev = target;
      }
      // stuffing reminder once the opening starts closing in
      let maxN = 0;
      rounds.forEach(r => { maxN = Math.max(maxN, r.n); });
      let si = -1;
      rounds.forEach((r, i) => { if (r.n >= maxN * 0.6) si = i; });
      if (rounds.length > 3 && si >= 0 && si < rounds.length - 1) rounds[si].stuff = true;
    }

    let total = start.type === 'chain' ? start.n : 0;
    rounds.forEach(r => { total += r.n; });
    return {
      partId: part.id, name: part.name, color: part.color,
      startClosed, endClosed, start, rounds,
      rings, length: L, totalStitches: total,
      yarnMeters: total * w * 5 / 100, // rough: ~5 stitch-widths of yarn per sc
      stitchWidth: w, rowHeight: h
    };
  }

  /** Text lines for a generated pattern: [{label, text, count, note}] */
  function toLines(res, terms) {
    const t = TERMS[terms] || TERMS.US;
    const lines = [];
    let rn = 0;
    if (res.start.type === 'chain') {
      lines.push({ label: 'Start', text: t.ch + ' ' + res.start.n + ', join with a ' + t.slst + ' into a ring (don’t twist the chain)', count: null });
    }
    res.rounds.forEach((r) => {
      rn += 1;
      let text;
      if (r.first) text = r.n + ' ' + t.sc + ' in ' + t.mr;
      else {
        text = opsText(r.ops, t);
        if (rn === 1 && res.start.type === 'chain' && r.ops.every(o => o === 'sc')) text = t.sc + ' in each ' + t.ch;
      }
      if (r.blo) text = 'in ' + t.blo + ': ' + text;
      lines.push({ label: t.rnd + ' ' + rn, from: rn, to: rn, text, count: r.n, stuff: r.stuff });
    });
    // merge identical consecutive rounds
    const merged = [];
    lines.forEach(l => {
      const last = merged[merged.length - 1];
      if (last && l.from && last.from && last.text === l.text && last.count === l.count && !last.stuff && !l.text.startsWith('in ' + t.blo)) {
        last.to = l.to; last.label = t.rnds + ' ' + last.from + '–' + last.to;
        last.note = (last.to - last.from + 1) + ' rnds';
        last.stuff = l.stuff;
      } else merged.push(Object.assign({}, l));
    });
    const out = [];
    merged.forEach(l => {
      out.push(l);
      if (l.stuff) out.push({ label: '', text: 'Start stuffing firmly; keep adding as you go.', count: null, isNote: true });
    });
    if (res.endClosed) out.push({ label: 'Finish', text: 'Fasten off. Weave the tail through the front loops of the last round, pull tight to close, and hide the end.', count: null });
    else out.push({ label: 'Finish', text: t.slst + ' to the next ' + t.st + ', fasten off, leaving a long tail for sewing.', count: null });
    return out;
  }

  function linesToText(lines) {
    return lines.map(l => {
      if (l.isNote) return '  * ' + l.text;
      return (l.label ? l.label + ': ' : '') + l.text + (l.count != null ? ' (' + l.count + ')' : '');
    }).join('\n');
  }

  // ---------- assembly ----------
  function sideWord(dx, dy, dz) {
    const len = Math.hypot(dx, dy, dz) || 1;
    const words = [];
    if (dy / len > 0.45) words.push('top'); else if (dy / len < -0.45) words.push('bottom');
    if (dz / len > 0.45) words.push('front'); else if (dz / len < -0.45) words.push('back');
    if (dx / len > 0.45) words.push('right side'); else if (dx / len < -0.45) words.push('left side');
    return words.length ? words.join(', ') : 'side';
  }

  /** results: generate() outputs for the visible parts, same order as parts. */
  function assembly(parts, results, terms) {
    const t = TERMS[terms] || TERMS.US;
    if (results.length < 2) return [];
    const info = results.map((r, idx) => {
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      r.rings.forEach(ring => { for (let i = 0; i < ring.pts.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], ring.pts[i + c]); mx[c] = Math.max(mx[c], ring.pts[i + c]); } });
      const size = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
      const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
      const centroid = ring => { const c = [0, 0, 0], n = ring.pts.length / 3; for (let i = 0; i < ring.pts.length; i += 3) for (let k = 0; k < 3; k++) c[k] += ring.pts[i + k] / n; return c; };
      const ends = [{ p: centroid(r.rings[0]), open: !r.startClosed, which: 'start' }, { p: centroid(r.rings[r.rings.length - 1]), open: !r.endClosed, which: 'end' }];
      return { idx, size, center, ends, res: r };
    });
    const rootIdx = info.reduce((a, b) => (b.size > a.size ? b : a)).idx;
    const notes = [];
    info.forEach(B => {
      if (B.idx === rootIdx) return;
      let best = null;
      info.forEach(A => {
        if (A.idx === B.idx || A.size < B.size * 0.6) return;
        A.res.rings.forEach((ring, k) => {
          for (let i = 0; i < ring.pts.length; i += 3) {
            B.ends.forEach(end => {
              const d = Math.hypot(ring.pts[i] - end.p[0], ring.pts[i + 1] - end.p[1], ring.pts[i + 2] - end.p[2]) - (end.open ? 0.75 : 0); // prefer sewing an open edge
              if (!best || d < best.d) best = { d, A, k, end, p: [ring.pts[i], ring.pts[i + 1], ring.pts[i + 2]] };
            });
          }
        });
      });
      if (!best || best.d > Math.max(1.5, B.size * 0.5)) {
        notes.push(B.res.name + ': not touching another part — place it by eye.');
        return;
      }
      const roundNo = Math.min(best.A.res.rounds.length, Math.max(1, best.k));
      const side = sideWord(best.p[0] - best.A.center[0], best.p[1] - best.A.center[1], best.p[2] - best.A.center[2]);
      const how = best.end.open ? 'Sew the open edge of ' : 'Sew the ' + (best.end.which === 'start' ? 'starting' : 'closed') + ' end of ';
      notes.push(how + B.res.name + ' to ' + best.A.res.name + ' around ' + t.rnd + ' ' + roundNo + ', on the ' + side + '.');
    });
    return notes;
  }

  /** A signature for spotting identical pieces ("make 2"). */
  function signature(res, terms) {
    return linesToText(toLines(res, terms)).replace(/\s+/g, ' ');
  }

  Object.assign(SS, { TERMS, ABBREV, generate, toLines, linesToText, opsText, planOps, assembly, signature, partMatrix, markers });
})(typeof window !== 'undefined' ? window : globalThis);
