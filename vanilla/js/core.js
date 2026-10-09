/* HappyTheta core — shared layout, UI helpers, canvas stage, grid logic and image export.
   Plain JavaScript, no libraries. Loaded as a classic script so pages also work from file://. */
'use strict';

const HT = (window.HT = {});

/* ------------------------------------------------------------------ */
/* Small DOM helpers                                                   */
/* ------------------------------------------------------------------ */

HT.el = function (tag, attrs, ...children) {
	const node = document.createElement(tag);
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			if (v === undefined || v === null || v === false) continue;
			if (k === 'class') node.className = v;
			else if (k === 'text') node.textContent = v;
			else if (k === 'html') node.innerHTML = v;
			else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
			else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
			else node.setAttribute(k, v === true ? '' : v);
		}
	}
	for (const c of children.flat()) {
		if (c === null || c === undefined || c === false) continue;
		node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
	}
	return node;
};

/* Outline icons (24x24, stroke = currentColor) */
const ICON_PATHS = {
	fileExport: 'M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4',
	fileCopy:
		'M9 8v3a1 1 0 0 1-1 1H5m11 4h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v1m4 3v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7.13a1 1 0 0 1 .24-.65L7.7 9.35a1 1 0 0 1 .76-.35H13a1 1 0 0 1 1 1Z',
	floppy:
		'M11 16h2m6.707-9.293-2.414-2.414A1 1 0 0 0 16.586 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7.414a1 1 0 0 0-.293-.707ZM16 20v-6a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v6h8ZM9 4h6v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V4Z',
	folderOpen:
		'M5 19V6a1 1 0 0 1 1-1h4.032a1 1 0 0 1 .768.36l1.9 2.28a1 1 0 0 0 .768.36H16a1 1 0 0 1 1 1v1M3.044 17.874l1.5-6A1 1 0 0 1 5.5 11H20a1 1 0 0 1 .97 1.243l-1.5 6A1 1 0 0 1 18.5 19H4.014a1 1 0 0 1-.97-1.126Z',
	refresh:
		'M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4',
	trash: 'M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z',
	plusCircle: 'M12 7.757v8.486M7.757 12h8.486M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
	edit:
		'm14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z',
	menu: 'M5 7h14M5 12h14M5 17h14'
};

HT.icon = function (name) {
	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('aria-hidden', 'true');
	const p = document.createElementNS(NS, 'path');
	p.setAttribute('d', ICON_PATHS[name]);
	p.setAttribute('stroke', 'currentColor');
	p.setAttribute('stroke-width', '2');
	p.setAttribute('stroke-linecap', 'round');
	p.setAttribute('stroke-linejoin', 'round');
	svg.appendChild(p);
	return svg;
};

HT.button = function ({ cls = 'btn-alt', icon, text, tip, onclick, disabled, extra = '' }) {
	return HT.el(
		'button',
		{ type: 'button', class: `btn ${cls} ${extra}`.trim(), 'data-tip': tip, disabled, onclick },
		icon ? HT.icon(icon) : null,
		text || null
	);
};

/* Shallow-safe deep clone for plain data */
HT.clone = (o) => JSON.parse(JSON.stringify(o));

/* ------------------------------------------------------------------ */
/* Element-controls flag ("Show Element Controls" toggle)              */
/* ------------------------------------------------------------------ */

HT.ctrl = false;
HT.setCtrl = function (on) {
	HT.ctrl = !!on;
	document.body.classList.toggle('show-ctrl', HT.ctrl);
	document.dispatchEvent(new CustomEvent('ht-ctrl'));
};

/* ------------------------------------------------------------------ */
/* Resize dispatch (figures recompute their stage size from the window) */
/* ------------------------------------------------------------------ */

const resizeHandlers = new Set();
HT.onResize = function (fn) {
	resizeHandlers.add(fn);
	return () => resizeHandlers.delete(fn);
};
let resizeRaf = 0;
window.addEventListener('resize', () => {
	cancelAnimationFrame(resizeRaf);
	resizeRaf = requestAnimationFrame(() => resizeHandlers.forEach((fn) => fn()));
});

/* ------------------------------------------------------------------ */
/* Page layout: navbar, and (for figure pages) the toolbar + capture    */
/* ------------------------------------------------------------------ */

HT.root = document.body.dataset.root || './';

HT.actions = {
	saveData: () => {},
	loadData: () => {},
	refreshAllData: () => {}
};

(function buildLayout() {
	const r = HT.root;
	const pageContent = Array.from(document.body.childNodes).filter((n) => n.nodeName !== 'SCRIPT');

	const links = [
		['Home', 'index.html'],
		['Free Body Diagram', 'figures/free-body-diagram.html'],
		['Energy Diagram', 'figures/energy-diagram.html'],
		['Motion Diagram', 'figures/motion-diagram.html'],
		['Graph Maker', 'figures/graph-maker.html'],
		['Advanced Graph Maker', 'figures/advanced-graph-maker.html'],
		['GIF Maker', 'cv-apps/gif-maker.html']
	];

	const navLinks = HT.el(
		'div',
		{ class: 'nav-links' },
		HT.el('ul', null, links.map(([t, href]) => HT.el('li', null, HT.el('a', { href: r + href, text: t }))))
	);
	const hamburger = HT.el(
		'button',
		{ class: 'nav-hamburger', type: 'button', 'aria-label': 'Open main menu', onclick: () => navLinks.classList.toggle('open') },
		HT.icon('menu')
	);
	const nav = HT.el(
		'nav',
		{ class: 'navbar' },
		HT.el(
			'div',
			{ class: 'navbar-inner' },
			HT.el('a', { class: 'navbar-brand', href: r + 'index.html' }, HT.el('img', { src: r + 'assets/HappyThetaLogo.svg', alt: 'Happy Theta Logo', title: 'Happy Theta Logo' })),
			hamburger,
			navLinks
		)
	);

	const content = HT.el('div', { class: 'content' });
	const app = HT.el('div', { class: 'app' }, nav, content);

	if (document.body.dataset.layout === 'figures') {
		const call = (name) => () => HT.actions[name]();
		const toolbar = HT.el(
			'div',
			{ class: 'btn-group' },
			HT.button({ cls: 'btn-dark', icon: 'fileExport', tip: 'Download image as png', onclick: () => HT.saveDivAsImage() }),
			HT.button({ cls: 'btn-dark', icon: 'fileCopy', tip: 'Copy image to clipboard', onclick: () => HT.copyDivAsImageToClipboard() }),
			HT.button({ cls: 'btn-dark', icon: 'floppy', tip: 'Save data locally (TBD)', disabled: true, onclick: call('saveData') }),
			HT.button({ cls: 'btn-dark', icon: 'folderOpen', tip: 'Load local data (TBD)', disabled: true, onclick: call('loadData') }),
			HT.button({ cls: 'btn-dark', icon: 'refresh', tip: 'Delete data and refresh', onclick: call('refreshAllData') })
		);
		const checkbox = HT.el('input', { type: 'checkbox', onchange: (e) => HT.setCtrl(e.target.checked) });
		const toggle = HT.el(
			'label',
			{ class: 'toggle' },
			checkbox,
			HT.el('span', { class: 'track' }),
			HT.el('span', { class: 'toggle-label', text: 'Show Element Controls' })
		);
		const capture = HT.el('div', { id: 'capture' });
		pageContent.forEach((n) => capture.appendChild(n));
		content.appendChild(HT.el('div', { class: 'figures-wrap' }, toolbar, toggle, capture));
		HT.capture = capture;
	} else {
		pageContent.forEach((n) => content.appendChild(n));
	}

	document.body.insertBefore(app, document.body.firstChild);
	HT.setCtrl(false);
})();

/* ------------------------------------------------------------------ */
/* Editable label (double-click or pencil button to edit)             */
/* ------------------------------------------------------------------ */

HT.editLabel = function ({ text = 'Title', size = 'xl', vertical = false, onchange = () => {} } = {}) {
	let editing = false;
	const txt = HT.el('div', { class: `label-text size-${size}${vertical ? ' vertical' : ''}` });
	txt.textContent = text;

	const apply = () => {
		const on = editing && HT.ctrl;
		txt.contentEditable = on ? 'true' : 'false';
		txt.classList.toggle('editing', on);
		txt.classList.toggle('not-editing', !editing);
	};
	const editOn = () => {
		editing = true;
		apply();
		txt.focus();
	};
	const editOff = () => {
		editing = false;
		apply();
	};

	const btn = HT.el(
		'button',
		{
			type: 'button',
			class: 'btn btn-light btn-xs ctrl-only',
			onclick: () => (editing ? editOff() : editOn())
		},
		HT.icon('edit')
	);

	txt.addEventListener('dblclick', () => (editing ? editOff() : editOn()));
	txt.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			editOff();
			txt.blur();
		}
	});
	txt.addEventListener('blur', editOff);
	txt.addEventListener('input', () => onchange(txt.textContent));
	document.addEventListener('ht-ctrl', apply);
	apply();

	const root = HT.el('div', { class: 'edit-label' }, btn, txt);
	return {
		el: root,
		setText(t) {
			txt.textContent = t;
		}
	};
};

/* ------------------------------------------------------------------ */
/* Canvas stage — a tiny 2D drawing layer (replaces Konva)             */
/* ------------------------------------------------------------------ */

class Stage {
	constructor(parent) {
		this.canvas = HT.el('canvas', { class: 'ht-stage' });
		this.ctx = this.canvas.getContext('2d');
		this.w = 0;
		this.h = 0;
		if (parent) parent.appendChild(this.canvas);
	}

	resize(w, h) {
		const d = window.devicePixelRatio || 1;
		this.w = w;
		this.h = h;
		this.canvas.width = Math.max(1, Math.round(w * d));
		this.canvas.height = Math.max(1, Math.round(h * d));
		this.canvas.style.width = w + 'px';
		this.canvas.style.height = h + 'px';
		this.ctx.setTransform(d, 0, 0, d, 0, 0);
	}

	clear() {
		this.ctx.clearRect(0, 0, this.w, this.h);
	}

	/* pointer position in stage coordinates */
	pos(e) {
		const r = this.canvas.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	_paint({ fill, stroke, strokeWidth = 1, opacity = 1 }) {
		const c = this.ctx;
		c.globalAlpha = opacity;
		if (fill) {
			c.fillStyle = fill;
			c.fill();
		}
		if (stroke && strokeWidth) {
			c.lineWidth = strokeWidth;
			c.strokeStyle = stroke;
			c.stroke();
		}
		c.globalAlpha = 1;
	}

	line(x0, y0, x1, y1, opts) {
		const c = this.ctx;
		c.beginPath();
		c.moveTo(x0, y0);
		c.lineTo(x1, y1);
		this._paint({ ...opts, fill: null });
	}

	/* Arrow from (x0,y0) to (x1,y1) with a triangular head at the end */
	arrow(x0, y0, x1, y1, opts) {
		const { pointerLength = 10, pointerWidth = 10 } = opts;
		this.line(x0, y0, x1, y1, opts);
		const c = this.ctx;
		const ang = Math.atan2(y1 - y0, x1 - x0);
		c.save();
		c.translate(x1, y1);
		c.rotate(ang);
		c.beginPath();
		c.moveTo(0, 0);
		c.lineTo(-pointerLength, pointerWidth / 2);
		c.lineTo(-pointerLength, -pointerWidth / 2);
		c.closePath();
		c.restore();
		this._paint(opts);
	}

	circle(x, y, r, opts) {
		const c = this.ctx;
		c.beginPath();
		c.arc(x, y, r, 0, Math.PI * 2);
		this._paint(opts);
	}

	rect(x, y, w, h, opts) {
		const c = this.ctx;
		c.beginPath();
		c.rect(x, y, w, h);
		this._paint(opts);
	}

	quad(x0, y0, cx, cy, x1, y1, opts) {
		const c = this.ctx;
		c.beginPath();
		c.moveTo(x0, y0);
		c.quadraticCurveTo(cx, cy, x1, y1);
		this._paint({ ...opts, fill: null });
	}

	text(str, x, y, { fontSize = 12, fill = 'black', stroke, strokeWidth = 0 }) {
		const c = this.ctx;
		c.font = `${fontSize}px Arial`;
		c.textBaseline = 'top';
		c.textAlign = 'left';
		c.fillStyle = fill;
		c.fillText(str, x, y);
		if (stroke && strokeWidth) {
			c.lineWidth = strokeWidth;
			c.strokeStyle = stroke;
			c.strokeText(str, x, y);
		}
	}

	/* Mouse wiring: enter/leave/move/click, all with stage coordinates */
	on({ move, click, enter, leave }) {
		const cv = this.canvas;
		if (move) cv.addEventListener('mousemove', (e) => move(this.pos(e), e));
		if (click) cv.addEventListener('click', (e) => click(this.pos(e), e));
		if (enter) cv.addEventListener('mouseenter', (e) => enter(this.pos(e), e));
		if (leave) cv.addEventListener('mouseleave', (e) => leave(this.pos(e), e));
	}
}
HT.Stage = Stage;

/* ------------------------------------------------------------------ */
/* Grid logic — converts between grid points (y up) and stage pixels    */
/* ------------------------------------------------------------------ */

class GridLogic {
	constructor({ numCells = { x: 10, y: 10 }, origin = { x: 0, y: 0 }, cellSize = 20 } = {}) {
		this.numCells = numCells;
		this.cellSize = cellSize;
		this.origin = origin;
		this.size = { x: (numCells.x + 2) * cellSize, y: (numCells.y + 2) * cellSize };
		this.stageCenter = { x: this.size.x / 2, y: this.size.y / 2 };
		this.gridCenter = {
			x: origin.x + (numCells.x * cellSize) / 2,
			y: origin.y + (numCells.y * cellSize) / 2
		};
		this.offSet = { x: -this.gridCenter.x + this.stageCenter.x, y: -this.gridCenter.y + this.stageCenter.y };
		this.gridList = this.buildGridLines(numCells, cellSize, origin);
	}

	getPointFromStage(p) {
		return {
			x: (p.x - this.offSet.x) / this.cellSize - this.origin.x,
			y: this.numCells.y - this.origin.y - (p.y - this.offSet.y) / this.cellSize
		};
	}

	getSnappedPointFromStage(p) {
		const pt = this.getPointFromStage(p);
		pt.x = Math.round(pt.x);
		pt.y = Math.round(pt.y);
		return pt;
	}

	getStageFromPoint(p) {
		return {
			x: (p.x + this.origin.x) * this.cellSize + this.offSet.x,
			y: (this.numCells.y - p.y - this.origin.y) * this.cellSize + this.offSet.y
		};
	}

	buildGridLines(numCells, cellSize, origin) {
		const off = this.offSet;
		const list = [];
		for (let i = 0; i <= numCells.x; i++) {
			const xv = i * cellSize;
			const y0 = numCells.y == 0 ? -cellSize : 0;
			const y1 = numCells.y == 0 ? cellSize : numCells.y * cellSize;
			list.push({ x0: xv + off.x, y0: y0 + off.y, x1: xv + off.x, y1: y1 + off.y, type: (i - origin.x) % 5 == 0 ? 'major' : 'minor' });
		}
		for (let i = 0; i <= numCells.y; i++) {
			const yv = i * cellSize;
			const x0 = numCells.x == 0 ? -cellSize : 0;
			const x1 = numCells.x == 0 ? cellSize : numCells.x * cellSize;
			list.push({ x0: x0 + off.x, y0: yv + off.y, x1: x1 + off.x, y1: yv + off.y, type: (i - origin.y) % 5 == 0 ? 'major' : 'minor' });
		}
		// y axis
		const xa = origin.x * cellSize + off.x;
		list.push({
			x0: xa,
			y0: numCells.y == 0 ? cellSize * 1.5 + off.y : numCells.y * cellSize + off.y,
			x1: xa,
			y1: numCells.y == 0 ? -cellSize * 1.5 + off.y - cellSize / 2 : off.y - cellSize / 2,
			type: 'axis'
		});
		// x axis
		const ya = (numCells.y - origin.y) * cellSize + off.y;
		list.push({
			x0: numCells.x == 0 ? -cellSize + off.x : off.x,
			y0: ya,
			x1: numCells.x == 0 ? cellSize + off.x : numCells.x * cellSize + off.x + cellSize / 2,
			y1: ya,
			type: 'axis'
		});
		return list;
	}
}
HT.GridLogic = GridLogic;

const GRID_STYLES = {
	minor: { strokeWidth: 1, stroke: 'gray' },
	major: { strokeWidth: 2, stroke: 'gray' },
	axis: { strokeWidth: 4, stroke: 'black' }
};

HT.drawGridLines = function (stage, grid) {
	for (const g of grid.gridList) {
		const s = GRID_STYLES[g.type];
		if (g.type === 'axis') stage.arrow(g.x0, g.y0, g.x1, g.y1, { ...s, fill: null });
		else stage.line(g.x0, g.y0, g.x1, g.y1, s);
	}
};

/* Stage size from the window, as in the original Grid component */
HT.gridStageSize = function (numCells, initCellSize = 20) {
	const win = { x: window.innerWidth, y: window.innerHeight };
	const aspect = (numCells.x + 2) / (numCells.y + 2);
	let szX = 200;
	let szY = 200;
	if (aspect > 1) {
		szX = 0.5 * Math.max(win.x, 200);
		szY = szX / aspect;
	}
	if (aspect <= 1) {
		szY = 0.5 * Math.max(win.y, 200);
		szX = szY * aspect;
	}
	const cellSize = Math.min(szX / (numCells.x + 2), szY / (numCells.y + 2)) || initCellSize;
	return { size: { x: szX, y: szY }, cellSize };
};

/* ------------------------------------------------------------------ */
/* Export the #capture area as a PNG (replaces html2canvas)            */
/* ------------------------------------------------------------------ */

function cloneWithStyles(node) {
	if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
	if (node.nodeType !== Node.ELEMENT_NODE) return null;

	const cs = getComputedStyle(node);
	if (cs.display === 'none') return null;

	let copy;
	if (node.tagName === 'CANVAS') {
		copy = document.createElement('img');
		copy.setAttribute('src', node.toDataURL('image/png'));
	} else if (node instanceof SVGElement) {
		copy = node.cloneNode(true);
	} else {
		copy = node.cloneNode(false);
		copy.removeAttribute('id');
		if (node.tagName === 'INPUT') copy.setAttribute('value', node.value);
	}

	let style = '';
	for (let i = 0; i < cs.length; i++) {
		const p = cs[i];
		style += `${p}:${cs.getPropertyValue(p)};`;
	}
	copy.setAttribute('style', style);

	if (!(node instanceof SVGElement) && node.tagName !== 'CANVAS') {
		for (const child of node.childNodes) {
			const c = cloneWithStyles(child);
			if (c) copy.appendChild(c);
		}
	}
	return copy;
}

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

/* Fallback: stack the figure canvases if the browser refuses the DOM snapshot */
function canvasesOnly(el, scale) {
	const canvases = Array.from(el.querySelectorAll('canvas'));
	const pad = 16;
	const w = Math.max(1, ...canvases.map((c) => c.clientWidth)) + pad * 2;
	const h = canvases.reduce((s, c) => s + c.clientHeight + pad, pad);
	const out = document.createElement('canvas');
	out.width = w * scale;
	out.height = h * scale;
	const ctx = out.getContext('2d');
	ctx.scale(scale, scale);
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, w, h);
	let y = pad;
	for (const c of canvases) {
		ctx.drawImage(c, pad, y, c.clientWidth, c.clientHeight);
		y += c.clientHeight + pad;
	}
	return out;
}

HT.captureToCanvas = async function (el = document.querySelector('#capture')) {
	const scale = window.devicePixelRatio || 1;
	const rect = el.getBoundingClientRect();
	const w = Math.ceil(rect.width);
	const h = Math.ceil(rect.height);
	try {
		const clone = cloneWithStyles(el);
		clone.style.margin = '0';
		const xhtml = new XMLSerializer().serializeToString(clone);
		const svg =
			`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
			`<foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
		const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
		const out = document.createElement('canvas');
		out.width = w * scale;
		out.height = h * scale;
		const ctx = out.getContext('2d');
		ctx.scale(scale, scale);
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, w, h);
		ctx.drawImage(img, 0, 0, w, h);
		out.toDataURL(); // throws here if the browser tainted the canvas
		return out;
	} catch (err) {
		console.warn('Full-page snapshot unavailable, exporting figures only.', err);
		return canvasesOnly(el, scale);
	}
};

HT.saveDivAsImage = async function () {
	const canvas = await HT.captureToCanvas();
	const link = document.createElement('a');
	link.href = canvas.toDataURL('image/png');
	link.download = 'div-image.png';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
};

HT.copyDivAsImageToClipboard = async function () {
	const canvas = await HT.captureToCanvas();
	canvas.toBlob((blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]));
};
