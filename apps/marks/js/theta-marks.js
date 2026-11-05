/* Theta Marks — Happy Theta. Built from parts; one IIFE so names don't clash with core.js. */
(function () {
'use strict';
/* =========================================================
   Theta Marks — a graphical bookmark + note field.
   Nodes hold a link, a video, an image and/or rich-text notes, plus tags,
   the date added and the dates visited (opened through the app).
   Web mode places nodes by tag similarity (stress majorization, the
   Kamada–Kawai energy); Timeline mode places them by date.
   Zoomed out, very similar nearby nodes collapse into one stack.
   Saves: HappyTheta envelope (HT.files, tool 'marks') in localStorage;
   uploaded images in IndexedDB 'happytheta-marks'.
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = (p = 'k') => p + Math.random().toString(36).slice(2, 8) + (Date.now() % 1e6).toString(36);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAY = 86400000;

/* card size in world px (fixed so layout spacing can be exact) */
const CARD_W = 148, CARD_H = 146;
const UNIT = 205; // world px per unit of layout distance

/* tag colours: a stable hash into a palette that reads on white */
const TAG_COLORS = ['#1D4ED8', '#D9622B', '#7A4FD0', '#047857', '#B8324F', '#A16207', '#2E8BA8', '#5E7A2E', '#8A5A3C', '#C026D3', '#0F766E', '#9F1239'];
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const tagColor = t => TAG_COLORS[hash(String(t)) % TAG_COLORS.length];

/* ---------- icons ---------- */
const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ICON = {
  link: I('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  video: I('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>'),
  image: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>'),
  note: I('<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h6M9 8h3"/>'),
  open: I('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  trash: I('<path d="M5 7h14M10 11v6M14 11v6M9 4h6l1 3H8z"/><path d="M6 7l1 13h10l1-13"/>'),
  pin: I('<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  tag: I('<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  sparkle: I('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  upload: I('<path d="M12 16V4m0 0-4 4m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
  bold: I('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
  italic: I('<path d="M11 5h6M7 19h6M14 5l-4 14"/>'),
  under: I('<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>'),
  ul: I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
  ol: I('<path d="M10 6h10M10 12h10M10 18h10M4 5h1.5v4M4 14.5h2.5L4 18h3"/>'),
  h: I('<path d="M5 5v14M14 5v14M5 12h9M18 10l2-1v10"/>'),
  quote: I('<path d="M6 17h4v-5H6c0-3 1-4 3-5M14 17h4v-5h-4c0-3 1-4 3-5"/>'),
  code: I('<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>'),
  clear: I('<path d="M5 19h7M8 5h11M13 5 9 19"/><path d="m15 15 5 5M20 15l-5 5"/>'),
};
const TYPE_ICON = { link: ICON.link, video: ICON.video, image: ICON.image, note: ICON.note };
const TYPE_LABEL = { link: 'Link', video: 'Video', image: 'Image', note: 'Note' };

/* ---------- dates ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ts = iso => { const t = Date.parse(iso); return isNaN(t) ? 0 : t; };
function fmtDay(iso, withYear) {
  const d = new Date(typeof iso === 'number' ? iso : ts(iso)); if (isNaN(d)) return '';
  const y = withYear === undefined ? d.getFullYear() !== new Date().getFullYear() : withYear;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${y ? ', ' + d.getFullYear() : ''}`;
}
function fmtWhen(iso) {
  const d = new Date(typeof iso === 'number' ? iso : ts(iso)); if (isNaN(d)) return '';
  return fmtDay(iso) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function ago(iso) {
  const t = typeof iso === 'number' ? iso : ts(iso); if (!t) return '';
  const days = Math.floor((startOfDay(Date.now()) - startOfDay(t)) / DAY);
  if (days <= 0) return 'today'; if (days === 1) return 'yesterday';
  if (days < 14) return days + ' days ago'; if (days < 60) return Math.round(days / 7) + ' weeks ago';
  if (days < 730) return Math.round(days / 30.4) + ' months ago'; return Math.round(days / 365) + ' years ago';
}
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
const dayInput = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fromDayInput = (s, end) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); if (end) d.setHours(23, 59, 59, 999); return d.getTime(); };
const lastVisit = n => n.visits.length ? Math.max(...n.visits.map(ts)) : 0;

/* ---------- URLs ---------- */
function safeUrl(u) { u = String(u || '').trim(); if (!u) return ''; if (/^(https?:|mailto:)/i.test(u)) return u; if (/^[\w.-]+\.[a-z]{2,}(:\d+)?(\/|$|\?|#)/i.test(u)) return 'https://' + u; return ''; }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
const isImgData = u => /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(String(u || ''));

/* Video links: YouTube, Vimeo, or a direct media file */
function parseVideo(u) {
  u = safeUrl(u); if (!u) return null;
  let url; try { url = new URL(u); } catch { return null; }
  const h = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (h === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
    if (url.searchParams.get('v')) id = url.searchParams.get('v');
    else { const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/); if (m) id = m[1]; }
  }
  if (id && /^[\w-]{6,20}$/.test(id)) {
    const t = parseInt(url.searchParams.get('t') || url.searchParams.get('start') || '0', 10) || 0;
    return { kind: 'youtube', id, url: u, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1${t ? '&start=' + t : ''}` };
  }
  if (h.endsWith('youtube.com')) return { kind: 'page', url: u };
  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    const m = url.pathname.match(/(\d{5,})/); if (m) return { kind: 'vimeo', id: m[1], url: u, embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1` };
  }
  if (/\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(url.pathname)) return { kind: 'file', url: u };
  return { kind: 'page', url: u };
}
/* site icon (favicon / logo) through a public icon service; works as a plain <img> */
const siteIcon = host => host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : '';

/* ---------- rich text sanitizer (same rules as Theta Maps) ---------- */
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H3', 'H4', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'SPAN', 'CODE', 'PRE', 'SUB', 'SUP']);
function sanitize(html) {
  const tpl = document.createElement('template'); tpl.innerHTML = String(html || '');
  const walk = el => {
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1) { c.remove(); continue; }
      const tag = c.tagName;
      if (tag === 'H1' || tag === 'H2') { const h = document.createElement('h3'); h.append(...c.childNodes); c.replaceWith(h); walk(h); continue; }
      if (!OK_TAGS.has(tag)) { if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tag)) { c.remove(); continue; } walk(c); c.replaceWith(...c.childNodes); continue; }
      for (const a of Array.from(c.attributes)) if (!(tag === 'A' && a.name === 'href')) c.removeAttribute(a.name);
      if (tag === 'A') { const h = safeUrl(c.getAttribute('href')); if (h) { c.setAttribute('href', h); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); } else c.removeAttribute('href'); }
      walk(c);
    }
  };
  walk(tpl.content); return tpl.innerHTML;
}
const plain = html => { const d = document.createElement('div'); d.innerHTML = sanitize(html); d.querySelectorAll('br,p,div,li,h3,h4').forEach(e => e.append(' ')); return d.textContent.replace(/\s+/g, ' ').trim(); };

/* ---------- tags ---------- */
const cleanTag = t => String(t || '').toLowerCase().replace(/[#,;]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
function cleanTags(list) { const out = []; for (const t of list || []) { const c = cleanTag(t); if (c && !out.includes(c)) out.push(c); } return out; }

/* ---------- model ---------- */
let col = null;            // the open collection
let assets = {};           // id -> {id,name,mime,data}
let byId = {};
const ui = { sel: new Set(), hover: null, filtersOpen: false, inspOpen: true, editing: null };

function newNode(o = {}) {
  return Object.assign({
    id: uid('k'), title: '', url: '', video: '', videoThumb: '', image: null, notes: '', tags: [],
    added: new Date().toISOString(), visits: [], thumb: { mode: 'auto' }, x: null, y: null, pinned: false,
  }, o);
}
function blankCollection(name = 'My marks') {
  return normalize({ id: HT.files.newId('s'), name, created: Date.now(), nodes: [], settings: {}, view: {} });
}
function normalize(c) {
  c.nodes = (Array.isArray(c.nodes) ? c.nodes : []).filter(n => n && typeof n === 'object').map(n => {
    const m = newNode(n);
    m.id = String(m.id || uid('k'));
    m.title = String(m.title || '').slice(0, 300);
    m.url = safeUrl(m.url); m.video = safeUrl(m.video);
    m.videoThumb = /^https:\/\//.test(m.videoThumb || '') ? m.videoThumb : '';
    if (m.image && typeof m.image === 'object') { m.image = m.image.asset ? { asset: String(m.image.asset), name: m.image.name || '' } : (safeUrl(m.image.url) || isImgData(m.image.url) ? { url: isImgData(m.image.url) ? m.image.url : safeUrl(m.image.url) } : null); } else m.image = null;
    m.notes = sanitize(m.notes || '');
    m.tags = cleanTags(m.tags);
    if (!ts(m.added)) m.added = new Date().toISOString();
    m.visits = (Array.isArray(m.visits) ? m.visits : []).filter(v => ts(v)).sort();
    const mode = m.thumb && m.thumb.mode;
    m.thumb = { mode: ['auto', 'image', 'video', 'site', 'custom', 'none'].includes(mode) ? mode : 'auto', asset: m.thumb && m.thumb.asset ? String(m.thumb.asset) : undefined };
    m.x = Number.isFinite(m.x) ? m.x : null; m.y = Number.isFinite(m.y) ? m.y : null;
    m.pinned = !!m.pinned;
    return m;
  });
  const seen = new Set(); c.nodes = c.nodes.filter(n => !seen.has(n.id) && seen.add(n.id));
  c.settings = Object.assign({ mode: 'web', timeBasis: 'added', links: true, collapse: true, dimMode: 'dim' }, c.settings || {});
  c.view = Object.assign({ web: null, time: null }, c.view || {});
  c.timePos = c.timePos || {};
  return c;
}
function index() { byId = {}; for (const n of col.nodes) byId[n.id] = n; }
function typesOf(n) {
  const t = [];
  if (n.url) t.push('link');
  if (n.video) t.push('video');
  if (n.image) t.push('image');
  if (n.notes && plain(n.notes)) t.push('note');
  return t;
}
function displayTitle(n) {
  if (n.title) return n.title;
  if (n.url) return hostOf(n.url) || n.url;
  if (n.video) return hostOf(n.video) || 'Video';
  const p = plain(n.notes); if (p) return p.slice(0, 60);
  return n.image ? 'Image' : 'Untitled';
}
const allTags = () => { const m = new Map(); for (const n of col.nodes) for (const t of n.tags) m.set(t, (m.get(t) || 0) + 1); return m; };

/* ---------- storage ---------- */
const TOOL = 'marks';
const KEY = 'happytheta:marks:';
const LS = {
  get(k) { try { return localStorage.getItem(KEY + k); } catch { return null; } },
  set(k, v) { localStorage.setItem(KEY + k, v); },
  del(k) { try { localStorage.removeItem(KEY + k); } catch { } },
  json(k, d) { try { const v = this.get(k); return v ? JSON.parse(v) : d; } catch { return d; } },
};
const IDB = {
  db: null, failed: false,
  open() {
    if (this.db) return Promise.resolve(this.db);
    if (this.failed || !('indexedDB' in window)) return Promise.reject(new Error('no idb'));
    return new Promise((res, rej) => {
      let r; try { r = indexedDB.open('happytheta-marks', 1); } catch (e) { this.failed = true; return rej(e); }
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
const dirtyAssets = new Set();
function addAsset(a) { assets[a.id] = a; dirtyAssets.add(a.id); }
function refAssetIds(c = col) {
  const s = new Set();
  for (const n of c.nodes) { if (n.image && n.image.asset) s.add(n.image.asset); if (n.thumb.asset) s.add(n.thumb.asset); }
  return s;
}
const assetSrc = id => (id && assets[id] && assets[id].data) || '';
const imageSrc = n => !n.image ? '' : n.image.asset ? assetSrc(n.image.asset) : (n.image.url || '');

/* envelope: data = what the collection holds; view = how it was being looked at */
let curEnv = null;
function toEnvelope(c, prev, extra) {
  const data = Object.assign({ format: 'theta-marks', v: 1, nodes: c.nodes, settings: c.settings, timePos: c.timePos }, extra || {});
  const base = prev || { id: c.id, meta: { created: new Date(c.created || Date.now()).toISOString() } };
  return HT.files.wrap(TOOL, { title: c.name, data: JSON.parse(JSON.stringify(data)), view: { view: c.view } }, base);
}
function fromEnvelope(f) {
  const d = f.data || {};
  return normalize({ id: f.id, name: f.meta.title || 'Untitled', created: ts(f.meta.created) || Date.now(), nodes: d.nodes, settings: d.settings, timePos: d.timePos, view: (f.view && f.view.view) || {} });
}
function collectionIndex() {
  let list = []; try { list = HT.files.list(TOOL); } catch { }
  return list.map(f => ({ id: f.id, name: f.meta.title, modified: ts(f.meta.modified), count: (f.data.nodes || []).length }));
}
let saveTimer = null, saveErr = '';
function scheduleSave() { setSave('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 600); }
async function saveNow() {
  clearTimeout(saveTimer); saveTimer = null; if (!col) return;
  let ok = true;
  try {
    curEnv = toEnvelope(col, curEnv && curEnv.id === col.id ? curEnv : null);
    HT.files.write(curEnv); LS.set('last', col.id);
  } catch (e) { ok = false; saveErr = e && e.name === 'QuotaExceededError' ? 'Browser storage is full. Export the collection as a file to keep it.' : 'This browser blocked storage. Export the collection as a file to keep it.'; }
  for (const id of Array.from(dirtyAssets)) {
    const a = assets[id]; if (!a) { dirtyAssets.delete(id); continue; }
    try { await IDB.put(col.id + '/' + id, a); dirtyAssets.delete(id); }
    catch { try { LS.set('asset:' + col.id + '/' + id, JSON.stringify(a)); dirtyAssets.delete(id); } catch { ok = false; saveErr = 'Images could not be stored in this browser. Export the collection as a file to keep them.'; } }
  }
  if (ok) { saveErr = ''; setSave('Saved in this browser'); } else setSave('Not saved', true);
}
function setSave(t, err) { const el = $('#mkSave'); if (!el) return; el.textContent = t; el.classList.toggle('err', !!err); el.title = err ? saveErr : 'Changes save automatically to this browser'; }
async function loadAssetsFor(id) {
  const out = {};
  try { for (const [k, v] of await IDB.all(id + '/')) out[k.slice(id.length + 1)] = v; } catch { }
  try { const p = KEY + 'asset:' + id + '/'; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(p)) { try { out[k.slice(p.length)] = JSON.parse(localStorage.getItem(k)); } catch { } } } } catch { }
  return out;
}
async function openCollection(id) {
  let f = null; try { f = HT.files.read(TOOL, id); } catch { f = null; }
  if (!f) return false;
  if (col) await saveNow();
  const c = fromEnvelope(f);
  const a = await loadAssetsFor(id);
  const refs = refAssetIds(c);
  for (const k of Object.keys(a)) if (!refs.has(k)) { delete a[k]; IDB.del(id + '/' + k).catch(() => { }); LS.del('asset:' + id + '/' + k); }
  curEnv = f; setCollection(c, a, false); return true;
}
async function deleteCollection(id) {
  try { HT.files.remove(TOOL, id); } catch { }
  IDB.delPrefix(id + '/');
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(KEY + 'asset:' + id + '/')) localStorage.removeItem(k); } } catch { }
  if (LS.get('last') === id) LS.del('last');
}

/* ---------- history ---------- */
let undoStack = [], redoStack = [];
const snapshot = () => JSON.stringify({ nodes: col.nodes, settings: col.settings, timePos: col.timePos });
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; updUndo(); }
function restore(s) { const o = JSON.parse(s); col.nodes = o.nodes; col.settings = o.settings; col.timePos = o.timePos || {}; normalize(col); index(); pruneSel(); invalidateSim(); matchMemo = new Map(); tposDirty = true; renderAll(); scheduleSave(); }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updUndo(); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updUndo(); }
function updUndo() { $('#mkUndo').disabled = !undoStack.length; $('#mkRedo').disabled = !redoStack.length; }
function pruneSel() { for (const id of Array.from(ui.sel)) if (!byId[id]) ui.sel.delete(id); }
/* every change goes through act(): undo point, re-index, save, redraw (relayout when tags/nodes changed) */
function act(fn, { relayout = false, quiet = false } = {}) {
  pushUndo(); fn(); index(); pruneSel(); matchMemo = new Map(); groupCache = null; scheduleSave();
  if (relayout) { invalidateSim(); relayoutSoon(); }
  if (!quiet) renderAll();
}
/* =========================================================
   Similarity, Web layout (stress majorization = Kamada–Kawai energy),
   Timeline layout, zoom-out grouping
   ========================================================= */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Similarity of two nodes in 0..1: IDF-weighted Jaccard of their tags
   (a tag shared by few nodes says more than one everybody has), plus a small
   bonus for the same website. */
let simCache = null; // {ids, pos: Map id->i, S: Float32Array}
function invalidateSim() { simCache = null; groupCache = null; }
function simData() {
  if (simCache) return simCache;
  const nodes = col.nodes, N = nodes.length;
  const df = allTags(), w = new Map();
  for (const [t, c] of df) w.set(t, Math.log(1 + (N + 1) / c));
  const hosts = nodes.map(n => hostOf(n.url || n.video));
  const S = new Float32Array(N * N);
  for (let i = 0; i < N; i++) {
    S[i * N + i] = 1;
    const a = nodes[i].tags;
    for (let j = i + 1; j < N; j++) {
      const b = nodes[j].tags;
      let inter = 0, uni = 0;
      if (a.length || b.length) {
        for (const t of a) { const wt = w.get(t) || 1; uni += wt; if (b.includes(t)) inter += wt; }
        for (const t of b) if (!a.includes(t)) uni += w.get(t) || 1;
      }
      let s = uni ? inter / uni : 0;
      if (hosts[i] && hosts[i] === hosts[j]) s = Math.min(1, s + (s ? 0.1 : 0.25));
      S[i * N + j] = S[j * N + i] = s;
    }
  }
  const pos = new Map(nodes.map((n, i) => [n.id, i]));
  simCache = { ids: nodes.map(n => n.id), pos, S, N };
  return simCache;
}
const simOf = (a, b) => { const d = simData(); const i = d.pos.get(a), j = d.pos.get(b); return i === undefined || j === undefined ? 0 : d.S[i * d.N + j]; };

/* Target distances: graph of similar pairs (edge length shrinks as similarity grows),
   then shortest paths, like Kamada–Kawai. Unconnected pairs sit a fixed gap apart. */
function targetDistances() {
  const { S, N } = simData();
  const D = new Float32Array(N * N).fill(Infinity);
  for (let i = 0; i < N; i++) {
    D[i * N + i] = 0;
    for (let j = 0; j < N; j++) if (i !== j && S[i * N + j] >= 0.06) D[i * N + j] = 0.78 + 1.05 * (1 - S[i * N + j]);
  }
  if (N <= 700) { // Floyd–Warshall
    for (let k = 0; k < N; k++) { const kN = k * N; for (let i = 0; i < N; i++) { const ik = D[i * N + k]; if (ik === Infinity) continue; const iN = i * N; for (let j = 0; j < N; j++) { const v = ik + D[kN + j]; if (v < D[iN + j]) D[iN + j] = v; } } }
  }
  let mx = 0; for (let i = 0; i < N * N; i++) if (D[i] !== Infinity && D[i] > mx) mx = D[i];
  const gap = Math.min(Math.max(mx, 2) + 0.9, 4.4);
  for (let i = 0; i < N * N; i++) if (D[i] === Infinity || D[i] > gap) D[i] = gap;
  return D;
}

/* Stress majorization (SMACOF, Gauss–Seidel sweeps). fixX: only y moves (timeline). */
function majorize(P, D, N, { iters, pinned, fixX }) {
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let i = 0; i < N; i++) {
      if (pinned[i]) continue;
      let sw = 0, nx = 0, ny = 0; const xi = P[2 * i], yi = P[2 * i + 1];
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const d = D[i * N + j]; if (!(d > 0)) continue;
        const w = 1 / (d * d);
        let dx = xi - P[2 * j], dy = yi - P[2 * j + 1]; let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) { dx = (Math.random() - .5) * 1e-3; dy = (Math.random() - .5) * 1e-3; dist = Math.hypot(dx, dy); }
        nx += w * (P[2 * j] + d * dx / dist); ny += w * (P[2 * j + 1] + d * dy / dist); sw += w;
      }
      if (!sw) continue;
      const tx = fixX ? xi : nx / sw, ty = ny / sw;
      moved = Math.max(moved, Math.abs(tx - xi) + Math.abs(ty - yi));
      P[2 * i] = tx; P[2 * i + 1] = ty;
    }
    if (moved < 1e-3) break;
  }
}

/* Push overlapping cards apart (pinned cards stay). vertOnly for the timeline. */
function separate(P, N, pinned, { vertOnly = false, passes = 40 } = {}) {
  const W = (CARD_W + 18) / UNIT, H = (CARD_H + 18) / UNIT;
  for (let p = 0; p < passes; p++) {
    let any = false;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const dx = P[2 * j] - P[2 * i], dy = P[2 * j + 1] - P[2 * i + 1];
      const ox = W - Math.abs(dx), oy = H - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;
      any = true;
      const pi = pinned[i], pj = pinned[j]; if (pi && pj) continue;
      const fi = pi ? 0 : pj ? 1 : .5, fj = 1 - fi;
      if (!vertOnly && ox < oy) { const s = (dx >= 0 ? 1 : -1) * ox; P[2 * i] -= s * fi; P[2 * j] += s * fj; }
      else { const s = (dy > 0 || (dy === 0 && i < j) ? 1 : -1) * oy; P[2 * i + 1] -= s * fi; P[2 * j + 1] += s * fj; }
    }
    if (!any) break;
  }
}

/* ---- Web layout: positions live on the nodes (n.x, n.y in world px) ---- */
function layoutWeb({ fresh = false } = {}) {
  const nodes = col.nodes, N = nodes.length; if (!N) return;
  const { S } = simData();
  const D = targetDistances();
  const P = new Float64Array(2 * N), pinned = new Uint8Array(N), placed = new Uint8Array(N);
  let anyPlaced = false;
  nodes.forEach((n, i) => {
    const keep = n.pinned || (!fresh && n.x !== null);
    if (keep && n.x !== null) { P[2 * i] = n.x / UNIT; P[2 * i + 1] = n.y / UNIT; placed[i] = 1; anyPlaced = true; }
    pinned[i] = n.pinned && n.x !== null ? 1 : 0;
  });
  // new nodes start next to the nodes they are most like
  nodes.forEach((n, i) => {
    if (placed[i]) return;
    const r = rng(hash(n.id));
    let sw = 0, x = 0, y = 0;
    if (anyPlaced) for (let j = 0; j < N; j++) if (placed[j] && S[i * N + j] > 0) { const w = S[i * N + j] ** 2; sw += w; x += w * P[2 * j]; y += w * P[2 * j + 1]; }
    if (sw) { P[2 * i] = x / sw + (r() - .5) * .6; P[2 * i + 1] = y / sw + (r() - .5) * .6; }
    else { const a = r() * Math.PI * 2, rad = Math.sqrt(N) * .9 * (0.4 + r() * .6); P[2 * i] = Math.cos(a) * rad; P[2 * i + 1] = Math.sin(a) * rad; }
  });
  const fewNew = !fresh && anyPlaced;
  majorize(P, D, N, { iters: fewNew ? 70 : 320, pinned });
  separate(P, N, pinned);
  nodes.forEach((n, i) => { n.x = Math.round(P[2 * i] * UNIT); n.y = Math.round(P[2 * i + 1] * UNIT); });
}
let relayoutTimer = null;
function relayoutSoon(opts) { clearTimeout(relayoutTimer); relayoutTimer = setTimeout(() => { layoutWeb(opts); tposDirty = true; groupCache = null; scheduleSave(); renderField(true); }, 30); }

/* ---- Timeline layout: x = date (added or last visited); y = similarity, kept apart ---- */
let tpos = {}, tposDirty = true, timeScale = null;
function timeOf(n) { return col.settings.timeBasis === 'visited' ? lastVisit(n) : ts(n.added); }
function layoutTime() {
  tposDirty = false; tpos = {};
  const nodes = col.nodes, N = nodes.length; if (!N) { timeScale = null; return; }
  const times = nodes.map(timeOf), real = times.filter(Boolean);
  const t0 = real.length ? startOfDay(Math.min(...real)) : startOfDay(Date.now());
  const t1 = real.length ? startOfDay(Math.max(...real)) + DAY : t0 + DAY;
  const spanDays = Math.max(1, (t1 - t0) / DAY);
  const width = clamp(N * 58, 900, 7000);
  const pxDay = clamp(width / spanDays, 4, 260);
  timeScale = { t0, t1, pxDay, never: times.some(t => !t), neverX: -CARD_W * 1.6 };
  const D = targetDistances();
  const P = new Float64Array(2 * N), pinned = new Uint8Array(N);
  nodes.forEach((n, i) => {
    const t = times[i];
    P[2 * i] = (t ? (t - t0) / DAY * pxDay : timeScale.neverX) / UNIT;
    P[2 * i + 1] = n.y !== null ? n.y / UNIT * .5 : (rng(hash(n.id))() - .5) * 3;
  });
  majorize(P, D, N, { iters: 120, pinned, fixX: true });
  separate(P, N, pinned, { vertOnly: true, passes: 120 });
  nodes.forEach((n, i) => { tpos[n.id] = { x: Math.round(P[2 * i] * UNIT), y: Math.round(P[2 * i + 1] * UNIT) }; });
  // undated / never-visited nodes: a block of columns left of the axis instead of one tall column
  const nev = nodes.map((n, i) => i).filter(i => !times[i]).sort((a, b) => P[2 * a + 1] - P[2 * b + 1]);
  if (nev.length > 3) {
    const cols = Math.ceil(Math.sqrt(nev.length / 2)), rows = Math.ceil(nev.length / cols);
    const ys = nodes.map((n, i) => P[2 * i + 1] * UNIT).filter((y, i) => times[i]);
    const mid = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    nev.forEach((i, k) => { const c = Math.floor(k / rows), r = k % rows; tpos[nodes[i].id] = { x: Math.round(timeScale.neverX - (cols - 1 - c) * (CARD_W + 22)), y: Math.round(mid + (r - (rows - 1) / 2) * (CARD_H + 22)) }; });
    timeScale.neverX -= (cols - 1) * (CARD_W + 22) / 2;
  }
}
function posOf(n) {
  if (col.settings.mode === 'time') { if (tposDirty) layoutTime(); return tpos[n.id] || { x: 0, y: 0 }; }
  return { x: n.x || 0, y: n.y || 0 };
}

/* ---- Zoom-out grouping: nearby nodes that are very alike share one stack ----
   The further out you zoom, the lower the similarity needed and the larger the reach. */
let groupCache = null;
function groupsFor(k, visibleIds) {
  if (!col.settings.collapse || k >= 0.7) return [];
  const key = Math.round(k * 50) + '|' + col.settings.mode + '|' + filterKey;
  if (groupCache && groupCache.key === key) return groupCache.groups;
  // further out: lower similarity needed; below ~25% zoom any close neighbours share a pile
  const thr = clamp(0.92 - (0.7 - k) / 0.45 * 0.92, 0, 0.92);
  const reach = 125 / k;
  const nodes = col.nodes.filter(n => visibleIds.has(n.id));
  const ps = nodes.map(posOf), match = nodes.map(n => matches(n));
  // centroid linkage: closest pairs first; two piles join only if their centres are within reach
  const pairs = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (match[i] !== match[j]) continue;
    const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y; if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
    const d = Math.hypot(dx, dy); if (d > reach) continue;
    if (simOf(nodes[i].id, nodes[j].id) < thr) continue;
    pairs.push([d, i, j]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const parent = nodes.map((_, i) => i), cx = ps.map(p => p.x), cy = ps.map(p => p.y), size = nodes.map(() => 1);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (const [, i, j] of pairs) {
    const a = find(i), b = find(j); if (a === b) continue;
    if (Math.hypot(cx[a] - cx[b], cy[a] - cy[b]) > reach) continue;
    const n = size[a] + size[b]; cx[a] = (cx[a] * size[a] + cx[b] * size[b]) / n; cy[a] = (cy[a] * size[a] + cy[b] * size[b]) / n; size[a] = n; parent[b] = a;
  }
  const by = new Map();
  nodes.forEach((n, i) => { const r = find(i); if (!by.has(r)) by.set(r, []); by.get(r).push(i); });
  const groups = [];
  for (const idx of by.values()) {
    if (idx.length < 2) continue;
    const members = idx.map(i => nodes[i]);
    const x = idx.reduce((s, i) => s + ps[i].x, 0) / idx.length, y = idx.reduce((s, i) => s + ps[i].y, 0) / idx.length;
    const cnt = new Map(); for (const m of members) for (const t of m.tags) cnt.set(t, (cnt.get(t) || 0) + 1);
    const common = [...cnt].filter(([, c]) => c === members.length).map(([t]) => t);
    const top = common.length ? common : [...cnt].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const hosts = new Set(members.map(m => hostOf(m.url || m.video)));
    let label = top.slice(0, 2).join(' · ');
    if (!label && hosts.size === 1 && [...hosts][0]) label = [...hosts][0];
    groups.push({ id: 'g' + members.map(m => m.id).sort()[0], members, x, y, label: label || 'Similar items', match: match[idx[0]], tags: top.slice(0, 4) });
  }
  groupCache = { key, groups };
  return groups;
}
/* =========================================================
   Search + filters (state), field rendering, view, interaction
   ========================================================= */
const F = { q: '', tagsIn: new Set(), tagsOut: new Set(), tagMode: 'any', types: new Set(), added: { preset: 'any', from: '', to: '' }, visited: { preset: 'any', from: '', to: '' } };
let filterKey = '';
let matchMemo = new Map();
function filtersActive() {
  return !!(F.q.trim() || F.tagsIn.size || F.tagsOut.size || F.types.size || F.added.preset !== 'any' || F.visited.preset !== 'any');
}
function filterCount() { return (F.tagsIn.size + F.tagsOut.size) + F.types.size + (F.added.preset !== 'any') + (F.visited.preset !== 'any'); }
function presetRange(p, from, to) {
  const now = Date.now(), sod = startOfDay(now);
  switch (p) {
    case 'today': return [sod, now + DAY];
    case '7': return [sod - 6 * DAY, now + DAY];
    case '30': return [sod - 29 * DAY, now + DAY];
    case '365': return [sod - 364 * DAY, now + DAY];
    case 'custom': return [fromDayInput(from) ?? -Infinity, fromDayInput(to, true) ?? Infinity];
  }
  return null;
}
function haystack(n) { return [n.title, n.url, n.video, plain(n.notes), n.tags.join(' '), hostOf(n.url || n.video), n.image && n.image.name].join(' ').toLowerCase(); }
function matches(n) {
  if (matchMemo.has(n.id)) return matchMemo.get(n.id);
  const r = matchesRaw(n); matchMemo.set(n.id, r); return r;
}
function matchesRaw(n) {
  const words = F.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) { const h = haystack(n); if (!words.every(w => h.includes(w.replace(/^#/, '')))) return false; }
  if (F.tagsIn.size) { const has = [...F.tagsIn].map(t => n.tags.includes(t)); if (F.tagMode === 'all' ? !has.every(Boolean) : !has.some(Boolean)) return false; }
  for (const t of F.tagsOut) if (n.tags.includes(t)) return false;
  if (F.types.size) { const ty = typesOf(n); if (![...F.types].some(t => ty.includes(t))) return false; }
  const ar = presetRange(F.added.preset, F.added.from, F.added.to);
  if (ar) { const t = ts(n.added); if (t < ar[0] || t > ar[1]) return false; }
  const vp = F.visited.preset;
  if (vp === 'never') { if (n.visits.length) return false; }
  else if (vp === 'stale') { const lv = lastVisit(n); if (!lv || lv >= Date.now() - 30 * DAY) return false; }
  else if (vp !== 'any') { const r = presetRange(vp, F.visited.from, F.visited.to); if (!n.visits.some(v => { const t = ts(v); return t >= r[0] && t <= r[1]; })) return false; }
  return true;
}
function filtersChanged() {
  matchMemo = new Map();
  filterKey = JSON.stringify([F.q, [...F.tagsIn], [...F.tagsOut], F.tagMode, [...F.types], F.added, F.visited, col && col.settings.dimMode]);
  groupCache = null;
  const n = filterCount(); const b = $('#mkFilterCount'); b.hidden = !n; b.textContent = n;
  renderField(); renderFilters(); renderInspector();
}
function visibleSet() {
  const hide = col.settings.dimMode === 'hide' && filtersActive();
  return new Set(col.nodes.filter(n => !hide || matches(n)).map(n => n.id));
}

/* ---------- thumbnails ---------- */
function videoThumb(n) { const v = parseVideo(n.video); return (v && v.thumb) || n.videoThumb || ''; }
function thumbFor(n) {
  const host = hostOf(n.url || n.video);
  const cover = src => src ? { src, kind: 'cover' } : null;
  const icon = h => h ? { src: siteIcon(h), kind: 'icon' } : null;
  switch (n.thumb.mode) {
    case 'custom': return cover(assetSrc(n.thumb.asset)) || glyphThumb(n);
    case 'image': return cover(imageSrc(n)) || glyphThumb(n);
    case 'video': return cover(videoThumb(n)) || glyphThumb(n);
    case 'site': return icon(host) || glyphThumb(n);
    case 'none': return glyphThumb(n);
  }
  return cover(assetSrc(n.thumb.asset)) || cover(imageSrc(n)) || cover(videoThumb(n)) || icon(host) || glyphThumb(n);
}
function glyphThumb(n) { const t = typesOf(n); return { kind: 'glyph', glyph: t.includes('video') ? 'video' : t.includes('link') ? 'link' : t.includes('image') ? 'image' : 'note' }; }
function thumbHTML(th, n) {
  const g = `<span class="mk-glyph" style="color:${n.tags[0] ? tagColor(n.tags[0]) : 'var(--accent)'}">${TYPE_ICON[th.glyph || glyphThumb(n).glyph]}</span>`;
  if (th.kind === 'glyph') return g;
  return `<img src="${esc(th.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false">${g}`;
}

/* ---------- field ---------- */
const stage = $('#mkStage'), world = $('#mkWorld'), layer = $('#mkLayer'), linksSvg = $('#mkLinks'), axisEl = $('#mkAxis');
const els = new Map(); // key -> element
const V = () => { const m = col.settings.mode; if (!col.view[m]) col.view[m] = { x: 0, y: 0, k: 1, unset: true }; return col.view[m]; };
function applyView() {
  const v = V();
  world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`;
  // zoomed out, cards and piles are drawn larger than life so they stay readable
  const s0 = col.settings.mode === 'time' ? 0.48 : 0.55; // timeline columns are packed tighter, so grow less
  stage.style.setProperty('--s', v.k < s0 ? (s0 / v.k).toFixed(3) : 1);
  stage.style.setProperty('--sg', v.k < 0.75 ? (0.75 / v.k).toFixed(3) : 1);
  stage.classList.toggle('mk-far', v.k < s0);
  stage.classList.toggle('mk-timeline', col.settings.mode === 'time');
  $('#mkZoomLbl').textContent = Math.round(v.k * 100) + '%';
  $('#mkZoomRange').value = Math.round((Math.log(v.k) - Math.log(ZMIN)) / (Math.log(ZMAX) - Math.log(ZMIN)) * 100);
  const bucket = col.settings.collapse && v.k < 0.7 ? Math.round(v.k * 50) : -1;
  if (bucket !== applyView.bucket) { applyView.bucket = bucket; renderField(); }
  renderAxis();
}
const ZMIN = 0.06, ZMAX = 2.5;
function toWorld(cx, cy) { const r = stage.getBoundingClientRect(), v = V(); return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k }; }
function viewCenter() { const r = stage.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); }
function zoomAt(cx, cy, factor) {
  const v = V(), r = stage.getBoundingClientRect();
  const k = clamp(v.k * factor, ZMIN, ZMAX); const f = k / v.k;
  v.x = cx - r.left - (cx - r.left - v.x) * f; v.y = cy - r.top - (cy - r.top - v.y) * f; v.k = k; delete v.unset;
  applyView(); saveViewSoon();
}
function zoomCenter(factor) { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor); }
let viewTimer; function saveViewSoon() { clearTimeout(viewTimer); viewTimer = setTimeout(scheduleSave, 800); }
function fitTo(points, { animate = true, maxK = 1.15 } = {}) {
  const r = stage.getBoundingClientRect(); if (!r.width) return;
  if (!points.length) { const v = V(); v.x = r.width / 2; v.y = r.height / 2; v.k = 1; delete v.unset; applyView(); return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x - CARD_W / 2); x1 = Math.max(x1, p.x + CARD_W / 2); y0 = Math.min(y0, p.y - CARD_H / 2); y1 = Math.max(y1, p.y + CARD_H / 2); }
  const padX = 60, padTop = col.settings.mode === 'time' ? 70 : 50, padBot = 70;
  const k = clamp(Math.min((r.width - 2 * padX) / (x1 - x0), (r.height - padTop - padBot) / (y1 - y0)), ZMIN, maxK);
  const v = V(); v.k = k; v.x = (r.width - (x1 - x0) * k) / 2 - x0 * k; v.y = padTop + (r.height - padTop - padBot - (y1 - y0) * k) / 2 - y0 * k; delete v.unset;
  if (animate) { world.classList.add('mk-anim'); setTimeout(() => world.classList.remove('mk-anim'), 420); }
  applyView(); saveViewSoon();
}
function fitAll(animate = true) { const vis = visibleSet(); fitTo(col.nodes.filter(n => vis.has(n.id) && (!filtersActive() || matches(n) || col.settings.dimMode !== 'dim')).map(posOf), { animate }); }
function centerOn(id, k) {
  const n = byId[id]; if (!n) return; const p = posOf(n), r = stage.getBoundingClientRect(), v = V();
  if (k) v.k = k; else if (v.k < 0.75) v.k = 0.9;
  v.x = r.width / 2 - p.x * v.k; v.y = r.height / 2 - p.y * v.k; delete v.unset;
  world.classList.add('mk-anim'); setTimeout(() => world.classList.remove('mk-anim'), 420);
  applyView(); saveViewSoon();
}

let fieldQueued = false;
function scheduleField() { if (fieldQueued) return; fieldQueued = true; requestAnimationFrame(() => { fieldQueued = false; renderField(); }); }
let lastItems = [];
function renderField(animate) {
  if (!col) return;
  const v = V(), vis = visibleSet(), active = filtersActive(), dim = col.settings.dimMode === 'dim';
  const groups = groupsFor(v.k, vis);
  const inGroup = new Map(); for (const g of groups) for (const m of g.members) inGroup.set(m.id, g);
  const keep = new Set(), items = [];
  layer.classList.toggle('mk-moving', !!animate);
  if (animate) { clearTimeout(renderField.t); renderField.t = setTimeout(() => layer.classList.remove('mk-moving'), 650); }
  for (const n of col.nodes) {
    if (!vis.has(n.id) || inGroup.has(n.id)) continue;
    const key = 'n:' + n.id; keep.add(key);
    const p = posOf(n); items.push({ key, x: p.x, y: p.y, ids: [n.id] });
    let el = els.get(key);
    const th = thumbFor(n);
    const sig = JSON.stringify([displayTitle(n), th, n.tags, typesOf(n), n.pinned, n.visits.length]);
    if (!el) { el = document.createElement('div'); el.className = 'mk-card'; el.dataset.id = n.id; el.tabIndex = -1; els.set(key, el); layer.appendChild(el); }
    if (el._sig !== sig) {
      el._sig = sig;
      const types = typesOf(n);
      el.setAttribute('aria-label', displayTitle(n));
      el.innerHTML = `<div class="mk-thumb mk-k-${th.kind}">${thumbHTML(th, n)}</div>
        <div class="mk-ctitle">${esc(displayTitle(n))}</div>
        <div class="mk-cmeta"><span class="mk-types">${types.map(t => `<i title="${TYPE_LABEL[t]}">${TYPE_ICON[t]}</i>`).join('')}</span><span class="mk-dots">${n.tags.slice(0, 5).map(t => `<b style="background:${tagColor(t)}" title="${esc(t)}"></b>`).join('')}</span>${n.pinned && col.settings.mode === 'web' ? `<i class="mk-pinned" title="Pinned here">${ICON.pin}</i>` : ''}</div>
        ${n.url || n.video ? `<button class="mk-copen" type="button" title="Open ${n.url ? 'link' : 'video'} (logs a visit)" aria-label="Open">${ICON.open}</button>` : ''}`;
    }
    el.style.setProperty('--tx', (p.x - CARD_W / 2) + 'px'); el.style.setProperty('--ty', (p.y - CARD_H / 2) + 'px');
    el.classList.toggle('sel', ui.sel.has(n.id));
    el.classList.toggle('dim', active && dim && !matches(n));
    el.classList.toggle('hit', active && matches(n));
  }
  for (const g of groups) {
    const key = 'g:' + g.id; keep.add(key);
    items.push({ key, x: g.x, y: g.y, ids: g.members.map(m => m.id) });
    let el = els.get(key);
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'mk-group'; els.set(key, el); layer.appendChild(el); }
    el.dataset.group = g.id;
    const sig = JSON.stringify([g.label, g.members.map(m => m.id)]);
    if (el._sig !== sig) {
      el._sig = sig;
      const shown = g.members.slice(0, 3);
      el.title = g.members.map(m => '• ' + displayTitle(m)).slice(0, 12).join('\n') + (g.members.length > 12 ? `\n…and ${g.members.length - 12} more` : '') + '\n\nClick to zoom in';
      el.setAttribute('aria-label', `${g.members.length} similar items: ${g.label}. Zoom in`);
      el.innerHTML = `<span class="mk-stack">${shown.map((m, i) => { const th = thumbFor(m); return `<span class="mk-sthumb mk-k-${th.kind}" style="--i:${i}">${thumbHTML(th, m)}</span>`; }).join('')}</span>
        <span class="mk-gcount">${g.members.length}</span>
        <span class="mk-glabel">${ICON.folder}<span>${esc(g.label)}</span></span>
        <span class="mk-gdots">${g.tags.map(t => `<b style="background:${tagColor(t)}"></b>`).join('')}</span>`;
    }
    el.style.setProperty('--tx', (g.x - CARD_W / 2) + 'px'); el.style.setProperty('--ty', (g.y - CARD_H / 2) + 'px');
    el.classList.toggle('sel', g.members.some(m => ui.sel.has(m.id)));
    el.classList.toggle('dim', active && dim && !g.match);
  }
  for (const [key, el] of els) if (!keep.has(key)) { el.remove(); els.delete(key); }
  lastItems = items;
  drawLinks(items);
  const empty = $('#mkEmpty');
  if (!col.nodes.length) { empty.hidden = false; empty.innerHTML = `<div><b>Nothing here yet.</b><br>Add a link, a video, an image or a note with <b>Add</b>, paste a link anywhere on the page, or double-click the field.</div>`; }
  else if (!items.length) { empty.hidden = false; empty.innerHTML = `<div><b>No nodes match.</b><br><button type="button" class="mk-btn sm" data-clear-filters>Clear search and filters</button></div>`; }
  else empty.hidden = true;
  renderAxis();
}

/* faint lines between strongly similar items (the network behind the layout) */
function drawLinks(items) {
  if (!col.settings.links || col.settings.mode === 'time') { linksSvg.innerHTML = ''; return; }
  const where = new Map(); items.forEach((it, i) => it.ids.forEach(id => where.set(id, i)));
  const best = new Map();
  const { S, N, ids } = simData();
  for (let i = 0; i < N; i++) {
    const a = where.get(ids[i]); if (a === undefined) continue;
    const cand = [];
    for (let j = 0; j < N; j++) { if (j === i) continue; const s = S[i * N + j]; if (s < 0.34) continue; const b = where.get(ids[j]); if (b === undefined || b === a) continue; cand.push([s, b]); }
    cand.sort((p, q) => q[0] - p[0]);
    for (const [s, b] of cand.slice(0, 3)) { const k = a < b ? a + ',' + b : b + ',' + a; if (!best.has(k) || best.get(k) < s) best.set(k, s); }
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of items) { x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x); y1 = Math.max(y1, it.y); }
  if (!items.length) { linksSvg.innerHTML = ''; return; }
  x0 -= 200; y0 -= 200; x1 += 200; y1 += 200;
  linksSvg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  Object.assign(linksSvg.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
  let h = '';
  for (const [k, s] of best) {
    const [a, b] = k.split(',').map(Number), A = items[a], B = items[b];
    const hot = ui.hover && (A.ids.includes(ui.hover) || B.ids.includes(ui.hover));
    const sel = [...ui.sel].some(id => A.ids.includes(id) || B.ids.includes(id));
    h += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="${hot || sel ? 'hot' : ''}" style="stroke-width:${(0.8 + s * 2.2).toFixed(2)}"/>`;
  }
  linksSvg.innerHTML = h;
}

/* timeline axis: sticky date labels + gridlines, in screen coordinates */
function renderAxis() {
  if (!col || col.settings.mode !== 'time' || !timeScale || !col.nodes.length) { axisEl.innerHTML = ''; axisEl.hidden = true; return; }
  axisEl.hidden = false;
  const v = V(), r = stage.getBoundingClientRect(), { t0, t1, pxDay } = timeScale;
  const sx = t => v.x + ((t - t0) / DAY * pxDay) * v.k;
  const perDay = pxDay * v.k;
  const ticks = []; const d = new Date(t0);
  let unit;
  if (perDay >= 70) unit = 'day'; else if (perDay * 7 >= 70) unit = 'week'; else if (perDay * 30 >= 60) unit = 'month'; else if (perDay * 91 >= 60) unit = 'quarter'; else unit = 'year';
  if (unit === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (unit === 'month' || unit === 'quarter' || unit === 'year') d.setDate(1);
  if (unit === 'quarter') d.setMonth(Math.floor(d.getMonth() / 3) * 3);
  if (unit === 'year') d.setMonth(0);
  let guard = 0;
  while (d.getTime() <= t1 + DAY && guard++ < 800) {
    const t = d.getTime(), x = sx(t);
    let label;
    if (unit === 'day') label = fmtDay(t, false);
    else if (unit === 'week') label = 'Week of ' + fmtDay(t, false);
    else if (unit === 'month') label = MONTHS[d.getMonth()] + (d.getMonth() === 0 || !ticks.length ? ' ' + d.getFullYear() : '');
    else if (unit === 'quarter') label = 'Q' + (d.getMonth() / 3 + 1) + ' ' + d.getFullYear();
    else label = String(d.getFullYear());
    if (x > -200 && x < r.width + 50) ticks.push({ x, label });
    if (unit === 'day') d.setDate(d.getDate() + 1); else if (unit === 'week') d.setDate(d.getDate() + 7); else if (unit === 'month') d.setMonth(d.getMonth() + 1); else if (unit === 'quarter') d.setMonth(d.getMonth() + 3); else d.setFullYear(d.getFullYear() + 1);
  }
  let h = ticks.map(t => `<div class="mk-tick" style="left:${t.x.toFixed(1)}px"><span>${esc(t.label)}</span></div>`).join('');
  const today = sx(startOfDay(Date.now()));
  if (today > 0 && today < r.width) h += `<div class="mk-tick mk-today" style="left:${today.toFixed(1)}px"><span>Today</span></div>`;
  if (timeScale.never) { const nx = v.x + timeScale.neverX * v.k; if (nx > -100 && nx < r.width) h += `<div class="mk-never" style="left:${nx.toFixed(1)}px"><span>${col.settings.timeBasis === 'visited' ? 'Never visited' : 'No date'}</span></div>`; }
  axisEl.innerHTML = `<div class="mk-axisbar">${col.settings.timeBasis === 'visited' ? 'By last visit' : 'By date added'}</div>` + h;
}

/* ---------- pointer interaction ---------- */
const pointers = new Map();
let gesture = null; // {type:'pan'|'drag'|'pinch', ...}
stage.addEventListener('pointerdown', e => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  if (e.target.closest('.mk-zoom,.mk-viewopts,.mk-empty button')) return;
  stage.focus({ preventScroll: true });
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return; }
  const card = e.target.closest('.mk-card'), grp = e.target.closest('.mk-group');
  if (e.target.closest('.mk-copen')) return;
  if (card) gesture = { type: 'drag', id: card.dataset.id, x0: e.clientX, y0: e.clientY, moved: false, el: card, shift: e.shiftKey || e.metaKey || e.ctrlKey };
  else if (grp) gesture = { type: 'group', id: grp.dataset.group, x0: e.clientX, y0: e.clientY, moved: false, v0: { ...V() } };
  else gesture = { type: 'pan', x0: e.clientX, y0: e.clientY, v0: { ...V() }, moved: false };
  try { stage.setPointerCapture(e.pointerId); } catch { }
});
stage.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!gesture) { const c = e.target.closest('.mk-card'); const id = c ? c.dataset.id : null; if (id !== ui.hover) { ui.hover = id; hoverRelated(); } return; }
  if (gesture.type === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (gesture.d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / gesture.d);
    const v = V(), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; v.x += cx - gesture.cx; v.y += cy - gesture.cy; applyView();
    gesture.d = d; gesture.cx = cx; gesture.cy = cy; return;
  }
  const dx = e.clientX - gesture.x0, dy = e.clientY - gesture.y0;
  if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
  gesture.moved = true;
  if (gesture.type === 'pan' || gesture.type === 'group' || (gesture.type === 'drag' && col.settings.mode === 'time')) {
    if (!gesture.v0) gesture.v0 = { ...V() };
    const v = V(); v.x = gesture.v0.x + dx; v.y = gesture.v0.y + dy; delete v.unset; applyView(); stage.classList.add('mk-panning');
  } else if (gesture.type === 'drag') {
    const n = byId[gesture.id]; if (!n) return;
    if (!gesture.started) { gesture.started = true; pushUndo(); gesture.ox = n.x; gesture.oy = n.y; gesture.el.classList.add('mk-dragging'); }
    const k = V().k; n.x = Math.round(gesture.ox + dx / k); n.y = Math.round(gesture.oy + dy / k);
    gesture.el.style.setProperty('--tx', (n.x - CARD_W / 2) + 'px'); gesture.el.style.setProperty('--ty', (n.y - CARD_H / 2) + 'px');
  }
});
function endGesture(e) {
  pointers.delete(e.pointerId);
  const g = gesture; if (!g) return;
  if (g.type === 'pinch') { if (pointers.size < 2) gesture = null; saveViewSoon(); return; }
  gesture = null; stage.classList.remove('mk-panning');
  if (e.type === 'pointercancel') return;
  if (g.type === 'drag' && g.started) {
    const n = byId[g.id]; n.pinned = true; g.el.classList.remove('mk-dragging');
    groupCache = null; scheduleSave(); renderField(); renderInspector(); return;
  }
  if (g.moved) { saveViewSoon(); return; }
  if (g.type === 'drag') { if (g.shift) { ui.sel.has(g.id) ? ui.sel.delete(g.id) : ui.sel.add(g.id); } else ui.sel = new Set([g.id]); renderField(); renderInspector(); }
  else if (g.type === 'group') { const grp = (groupCache && groupCache.groups || []).find(x => x.id === g.id); if (grp) fitTo(grp.members.map(posOf), { maxK: 1 }); }
  else if (g.type === 'pan' && ui.sel.size) { ui.sel.clear(); renderField(); renderInspector(); }
}
stage.addEventListener('pointerup', endGesture);
stage.addEventListener('pointercancel', endGesture);
stage.addEventListener('pointerleave', () => { if (!gesture && ui.hover) { ui.hover = null; hoverRelated(); } });
function hoverRelated() {
  for (const [key, el] of els) {
    if (!key.startsWith('n:')) continue;
    const id = key.slice(2);
    el.classList.toggle('rel', !!ui.hover && id !== ui.hover && simOf(ui.hover, id) >= 0.3);
  }
  if (col.settings.links) drawLinks(lastItems);
}
stage.addEventListener('click', e => {
  const o = e.target.closest('.mk-copen'); if (o) { const c = o.closest('.mk-card'); openNode(c.dataset.id); return; }
  if (e.target.closest('[data-clear-filters]')) clearFilters();
});
stage.addEventListener('dblclick', e => {
  if (e.target.closest('.mk-zoom,.mk-viewopts,.mk-copen,.mk-group')) return;
  const c = e.target.closest('.mk-card');
  if (c) { openEditor(c.dataset.id); return; }
  const p = toWorld(e.clientX, e.clientY); openEditor(null, { at: p });
});
stage.addEventListener('wheel', e => {
  e.preventDefault();
  const zoom = e.ctrlKey || e.metaKey || prefs.wheel === 'zoom';
  if (zoom) { const f = Math.exp(-e.deltaY * (e.ctrlKey && Math.abs(e.deltaY) < 50 ? 0.012 : 0.0022)); zoomAt(e.clientX, e.clientY, f); }
  else { const v = V(); v.x -= e.shiftKey ? e.deltaY : e.deltaX; v.y -= e.shiftKey ? 0 : e.deltaY; delete v.unset; applyView(); saveViewSoon(); }
}, { passive: false });
// image thumbnails that fail to load fall back to the type glyph
layer.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.closest('.mk-thumb,.mk-sthumb')?.classList.add('mk-broken'); }, true);
$('#mkInsp').addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.closest('.mk-ithumb,.mk-mini')?.classList.add('mk-broken'); }, true);

/* zoom controls */
$('#mkZoomIn').onclick = () => zoomCenter(1.25);
$('#mkZoomOut').onclick = () => zoomCenter(0.8);
$('#mkFit').onclick = () => fitAll();
$('#mkZoomRange').addEventListener('input', e => { const t = +e.target.value / 100; const k = Math.exp(Math.log(ZMIN) + t * (Math.log(ZMAX) - Math.log(ZMIN))); zoomCenter(k / V().k); });

/* drop links, text or images onto the field */
stage.addEventListener('dragover', e => { if ([...e.dataTransfer.types].some(t => t === 'Files' || t === 'text/uri-list' || t === 'text/plain')) { e.preventDefault(); stage.classList.add('mk-drop'); } });
stage.addEventListener('dragleave', e => { if (e.target === stage) stage.classList.remove('mk-drop'); });
stage.addEventListener('drop', async e => {
  e.preventDefault(); stage.classList.remove('mk-drop');
  const at = toWorld(e.clientX, e.clientY);
  const file = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
  if (file) { openEditor(null, { at, imageFile: file }); return; }
  const text = e.dataTransfer.getData('text/uri-list').split('\n').find(l => l && !l.startsWith('#')) || e.dataTransfer.getData('text/plain');
  if (text) openEditor(null, Object.assign({ at }, prefillFromText(text)));
});
document.addEventListener('paste', e => {
  if (e.target.closest && e.target.closest('input,textarea,[contenteditable="true"],.mk-scrim')) return;
  const file = [...(e.clipboardData.files || [])].find(f => f.type.startsWith('image/'));
  if (file) { e.preventDefault(); openEditor(null, { imageFile: file }); return; }
  const text = e.clipboardData.getData('text/plain'); if (!text || !text.trim()) return;
  e.preventDefault(); openEditor(null, prefillFromText(text));
});
function prefillFromText(text) {
  text = text.trim();
  const u = safeUrl(text.split(/\s+/)[0]);
  if (u && text.split(/\s+/).length === 1) { const v = parseVideo(u); return v && v.kind !== 'page' ? { video: u } : { url: u }; }
  return { notes: esc(text).replace(/\n/g, '<br>') };
}
/* =========================================================
   Tag suggestions from content (words in the title, link, notes,
   file name) and context (same website, similar nodes, tags that
   usually go together, nodes nearby on the field, the active filter,
   what you tagged recently)
   ========================================================= */
const prefs = Object.assign({ wheel: 'pan' }, LS.json('prefs', {}));
const savePrefs = () => { try { LS.set('prefs', JSON.stringify(prefs)); } catch { } };

const STOP = new Set(('a an and are as at be by for from has have how i in into is it its of on or that the this to was were what when where which who why will with you your our we us they them their there here than then these those not no yes can could would should do does did done about after before over under up down out new more most some any all also just only very via www com org net edu gov html htm php asp aspx index http https amp utm source medium campaign ref id page pages watch view article articles post posts blog en us en-us default home main the-').split(' '));
const stem = w => w.length > 4 ? w.replace(/(ies)$/, 'y').replace(/(sses)$/, 'ss').replace(/([^s])s$/, '$1').replace(/(ing|ed)$/, '') : w;
function words(text) {
  return String(text || '').toLowerCase().replace(/https?:\/\/[^\s]+/g, m => ' ' + urlWords(m) + ' ')
    .split(/[^a-z0-9À-ɏ+#]+/).filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
}
function urlWords(u) {
  try { const x = new URL(safeUrl(u)); return [x.hostname.replace(/^www\./, '').split('.').slice(0, -1).join(' '), decodeURIComponent(x.pathname).replace(/[-_/.+]/g, ' ')].join(' '); } catch { return ''; }
}
/* well-known sites -> tags (only suggested; the collection's own tags win) */
const SITE_HINTS = [
  [/(^|\.)youtube\.com$|^youtu\.be$|vimeo\.com$/, ['video']],
  [/github\.com$|gitlab\.com$|stackoverflow\.com$|codepen\.io$|replit\.com$/, ['code']],
  [/wikipedia\.org$|britannica\.com$|hyperphysics/, ['reference']],
  [/arxiv\.org$|doi\.org$|jstor\.org$|nature\.com$|science\.org$|aip\.org$|aapt\.org$|springer\.com$|sciencedirect\.com$/, ['paper']],
  [/phet\.colorado\.edu$|physicsclassroom\.com$|geogebra\.org$|desmos\.com$|ophysics\.com$|pivotinteractives\.com$/, ['simulation']],
  [/khanacademy\.org$|openstax\.org$|ck12\.org$|coursera\.org$|edx\.org$/, ['lesson']],
  [/collegeboard\.org$/, ['ap']],
  [/docs\.google\.com$|drive\.google\.com$|onedrive|sharepoint\.com$|dropbox\.com$/, ['doc']],
  [/amazon\.|ebay\.|etsy\.com$|walmart\.com$/, ['shopping']],
  [/nytimes\.com$|bbc\.|npr\.org$|reuters\.com$|apnews\.com$|theguardian\.com$/, ['news']],
  [/reddit\.com$|twitter\.com$|x\.com$|facebook\.com$|instagram\.com$|bsky\.app$|mastodon/, ['social']],
  [/nasa\.gov$|noaa\.gov$|nist\.gov$/, ['science']],
  [/teacherspayteachers\.com$|edutopia\.org$/, ['teaching']],
];
let recentTags = []; // tags given in this session, newest first

function suggestTags(draft, ctx = {}) {
  const have = new Set(draft.tags || []);
  const score = new Map();
  const add = (t, s, why) => { t = cleanTag(t); if (!t || have.has(t) || s <= 0) return; const o = score.get(t) || { s: 0, why: new Set() }; o.s += s; o.why.add(why); score.set(t, o); };
  const others = col.nodes.filter(n => n.id !== draft.id);
  const tagCount = allTags(); if (draft.id && byId[draft.id]) for (const t of byId[draft.id].tags) { tagCount.set(t, tagCount.get(t) - 1); if (!tagCount.get(t)) tagCount.delete(t); }
  const text = [draft.title, draft.url, draft.video, plain(draft.notes || ''), draft.imageName].join(' ');
  const ws = words(text), wset = new Set(ws.map(stem));
  const host = hostOf(draft.url || draft.video);

  // 1. the text mentions an existing tag
  for (const t of tagCount.keys()) {
    const parts = words(t).map(stem); if (!parts.length) continue;
    if (parts.every(p => wset.has(p))) add(t, 3 + parts.length * .5, 'mentioned');
    else if (parts.length > 1 && parts.some(p => wset.has(p) && p.length > 4)) add(t, 1, 'mentioned');
  }
  // 2. same website as other nodes
  if (host) {
    const same = others.filter(n => hostOf(n.url || n.video) === host);
    const c = new Map(); for (const n of same) for (const t of n.tags) c.set(t, (c.get(t) || 0) + 1);
    for (const [t, k] of c) add(t, 2.2 * k / same.length, 'same site');
    for (const [re, tags] of SITE_HINTS) if (re.test(host)) tags.forEach(t => add(tagCount.has(t) ? t : (findTagLike(t, tagCount) || t), tagCount.has(t) ? 1.6 : 1.1, 'kind of site'));
  }
  if (draft.video) add(findTagLike('video', tagCount) || 'video', .9, 'has a video');
  // 3. nodes with similar words (TF-IDF cosine)
  if (ws.length && others.length) {
    const df = new Map(); const docs = others.map(n => { const s = new Set(words([n.title, n.url, n.video, plain(n.notes)].join(' ')).map(stem)); for (const w of s) df.set(w, (df.get(w) || 0) + 1); return s; });
    const idf = w => Math.log((others.length + 1) / ((df.get(w) || 0) + .5));
    const qn = Math.sqrt([...wset].reduce((s, w) => s + idf(w) ** 2, 0)) || 1;
    const sims = docs.map((d, i) => { let dot = 0; for (const w of wset) if (d.has(w)) dot += idf(w) ** 2; const dn = Math.sqrt([...d].reduce((s, w) => s + idf(w) ** 2, 0)) || 1; return [dot / (qn * dn), others[i]]; })
      .filter(([s]) => s > 0.08).sort((a, b) => b[0] - a[0]).slice(0, 6);
    for (const [s, n] of sims) for (const t of n.tags) add(t, 2.4 * s, 'similar to “' + displayTitle(n).slice(0, 30) + '”');
  }
  // 4. tags that usually come with the ones already chosen
  for (const a of have) {
    const withA = others.filter(n => n.tags.includes(a)); if (withA.length < 2) continue;
    const c = new Map(); for (const n of withA) for (const t of n.tags) if (t !== a) c.set(t, (c.get(t) || 0) + 1);
    for (const [t, k] of c) if (k / withA.length >= .34) add(t, 1.6 * k / withA.length, 'often with ' + a);
  }
  // 5. context: where it was added, the active filter, recent tagging
  if (ctx.at && col.settings.mode === 'web') {
    const near = others.filter(n => n.x !== null).map(n => [Math.hypot(n.x - ctx.at.x, n.y - ctx.at.y), n]).filter(([d]) => d < UNIT * 1.6).sort((a, b) => a[0] - b[0]).slice(0, 5);
    for (const [d, n] of near) for (const t of n.tags) add(t, 1.4 * (1 - d / (UNIT * 1.6)), 'nearby on the field');
  }
  for (const t of F.tagsIn) add(t, 1.8, 'current filter');
  recentTags.slice(0, 6).forEach((t, i) => add(t, .5 - i * .06, 'used recently'));
  // 6. new words worth tagging (title words that are not tags yet)
  const tw = words(draft.title || '').filter(w => w.length > 3 && !tagCount.has(w));
  const nw = words(plain(draft.notes || '')).filter(w => w.length > 4 && !tagCount.has(w));
  const freq = new Map(); for (const w of [...tw, ...tw, ...nw]) freq.set(w, (freq.get(w) || 0) + 1);
  [...freq].sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([w, k], i) => add(w, .55 + .15 * k - i * .05, 'keyword'));

  return [...score].filter(([, o]) => o.s >= 0.45).sort((a, b) => b[1].s - a[1].s).slice(0, ctx.max || 8).map(([t, o]) => ({ tag: t, score: o.s, why: [...o.why].slice(0, 2).join('; '), known: tagCount.has(t) }));
}
function findTagLike(t, tagCount) { const s = stem(t); for (const k of tagCount.keys()) if (stem(k) === s) return k; return null; }
function noteRecent(tags) { for (const t of tags) { recentTags = [t, ...recentTags.filter(x => x !== t)].slice(0, 12); } }

/* =========================================================
   Small UI kit: toast, menus, modals
   ========================================================= */
let toastTimer;
function toast(msg, action) {
  $('.mk-toast')?.remove(); clearTimeout(toastTimer);
  const t = document.createElement('div'); t.className = 'mk-toast'; t.setAttribute('role', 'status');
  t.innerHTML = esc(msg) + (action ? ` <button type="button" class="mk-btn sm">${esc(action.label)}</button>` : '');
  if (action) t.querySelector('button').onclick = () => { t.remove(); action.fn(); };
  document.body.appendChild(t); toastTimer = setTimeout(() => t.remove(), action ? 6000 : 2600);
}
function closeMenus() { $$('.mk-menu').forEach(m => m.remove()); }
function popMenu(anchor, html, onPick) {
  closeMenus(); const m = document.createElement('div'); m.className = 'mk-menu'; m.setAttribute('role', 'menu'); m.innerHTML = html; document.body.appendChild(m);
  const a = anchor.getBoundingClientRect(), r = m.getBoundingClientRect();
  m.style.left = clamp(a.right - r.width, 8, innerWidth - r.width - 8) + 'px'; m.style.top = clamp(a.bottom + 4, 8, innerHeight - r.height - 8) + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; closeMenus(); onPick(b.dataset.v, b); });
  setTimeout(() => { const off = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } }; document.addEventListener('pointerdown', off, true); }, 0);
  m.querySelector('button')?.focus();
  m.addEventListener('keydown', e => { const bs = $$('button', m); const i = bs.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); } if (e.key === 'Escape') { m.remove(); anchor.focus(); } });
}
function modal(title, bodyHTML, { footer = '', size = '', onClose } = {}) {
  const s = document.createElement('div'); s.className = 'mk-scrim';
  s.innerHTML = `<div class="mk-modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button type="button" class="mk-icon" data-close aria-label="Close">${ICON.x}</button></header><div class="mk-mbody">${bodyHTML}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
  const prevFocus = document.activeElement;
  const close = () => { if (!s.isConnected) return; s.remove(); onClose && onClose(); prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); };
  s._close = close;
  s.addEventListener('pointerdown', e => { if (e.target === s) s._down = true; });
  s.addEventListener('click', e => { if (e.target === s && s._down) close(); s._down = false; });
  s.querySelector('[data-close]').onclick = close;
  document.body.appendChild(s); return { el: s, close, body: s.querySelector('.mk-mbody') };
}
function askConfirm(title, msg, okLabel = 'OK', danger) {
  return new Promise(res => {
    let done = false;
    const m = modal(title, `<p class="mk-p">${esc(msg)}</p>`, { size: 'sm', footer: `<button type="button" class="mk-btn" data-no>Cancel</button><button type="button" class="mk-btn ${danger ? 'mk-danger-fill' : 'mk-primary'}" data-yes>${esc(okLabel)}</button>`, onClose: () => { if (!done) res(false); } });
    m.el.querySelector('[data-no]').onclick = () => m.close();
    const y = m.el.querySelector('[data-yes]'); y.onclick = () => { done = true; m.close(); res(true); }; y.focus();
  });
}
function askText(title, label, value = '') {
  return new Promise(res => {
    let done = false;
    const m = modal(title, `<label class="mk-lbl" for="mkAsk">${esc(label)}</label><input class="mk-field" id="mkAsk" value="${esc(value)}">`, { size: 'sm', footer: `<button type="button" class="mk-btn" data-no>Cancel</button><button type="button" class="mk-btn mk-primary" data-yes>OK</button>`, onClose: () => { if (!done) res(null); } });
    const inp = m.el.querySelector('#mkAsk'); setTimeout(() => { inp.focus(); inp.select(); }, 10);
    const ok = () => { done = true; const v = inp.value; m.close(); res(v); };
    m.el.querySelector('[data-yes]').onclick = ok; m.el.querySelector('[data-no]').onclick = () => m.close();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}
const readAsDataURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
async function shrinkImage(file, max = 1600, q = .86) {
  const url = await readAsDataURL(file);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return url;
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height)); if (s === 1 && file.size < 700000) return url;
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', q);
  } catch { return url; }
}

/* open a node's link or video in a new tab and log the visit */
function logVisit(id) {
  const n = byId[id]; if (!n) return;
  n.visits.push(new Date().toISOString());
  if (col.settings.timeBasis === 'visited') tposDirty = true;
  matchMemo.delete(id); scheduleSave(); renderField(); renderInspector();
}
function openNode(id, which) {
  const n = byId[id]; if (!n) return;
  const u = which === 'video' ? n.video : (n.url || n.video);
  if (!u) { selectOnly(id); return; }
  window.open(u, '_blank', 'noopener,noreferrer');
  logVisit(id);
}
function selectOnly(id) { ui.sel = new Set(id ? [id] : []); renderField(); renderInspector(); }
/* =========================================================
   Inspector (right panel): one node, several nodes, or the overview
   ========================================================= */
const insp = $('#mkInsp');
let playing = null; // node id whose video is playing in the inspector
function miniRow(n, extra = '') {
  const th = thumbFor(n);
  return `<button type="button" class="mk-row" data-goto="${esc(n.id)}"><span class="mk-mini mk-k-${th.kind}">${thumbHTML(th, n)}</span><span class="mk-rowt"><b>${esc(displayTitle(n))}</b><small>${extra}</small></span></button>`;
}
function tagChip(t, { x = false, count, cls = '' } = {}) {
  return `<span class="mk-tag ${cls}" style="--c:${tagColor(t)}"><button type="button" data-filter-tag="${esc(t)}" title="Show only “${esc(t)}”">${esc(t)}${count !== undefined ? ` <small>${count}</small>` : ''}</button>${x ? `<button type="button" class="mk-tx" data-untag="${esc(t)}" aria-label="Remove tag ${esc(t)}">×</button>` : ''}</span>`;
}
function renderInspector() {
  if (!col) return;
  const ids = [...ui.sel].filter(id => byId[id]);
  insp.classList.toggle('mk-none', !ids.length);
  if (ids.length === 1) renderNodeInsp(byId[ids[0]]);
  else if (ids.length > 1) renderMultiInsp(ids.map(id => byId[id]));
  else renderOverview();
}
function renderNodeInsp(n) {
  const v = parseVideo(n.video);
  const img = imageSrc(n);
  const th = thumbFor(n);
  let media = '';
  if (v && playing === n.id && (v.kind === 'youtube' || v.kind === 'vimeo')) media = `<div class="mk-embed"><iframe src="${esc(v.embed)}" title="Video player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  else if (v && v.kind === 'file') media = `<div class="mk-embed"><video src="${esc(v.url)}" controls preload="metadata" data-video-node="${esc(n.id)}"></video></div>`;
  else if (v && (v.kind === 'youtube' || v.kind === 'vimeo')) media = `<button type="button" class="mk-ithumb mk-k-cover mk-play" data-play="${esc(n.id)}" aria-label="Play video here">${(videoThumb(n) ? `<img src="${esc(videoThumb(n))}" alt="">` : '')}<span class="mk-glyph">${ICON.video}</span><span class="mk-playbtn">▶</span></button>`;
  else if (th.kind !== 'glyph') media = `<div class="mk-ithumb mk-k-${th.kind}">${thumbHTML(th, n)}</div>`;
  const lv = lastVisit(n);
  const sims = col.nodes.filter(m => m.id !== n.id).map(m => [simOf(n.id, m.id), m]).filter(([s]) => s >= .2).sort((a, b) => b[0] - a[0]).slice(0, 5);
  const sugg = suggestTags(n, { max: 5 });
  insp.innerHTML = `
  <div class="mk-isec mk-ihead">
    ${media}
    <h2 class="mk-ititle">${esc(displayTitle(n))}</h2>
    ${n.url ? `<a class="mk-ilink" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" data-visit="${esc(n.id)}">${ICON.link}<span>${esc(n.url.replace(/^https?:\/\/(www\.)?/, ''))}</span></a>` : ''}
    ${n.video && !(n.url && n.url === n.video) ? `<a class="mk-ilink" href="${esc(n.video)}" target="_blank" rel="noopener noreferrer" data-visit="${esc(n.id)}">${ICON.video}<span>${esc(n.video.replace(/^https?:\/\/(www\.)?/, ''))}</span></a>` : ''}
    <div class="mk-iactions">
      ${n.url || n.video ? `<button type="button" class="mk-btn mk-primary" data-open="${esc(n.id)}">${ICON.open}Open</button>` : ''}
      <button type="button" class="mk-btn" data-edit="${esc(n.id)}">${ICON.edit}Edit</button>
      ${col.settings.mode === 'web' ? `<button type="button" class="mk-btn" data-pin="${esc(n.id)}" title="${n.pinned ? 'Let the layout move this node again' : 'Keep this node where it is'}">${ICON.pin}${n.pinned ? 'Unpin' : 'Pin'}</button>` : ''}
      <button type="button" class="mk-btn mk-danger" data-del="${esc(n.id)}" aria-label="Delete">${ICON.trash}</button>
    </div>
  </div>
  ${img && th.src !== img ? `<div class="mk-isec"><h3>Image</h3><button type="button" class="mk-iimg" data-viewimg="${esc(n.id)}"><img src="${esc(img)}" alt="${esc(n.image.name || 'Image')}"></button></div>` : ''}
  ${n.notes && plain(n.notes) ? `<div class="mk-isec"><h3>Notes</h3><div class="mk-rt">${sanitize(n.notes)}</div></div>` : ''}
  <div class="mk-isec"><h3>Tags</h3>
    <div class="mk-tags">${n.tags.map(t => tagChip(t, { x: true })).join('') || '<span class="mk-muted">No tags yet</span>'}</div>
    <div class="mk-tagadd"><input class="mk-field sm" id="mkQuickTag" placeholder="Add a tag…" list="mkTagList" aria-label="Add a tag"><datalist id="mkTagList">${[...allTags().keys()].sort().map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
    ${sugg.length ? `<div class="mk-sugg"><span class="mk-muted">${ICON.sparkle}Suggested</span>${sugg.map(s => `<button type="button" class="mk-schip ${s.known ? '' : 'new'}" data-addtag="${esc(s.tag)}" title="${esc(s.why)}">+ ${esc(s.tag)}</button>`).join('')}</div>` : ''}
  </div>
  <div class="mk-isec"><h3>Dates</h3>
    <dl class="mk-dl"><dt>Added</dt><dd>${esc(fmtWhen(n.added))} <small>(${esc(ago(n.added))})</small></dd>
    <dt>Visits</dt><dd>${n.visits.length ? `${n.visits.length} · last ${esc(ago(lv))}` : 'Not opened yet'}</dd></dl>
    ${n.visits.length ? `<details class="mk-visits"><summary>All visits</summary><ul>${n.visits.slice().reverse().map(vv => `<li>${esc(fmtWhen(vv))}<button type="button" class="mk-tx" data-unvisit="${esc(vv)}" aria-label="Remove this visit">×</button></li>`).join('')}</ul></details>` : ''}
  </div>
  ${sims.length ? `<div class="mk-isec"><h3>Most alike</h3>${sims.map(([s, m]) => miniRow(m, Math.round(s * 100) + '% alike · ' + m.tags.filter(t => n.tags.includes(t)).slice(0, 3).map(esc).join(', '))).join('')}</div>` : ''}`;
  const q = $('#mkQuickTag');
  q.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const t = cleanTag(q.value); if (t) addTags([n.id], [t]); } });
  q.addEventListener('change', () => { const t = cleanTag(q.value); if (t && allTags().has(t)) addTags([n.id], [t]); });
  const vid = insp.querySelector('video[data-video-node]'); if (vid) vid.addEventListener('play', () => { if (!vid._logged) { vid._logged = true; logVisit(n.id); } }, { once: true });
}
function renderMultiInsp(list) {
  const c = new Map(); for (const n of list) for (const t of n.tags) c.set(t, (c.get(t) || 0) + 1);
  insp.innerHTML = `<div class="mk-isec"><h2 class="mk-ititle">${list.length} selected</h2>
    <div class="mk-iactions">${col.settings.mode === 'web' ? `<button type="button" class="mk-btn" data-pinall="1">${ICON.pin}Pin all</button><button type="button" class="mk-btn" data-pinall="0">Unpin all</button>` : ''}<button type="button" class="mk-btn mk-danger" data-delsel>${ICON.trash}Delete</button></div></div>
  <div class="mk-isec"><h3>Tags on these</h3><div class="mk-tags">${[...c].sort((a, b) => b[1] - a[1]).map(([t, k]) => tagChip(t, { x: true, count: k + '/' + list.length })).join('') || '<span class="mk-muted">None</span>'}</div>
    <div class="mk-tagadd"><input class="mk-field sm" id="mkQuickTag" placeholder="Tag all of them…" list="mkTagList" aria-label="Add a tag to all selected"><datalist id="mkTagList">${[...allTags().keys()].sort().map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
    <p class="mk-muted">Shift-click nodes to add or remove them from the selection.</p></div>
  <div class="mk-isec"><h3>Selected</h3>${list.map(n => miniRow(n, n.tags.slice(0, 3).map(esc).join(', '))).join('')}</div>`;
  const q = $('#mkQuickTag');
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const t = cleanTag(q.value); if (t) addTags(list.map(n => n.id), [t]); } });
}
function renderOverview() {
  const tags = [...allTags()].sort((a, b) => b[1] - a[1]);
  const added = col.nodes.slice().sort((a, b) => ts(b.added) - ts(a.added)).slice(0, 6);
  const visited = col.nodes.filter(n => n.visits.length).sort((a, b) => lastVisit(b) - lastVisit(a)).slice(0, 6);
  const stale = col.nodes.filter(n => (n.url || n.video) && (!n.visits.length ? ts(n.added) < Date.now() - 30 * DAY : lastVisit(n) < Date.now() - 60 * DAY)).sort((a, b) => (lastVisit(a) || ts(a.added)) - (lastVisit(b) || ts(b.added))).slice(0, 4);
  const cnt = { link: 0, video: 0, image: 0, note: 0 }; for (const n of col.nodes) for (const t of typesOf(n)) cnt[t]++;
  const shown = filtersActive() ? col.nodes.filter(matches).length : col.nodes.length;
  insp.innerHTML = `<div class="mk-isec"><h2 class="mk-ititle">${esc(col.name)}</h2>
    <p class="mk-muted">${col.nodes.length} node${col.nodes.length === 1 ? '' : 's'}${filtersActive() ? ` · <b>${shown} match</b>` : ''} · ${Object.entries(cnt).filter(([, k]) => k).map(([t, k]) => `${k} ${TYPE_LABEL[t].toLowerCase()}${k === 1 ? '' : 's'}`).join(', ') || 'empty'}</p></div>
  ${tags.length ? `<div class="mk-isec"><h3>Tags</h3><div class="mk-tags">${tags.slice(0, 40).map(([t, k]) => tagChip(t, { count: k, cls: F.tagsIn.has(t) ? 'on' : '' })).join('')}</div></div>` : ''}
  ${added.length ? `<div class="mk-isec"><h3>${ICON.clock}Recently added</h3>${added.map(n => miniRow(n, esc(fmtDay(n.added)) + ' · ' + esc(ago(n.added)))).join('')}</div>` : ''}
  ${visited.length ? `<div class="mk-isec"><h3>${ICON.open}Recently visited</h3>${visited.map(n => miniRow(n, esc(ago(lastVisit(n))) + ' · ' + n.visits.length + ' visit' + (n.visits.length === 1 ? '' : 's'))).join('')}</div>` : ''}
  ${stale.length ? `<div class="mk-isec"><h3>Haven’t opened in a while</h3>${stale.map(n => miniRow(n, n.visits.length ? 'last ' + esc(ago(lastVisit(n))) : 'never opened · added ' + esc(ago(n.added)))).join('')}</div>` : ''}
  <div class="mk-isec mk-tips"><h3>Tips</h3><ul>
    <li>Nodes with shared tags sit close together; rarer shared tags pull harder.</li>
    <li>Zoom out and very similar neighbours stack into one pile. Click a pile to zoom into it.</li>
    <li><b>Timeline</b> lines nodes up by date added or by last visit.</li>
    <li>Opening a link from here logs a visit. Drag a node to pin it in place.</li></ul></div>`;
}
insp.addEventListener('click', e => {
  const b = e.target.closest('button,a'); if (!b) return;
  const d = b.dataset;
  if (d.visit) { logVisit(d.visit); return; }
  if (d.goto) { ui.sel = new Set([d.goto]); renderField(); renderInspector(); centerOn(d.goto); }
  else if (d.open) openNode(d.open);
  else if (d.edit) openEditor(d.edit);
  else if (d.pin) { const id = d.pin; act(() => { byId[id].pinned = !byId[id].pinned; }); if (!byId[id].pinned) relayoutSoon(); }
  else if (d.pinall !== undefined) { act(() => { for (const id of ui.sel) byId[id].pinned = d.pinall === '1'; }); if (d.pinall === '0') relayoutSoon(); }
  else if (d.del) deleteNodes([d.del]);
  else if (d.delsel !== undefined) deleteNodes([...ui.sel]);
  else if (d.untag) removeTag([...ui.sel], d.untag);
  else if (d.addtag) addTags([...ui.sel], [d.addtag]);
  else if (d.filterTag) { F.tagsIn = new Set([d.filterTag]); F.tagsOut.delete(d.filterTag); if (!ui.filtersOpen) toggleFilters(true); filtersChanged(); }
  else if (d.unvisit) { const n = byId[[...ui.sel][0]]; act(() => { const i = n.visits.indexOf(d.unvisit); if (i >= 0) n.visits.splice(i, 1); }); if (col.settings.timeBasis === 'visited') { tposDirty = true; renderField(true); } }
  else if (d.play) { playing = d.play; logVisit(d.play); }
  else if (d.viewimg) viewImage(byId[d.viewimg]);
});
function addTags(ids, tags) {
  tags = cleanTags(tags); if (!tags.length || !ids.length) return;
  act(() => { for (const id of ids) { const n = byId[id]; for (const t of tags) if (!n.tags.includes(t)) n.tags.push(t); } }, { relayout: true });
  noteRecent(tags); matchMemo = new Map();
  setTimeout(() => $('#mkQuickTag')?.focus(), 0);
}
function removeTag(ids, tag) {
  act(() => { for (const id of ids) { const n = byId[id]; n.tags = n.tags.filter(t => t !== tag); } }, { relayout: true });
  matchMemo = new Map();
}
function deleteNodes(ids) {
  ids = ids.filter(id => byId[id]); if (!ids.length) return;
  const names = ids.length === 1 ? '“' + displayTitle(byId[ids[0]]).slice(0, 40) + '”' : ids.length + ' nodes';
  act(() => { col.nodes = col.nodes.filter(n => !ids.includes(n.id)); ui.sel.clear(); }, { relayout: false });
  invalidateSim(); tposDirty = true; matchMemo = new Map(); renderField(); renderFilters();
  toast('Deleted ' + names, { label: 'Undo', fn: undo });
}
function viewImage(n) {
  const src = imageSrc(n); if (!src) return;
  const m = modal(n.image.name || displayTitle(n), `<img class="mk-full" src="${esc(src)}" alt="">`, { size: 'lg' });
}
/* =========================================================
   Node editor (add / edit)
   ========================================================= */
const toLocalInput = iso => { const d = new Date(ts(iso) || Date.now()); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function humanSlug(u) {
  try {
    const x = new URL(u); const segs = decodeURIComponent(x.pathname).split('/').filter(Boolean);
    let s = segs.length ? segs[segs.length - 1] : '';
    s = s.replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_+]+/g, ' ').trim();
    if (!s || /^\d+$/.test(s) || s.length < 3) return x.hostname.replace(/^www\./, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch { return ''; }
}
const oembedCache = {};
async function oembed(u) {
  if (oembedCache[u]) return oembedCache[u];
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(u), { signal: ctl.signal, referrerPolicy: 'no-referrer' });
    clearTimeout(t); const j = await r.json(); if (j.error) return null; oembedCache[u] = j; return j;
  } catch { return null; }
}

function openEditor(id, opts = {}) {
  const existing = id ? byId[id] : null;
  const d = JSON.parse(JSON.stringify(existing || newNode({ url: opts.url || '', video: opts.video || '', notes: opts.notes || '' })));
  const draftAssets = {};
  const at = opts.at || (existing ? null : null);
  const src = a => draftAssets[a] ? draftAssets[a].data : assetSrc(a);
  const imgOf = () => !d.image ? '' : d.image.asset ? src(d.image.asset) : d.image.url;
  let titleTouched = !!d.title;
  const m = modal(existing ? 'Edit node' : 'Add a node', `
  <div class="mk-form">
    <div class="mk-frow"><label class="mk-lbl" for="edUrl">${ICON.link}Link</label><input class="mk-field" id="edUrl" placeholder="https://…" value="${esc(d.url)}" inputmode="url" autocomplete="off"></div>
    <div class="mk-frow"><label class="mk-lbl" for="edTitle">Title</label><input class="mk-field" id="edTitle" placeholder="Taken from the link if left blank" value="${esc(d.title)}" maxlength="300"></div>
    <div class="mk-frow"><label class="mk-lbl" for="edVideo">${ICON.video}Video link</label><input class="mk-field" id="edVideo" placeholder="YouTube, Vimeo or a video file address" value="${esc(d.video)}" inputmode="url" autocomplete="off"><small class="mk-muted" id="edVideoNote"></small></div>
    <div class="mk-frow"><span class="mk-lbl">${ICON.image}Image</span>
      <div class="mk-imgbox" id="edImgBox" tabindex="0" aria-label="Image: paste, drop or choose a file"></div></div>
    <div class="mk-frow"><span class="mk-lbl" id="edNotesLbl">${ICON.note}Notes</span>
      <div class="mk-rtools" id="edTools" role="toolbar" aria-label="Formatting">
        <button type="button" data-rt="bold" title="Bold (Ctrl+B)">${ICON.bold}</button><button type="button" data-rt="italic" title="Italic (Ctrl+I)">${ICON.italic}</button><button type="button" data-rt="underline" title="Underline (Ctrl+U)">${ICON.under}</button>
        <button type="button" data-rt="h3" title="Heading">${ICON.h}</button><button type="button" data-rt="insertUnorderedList" title="Bulleted list">${ICON.ul}</button><button type="button" data-rt="insertOrderedList" title="Numbered list">${ICON.ol}</button>
        <button type="button" data-rt="quote" title="Quote">${ICON.quote}</button><button type="button" data-rt="code" title="Code">${ICON.code}</button><button type="button" data-rt="link" title="Link">${ICON.link}</button><button type="button" data-rt="clear" title="Clear formatting">${ICON.clear}</button>
      </div>
      <div class="mk-redit mk-rt" id="edNotes" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="edNotesLbl" data-ph="Write notes…">${sanitize(d.notes)}</div></div>
    <div class="mk-frow"><span class="mk-lbl">${ICON.tag}Tags</span>
      <div class="mk-tagbox" id="edTagBox"><input id="edTagIn" class="mk-tagin" placeholder="Type a tag, press Enter" list="edTagList" aria-label="Add a tag" autocomplete="off"></div>
      <datalist id="edTagList">${[...allTags().keys()].sort().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <div class="mk-sugg" id="edSugg" aria-live="polite"></div></div>
    <div class="mk-frow"><span class="mk-lbl">Thumbnail</span><div class="mk-thumbpick" id="edThumbs" role="radiogroup" aria-label="Thumbnail"></div></div>
    <div class="mk-frow mk-frow2"><label class="mk-lbl" for="edAdded">${ICON.clock}Added</label><input class="mk-field" type="datetime-local" id="edAdded" value="${toLocalInput(d.added)}">
      ${existing ? `<span class="mk-muted">${d.visits.length ? `${d.visits.length} visit${d.visits.length === 1 ? '' : 's'}, last ${esc(ago(lastVisit(d)))}` : 'No visits yet'}</span>` : ''}</div>
  </div>
  <input type="file" id="edImgFile" accept="image/*" hidden><input type="file" id="edThumbFile" accept="image/*" hidden>`, {
    size: 'lg mk-editor',
    footer: `${existing ? `<button type="button" class="mk-btn mk-danger" data-act="del">${ICON.trash}Delete</button>` : ''}<span style="flex:1"></span><button type="button" class="mk-btn" data-act="cancel">Cancel</button><button type="button" class="mk-btn mk-primary" data-act="save">${existing ? 'Save' : 'Add node'}</button>`,
  });
  const E = s => m.el.querySelector(s);
  ui.editing = m;
  m.el.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.parentElement.classList.add('mk-broken'); }, true);

  /* --- tags --- */
  const tagBox = E('#edTagBox'), tagIn = E('#edTagIn');
  function drawTags() {
    $$('.mk-tag', tagBox).forEach(x => x.remove());
    for (const t of d.tags) { const s = document.createElement('span'); s.className = 'mk-tag'; s.style.setProperty('--c', tagColor(t)); s.innerHTML = `<span>${esc(t)}</span><button type="button" class="mk-tx" aria-label="Remove ${esc(t)}">×</button>`; s.querySelector('button').onclick = () => { d.tags = d.tags.filter(x => x !== t); drawTags(); refreshSugg(); }; tagBox.insertBefore(s, tagIn); }
  }
  function addTag(t) { t = cleanTag(t); if (t && !d.tags.includes(t)) d.tags.push(t); tagIn.value = ''; drawTags(); refreshSugg(); }
  tagIn.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && tagIn.value.trim()) { e.preventDefault(); addTag(tagIn.value); }
    else if (e.key === 'Enter') { e.preventDefault(); }
    else if (e.key === 'Backspace' && !tagIn.value && d.tags.length) { d.tags.pop(); drawTags(); refreshSugg(); }
  });
  tagIn.addEventListener('input', e => {
    if (tagIn.value.includes(',')) { const parts = tagIn.value.split(','); const last = parts.pop(); parts.forEach(addTag); tagIn.value = last; }
    else if ((e.inputType === undefined || e.inputType === 'insertReplacementText') && allTags().has(cleanTag(tagIn.value))) addTag(tagIn.value); // picked from the list
  });
  tagBox.addEventListener('click', e => { if (e.target === tagBox) tagIn.focus(); });
  let suggTimer;
  function refreshSugg() {
    clearTimeout(suggTimer);
    suggTimer = setTimeout(() => {
      readFields();
      const s = suggestTags(Object.assign({}, d, { imageName: d.image && d.image.name }), { at, max: 9 });
      E('#edSugg').innerHTML = s.length ? `<span class="mk-muted">${ICON.sparkle}Suggested</span>` + s.map(x => `<button type="button" class="mk-schip ${x.known ? '' : 'new'}" data-t="${esc(x.tag)}" title="${esc(x.why)}${x.known ? '' : ' (new tag)'}">+ ${esc(x.tag)}</button>`).join('') : '<span class="mk-muted">Suggestions appear as you add a link, title or notes.</span>';
    }, 200);
  }
  E('#edSugg').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) addTag(b.dataset.t); });

  /* --- fields --- */
  function readFields() {
    d.url = safeUrl(E('#edUrl').value); d.video = safeUrl(E('#edVideo').value);
    d.title = E('#edTitle').value.trim(); d.notes = sanitize(E('#edNotes').innerHTML).replace(/^(<br>|<div><br><\/div>)$/, '');
  }
  E('#edTitle').addEventListener('input', () => { titleTouched = !!E('#edTitle').value.trim(); refreshSugg(); });
  async function lookup(u, which) {
    if (!u) return;
    if (!titleTouched && !E('#edTitle').value.trim()) E('#edTitle').placeholder = humanSlug(u) || 'Title';
    const v = which === 'video' ? parseVideo(u) : null;
    if (which === 'url' && !E('#edVideo').value.trim()) { const pv = parseVideo(u); if (pv && (pv.kind === 'youtube' || pv.kind === 'vimeo' || pv.kind === 'file')) { E('#edVideo').value = u; return lookup(u, 'video'); } }
    const j = await oembed(u);
    if (!m.el.isConnected) return;
    if (j && j.title && !titleTouched && !E('#edTitle').value.trim()) { E('#edTitle').value = j.title; refreshSugg(); }
    if (v && v.kind === 'vimeo' && j && j.thumbnail_url) { d.videoThumb = j.thumbnail_url; drawThumbs(); }
    if (j && j.author_name && which === 'video') E('#edVideoNote').textContent = (j.provider_name ? j.provider_name + ' · ' : '') + j.author_name;
  }
  E('#edUrl').addEventListener('change', () => { readFields(); lookup(d.url, 'url'); drawThumbs(); refreshSugg(); });
  E('#edUrl').addEventListener('paste', () => setTimeout(() => E('#edUrl').dispatchEvent(new Event('change')), 0));
  E('#edVideo').addEventListener('change', () => {
    readFields(); const v = parseVideo(d.video); d.videoThumb = v && v.thumb ? '' : d.videoThumb;
    E('#edVideoNote').textContent = !d.video ? '' : !v || v.kind === 'page' ? 'This will open as a link; only YouTube, Vimeo and video files play here.' : v.kind === 'file' ? 'Video file — plays in the details panel.' : (v.kind === 'youtube' ? 'YouTube' : 'Vimeo') + ' — plays in the details panel.';
    lookup(d.video, 'video'); drawThumbs(); refreshSugg();
  });
  E('#edVideo').addEventListener('paste', () => setTimeout(() => E('#edVideo').dispatchEvent(new Event('change')), 0));

  /* --- image --- */
  const imgBox = E('#edImgBox');
  function drawImg() {
    const s = imgOf();
    imgBox.innerHTML = s ? `<img src="${esc(s)}" alt=""><div class="mk-imgacts"><span class="mk-muted">${esc((d.image && d.image.name) || (d.image && d.image.url && !isImgData(d.image.url) ? d.image.url : 'Image'))}</span><button type="button" class="mk-btn sm" data-img="file">Replace</button><button type="button" class="mk-btn sm mk-danger" data-img="clear">Remove</button></div>`
      : `<div class="mk-imgempty">${ICON.upload}<span>Drop or paste an image, <button type="button" class="mk-linkbtn" data-img="file">choose a file</button>, or</span><input class="mk-field sm" id="edImgUrl" placeholder="paste an image address (https://…)" aria-label="Image address"></div>`;
    const u = E('#edImgUrl'); if (u) u.addEventListener('change', () => { const x = safeUrl(u.value); if (x) { d.image = { url: x, name: x.split('/').pop().slice(0, 80) }; drawImg(); drawThumbs(); refreshSugg(); } });
  }
  async function takeImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const data = await shrinkImage(file);
    const a = { id: uid('a'), name: file.name || 'pasted image', mime: file.type, data }; draftAssets[a.id] = a;
    d.image = { asset: a.id, name: a.name }; drawImg(); drawThumbs(); refreshSugg();
  }
  imgBox.addEventListener('click', e => { const b = e.target.closest('[data-img]'); if (!b) return; if (b.dataset.img === 'file') E('#edImgFile').click(); else { d.image = null; if (d.thumb.mode === 'image') d.thumb.mode = 'auto'; drawImg(); drawThumbs(); } });
  E('#edImgFile').addEventListener('change', e => { takeImage(e.target.files[0]); e.target.value = ''; });
  imgBox.addEventListener('dragover', e => { e.preventDefault(); imgBox.classList.add('over'); });
  imgBox.addEventListener('dragleave', () => imgBox.classList.remove('over'));
  imgBox.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); imgBox.classList.remove('over'); const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/')); if (f) takeImage(f); });
  m.el.addEventListener('paste', e => {
    if (e.target.closest('#edNotes')) return; // the notes editor handles its own paste
    const f = [...(e.clipboardData.files || [])].find(x => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); takeImage(f); }
  });

  /* --- thumbnail picker --- */
  function drawThumbs() {
    readFields();
    const host = hostOf(d.url || d.video);
    const vt = (parseVideo(d.video) || {}).thumb || d.videoThumb;
    const opts = [
      ['auto', 'Automatic', null],
      ['image', 'Image', imgOf()],
      ['video', 'Video frame', vt],
      ['site', 'Site icon', host ? siteIcon(host) : ''],
      ['custom', 'Custom…', d.thumb.asset ? src(d.thumb.asset) : ''],
      ['none', 'Type icon', null],
    ];
    const autoSrc = (d.thumb.asset && src(d.thumb.asset)) || imgOf() || vt || (host ? siteIcon(host) : '');
    E('#edThumbs').innerHTML = opts.map(([k, label, s]) => {
      const disabled = (k === 'image' || k === 'video' || k === 'site') && !s;
      const show = k === 'auto' ? autoSrc : s;
      const isIcon = (k === 'site') || (k === 'auto' && show && show === siteIcon(host));
      return `<button type="button" role="radio" aria-checked="${d.thumb.mode === k}" class="mk-tp ${d.thumb.mode === k ? 'on' : ''}" data-tm="${k}" ${disabled ? 'disabled' : ''}>
        <span class="mk-tpimg ${isIcon ? 'mk-icon-img' : ''}">${show && k !== 'none' ? `<img src="${esc(show)}" alt="" referrerpolicy="no-referrer">` : ''}<span class="mk-glyph">${k === 'custom' ? ICON.upload : TYPE_ICON[glyphThumb(d).glyph]}</span></span><span>${label}</span></button>`;
    }).join('');
  }
  E('#edThumbs').addEventListener('click', e => {
    const b = e.target.closest('[data-tm]'); if (!b || b.disabled) return;
    if (b.dataset.tm === 'custom' && (!d.thumb.asset || d.thumb.mode === 'custom')) { E('#edThumbFile').click(); return; }
    d.thumb.mode = b.dataset.tm; drawThumbs();
  });
  E('#edThumbFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const data = await shrinkImage(f, 420, .84); const a = { id: uid('a'), name: f.name, mime: f.type, data }; draftAssets[a.id] = a;
    d.thumb = { mode: 'custom', asset: a.id }; drawThumbs();
  });

  /* --- notes --- */
  const ed = E('#edNotes');
  ed.addEventListener('paste', e => { e.preventDefault(); const h = e.clipboardData.getData('text/html'), t = e.clipboardData.getData('text/plain'); document.execCommand('insertHTML', false, h ? sanitize(h) : esc(t).replace(/\n/g, '<br>')); });
  ed.addEventListener('input', () => refreshSugg());
  const tools = E('#edTools');
  tools.addEventListener('mousedown', e => e.preventDefault());
  tools.addEventListener('click', async e => {
    const b = e.target.closest('[data-rt]'); if (!b) return; const c = b.dataset.rt; ed.focus();
    const block = () => String(document.queryCommandValue('formatBlock') || '').toLowerCase();
    if (c === 'h3') document.execCommand('formatBlock', false, block() === 'h3' ? 'div' : 'h3');
    else if (c === 'quote') document.execCommand('formatBlock', false, block() === 'blockquote' ? 'div' : 'blockquote');
    else if (c === 'code') { const s = getSelection(); const t = s.toString(); document.execCommand('insertHTML', false, `<code>${esc(t || 'code')}</code>`); }
    else if (c === 'clear') { document.execCommand('removeFormat'); document.execCommand('unlink'); }
    else if (c === 'link') {
      const s = getSelection(); const range = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
      const u = safeUrl(await askText('Link', 'Web address', 'https://')); ed.focus();
      if (u && range) { const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(range); if (range.collapsed) document.execCommand('insertHTML', false, `<a href="${esc(u)}">${esc(hostOf(u) || u)}</a>`); else document.execCommand('createLink', false, u); }
    }
    else document.execCommand(c);
  });

  /* --- buttons --- */
  m.el.querySelector('footer').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'cancel') m.close();
    else if (b.dataset.act === 'del') { m.close(); deleteNodes([existing.id]); }
    else save();
  });
  m.el.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); } });
  function save() {
    readFields();
    if (tagIn.value.trim()) addTag(tagIn.value);
    if (!d.title && !d.url && !d.video && !d.image && !plain(d.notes)) { toast('Add a link, video, image or note first'); E('#edUrl').focus(); return; }
    if (!d.title && (d.url || d.video)) d.title = E('#edTitle').placeholder && E('#edTitle').placeholder !== 'Taken from the link if left blank' ? E('#edTitle').placeholder : humanSlug(d.url || d.video);
    const added = new Date(E('#edAdded').value); if (!isNaN(added)) d.added = added.toISOString();
    for (const a of Object.values(draftAssets)) if ((d.image && d.image.asset === a.id) || d.thumb.asset === a.id) addAsset(a);
    const tagsChanged = !existing || existing.tags.join('|') !== d.tags.join('|') || hostOf(existing.url || existing.video) !== hostOf(d.url || d.video);
    const clean = normalize({ nodes: [d] }).nodes[0];
    act(() => {
      if (existing) Object.assign(existing, clean);
      else {
        if (opts.at) { clean.x = Math.round(opts.at.x); clean.y = Math.round(opts.at.y); }
        col.nodes.push(clean);
      }
      ui.sel = new Set([clean.id]);
    }, { relayout: tagsChanged });
    noteRecent(d.tags);
    tposDirty = true; matchMemo = new Map(); groupCache = null;
    m.close(); ui.editing = null;
    renderFilters();
    if (!existing) setTimeout(() => { const n = byId[clean.id]; if (n) { const p = posOf(n), r = stage.getBoundingClientRect(), v = V(); const sx = v.x + p.x * v.k, sy = v.y + p.y * v.k; if (sx < 40 || sy < 40 || sx > r.width - 40 || sy > r.height - 40 || v.k < .7) centerOn(n.id, Math.max(v.k, .85)); } }, 120);
  }

  drawTags(); drawImg(); drawThumbs(); refreshSugg();
  if (opts.imageFile) takeImage(opts.imageFile);
  if (!existing && (d.url || d.video)) lookup(d.url || d.video, d.url ? 'url' : 'video');
  if (!existing && d.video) E('#edVideo').dispatchEvent(new Event('change'));
  setTimeout(() => (existing ? E('#edTitle') : (d.url || d.video ? E('#edTitle') : E('#edUrl'))).focus(), 20);
}
/* =========================================================
   Top bar, filter panel, view options, collections, import/export, keys
   ========================================================= */
const filtersEl = $('#mkFilters');
function toggleFilters(open) {
  ui.filtersOpen = open === undefined ? !ui.filtersOpen : open;
  filtersEl.hidden = !ui.filtersOpen; $('#mkFilterBtn').setAttribute('aria-expanded', ui.filtersOpen); $('#mkFilterBtn').classList.toggle('on', ui.filtersOpen);
  prefs.filtersOpen = ui.filtersOpen; savePrefs();
  renderFilters(); requestAnimationFrame(applyView);
}
const PRESETS_ADDED = [['any', 'Any time'], ['today', 'Today'], ['7', 'Past 7 days'], ['30', 'Past 30 days'], ['365', 'Past year'], ['custom', 'Between dates…']];
const PRESETS_VISITED = [['any', 'Any time'], ['today', 'Today'], ['7', 'Past 7 days'], ['30', 'Past 30 days'], ['365', 'Past year'], ['never', 'Never opened'], ['stale', 'Not in 30+ days'], ['custom', 'Between dates…']];
let tagQuery = '';
function renderFilters() {
  if (!ui.filtersOpen || !col) return;
  const tags = [...allTags()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shownTags = tags.filter(([t]) => !tagQuery || t.includes(tagQuery.toLowerCase()) || F.tagsIn.has(t) || F.tagsOut.has(t));
  const cnt = { link: 0, video: 0, image: 0, note: 0 }; for (const n of col.nodes) for (const t of typesOf(n)) cnt[t]++;
  const nMatch = col.nodes.filter(matches).length;
  const focusId = document.activeElement && filtersEl.contains(document.activeElement) ? document.activeElement.id : null;
  const range = (which, o) => o.preset === 'custom' ? `<div class="mk-range"><input type="date" class="mk-field sm" data-range="${which}:from" value="${esc(o.from)}" aria-label="From"><span>to</span><input type="date" class="mk-field sm" data-range="${which}:to" value="${esc(o.to)}" aria-label="To"></div>` : '';
  filtersEl.innerHTML = `
  <div class="mk-fhead"><h2>Filter</h2><button type="button" class="mk-linkbtn" data-fclear ${filtersActive() ? '' : 'disabled'}>Clear all</button><button type="button" class="mk-icon" data-fclose aria-label="Close filters">${ICON.x}</button></div>
  <p class="mk-fcount">${filtersActive() ? `<b>${nMatch}</b> of ${col.nodes.length} match` : `${col.nodes.length} nodes`}</p>
  <section><div class="mk-fsub"><h3>Tags</h3><div class="mk-seg sm" role="group" aria-label="Tag match"><button type="button" data-tagmode="any" class="${F.tagMode === 'any' ? 'on' : ''}" title="Nodes with any of the chosen tags">Any</button><button type="button" data-tagmode="all" class="${F.tagMode === 'all' ? 'on' : ''}" title="Nodes with all of the chosen tags">All</button></div></div>
    ${tags.length > 12 ? `<input class="mk-field sm" id="mkTagQ" placeholder="Find a tag…" value="${esc(tagQuery)}" aria-label="Find a tag">` : ''}
    <div class="mk-ftags">${shownTags.map(([t, k]) => { const st = F.tagsIn.has(t) ? 'in' : F.tagsOut.has(t) ? 'out' : ''; return `<button type="button" class="mk-ftag ${st}" data-ftag="${esc(t)}" style="--c:${tagColor(t)}" aria-pressed="${st ? 'true' : 'false'}" title="${st === 'in' ? 'Showing nodes with this tag. Click to hide them instead.' : st === 'out' ? 'Hiding nodes with this tag. Click to clear.' : 'Click to show only nodes with this tag'}"><b></b>${st === 'out' ? '<s>' + esc(t) + '</s>' : esc(t)}<small>${k}</small></button>`; }).join('') || '<span class="mk-muted">No tags yet</span>'}</div>
    <p class="mk-muted mk-small">Click once to include, twice to exclude.</p></section>
  <section><h3>Type</h3><div class="mk-ftypes">${Object.keys(TYPE_LABEL).map(t => `<button type="button" class="mk-ftype ${F.types.has(t) ? 'in' : ''}" data-ftype="${t}" aria-pressed="${F.types.has(t)}">${TYPE_ICON[t]}${TYPE_LABEL[t]}<small>${cnt[t]}</small></button>`).join('')}</div></section>
  <section><h3>Added</h3><select class="mk-field sm" id="mkFAdded" aria-label="Date added">${PRESETS_ADDED.map(([k, l]) => `<option value="${k}" ${F.added.preset === k ? 'selected' : ''}>${l}</option>`).join('')}</select>${range('added', F.added)}</section>
  <section><h3>Last visited</h3><select class="mk-field sm" id="mkFVisited" aria-label="Date visited">${PRESETS_VISITED.map(([k, l]) => `<option value="${k}" ${F.visited.preset === k ? 'selected' : ''}>${l}</option>`).join('')}</select>${range('visited', F.visited)}</section>
  <section><h3>Nodes that don’t match</h3><div class="mk-seg sm" role="group"><button type="button" data-dim="dim" class="${col.settings.dimMode === 'dim' ? 'on' : ''}">Fade</button><button type="button" data-dim="hide" class="${col.settings.dimMode === 'hide' ? 'on' : ''}">Hide</button></div></section>`;
  if (focusId) { const f = document.getElementById(focusId); if (f) { f.focus(); if (f.setSelectionRange && f.type === 'text') f.setSelectionRange(f.value.length, f.value.length); } }
}
filtersEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.fclose !== undefined) toggleFilters(false);
  else if (d.fclear !== undefined) clearFilters();
  else if (d.ftag) { const t = d.ftag; if (F.tagsIn.has(t)) { F.tagsIn.delete(t); F.tagsOut.add(t); } else if (F.tagsOut.has(t)) F.tagsOut.delete(t); else F.tagsIn.add(t); filtersChanged(); }
  else if (d.ftype) { F.types.has(d.ftype) ? F.types.delete(d.ftype) : F.types.add(d.ftype); filtersChanged(); }
  else if (d.tagmode) { F.tagMode = d.tagmode; filtersChanged(); }
  else if (d.dim) { col.settings.dimMode = d.dim; scheduleSave(); filtersChanged(); }
});
filtersEl.addEventListener('input', e => { if (e.target.id === 'mkTagQ') { tagQuery = e.target.value; renderFilters(); } });
filtersEl.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'mkFAdded') { F.added.preset = t.value; if (t.value === 'custom' && !F.added.from) F.added.from = dayInput(Date.now() - 30 * DAY); filtersChanged(); }
  else if (t.id === 'mkFVisited') { F.visited.preset = t.value; if (t.value === 'custom' && !F.visited.from) F.visited.from = dayInput(Date.now() - 30 * DAY); filtersChanged(); }
  else if (t.dataset.range) { const [w, k] = t.dataset.range.split(':'); F[w][k] = t.value; filtersChanged(); }
});
function clearFilters() {
  F.q = ''; $('#mkSearch').value = ''; F.tagsIn.clear(); F.tagsOut.clear(); F.types.clear(); F.tagMode = 'any';
  F.added = { preset: 'any', from: '', to: '' }; F.visited = { preset: 'any', from: '', to: '' }; tagQuery = '';
  filtersChanged();
}
$('#mkFilterBtn').onclick = () => toggleFilters();

/* search box: filters as you type; Enter jumps through the matches */
let searchTimer, hitIdx = -1;
$('#mkSearch').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { F.q = e.target.value; hitIdx = -1; filtersChanged(); }, 120); });
$('#mkSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault(); clearTimeout(searchTimer); F.q = e.target.value; filtersChanged();
    const hits = col.nodes.filter(matches).sort((a, b) => posOf(a).x - posOf(b).x || posOf(a).y - posOf(b).y); if (!hits.length) { toast('No matches'); return; }
    hitIdx = (hitIdx + (e.shiftKey ? -1 : 1) + hits.length) % hits.length; ui.sel = new Set([hits[hitIdx].id]); renderField(); renderInspector(); centerOn(hits[hitIdx].id, Math.max(V().k, .9));
  }
  if (e.key === 'Escape') { e.target.value = ''; F.q = ''; filtersChanged(); stage.focus(); }
});

/* view options (top-left of the field) */
function renderViewOpts() {
  const web = col.settings.mode === 'web';
  $('#mkViewOpts').innerHTML = (web
    ? `<button type="button" class="mk-btn sm" data-vo="rearrange" title="Lay everything out again from scratch (pinned nodes stay)">${ICON.sparkle}Re-arrange</button>`
    : `<div class="mk-seg sm" role="group" aria-label="Place by"><button type="button" data-vo="basis:added" class="${col.settings.timeBasis === 'added' ? 'on' : ''}">Date added</button><button type="button" data-vo="basis:visited" class="${col.settings.timeBasis === 'visited' ? 'on' : ''}">Last visit</button></div>`)
    + `<button type="button" class="mk-btn sm" data-vo="menu" aria-haspopup="menu">View ▾</button>`;
  $('#mkModeWeb').classList.toggle('on', web); $('#mkModeTime').classList.toggle('on', !web);
  $('#mkModeWeb').setAttribute('aria-pressed', web); $('#mkModeTime').setAttribute('aria-pressed', !web);
}
$('#mkViewOpts').addEventListener('click', e => {
  const b = e.target.closest('[data-vo]'); if (!b) return; const v = b.dataset.vo;
  if (v === 'rearrange') { pushUndo(); layoutWeb({ fresh: true }); groupCache = null; scheduleSave(); renderField(true); setTimeout(() => fitAll(), 60); toast('Re-arranged by tag similarity', { label: 'Undo', fn: undo }); }
  else if (v.startsWith('basis:')) { col.settings.timeBasis = v.slice(6); tposDirty = true; groupCache = null; scheduleSave(); renderViewOpts(); renderField(true); setTimeout(() => fitAll(), 30); }
  else if (v === 'menu') {
    const s = col.settings, ck = on => on ? '✓' : '<span style="opacity:0">✓</span>';
    popMenu(b, `<div class="mk-mh">View</div>
      ${s.mode === 'web' ? `<button type="button" data-v="links">${ck(s.links)} Lines between similar nodes</button>` : ''}
      <button type="button" data-v="collapse">${ck(s.collapse)} Stack similar nodes when zoomed out</button>
      <button type="button" data-v="wheel">${ck(prefs.wheel === 'zoom')} Scroll wheel zooms</button>
      ${s.mode === 'web' ? `<button type="button" data-v="unpin">Unpin all nodes</button>` : ''}`, k => {
      if (k === 'links') s.links = !s.links;
      else if (k === 'collapse') { s.collapse = !s.collapse; groupCache = null; applyView.bucket = null; }
      else if (k === 'wheel') { prefs.wheel = prefs.wheel === 'zoom' ? 'pan' : 'zoom'; savePrefs(); }
      else if (k === 'unpin') { act(() => col.nodes.forEach(n => { n.pinned = false; })); relayoutSoon(); return; }
      scheduleSave(); applyView(); renderField();
    });
  }
});
function setMode(mode) {
  if (col.settings.mode === mode) return;
  col.settings.mode = mode; tposDirty = true; groupCache = null; applyView.bucket = null;
  for (const el of els.values()) el.remove(); els.clear();
  scheduleSave(); renderViewOpts(); renderInspector();
  if (V().unset) fitAll(false); else applyView();
  renderField();
}
$('#mkModeWeb').onclick = () => setMode('web');
$('#mkModeTime').onclick = () => setMode('time');

/* collection name */
$('#mkName').addEventListener('change', e => { col.name = e.target.value.trim() || 'Untitled'; e.target.value = col.name; scheduleSave(); renderInspector(); });
$('#mkName').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#mkUndo').onclick = undo; $('#mkRedo').onclick = redo;
$('#mkAdd').onclick = () => openEditor(null, {});

/* ---------- collections ---------- */
function setCollection(c, a = {}, fresh = true) {
  if (!curEnv || curEnv.id !== c.id) curEnv = null;
  col = c; assets = a; if (fresh) Object.keys(assets).forEach(id => dirtyAssets.add(id));
  undoStack = []; redoStack = []; updUndo();
  ui.sel.clear(); playing = null; index(); invalidateSim(); tposDirty = true; matchMemo = new Map(); applyView.bucket = null;
  for (const el of els.values()) el.remove(); els.clear();
  if (col.nodes.some(n => n.x === null)) layoutWeb({ fresh: !col.nodes.some(n => n.x !== null) });
  filtersChanged();
  renderAll();
  if (V().unset) requestAnimationFrame(() => fitAll(false));
  scheduleSave();
}
function renderAll() {
  if (!col) return;
  $('#mkName').value = col.name; document.title = col.name + ' · Theta Marks';
  renderViewOpts(); renderFilters(); applyView(); renderField(); renderInspector(); updUndo();
}
async function openCollectionsModal() {
  await saveNow();
  const list = collectionIndex().sort((a, b) => b.modified - a.modified);
  const m = modal('Collections', `<div class="mk-clist">${list.map(c => `<div class="mk-crow ${c.id === col.id ? 'cur' : ''}">
      <button type="button" class="mk-cname" data-open="${esc(c.id)}"><b>${esc(c.name)}</b><small>${c.count} node${c.count === 1 ? '' : 's'} · changed ${esc(ago(c.modified))}${c.id === col.id ? ' · open now' : ''}</small></button>
      <button type="button" class="mk-icon" data-ren="${esc(c.id)}" aria-label="Rename ${esc(c.name)}" title="Rename">${ICON.edit}</button>
      <button type="button" class="mk-icon mk-danger" data-delc="${esc(c.id)}" aria-label="Delete ${esc(c.name)}" title="Delete">${ICON.trash}</button></div>`).join('')}</div>
    <p class="mk-muted">Collections are saved in this browser. Use Export to keep a copy or move one to another computer.</p>`,
    { footer: `<button type="button" class="mk-btn" data-examples>Add the example collection</button><span style="flex:1"></span><button type="button" class="mk-btn mk-primary" data-newc>${ICON.plus}New collection</button>` });
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.open) { m.close(); if (d.open !== col.id) await openCollection(d.open); }
    else if (d.ren) { const c = list.find(x => x.id === d.ren); const nm = await askText('Rename collection', 'Name', c.name); if (nm && nm.trim()) { if (d.ren === col.id) { col.name = nm.trim(); await saveNow(); renderAll(); } else { const f = HT.files.read(TOOL, d.ren); f.meta.title = nm.trim(); HT.files.write(f); } m.close(); openCollectionsModal(); } }
    else if (d.delc) {
      const c = list.find(x => x.id === d.delc);
      if (!await askConfirm('Delete collection?', `“${c.name}” and its ${c.count} nodes will be removed from this browser. This can’t be undone.`, 'Delete', true)) return;
      await deleteCollection(d.delc); m.close();
      if (d.delc === col.id) { const rest = collectionIndex(); if (rest.length) await openCollection(rest[0].id); else setCollection(blankCollection()); }
      openCollectionsModal();
    }
    else if (d.newc !== undefined) { const nm = await askText('New collection', 'Name', 'New collection'); if (nm === null) return; await saveNow(); m.close(); setCollection(blankCollection(nm.trim() || 'New collection')); }
    else if (d.examples !== undefined) { await saveNow(); m.close(); const ex = exampleCollection(); setCollection(ex.col, ex.assets); toast('Example collection added'); }
  });
}
$('#mkCollections').onclick = openCollectionsModal;

/* ---------- export ---------- */
function saveFile(name, text, mime) {
  const blob = new Blob([text], { type: mime }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const fileSafe = s => (String(s || 'marks').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'marks').slice(0, 60);
async function exportJSON() {
  await saveNow();
  const used = {}; for (const id of refAssetIds()) if (assets[id]) used[id] = assets[id];
  HT.files.download(toEnvelope(col, curEnv, { assets: used }));
}
function exportBookmarksHTML() {
  const t = iso => Math.floor(ts(iso) / 1000);
  const byTag = new Map(); const none = [];
  for (const n of col.nodes) { if (!n.url && !n.video) continue; const k = n.tags[0]; if (k) { if (!byTag.has(k)) byTag.set(k, []); byTag.get(k).push(n); } else none.push(n); }
  const item = n => `        <DT><A HREF="${esc(n.url || n.video)}" ADD_DATE="${t(n.added)}"${n.visits.length ? ` LAST_VISIT="${Math.floor(lastVisit(n) / 1000)}"` : ''}${n.tags.length ? ` TAGS="${esc(n.tags.join(','))}"` : ''}>${esc(displayTitle(n))}</A>${plain(n.notes) ? `\n        <DD>${esc(plain(n.notes).slice(0, 1000))}` : ''}`;
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- Exported from Theta Marks (Happy Theta) -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>${esc(col.name)}</H3>
    <DL><p>
${[...byTag].sort((a, b) => a[0].localeCompare(b[0])).map(([tag, list]) => `      <DT><H3>${esc(tag)}</H3>\n      <DL><p>\n${list.map(item).join('\n')}\n      </DL><p>`).join('\n')}
${none.map(item).join('\n')}
    </DL><p>
</DL><p>
`;
  saveFile(fileSafe(col.name) + '.bookmarks.html', html, 'text/html');
}
function exportMarkdown() {
  const lines = [`# ${col.name}`, ''];
  for (const n of col.nodes.slice().sort((a, b) => ts(b.added) - ts(a.added))) {
    const head = n.url ? `[${displayTitle(n)}](${n.url})` : displayTitle(n);
    lines.push(`- **${head}**${n.tags.length ? ' ' + n.tags.map(t => '`' + t + '`').join(' ') : ''} — added ${fmtDay(n.added, true)}${n.visits.length ? `, ${n.visits.length} visit${n.visits.length === 1 ? '' : 's'}` : ''}`);
    if (n.video) lines.push(`  - Video: ${n.video}`);
    const p = plain(n.notes); if (p) lines.push(`  - ${p}`);
  }
  saveFile(fileSafe(col.name) + '.md', lines.join('\n') + '\n', 'text/markdown');
}
$('#mkExport').onclick = e => popMenu(e.currentTarget, `<div class="mk-mh">Export “${esc(col.name)}”</div>
  <button type="button" data-v="json">Collection file <small>.marks.json</small></button>
  <button type="button" data-v="html">Browser bookmarks <small>.html</small></button>
  <button type="button" data-v="md">Markdown list <small>.md</small></button>`, v => { if (v === 'json') exportJSON(); else if (v === 'html') exportBookmarksHTML(); else exportMarkdown(); });

/* ---------- import ---------- */
const SKIP_FOLDERS = /^(bookmarks( bar| toolbar| menu)?|other bookmarks|mobile bookmarks|favorites( bar)?|imported.*)$/i;
function parseBookmarksHTML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const out = [];
  const walk = (dl, path) => {
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== 'DT') continue;
      const h3 = dt.querySelector(':scope > h3'), a = dt.querySelector(':scope > a'), sub = dt.querySelector(':scope > dl');
      if (h3 && sub) { const name = h3.textContent.trim(); walk(sub, SKIP_FOLDERS.test(name) ? path : [...path, name]); }
      else if (a) {
        const href = safeUrl(a.getAttribute('href')); if (!href || /^javascript:|^place:/i.test(a.getAttribute('href') || '')) continue;
        const add = parseInt(a.getAttribute('add_date') || '0', 10), lv = parseInt(a.getAttribute('last_visit') || '0', 10);
        const tags = [...path, ...(a.getAttribute('tags') || '').split(',')];
        let dd = dt.nextElementSibling && dt.nextElementSibling.tagName === 'DD' ? dt.nextElementSibling.textContent.trim() : '';
        const dd2 = dt.querySelector(':scope > dd'); if (!dd && dd2) dd = dd2.textContent.trim();
        const v = parseVideo(href);
        out.push(newNode({ title: a.textContent.trim().slice(0, 300), url: v && v.kind !== 'page' ? '' : href, video: v && v.kind !== 'page' ? href : '', tags: cleanTags(tags), added: add ? new Date(add * 1000).toISOString() : new Date().toISOString(), visits: lv ? [new Date(lv * 1000).toISOString()] : [], notes: dd ? esc(dd) : '' }));
      }
    }
  };
  const root = doc.querySelector('dl'); if (root) walk(root, []);
  return out;
}
function parseUrlList(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/(https?:\/\/\S+)/); if (!m) return null; const u = safeUrl(m[1].replace(/[)>\].,]+$/, '')); if (!u) return null; const title = l.replace(m[1], '').replace(/^[-*\s[\]()]+|[-–—:|\s[\]()]+$/g, '').trim(); const v = parseVideo(u); return newNode({ title, url: v && v.kind !== 'page' ? '' : u, video: v && v.kind !== 'page' ? u : '' }); }).filter(Boolean);
}
async function importText(text, target) {
  text = String(text || '').trim(); if (!text) throw new Error('Nothing to import.');
  if (text.startsWith('{')) {
    const f = HT.files.parse(text, TOOL);
    const c = fromEnvelope(f); const a = {};
    const raw = (f.data && f.data.assets) || {};
    for (const [k, v] of Object.entries(raw)) if (v && typeof v.data === 'string' && isImgData(v.data)) a[k] = { id: k, name: String(v.name || ''), mime: String(v.mime || ''), data: v.data };
    if (collectionIndex().some(x => x.id === c.id)) c.id = HT.files.newId('s');
    curEnv = null; await saveNow(); setCollection(c, a); return `Opened “${c.name}” (${c.nodes.length} nodes)`;
  }
  const nodes = /<dl|<!doctype netscape/i.test(text) ? parseBookmarksHTML(text) : parseUrlList(text);
  if (!nodes.length) throw new Error('No links found. Use a .marks.json file, a browser bookmarks .html file, or a list of web addresses.');
  if (target === 'new') { await saveNow(); const c = blankCollection('Imported bookmarks'); c.nodes = nodes; setCollection(normalize(c)); }
  else mergeNodes(nodes, {});
  return `Imported ${nodes.length} link${nodes.length === 1 ? '' : 's'}`;
}
function mergeNodes(nodes, newAssets) {
  const have = new Set(col.nodes.map(n => n.url || n.video).filter(Boolean));
  const fresh = nodes.filter(n => !(n.url || n.video) || !have.has(n.url || n.video));
  const remap = {};
  for (const [k, v] of Object.entries(newAssets)) { const id = uid('a'); remap[k] = id; addAsset(Object.assign({}, v, { id })); }
  act(() => {
    for (const n of fresh) { n.id = byId[n.id] ? uid('k') : n.id; n.x = null; n.y = null; n.pinned = false; if (n.image && n.image.asset) n.image.asset = remap[n.image.asset]; if (n.thumb.asset) n.thumb.asset = remap[n.thumb.asset]; col.nodes.push(n); }
  }, { relayout: true });
  if (nodes.length > fresh.length) toast(`${nodes.length - fresh.length} already here were skipped`);
  tposDirty = true; matchMemo = new Map(); renderFilters();
  setTimeout(() => fitAll(), 200);
}
$('#mkImport').onclick = () => {
  const m = modal('Import', `<p class="mk-p">Choose a <b>.marks.json</b> collection file, a <b>bookmarks .html</b> file exported from Chrome, Edge, Firefox or Safari (folders become tags), or paste a list of web addresses. A collection file always opens as its own collection.</p>
    <div class="mk-improw"><button type="button" class="mk-btn" data-pick>${ICON.upload}Choose a file…</button><span class="mk-muted" id="impName"></span></div>
    <label class="mk-lbl" for="impText">Or paste here</label><textarea class="mk-field" id="impText" rows="7" placeholder="https://phet.colorado.edu/…&#10;https://www.youtube.com/watch?v=…"></textarea>
    <fieldset class="mk-radio"><legend class="mk-lbl">Bookmarks and link lists go into</legend>
      <label><input type="radio" name="impTo" value="merge" checked> This collection (“${esc(col.name)}”)</label>
      <label><input type="radio" name="impTo" value="new"> A new collection</label></fieldset>
    <p class="mk-err" id="impErr" role="alert"></p>`, { footer: `<button type="button" class="mk-btn" data-close2>Cancel</button><button type="button" class="mk-btn mk-primary" data-go>Import</button>` });
  const E = s => m.el.querySelector(s);
  let fileText = '';
  E('[data-pick]').onclick = () => { const fi = $('#mkFile'); fi.accept = '.json,.html,.htm,.txt,application/json,text/html,text/plain'; fi.onchange = async () => { const f = fi.files[0]; fi.value = ''; if (!f) return; fileText = await f.text(); E('#impName').textContent = f.name; E('#impText').value = ''; }; fi.click(); };
  E('[data-close2]').onclick = () => m.close();
  E('[data-go]').onclick = async () => {
    const to = E('input[name=impTo]:checked').value;
    try { const msg = await importText(fileText || E('#impText').value, to); m.close(); toast(msg); }
    catch (err) { E('#impErr').textContent = err.message || String(err); }
  };
};

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const s = $$('.mk-scrim').pop(); if (s) { e.preventDefault(); s._close(); return; } if ($('.mk-menu')) { closeMenus(); return; } }
  const typing = e.target.closest && e.target.closest('input,textarea,select,[contenteditable="true"]');
  if ($('.mk-scrim')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (typing || mod || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#mkSearch').focus(); }
  else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openEditor(null, {}); }
  else if (e.key === 'f' || e.key === 'F') fitAll();
  else if (e.key === '+' || e.key === '=') zoomCenter(1.25);
  else if (e.key === '-' || e.key === '_') zoomCenter(0.8);
  else if (e.key === 't' || e.key === 'T') setMode(col.settings.mode === 'web' ? 'time' : 'web');
  else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.sel.size) { e.preventDefault(); deleteNodes([...ui.sel]); }
  else if (e.key === 'Enter' && ui.sel.size === 1) { e.preventDefault(); openEditor([...ui.sel][0]); }
  else if (e.key === 'o' && ui.sel.size === 1) openNode([...ui.sel][0]);
  else if (e.key === 'Escape' && ui.sel.size) { ui.sel.clear(); renderField(); renderInspector(); }
  else if (e.key.startsWith('Arrow') && document.activeElement === stage) { const v = V(), s = 60; if (e.key === 'ArrowLeft') v.x += s; if (e.key === 'ArrowRight') v.x -= s; if (e.key === 'ArrowUp') v.y += s; if (e.key === 'ArrowDown') v.y -= s; e.preventDefault(); applyView(); saveViewSoon(); }
});
window.addEventListener('resize', () => { applyView(); });
window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) saveNow(); });
/* =========================================================
   Example collection (first run) and start-up
   ========================================================= */
const svgUrl = svg => 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
function exampleCollection() {
  const now = Date.now();
  const at = (daysAgo, h = 15) => { const d = new Date(now - daysAgo * DAY); d.setHours(h, (daysAgo * 7) % 60, 0, 0); return d.toISOString(); };
  const visits = (...days) => days.map((x, i) => at(x, 9 + (i % 7)));
  const inclineSvg = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#F8FAFD"/><path d="M20 180 L300 180 L300 60 Z" fill="#DBEAFE" stroke="#1E3A8A" stroke-width="3"/><g transform="rotate(-23.2 190 128)"><rect x="160" y="98" width="60" height="40" fill="#FDE68A" stroke="#1E3A8A" stroke-width="3"/></g><g stroke-width="4" fill="none" stroke-linecap="round"><path d="M190 120 L190 178" stroke="#B91C1C"/><path d="M190 120 L166 64" stroke="#1D4ED8"/><path d="M190 120 L236 100" stroke="#047857"/></g><text x="196" y="170" font-family="sans-serif" font-size="15" fill="#B91C1C">w</text><text x="150" y="70" font-family="sans-serif" font-size="15" fill="#1D4ED8">N</text><text x="238" y="96" font-family="sans-serif" font-size="15" fill="#047857">f</text></svg>`);
  const barsSvg = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#fff"/><path d="M30 150 H290" stroke="#111827" stroke-width="2"/>${[['K', 40, 70, '#1D4ED8'], ['Ug', 100, 20, '#D9622B'], ['Uel', 160, 0, '#7A4FD0'], ['Eth', 220, 30, '#047857']].map(([l, x, h, c]) => `<rect x="${x}" y="${150 - h}" width="40" height="${h}" fill="${c}"/><text x="${x + 20}" y="172" text-anchor="middle" font-family="sans-serif" font-size="15">${l}</text>`).join('')}<text x="160" y="30" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700">Energy bar chart: ball at the bottom of a ramp</text></svg>`);
  const N = (o) => newNode(o);
  const nodes = [
    N({ title: 'Projectile Motion (PhET)', url: 'https://phet.colorado.edu/en/simulations/projectile-motion', tags: ['simulation', 'kinematics', 'projectiles'], added: at(150), visits: visits(150, 120, 41, 9), notes: '<div>Use the <b>Lab</b> screen. Students predict range at 30° vs 60° before running it.</div>' }),
    N({ title: 'Forces and Motion: Basics (PhET)', url: 'https://phet.colorado.edu/en/simulations/forces-and-motion-basics', tags: ['simulation', 'forces', 'newtons laws'], added: at(140), visits: visits(130, 62, 30) }),
    N({ title: 'Energy Skate Park (PhET)', url: 'https://phet.colorado.edu/en/simulations/energy-skate-park', tags: ['simulation', 'energy'], added: at(138), visits: visits(80, 20) }),
    N({ title: 'Masses and Springs (PhET)', url: 'https://phet.colorado.edu/en/simulations/masses-and-springs', tags: ['simulation', 'oscillations', 'energy'], added: at(120), visits: visits(15) }),
    N({ title: 'Pendulum Lab (PhET)', url: 'https://phet.colorado.edu/en/simulations/pendulum-lab', tags: ['simulation', 'oscillations'], added: at(119), visits: visits(14, 3) }),
    N({ title: 'Wave on a String (PhET)', url: 'https://phet.colorado.edu/en/simulations/wave-on-a-string', tags: ['simulation', 'waves'], added: at(60), visits: [] }),
    N({ title: 'Circuit Construction Kit: DC (PhET)', url: 'https://phet.colorado.edu/en/simulations/circuit-construction-kit-dc', tags: ['simulation', 'circuits'], added: at(58), visits: visits(2) }),
    N({ title: 'HyperPhysics', url: 'http://hyperphysics.phy-astr.gsu.edu/hbase/hframe.html', tags: ['reference'], added: at(170), visits: visits(160, 100, 50, 22, 6) }),
    N({ title: 'The Physics Classroom', url: 'https://www.physicsclassroom.com/', tags: ['reference', 'lesson', 'kinematics', 'forces'], added: at(168), visits: visits(90, 33) }),
    N({ title: 'Projectile motion — Wikipedia', url: 'https://en.wikipedia.org/wiki/Projectile_motion', tags: ['reference', 'kinematics', 'projectiles'], added: at(100), visits: visits(99) }),
    N({ title: 'Simple harmonic motion — Wikipedia', url: 'https://en.wikipedia.org/wiki/Simple_harmonic_motion', tags: ['reference', 'oscillations'], added: at(37), visits: [] }),
    N({ title: "Newton's laws of motion — Wikipedia", url: 'https://en.wikipedia.org/wiki/Newton%27s_laws_of_motion', tags: ['reference', 'forces', 'newtons laws'], added: at(131), visits: visits(128) }),
    N({ title: 'AP Physics 1 — course page', url: 'https://apcentral.collegeboard.org/courses/ap-physics-1', tags: ['ap physics 1', 'curriculum'], added: at(175), visits: visits(170, 140, 70, 12) }),
    N({ title: 'College Physics 2e (OpenStax)', url: 'https://openstax.org/details/books/college-physics-2e', tags: ['textbook', 'reference'], added: at(160), visits: visits(110) }),
    N({ title: 'AAPT', url: 'https://www.aapt.org/', tags: ['teaching', 'community'], added: at(155), visits: [] }),
    N({ title: 'Modeling Instruction', url: 'https://www.modelinginstruction.org/', tags: ['teaching', 'curriculum', 'community'], added: at(150), visits: visits(45) }),
    N({ title: 'Desmos graphing calculator', url: 'https://www.desmos.com/calculator', tags: ['tools', 'data analysis', 'graphs'], added: at(165), visits: visits(150, 101, 77, 40, 25, 8, 1) }),
    N({ title: 'Tracker video analysis', url: 'https://physlets.org/tracker/', tags: ['tools', 'data analysis', 'lab', 'video analysis'], added: at(95), visits: visits(60) }),
    N({ title: 'Pivot Interactives', url: 'https://www.pivotinteractives.com/', tags: ['lab', 'video analysis', 'simulation'], added: at(90), visits: [] }),
    N({ title: 'Flipping Physics', url: 'https://www.flippingphysics.com/', tags: ['lesson', 'ap physics 1', 'video'], added: at(85), visits: visits(30) }),
    N({ title: 'Veritasium (YouTube channel)', video: 'https://www.youtube.com/@veritasium', tags: ['video', 'phenomena'], added: at(70), visits: visits(68, 5) }),
    N({ title: 'Lab idea: coffee-filter drag', tags: ['lab', 'forces', 'air resistance'], added: at(26), notes: '<h3>Coffee-filter terminal speed</h3><ul><li>Drop 1–5 nested filters from 2 m</li><li>Video at 240 fps, analyze in Tracker</li><li>Plot v<sub>t</sub>² vs number of filters</li></ul><div>Needs: filters, meter stick, phone.</div>' }),
    N({ title: 'Misconception: heavier objects fall faster', tags: ['misconception', 'kinematics', 'forces'], added: at(24), notes: '<div>Warm-up: drop a book and a sheet of paper, then the paper <i>on top of</i> the book. Ask for predictions first.</div>' }),
    N({ title: 'Unit 2 warm-up questions', tags: ['assessment', 'forces', 'newtons laws'], added: at(12), notes: '<ol><li>A box slides at constant speed. Draw the FBD.</li><li>Is the normal force always equal to mg?</li><li>Rope tension in an Atwood machine: bigger or smaller than the light mass’s weight?</li></ol>' }),
    N({ title: 'Block on an incline — FBD sketch', image: { url: inclineSvg }, tags: ['forces', 'diagrams', 'inclines'], added: at(10), thumb: { mode: 'image' } }),
    N({ title: 'Energy bar chart example', image: { url: barsSvg }, tags: ['energy', 'diagrams'], added: at(7), thumb: { mode: 'image' }, notes: '<div>Use with the Theta Energy Diagram tool.</div>' }),
    N({ title: 'Quiz ideas: oscillations', tags: ['assessment', 'oscillations'], added: at(4), notes: '<ul><li>Period of a spring vs mass — data table, students linearize</li><li>Pendulum on the Moon?</li></ul>' }),
    N({ title: 'Vernier', url: 'https://www.vernier.com/', tags: ['lab', 'tools', 'sensors'], added: at(2), visits: [] }),
  ];
  const c = blankCollection('Physics teaching links');
  c.nodes = nodes; normalize(c);
  return { col: c, assets: {} };
}

/* ---------- start ---------- */
(async function boot() {
  ui.filtersOpen = !!prefs.filtersOpen && innerWidth > 900;
  filtersEl.hidden = !ui.filtersOpen; $('#mkFilterBtn').classList.toggle('on', ui.filtersOpen);
  let opened = false;
  const last = LS.get('last');
  try { if (last) opened = await openCollection(last); } catch (e) { console.warn(e); }
  if (!opened) { const list = collectionIndex().sort((a, b) => b.modified - a.modified); if (list.length) try { opened = await openCollection(list[0].id); } catch { } }
  if (!opened) {
    if (!LS.get('seeded')) { const ex = exampleCollection(); setCollection(ex.col, ex.assets); try { LS.set('seeded', '1'); } catch { } }
    else setCollection(blankCollection());
  }
})();

})();
