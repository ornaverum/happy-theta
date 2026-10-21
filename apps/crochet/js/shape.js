/* Stitch Sculpt — shape model (no DOM, no three.js; also runs in Node for tests).
 *
 * A part is one crocheted piece. It is a surface of revolution around its local
 * Y axis, described by a profile (r, z) in cm, plus an optional sculpt
 * displacement grid that pushes the surface along its normal.
 *
 *   u in [0,1)  angle around the axis (u = theta / 2pi)
 *   v in [0,1]  arc length along the profile, start to end
 *
 * Local point: x = r cos(theta), y = z, z = r sin(theta)
 */
(function (root) {
  'use strict';
  const SS = root.SS = root.SS || {};
  const TAU = Math.PI * 2;
  const CLOSE_R = 0.12; // cm: an end point this close to the axis is treated as closed

  let idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    return (prefix || 'p') + Date.now().toString(36) + idCounter.toString(36);
  }

  // ---------- profile ----------
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  /** Dense polyline [{r,z}] through the control points. Points with sharp:true
   *  (and both ends) break the curve so corners stay crisp. */
  function sampleProfile(profile, perSpan) {
    const pts = profile.points;
    const n = perSpan || 24;
    if (pts.length < 2) return pts.map(p => ({ r: p.r, z: p.z }));
    // split into runs at sharp points
    const runs = [];
    let run = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      run.push(pts[i]);
      if (pts[i].sharp && i < pts.length - 1) { runs.push(run); run = [pts[i]]; }
    }
    runs.push(run);
    const out = [];
    const smooth = profile.smooth !== false;
    runs.forEach((rp, ri) => {
      for (let i = 0; i < rp.length - 1; i++) {
        const a = rp[Math.max(0, i - 1)], b = rp[i], c = rp[i + 1], d = rp[Math.min(rp.length - 1, i + 2)];
        // mirror the neighbour at run ends so the tangent there is sensible
        const a2 = i === 0 ? { r: 2 * b.r - c.r, z: 2 * b.z - c.z } : a;
        const d2 = i + 2 > rp.length - 1 ? { r: 2 * c.r - b.r, z: 2 * c.z - b.z } : d;
        const steps = (smooth && rp.length > 2) ? n : Math.max(2, Math.ceil(n / 3));
        for (let s = (ri === 0 && i === 0) ? 0 : 1; s <= steps; s++) {
          const t = s / steps;
          let r, z;
          if (smooth && rp.length > 2) {
            r = catmull(a2.r, b.r, c.r, d2.r, t);
            z = catmull(a2.z, b.z, c.z, d2.z, t);
          } else {
            r = b.r + (c.r - b.r) * t;
            z = b.z + (c.z - b.z) * t;
          }
          out.push({ r: Math.max(0, r), z });
        }
      }
    });
    return out;
  }

  /** Resample the profile at `count` points evenly spaced by arc length.
   *  Returns {r:Float64Array, z:Float64Array, nr, nz, length}. (nr,nz) is the
   *  outward normal in the r-z plane. */
  function resampleProfile(profile, count) {
    const dense = sampleProfile(profile, 32);
    const cum = [0];
    for (let i = 1; i < dense.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(dense[i].r - dense[i - 1].r, dense[i].z - dense[i - 1].z));
    }
    const L = cum[cum.length - 1] || 1e-9;
    const r = new Float64Array(count), z = new Float64Array(count);
    let k = 0;
    for (let j = 0; j < count; j++) {
      const s = (j / (count - 1)) * L;
      while (k < cum.length - 2 && cum[k + 1] < s) k++;
      const seg = cum[k + 1] - cum[k] || 1e-9;
      const t = Math.min(1, Math.max(0, (s - cum[k]) / seg));
      r[j] = dense[k].r + (dense[k + 1].r - dense[k].r) * t;
      z[j] = dense[k].z + (dense[k + 1].z - dense[k].z) * t;
    }
    const nr = new Float64Array(count), nz = new Float64Array(count);
    for (let j = 0; j < count; j++) {
      const a = Math.max(0, j - 1), b = Math.min(count - 1, j + 1);
      let tr = r[b] - r[a], tz = z[b] - z[a];
      const len = Math.hypot(tr, tz) || 1;
      tr /= len; tz /= len;
      nr[j] = tz; nz[j] = -tr; // rotate tangent clockwise: outward for a profile drawn bottom -> top
    }
    return { r, z, nr, nz, length: L };
  }

  function isStartClosed(part) { return part.profile.points[0].r <= CLOSE_R; }
  function isEndClosed(part) { const p = part.profile.points; return p[p.length - 1].r <= CLOSE_R; }

  // ---------- displacement ----------
  function makeDisp(cols, rows) {
    return { cols, rows, data: new Array(cols * (rows + 1)).fill(0) };
  }
  function dispAt(disp, u, v) {
    if (!disp) return 0;
    const { cols, rows, data } = disp;
    const x = ((u % 1) + 1) % 1 * cols, y = Math.min(1, Math.max(0, v)) * rows;
    const i0 = Math.floor(x) % cols, i1 = (i0 + 1) % cols, fx = x - Math.floor(x);
    const j0 = Math.min(rows, Math.floor(y)), j1 = Math.min(rows, j0 + 1), fy = y - Math.floor(y);
    const a = data[j0 * cols + i0], b = data[j0 * cols + i1], c = data[j1 * cols + i0], d = data[j1 * cols + i1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  /** Keep closed poles single points: every column of a pole row gets the row mean. */
  function fixPoles(part) {
    const d = part.disp;
    if (!d) return;
    const rowsToFix = [];
    if (isStartClosed(part)) rowsToFix.push(0);
    if (isEndClosed(part)) rowsToFix.push(d.rows);
    rowsToFix.forEach(j => {
      let s = 0;
      for (let i = 0; i < d.cols; i++) s += d.data[j * d.cols + i];
      s /= d.cols;
      for (let i = 0; i < d.cols; i++) d.data[j * d.cols + i] = s;
    });
  }

  /** Grid of local-space points: (rows+1) x cols, row-major, xyz interleaved.
   *  The seam is not duplicated. */
  function buildGrid(part, cols, rows) {
    const prof = resampleProfile(part.profile, rows + 1);
    const pos = new Float64Array((rows + 1) * cols * 3);
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      for (let i = 0; i < cols; i++) {
        const u = i / cols, th = u * TAU;
        const d = dispAt(part.disp, u, v);
        const r = Math.max(0, prof.r[j] + d * prof.nr[j]);
        const z = prof.z[j] + d * prof.nz[j];
        const k = (j * cols + i) * 3;
        pos[k] = r * Math.cos(th); pos[k + 1] = z; pos[k + 2] = r * Math.sin(th);
      }
    }
    return { cols, rows, pos, profile: prof };
  }

  // ---------- primitives ----------
  function arc(cx, cz, rad, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      out.push({ r: Math.max(0, cx + rad * Math.cos(a)), z: cz + rad * Math.sin(a) });
    }
    out[0].r = Math.abs(out[0].r) < 1e-6 ? 0 : out[0].r;
    out[out.length - 1].r = Math.abs(out[out.length - 1].r) < 1e-6 ? 0 : out[out.length - 1].r;
    return out;
  }
  const PRIMITIVES = {
    sphere: { label: 'Sphere', profile: () => arc(0, 3, 3, -Math.PI / 2, Math.PI / 2, 8) },
    egg: {
      label: 'Egg',
      profile: () => [{ r: 0, z: 0 }, { r: 1.7, z: 0.45 }, { r: 2.6, z: 1.6 }, { r: 2.75, z: 2.9 }, { r: 2.3, z: 4.3 }, { r: 1.35, z: 5.4 }, { r: 0, z: 5.9 }]
    },
    cylinder: {
      label: 'Cylinder',
      profile: () => [{ r: 0, z: 0 }, { r: 2, z: 0, sharp: true }, { r: 2, z: 5, sharp: true }, { r: 0, z: 5 }]
    },
    cone: {
      label: 'Cone',
      profile: () => [{ r: 0, z: 0 }, { r: 2.5, z: 0, sharp: true }, { r: 1.25, z: 2.5 }, { r: 0, z: 5 }]
    },
    capsule: {
      label: 'Capsule',
      profile: () => {
        const lo = arc(0, 2, 2, -Math.PI / 2, 0, 4), hi = arc(0, 5, 2, 0, Math.PI / 2, 4);
        lo[lo.length - 1].sharp = true; hi[0].sharp = true; // tangent points: keeps the side straight
        return lo.concat(hi);
      }
    },
    limb: {
      label: 'Limb',
      profile: () => arc(0, 1.2, 1.2, -Math.PI / 2, 0, 4).concat([{ r: 1.1, z: 3 }, { r: 1.1, z: 5 }])
    },
    disc: {
      label: 'Flat circle',
      profile: () => [{ r: 0, z: 0 }, { r: 1.5, z: 0 }, { r: 3, z: 0 }]
    },
    tube: {
      label: 'Open tube',
      profile: () => [{ r: 1.6, z: 0 }, { r: 1.6, z: 6 }]
    }
  };

  const PALETTE = ['#f2b8a2', '#9ccbd6', '#f6d589', '#b7d6a3', '#d7b4e0', '#f4a6b8', '#c9a27a', '#8fb8f0', '#f7f2e6', '#5c4b44'];

  function makePart(kind, opts) {
    const prim = PRIMITIVES[kind] || PRIMITIVES.sphere;
    const o = opts || {};
    return {
      id: uid('part'),
      name: o.name || prim.label,
      kind,
      color: o.color || PALETTE[Math.floor(Math.random() * 6)],
      visible: true,
      profile: { smooth: true, points: prim.profile() },
      disp: null,
      position: o.position || [0, 0, 0],
      rotation: o.rotation || [0, 0, 0], // radians, XYZ order
      scale: o.scale || [1, 1, 1],
      mirrored: false
    };
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function profileBounds(profile) {
    let rmax = 0, zmin = Infinity, zmax = -Infinity;
    profile.points.forEach(p => { rmax = Math.max(rmax, p.r); zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); });
    return { rmax, zmin, zmax };
  }

  Object.assign(SS, {
    TAU, CLOSE_R, uid, sampleProfile, resampleProfile, isStartClosed, isEndClosed,
    makeDisp, dispAt, fixPoles, buildGrid, PRIMITIVES, PALETTE, makePart, clone, profileBounds
  });
})(typeof window !== 'undefined' ? window : globalThis);
