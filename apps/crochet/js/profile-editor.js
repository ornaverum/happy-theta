/* Stitch Sculpt — 2D profile editor (one half of the part's side view). */
(function (root) {
  'use strict';
  const SS = root.SS;

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  class ProfileEditor {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts || {};
      this.part = null;
      this.sel = -1;
      this.drag = null;
      this.view = null;
      this.roundVs = [];
      canvas.tabIndex = 0;
      canvas.addEventListener('pointerdown', e => this.down(e));
      canvas.addEventListener('pointermove', e => this.move(e));
      canvas.addEventListener('pointerup', e => this.up(e));
      canvas.addEventListener('pointercancel', e => this.up(e));
      canvas.addEventListener('dblclick', e => this.dbl(e));
      canvas.addEventListener('keydown', e => this.key(e));
      new ResizeObserver(() => this.draw()).observe(canvas);
    }

    setPart(part, roundVs) {
      if (part !== this.part) { this.sel = -1; this.view = null; }
      this.part = part;
      this.roundVs = roundVs || [];
      if (!this.drag) this.fit();
      this.draw();
    }

    fit() {
      if (!this.part) return;
      const b = SS.profileBounds(this.part.profile);
      const span = Math.max(b.rmax * 1.25, (b.zmax - b.zmin) * 0.6, 2);
      // view: r from -span*0.35 (faint mirror) to span; z centred
      const zc = (b.zmin + b.zmax) / 2;
      const half = Math.max(span * 0.68, (b.zmax - b.zmin) * 0.62);
      this.view = { r0: -half * 0.55, r1: half * 1.45, z0: zc - half, z1: zc + half };
    }

    // world <-> canvas (CSS px)
    toPx(r, z) {
      const v = this.view, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      return [(r - v.r0) / (v.r1 - v.r0) * w, h - (z - v.z0) / (v.z1 - v.z0) * h];
    }
    toWorld(x, y) {
      const v = this.view, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      return [v.r0 + x / w * (v.r1 - v.r0), v.z0 + (h - y) / h * (v.z1 - v.z0)];
    }
    pxPerCm() { return this.canvas.clientWidth / (this.view.r1 - this.view.r0); }

    evtPos(e) { const rc = this.canvas.getBoundingClientRect(); return [e.clientX - rc.left, e.clientY - rc.top]; }

    hit(x, y) {
      const pts = this.part.profile.points;
      let best = -1, bd = 11;
      pts.forEach((p, i) => { const [px, py] = this.toPx(p.r, p.z); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } });
      return best;
    }

    down(e) {
      if (!this.part) return;
      this.canvas.focus();
      const [x, y] = this.evtPos(e);
      const i = this.hit(x, y);
      this.sel = i;
      if (i >= 0) {
        this.drag = { i, moved: false };
        this.canvas.setPointerCapture(e.pointerId);
      }
      this.draw();
    }
    move(e) {
      if (!this.part) return;
      const [x, y] = this.evtPos(e);
      if (!this.drag) { this.canvas.style.cursor = this.hit(x, y) >= 0 ? 'grab' : 'default'; return; }
      const pts = this.part.profile.points;
      const p = pts[this.drag.i];
      let [r, z] = this.toWorld(x, y);
      const isEnd = this.drag.i === 0 || this.drag.i === pts.length - 1;
      const snap = 8 / this.pxPerCm();
      if (e.shiftKey === false) { r = Math.round(r * 10) / 10; z = Math.round(z * 10) / 10; }
      if (isEnd) r = r < snap ? 0 : r;
      else r = Math.max(0.2, r);
      p.r = Math.max(0, r); p.z = z;
      this.drag.moved = true;
      this.draw();
      if (this.opts.onChange) this.opts.onChange(false);
    }
    up(e) {
      if (!this.drag) return;
      const moved = this.drag.moved;
      this.drag = null;
      try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
      if (moved) { this.fit(); this.draw(); if (this.opts.onChange) this.opts.onChange(true); }
    }
    dbl(e) {
      if (!this.part) return;
      const [x, y] = this.evtPos(e);
      const pts = this.part.profile.points;
      const i = this.hit(x, y);
      if (i > 0 && i < pts.length - 1) {
        pts[i].sharp = !pts[i].sharp;
        this.draw();
        if (this.opts.onChange) this.opts.onChange(true);
        return;
      }
      if (i >= 0) return;
      // insert on the nearest control-polygon segment
      let best = -1, bd = 18;
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = this.toPx(pts[k].r, pts[k].z), [bx, by] = this.toPx(pts[k + 1].r, pts[k + 1].z);
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
        const d = Math.hypot(ax + t * dx - x, ay + t * dy - y);
        if (d < bd) { bd = d; best = k; }
      }
      if (best < 0) return;
      const [r, z] = this.toWorld(x, y);
      pts.splice(best + 1, 0, { r: Math.max(0.2, Math.round(r * 10) / 10), z: Math.round(z * 10) / 10 });
      this.sel = best + 1;
      this.draw();
      if (this.opts.onChange) this.opts.onChange(true);
    }
    key(e) {
      if (!this.part || this.sel < 0) return;
      const pts = this.part.profile.points;
      if ((e.key === 'Delete' || e.key === 'Backspace') && pts.length > 2) {
        e.preventDefault(); e.stopPropagation();
        pts.splice(this.sel, 1);
        this.sel = -1;
        this.draw();
        if (this.opts.onChange) this.opts.onChange(true);
      }
    }

    draw() {
      const c = this.canvas, ctx = this.ctx;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!this.part || !this.view) return;
      const ink = css('--ink'), muted = css('--muted'), line = css('--line'), accent = css('--accent'), teal = css('--teal');
      const v = this.view;

      // 1 cm grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = line;
      ctx.beginPath();
      for (let r = Math.ceil(v.r0); r <= v.r1; r++) { const [x] = this.toPx(r, 0); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
      for (let z = Math.ceil(v.z0); z <= v.z1; z++) { const [, y] = this.toPx(0, z); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
      ctx.stroke();
      // axis
      ctx.strokeStyle = muted; ctx.setLineDash([4, 4]);
      ctx.beginPath(); const [ax] = this.toPx(0, 0); ctx.moveTo(ax + .5, 0); ctx.lineTo(ax + .5, h); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = muted; ctx.font = '11px ' + css('--font');
      ctx.fillText('centre line', ax + 4, h - 6);
      ctx.fillText('1 cm grid', w - 56, h - 6);

      const dense = SS.sampleProfile(this.part.profile, 24);
      // faint mirror + fill
      ctx.beginPath();
      dense.forEach((p, i) => { const [x, y] = this.toPx(-p.r, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      for (let i = dense.length - 1; i >= 0; i--) { const [x, y] = this.toPx(dense[i].r, dense[i].z); ctx.lineTo(x, y); }
      ctx.closePath();
      ctx.fillStyle = this.part.color + '55';
      ctx.fill();
      // curve
      ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
      ctx.beginPath();
      dense.forEach((p, i) => { const [x, y] = this.toPx(p.r, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();

      // round ticks
      if (this.roundVs.length) {
        const prof = SS.resampleProfile(this.part.profile, 241);
        ctx.strokeStyle = teal; ctx.lineWidth = 1.2;
        ctx.beginPath();
        this.roundVs.forEach(vv => {
          const j = Math.min(240, Math.round(vv * 240));
          const r = prof.r[j], z = prof.z[j], nr = prof.nr[j], nz = prof.nz[j];
          const [x1, y1] = this.toPx(r - nr * 0.15, z - nz * 0.15), [x2, y2] = this.toPx(r + nr * 0.3, z + nz * 0.3);
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        });
        ctx.stroke();
      }

      // control polygon + points
      const pts = this.part.profile.points;
      ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath();
      pts.forEach((p, i) => { const [x, y] = this.toPx(p.r, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
      pts.forEach((p, i) => {
        const [x, y] = this.toPx(p.r, p.z);
        ctx.beginPath();
        if (p.sharp) ctx.rect(x - 5, y - 5, 10, 10); else ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = i === this.sel ? accent : css('--panel');
        ctx.strokeStyle = i === this.sel ? accent : ink; ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
      });
      // start / end labels
      const first = pts[0], last = pts[pts.length - 1];
      ctx.fillStyle = muted;
      const [sx, sy] = this.toPx(first.r, first.z), [ex, ey] = this.toPx(last.r, last.z);
      ctx.fillText('start', sx + 9, sy + 14);
      ctx.fillText('end', ex + 9, ey - 6);
    }
  }

  SS.ProfileEditor = ProfileEditor;
})(window);
