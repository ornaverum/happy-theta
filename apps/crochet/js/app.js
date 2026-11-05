/* Stitch Sculpt — app controller: state, undo, UI wiring, sculpting, pattern view. */
(function () {
  'use strict';
  const SS = window.SS;
  const $ = id => document.getElementById(id);
  const STORE_KEY = 'stitchsculpt.autosave.v1';

  // ---------- state ----------
  const state = {
    parts: [],
    selectedId: null,
    settings: { gauge: { stitches: 20, rows: 22 }, terms: 'US', tidy: true },
    mode: 'translate',
    brush: { kind: 'inflate', size: 1.2, strength: 0.4, mirror: true },
    ref: { img: null, src: null, height: 15, opacity: 0.6 },
    results: [] // generated patterns, same order as visible parts
  };
  const history = { stack: [], index: -1 };

  function selected() { return state.parts.find(p => p.id === state.selectedId) || null; }

  function serialize(withRef) {
    const doc = { format: 'stitch-sculpt', version: 1, settings: state.settings, parts: state.parts };
    if (withRef && state.ref.src) doc.reference = { src: state.ref.src, height: state.ref.height, opacity: state.ref.opacity };
    return JSON.stringify(doc);
  }
  function load(doc) {
    if (!doc || doc.format !== 'stitch-sculpt' || !Array.isArray(doc.parts)) throw new Error('Not a Stitch Sculpt file');
    state.parts = doc.parts.map(normalizePart);
    state.settings = Object.assign({ gauge: { stitches: 20, rows: 22 }, terms: 'US', tidy: true }, doc.settings || {});
    state.selectedId = state.parts[0] ? state.parts[0].id : null;
    if (doc.reference && doc.reference.src) setReferenceSrc(doc.reference.src, doc.reference.height, doc.reference.opacity);
  }
  function normalizePart(p) {
    const d = SS.makePart(p.kind || 'sphere');
    const q = Object.assign(d, p);
    if (q.disp && (q.disp.cols !== SS.MESH_COLS || q.disp.rows !== SS.MESH_ROWS)) q.disp = null; // older grids
    return q;
  }

  // ---------- undo ----------
  function commit(label) {
    const snap = JSON.stringify({ parts: state.parts, selectedId: state.selectedId, settings: state.settings });
    if (history.stack[history.index] === snap) return;
    history.stack.length = history.index + 1;
    history.stack.push(snap);
    if (history.stack.length > 80) history.stack.shift();
    history.index = history.stack.length - 1;
    autosave();
    updateUndoButtons();
    schedulePattern();
  }
  function restore(i) {
    const s = JSON.parse(history.stack[i]);
    state.parts = s.parts; state.selectedId = s.selectedId; state.settings = s.settings;
    history.index = i;
    refreshAll();
    autosave();
  }
  function undo() { if (history.index > 0) restore(history.index - 1); }
  function redo() { if (history.index < history.stack.length - 1) restore(history.index + 1); }
  function updateUndoButtons() {
    $('undoBtn').disabled = history.index <= 0;
    $('redoBtn').disabled = history.index >= history.stack.length - 1;
  }
  function autosave() {
    try { localStorage.setItem(STORE_KEY, serialize(false)); } catch (e) { /* storage unavailable: fine */ }
  }

  // ---------- viewport ----------
  const vp = new SS.Viewport($('viewport'), {
    onPick(id) { selectPart(id); },
    onTransform(id, pos, rot, scl) {
      const p = state.parts.find(x => x.id === id);
      if (!p) return;
      p.position = [round3(pos.x), round3(pos.y), round3(pos.z)];
      p.rotation = [rot.x, rot.y, rot.z];
      p.scale = [round3(scl.x), round3(scl.y), round3(scl.z)];
      updatePlacementFields();
    },
    onTransformEnd() { commit('transform'); },
    onSculpt(id, local, uv, o) { sculptAt(id, local, o); },
    onSculptEnd() { const p = selected(); if (p) SS.fixPoles(p); commit('sculpt'); }
  });
  function round3(x) { return Math.round(x * 1000) / 1000; }

  // ---------- profile editor ----------
  const pe = new SS.ProfileEditor($('profileCanvas'), {
    onChange(final) {
      const p = selected();
      if (!p) return;
      vp.refreshPart(p);
      updateEndButtons();
      if (final) { commit('profile'); }
    }
  });

  // ---------- parts ----------
  function addPart(kind) {
    const p = SS.makePart(kind);
    // place to the right of what's there so it doesn't hide inside another part
    let maxX = -Infinity;
    state.parts.forEach(q => { const b = SS.profileBounds(q.profile); maxX = Math.max(maxX, q.position[0] + b.rmax * Math.abs(q.scale[0])); });
    if (state.parts.length) p.position = [round3(maxX + SS.profileBounds(p.profile).rmax + 1), 0, 0];
    p.color = SS.PALETTE[state.parts.length % SS.PALETTE.length];
    p.name = uniqueName(p.name);
    state.parts.push(p);
    state.selectedId = p.id;
    refreshAll();
    commit('add');
  }
  function uniqueName(base) {
    const names = new Set(state.parts.map(p => p.name));
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) if (!names.has(base + ' ' + i)) return base + ' ' + i;
  }
  function selectPart(id) {
    state.selectedId = id;
    refreshSelection();
  }
  function deletePart() {
    const p = selected();
    if (!p) return;
    const i = state.parts.indexOf(p);
    state.parts.splice(i, 1);
    state.selectedId = state.parts[Math.min(i, state.parts.length - 1)] ? state.parts[Math.min(i, state.parts.length - 1)].id : null;
    refreshAll();
    commit('delete');
  }
  function duplicatePart(mirror) {
    const p = selected();
    if (!p) return;
    const q = SS.clone(p);
    q.id = SS.uid('part');
    if (mirror) {
      q.position = [-p.position[0], p.position[1], p.position[2]];
      q.rotation = [p.rotation[0], -p.rotation[1], -p.rotation[2]];
      if (q.disp) q.disp = mirrorDispX(q.disp);
      if (Math.abs(p.position[0]) < 0.01) q.position[0] = round3(p.position[0] + 2 * SS.profileBounds(p.profile).rmax + 0.5);
      q.name = uniqueName(p.name.replace(/ (L|R)$/, '') + (p.position[0] < 0 ? ' R' : ' L'));
      if (!/ (L|R)$/.test(p.name)) p.name = uniqueName(p.name + (p.position[0] < 0 ? ' L' : ' R'));
    } else {
      q.position = [round3(p.position[0] + 1), p.position[1], round3(p.position[2] + 1)];
      q.name = uniqueName(p.name);
    }
    state.parts.push(q);
    state.selectedId = q.id;
    refreshAll();
    commit('duplicate');
  }
  /** x -> -x in the part's own frame: theta -> pi - theta */
  function mirrorDispX(d) {
    const out = SS.makeDisp(d.cols, d.rows);
    for (let j = 0; j <= d.rows; j++) for (let i = 0; i < d.cols; i++) {
      const mi = ((d.cols / 2 - i) % d.cols + d.cols) % d.cols;
      out.data[j * d.cols + mi] = d.data[j * d.cols + i];
    }
    return out;
  }

  // ---------- sculpting ----------
  let strokeGrid = null;
  function sculptAt(id, local, o) {
    const p = state.parts.find(x => x.id === id);
    if (!p) return;
    if (!p.disp) p.disp = SS.makeDisp(SS.MESH_COLS, SS.MESH_ROWS);
    const d = p.disp, cols = d.cols, rows = d.rows;
    if (o.first || !strokeGrid || strokeGrid.id !== id) strokeGrid = { id, g: SS.buildGrid(p, cols, rows) };
    const g = strokeGrid.g;
    const avgScale = (Math.abs(p.scale[0]) + Math.abs(p.scale[1]) + Math.abs(p.scale[2])) / 3 || 1;
    const R = state.brush.size / avgScale;
    const s = state.brush.strength;
    let kind = state.brush.kind;
    if (o.invert && kind === 'inflate') kind = 'deflate'; else if (o.invert && kind === 'deflate') kind = 'inflate';
    const centers = [[local.x, local.y, local.z]];
    if (state.brush.mirror) centers.push([-local.x, local.y, local.z]);
    const src = d.data.slice();
    centers.forEach(c => {
      // affected vertices + weights
      const hits = [];
      let mean = 0, wsum = 0;
      for (let j = 0; j <= rows; j++) for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 3;
        const dist = Math.hypot(g.pos[k] - c[0], g.pos[k + 1] - c[1], g.pos[k + 2] - c[2]);
        if (dist >= R) continue;
        const t = dist / R, f = (1 - t * t) * (1 - t * t);
        hits.push([j * cols + i, f, i, j]);
        mean += src[j * cols + i] * f; wsum += f;
      }
      mean = wsum ? mean / wsum : 0;
      hits.forEach(([k, f, i, j]) => {
        let v = d.data[k];
        if (kind === 'inflate') v += 0.06 * s * f * R;
        else if (kind === 'deflate') v -= 0.06 * s * f * R;
        else if (kind === 'smooth' || kind === 'flatten') {
          let target;
          if (kind === 'smooth') {
            const l = src[j * cols + (i + cols - 1) % cols], r = src[j * cols + (i + 1) % cols];
            const u = src[Math.min(rows, j + 1) * cols + i], dn = src[Math.max(0, j - 1) * cols + i];
            target = (l + r + u + dn) / 4;
          } else target = mean;
          v += (target - v) * Math.min(1, f * s * 0.8);
        }
        d.data[k] = Math.max(-4, Math.min(4, v));
      });
    });
    SS.fixPoles(p);
    vp.refreshPart(p);
  }

  // ---------- pattern ----------
  let patTimer = 0;
  function schedulePattern() { clearTimeout(patTimer); patTimer = setTimeout(runPattern, 90); }
  function runPattern() {
    const visible = state.parts.filter(p => p.visible !== false);
    state.results = visible.map(p => {
      try { return SS.generate(p, state.settings.gauge, { tidy: state.settings.tidy }); }
      catch (e) { console.error(e); return null; }
    }).filter(Boolean);
    vp.setRounds(state.results);
    renderPattern();
    refreshShapePanel(true);
  }
  function resultFor(id) { return state.results.find(r => r.partId === id) || null; }

  function renderPattern() {
    const out = $('patternOut');
    out.innerHTML = '';
    const t = state.settings.terms;
    if (!state.results.length) { out.innerHTML = '<p class="empty">Add a shape to see its pattern.</p>'; return; }
    const g = state.settings.gauge;
    // group identical pieces
    const groups = [];
    state.results.forEach(r => {
      const sig = SS.signature(r, t);
      const hit = groups.find(gr => gr.sig === sig);
      if (hit) hit.items.push(r); else groups.push({ sig, items: [r] });
    });
    let total = 0, yarn = 0;
    state.results.forEach(r => { total += r.totalStitches; yarn += r.yarnMeters; });

    const head = document.createElement('div');
    head.className = 'card';
    head.innerHTML = '<p class="meta">Gauge ' + g.stitches + ' sts × ' + g.rows + ' rnds = 10 cm in ' + (t === 'UK' ? 'dc' : 'sc') +
      ' · ' + (t === 'UK' ? 'UK' : 'US') + ' terms · worked in continuous spiral rounds (move a stitch marker up each round)</p>' +
      '<p class="meta">About ' + total.toLocaleString() + ' stitches in all · roughly ' + Math.ceil(yarn) + ' m of yarn (rough guess; buy extra)</p>';
    const ab = document.createElement('ul');
    ab.className = 'abbr';
    SS.ABBREV[t].forEach(([k, v]) => { const li = document.createElement('li'); li.innerHTML = '<b>' + esc(k) + '</b> ' + esc(v); ab.appendChild(li); });
    const det = document.createElement('details');
    det.innerHTML = '<summary>Abbreviations</summary>';
    det.appendChild(ab);
    head.appendChild(det);
    out.appendChild(head);

    groups.forEach(gr => {
      const r = gr.items[0];
      const sec = document.createElement('section');
      const names = gr.items.map(x => x.name).join(', ');
      const h = document.createElement('h4');
      h.innerHTML = '<span class="sw" style="background:' + esc(r.color) + '"></span>' + esc(gr.items.length > 1 ? names + ' — make ' + gr.items.length : r.name);
      sec.appendChild(h);
      const maxN = Math.max.apply(null, r.rounds.map(x => x.n));
      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = r.rounds.length + ' rounds · widest ' + maxN + ' sts · ' + (r.startClosed ? 'starts with a magic ring' : 'starts from a chain ring') + ' · ' + (r.endClosed ? 'closed end' : 'open end');
      sec.appendChild(meta);
      const ol = document.createElement('ol');
      SS.toLines(r, t).forEach(l => {
        const li = document.createElement('li');
        if (l.isNote) { li.className = 'note'; li.textContent = l.text; }
        else {
          li.innerHTML = '<span class="lab">' + esc(l.label) + '</span><span>' + esc(l.text) + '</span><span class="cnt">' + (l.count != null ? '(' + l.count + ')' : '') + '</span>';
          if (l.from) {
            const idx = []; for (let k = l.from; k <= l.to; k++) idx.push(k - 1);
            li.addEventListener('mouseenter', () => { li.classList.add('hl'); vp.highlight(r, idx); });
            li.addEventListener('mouseleave', () => { li.classList.remove('hl'); vp.highlight(null); });
          }
        }
        ol.appendChild(li);
      });
      sec.appendChild(ol);
      if (r.rounds.some(x => x.n > 2 * 6 && x.extra)) {
        const w = document.createElement('p'); w.className = 'warn';
        w.textContent = 'The end is still wide when it closes — consider making the profile meet the centre line more gradually.';
        sec.appendChild(w);
      }
      out.appendChild(sec);
    });

    const notes = SS.assembly(state.parts.filter(p => p.visible !== false), state.results, t);
    if (notes.length) {
      const sec = document.createElement('section');
      sec.innerHTML = '<h4>Assembly</h4>';
      const ol = document.createElement('ol');
      notes.forEach(n => { const li = document.createElement('li'); li.style.gridTemplateColumns = '1fr'; li.textContent = n; ol.appendChild(li); });
      sec.appendChild(ol);
      out.appendChild(sec);
    }
  }
  function patternText() {
    const t = state.settings.terms, g = state.settings.gauge;
    const lines = ['Stitch Sculpt pattern', 'Gauge: ' + g.stitches + ' sts x ' + g.rows + ' rnds = 10 cm (' + (t === 'UK' ? 'UK dc' : 'US sc') + ')', 'Worked in continuous spiral rounds.', ''];
    lines.push('Abbreviations:');
    SS.ABBREV[t].forEach(([k, v]) => lines.push('  ' + k + ' = ' + v));
    const seen = new Map();
    state.results.forEach(r => { const s = SS.signature(r, t); if (!seen.has(s)) seen.set(s, []); seen.get(s).push(r); });
    for (const [, items] of seen) {
      lines.push('', items.map(x => x.name).join(', ').toUpperCase() + (items.length > 1 ? ' (make ' + items.length + ')' : ''));
      lines.push(SS.linesToText(SS.toLines(items[0], t)));
    }
    const notes = SS.assembly(state.parts.filter(p => p.visible !== false), state.results, t);
    if (notes.length) { lines.push('', 'ASSEMBLY'); notes.forEach(n => lines.push('- ' + n)); }
    return lines.join('\n');
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- UI refresh ----------
  function refreshAll() {
    vp.syncParts(state.parts, state.selectedId);
    renderPartList();
    refreshShapePanel();
    syncSettingsUI();
    updateUndoButtons();
    schedulePattern();
  }
  function refreshSelection() {
    vp.select(state.selectedId);
    renderPartList();
    refreshShapePanel();
  }
  function renderPartList() {
    const ul = $('partList');
    ul.innerHTML = '';
    state.parts.forEach(p => {
      const li = document.createElement('li');
      li.className = p.id === state.selectedId ? 'sel' : '';
      li.innerHTML = '<span class="sw"></span><span class="nm"></span><button type="button" class="eye" title="Show/hide">👁</button>';
      li.querySelector('.sw').style.background = p.color;
      li.querySelector('.nm').textContent = p.name;
      const eye = li.querySelector('.eye');
      eye.setAttribute('aria-pressed', String(p.visible !== false));
      eye.setAttribute('aria-label', (p.visible !== false ? 'Hide ' : 'Show ') + p.name);
      eye.addEventListener('click', e => { e.stopPropagation(); p.visible = p.visible === false; refreshAll(); commit('visibility'); });
      li.addEventListener('click', () => selectPart(p.id));
      li.addEventListener('dblclick', () => vp.frame([p.id]));
      ul.appendChild(li);
    });
    const has = !!selected();
    ['dupBtn', 'mirrorBtn', 'delBtn'].forEach(id => { $(id).disabled = !has; });
  }
  function refreshShapePanel(patternOnly) {
    const p = selected();
    $('noSelection').hidden = !!p;
    $('shapeEditor').hidden = !p;
    $('sculptSection').hidden = !p || state.mode !== 'sculpt';
    if (!p) return;
    const res = resultFor(p.id);
    pe.setPart(p, res ? res.rounds.map(r => r.ring.v) : []);
    if (res) {
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      res.rings.forEach(ring => { for (let i = 0; i < ring.pts.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], ring.pts[i + c]); mx[c] = Math.max(mx[c], ring.pts[i + c]); } });
      $('partDims').textContent = 'About ' + (mx[0] - mn[0]).toFixed(1) + ' × ' + (mx[1] - mn[1]).toFixed(1) + ' × ' + (mx[2] - mn[2]).toFixed(1) + ' cm (w × h × d) · ' + res.rounds.length + ' rounds';
    }
    if (patternOnly) return;
    $('partName').value = p.name;
    $('partColor').value = p.color;
    $('profileSmooth').checked = p.profile.smooth !== false;
    updateEndButtons();
    updatePlacementFields();
  }
  function updateEndButtons() {
    const p = selected();
    if (!p) return;
    $('toggleStart').textContent = 'Start: ' + (SS.isStartClosed(p) ? 'closed' : 'open');
    $('toggleEnd').textContent = 'End: ' + (SS.isEndClosed(p) ? 'closed' : 'open');
  }

  // placement fields
  const xyz = { pos: [], rot: [], scl: [] };
  function buildXYZ(rowId, key, step) {
    const row = $(rowId);
    ['x', 'y', 'z'].forEach((axis, i) => {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.step = step; inp.setAttribute('aria-label', row.firstElementChild.textContent + ' ' + axis);
      inp.addEventListener('change', () => {
        const p = selected();
        if (!p) return;
        let v = parseFloat(inp.value);
        if (!isFinite(v)) return;
        if (key === 'rot') p.rotation[i] = v * Math.PI / 180;
        else if (key === 'scl') p.scale[i] = Math.abs(v) < 0.05 ? 0.05 * Math.sign(v || 1) : v;
        else p.position[i] = v;
        vp.syncParts(state.parts, state.selectedId);
        commit('placement');
      });
      row.appendChild(inp);
      xyz[key].push(inp);
    });
  }
  buildXYZ('xyzPos', 'pos', '0.1');
  buildXYZ('xyzRot', 'rot', '5');
  buildXYZ('xyzScale', 'scl', '0.05');
  function updatePlacementFields() {
    const p = selected();
    if (!p) return;
    for (let i = 0; i < 3; i++) {
      if (document.activeElement !== xyz.pos[i]) xyz.pos[i].value = (+p.position[i]).toFixed(2);
      if (document.activeElement !== xyz.rot[i]) xyz.rot[i].value = Math.round(p.rotation[i] * 180 / Math.PI);
      if (document.activeElement !== xyz.scl[i]) xyz.scl[i].value = (+p.scale[i]).toFixed(2);
    }
  }

  // ---------- wiring ----------
  const ICONS = {
    sphere: '<circle cx="13" cy="13" r="9"/>',
    egg: '<path d="M13 3c5 0 8 7 8 12a8 8 0 0 1-16 0c0-5 3-12 8-12z"/>',
    cylinder: '<ellipse cx="13" cy="6" rx="7" ry="2.5"/><path d="M6 6v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>',
    cone: '<path d="M13 3 20 20c0 1.4-3.1 2.5-7 2.5S6 21.4 6 20z"/>',
    capsule: '<rect x="7" y="2.5" width="12" height="21" rx="6"/>',
    limb: '<path d="M8.5 3v13a4.5 4.5 0 0 0 9 0V3"/>',
    disc: '<ellipse cx="13" cy="14" rx="9.5" ry="4"/>',
    tube: '<ellipse cx="13" cy="5" rx="6" ry="2"/><path d="M7 5v16c0 1.1 2.7 2 6 2s6-.9 6-2V5"/><ellipse cx="13" cy="21" rx="6" ry="2" stroke-dasharray="2 2"/>'
  };
  Object.keys(SS.PRIMITIVES).forEach(kind => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'add-btn'; b.title = 'Add ' + SS.PRIMITIVES[kind].label.toLowerCase();
    b.innerHTML = '<svg viewBox="0 0 26 26" fill="var(--accent-soft)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' + ICONS[kind] + '</svg>' + SS.PRIMITIVES[kind].label.replace('Flat circle', 'Circle').replace('Open tube', 'Tube');
    b.addEventListener('click', () => addPart(kind));
    $('addButtons').appendChild(b);
  });

  function setMode(mode) {
    state.mode = mode;
    vp.setMode(mode);
    document.querySelectorAll('#modeButtons button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('vpHint').textContent = mode === 'sculpt'
      ? 'Drag on a part to sculpt · Shift inverts · Alt-drag or right-drag to orbit · scroll to zoom'
      : 'Drag to orbit · right-drag to pan · scroll to zoom · click a part to select';
    refreshShapePanel();
    if (mode === 'sculpt') switchTab('shape');
  }
  document.querySelectorAll('#modeButtons button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  document.querySelectorAll('#brushButtons button').forEach(b => b.addEventListener('click', () => {
    state.brush.kind = b.dataset.brush;
    document.querySelectorAll('#brushButtons button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  function syncRange(id, valId, fmt, apply) {
    const el = $(id), out = $(valId);
    const f = () => { out.textContent = fmt(+el.value); apply(+el.value); };
    el.addEventListener('input', f); f();
  }
  syncRange('brushSize', 'brushSizeVal', v => v.toFixed(1) + ' cm', v => { state.brush.size = v; vp.brushRadius = v; });
  syncRange('brushStrength', 'brushStrengthVal', v => Math.round(v * 100) + '%', v => { state.brush.strength = v; });
  $('brushMirror').addEventListener('change', e => { state.brush.mirror = e.target.checked; });
  $('clearSculpt').addEventListener('click', () => { const p = selected(); if (p && p.disp) { p.disp = null; vp.refreshPart(p); commit('clear sculpt'); } });

  $('partName').addEventListener('input', e => { const p = selected(); if (p) { p.name = e.target.value || 'Part'; renderPartList(); } });
  $('partName').addEventListener('change', () => commit('rename'));
  $('partColor').addEventListener('input', e => { const p = selected(); if (p) { p.color = e.target.value; vp.syncParts(state.parts, state.selectedId); renderPartList(); pe.draw(); } });
  $('partColor').addEventListener('change', () => commit('color'));
  $('profileSmooth').addEventListener('change', e => { const p = selected(); if (p) { p.profile.smooth = e.target.checked; vp.refreshPart(p); pe.draw(); commit('smooth'); } });
  $('toggleStart').addEventListener('click', () => toggleEnd(0));
  $('toggleEnd').addEventListener('click', () => toggleEnd(-1));
  function toggleEnd(which) {
    const p = selected();
    if (!p) return;
    const pts = p.profile.points;
    const i = which === 0 ? 0 : pts.length - 1, nb = which === 0 ? 1 : pts.length - 2;
    if (pts[i].r <= SS.CLOSE_R) pts[i].r = Math.max(0.5, Math.round(pts[nb].r * 0.9 * 10) / 10);
    else pts[i].r = 0;
    if (p.disp) SS.fixPoles(p);
    vp.refreshPart(p);
    refreshShapePanel();
    commit('toggle end');
  }

  $('dupBtn').addEventListener('click', () => duplicatePart(false));
  $('mirrorBtn').addEventListener('click', () => duplicatePart(true));
  $('delBtn').addEventListener('click', deletePart);
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('showRounds').addEventListener('change', e => { vp.showRounds = e.target.checked; vp.setRounds(state.results); $('legend').hidden = !e.target.checked; });
  $('showGrid').addEventListener('change', e => { vp.grid.visible = e.target.checked; });
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => (b.dataset.view === 'frame' ? vp.frame() : vp.view(b.dataset.view))));

  // tabs
  function switchTab(name) {
    ['shape', 'pattern', 'settings'].forEach(n => {
      $('tab-' + n).setAttribute('aria-selected', String(n === name));
      $('pane-' + n).hidden = n !== name;
    });
    if (name === 'shape') pe.draw();
  }
  ['shape', 'pattern', 'settings'].forEach(n => $('tab-' + n).addEventListener('click', () => switchTab(n)));

  // settings
  function syncSettingsUI() {
    $('gaugeSts').value = state.settings.gauge.stitches;
    $('gaugeRows').value = state.settings.gauge.rows;
    $('tidyCounts').checked = state.settings.tidy !== false;
    document.querySelectorAll('#termButtons button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.terms === state.settings.terms)));
  }
  function setGauge(sts, rows) {
    const s = Math.min(60, Math.max(4, sts)), r = Math.min(60, Math.max(4, rows));
    if (!isFinite(s) || !isFinite(r)) return;
    state.settings.gauge = { stitches: s, rows: r };
    syncSettingsUI();
    commit('gauge');
  }
  $('gaugeSts').addEventListener('change', () => setGauge(+$('gaugeSts').value, state.settings.gauge.rows));
  $('gaugeRows').addEventListener('change', () => setGauge(state.settings.gauge.stitches, +$('gaugeRows').value));
  $('yarnPreset').addEventListener('change', e => { if (e.target.value) { const [a, b] = e.target.value.split(',').map(Number); setGauge(a, b); } e.target.value = ''; });
  $('tidyCounts').addEventListener('change', e => { state.settings.tidy = e.target.checked; commit('tidy'); });
  document.querySelectorAll('#termButtons button').forEach(b => b.addEventListener('click', () => { state.settings.terms = b.dataset.terms; syncSettingsUI(); commit('terms'); }));

  // reference image
  function setReferenceSrc(src, height, opacity) {
    const img = new Image();
    img.onload = () => {
      state.ref = { img, src, height: height || state.ref.height, opacity: opacity || state.ref.opacity };
      $('refSize').value = state.ref.height; $('refOpacity').value = state.ref.opacity;
      $('refSize').dispatchEvent(new Event('input')); $('refOpacity').dispatchEvent(new Event('input'));
      vp.setReference(img, state.ref.height, state.ref.opacity);
      vp.view('front');
    };
    img.src = src;
  }
  $('refLoad').addEventListener('click', () => $('refFile').click());
  $('refFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setReferenceSrc(rd.result);
    rd.readAsDataURL(f);
    e.target.value = '';
  });
  $('refClear').addEventListener('click', () => { state.ref.img = null; state.ref.src = null; vp.setReference(null); });
  syncRange('refSize', 'refSizeVal', v => v + ' cm', v => { state.ref.height = v; vp.updateReference(state.ref.height, state.ref.opacity); });
  syncRange('refOpacity', 'refOpacityVal', v => Math.round(v * 100) + '%', v => { state.ref.opacity = v; vp.updateReference(state.ref.height, state.ref.opacity); });

  // files
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function fileBase() { const p = state.parts[0]; return (p ? p.name : 'pattern').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pattern'; }
  $('saveBtn').addEventListener('click', () => { download(fileBase() + '.stitch.json', serialize(true), 'application/json'); toast('Saved ' + fileBase() + '.stitch.json'); });
  $('openBtn').addEventListener('click', () => $('openFile').click());
  $('openFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(txt => {
      try { load(JSON.parse(txt)); refreshAll(); commit('open'); vp.frame(); toast('Opened ' + f.name); }
      catch (err) { toast('Couldn’t open that file: ' + err.message); }
    });
    e.target.value = '';
  });
  $('newBtn').addEventListener('click', () => {
    if (state.parts.length && !confirmNew()) return;
    state.parts = []; state.selectedId = null;
    refreshAll(); commit('new');
  });
  function confirmNew() { return window.confirm('Start a new project? Unsaved changes are kept in Undo.'); }
  $('copyPattern').addEventListener('click', () => {
    const text = patternText();
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Pattern copied'), () => { download(fileBase() + '-pattern.txt', text, 'text/plain'); });
  });
  $('downloadPattern').addEventListener('click', () => download(fileBase() + '-pattern.txt', patternText(), 'text/plain'));
  $('printPattern').addEventListener('click', () => {
    const pa = $('printArea');
    const img = vp.snapshot();
    pa.innerHTML = '<h1>' + esc(state.parts.length ? state.parts.map(p => p.name).slice(0, 3).join(', ') : 'Pattern') + '</h1><img src="' + img + '" style="max-width:60%;max-height:8cm;display:block;margin:6pt 0" alt="">' +
      '<pre style="white-space:pre-wrap;font:11pt/1.5 Georgia,serif">' + esc(patternText()) + '</pre>';
    window.print();
  });

  let toastTimer = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200); }

  // keyboard
  window.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target === $('profileCanvas')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicatePart(false); return; }
    if (mod) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'g') setMode('translate');
    else if (k === 'e') setMode('rotate');
    else if (k === 'r') setMode('scale');
    else if (k === 'b') setMode('sculpt');
    else if (k === 'f') vp.frame();
    else if (k === '1') vp.view('front');
    else if (k === '3') vp.view('right');
    else if (k === '7') vp.view('top');
    else if (k === '5') vp.view('persp');
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deletePart(); }
    else if (e.key === 'Escape') selectPart(null);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { vp.setBackground(); pe.draw(); });

  // ---------- start ----------
  function sample() {
    const body = SS.makePart('egg', { name: 'Body', color: '#c9a27a' });
    const head = SS.makePart('sphere', { name: 'Head', color: '#c9a27a', position: [0, 5.2, 0] });
    const earL = SS.makePart('sphere', { name: 'Ear L', color: '#c9a27a', position: [-2.1, 10.4, 0], rotation: [0, 0, 0.5], scale: [0.36, 0.36, 0.16] });
    const earR = SS.makePart('sphere', { name: 'Ear R', color: '#c9a27a', position: [2.1, 10.4, 0], rotation: [0, 0, -0.5], scale: [0.36, 0.36, 0.16] });
    const snout = SS.makePart('sphere', { name: 'Snout', color: '#f7f2e6', position: [0, 7.7, 2.55], rotation: [Math.PI / 2, 0, 0], scale: [0.36, 0.22, 0.3] });
    // limbs start at the closed hand and end open at the shoulder
    const armL = SS.makePart('limb', { name: 'Arm L', color: '#c9a27a', position: [-3.7, 1.4, 0.4], rotation: [0, 0, -0.5], scale: [0.7, 0.75, 0.7] });
    const armR = SS.makePart('limb', { name: 'Arm R', color: '#c9a27a', position: [3.7, 1.4, 0.4], rotation: [0, 0, 0.5], scale: [0.7, 0.75, 0.7] });
    return [body, head, earL, earR, snout, armL, armR];
  }
  let loaded = false;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) { load(JSON.parse(saved)); loaded = true; }
  } catch (e) { /* no storage or bad data */ }
  if (!loaded) { state.parts = sample(); state.selectedId = state.parts[1].id; }
  refreshAll();
  commit('start');
  setMode('translate');
  setTimeout(() => vp.frame(), 50);

  window.StitchSculpt = { state, vp, pe, commit, runPattern, addPart, selectPart, setMode }; // for tests / console
})();
