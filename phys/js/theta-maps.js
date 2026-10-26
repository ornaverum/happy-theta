/* Theta Maps — mind maps, debate maps and project flow charts for HappyTheta.
   One classic script wrapped in an IIFE so its names don't collide with core.js.
   Needs core.js (HT.files) loaded first. Page: maps/theta-maps.html */
(function () {
'use strict';
/* =========================================================
   Theta Maps — mind maps, debate maps and flow charts (HappyTheta)
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = (p = 'n') => p + Math.random().toString(36).slice(2, 8) + (Date.now() % 1e6).toString(36);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const PALETTE = ['#1E3A8A', '#2F6FDE', '#D9622B', '#B8324F', '#7A4FD0', '#C9A227', '#2E8BA8', '#5E7A2E', '#8A5A3C', '#6B7570'];
const SIDE_COLORS = ['#2F6FDE', '#D9622B', '#7A4FD0', '#2C8C5A', '#B8324F', '#C9A227'];

function hexToRgb(h) {
  h = String(h || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n) || h.length !== 6) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function contrastText(hex) {
  const c = hexToRgb(hex); if (!c) return 'var(--fg)';
  const L = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  const lum = .2126 * L[0] + .7152 * L[1] + .0722 * L[2];
  return lum > .42 ? '#111614' : '#FFFFFF';
}
const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;

/* ---------- icons ---------- */
const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ICON = {
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  link: I('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  file: I('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>'),
  folder: I('<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>'),
  folderPlus: I('<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M12 10v6M9 13h6"/>'),
  fit: I('<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>'),
  zin: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M11 8v6M8 11h6"/>'),
  zout: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>'),
  tidy: I('<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="9" y="15" width="6" height="5" rx="1"/><path d="M6 9v2h12V9M12 11v4"/>'),
  node: I('<rect x="4" y="6" width="16" height="12" rx="3"/><path d="M12 9v6M9 12h6"/>'),
  ext: I('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  eye: I('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  img: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  swap: I('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
  enter: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  collapse: I('<path d="M7 10l5 5 5-5"/>'),
  bold: '<b>B</b>', italic: '<i style="font-family:Georgia,serif">I</i>', underline: '<u>U</u>', strike: '<s>S</s>',
  ul: I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>'),
  ol: I('<path d="M10 6h10M10 12h10M10 18h10M4 4v4M3 18h3l-3 3h3" />'),
  quote: I('<path d="M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6"/>'),
  clear: I('<path d="M4 7V5h12v2M10 5l-3 14M14 19h-6M16 13l5 5M21 13l-5 5"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>'),
};

/* ---------- shapes ---------- */
const rr = (w, h, r) => { r = Math.min(r, w / 2, h / 2); return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`; };
const SHAPES = {
  rounded: { label: 'Rounded', pl: 12, pr: 12, pt: 10, pb: 10, d: (w, h) => rr(w, h, 12) },
  rect: { label: 'Rectangle', pl: 12, pr: 12, pt: 10, pb: 10, d: (w, h) => rr(w, h, 2) },
  pill: { label: 'Pill', pl: 22, pr: 22, pt: 12, pb: 12, d: (w, h) => rr(w, h, 999) },
  ellipse: { label: 'Ellipse', fx: .146, fy: .146, pl: 4, pr: 4, pt: 4, pb: 4, minR: .5, d: (w, h) => `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 0 0 ${h / 2}Z` },
  diamond: { label: 'Diamond', fx: .22, fy: .22, pl: 2, pr: 2, pt: 2, pb: 2, minR: .55, d: (w, h) => `M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z` },
  hexagon: { label: 'Hexagon', pl: 26, pr: 26, pt: 12, pb: 12, d: (w, h) => { const c = Math.min(20, h / 2); return `M${c} 0H${w - c}L${w} ${h / 2}L${w - c} ${h}H${c}L0 ${h / 2}Z`; } },
  parallelogram: { label: 'Parallelogram', pl: 28, pr: 28, pt: 10, pb: 10, d: (w, h) => `M18 0H${w}L${w - 18} ${h}H0Z` },
  tagl: { label: 'Notched', pl: 24, pr: 12, pt: 10, pb: 10, d: (w, h) => { const c = Math.min(16, h / 2); return `M${c} 0H${w - 8}Q${w} 0 ${w} 8V${h - 8}Q${w} ${h} ${w - 8} ${h}H${c}L0 ${h / 2}Z`; } },
  note: { label: 'Note', pl: 12, pr: 20, pt: 10, pb: 10, d: (w, h) => `M0 0H${w - 16}L${w} 16V${h}H0Z`, x: (w, h) => `M${w - 16} 0V16H${w}` },
  document: { label: 'Document', pl: 12, pr: 12, pt: 10, pb: 22, d: (w, h) => `M0 0H${w}V${h - 10}C${w * .72} ${h - 26} ${w * .3} ${h + 6} 0 ${h - 8}Z` },
  cylinder: { label: 'Data store', pl: 12, pr: 12, pt: 22, pb: 14, d: (w, h) => `M0 9A${w / 2} 9 0 0 1 ${w} 9V${h - 9}A${w / 2} 9 0 0 1 0 ${h - 9}Z`, x: (w, h) => `M0 9A${w / 2} 9 0 0 0 ${w} 9` },
  subprocess: { label: 'Sub-process', pl: 22, pr: 22, pt: 10, pb: 10, d: (w, h) => rr(w, h, 2), x: (w, h) => `M11 0V${h}M${w - 11} 0V${h}` },
  octagon: { label: 'Octagon', pl: 16, pr: 16, pt: 10, pb: 10, d: (w, h) => { const c = Math.min(14, h / 3); return `M${c} 0H${w - c}L${w} ${c}V${h - c}L${w - c} ${h}H${c}L0 ${h - c}V${c}Z`; } },
};
for (const s of Object.values(SHAPES)) { s.fx = s.fx || 0; s.fy = s.fy || 0; }
function shapeIcon(key, stroke = 'currentColor', fill = 'none') {
  const s = SHAPES[key] || SHAPES.rounded; const w = 30, h = 18;
  return `<svg viewBox="-2 -2 ${w + 4} ${h + 4}"><path d="${s.d(w, h)}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>${s.x ? `<path d="${s.x(w, h)}" fill="none" stroke="${stroke}" stroke-width="1.6"/>` : ''}</svg>`;
}

/* ---------- templates & node kinds ---------- */
const KINDS = {
  root: { label: 'Central idea', shape: 'pill', color: '#1E3A8A', fill: 'solid', w: 230 },
  idea: { label: 'Idea', shape: 'rounded', w: 200 },
  claim: { label: 'Claim', shape: 'hexagon', w: 250, desc: 'A position one side defends' },
  argument: { label: 'Argument', shape: 'rounded', w: 220, desc: 'A reason that supports a claim' },
  counter: { label: 'Counter-argument', shape: 'tagl', w: 220, desc: 'Attacks an argument; takes the opposing side' },
  evidence: { label: 'Evidence', shape: 'note', w: 200, desc: 'Data or a source backing an argument' },
  terminal: { label: 'Start / End', shape: 'pill', color: '#1E3A8A', fill: 'solid', w: 200 },
  process: { label: 'Process step', shape: 'rect', w: 210 },
  decision: { label: 'Decision', shape: 'diamond', color: '#C9A227', fill: 'tint', w: 220 },
  io: { label: 'Input / Output', shape: 'parallelogram', color: '#2E8BA8', fill: 'tint', w: 210 },
  document: { label: 'Document', shape: 'document', color: '#7A4FD0', fill: 'tint', w: 200 },
  subprocess: { label: 'Sub-process', shape: 'subprocess', color: '#6B7570', fill: 'tint', w: 210 },
  data: { label: 'Data store', shape: 'cylinder', color: '#5E7A2E', fill: 'tint', w: 190 },
  milestone: { label: 'Milestone', shape: 'octagon', color: '#B8324F', fill: 'tint', w: 200 },
};
const TEMPLATES = {
  mind: { label: 'Mind map', kinds: ['root', 'idea'], def: 'idea', layout: 'LR' },
  debate: { label: 'Debate map', kinds: ['claim', 'argument', 'counter', 'evidence', 'idea'], def: 'argument', layout: 'TB', reverse: true },
  flow: { label: 'Flow chart', kinds: ['terminal', 'process', 'decision', 'io', 'document', 'subprocess', 'data', 'milestone', 'idea'], def: 'process', layout: 'TB' },
};
const STATUSES = { '': 'No status', todo: 'Not started', progress: 'In progress', done: 'Done', blocked: 'Blocked' };
const REL = { supports: 'Supports', counters: 'Counters', evidence: 'Evidence for', '': 'Plain link' };

/* child options when growing a node: [kind, direction] where 'up' means child → parent edge */
function childOptions(src) {
  const t = map.template;
  if (t === 'debate') {
    const k = src ? src.kind : null;
    if (k === 'claim') return [['argument', 'up']];
    if (k === 'argument') return [['evidence', 'up'], ['counter', 'up'], ['argument', 'up']];
    if (k === 'counter') return [['evidence', 'up'], ['counter', 'up']];
    if (k === 'evidence') return [['counter', 'up']];
    return [['idea', 'down']];
  }
  if (t === 'flow') return TEMPLATES.flow.kinds.filter(k => k !== 'idea').map(k => [k, 'down']);
  return [['idea', 'down']];
}

/* ---------- state ---------- */
let map = null;            // current map (serializable)
let assets = {};           // id -> {id,name,mime,size,data,thumb}
let byId = {}, kids = {};  // indexes
const sizes = {};          // id -> {w,h} measured
const ui = { folder: 'root', sel: new Set(), edge: null, ftile: null, insp: true, legend: true };
let undoStack = [], redoStack = [];
let sideMemo = {};

function index() {
  byId = {}; kids = {};
  for (const n of map.nodes) byId[n.id] = n;
  for (const n of map.nodes) if (n.parent && byId[n.parent]) (kids[n.parent] ||= []).push(n.id);
}
const folderById = id => map.folders.find(f => f.id === id);
const childFolders = id => map.folders.filter(f => f.parent === id);
function folderPath(id) { const out = []; let f = folderById(id), g = 0; while (f && g++ < 50) { out.unshift(f); f = folderById(f.parent); } return out; }
function folderTree() {
  const out = []; const walk = (id, d) => { for (const f of childFolders(id)) { out.push([f, d]); walk(f.id, d + 1); } };
  const root = folderById('root'); out.push([root, 0]); walk('root', 1); return out;
}
function descendants(id) {
  const out = []; const seen = new Set([id]); const st = [...(kids[id] || [])];
  while (st.length) { const c = st.pop(); if (seen.has(c)) continue; seen.add(c); out.push(c); st.push(...(kids[c] || [])); }
  return out;
}
function isAncestor(a, b) { // is a an ancestor of b
  let p = byId[b]?.parent, g = 0; while (p && g++ < 1000) { if (p === a) return true; p = byId[p]?.parent; } return false;
}

function newNode(o = {}) {
  const k = KINDS[o.kind || 'idea'] || KINDS.idea;
  return Object.assign({
    id: uid('n'), folder: ui.folder, x: 0, y: 0, w: k.w || 200, title: 'New idea', kind: 'idea',
    side: null, color: null, fill: null, shape: null, dates: [], image: null, html: '', showBody: true,
    links: [], files: [], parent: null, collapsed: false, status: '', owner: '',
  }, o);
}
function blankMap(template = 'mind', name = 'Untitled map') {
  return {
    format: 'theta-maps', v: 1, id: HT.files.newId('s'), name, template, created: Date.now(), updated: Date.now(),
    settings: { edgeStyle: template === 'flow' ? 'elbow' : 'curve' },
    sides: template === 'debate' ? [{ id: 'A', name: 'Affirmative', color: SIDE_COLORS[0] }, { id: 'B', name: 'Negative', color: SIDE_COLORS[1] }] : [],
    folders: [{ id: 'root', name: 'Main', parent: null, color: '#1E3A8A' }],
    nodes: [], edges: [], ghostPos: {}, views: {}, layoutPending: {},
  };
}
function normalize(m) {
  const b = blankMap(m.template || 'mind', m.name || 'Imported map');
  m = Object.assign(b, m);
  if (!TEMPLATES[m.template]) m.template = 'mind';
  m.settings = Object.assign({ edgeStyle: 'curve' }, m.settings || {});
  if (!Array.isArray(m.sides)) m.sides = [];
  if (m.template === 'debate' && m.sides.length < 2) m.sides = b.sides.length ? b.sides : [{ id: 'A', name: 'Affirmative', color: SIDE_COLORS[0] }, { id: 'B', name: 'Negative', color: SIDE_COLORS[1] }];
  if (!Array.isArray(m.folders)) m.folders = [];
  if (!m.folders.find(f => f.id === 'root')) m.folders.unshift({ id: 'root', name: 'Main', parent: null, color: '#1E3A8A' });
  const fids = new Set(m.folders.map(f => f.id));
  m.folders.forEach(f => { if (f.id !== 'root' && (!f.parent || !fids.has(f.parent) || f.parent === f.id)) f.parent = 'root'; f.color ||= PALETTE[1]; });
  m.nodes = (Array.isArray(m.nodes) ? m.nodes : []).filter(n => n && n.id).map(n => {
    const d = newNode({ kind: n.kind || 'idea' });
    n = Object.assign(d, n);
    if (!fids.has(n.folder)) n.folder = 'root';
    ['dates', 'links', 'files'].forEach(k => { if (!Array.isArray(n[k])) n[k] = []; });
    n.x = +n.x || 0; n.y = +n.y || 0; n.w = clamp(+n.w || 200, 110, 640);
    n.html = n.html ? sanitize(n.html) : ''; n.title = String(n.title ?? '');
    return n;
  });
  const nids = new Set(m.nodes.map(n => n.id));
  m.nodes.forEach(n => { if (n.parent && !nids.has(n.parent)) n.parent = null; });
  m.edges = (Array.isArray(m.edges) ? m.edges : []).filter(e => e && nids.has(e.from) && nids.has(e.to) && e.from !== e.to).map(e => Object.assign({ id: uid('e'), dir: 'fwd', label: '' }, e));
  m.ghostPos ||= {}; m.views ||= {}; m.layoutPending ||= {};
  return m;
}

/* ---------- debate sides ---------- */
const sideById = id => map.sides.find(s => s.id === id);
function opposite(s) { if (map.sides.length !== 2 || !s) return null; return map.sides.find(x => x.id !== s)?.id || null; }
function inferRel(a, b) {
  if (map.template !== 'debate' || !a || !b) return '';
  if (a.kind === 'counter') return 'counters';
  if (a.kind === 'evidence') return 'evidence';
  if (a.kind === 'argument' || b.kind === 'claim') return 'supports';
  return '';
}
const relOf = e => (e.rel !== undefined && e.rel !== null && e.rel !== 'auto') ? e.rel : inferRel(byId[e.from], byId[e.to]);
function effSide(n, seen) {
  if (!n || map.template !== 'debate') return null;
  if (n.side) return n.side;
  if (sideMemo[n.id] !== undefined) return sideMemo[n.id];
  seen = seen || new Set(); if (seen.has(n.id)) return null; seen.add(n.id);
  let res = null;
  for (const e of map.edges) {
    if (e.from !== n.id) continue; const t = byId[e.to]; if (!t) continue;
    const s = effSide(t, seen); if (!s) continue;
    res = relOf(e) === 'counters' ? opposite(s) : s; if (res) break;
  }
  if (!res && n.parent && byId[n.parent]) {
    const p = byId[n.parent]; const s = effSide(p, seen);
    if (s) res = n.kind === 'counter' ? opposite(s) : s;
  }
  sideMemo[n.id] = res; return res;
}

/* ---------- visuals per node ---------- */
function shapeOf(n) { return SHAPES[n.shape] ? n.shape : (KINDS[n.kind]?.shape || 'rounded'); }
function nodeLook(n) {
  const k = KINDS[n.kind] || KINDS.idea;
  if (map.template === 'debate' && !n.color && ['claim', 'argument', 'counter', 'evidence'].includes(n.kind)) {
    const s = sideById(effSide(n)); const c = s ? s.color : '#7D8A84';
    if (n.kind === 'claim') return { fill: c, stroke: c, text: contrastText(c), sw: 2 };
    if (n.kind === 'argument') return { fill: tint(c, 20), stroke: c, text: 'var(--fg)', sw: 2 };
    if (n.kind === 'counter') return { fill: tint(c, 14), stroke: c, text: 'var(--fg)', sw: 2, dash: '6 4' };
    return { fill: tint(c, 7), stroke: c, text: 'var(--fg)', sw: 1.3 };
  }
  const c = n.color || k.color; const mode = n.fill || (n.color ? 'tint' : (k.fill || 'tint'));
  if (!c) return { fill: 'var(--surface)', stroke: 'var(--edge)', text: 'var(--fg)', sw: 1.4 };
  if (mode === 'solid') return { fill: c, stroke: c, text: contrastText(c), sw: 1.5 };
  if (mode === 'outline') return { fill: 'var(--surface)', stroke: c, text: 'var(--fg)', sw: 2.2 };
  return { fill: tint(c, 17), stroke: c, text: 'var(--fg)', sw: 1.6 };
}
function edgeColor(e) {
  if (e.color) return e.color;
  if (map.template === 'debate') { const s = sideById(effSide(byId[e.from])); if (s) return s.color; }
  return 'var(--edge)';
}

/* ---------- formatting ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(s, withYear) {
  if (!s) return ''; const [y, m, d] = s.split('-').map(Number); if (!y || !m) return s;
  const cy = new Date().getFullYear();
  return `${MONTHS[m - 1]} ${d}${(withYear || y !== cy) ? ', ' + y : ''}`;
}
function fmtRange(dt) {
  if (dt.start && dt.end && dt.end !== dt.start) {
    const [y1] = dt.start.split('-'); const [y2] = dt.end.split('-');
    return y1 === y2 ? `${fmtDate(dt.start).replace(/, \d+$/, '')} – ${fmtDate(dt.end)}` : `${fmtDate(dt.start, 1)} – ${fmtDate(dt.end, 1)}`;
  }
  return fmtDate(dt.start || dt.end);
}
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function fmtSize(b) { if (!b && b !== 0) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
const extOf = name => (String(name).split('.').pop() || '').toLowerCase();
function domainOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }
function safeUrl(u) { u = String(u || '').trim(); if (!u) return ''; if (/^(https?:|mailto:)/i.test(u)) return u; if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u; return ''; }

/* ---------- rich text sanitizer ---------- */
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H3', 'H4', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'SPAN', 'CODE']);
function sanitize(html) {
  const tpl = document.createElement('template'); tpl.innerHTML = String(html || '');
  const walk = el => {
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1) { c.remove(); continue; }
      let tag = c.tagName; if (tag === 'H1' || tag === 'H2') { const h = document.createElement('h3'); h.append(...c.childNodes); c.replaceWith(h); walk(h); continue; }
      if (!OK_TAGS.has(tag)) { if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH'].includes(tag)) { c.remove(); continue; } walk(c); c.replaceWith(...c.childNodes); continue; }
      for (const a of Array.from(c.attributes)) { if (!(tag === 'A' && a.name === 'href')) c.removeAttribute(a.name); }
      if (tag === 'A') { const h = safeUrl(c.getAttribute('href')); if (h) { c.setAttribute('href', h); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); } else c.removeAttribute('href'); }
      walk(c);
    }
  };
  walk(tpl.content); return tpl.innerHTML;
}
const plain = html => { const d = document.createElement('div'); d.innerHTML = sanitize(html); return d.textContent.replace(/\s+/g, ' ').trim(); };

/* ---------- data helpers for attachments ---------- */
function dataUrlBytes(url) {
  const i = url.indexOf(','); const meta = url.slice(0, i); const body = url.slice(i + 1);
  if (/;base64/.test(meta)) { const bin = atob(body); const u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return u; }
  return new TextEncoder().encode(decodeURIComponent(body));
}
const textMemo = {};
function assetText(a, max = 200000) {
  if (!a?.data) return '';
  if (textMemo[a.id] !== undefined) return textMemo[a.id];
  try { const b = dataUrlBytes(a.data); return (textMemo[a.id] = new TextDecoder().decode(b.subarray(0, max))); } catch { return (textMemo[a.id] = ''); }
}
function parseCSV(text, maxRows = 1000) {
  const delim = (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; if (rows.length >= maxRows) return rows; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function fileKind(f) {
  const a = assets[f.asset]; const mime = (a?.mime || f.mime || '').toLowerCase(); const ext = extOf(f.name || a?.name || '');
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['csv', 'tsv'].includes(ext) || mime === 'text/csv') return 'csv';
  if (mime.startsWith('text/') || ['txt', 'md', 'json', 'js', 'py', 'html', 'xml', 'log', 'yaml', 'yml', 'css', 'r', 'ipynb', 'tex'].includes(ext)) return 'text';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

/* =========================================================
   Persistence
   - Maps: HappyTheta save envelope (HT.files, tool 'mindmap') in localStorage.
     data = the map (nodes, edges, folders, sides, settings);
     view = drawing-only state (per-folder pan/zoom, ghost-card offsets).
   - Attachments (images, PDFs, CSVs…): IndexedDB, because localStorage
     only holds ~5 MB. A downloaded name.mindmap.json carries them in data.assets.
   ========================================================= */
const TOOL = 'mindmap';
const KEY = 'happytheta:mindmap:';
const LS = {
  get(k) { try { return localStorage.getItem(KEY + k); } catch { return null; } },
  set(k, v) { localStorage.setItem(KEY + k, v); },
  del(k) { try { localStorage.removeItem(KEY + k); } catch { } },
  json(k, d) { try { const v = this.get(k); return v ? JSON.parse(v) : d; } catch { return d; } },
};
const prefs = Object.assign({ wheel: 'pan' }, LS.json('prefs', {}));
const savePrefs = () => { try { LS.set('prefs', JSON.stringify(prefs)); } catch { } };

const IDB = {
  db: null, failed: false,
  open() {
    if (this.db) return Promise.resolve(this.db);
    if (this.failed || !('indexedDB' in window)) return Promise.reject(new Error('no idb'));
    return new Promise((res, rej) => {
      let r; try { r = indexedDB.open('happytheta-mindmap', 1); } catch (e) { this.failed = true; return rej(e); }
      r.onupgradeneeded = () => r.result.createObjectStore('assets');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => { this.failed = true; rej(r.error); };
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction('assets', mode); fn(t.objectStore('assets')); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  },
  put(key, val) { return this.tx('readwrite', s => { s.put(val, key); }); },
  del(key) { return this.tx('readwrite', s => { s.delete(key); }); },
  async all(prefix) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const out = []; const t = db.transaction('assets', 'readonly');
      const req = t.objectStore('assets').openCursor(IDBKeyRange.bound(prefix, prefix + '￿'));
      req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
      req.onerror = () => rej(req.error);
    });
  },
  async delPrefix(prefix) { const rows = await this.all(prefix).catch(() => []); for (const [k] of rows) await this.del(k).catch(() => { }); },
};

const cleanAsset = a => { const o = {}; for (const k in a) if (k[0] !== '_') o[k] = a[k]; return o; };
const dirtyAssets = new Set();
function addAsset(a) { assets[a.id] = a; dirtyAssets.add(a.id); }
function markAsset(id) { dirtyAssets.add(id); }

function refAssetIds(m = map) {
  const s = new Set();
  for (const n of m.nodes) { if (n.image?.asset) s.add(n.image.asset); for (const f of n.files) if (f.asset) s.add(f.asset); }
  return s;
}

/* ---------- envelope <-> map ---------- */
const VIEW_KEYS = ['views', 'ghostPos', 'layoutPending'];
let curEnv = null; // the envelope the open map was last saved to
function toEnvelope(m, prev, extraData) {
  const data = {}; for (const k in m) if (!VIEW_KEYS.includes(k) && !['id', 'name', 'created', 'updated'].includes(k)) data[k] = m[k];
  Object.assign(data, extraData || {});
  const base = prev || { id: m.id, meta: { created: new Date(m.created || Date.now()).toISOString() } };
  return HT.files.wrap(TOOL, { title: m.name, data: JSON.parse(JSON.stringify(data)), view: { views: m.views || {}, ghostPos: m.ghostPos || {}, layoutPending: m.layoutPending || {} } }, base);
}
function fromEnvelope(f) {
  const d = Object.assign({}, f.data); delete d.assets;
  return normalize(Object.assign(d, { id: f.id, name: f.meta.title, created: Date.parse(f.meta.created) || Date.now(), updated: Date.parse(f.meta.modified) || Date.now() }, {
    views: f.view.views || {}, ghostPos: f.view.ghostPos || {}, layoutPending: f.view.layoutPending || {},
  }));
}
function mapIndex() {
  let list = []; try { list = HT.files.list(TOOL); } catch { }
  return list.map(f => ({ id: f.id, name: f.meta.title, template: f.data.template, updated: Date.parse(f.meta.modified), count: (f.data.nodes || []).length }));
}

let saveTimer = null, saveErr = '';
function scheduleSave() { setSave('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 650); }
async function saveNow() {
  clearTimeout(saveTimer); saveTimer = null; if (!map) return;
  map.updated = Date.now();
  let ok = true;
  try {
    curEnv = toEnvelope(map, curEnv && curEnv.id === map.id ? curEnv : null);
    HT.files.write(curEnv); LS.set('last', map.id);
  } catch (e) { ok = false; saveErr = e && e.name === 'QuotaExceededError' ? 'Browser storage is full. Download the map as a file to keep it.' : 'This browser blocked storage. Download the map as a file to keep it.'; }
  for (const id of Array.from(dirtyAssets)) {
    const a = assets[id]; if (!a) { dirtyAssets.delete(id); continue; }
    try { await IDB.put(map.id + '/' + id, cleanAsset(a)); dirtyAssets.delete(id); }
    catch { try { LS.set('asset:' + map.id + '/' + id, JSON.stringify(cleanAsset(a))); dirtyAssets.delete(id); } catch { ok = false; saveErr = 'Attachments could not be stored in this browser. Download the map as a file to keep them.'; } }
  }
  if (ok) { saveErr = ''; setSave('Saved in this browser'); }
  else setSave('Not saved', true);
}
function setSave(t, err) { const el = $('#saveState'); if (!el) return; el.textContent = t; el.classList.toggle('err', !!err); el.title = err ? saveErr : 'Changes save automatically to this browser'; }

async function loadAssetsFor(id) {
  const out = {};
  try { for (const [k, v] of await IDB.all(id + '/')) out[k.slice(id.length + 1)] = v; } catch { }
  try { const p = KEY + 'asset:' + id + '/'; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(p)) { try { out[k.slice(p.length)] = JSON.parse(localStorage.getItem(k)); } catch { } } } } catch { }
  return out;
}
async function openMap(id) {
  let f = null; try { f = HT.files.read(TOOL, id); } catch { f = null; }
  if (!f) return false;
  if (map) await saveNow();
  const m = fromEnvelope(f);
  assets = await loadAssetsFor(id);
  const refs = refAssetIds(m); // drop attachments nothing references any more
  for (const k of Object.keys(assets)) if (!refs.has(k)) { delete assets[k]; IDB.del(id + '/' + k).catch(() => { }); LS.del('asset:' + id + '/' + k); }
  curEnv = f; setMap(m); return true;
}
async function deleteMap(id) {
  try { HT.files.remove(TOOL, id); } catch { }
  IDB.delPrefix(id + '/');
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(KEY + 'asset:' + id + '/')) localStorage.removeItem(k); } } catch { }
  if (LS.get('last') === id) LS.del('last');
}
function setMap(m, newAssets) {
  if (!curEnv || curEnv.id !== m.id) curEnv = null;
  map = m; if (newAssets) { assets = newAssets; Object.keys(assets).forEach(markAsset); }
  undoStack = []; redoStack = [];
  ui.folder = 'root'; ui.sel.clear(); ui.edge = null; ui.ftile = null;
  for (const k in sizes) delete sizes[k];
  index(); renderAll(); scheduleSave();
}

/* ---------- history ---------- */
function snapshot() { const v = map.views; map.views = undefined; const s = JSON.stringify(map); map.views = v; return s; }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; updUndo(); }
function restore(s) { const views = map.views; map = JSON.parse(s); map.views = views || {}; if (!folderById(ui.folder)) ui.folder = 'root'; index(); pruneSel(); renderAll(); scheduleSave(); }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updUndo(); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updUndo(); }
function updUndo() { $('#undoBtn').disabled = !undoStack.length; $('#redoBtn').disabled = !redoStack.length; }
function pruneSel() { for (const id of Array.from(ui.sel)) if (!byId[id]) ui.sel.delete(id); if (ui.edge && !map.edges.find(e => e.id === ui.edge)) ui.edge = null; if (ui.ftile && !folderById(ui.ftile)) ui.ftile = null; }
/* run a model change with undo + save + re-render */
function act(fn, opt = {}) { pushUndo(); fn(); index(); pruneSel(); scheduleSave(); if (opt.canvasOnly) scheduleCanvas(); else renderAll(); }

/* ---------- files out ---------- */
function saveFile(filename, data, mime = 'application/octet-stream') {
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); return true;
  } catch { toast('This browser could not save the file. Use “Copy map JSON” instead.'); return false; }
}
function exportEnvelope() {
  const out = {}; for (const id of refAssetIds()) if (assets[id]) out[id] = cleanAsset(assets[id]);
  return toEnvelope(map, curEnv && curEnv.id === map.id ? curEnv : null, { assets: out });
}
const fileSafe = s => (String(s || 'map').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'map').slice(0, 60);
async function exportJSON() { await saveNow(); HT.files.download(exportEnvelope()); }
function exportMarkdown() {
  index(); const lines = [`# ${map.name}`, '', `_${TEMPLATES[map.template].label} · exported ${new Date().toLocaleDateString()}_`, ''];
  const nodeLine = (n, depth) => {
    const bits = [];
    if (map.template === 'debate') { const s = sideById(effSide(n)); bits.push(`[${KINDS[n.kind]?.label || 'Node'}${s ? ' · ' + s.name : ''}]`); }
    else if (map.template === 'flow' && n.kind !== 'idea') bits.push(`[${KINDS[n.kind]?.label}]`);
    bits.push(`**${n.title || 'Untitled'}**`);
    if (n.dates.length) bits.push('(' + n.dates.map(d => (d.label ? d.label + ': ' : '') + fmtRange(d)).join('; ') + ')');
    if (n.status) bits.push(`— ${STATUSES[n.status]}`);
    if (n.owner) bits.push(`— owner: ${n.owner}`);
    lines.push('  '.repeat(depth) + '- ' + bits.join(' '));
    const t = plain(n.html); if (t) lines.push('  '.repeat(depth + 1) + '> ' + t);
    for (const l of n.links) lines.push('  '.repeat(depth + 1) + `- Link: [${l.label || domainOf(l.url)}](${l.url})`);
    for (const f of n.files) lines.push('  '.repeat(depth + 1) + `- File: ${f.name}${f.path ? ' (' + f.path + ')' : ''}`);
  };
  for (const [f, d] of folderTree()) {
    lines.push(`${'#'.repeat(Math.min(2 + d, 6))} Folder: ${f.name}`, '');
    const inF = map.nodes.filter(n => n.folder === f.id);
    const roots = inF.filter(n => !n.parent || !byId[n.parent] || byId[n.parent].folder !== f.id);
    const seen = new Set();
    const walk = (n, dep) => { if (seen.has(n.id)) return; seen.add(n.id); nodeLine(n, dep); (kids[n.id] || []).map(i => byId[i]).filter(c => c.folder === f.id).forEach(c => walk(c, dep + 1)); };
    roots.sort((a, b) => a.y - b.y || a.x - b.x).forEach(n => walk(n, 0));
    lines.push('');
  }
  lines.push('## Connections', '');
  for (const e of map.edges) {
    const a = byId[e.from], b = byId[e.to]; if (!a || !b) continue;
    const arrow = e.dir === 'both' ? '↔' : e.dir === 'none' ? '—' : '→'; const rel = relOf(e);
    lines.push(`- ${a.title} ${arrow} ${b.title}${rel ? ' _(' + REL[rel] + ')_' : ''}${e.label ? ' — ' + e.label : ''}`);
  }
  saveFile(fileSafe(map.name) + '.md', lines.join('\n'), 'text/markdown');
}
/* Accepts a HappyTheta envelope (name.mindmap.json) or a Branchwork export */
function importPayload(text) {
  let obj; try { obj = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  let nm, rawAssets;
  if (obj && obj.format === HT.files.FORMAT) {
    const f = HT.files.parse(obj, TOOL); rawAssets = f.data.assets; nm = fromEnvelope(f);
  } else {
    const m = obj && (obj.map || (obj.nodes ? obj : null));
    if (!m || !Array.isArray(m.nodes)) throw new Error('That file does not contain a Theta Maps map.');
    nm = normalize(JSON.parse(JSON.stringify(m))); rawAssets = obj.assets;
  }
  let exists = false; try { exists = !!HT.files.read(TOOL, nm.id); } catch { }
  if (exists || !/^[\w-]+$/.test(nm.id)) { if (exists) nm.name = nm.name + ' (imported)'; nm.id = HT.files.newId('s'); }
  const as = {}; if (rawAssets && typeof rawAssets === 'object') for (const [k, v] of Object.entries(rawAssets)) if (v && typeof v.data === 'string' && v.data.startsWith('data:')) as[k] = Object.assign({ id: k }, v);
  return { map: nm, assets: as };
}

/* =========================================================
   Rendering: field, nodes, edges, ghosts, folders
   ========================================================= */
const stage = $('#stage'), world = $('#world'), layer = $('#layer'), edgesSvg = $('#edges'), eg = $('#eg'), defs = $('#defs');
const labelsEl = document.createElement('div'); labelsEl.id = 'elabels'; world.appendChild(labelsEl);
let lastModel = { items: [], ghosts: new Map(), vis: null };

const V = () => map.views[ui.folder];
function applyView() {
  const v = V(); if (!v) return;
  world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`;
  const g = 22 * v.k; stage.style.backgroundSize = `${g}px ${g}px`; stage.style.backgroundPosition = `${v.x}px ${v.y}px`;
  const z = $('#zoomLbl'); if (z) z.textContent = Math.round(v.k * 100) + '%';
}
function toWorld(cx, cy) { const r = stage.getBoundingClientRect(), v = V(); return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k }; }
function viewCenter() { const r = stage.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); }

function visibility() {
  const rep = {}, hidden = new Set(), hiddenCount = {};
  for (const n of map.nodes) {
    let top = null, p = n.parent, g = 0;
    while (p && byId[p] && g++ < 500) { if (byId[p].collapsed) top = p; p = byId[p].parent; }
    rep[n.id] = top || n.id; if (top) hidden.add(n.id);
  }
  for (const n of map.nodes) if (n.collapsed) hiddenCount[n.id] = descendants(n.id).length;
  return { rep, hidden, hiddenCount };
}

function edgeModel(F, vis, occupied) {
  const items = [], ghosts = new Map(), merged = new Map();
  for (const e of map.edges) {
    const a = vis.rep[e.from], b = vis.rep[e.to]; if (!a || !b || a === b) continue;
    const A = byId[a], B = byId[b]; if (!A || !B) continue;
    const rer = a !== e.from || b !== e.to, inA = A.folder === F, inB = B.folder === F;
    if (!inA && !inB) continue;
    let from = a, to = b, cross = false;
    if (!inA || !inB) {
      cross = true; const local = inA ? a : b, remote = inA ? b : a, gk = local + '>' + remote;
      if (!ghosts.has(gk)) ghosts.set(gk, { key: gk, local, remote, n: 0 }); ghosts.get(gk).n++;
      if (inA) to = 'g:' + gk; else from = 'g:' + gk;
    }
    const ghost = rer || cross; const mk = ghost ? from + '|' + to : e.id;
    if (merged.has(mk)) { const it = merged.get(mk); it.count++; it.ids.push(e.id); continue; }
    const it = { key: mk, ids: [e.id], edge: e, from, to, ghost, rer, cross, count: 1 };
    merged.set(mk, it); items.push(it);
  }
  // place each ghost card in the first free spot around its local node
  const GW = 200, GH = 50, M = 14; const occ = (occupied || []).slice();
  const hit = b => occ.some(o => b.x < o.x + o.w + M && b.x + b.w + M > o.x && b.y < o.y + o.h + M && b.y + b.h + M > o.y);
  for (const g of ghosts.values()) {
    const Ln = byId[g.local]; const s = sizes[g.local] || { w: Ln.w, h: 60 };
    const saved = map.ghostPos[g.key];
    if (saved) { g.dx = saved.dx; g.dy = saved.dy; }
    else {
      const my = (s.h - GH) / 2, mx = (s.w - GW) / 2; const c = [];
      for (let r = 0; r < 6; r++) c.push([s.w + 50, my + r * 62], [s.w + 50, my - r * 62], [-(GW + 50), my + r * 62], [-(GW + 50), my - r * 62], [mx + r * 220, -(GH + 46)], [mx + r * 220, s.h + 46], [mx - r * 220, -(GH + 46)], [mx - r * 220, s.h + 46]);
      let pick = c[0]; for (const [dx, dy] of c) if (!hit({ x: Ln.x + dx, y: Ln.y + dy, w: GW, h: GH })) { pick = [dx, dy]; break; }
      g.dx = pick[0]; g.dy = pick[1];
    }
    occ.push({ x: Ln.x + g.dx, y: Ln.y + g.dy, w: GW, h: GH });
  }
  return { items, ghosts };
}

function imgSrc(im) { if (!im) return ''; if (im.asset) return assets[im.asset]?.data || ''; return safeUrl(im.url) || (String(im.url || '').startsWith('data:image/') ? im.url : ''); }

function thumbHTML(n, f) {
  const a = assets[f.asset]; const k = fileKind(f); const ext = esc(extOf(f.name) || k);
  let inner = '';
  if (!a) inner = `<div class="gen">${ext}</div>`;
  else if (k === 'image') inner = `<img src="${esc(a.data)}" alt="">`;
  else if (k === 'pdf') { if (a.thumb) inner = `<img src="${esc(a.thumb)}" alt="">`; else { inner = `<div class="gen">PDF</div>`; if (!a._thumbFail) queuePdfThumb(a); } }
  else if (k === 'csv') { const rows = parseCSV(assetText(a, 4000), 6).slice(0, 6); inner = `<table>${rows.map(r => '<tr>' + r.slice(0, 4).map(c => `<td>${esc(c.slice(0, 8))}</td>`).join('') + '</tr>').join('')}</table>`; }
  else if (k === 'text') inner = `<pre>${esc(assetText(a, 1200).slice(0, 260))}</pre>`;
  else inner = `<div class="gen">${ext}</div>`;
  return `<button class="thumb" data-view="${n.id}|${f.id}" title="${esc(f.name)} — click to preview">${inner}<span class="ext">${ext}</span></button>`;
}

const CENTER_SHAPES = new Set(['ellipse', 'diamond', 'pill', 'hexagon', 'octagon']);
function nodeHTML(n, vis) {
  const shKey = shapeOf(n), sh = SHAPES[shKey], look = nodeLook(n), w = n.w;
  const bl = sh.fx * w + sh.pl, bw = Math.max(40, w - 2 * sh.fx * w - sh.pl - sh.pr);
  const cls = ['node', 'k-' + n.kind]; if (ui.sel.has(n.id)) cls.push('sel'); if (CENTER_SHAPES.has(shKey)) cls.push('center');
  let tag = '';
  if (map.template === 'debate' && ['claim', 'argument', 'counter', 'evidence'].includes(n.kind)) { const s = sideById(effSide(n)); tag = `${KINDS[n.kind].label}${s ? ' · ' + s.name : ''}`; }
  else if (map.template === 'flow' && n.kind !== 'idea') tag = KINDS[n.kind]?.label || '';
  const chips = [];
  for (const d of n.dates) {
    const txt = (d.label ? d.label + ' ' : '') + fmtRange(d); if (!txt.trim()) continue;
    const end = d.end || d.start; const overdue = end && end < todayISO() && n.status !== 'done' && map.template === 'flow';
    chips.push(`<span class="chip${overdue ? ' overdue' : ''}">${esc(txt)}</span>`);
  }
  if (n.status) chips.push(`<span class="chip st-${n.status}">${esc(STATUSES[n.status])}</span>`);
  if (n.owner) chips.push(`<span class="chip">@${esc(n.owner)}</span>`);
  const src = imgSrc(n.image);
  const prev = n.files.filter(f => f.preview && f.asset && assets[f.asset]);
  const other = n.files.filter(f => !(f.preview && f.asset && assets[f.asset]));
  const hc = vis.hiddenCount[n.id];
  const hasKids = (kids[n.id] || []).length > 0;
  const ptxt = n.html ? plain(n.html) : '';
  return `<div class="${cls.join(' ')}" data-id="${n.id}" style="transform:translate(${n.x}px,${n.y}px);width:${w}px">
<svg class="shape"><path class="outline" style="fill:${look.fill};stroke:${look.stroke};stroke-width:${look.sw}px${look.dash ? ';stroke-dasharray:' + look.dash : ''}"/>${sh.x ? `<path class="extra" style="fill:none;stroke:${look.stroke};stroke-width:${look.sw}px"/>` : ''}</svg>
<div class="body" style="left:${bl}px;width:${bw}px;color:${look.text}">
${tag ? `<div class="ktag">${esc(tag)}</div>` : ''}
${src ? `<img class="hero" src="${esc(src)}" alt="">` : ''}
<div class="title">${esc(n.title || 'Untitled')}</div>
${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
${n.showBody && ptxt ? `<div class="rt${ptxt.length < 160 ? ' short' : ''}">${n.html}</div>` : ''}
${prev.length ? `<div class="thumbs">${prev.slice(0, 6).map(f => thumbHTML(n, f)).join('')}</div>` : ''}
${(n.links.length || other.length) ? `<div class="links">${n.links.map(l => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer" title="${esc(l.url)}">${ICON.link}${esc(l.label || domainOf(l.url))}</a>`).join('')}${other.map(f => `<button class="filechip" data-view="${n.id}|${f.id}" title="${esc(f.path || f.name)}">${ICON.file}${esc(f.name)}</button>`).join('')}</div>` : ''}
</div>
${hasKids ? `<button class="cbtn${n.collapsed ? ' collapsed' : ''}" data-collapse="${n.id}" style="right:10px;bottom:-11px" title="${n.collapsed ? 'Expand' : 'Collapse'} (Space)">${n.collapsed ? '+' + hc : '−'}</button>` : ''}
<div class="handle" data-handle="${n.id}" style="right:-8px;top:calc(50% - 8px)" title="Drag to connect or grow a new node"></div>
<div class="resize" data-resize="${n.id}" title="Drag to resize"></div>
</div>`;
}

function ghostHTML(g) {
  const R = byId[g.remote]; const f = folderById(R.folder);
  return `<div class="gnode" data-ghost="${esc(g.key)}" title="In folder “${esc(f?.name)}” — click to go there">
<small>${ICON.ext}${esc(f?.name || '')}${g.n > 1 ? ' · ' + g.n + ' links' : ''}</small><b>${esc(R.title || 'Untitled')}</b></div>`;
}
function tileHTML(f) {
  const nn = map.nodes.filter(n => n.folder === f.id).length, ff = childFolders(f.id).length;
  const fg = contrastText(f.color);
  return `<div class="ftile${ui.ftile === f.id ? ' sel' : ''}" data-ftile="${f.id}" style="transform:translate(${f.x}px,${f.y}px)" title="Double-click to open">
<div class="tab" style="background:${f.color}"></div><div class="fcard" style="background:${f.color};color:${fg}"><b>${esc(f.name)}</b><small>${nn} node${nn === 1 ? '' : 's'}${ff ? ` · ${ff} folder${ff === 1 ? '' : 's'}` : ''}</small></div></div>`;
}

let canvasQueued = false;
function scheduleCanvas() { if (canvasQueued) return; canvasQueued = true; requestAnimationFrame(() => { canvasQueued = false; renderCanvas(); }); }

function renderCanvas() {
  if (!map) return;
  index(); sideMemo = {};
  const F = ui.folder; const vis = visibility();
  const nodes = map.nodes.filter(n => n.folder === F && !vis.hidden.has(n.id));
  const tiles = childFolders(F);
  // place new folder tiles beside content
  const unplaced = tiles.filter(f => typeof f.x !== 'number');
  if (unplaced.length) {
    const bb = bounds(nodes.map(n => ({ x: n.x, y: n.y, w: n.w, h: sizes[n.id]?.h || 70 })));
    unplaced.forEach((f, i) => { f.x = (bb ? bb.x + bb.w + 120 : 0); f.y = (bb ? bb.y : 0) + i * 100; });
  }
  let html = nodes.map(n => nodeHTML(n, vis)).join('') + tiles.map(tileHTML).join('');
  // edges model needs sizes for ghost offsets; measure nodes first
  layer.innerHTML = html;
  const els = $$('.node', layer); const reads = els.map(el => [el, byId[el.dataset.id], el.querySelector('.body').offsetHeight]);
  for (const [el, n, ch] of reads) {
    const sh = SHAPES[shapeOf(n)]; const w = n.w;
    let h = Math.ceil((ch + sh.pt + sh.pb) / (1 - 2 * sh.fy));
    h = Math.max(h, 44, sh.minR ? Math.round(w * sh.minR) : 0);
    sizes[n.id] = { w, h };
    el.style.height = h + 'px';
    const avail = h * (1 - 2 * sh.fy) - sh.pt - sh.pb;
    el.querySelector('.body').style.top = (sh.fy * h + sh.pt + Math.max(0, (avail - ch) / 2)) + 'px';
    const svg = el.querySelector('svg.shape'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.querySelector('.outline').setAttribute('d', sh.d(w, h));
    if (sh.x) svg.querySelector('.extra').setAttribute('d', sh.x(w, h));
  }
  const occupied = nodes.map(n => ({ x: n.x, y: n.y, w: sizes[n.id].w, h: sizes[n.id].h })).concat(tiles.filter(f => typeof f.x === 'number').map(f => ({ x: f.x, y: f.y, w: 175, h: 70 })));
  const model = edgeModel(F, vis, occupied);
  if (model.ghosts.size) layer.insertAdjacentHTML('beforeend', Array.from(model.ghosts.values()).map(ghostHTML).join(''));
  for (const g of model.ghosts.values()) {
    const el = layer.querySelector(`[data-ghost="${CSS.escape(g.key)}"]`); g.el = el; g.w = el.offsetWidth; g.h = el.offsetHeight;
  }
  for (const f of tiles) { const el = layer.querySelector(`[data-ftile="${f.id}"]`); sizes['f:' + f.id] = { w: el.offsetWidth, h: el.offsetHeight }; }
  lastModel = { items: model.items, ghosts: model.ghosts, vis };
  positionGhosts(); drawEdges();
  if (map.layoutPending[F]) { delete map.layoutPending[F]; tidyLayout(F, true); delete map.views[F]; return renderCanvas(); }
  if (!V()) { map.views[F] = { x: 0, y: 0, k: 1 }; fitView(false); }
  applyView();
}

function positionGhosts() {
  for (const g of lastModel.ghosts.values()) {
    const L = byId[g.local]; if (!L) continue; g.x = L.x + g.dx; g.y = L.y + g.dy;
    if (g.el) g.el.style.transform = `translate(${g.x}px,${g.y}px)`;
  }
}
function positionNodes(ids) {
  for (const id of ids) { const n = byId[id]; const el = layer.querySelector(`.node[data-id="${id}"]`); if (el) el.style.transform = `translate(${n.x}px,${n.y}px)`; }
  positionGhosts();
}

function boxOf(key) {
  if (key.startsWith('g:')) { const g = lastModel.ghosts.get(key.slice(2)); return g ? { x: g.x, y: g.y, w: g.w, h: g.h } : null; }
  const n = byId[key]; if (!n) return null; const s = sizes[key] || { w: n.w, h: 60 }; return { x: n.x, y: n.y, w: s.w, h: s.h };
}
function bounds(boxes) {
  if (!boxes.length) return null; let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of boxes) { x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function anchors(A, B) {
  const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2, dx = bx - ax, dy = by - ay;
  const bias = TEMPLATES[map.template].layout === 'LR' ? 1.8 : 1 / 1.8;
  const horiz = bias * Math.abs(dx) / ((A.w + B.w) / 2 + 1) > Math.abs(dy) / ((A.h + B.h) / 2 + 1);
  if (horiz) { const s = dx >= 0 ? 1 : -1; return { p1: [s > 0 ? A.x + A.w : A.x, ay], n1: [s, 0], p2: [s > 0 ? B.x : B.x + B.w, by], n2: [-s, 0], horiz }; }
  const s = dy >= 0 ? 1 : -1; return { p1: [ax, s > 0 ? A.y + A.h : A.y], n1: [0, s], p2: [bx, s > 0 ? B.y : B.y + B.h], n2: [0, -s], horiz };
}
function pathD(A, B, style) {
  const { p1, n1, p2, n2, horiz } = anchors(A, B);
  if (style === 'straight') return `M${p1[0]} ${p1[1]}L${p2[0]} ${p2[1]}`;
  if (style === 'elbow') {
    if (horiz) { const mx = (p1[0] + p2[0]) / 2; return `M${p1[0]} ${p1[1]}H${mx}V${p2[1]}H${p2[0]}`; }
    const my = (p1[1] + p2[1]) / 2; return `M${p1[0]} ${p1[1]}V${my}H${p2[0]}V${p2[1]}`;
  }
  const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const c = clamp(dist * .45, 24, 170);
  return `M${p1[0]} ${p1[1]}C${p1[0] + n1[0] * c} ${p1[1] + n1[1] * c} ${p2[0] + n2[0] * c} ${p2[1] + n2[1] * c} ${p2[0]} ${p2[1]}`;
}

function drawEdges(temp) {
  const mk = new Map(); let defsHtml = '';
  const marker = (color, type) => {
    const key = type + color; if (mk.has(key)) return mk.get(key); const id = 'mk' + mk.size; mk.set(key, id);
    defsHtml += type === 'bar'
      ? `<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="16" viewBox="0 0 14 16" refX="13" refY="8" orient="auto"><path d="M1 3L8 8L1 13Z" style="fill:${color}"/><path d="M12 1V15" style="stroke:${color};stroke-width:2.6"/></marker>`
      : `<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="13" viewBox="0 0 12 12" refX="11" refY="6" orient="auto-start-reverse"><path d="M1 1.5L11 6L1 10.5Z" style="fill:${color}"/></marker>`;
    return id;
  };
  let svg = '', boxes = [], labels = '';
  const style = map.settings.edgeStyle || 'curve';
  for (const it of lastModel.items) {
    const A = boxOf(it.from), B = boxOf(it.to); if (!A || !B) continue; boxes.push(A, B);
    const e = it.edge; const rel = relOf(e);
    const color = it.ghost ? 'var(--muted)' : edgeColor(e);
    const d = pathD(A, B, style);
    const sel = it.ids.includes(ui.edge);
    const endM = e.dir === 'none' ? '' : `marker-end="url(#${marker(color, rel === 'counters' ? 'bar' : 'arrow')})"`;
    const startM = e.dir === 'both' ? `marker-start="url(#${marker(color, 'arrow')})"` : '';
    const cls = ['edge']; if (it.ghost) cls.push('ghost'); if (sel) cls.push('sel'); if (e.dashed || rel === 'evidence') cls.push('dashed');
    svg += `<path class="${cls.join(' ')}" data-k="${esc(it.key)}" d="${d}" style="stroke:${color}" ${endM} ${startM}/><path class="edge-hit" data-edge="${esc(it.key)}" d="${d}"/>`;
    const lab = it.count > 1 ? `×${it.count}` : (it.ghost && !it.cross && it.rer) ? '' : e.label;
    if (lab) labels += `<div class="elabel${it.ghost ? ' ghost' : ''}${sel ? ' sel' : ''}" data-edge="${esc(it.key)}" data-lk="${esc(it.key)}">${esc(lab)}</div>`;
  }
  if (temp) { svg += `<path class="edge temp" d="${temp}"/>`; }
  defs.innerHTML = defsHtml; eg.innerHTML = svg; labelsEl.innerHTML = labels;
  // place labels at path midpoints
  for (const lab of labelsEl.children) {
    const p = eg.querySelector(`path.edge[data-k="${CSS.escape(lab.dataset.lk)}"]`); if (!p) continue;
    const L = p.getTotalLength(); const pt = p.getPointAtLength(L / 2); lab.style.left = pt.x + 'px'; lab.style.top = pt.y + 'px';
  }
  const bb = bounds(boxes.length ? boxes : [{ x: 0, y: 0, w: 1, h: 1 }]); const pad = 400;
  edgesSvg.style.left = (bb.x - pad) + 'px'; edgesSvg.style.top = (bb.y - pad) + 'px';
  edgesSvg.setAttribute('width', bb.w + pad * 2); edgesSvg.setAttribute('height', bb.h + pad * 2);
  eg.setAttribute('transform', `translate(${-(bb.x - pad)},${-(bb.y - pad)})`);
}

function fitView(animate = true) {
  const F = ui.folder; const vis = lastModel.vis || visibility();
  const boxes = map.nodes.filter(n => n.folder === F && !vis.hidden.has(n.id)).map(n => boxOf(n.id));
  for (const f of childFolders(F)) if (typeof f.x === 'number') boxes.push({ x: f.x, y: f.y, ...(sizes['f:' + f.id] || { w: 170, h: 60 }) });
  for (const g of lastModel.ghosts.values()) if (g.x !== undefined) boxes.push({ x: g.x, y: g.y, w: g.w || 150, h: g.h || 40 });
  const r = stage.getBoundingClientRect(); const bb = bounds(boxes);
  const v = map.views[F] ||= { x: 0, y: 0, k: 1 };
  if (!bb) { v.k = 1; v.x = r.width / 2; v.y = r.height / 2; applyView(); return; }
  const leftPad = 70, pad = 50;
  const k = clamp(Math.min((r.width - leftPad - pad) / bb.w, (r.height - pad * 2) / bb.h), .2, 1.15);
  v.k = k; v.x = leftPad + (r.width - leftPad - pad - bb.w * k) / 2 - bb.x * k; v.y = (r.height - bb.h * k) / 2 - bb.y * k;
  applyView();
}
function zoomAt(cx, cy, factor) {
  const v = V(); const r = stage.getBoundingClientRect(); const px = cx - r.left, py = cy - r.top;
  const k2 = clamp(v.k * factor, .12, 3); const f = k2 / v.k;
  v.x = px - (px - v.x) * f; v.y = py - (py - v.y) * f; v.k = k2; applyView();
}
function centerOn(id) {
  const b = boxOf(id); if (!b) return; const r = stage.getBoundingClientRect(); const v = V();
  if (v.k < .6) v.k = .9;
  v.x = r.width / 2 - (b.x + b.w / 2) * v.k; v.y = r.height / 2 - (b.y + b.h / 2) * v.k; applyView();
}

/* ---------- chrome: top bar, folder bar, rail, legend ---------- */
function renderTop() {
  const nm = $('#mapName'); if (document.activeElement !== nm) nm.value = map.name;
  $('#tplBadge').textContent = TEMPLATES[map.template].label;
  updUndo();
}
function renderFolderBar() {
  const bar = $('#folderBar'); const cur = ui.folder;
  const path = new Set(folderPath(cur).map(f => f.id));
  bar.innerHTML = folderTree().map(([f, d]) => {
    const cnt = map.nodes.filter(n => n.folder === f.id).length;
    return `<button class="ftab${f.id === cur ? ' on' : ''}" data-ftab="${f.id}" title="${f.id === cur ? 'Click for folder settings · double-click to rename' : 'Open folder'}">${d ? `<span class="depth">${'›'.repeat(d)}</span>` : ''}<span class="sw" style="background:${f.color}"></span>${esc(f.name)}<span class="cnt">${cnt}</span></button>`;
  }).join('') + `<span class="fsep"></span><button class="ftab" id="addFolderBtn" title="New folder inside “${esc(folderById(cur).name)}”">${ICON.folderPlus.replace('<svg', '<svg width="15" height="15"')} Folder</button>`;
  void path;
}
function renderRail() {
  $('#rail').innerHTML = `
<button class="iconbtn" data-rail="add" title="Add node (N)">${ICON.node}</button>
<button class="iconbtn" data-rail="folder" title="New folder">${ICON.folderPlus}</button>
<button class="iconbtn" data-rail="tidy" title="Tidy layout (L)">${ICON.tidy}</button>
<div class="sep"></div>
<button class="iconbtn" data-rail="zin" title="Zoom in (+)">${ICON.zin}</button>
<div class="zoomlbl" id="zoomLbl">100%</div>
<button class="iconbtn" data-rail="zout" title="Zoom out (−)">${ICON.zout}</button>
<button class="iconbtn" data-rail="fit" title="Fit to screen (F)">${ICON.fit}</button>`;
}
function renderLegend() {
  const L = $('#legend'); const t = map.template;
  if (t === 'mind') { L.hidden = true; return; }
  L.hidden = false;
  const kinds = TEMPLATES[t].kinds.filter(k => k !== 'idea');
  const head = `<h4>${t === 'debate' ? 'Debate key' : 'Flow chart key'}<button data-legend="toggle">${ui.legend ? 'Hide' : 'Show'}</button></h4>`;
  if (!ui.legend) { L.innerHTML = head; return; }
  let body = `<div class="row">${kinds.map(k => {
    const look = nodeLook({ kind: k, side: map.sides[0]?.id, color: null });
    return `<button class="item" data-addkind="${k}" title="Add ${KINDS[k].label}${KINDS[k].desc ? ' — ' + KINDS[k].desc : ''}">${shapeIcon(KINDS[k].shape, look.stroke === 'var(--edge)' ? 'var(--edge)' : look.stroke, 'none')}${KINDS[k].label}</button>`;
  }).join('')}</div>`;
  if (t === 'debate') body += `<div class="sides">${map.sides.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}<span style="color:var(--muted)">┤ counters · ┅ evidence</span></div>`;
  L.innerHTML = head + body;
}
function renderAll() {
  if (!map) return;
  renderTop(); renderFolderBar(); renderRail(); renderLegend(); renderCanvas(); renderInspector();
}

/* =========================================================
   Model actions
   ========================================================= */
function selectOnly(id) { ui.sel = new Set(id ? [id] : []); ui.edge = null; ui.ftile = null; }
function selNodes() { return Array.from(ui.sel).map(id => byId[id]).filter(Boolean); }

function addNode(o, opt = {}) {
  const n = newNode(o);
  const k = KINDS[n.kind]; if (k && !o.w) n.w = k.w || 200;
  if (map.template === 'debate' && n.kind === 'claim' && !o.side && n.side === null) n.side = map.sides[0]?.id || null;
  map.nodes.push(n); byId[n.id] = n; return n;
}
function makeEdge(from, to, o = {}) {
  if (from === to) return null;
  const dup = map.edges.find(e => (e.from === from && e.to === to) || (e.from === to && e.to === from && e.dir === 'both'));
  if (dup) return dup;
  const e = Object.assign({ id: uid('e'), from, to, dir: 'fwd', label: '' }, o);
  if (map.template === 'flow' && byId[from]?.kind === 'decision' && !o.label) {
    const outs = map.edges.filter(x => x.from === from).map(x => x.label);
    e.label = !outs.includes('Yes') ? 'Yes' : !outs.includes('No') ? 'No' : '';
  }
  map.edges.push(e); return e;
}
function defaultTitle(kind) {
  return ({ root: 'Central idea', idea: 'New idea', claim: 'New claim', argument: 'New argument', counter: 'Counter-argument', evidence: 'Evidence', terminal: 'Start', process: 'New step', decision: 'Decision?', io: 'Input / output', document: 'Document', subprocess: 'Sub-process', data: 'Data store', milestone: 'Milestone' })[kind] || 'New node';
}
/* grow a child from src. dir 'up' = child points at parent (debate) */
function growChild(src, kind, dirMode, at) {
  let n;
  act(() => {
    const s = sizes[src.id] || { w: src.w, h: 60 };
    const L = TEMPLATES[map.template].layout;
    const sib = (kids[src.id] || []).map(i => byId[i]).filter(c => c.folder === src.folder);
    let x, y;
    if (at) { x = at.x; y = at.y; }
    else if (L === 'LR') { x = src.x + s.w + 80; y = sib.length ? Math.max(...sib.map(c => c.y + (sizes[c.id]?.h || 60))) + 24 : src.y; }
    else { y = src.y + s.h + 80; x = sib.length ? Math.max(...sib.map(c => c.x + c.w)) + 30 : src.x; }
    n = addNode({ kind, title: defaultTitle(kind), folder: src.folder, x, y, parent: src.id });
    if (dirMode === 'up') makeEdge(n.id, src.id); else makeEdge(src.id, n.id);
    if (src.collapsed) src.collapsed = false;
    selectOnly(n.id);
  });
  focusTitleSoon();
  return n;
}
function addSibling(src) {
  if (!src.parent || !byId[src.parent]) { const n = createAt(src.kind, { x: src.x, y: src.y + (sizes[src.id]?.h || 60) + 30 }); return n; }
  const p = byId[src.parent]; const up = map.edges.some(e => e.from === src.id && e.to === p.id);
  return growChild(p, src.kind, up ? 'up' : 'down');
}
function createAt(kind, pt) {
  let n; act(() => { n = addNode({ kind, title: defaultTitle(kind), folder: ui.folder, x: Math.round(pt.x), y: Math.round(pt.y) }); selectOnly(n.id); });
  focusTitleSoon(); return n;
}
function focusTitleSoon() { ui.insp = true; setTimeout(() => { const t = $('#f-title'); if (t) { t.focus(); t.select(); } }, 30); }

function deleteSelection() {
  if (ui.edge) { const it = lastModel.items.find(i => i.ids.includes(ui.edge)); const ids = it ? it.ids : [ui.edge]; act(() => { map.edges = map.edges.filter(e => !ids.includes(e.id)); ui.edge = null; }); return; }
  if (ui.ftile) { deleteFolder(ui.ftile); return; }
  const ids = new Set(ui.sel); if (!ids.size) return;
  act(() => {
    for (const id of ids) { const n = byId[id]; if (!n) continue; for (const c of kids[id] || []) if (!ids.has(c)) byId[c].parent = n.parent && !ids.has(n.parent) ? n.parent : null; }
    map.nodes = map.nodes.filter(n => !ids.has(n.id));
    map.edges = map.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
    for (const k of Object.keys(map.ghostPos)) { const [a, b] = k.split('>'); if (ids.has(a) || ids.has(b)) delete map.ghostPos[k]; }
    ui.sel.clear();
  });
  toast(`Deleted ${ids.size} node${ids.size > 1 ? 's' : ''} · Ctrl+Z to undo`);
}
function duplicateSelection() {
  const src = selNodes(); if (!src.length) return;
  act(() => {
    const mp = {}; const out = [];
    for (const n of src) { const c = JSON.parse(JSON.stringify(n)); c.id = uid('n'); c.x += 30; c.y += 30; mp[n.id] = c.id; out.push(c); }
    for (const c of out) { if (c.parent && mp[c.parent]) c.parent = mp[c.parent]; c.dates.forEach(d => d.id = uid('d')); c.links.forEach(l => l.id = uid('l')); c.files.forEach(f => f.id = uid('f')); map.nodes.push(c); }
    for (const e of map.edges.slice()) if (mp[e.from] && mp[e.to]) map.edges.push(Object.assign({}, e, { id: uid('e'), from: mp[e.from], to: mp[e.to] }));
    ui.sel = new Set(out.map(c => c.id));
  });
}
function toggleCollapse(id, force) {
  const n = byId[id]; if (!n || !(kids[id] || []).length) return;
  act(() => { n.collapsed = force === undefined ? !n.collapsed : force; });
}
function setCollapseAll(val) { act(() => { for (const n of map.nodes) if ((kids[n.id] || []).length && n.folder === ui.folder) n.collapsed = val; }); }

function moveNodesToFolder(ids, fid) {
  const f = folderById(fid); if (!f) return;
  const nodes = ids.map(i => byId[i]).filter(n => n && n.folder !== fid); if (!nodes.length) return;
  act(() => {
    const dest = map.nodes.filter(n => n.folder === fid);
    const bb = bounds(nodes.map(n => ({ x: n.x, y: n.y, w: n.w, h: sizes[n.id]?.h || 60 })));
    const db = bounds(dest.map(n => ({ x: n.x, y: n.y, w: n.w, h: sizes[n.id]?.h || 60 })));
    const ox = db ? db.x + db.w + 100 - bb.x : -bb.x, oy = db ? db.y - bb.y : -bb.y;
    // carry collapsed (hidden) descendants along so the branch stays whole
    const carry = new Set(nodes.map(n => n.id));
    for (const n of nodes) if (n.collapsed) for (const d of descendants(n.id)) if (byId[d].folder === n.folder) carry.add(d);
    for (const id of carry) { const n = byId[id]; n.folder = fid; n.x += ox; n.y += oy; }
    ui.sel.clear();
  });
  toast(`Moved ${nodes.length} node${nodes.length > 1 ? 's' : ''} to “${f.name}”`, { label: 'Open', fn: () => goFolder(fid) });
}
function goFolder(fid) { if (!folderById(fid)) return; ui.folder = fid; ui.sel.clear(); ui.edge = null; ui.ftile = null; renderAll(); }
function addFolder(parent = ui.folder, at) {
  let f; act(() => {
    const used = map.folders.map(x => x.color);
    f = { id: uid('f'), name: 'New folder', parent, color: PALETTE.find(c => !used.includes(c)) || PALETTE[map.folders.length % PALETTE.length] };
    if (at) { f.x = Math.round(at.x); f.y = Math.round(at.y); }
    else if (parent === ui.folder) { const c = viewCenter(); f.x = Math.round(c.x - 85); f.y = Math.round(c.y - 30); }
    map.folders.push(f); ui.sel.clear(); ui.edge = null; ui.ftile = f.id;
  });
  setTimeout(() => { const t = $('#f-fname'); if (t) { t.focus(); t.select(); } }, 30);
  return f;
}
async function deleteFolder(fid) {
  if (fid === 'root') return;
  const f = folderById(fid); const nn = map.nodes.filter(n => n.folder === fid).length;
  const ok = await askConfirm(`Delete folder “${f.name}”?`, nn ? `Its ${nn} node${nn > 1 ? 's' : ''} and any sub-folders move up to “${folderById(f.parent).name}”.` : 'The folder is empty.', 'Delete folder');
  if (!ok) return;
  act(() => {
    const bb = bounds(map.nodes.filter(n => n.folder === f.parent).map(n => ({ x: n.x, y: n.y, w: n.w, h: 60 })));
    const ox = bb ? bb.x : 0, oy = bb ? bb.y + bb.h + 120 : 0;
    const mine = map.nodes.filter(n => n.folder === fid); const mb = bounds(mine.map(n => ({ x: n.x, y: n.y, w: n.w, h: 60 })));
    for (const n of mine) { n.folder = f.parent; if (mb) { n.x += ox - mb.x; n.y += oy - mb.y; } }
    for (const c of childFolders(fid)) c.parent = f.parent;
    map.folders = map.folders.filter(x => x.id !== fid);
    delete map.views[fid]; if (ui.folder === fid) ui.folder = f.parent; ui.ftile = null;
  });
}
function goTo(id) {
  const n = byId[id]; if (!n) return;
  const vis = visibility();
  if (vis.hidden.has(id)) act(() => { let p = n.parent, g = 0; while (p && byId[p] && g++ < 500) { byId[p].collapsed = false; p = byId[p].parent; } });
  ui.folder = n.folder; selectOnly(id); renderAll(); centerOn(id);
  const el = layer.querySelector(`.node[data-id="${id}"]`); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2500); }
}
function setParent(id, pid) {
  if (pid && (pid === id || isAncestor(id, pid))) { toast('That would make a loop — a node cannot be the child of its own descendant.'); return; }
  act(() => { byId[id].parent = pid || null; });
}

/* ---------- tidy layout (layered, per folder) ---------- */
function tidyLayout(F = ui.folder, silent = false) {
  index(); const vis = visibility();
  const nodes = map.nodes.filter(n => n.folder === F && !vis.hidden.has(n.id)); if (!nodes.length) return;
  const T = TEMPLATES[map.template]; const LR = T.layout === 'LR';
  const ids = new Set(nodes.map(n => n.id)); const succ = {}, pred = {};
  const link = (a, b) => { if (a === b || !ids.has(a) || !ids.has(b)) return; (succ[a] ||= new Set()).add(b); (pred[b] ||= new Set()).add(a); };
  for (const n of nodes) if (n.parent && ids.has(n.parent)) link(n.parent, n.id);
  const treeOnly = map.template === 'mind';
  for (const e of map.edges) { const a = vis.rep[e.from], b = vis.rep[e.to]; const [u, v] = T.reverse ? [b, a] : [a, b]; if (treeOnly && byId[v]?.parent && ids.has(byId[v].parent)) continue; link(u, v); }
  // break cycles with DFS
  const state = {}, order = [], back = new Set();
  const visit = id => { state[id] = 1; for (const s of succ[id] || []) { if (state[s] === 1) back.add(id + '>' + s); else if (!state[s]) visit(s); } state[id] = 2; order.push(id); };
  const starts = nodes.slice().sort((a, b) => (pred[a.id]?.size || 0) - (pred[b.id]?.size || 0) || (LR ? a.y - b.y : a.x - b.x));
  for (const n of starts) if (!state[n.id]) visit(n.id);
  order.reverse();
  const layerOf = {};
  for (const id of order) { let l = 0; for (const p of pred[id] || []) if (!back.has(p + '>' + id)) l = Math.max(l, (layerOf[p] ?? 0) + 1); layerOf[id] = l; }
  const layers = []; for (const id of order) (layers[layerOf[id]] ||= []).push(id);
  const sz = id => sizes[id] || { w: byId[id].w, h: 70 };
  const cross = id => LR ? sz(id).h : sz(id).w, main = id => LR ? sz(id).w : sz(id).h;
  const ord = {}; map.nodes.forEach((n, i) => ord[n.id] = i);
  const pos = {}; layers.forEach(L => L.sort((a, b) => (LR ? byId[a].y - byId[b].y : byId[a].x - byId[b].x) || ord[a] - ord[b]).forEach((id, i) => pos[id] = i));
  const preds = id => [...(pred[id] || [])].filter(p => !back.has(p + '>' + id) && layerOf[p] < layerOf[id]);
  const succs = id => [...(succ[id] || [])].filter(s => !back.has(id + '>' + s) && layerOf[s] > layerOf[id]);
  for (let pass = 0; pass < 2; pass++) {
    const down = true; const seq = layers.slice(1);
    for (const L of seq) {
      const bc = {}; for (const id of L) { const nb = down ? preds(id) : succs(id); bc[id] = nb.length ? nb.reduce((s, p) => s + pos[p], 0) / nb.length : pos[id]; }
      L.sort((a, b) => bc[a] - bc[b]); L.forEach((id, i) => pos[id] = i);
    }
  }
  const GAP_MAIN = LR ? 90 : 70, GAP_CROSS = LR ? 22 : 34;
  const c = {}; // cross-axis start coordinate
  layers.forEach((L, li) => {
    if (li === 0) { let acc = 0; for (const id of L) { c[id] = acc; acc += cross(id) + GAP_CROSS * 2; } return; }
    const want = {}; for (const id of L) { const p = preds(id); want[id] = p.length ? p.reduce((s, q) => s + c[q] + cross(q) / 2, 0) / p.length - cross(id) / 2 : null; }
    let prevEnd = -Infinity; const placed = [];
    for (const id of L) { const w = want[id] ?? (prevEnd === -Infinity ? 0 : prevEnd); const x = Math.max(w, prevEnd); c[id] = x; prevEnd = x + cross(id) + GAP_CROSS; placed.push(id); }
    const diffs = placed.filter(id => want[id] !== null).map(id => c[id] - want[id]);
    if (diffs.length) { const shift = diffs.reduce((a, b) => a + b, 0) / diffs.length; placed.forEach(id => c[id] -= shift); }
  });
  // upward pass: centre parents over their children, keeping order and spacing
  for (let li = layers.length - 2; li >= 0; li--) {
    let prevEnd = -Infinity;
    for (const id of layers[li]) {
      const s = succs(id); let x = c[id];
      if (s.length) x = s.reduce((a, q) => a + c[q] + cross(q) / 2, 0) / s.length - cross(id) / 2;
      x = Math.max(x, prevEnd); c[id] = x; prevEnd = x + cross(id) + GAP_CROSS * (li === 0 ? 2 : 1);
    }
  }
  let acc = 0; const m = {};
  layers.forEach(L => { const mx = Math.max(...L.map(main)); for (const id of L) m[id] = acc + (LR ? 0 : (mx - main(id)) / 2); acc += mx + GAP_MAIN; });
  const old = bounds(nodes.map(n => ({ x: n.x, y: n.y, w: n.w, h: 1 })));
  const apply = () => {
    for (const n of nodes) { if (LR) { n.x = m[n.id]; n.y = c[n.id]; } else { n.x = c[n.id]; n.y = m[n.id]; } }
    const nb = bounds(nodes.map(n => ({ x: n.x, y: n.y, w: n.w, h: 1 })));
    for (const n of nodes) { n.x = Math.round(n.x - nb.x + old.x); n.y = Math.round(n.y - nb.y + old.y); }
    // tuck folder tiles under the layout
    const fb = bounds(nodes.map(n => ({ x: n.x, y: n.y, w: n.w, h: sz(n.id).h })));
    childFolders(F).forEach((f, i) => { f.x = fb.x + i * 200; f.y = fb.y + fb.h + 90; });
    for (const k of Object.keys(map.ghostPos)) if (ids.has(k.split('>')[0])) delete map.ghostPos[k];
  };
  if (silent) { apply(); return; }
  world.classList.add('animate'); act(apply); setTimeout(() => world.classList.remove('animate'), 400);
}

/* =========================================================
   Pointer, wheel, keyboard interaction on the field
   ========================================================= */
const pointers = new Map(); let pinch = null; let gesture = null;

function track(e, { move, up, threshold = 3 }) {
  const sx = e.clientX, sy = e.clientY, pid = e.pointerId; let moved = false;
  try { stage.setPointerCapture(pid); } catch { }
  const mv = ev => { if (ev.pointerId !== pid || pinch) return; const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < threshold) return; moved = true; move && move(dx, dy, ev); };
  const end = ev => { if (ev.pointerId !== pid) return; cleanup(); up && up(moved, ev); };
  const cleanup = () => { stage.removeEventListener('pointermove', mv); stage.removeEventListener('pointerup', end); stage.removeEventListener('pointercancel', end); gesture = null; stage.classList.remove('panning'); };
  stage.addEventListener('pointermove', mv); stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  gesture = { cancel: cleanup };
}

function renderSelClasses() {
  for (const el of layer.querySelectorAll('.node')) el.classList.toggle('sel', ui.sel.has(el.dataset.id));
  for (const el of layer.querySelectorAll('.ftile')) el.classList.toggle('sel', ui.ftile === el.dataset.ftile);
  drawEdges();
}
function afterSelect() { renderSelClasses(); renderInspector(); }

stage.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    if (gesture) gesture.cancel();
    const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return;
  }
  const t = e.target;
  if (t.closest('.rail,.legend')) return;
  closeMenus();
  if (t.closest('a')) return;
  if (e.button === 1) { e.preventDefault(); startPan(e, false); return; }
  const cb = t.closest('[data-collapse]'); if (cb) { e.preventDefault(); toggleCollapse(cb.dataset.collapse); return; }
  const h = t.closest('[data-handle]'); if (h) { e.preventDefault(); startConnect(e, h.dataset.handle); return; }
  const rz = t.closest('[data-resize]'); if (rz) { e.preventDefault(); startResize(e, rz.dataset.resize); return; }
  const vw = t.closest('[data-view]');
  const ne = t.closest('.node'); if (ne) { startNodeDrag(e, ne.dataset.id, vw ? () => { const [nid, fid] = vw.dataset.view.split('|'); openViewer(nid, fid); } : null); return; }
  const g = t.closest('[data-ghost]'); if (g) { startGhostDrag(e, g.dataset.ghost); return; }
  const ft = t.closest('[data-ftile]'); if (ft) { startTileDrag(e, ft.dataset.ftile); return; }
  const ed = t.closest('[data-edge]');
  if (ed) { const it = lastModel.items.find(i => i.key === ed.dataset.edge); if (it) { ui.sel.clear(); ui.ftile = null; ui.edge = it.ids[0]; ui.insp = true; afterSelect(); } return; }
  if (e.shiftKey) startMarquee(e); else startPan(e, true);
});
stage.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const v = V(); v.x += cx - pinch.cx; v.y += cy - pinch.cy; zoomAt(cx, cy, d / (pinch.d || d)); pinch = { d, cx, cy };
  }
});
const pEnd = e => { pointers.delete(e.pointerId); if (pointers.size < 2 && pinch) { pinch = null; scheduleSave(); } };
stage.addEventListener('pointerup', pEnd); stage.addEventListener('pointercancel', pEnd);

function startPan(e, clickClears) {
  const v = V(), x0 = v.x, y0 = v.y;
  track(e, {
    move(dx, dy) { stage.classList.add('panning'); v.x = x0 + dx; v.y = y0 + dy; applyView(); },
    up(moved) { if (moved) { scheduleSave(); return; } if (clickClears && (ui.sel.size || ui.edge || ui.ftile)) { ui.sel.clear(); ui.edge = null; ui.ftile = null; afterSelect(); } stage.focus({ preventScroll: true }); },
  });
}
function dropTargetAt(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return null;
  const ft = el.closest('[data-ftile]'); if (ft) return { el: ft, folder: ft.dataset.ftile };
  const tb = el.closest('[data-ftab]'); if (tb && tb.dataset.ftab !== ui.folder) return { el: tb, folder: tb.dataset.ftab };
  return null;
}
function startNodeDrag(e, id, click) {
  const additive = e.shiftKey || e.metaKey || e.ctrlKey;
  if (additive) { if (ui.sel.has(id)) ui.sel.delete(id); else ui.sel.add(id); ui.edge = null; ui.ftile = null; afterSelect(); return; }
  const wasSel = ui.sel.has(id);
  if (!wasSel) { selectOnly(id); afterSelect(); }
  const moving = selNodes().filter(n => n.folder === ui.folder);
  const vis = lastModel.vis; const all = new Set(moving);
  for (const m of moving) if (m.collapsed) for (const d of descendants(m.id)) if (vis.hidden.has(d)) all.add(byId[d]);
  const start = [...all].map(m => [m, m.x, m.y]);
  const els = moving.map(m => layer.querySelector(`.node[data-id="${m.id}"]`)).filter(Boolean);
  let pushed = false, drop = null;
  track(e, {
    move(dx, dy, ev) {
      if (!pushed) { pushUndo(); pushed = true; els.forEach(el => el.classList.add('dragging')); }
      const k = V().k; for (const [m, x, y] of start) { m.x = Math.round(x + dx / k); m.y = Math.round(y + dy / k); }
      positionNodes(moving.map(m => m.id)); drawEdges();
      const d = dropTargetAt(ev.clientX, ev.clientY);
      if (drop?.el !== d?.el) { drop?.el.classList.remove('drop'); d?.el.classList.add('drop'); }
      drop = d;
    },
    up(moved) {
      els.forEach(el => el.classList.remove('dragging')); drop?.el.classList.remove('drop');
      if (!moved) { if (click) click(); else if (wasSel && ui.sel.size > 1) { selectOnly(id); afterSelect(); } return; }
      if (drop) { const ids = moving.map(m => m.id); undoStack.pop(); for (const [m, x, y] of start) { m.x = x; m.y = y; } moveNodesToFolder(ids, drop.folder); return; }
      scheduleSave();
    },
  });
}
function startResize(e, id) {
  const n = byId[id], w0 = n.w; let pushed = false;
  track(e, { move(dx) { if (!pushed) { pushUndo(); pushed = true; } n.w = Math.round(clamp(w0 + dx / V().k, 110, 640)); scheduleCanvas(); }, up(m) { if (m) scheduleSave(); } });
}
function startGhostDrag(e, key) {
  const g = lastModel.ghosts.get(key); if (!g) return; const dx0 = g.dx, dy0 = g.dy; let pushed = false;
  track(e, {
    move(dx, dy) { if (!pushed) { pushUndo(); pushed = true; } const k = V().k; g.dx = dx0 + dx / k; g.dy = dy0 + dy / k; map.ghostPos[key] = { dx: Math.round(g.dx), dy: Math.round(g.dy) }; positionGhosts(); drawEdges(); },
    up(moved) { if (moved) scheduleSave(); else goTo(g.remote); },
  });
}
function startTileDrag(e, fid) {
  const f = folderById(fid); const el = layer.querySelector(`[data-ftile="${fid}"]`);
  if (ui.ftile !== fid) { ui.sel.clear(); ui.edge = null; ui.ftile = fid; afterSelect(); }
  const x0 = f.x, y0 = f.y; let pushed = false;
  track(e, { move(dx, dy) { if (!pushed) { pushUndo(); pushed = true; } const k = V().k; f.x = Math.round(x0 + dx / k); f.y = Math.round(y0 + dy / k); el.style.transform = `translate(${f.x}px,${f.y}px)`; }, up(m) { if (m) scheduleSave(); } });
}
function startMarquee(e) {
  const r = stage.getBoundingClientRect(); const box = document.createElement('div'); box.className = 'marquee'; stage.appendChild(box);
  const base = new Set(ui.sel); const sx = e.clientX, sy = e.clientY;
  track(e, {
    move(dx, dy, ev) {
      const x1 = Math.min(sx, ev.clientX), y1 = Math.min(sy, ev.clientY), x2 = Math.max(sx, ev.clientX), y2 = Math.max(sy, ev.clientY);
      Object.assign(box.style, { left: x1 - r.left + 'px', top: y1 - r.top + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
      const a = toWorld(x1, y1), b = toWorld(x2, y2); ui.sel = new Set(base); ui.edge = null; ui.ftile = null;
      for (const el of layer.querySelectorAll('.node')) { const B = boxOf(el.dataset.id); if (B && B.x < b.x && B.x + B.w > a.x && B.y < b.y && B.y + B.h > a.y) ui.sel.add(el.dataset.id); }
      for (const el of layer.querySelectorAll('.node')) el.classList.toggle('sel', ui.sel.has(el.dataset.id));
    },
    up() { box.remove(); afterSelect(); },
  });
}
function startConnect(e, id) {
  const src = byId[id]; let target = null, hl = null;
  track(e, {
    threshold: 2,
    move(dx, dy, ev) {
      const p = toWorld(ev.clientX, ev.clientY); const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const ne = el?.closest('.node'), ge = el?.closest('[data-ghost]');
      target = ne && ne.dataset.id !== id ? ne.dataset.id : ge ? lastModel.ghosts.get(ge.dataset.ghost)?.remote : null;
      const nh = ne && ne.dataset.id !== id ? ne : ge || null; if (hl !== nh) { hl?.classList.remove('drop-target'); nh?.classList.add('drop-target'); hl = nh; }
      const A = boxOf(id); const B = target && ne ? boxOf(target) : ge ? boxOf('g:' + ge.dataset.ghost) : { x: p.x, y: p.y, w: 1, h: 1 };
      drawEdges(pathD(A, B, target ? map.settings.edgeStyle : 'curve'));
    },
    up(moved, ev) {
      hl?.classList.remove('drop-target'); drawEdges();
      const opts = childOptions(src);
      const grow = at => { if (opts.length === 1) growChild(src, opts[0][0], opts[0][1], at && { x: at.x - (KINDS[opts[0][0]].w || 200) / 2, y: at.y - 24 }); else kindMenu(ev.clientX, ev.clientY, opts, (k, d) => growChild(src, k, d, at && { x: at.x - (KINDS[k].w || 200) / 2, y: at.y - 24 }), src); };
      if (!moved) { grow(null); return; }
      if (target) { act(() => { makeEdge(id, target); }); toast('Linked'); return; }
      grow(toWorld(ev.clientX, ev.clientY));
    },
  });
}
stage.addEventListener('dblclick', e => {
  const t = e.target; if (t.closest('.rail,.legend,[data-ghost],[data-edge],.cbtn,.handle,a')) return;
  const ft = t.closest('[data-ftile]'); if (ft) { goFolder(ft.dataset.ftile); return; }
  const ne = t.closest('.node'); if (ne) { selectOnly(ne.dataset.id); ui.insp = true; renderAll(); focusTitleSoon(); return; }
  addMenuAt(e.clientX, e.clientY, toWorld(e.clientX, e.clientY));
});
function addMenuAt(cx, cy, p) {
  const T = TEMPLATES[map.template];
  const has = map.nodes.some(n => n.folder === ui.folder);
  const place = k => createAt(k, { x: p.x - (KINDS[k].w || 200) / 2, y: p.y - 24 });
  if (map.template === 'mind') { place(has ? 'idea' : 'root'); return; }
  if (cx === null) { const r = stage.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  kindMenu(cx, cy, T.kinds.map(k => [k, 'down']), k => place(k));
}
stage.addEventListener('wheel', e => {
  if (e.target.closest('.rail,.legend')) return; e.preventDefault();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-dy * .01));
  else if (prefs.wheel === 'zoom' && !e.shiftKey) zoomAt(e.clientX, e.clientY, Math.exp(-dy * .0015));
  else { const v = V(); v.x -= e.shiftKey && !dx ? dy : dx; v.y -= e.shiftKey && !dx ? 0 : dy; applyView(); }
  clearTimeout(stage._vt); stage._vt = setTimeout(scheduleSave, 400);
}, { passive: false });
function zoomCenter(f) { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); scheduleSave(); }

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  const t = e.target; const typing = t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]');
  const mod = e.ctrlKey || e.metaKey; const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'Escape') {
    if (closeTop()) { e.preventDefault(); return; }
    if (typing) { t.blur(); return; }
    ui.sel.clear(); ui.edge = null; ui.ftile = null; afterSelect(); return;
  }
  if (mod && key === 's') { e.preventDefault(); saveNow(); toast('Saved to this browser'); return; }
  if (typing || document.querySelector('.scrim')) return;
  if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && key === 'y') { e.preventDefault(); redo(); return; }
  if (mod && key === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (mod && key === 'a') { e.preventDefault(); ui.sel = new Set($$('.node', layer).map(el => el.dataset.id)); afterSelect(); return; }
  if (mod || e.altKey) return;
  const one = ui.sel.size === 1 ? byId[[...ui.sel][0]] : null;
  const nudge = (dx, dy) => { const ns = selNodes(); if (!ns.length) return false; act(() => ns.forEach(n => { n.x += dx; n.y += dy; }), { canvasOnly: true }); return true; };
  const step = e.shiftKey ? 1 : 10;
  switch (key) {
    case 'Tab': e.preventDefault(); if (one) { const o = childOptions(one); growChild(one, o[0][0], o[0][1]); } break;
    case 'Enter': e.preventDefault(); if (one) { if (e.shiftKey) focusTitleSoon(); else addSibling(one); } break;
    case 'Delete': case 'Backspace': e.preventDefault(); deleteSelection(); break;
    case ' ': e.preventDefault(); if (one) toggleCollapse(one.id); break;
    case 'f': fitView(); scheduleSave(); break;
    case 'l': tidyLayout(); break;
    case 'n': addMenuAt(null, null, viewCenter()); break;
    case 'i': ui.insp = !ui.insp; renderInspector(); break;
    case '+': case '=': zoomCenter(1.2); break;
    case '-': case '_': zoomCenter(1 / 1.2); break;
    case 'ArrowUp': if (nudge(0, -step)) e.preventDefault(); break;
    case 'ArrowDown': if (nudge(0, step)) e.preventDefault(); break;
    case 'ArrowLeft': if (nudge(-step, 0)) e.preventDefault(); break;
    case 'ArrowRight': if (nudge(step, 0)) e.preventDefault(); break;
  }
});

/* ---------- chrome events ---------- */
$('#folderBar').addEventListener('click', e => {
  if (e.target.closest('#addFolderBtn')) { addFolder(ui.folder); return; }
  const b = e.target.closest('[data-ftab]'); if (!b) return;
  const fid = b.dataset.ftab;
  if (fid === ui.folder) { ui.sel.clear(); ui.edge = null; ui.ftile = fid; ui.insp = true; renderSelClasses(); renderInspector(); }
  else goFolder(fid);
});
$('#folderBar').addEventListener('dblclick', e => {
  const b = e.target.closest('[data-ftab]'); if (!b) return; const f = folderById(b.dataset.ftab);
  const inp = document.createElement('input'); inp.className = 'field'; inp.value = f.name; inp.style.width = '140px'; inp.style.padding = '3px 6px';
  b.replaceWith(inp); inp.focus(); inp.select();
  const done = save => { if (save && inp.value.trim() && inp.value.trim() !== f.name) act(() => { f.name = inp.value.trim(); }); else renderFolderBar(); };
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.dataset.cancel = 1; inp.blur(); } });
  inp.addEventListener('blur', () => done(!inp.dataset.cancel));
});
$('#rail').addEventListener('click', e => {
  const b = e.target.closest('[data-rail]'); if (!b) return;
  const a = b.dataset.rail;
  if (a === 'add') { const r = b.getBoundingClientRect(); const c = viewCenter(); if (map.template === 'mind') addMenuAt(null, null, c); else kindMenu(r.right + 6, r.top, TEMPLATES[map.template].kinds.map(k => [k, 'down']), k => createAt(k, { x: c.x - (KINDS[k].w || 200) / 2, y: c.y - 24 })); }
  if (a === 'folder') addFolder(ui.folder);
  if (a === 'tidy') tidyLayout();
  if (a === 'fit') { fitView(); scheduleSave(); }
  if (a === 'zin') zoomCenter(1.25);
  if (a === 'zout') zoomCenter(1 / 1.25);
});
$('#legend').addEventListener('click', e => {
  if (e.target.closest('[data-legend]')) { ui.legend = !ui.legend; renderLegend(); return; }
  const b = e.target.closest('[data-addkind]'); if (!b) return; const c = viewCenter(); const k = b.dataset.addkind;
  createAt(k, { x: c.x - (KINDS[k].w || 200) / 2 + (Math.random() * 40 - 20), y: c.y - 24 + (Math.random() * 40 - 20) });
});
$('#mapName').addEventListener('focus', () => pushUndo());
$('#mapName').addEventListener('input', e => { map.name = e.target.value; scheduleSave(); });
$('#mapName').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;
$('#inspToggle').onclick = () => { ui.insp = !ui.insp; renderInspector(); };
$('#mapsBtn').onclick = () => openLibrary();
$('#newBtn').onclick = () => openNew();
$('#importBtn').onclick = () => openImport();
$('#exportBtn').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  popMenu(r.left, r.bottom + 4, `<div class="mh">Export “${esc(map.name)}”</div>
<button data-x="json">${ICON.file}Map file (.json)<small>re-importable</small></button>
<button data-x="md">${ICON.file}Outline (.md)<small>text only</small></button>
<button data-x="copy">${ICON.copy}Copy map JSON<small>clipboard</small></button>`, async b => {
    if (b.dataset.x === 'json') exportJSON();
    if (b.dataset.x === 'md') exportMarkdown();
    if (b.dataset.x === 'copy') { const txt = JSON.stringify(exportEnvelope()); try { await navigator.clipboard.writeText(txt); toast('Map JSON copied — paste it into Import on any device'); } catch { openTextModal('Map JSON', txt); } }
  });
};

/* drag & drop files: .json imports, files dropped on a node attach to it */
let dragDepth = 0, dz = null;
window.addEventListener('dragenter', e => { if (!e.dataTransfer?.types?.includes('Files')) return; dragDepth++; if (!dz) { dz = document.createElement('div'); dz.className = 'dropzone'; dz.textContent = 'Drop on a node to attach · drop a .json map anywhere to import'; document.body.appendChild(dz); } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dz?.remove(); dz = null; } });
window.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', async e => {
  if (!e.dataTransfer?.files?.length) return; e.preventDefault(); dragDepth = 0; dz?.remove(); dz = null;
  const files = Array.from(e.dataTransfer.files);
  const ne = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node');
  if (!ne && files.length === 1 && /\.json$/i.test(files[0].name)) { importFile(files[0]); return; }
  let target = ne ? byId[ne.dataset.id] : null;
  if (!target) { const p = toWorld(e.clientX, e.clientY); target = createAt(TEMPLATES[map.template].def === 'argument' ? 'evidence' : 'idea', { x: p.x - 100, y: p.y - 24 }); target.title = files[0].name.replace(/\.[^.]+$/, ''); }
  attachFiles(target.id, files);
});

/* =========================================================
   Menus, modals, viewer, library, search, attachments
   ========================================================= */
let toastTimer;
function toast(msg, action) {
  $('.toast')?.remove(); clearTimeout(toastTimer);
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = esc(msg) + (action ? ` <button class="btn sm" style="margin-left:8px">${esc(action.label)}</button>` : '');
  if (action) t.querySelector('button').onclick = () => { t.remove(); action.fn(); };
  document.body.appendChild(t); toastTimer = setTimeout(() => t.remove(), action ? 5000 : 2600);
}
function closeMenus() { $$('.menu,.results').forEach(m => m.remove()); }
function closeTop() {
  const m = $('.menu,.results'); if (m) { closeMenus(); return true; }
  const s = $$('.scrim').pop(); if (s) { s._close ? s._close() : s.remove(); return true; }
  return false;
}
function popMenu(x, y, html, onPick) {
  closeMenus(); const m = document.createElement('div'); m.className = 'menu'; m.innerHTML = html; document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px'; m.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; closeMenus(); onPick(b); });
  setTimeout(() => { const off = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } }; document.addEventListener('pointerdown', off, true); }, 0);
  m.querySelector('button')?.focus();
  m.addEventListener('keydown', e => { const bs = $$('button', m); const i = bs.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); } });
  return m;
}
function kindMenu(x, y, opts, cb, src) {
  const label = (k, d) => {
    if (map.template === 'debate' && src) {
      if (k === 'argument' && src.kind === 'claim') return 'Argument for this claim';
      if (k === 'argument') return 'Supporting argument';
      if (k === 'evidence') return 'Evidence for this';
      if (k === 'counter') return 'Counter-argument';
    }
    return KINDS[k].label;
  };
  popMenu(x, y, `<div class="mh">${src ? 'Grow from “' + esc((src.title || '').slice(0, 24)) + '”' : 'Add'}</div>` + opts.map(([k, d], i) => {
    const look = nodeLook({ kind: k, side: map.sides[0]?.id });
    return `<button data-i="${i}">${shapeIcon(KINDS[k].shape, look.stroke, 'none')}${esc(label(k, d))}</button>`;
  }).join(''), b => { const [k, d] = opts[+b.dataset.i]; cb(k, d); });
}
function modal(title, bodyHTML, { footer = '', size = '', onClose } = {}) {
  const s = document.createElement('div'); s.className = 'scrim';
  s.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="Close">${ICON.x}</button></header><div class="mbody">${bodyHTML}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
  const close = () => { s.remove(); onClose && onClose(); };
  s._close = close;
  s.addEventListener('pointerdown', e => { if (e.target === s) close(); });
  s.querySelector('[data-close]').onclick = close;
  document.body.appendChild(s); return { el: s, close, body: s.querySelector('.mbody') };
}
function askConfirm(title, msg, okLabel = 'OK') {
  return new Promise(res => {
    const m = modal(title, `<p class="note" style="font-size:14px;color:var(--fg)">${esc(msg)}</p>`, { size: 'sm', footer: `<button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>${esc(okLabel)}</button>`, onClose: () => res(false) });
    m.el.querySelector('[data-no]').onclick = () => m.close();
    const y = m.el.querySelector('[data-yes]'); y.onclick = () => { m.el.remove(); res(true); }; y.focus();
  });
}
function askText(title, label, value = '', placeholder = '') {
  return new Promise(res => {
    const m = modal(title, `<label class="lbl" for="askIn">${esc(label)}</label><input class="field" id="askIn" value="${esc(value)}" placeholder="${esc(placeholder)}">`, { size: 'sm', footer: `<button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>OK</button>`, onClose: () => res(null) });
    const inp = m.el.querySelector('#askIn'); setTimeout(() => { inp.focus(); inp.select(); }, 10);
    const ok = () => { const v = inp.value; m.el.remove(); res(v); };
    m.el.querySelector('[data-yes]').onclick = ok; m.el.querySelector('[data-no]').onclick = () => m.close();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}
function openTextModal(title, text) {
  const m = modal(title, `<p class="note">Select all and copy this text. Paste it into Import on another device to load the map.</p><textarea class="field" id="txtOut" style="min-height:300px;font-family:var(--f-mono);font-size:11px" readonly>${esc(text)}</textarea>`, { size: '' });
  const ta = m.el.querySelector('#txtOut'); ta.focus(); ta.select();
}

/* ---------- attachments ---------- */
const readAsDataURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
async function shrinkImage(file, max = 1800) {
  const url = await readAsDataURL(file);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif' || file.size < 900000) return url;
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height)); if (s === 1 && file.size < 2500000) return url;
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', .86);
  } catch { return url; }
}
async function fileToAsset(file) {
  if (file.size > 40 * 1048576) { toast(`${file.name} is over 40 MB — link it by path instead.`); return null; }
  const isImg = /^image\//.test(file.type);
  const data = isImg ? await shrinkImage(file) : await readAsDataURL(file);
  const a = { id: uid('a'), name: file.name, mime: file.type || 'application/octet-stream', size: file.size, data };
  addAsset(a); return a;
}
async function attachFiles(nodeId, files) {
  const out = [];
  for (const f of files) { const a = await fileToAsset(f); if (a) out.push({ id: uid('f'), asset: a.id, name: a.name, mime: a.mime, size: a.size, preview: ['image', 'pdf', 'csv', 'text'].includes(fileKind({ name: a.name, mime: a.mime })) }); }
  if (!out.length) return;
  act(() => { byId[nodeId].files.push(...out); });
  toast(`Attached ${out.length} file${out.length > 1 ? 's' : ''}`);
}
function pickFiles(accept, multiple) {
  return new Promise(res => {
    const inp = $('#fileIn'); inp.value = ''; inp.accept = accept || ''; inp.multiple = !!multiple;
    inp.onchange = () => res(Array.from(inp.files || [])); inp.click();
  });
}

/* ---------- PDF support (pdf.js loaded on demand from cdnjs) ---------- */
let pdfLib = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
function ensurePdf() {
  if (!pdfLib) pdfLib = (async () => { await loadScript(PDFJS); await loadScript(PDFJS_WORKER); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return window.pdfjsLib; })();
  pdfLib.catch(() => { pdfLib = null; });
  return pdfLib;
}
async function pdfDoc(a) { const lib = await ensurePdf(); return lib.getDocument({ data: dataUrlBytes(a.data), isEvalSupported: false }).promise; }
const pdfQueue = []; let pdfBusy = false;
function queuePdfThumb(a) { if (a._thumbing) return; a._thumbing = true; pdfQueue.push(a); runPdfQueue(); }
async function runPdfQueue() {
  if (pdfBusy) return; pdfBusy = true;
  while (pdfQueue.length) {
    const a = pdfQueue.shift();
    try {
      const doc = await pdfDoc(a); const page = await doc.getPage(1); const vp = page.getViewport({ scale: 1 });
      const v = page.getViewport({ scale: 180 / vp.width }); const c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: v }).promise; a.thumb = c.toDataURL('image/jpeg', .82); a.pages = doc.numPages; markAsset(a.id); scheduleSave();
    } catch (err) { a._thumbFail = true; }
  }
  pdfBusy = false; scheduleCanvas();
}

/* ---------- file viewer ---------- */
function openViewer(nodeId, fileId) {
  const n = byId[nodeId]; const f = n?.files.find(x => x.id === fileId); if (!f) return;
  const a = assets[f.asset]; const k = fileKind(f);
  const foot = a ? `<span class="stat" style="margin-right:auto">${esc(fmtSize(a.size))}${a.pages ? ' · ' + a.pages + ' pages' : ''}</span><button class="btn" data-dl>${ICON.file}Save a copy</button>` : '';
  const m = modal(f.name, '<div class="viewer" id="viewer"></div>', { size: 'lg', footer: foot });
  m.body.style.padding = '0';
  const v = m.el.querySelector('#viewer');
  if (a) m.el.querySelector('[data-dl]').onclick = () => saveFile(f.name, new Blob([dataUrlBytes(a.data)], { type: a.mime }), a.mime);
  if (!a) { v.innerHTML = `<pre>This node links to a file on your computer:\n\n${esc(f.path || f.name)}\n\nBrowsers can't open local paths from a web page. Copy the path and open it from your file manager, or attach the file itself to preview it here.</pre><button class="btn" id="cpPath">${ICON.copy}Copy path</button>`; v.querySelector('#cpPath').onclick = () => copyText(f.path || f.name); return; }
  if (k === 'image') v.innerHTML = `<img src="${esc(a.data)}" alt="${esc(f.name)}">`;
  else if (k === 'csv') {
    const rows = parseCSV(assetText(a), 1001); const head = rows.shift() || [];
    v.innerHTML = `<div class="tablewrap"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length >= 1000 ? '<p class="note">Showing the first 1,000 rows.</p>' : ''}`;
  }
  else if (k === 'text') { let t = assetText(a); if (extOf(f.name) === 'json') { try { t = JSON.stringify(JSON.parse(t), null, 2); } catch { } } v.innerHTML = `<pre>${esc(t)}</pre>`; }
  else if (k === 'pdf') {
    v.innerHTML = '<p class="note">Rendering PDF…</p>';
    (async () => {
      try {
        const doc = await pdfDoc(a); v.innerHTML = ''; const max = Math.min(doc.numPages, 40);
        for (let i = 1; i <= max; i++) {
          if (!document.body.contains(v)) return;
          const page = await doc.getPage(i); const vp0 = page.getViewport({ scale: 1 }); const scale = Math.min(2, (Math.min(v.clientWidth, 900) - 24) / vp0.width * (window.devicePixelRatio || 1));
          const vp = page.getViewport({ scale }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = (vp.width / (window.devicePixelRatio || 1)) + 'px';
          v.appendChild(c); await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        }
        if (doc.numPages > max) v.insertAdjacentHTML('beforeend', `<p class="note">Showing the first ${max} of ${doc.numPages} pages. Save a copy to read the rest.</p>`);
      } catch (err) { v.innerHTML = `<pre>This PDF couldn't be rendered here (${esc(err.message || err)}). Use “Save a copy” to open it in your PDF reader.</pre>`; }
    })();
  }
  else if (k === 'audio') v.innerHTML = `<audio controls src="${esc(a.data)}" style="width:100%"></audio>`;
  else if (k === 'video') v.innerHTML = `<video controls src="${esc(a.data)}" style="max-width:100%"></video>`;
  else v.innerHTML = `<pre>No preview for .${esc(extOf(f.name))} files. Use “Save a copy” to open it in another app.</pre>`;
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { toast('Copy failed — select the text and copy it manually'); } }

/* ---------- map library / new / import ---------- */
function tplPreview(t) {
  if (t === 'debate') return `<svg class="pv" viewBox="0 0 200 64"><path d="M70 8h60l8 10-8 10H70l-8-10z" fill="#2F6FDE"/><rect x="18" y="40" width="54" height="18" rx="5" fill="none" stroke="#2F6FDE" stroke-width="1.6"/><rect x="128" y="40" width="54" height="18" rx="5" fill="none" stroke="#2F6FDE" stroke-width="1.6"/><path d="M45 40 85 28M155 40 115 28" stroke="#2F6FDE" stroke-width="1.4"/><path d="M178 20h18l-6 8 6 8h-18z" fill="none" stroke="#D9622B" stroke-width="1.6" stroke-dasharray="3 2"/></svg>`;
  if (t === 'flow') return `<svg class="pv" viewBox="0 0 200 64"><rect x="6" y="22" width="40" height="18" rx="9" fill="#1E3A8A"/><rect x="62" y="22" width="40" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M138 13l20 18-20 18-20-18z" fill="none" stroke="#C9A227" stroke-width="1.6"/><rect x="168" y="22" width="28" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M46 31h16M102 31h16M158 31h10" stroke="currentColor" stroke-width="1.4"/></svg>`;
  return `<svg class="pv" viewBox="0 0 200 64"><rect x="70" y="22" width="60" height="20" rx="10" fill="#1E3A8A"/><rect x="10" y="6" width="40" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="10" y="44" width="40" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="150" y="6" width="40" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="150" y="44" width="40" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M70 32C60 32 60 13 50 13M70 32C60 32 60 51 50 51M130 32c10 0 10-19 20-19M130 32c10 0 10 19 20 19" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`;
}
const TPL_DESC = {
  mind: 'Free-form branches from a central idea. Nodes hold dates, images, notes, links and files.',
  debate: 'Claims, arguments, evidence and counter-arguments. Node colour follows the side each one ultimately serves.',
  flow: 'Project or program planning: steps, decisions, documents and milestones with owners, dates and status.',
};
function newMapGrid() {
  return `<div class="tplgrid">${Object.entries(TEMPLATES).map(([k, t]) => `<div class="tpl">${tplPreview(k)}<h3>${t.label}</h3><p>${TPL_DESC[k]}</p><div class="btnrow"><button class="btn primary sm" data-new="${k}|example">Start from example</button><button class="btn sm" data-new="${k}|starter">Blank</button></div></div>`).join('')}</div>`;
}
function bindNew(m) {
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-new]'); if (!b) return; const [t, v] = b.dataset.new.split('|');
    const { map: nm, assets: as } = buildTemplate(t, v);
    m.close(); await saveNow(); setMap(nm, as); toast(`Created “${nm.name}”`);
  });
}
function openNew() { const m = modal('New map', newMapGrid()); bindNew(m); }
function openLibrary() {
  const list = mapIndex();
  const rows = list.map(x => `<div class="maprow${x.id === map.id ? ' cur' : ''}"><div><b>${esc(x.name)}</b><small>${esc(TEMPLATES[x.template]?.label || '')} · ${x.count} nodes · edited ${new Date(x.updated).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div><div class="acts">${x.id === map.id ? '<span class="stat">Open now</span>' : `<button class="btn sm primary" data-open="${x.id}">Open</button>`}<button class="btn sm" data-dup="${x.id}">Duplicate</button><button class="btn sm danger" data-del="${x.id}">Delete</button></div></div>`).join('');
  const m = modal('Your maps', `<p class="note">Maps save automatically in this browser. Use Export → Map file to back one up or move it to another device.</p><div class="maplist">${rows || '<div class="maprow"><span class="note">No saved maps yet.</span></div>'}</div><h3 style="margin:6px 0 0;font-family:var(--f-display)">Start a new map</h3>${newMapGrid()}`);
  bindNew(m);
  m.el.addEventListener('click', async e => {
    const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]'), u = e.target.closest('[data-dup]');
    if (o) { m.close(); await openMap(o.dataset.open); }
    if (u) {
      await saveNow(); let f = null; try { f = HT.files.read(TOOL, u.dataset.dup); } catch { } if (!f) return;
      const as = await loadAssetsFor(u.dataset.dup); const nm = fromEnvelope(f); nm.id = HT.files.newId('s'); nm.name += ' (copy)';
      m.close(); setMap(nm, as); toast('Duplicated');
    }
    if (d) {
      const id = d.dataset.del; const x = list.find(i => i.id === id);
      m.close(); if (!(await askConfirm(`Delete “${x.name}”?`, 'This removes the map and its attachments from this browser. Export it first if you want to keep a copy.', 'Delete map'))) return openLibrary();
      await deleteMap(id);
      if (id === map.id) { const next = mapIndex()[0]; if (next) await openMap(next.id); else { const { map: nm, assets: as } = buildTemplate('mind', 'starter'); setMap(nm, as); } }
      toast('Map deleted'); openLibrary();
    }
  });
}
async function importFile(file) {
  try { const text = await file.text(); const { map: nm, assets: as } = importPayload(text); await saveNow(); setMap(nm, as); saveNow(); toast(`Imported “${nm.name}”`); }
  catch (err) { toast(err.message || 'Import failed'); }
}
function openImport() {
  const m = modal('Import a map', `<p class="note">Choose a <b>.mindmap.json</b> file saved from Theta Maps (Branchwork exports work too), or paste map JSON below. The map opens as a new map; nothing you have is overwritten.</p>
<div class="btnrow"><button class="btn primary" id="impPick">${ICON.file}Choose file…</button></div>
<label class="lbl" for="impText">Or paste JSON</label><textarea class="field" id="impText" style="min-height:140px;font-family:var(--f-mono);font-size:11.5px" placeholder='{"format":"happytheta", "tool":"mindmap", …}'></textarea>`,
    { size: 'sm', footer: `<button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>Import pasted JSON</button>` });
  m.el.querySelector('#impPick').onclick = async () => { const [f] = await pickFiles('.json,application/json'); if (f) { m.close(); importFile(f); } };
  m.el.querySelector('[data-no]').onclick = () => m.close();
  m.el.querySelector('[data-yes]').onclick = async () => {
    try { const { map: nm, assets: as } = importPayload(m.el.querySelector('#impText').value); m.close(); await saveNow(); setMap(nm, as); toast(`Imported “${nm.name}”`); }
    catch (err) { toast(err.message); }
  };
}

/* ---------- search (top bar) and node picker ---------- */
function searchNodes(q, exclude) {
  q = q.trim().toLowerCase(); index();
  const res = map.nodes.filter(n => n.id !== exclude && (!q || (n.title || '').toLowerCase().includes(q) || plain(n.html).toLowerCase().includes(q)));
  res.sort((a, b) => ((b.title || '').toLowerCase().startsWith(q) - (a.title || '').toLowerCase().startsWith(q)) || (a.folder === ui.folder ? -1 : 1));
  return res.slice(0, 40);
}
function attachPicker(input, onPick, exclude) {
  let hi = 0, items = [];
  const show = () => {
    $$('.results').forEach(r => r.remove());
    items = searchNodes(input.value, exclude());
    const r = input.getBoundingClientRect(); const box = document.createElement('div'); box.className = 'results';
    box.style.left = Math.min(r.left, innerWidth - 280) + 'px'; box.style.top = r.bottom + 4 + 'px'; box.style.width = Math.max(r.width, 260) + 'px';
    box.innerHTML = items.length ? items.map((n, i) => `<button data-i="${i}" class="${i === hi ? 'hi' : ''}">${esc(n.title || 'Untitled')}<small>${esc(folderPath(n.folder).map(f => f.name).join(' › '))}${KINDS[n.kind] && n.kind !== 'idea' ? ' · ' + KINDS[n.kind].label : ''}</small></button>`).join('') : '<div class="empty">No matching nodes</div>';
    box.addEventListener('pointerdown', e => { e.preventDefault(); const b = e.target.closest('button'); if (b) { pick(items[+b.dataset.i]); } });
    document.body.appendChild(box);
  };
  const pick = n => { if (!n) return; $$('.results').forEach(r => r.remove()); input.value = ''; input.blur(); onPick(n); };
  input.addEventListener('focus', () => { hi = 0; show(); });
  input.addEventListener('input', () => { hi = 0; show(); });
  input.addEventListener('blur', () => setTimeout(() => $$('.results').forEach(r => r.remove()), 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, items.length - 1); show(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); show(); }
    if (e.key === 'Enter') { e.preventDefault(); pick(items[hi]); }
  });
}
attachPicker($('#searchIn'), n => goTo(n.id), () => null);

/* =========================================================
   Inspector panel
   ========================================================= */
const insp = $('#inspector');
let pendingUndo = false, rtRange = null;

function swatches(cur, action, auto = 'Auto') {
  return `<div class="swatches">${auto ? `<button class="sw-auto${!cur ? ' on' : ''}" data-a="${action}" data-arg="">${auto}</button>` : ''}${PALETTE.map(c => `<button class="sw-btn${cur === c ? ' on' : ''}" style="background:${c}" data-a="${action}" data-arg="${c}" title="${c}" aria-label="Colour ${c}"></button>`).join('')}<input type="color" class="sw-pick" data-pick="${action}" value="${cur && /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#888888'}" title="Custom colour" aria-label="Custom colour"></div>`;
}
function shapeGrid(cur, action) {
  return `<div class="shapes"><button class="${!cur ? 'on' : ''}" data-a="${action}" data-arg="" title="Shape from node type" style="font-size:11px">Auto</button>${Object.entries(SHAPES).map(([k, s]) => `<button class="${cur === k ? 'on' : ''}" data-a="${action}" data-arg="${k}" title="${s.label}">${shapeIcon(k)}</button>`).join('')}</div>`;
}
const seg = (opts, cur, action) => `<div class="seg">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-a="${action}" data-arg="${v}">${l}</button>`).join('')}</div>`;
const nodeLabel = n => `${n.title || 'Untitled'}${n.folder !== ui.folder ? ' — ' + (folderById(n.folder)?.name || '') : ''}`;

function renderInspector() {
  insp.classList.toggle('closed', !ui.insp); $('#inspToggle').classList.toggle('on', ui.insp);
  if (!ui.insp || !map) return;
  const keepScroll = insp.scrollTop; const prevKey = insp.dataset.key;
  let html, key;
  if (ui.edge && map.edges.find(e => e.id === ui.edge)) { html = edgePanel(map.edges.find(e => e.id === ui.edge)); key = 'e:' + ui.edge; }
  else if (ui.ftile && folderById(ui.ftile)) { html = folderPanel(folderById(ui.ftile)); key = 'f:' + ui.ftile; }
  else if (ui.sel.size === 1 && byId[[...ui.sel][0]]) { const n = byId[[...ui.sel][0]]; html = nodePanel(n); key = 'n:' + n.id; }
  else if (ui.sel.size > 1) { html = multiPanel(selNodes()); key = 'm'; }
  else { html = mapPanel(); key = 'map'; }
  insp.innerHTML = html; insp.dataset.key = key;
  if (prevKey === key) insp.scrollTop = keepScroll;
  const rt = $('#rtEdit'); if (rt) bindRich(rt);
  const ct = $('#connectIn'); if (ct) attachPicker(ct, t => act(() => { makeEdge([...ui.sel][0], t.id); }), () => [...ui.sel][0]);
}

function nodePanel(n) {
  const T = TEMPLATES[map.template]; const kinds = [...new Set([...T.kinds, n.kind])];
  const hasKids = (kids[n.id] || []).length;
  const eff = effSide(n);
  const rows = [];
  rows.push(`<div class="insp-head"><h3>${esc(KINDS[n.kind]?.label || 'Node')}</h3>
${hasKids ? `<button class="btn sm" data-a="collapse">${n.collapsed ? 'Expand' : 'Collapse'} (${descendants(n.id).length})</button>` : ''}
<button class="iconbtn" data-a="center" title="Centre on screen">${ICON.fit}</button>
<button class="iconbtn" data-a="delete" title="Delete node (Del)">${ICON.trash}</button>
<button class="iconbtn" data-a="close" title="Close panel (I)">${ICON.x}</button></div>`);
  rows.push(`<div class="sec"><label for="f-title">Title</label><input id="f-title" class="field title-in" data-f="title" value="${esc(n.title)}" placeholder="Name this node">
<div class="row2"><div><div class="lbl" style="margin-bottom:4px">Type</div><select class="field" data-f="kind">${kinds.map(k => `<option value="${k}"${k === n.kind ? ' selected' : ''}>${KINDS[k].label}</option>`).join('')}</select></div>
${map.template === 'debate' ? `<div><div class="lbl" style="margin-bottom:4px">Side</div><select class="field" data-f="side"><option value="">Auto${!n.side && eff ? ' → ' + esc(sideById(eff)?.name) : ''}</option>${map.sides.map(s => `<option value="${s.id}"${n.side === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>`
      : `<div><div class="lbl" style="margin-bottom:4px">Status</div><select class="field" data-f="status">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}"${n.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>`}</div>
${map.template === 'flow' ? `<div><div class="lbl" style="margin-bottom:4px">Owner</div><input class="field" data-f="owner" value="${esc(n.owner)}" placeholder="Who is responsible?"></div>` : ''}
${map.template === 'debate' && n.kind !== 'claim' ? `<p class="note">Colour follows the side this node ultimately serves: arguments and evidence take the side of what they support; a counter-argument takes the opposite side of what it attacks.</p>` : ''}</div>`);
  rows.push(`<div class="sec"><label>Dates <button class="btn sm ghost" data-a="addDate">${ICON.plus}Add date</button></label>
${n.dates.length ? `<div class="list">${n.dates.map(d => `<div class="li"><div class="grow"><input class="field" data-date="${d.id}" data-df="label" value="${esc(d.label)}" placeholder="Label (e.g. Due, Kickoff)" style="padding:4px 6px;font-size:12.5px"><div class="date-row"><input type="date" class="field" data-date="${d.id}" data-df="start" value="${esc(d.start)}" aria-label="Start date"><input type="date" class="field" data-date="${d.id}" data-df="end" value="${esc(d.end)}" aria-label="End date (optional)" title="End date (optional)"></div></div><button class="x" data-a="delDate" data-arg="${d.id}" aria-label="Remove date">${ICON.x}</button></div>`).join('')}</div>` : '<p class="note">Add a single date or a start–end range.</p>'}</div>`);
  rows.push(`<div class="sec"><label>Notes <span class="check" style="text-transform:none;letter-spacing:0;font-family:var(--f-body);font-size:12px"><input type="checkbox" data-f="showBody"${n.showBody ? ' checked' : ''} id="f-showBody"> <span>Show on node</span></span></label>
<div><div class="rt-tools" id="rtTools">
<button data-rt="bold" title="Bold">${ICON.bold}</button><button data-rt="italic" title="Italic">${ICON.italic}</button><button data-rt="underline" title="Underline">${ICON.underline}</button><button data-rt="strikeThrough" title="Strikethrough">${ICON.strike}</button>
<button data-rt="h3" title="Heading" style="font-weight:700;font-size:12px">H</button><button data-rt="insertUnorderedList" title="Bulleted list">${ICON.ul}</button><button data-rt="insertOrderedList" title="Numbered list">${ICON.ol}</button><button data-rt="quote" title="Quote">${ICON.quote}</button><button data-rt="link" title="Link">${ICON.link}</button><button data-rt="clear" title="Clear formatting">${ICON.clear}</button></div>
<div class="rt-edit rt" id="rtEdit" contenteditable="true" data-ph="Write notes, lists, quotes…">${n.html}</div>
<div class="row3" id="rtLinkRow" hidden style="margin-top:6px"><input class="field" id="rtLinkIn" placeholder="https://…"><button class="btn sm primary" id="rtLinkOk">Add link</button><button class="btn sm" id="rtLinkNo">Cancel</button></div></div></div>`);
  const src = imgSrc(n.image);
  rows.push(`<div class="sec"><label>Image</label>${src ? `<img class="imgprev" src="${esc(src)}" alt="">` : ''}
<div class="btnrow"><button class="btn sm" data-a="imgUpload">${ICON.img}${src ? 'Replace' : 'Upload image'}</button><button class="btn sm" data-a="imgUrl">${ICON.link}From web address</button>${n.image ? `<button class="btn sm danger" data-a="imgRemove">Remove</button>` : ''}</div></div>`);
  rows.push(`<div class="sec"><label>Links <button class="btn sm ghost" data-a="addLink">${ICON.plus}Add link</button></label>
${n.links.length ? `<div class="list">${n.links.map(l => `<div class="li"><div class="grow"><input class="field" data-link="${l.id}" data-lf="label" value="${esc(l.label)}" placeholder="Label" style="padding:4px 6px;font-size:12.5px"><input class="field" data-link="${l.id}" data-lf="url" value="${esc(l.url)}" placeholder="https://…" style="padding:4px 6px;font-size:12px;font-family:var(--f-mono)"></div><button class="x" data-a="delLink" data-arg="${l.id}" aria-label="Remove link">${ICON.x}</button></div>`).join('')}</div>` : '<p class="note">Web pages, docs, videos, datasets.</p>'}</div>`);
  rows.push(`<div class="sec"><label>Files</label>
${n.files.length ? `<div class="list">${n.files.map(f => {
    const a = assets[f.asset]; const k = fileKind(f); const can = a && ['image', 'pdf', 'csv', 'text'].includes(k);
    return `<div class="li"><div class="grow"><span class="nm" title="${esc(f.name)}">${esc(f.name)}</span><span class="sub" title="${esc(f.path || '')}">${a ? esc(fmtSize(a.size)) + ' · stored in map' : 'Local path · ' + esc(f.path)}</span>
<div class="mini">${can ? `<label class="check" style="font-size:12px"><input type="checkbox" data-file="${f.id}" data-ff="preview"${f.preview ? ' checked' : ''}> Thumbnail on node</label>` : ''}<button class="btn sm ghost" data-a="viewFile" data-arg="${f.id}">${ICON.eye}${a ? 'Open' : 'Path'}</button></div></div>
<button class="x" data-a="delFile" data-arg="${f.id}" aria-label="Remove file">${ICON.x}</button></div>`;
  }).join('')}</div>` : ''}
<div class="btnrow"><button class="btn sm" data-a="attach">${ICON.file}Attach files…</button><button class="btn sm" data-a="addPath">${ICON.folder}Link a local path…</button></div>
<p class="note">Attached files (CSV, PDF, images, text) are stored inside the map and preview here. A local path only records where a file lives on your computer.</p></div>`);
  rows.push(`<div class="sec"><label>Appearance</label>${swatches(n.color, 'color')}
${seg([['tint', 'Tint'], ['solid', 'Solid'], ['outline', 'Outline']], n.fill || (n.color ? 'tint' : KINDS[n.kind]?.fill || 'tint'), 'fill')}
${shapeGrid(n.shape, 'shape')}
<div class="row3"><span class="lbl">Width</span><input type="range" min="110" max="640" step="10" value="${n.w}" data-f="w" aria-label="Width"><span class="stat">${n.w}px</span></div></div>`);
  const conns = map.edges.filter(e => e.from === n.id || e.to === n.id);
  const others = map.nodes.filter(x => x.id !== n.id && !isAncestor(n.id, x.id));
  rows.push(`<div class="sec"><label>Connections</label>
${conns.length ? `<div class="list">${conns.map(e => { const out = e.from === n.id; const o = byId[out ? e.to : e.from]; const rel = relOf(e); return `<div class="li"><button class="grow" data-a="selEdge" data-arg="${e.id}" style="border:0;background:transparent;text-align:left;padding:0"><span class="nm">${out ? '→' : '←'} ${esc(o?.title || '')}</span><span class="sub">${esc(folderById(o?.folder)?.name || '')}${rel ? ' · ' + REL[rel] : ''}${e.label ? ' · “' + esc(e.label) + '”' : ''}${e.dir === 'both' ? ' · two-way' : ''}</span></button><button class="x" data-a="delEdge" data-arg="${e.id}" aria-label="Remove connection">${ICON.x}</button></div>`; }).join('')}</div>` : ''}
<div class="pickwrap"><input class="field" id="connectIn" placeholder="Connect to a node in any folder…" autocomplete="off"></div>
<p class="note">Or drag the green dot on the node's right edge onto another node. Links to nodes in other folders show as ghosted cards.</p>
<div class="row2"><div><div class="lbl" style="margin-bottom:4px">Child of</div><select class="field" data-f="parent"><option value="">— Top level —</option>${others.map(x => `<option value="${x.id}"${n.parent === x.id ? ' selected' : ''}>${esc(nodeLabel(x).slice(0, 48))}</option>`).join('')}</select></div>
<div><div class="lbl" style="margin-bottom:4px">Folder</div><select class="field" data-f="folder">${folderTree().map(([f, d]) => `<option value="${f.id}"${n.folder === f.id ? ' selected' : ''}>${'  '.repeat(d)}${esc(f.name)}</option>`).join('')}</select></div></div>
<p class="note">“Child of” sets what collapses with its parent.</p></div>`);
  return rows.join('');
}

function edgePanel(e) {
  const a = byId[e.from], b = byId[e.to]; const rel = relOf(e);
  return `<div class="insp-head"><h3>Connection</h3><button class="iconbtn" data-a="delete" title="Delete (Del)">${ICON.trash}</button><button class="iconbtn" data-a="close" title="Close panel">${ICON.x}</button></div>
<div class="sec"><label>Between</label>
<div class="list"><button class="li" data-a="goNode" data-arg="${a.id}" style="text-align:left"><span class="grow"><span class="nm">${esc(a.title)}</span><span class="sub">${esc(folderById(a.folder)?.name)} · from</span></span></button>
<button class="li" data-a="goNode" data-arg="${b.id}" style="text-align:left"><span class="grow"><span class="nm">${esc(b.title)}</span><span class="sub">${esc(folderById(b.folder)?.name)} · to</span></span></button></div></div>
<div class="sec"><label>Direction <button class="btn sm ghost" data-a="swap">${ICON.swap}Swap</button></label>${seg([['fwd', 'One-way →'], ['both', 'Two-way ↔'], ['none', 'No arrow']], e.dir, 'edir')}</div>
<div class="sec"><label for="f-elabel">Label</label><input class="field" id="f-elabel" data-ef="label" value="${esc(e.label)}" placeholder="e.g. causes, depends on, Yes / No"></div>
${map.template === 'debate' ? `<div class="sec"><label>Relationship</label><select class="field" data-ef="rel"><option value="auto"${e.rel === undefined || e.rel === null || e.rel === 'auto' ? ' selected' : ''}>Automatic (${REL[inferRel(a, b)]})</option>${Object.entries(REL).map(([k, v]) => `<option value="${k}"${e.rel === k ? ' selected' : ''}>${v}</option>`).join('')}</select><p class="note">“Counters” flips the side colour of whatever points along it.</p></div>` : ''}
<div class="sec"><label>Line</label>${seg([['solid', 'Solid'], ['dashed', 'Dashed']], e.dashed ? 'dashed' : 'solid', 'edash')}${swatches(e.color, 'ecolor')}</div>
${rel ? '' : ''}`;
}
function folderPanel(f) {
  const nn = map.nodes.filter(n => n.folder === f.id).length;
  return `<div class="insp-head"><h3>Folder</h3>${f.id !== 'root' ? `<button class="iconbtn" data-a="delFolder" title="Delete folder">${ICON.trash}</button>` : ''}<button class="iconbtn" data-a="close" title="Close panel">${ICON.x}</button></div>
<div class="sec"><label for="f-fname">Name</label><input class="field title-in" id="f-fname" data-fo="name" value="${esc(f.name)}">
<div class="stat">${esc(folderPath(f.id).map(x => x.name).join(' › '))} · ${nn} node${nn === 1 ? '' : 's'}</div>
${f.id !== ui.folder ? `<button class="btn primary" data-a="openFolder">${ICON.enter}Open folder</button>` : ''}</div>
<div class="sec"><label>Colour</label>${swatches(f.color, 'fcolor', '')}</div>
${f.id !== 'root' ? `<div class="sec"><label>Inside</label><select class="field" data-fo="parent">${folderTree().filter(([x]) => x.id !== f.id && !folderPath(x.id).some(p => p.id === f.id)).map(([x, d]) => `<option value="${x.id}"${f.parent === x.id ? ' selected' : ''}>${'  '.repeat(d)}${esc(x.name)}</option>`).join('')}</select></div>` : ''}
<div class="sec"><p class="note">Drag nodes onto a folder card or a folder tab to move them. Connections to nodes in other folders stay intact and appear as ghosted cards.</p></div>`;
}
function multiPanel(ns) {
  return `<div class="insp-head"><h3>${ns.length} nodes selected</h3><button class="iconbtn" data-a="delete" title="Delete">${ICON.trash}</button><button class="iconbtn" data-a="close" title="Close panel">${ICON.x}</button></div>
<div class="sec"><label>Colour</label>${swatches(null, 'mcolor')}${seg([['tint', 'Tint'], ['solid', 'Solid'], ['outline', 'Outline']], '', 'mfill')}</div>
<div class="sec"><label>Shape</label>${shapeGrid(null, 'mshape')}</div>
<div class="sec"><label>Move to folder</label><select class="field" data-mf="moveTo"><option value="">Choose a folder…</option>${folderTree().map(([f, d]) => `<option value="${f.id}">${'  '.repeat(d)}${esc(f.name)}</option>`).join('')}</select></div>
<div class="sec"><div class="btnrow"><button class="btn sm" data-a="mcollapse" data-arg="1">Collapse</button><button class="btn sm" data-a="mcollapse" data-arg="0">Expand</button><button class="btn sm" data-a="mlink">${ICON.link}Chain-link in order</button><button class="btn sm" data-a="dup">${ICON.copy}Duplicate</button></div></div>`;
}
function mapPanel() {
  const T = map.template; const cnt = map.nodes.length, ec = map.edges.length, fc = map.folders.length;
  return `<div class="insp-head"><h3>Map settings</h3><button class="iconbtn" data-a="close" title="Close panel (I)">${ICON.x}</button></div>
<div class="sec"><label for="f-mname">Name</label><input class="field title-in" id="f-mname" data-mf="name" value="${esc(map.name)}">
<div class="stat">${cnt} nodes · ${ec} connections · ${fc} folder${fc === 1 ? '' : 's'}</div></div>
<div class="sec"><label>Map type</label><select class="field" data-mf="template">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}"${k === T ? ' selected' : ''}>${t.label}</option>`).join('')}</select><p class="note">The type sets the node kinds offered, the legend and how Tidy lays things out.</p></div>
${T === 'debate' ? `<div class="sec"><label>Sides <button class="btn sm ghost" data-a="addSide">${ICON.plus}Add side</button></label><div class="list">${map.sides.map(s => `<div class="side-row"><input type="color" class="sw-pick" data-side="${s.id}" data-sf="color" value="${s.color}" aria-label="Side colour"><input class="field" data-side="${s.id}" data-sf="name" value="${esc(s.name)}">${map.sides.length > 2 ? `<button class="iconbtn" data-a="delSide" data-arg="${s.id}" aria-label="Remove side">${ICON.x}</button>` : '<span></span>'}</div>`).join('')}</div>${map.sides.length > 2 ? '<p class="note">With more than two sides, set each counter-argument\'s side by hand.</p>' : ''}</div>` : ''}
<div class="sec"><label>Connector style</label>${seg([['curve', 'Curved'], ['straight', 'Straight'], ['elbow', 'Elbow']], map.settings.edgeStyle, 'estyle')}</div>
<div class="sec"><label>Mouse wheel</label>${seg([['pan', 'Pans'], ['zoom', 'Zooms']], prefs.wheel, 'wheel')}<p class="note">Ctrl/⌘ + scroll or a pinch always zooms.</p></div>
<div class="sec"><label>This folder</label><div class="btnrow"><button class="btn sm" data-a="collapseAll" data-arg="1">Collapse all</button><button class="btn sm" data-a="collapseAll" data-arg="0">Expand all</button><button class="btn sm" data-a="tidy">${ICON.tidy}Tidy layout</button></div></div>
<div class="sec"><label>Keyboard</label><div class="keys">
<span><span class="kbd">Tab</span></span><span>Add a child to the selected node</span>
<span><span class="kbd">Enter</span></span><span>Add a sibling</span>
<span><span class="kbd">Space</span></span><span>Collapse or expand</span>
<span><span class="kbd">Del</span></span><span>Delete selection</span>
<span><span class="kbd">N</span></span><span>New node at centre</span>
<span><span class="kbd">L</span> <span class="kbd">F</span></span><span>Tidy layout · fit to screen</span>
<span><span class="kbd">Ctrl Z</span></span><span>Undo (Shift for redo)</span>
<span><span class="kbd">Ctrl D</span></span><span>Duplicate</span>
<span><span class="kbd">Shift drag</span></span><span>Box-select on the field</span></div></div>
<div class="sec"><label>Storage</label><p class="note">Maps save automatically to this browser (attachments go to its database). Export a .json file to back up, share, or move a map to another device.</p><div class="btnrow"><button class="btn sm" data-a="exportJson">${ICON.file}Export .json</button><button class="btn sm" data-a="exportMd">${ICON.file}Export outline</button></div></div>`;
}

/* ---------- inspector events ---------- */
insp.addEventListener('focusin', e => { if (e.target.matches('input:not([type=checkbox]):not([type=color]):not([type=range]),textarea,[contenteditable]')) pendingUndo = true; });
insp.addEventListener('pointerdown', e => { if (e.target.matches('input[type=range],input[type=color]')) pendingUndo = true; });
function undoOnce() { if (pendingUndo) { pushUndo(); pendingUndo = false; } }
const curNode = () => byId[[...ui.sel][0]];
const curEdge = () => map.edges.find(e => e.id === ui.edge);

insp.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'rtEdit') return;
  if (t.dataset.f && ['title', 'owner', 'w'].includes(t.dataset.f)) {
    undoOnce(); const n = curNode(); if (t.dataset.f === 'w') { n.w = +t.value; t.nextElementSibling.textContent = n.w + 'px'; } else n[t.dataset.f] = t.value;
    scheduleCanvas(); scheduleSave(); if (t.dataset.f === 'title') insp.querySelector('.insp-head h3').textContent = KINDS[n.kind]?.label || 'Node'; return;
  }
  if (t.dataset.date) { undoOnce(); const d = curNode().dates.find(x => x.id === t.dataset.date); d[t.dataset.df] = t.value; scheduleCanvas(); scheduleSave(); return; }
  if (t.dataset.link) { undoOnce(); const l = curNode().links.find(x => x.id === t.dataset.link); l[t.dataset.lf] = t.value; scheduleCanvas(); scheduleSave(); return; }
  if (t.dataset.ef === 'label') { undoOnce(); curEdge().label = t.value; drawEdges(); scheduleSave(); return; }
  if (t.dataset.fo === 'name') { undoOnce(); folderById(ui.ftile).name = t.value; renderFolderBar(); scheduleCanvas(); scheduleSave(); return; }
  if (t.dataset.mf === 'name') { undoOnce(); map.name = t.value; renderTop(); scheduleSave(); return; }
  if (t.dataset.side) { undoOnce(); const s = sideById(t.dataset.side); s[t.dataset.sf] = t.value; scheduleCanvas(); renderLegend(); scheduleSave(); return; }
  if (t.dataset.pick) {
    undoOnce(); const c = t.value; const a = t.dataset.pick;
    if (a === 'color') { curNode().color = c; } else if (a === 'ecolor') curEdge().color = c; else if (a === 'fcolor') folderById(ui.ftile).color = c; else if (a === 'mcolor') selNodes().forEach(n => n.color = c);
    if (a === 'fcolor') renderFolderBar(); scheduleCanvas(); scheduleSave();
  }
});
insp.addEventListener('change', e => {
  const t = e.target; const n = curNode();
  if (t.dataset.f === 'kind') act(() => { n.kind = t.value; if (n.kind === 'claim' && !n.side && map.template === 'debate') n.side = map.sides[0]?.id || null; });
  else if (t.dataset.f === 'side') act(() => { n.side = t.value || null; });
  else if (t.dataset.f === 'status') act(() => { n.status = t.value; });
  else if (t.dataset.f === 'showBody') act(() => { n.showBody = t.checked; });
  else if (t.dataset.f === 'parent') setParent(n.id, t.value);
  else if (t.dataset.f === 'folder') { const id = n.id; moveNodesToFolder([id], t.value); }
  else if (t.dataset.ff === 'preview') act(() => { n.files.find(f => f.id === t.dataset.file).preview = t.checked; });
  else if (t.dataset.ef === 'rel') act(() => { curEdge().rel = t.value === 'auto' ? undefined : t.value; });
  else if (t.dataset.fo === 'parent') act(() => { const f = folderById(ui.ftile); f.parent = t.value; delete f.x; });
  else if (t.dataset.mf === 'template') act(() => { map.template = t.value; if (map.template === 'debate' && map.sides.length < 2) map.sides = [{ id: 'A', name: 'Affirmative', color: SIDE_COLORS[0] }, { id: 'B', name: 'Negative', color: SIDE_COLORS[1] }]; });
  else if (t.dataset.mf === 'moveTo' && t.value) moveNodesToFolder([...ui.sel], t.value);
  else if (t.dataset.pick || t.dataset.side || t.dataset.f === 'w') { pendingUndo = false; renderInspector(); }
});
insp.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, arg = b.dataset.arg; const n = curNode(); const ed = curEdge();
  switch (a) {
    case 'close': ui.insp = false; renderInspector(); break;
    case 'delete': deleteSelection(); break;
    case 'center': centerOn(n.id); break;
    case 'collapse': toggleCollapse(n.id); break;
    case 'color': act(() => { n.color = arg || null; if (!arg) n.fill = null; }); break;
    case 'fill': act(() => { n.fill = arg; if (!n.color && !KINDS[n.kind]?.color) n.color = PALETTE[0]; }); break;
    case 'shape': act(() => { n.shape = arg || null; }); break;
    case 'addDate': act(() => { n.dates.push({ id: uid('d'), label: map.template === 'flow' ? 'Due' : '', start: todayISO(), end: '' }); }); break;
    case 'delDate': act(() => { n.dates = n.dates.filter(d => d.id !== arg); }); break;
    case 'addLink': { const u = await askText('Add a link', 'Web address', '', 'https://example.org/page'); if (u === null) break; const url = safeUrl(u); if (!url) { toast('That doesn\'t look like a web address'); break; } act(() => { n.links.push({ id: uid('l'), label: domainOf(url), url }); }); break; }
    case 'delLink': act(() => { n.links = n.links.filter(l => l.id !== arg); }); break;
    case 'attach': { const fs = await pickFiles('', true); if (fs.length) attachFiles(n.id, fs); break; }
    case 'addPath': { const p = await askText('Link a local file', 'Path on your computer', '', 'e.g. ~/Documents/survey-results.csv'); if (!p || !p.trim()) break; const name = p.trim().split(/[\\/]/).pop(); act(() => { n.files.push({ id: uid('f'), path: p.trim(), name, preview: false }); }); break; }
    case 'viewFile': openViewer(n.id, arg); break;
    case 'delFile': act(() => { n.files = n.files.filter(f => f.id !== arg); }); break;
    case 'imgUpload': { const [f] = await pickFiles('image/*'); if (!f) break; const as = await fileToAsset(f); if (as) act(() => { n.image = { asset: as.id }; }); break; }
    case 'imgUrl': { const u = await askText('Image from the web', 'Image address', n.image?.url || '', 'https://…/picture.jpg'); if (u === null) break; const url = safeUrl(u); if (!url) { toast('Enter a full https:// address'); break; } act(() => { n.image = { url }; }); toast('Tip: uploaded images are more reliable than web addresses'); break; }
    case 'imgRemove': act(() => { n.image = null; }); break;
    case 'selEdge': ui.sel.clear(); ui.edge = arg; afterSelect(); break;
    case 'delEdge': act(() => { map.edges = map.edges.filter(x => x.id !== arg); }); break;
    case 'goNode': goTo(arg); break;
    case 'swap': act(() => { [ed.from, ed.to] = [ed.to, ed.from]; }); break;
    case 'edir': act(() => { ed.dir = arg; }); break;
    case 'edash': act(() => { ed.dashed = arg === 'dashed'; }); break;
    case 'ecolor': act(() => { ed.color = arg || null; }); break;
    case 'fcolor': act(() => { folderById(ui.ftile).color = arg; }); break;
    case 'openFolder': goFolder(ui.ftile); break;
    case 'delFolder': deleteFolder(ui.ftile); break;
    case 'mcolor': act(() => selNodes().forEach(x => { x.color = arg || null; })); break;
    case 'mfill': act(() => selNodes().forEach(x => { x.fill = arg; if (!x.color && !KINDS[x.kind]?.color) x.color = PALETTE[0]; })); break;
    case 'mshape': act(() => selNodes().forEach(x => { x.shape = arg || null; })); break;
    case 'mcollapse': act(() => selNodes().forEach(x => { if ((kids[x.id] || []).length) x.collapsed = arg === '1'; })); break;
    case 'mlink': { const ns = selNodes().sort((p, q) => (p.y - q.y) || (p.x - q.x)); act(() => { for (let i = 0; i < ns.length - 1; i++) makeEdge(ns[i].id, ns[i + 1].id); }); break; }
    case 'dup': duplicateSelection(); break;
    case 'estyle': act(() => { map.settings.edgeStyle = arg; }); break;
    case 'wheel': prefs.wheel = arg; savePrefs(); renderInspector(); break;
    case 'addSide': act(() => { const used = map.sides.map(s => s.color); map.sides.push({ id: uid('s'), name: 'Side ' + String.fromCharCode(65 + map.sides.length), color: SIDE_COLORS.find(c => !used.includes(c)) || PALETTE[map.sides.length % PALETTE.length] }); }); break;
    case 'delSide': act(() => { map.sides = map.sides.filter(s => s.id !== arg); map.nodes.forEach(x => { if (x.side === arg) x.side = null; }); }); break;
    case 'collapseAll': setCollapseAll(arg === '1'); break;
    case 'tidy': tidyLayout(); break;
    case 'exportJson': exportJSON(); break;
    case 'exportMd': exportMarkdown(); break;
  }
});

/* ---------- rich text ---------- */
function bindRich(ed) {
  const n = curNode();
  const commit = () => { undoOnce(); n.html = sanitize(ed.innerHTML).replace(/^(<br>|<div><br><\/div>)$/, ''); scheduleCanvas(); scheduleSave(); };
  ed.addEventListener('input', commit);
  ed.addEventListener('paste', e => {
    e.preventDefault(); const h = e.clipboardData.getData('text/html'); const t = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, h ? sanitize(h) : esc(t).replace(/\n/g, '<br>'));
  });
  ed.addEventListener('click', e => { const a = e.target.closest('a'); if (a && (e.ctrlKey || e.metaKey)) window.open(a.href, '_blank', 'noopener'); });
  const tools = $('#rtTools');
  tools.addEventListener('mousedown', e => e.preventDefault());
  tools.addEventListener('click', e => {
    const b = e.target.closest('[data-rt]'); if (!b) return; const c = b.dataset.rt; ed.focus();
    if (c === 'h3') document.execCommand('formatBlock', false, document.queryCommandValue('formatBlock').toLowerCase() === 'h3' ? 'div' : 'h3');
    else if (c === 'quote') document.execCommand('formatBlock', false, document.queryCommandValue('formatBlock').toLowerCase() === 'blockquote' ? 'div' : 'blockquote');
    else if (c === 'clear') { document.execCommand('removeFormat'); document.execCommand('unlink'); document.execCommand('formatBlock', false, 'div'); }
    else if (c === 'link') {
      const s = getSelection(); rtRange = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
      const row = $('#rtLinkRow'); row.hidden = false; const inp = $('#rtLinkIn'); inp.value = ''; inp.focus();
      const done = ok => {
        row.hidden = true; ed.focus();
        if (ok && rtRange) { const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(rtRange); const u = safeUrl(inp.value); if (u) { if (rtRange.collapsed) document.execCommand('insertHTML', false, `<a href="${esc(u)}">${esc(domainOf(u))}</a>`); else document.execCommand('createLink', false, u); } else toast('Enter a full web address'); }
        commit();
      };
      $('#rtLinkOk').onclick = () => done(true); $('#rtLinkNo').onclick = () => done(false);
      inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); done(true); } if (ev.key === 'Escape') { ev.stopPropagation(); done(false); } };
      return;
    }
    else document.execCommand(c);
    commit();
  });
}

/* =========================================================
   Templates and example content
   ========================================================= */
const svgUrl = svg => 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
const textUrl = (txt, mime) => `data:${mime};base64,` + btoa(unescape(encodeURIComponent(txt)));

function kit(m) {
  const f = o => { const n = newNode(Object.assign({ folder: 'root' }, o)); if (!o.w) n.w = KINDS[n.kind]?.w || 200; m.nodes.push(n); return n; };
  const e = (a, b, o = {}) => { const x = Object.assign({ id: uid('e'), from: a.id, to: b.id, dir: 'fwd', label: '' }, o); m.edges.push(x); return x; };
  const child = (p, o, eo) => { const n = f(Object.assign({ parent: p.id, folder: p.folder }, o)); e(p, n, eo); return n; };
  const up = (p, o, eo) => { const n = f(Object.assign({ parent: p.id, folder: p.folder }, o)); e(n, p, eo); return n; };
  const folder = (name, color, parent = 'root') => { const fo = { id: uid('f'), name, color, parent }; m.folders.push(fo); return fo; };
  const asset = (as, name, mime, data, size) => { const id = uid('a'); as[id] = { id, name, mime, data, size: size || Math.round(data.length * .74) }; return id; };
  const pend = () => m.folders.forEach(fo => m.layoutPending[fo.id] = true);
  return { f, e, child, up, folder, asset, pend };
}
const d = (label, start, end = '') => ({ id: uid('d'), label, start, end });
const L = (label, url) => ({ id: uid('l'), label, url });

function heatSvg() {
  let cells = ''; const cols = ['#2E8BA8', '#5E7A2E', '#C9A227', '#D9622B', '#B8324F'];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) { const v = Math.max(0, Math.min(4, Math.round(2 + Math.sin(x * .7) * 1.2 + (y > 1 && y < 4 && x > 2 && x < 7 ? 1.4 : 0) - (x > 7 ? 1.2 : 0)))); cells += `<rect x="${x * 40}" y="${y * 30}" width="40" height="30" fill="${cols[v]}" opacity=".85"/>`; }
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 180">${cells}<rect x="120" y="60" width="160" height="60" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 6"/><text x="200" y="96" font-family="sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">Downtown core</text></svg>`);
}
function siteSvg() {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220"><rect width="400" height="220" fill="#E9EFEA"/><rect x="30" y="30" width="150" height="80" fill="#9AA6A0"/><text x="105" y="75" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#fff">Parking lot · A</text><rect x="220" y="30" width="150" height="80" fill="#5E7A2E"/><text x="295" y="75" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#fff">Lawn · B</text><rect x="30" y="140" width="150" height="55" fill="#D8D2C4"/><text x="105" y="172" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#333">Roof · C</text><circle cx="290" cy="165" r="30" fill="#2C7A3F"/><text x="290" y="170" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#fff">Tree · D</text></svg>`);
}
function tempsCsv() {
  const sites = [['A', 'Asphalt parking lot'], ['B', 'Grass lawn'], ['C', 'Gravel roof'], ['D', 'Shade under oak']];
  const base = { A: 118, B: 86, C: 104, D: 79 }, air = { A: 91, B: 87, C: 90, D: 84 };
  let out = 'site,surface,time,surface_temp_F,air_temp_F,note\n';
  ['10:00', '13:00', '16:00'].forEach((t, i) => sites.forEach(([s, name]) => { const bump = [-9, 0, -4][i]; out += `${s},${name},${t},${base[s] + bump},${air[s] + bump / 3 | 0},sample data\n`; }));
  return out;
}

function mindExample(as) {
  const m = blankMap('mind', 'Urban heat islands — research project'); const k = kit(m);
  const src = k.folder('Sources', '#2F6FDE'), data = k.folder('Field data', '#D9622B');
  src.x = 900; src.y = 520; data.x = 1100; data.y = 520;
  const root = k.f({ kind: 'root', title: 'Urban heat islands', w: 260, image: { asset: k.asset(as, 'heat-map.svg', 'image/svg+xml', heatSvg()) }, html: '<p>Why are city blocks hotter than the land around them, and what could our campus change?</p>', dates: [d('Proposal due', '2026-11-06')] });
  const causes = k.child(root, { title: 'Causes', color: '#D9622B' });
  const c1 = k.child(causes, { title: 'Dark, heat-absorbing surfaces', showBody: true, html: '<p>Asphalt and roofs with low <b>albedo</b> store heat and release it after sunset.</p>' });
  const c2 = k.child(causes, { title: 'Less tree canopy' });
  k.child(causes, { title: 'Waste heat from buildings and traffic' });
  void c1;
  const meas = k.child(root, { title: 'Measurement', color: '#2E8BA8', dates: [d('Data collection', '2026-11-09', '2026-11-20')], html: '<ul><li>Four sites, three times a day</li><li>Same day, clear skies</li></ul>' });
  k.child(meas, { title: 'Surface temperature', html: '<p>Infrared thermometer, 1 m above surface.</p>' });
  k.child(meas, { title: 'Air temperature loggers' });
  const mit = k.child(root, { title: 'Mitigation', color: '#0F766E', collapsed: true });
  const roofs = k.child(mit, { title: 'Cool roofs' });
  const trees = k.child(mit, { title: 'Street trees' });
  k.child(mit, { title: 'Permeable pavement' });
  const plan = k.child(root, { title: 'Timeline', color: '#7A4FD0', html: '<ol><li>Proposal and safety sign-off</li><li>Two weeks of field readings</li><li>Analysis and poster</li></ol>', dates: [d('Poster session', '2026-12-11')] });
  void plan;
  k.e(c2, trees, { dir: 'both', label: 'addressed by' });
  // sources folder
  const epa = k.f({ folder: src.id, title: 'EPA — Heat Island Effect', color: '#2F6FDE', links: [L('epa.gov/heatislands', 'https://www.epa.gov/heatislands')], html: '<p>Overview of causes, health effects and mitigation strategies.</p>' });
  const nasa = k.f({ folder: src.id, title: 'NASA Earth Observatory', color: '#2F6FDE', links: [L('earthobservatory.nasa.gov', 'https://earthobservatory.nasa.gov')], html: '<p>Satellite land-surface temperature imagery for comparison.</p>' });
  const notes = k.f({ folder: src.id, title: 'Reading notes', files: [{ id: uid('f'), asset: k.asset(as, 'reading-notes.txt', 'text/plain', textUrl('Reading notes\n\n- Albedo: fraction of sunlight a surface reflects.\n- Cool roofs can reflect most incoming sunlight.\n- Night-time heat release keeps city air warm after sunset.\n- Look for: local weather station data to compare against.\n', 'text/plain')), name: 'reading-notes.txt', mime: 'text/plain', preview: true }] });
  k.e(epa, notes, {}); k.e(nasa, notes, {});
  k.e(roofs, epa, { label: 'source' }); k.e(trees, epa, { label: 'source' }); k.e(root, nasa, { label: 'background' });
  // field data folder
  const readings = k.f({ folder: data.id, title: 'Sensor readings', color: '#D9622B', html: '<p>Sample readings to show the format. Replace with your own.</p>', files: [{ id: uid('f'), asset: k.asset(as, 'temps.csv', 'text/csv', textUrl(tempsCsv(), 'text/csv')), name: 'temps.csv', mime: 'text/csv', preview: true }] });
  const sites = k.f({ folder: data.id, title: 'Site map', image: { asset: k.asset(as, 'site-map.svg', 'image/svg+xml', siteSvg()) }, w: 230 });
  const anal = k.f({ folder: data.id, title: 'Analysis plan', html: '<p>Compare surface minus air temperature by site; chart by time of day.</p>', files: [{ id: uid('f'), path: '~/Documents/Science fair/analysis.xlsx', name: 'analysis.xlsx', preview: false }] });
  k.e(sites, readings, { label: 'locations' }); k.e(readings, anal, {});
  k.e(meas, readings, { label: 'produces' });
  k.pend(); return m;
}
function mindStarter() {
  const m = blankMap('mind', 'New mind map'); const k = kit(m);
  const r = k.f({ kind: 'root', title: 'Central idea', w: 230 });
  ['First branch', 'Second branch', 'Third branch'].forEach((t, i) => k.child(r, { title: t, color: PALETTE[i + 1] }));
  k.pend(); return m;
}

function debateExample() {
  const m = blankMap('debate', 'Debate: four-day school week'); const k = kit(m);
  const res = k.folder('Research', '#7A4FD0'); res.x = -40; res.y = 980;
  const ph = '<p><i>Placeholder — cite your source here.</i></p>';
  const A = k.f({ kind: 'claim', side: 'A', title: 'Our school should adopt a four-day week' });
  const B = k.f({ kind: 'claim', side: 'B', title: 'Our school should keep the five-day week' });
  const a1 = k.up(A, { kind: 'argument', title: 'A fourth day off improves attendance and morale' });
  const e1 = k.up(a1, { kind: 'evidence', title: 'Attendance records from districts that switched', html: ph });
  const c1 = k.up(a1, { kind: 'counter', title: 'Attendance gains can fade after the first year' });
  k.up(c1, { kind: 'evidence', title: 'Multi-year attendance trend', html: ph });
  const a2 = k.up(A, { kind: 'argument', title: 'Lower transportation and utility costs' });
  k.up(a2, { kind: 'evidence', title: 'Budget lines: buses, heating, cooling', html: ph });
  k.up(a2, { kind: 'counter', title: 'Savings are a small share of the total budget' });
  const b1 = k.up(B, { kind: 'argument', title: 'Longer days are hard on younger students' });
  k.up(b1, { kind: 'evidence', title: 'Teacher survey on afternoon focus', html: ph });
  const b2 = k.up(B, { kind: 'argument', title: 'Families need childcare on the fifth day' });
  const c3 = k.up(b2, { kind: 'counter', title: 'The fifth day can host optional enrichment programs' });
  const e3 = k.up(c3, { kind: 'evidence', title: 'Partner programs willing to run Friday sessions', html: ph });
  const st = k.f({ folder: res.id, title: 'State attendance dataset', links: [L('Add the dataset link', 'https://example.org')], html: '<p>Find the official attendance data for comparable districts.</p>' });
  const pr = k.f({ folder: res.id, title: 'List of local partner programs', dates: [d('Calls due', '2026-11-13')] });
  k.e(e1, st, { label: 'source', rel: '' }); k.e(e3, pr, { label: 'source', rel: '' });
  k.pend(); return m;
}
function debateStarter() {
  const m = blankMap('debate', 'New debate map'); const k = kit(m);
  const A = k.f({ kind: 'claim', side: 'A', title: 'Claim for the affirmative' });
  const B = k.f({ kind: 'claim', side: 'B', title: 'Claim for the negative' });
  k.up(A, { kind: 'argument', title: 'First argument' }); k.up(B, { kind: 'argument', title: 'First argument' });
  k.pend(); return m;
}

function flowExample() {
  const m = blankMap('flow', 'Program plan: STEM summer camp'); const k = kit(m);
  const lg = k.folder('Logistics', '#2E8BA8'); lg.x = 820; lg.y = 300;
  const t1 = k.f({ kind: 'terminal', title: 'Grant approved', dates: [d('', '2026-11-02')] });
  const p1 = k.child(t1, { kind: 'process', title: 'Define goals and audience', owner: 'Program lead', status: 'done', dates: [d('Due', '2026-11-20')] });
  const d1 = k.child(p1, { kind: 'decision', title: 'Budget fits the grant?' });
  const p2 = k.f({ kind: 'process', title: 'Revise scope', owner: 'Program lead', parent: d1.id });
  k.e(d1, p2, { label: 'No' }); k.e(p2, d1, { label: 'resubmit', dashed: true });
  const s1 = k.f({ kind: 'subprocess', title: 'Book labs and housing', owner: 'Operations', status: 'progress', dates: [d('Due', '2027-01-15')], parent: d1.id });
  k.e(d1, s1, { label: 'Yes' });
  const p5 = k.child(s1, { kind: 'process', title: 'Hire and train instructors', owner: 'Program lead', status: 'todo', dates: [d('', '2027-02-01', '2027-05-15')] });
  const io = k.child(s1, { kind: 'io', title: 'Open applications', dates: [d('Window', '2027-02-01', '2027-03-15')], links: [L('Application form', 'https://example.org/apply')] });
  const db = k.f({ kind: 'data', title: 'Applicant database' , parent: io.id}); k.e(io, db, { label: 'stores', dir: 'both' });
  const d2 = k.child(io, { kind: 'decision', title: 'At least 40 qualified applicants?' });
  const p3 = k.f({ kind: 'process', title: 'Extend outreach to partner schools', parent: d2.id }); k.e(d2, p3, { label: 'No' }); k.e(p3, d2, { dashed: true, label: 'recount' });
  const p4 = k.f({ kind: 'process', title: 'Select cohort and notify families', status: 'todo', dates: [d('Due', '2027-04-01')], parent: d2.id }); k.e(d2, p4, { label: 'Yes' });
  const ms = k.child(p4, { kind: 'milestone', title: 'Camp runs', dates: [d('', '2027-06-14', '2027-06-25')], html: '<p>Two weeks, residential, 40 students.</p>' });
  k.e(p5, ms, {});
  const doc = k.child(ms, { kind: 'document', title: 'Post-camp survey and report', owner: 'Evaluator', dates: [d('Due', '2027-07-15')] });
  k.child(doc, { kind: 'terminal', title: 'Report to stakeholders' });
  // logistics folder
  const hs = k.f({ folder: lg.id, kind: 'process', title: 'Housing contract', owner: 'Operations', status: 'progress', dates: [d('Sign by', '2026-12-18')] });
  const ml = k.f({ folder: lg.id, kind: 'process', title: 'Meal plan', owner: 'Operations', status: 'todo' });
  const tr = k.f({ folder: lg.id, kind: 'process', title: 'Transportation', owner: 'Operations', status: 'todo' });
  const ins = k.f({ folder: lg.id, kind: 'document', title: 'Insurance and waivers', status: 'blocked', html: '<p>Waiting on district legal review.</p>' });
  k.e(hs, ml, {}); k.e(hs, tr, {}); k.e(tr, ins, {});
  k.e(s1, hs, { label: 'includes' }); k.e(s1, ins, { label: 'includes' });
  k.pend(); return m;
}
function flowStarter() {
  const m = blankMap('flow', 'New flow chart'); const k = kit(m);
  const s = k.f({ kind: 'terminal', title: 'Start' }); const p = k.child(s, { kind: 'process', title: 'First step' });
  const dd = k.child(p, { kind: 'decision', title: 'Ready?' }, {}); const e = m.edges.find(x => x.to === dd.id); void e;
  const end = k.f({ kind: 'terminal', title: 'End', parent: dd.id }); k.e(dd, end, { label: 'Yes' }); k.e(dd, p, { label: 'No', dashed: true });
  k.pend(); return m;
}
function buildTemplate(t, variant) {
  const as = {}; let m;
  if (t === 'debate') m = variant === 'example' ? debateExample(as) : debateStarter();
  else if (t === 'flow') m = variant === 'example' ? flowExample(as) : flowStarter();
  else m = variant === 'example' ? mindExample(as) : mindStarter();
  return { map: normalize(m), assets: as };
}

/* =========================================================
   Boot
   ========================================================= */
async function persistSilently(m, as) {
  try { HT.files.write(toEnvelope(m, null)); } catch { return; }
  for (const a of Object.values(as)) { try { await IDB.put(m.id + '/' + a.id, cleanAsset(a)); } catch { try { LS.set('asset:' + m.id + '/' + a.id, JSON.stringify(cleanAsset(a))); } catch { } } }
}
async function boot() {
  if (innerWidth < 760) ui.insp = false;
  renderRail();
  let opened = false;
  const last = LS.get('last');
  if (last) opened = await openMap(last).catch(() => false);
  if (!opened) { const first = mapIndex()[0]; if (first) opened = await openMap(first.id).catch(() => false); }
  if (!opened) {
    // first run: seed the three examples so each template is one click away in Maps
    const fl = buildTemplate('flow', 'example'); const db = buildTemplate('debate', 'example');
    await persistSilently(fl.map, fl.assets); await persistSilently(db.map, db.assets);
    const mm = buildTemplate('mind', 'example'); setMap(mm.map, mm.assets); saveNow();
  }
  window.addEventListener('resize', () => applyView());
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  window.addEventListener('pagehide', () => saveNow());
}
boot();

})();
