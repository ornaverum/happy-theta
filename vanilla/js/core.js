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
			HT.button({ cls: 'btn-dark', icon: 'floppy', tip: 'Save in this browser', onclick: call('saveData') }),
			HT.button({ cls: 'btn-dark', icon: 'folderOpen', tip: 'Open a saved figure', onclick: call('loadData') }),
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

	text(str, x, y, { fontSize = 12, fill = 'black', stroke, strokeWidth = 0, italic = false, align = 'left', baseline = 'top' }) {
		const c = this.ctx;
		c.font = `${italic ? 'italic ' : ''}${fontSize}px Arial`;
		c.textBaseline = baseline;
		c.textAlign = align;
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

/*
 * Label the axes "x" and "y" beside their arrowheads (just under the x arrow, just right of the y arrow).
 * A 1D line only labels its own axis. map(p) turns a grid-frame stage point into the point to draw at,
 * for figures that rotate their axes; the letters themselves stay upright.
 */
HT.drawAxisLabels = function (stage, grid, { map = (p) => p, x = 'x', y = 'y' } = {}) {
	const axes = grid.gridList.filter((g) => g.type === 'axis'); // [y axis, x axis], each drawn toward its tip (x1, y1)
	const cs = grid.cellSize;
	const style = { fontSize: Math.max(12, Math.min(22, 0.5 * cs)), fill: 'black', italic: true, align: 'center', baseline: 'middle' };
	if (grid.numCells.x > 0 && axes[1]) {
		const p = map({ x: axes[1].x1 - 0.3 * cs, y: axes[1].y1 + 0.45 * cs });
		stage.text(x, p.x, p.y, style);
	}
	if (grid.numCells.y > 0 && axes[0]) {
		const p = map({ x: axes[0].x1 + 0.45 * cs, y: axes[0].y1 + 0.3 * cs });
		stage.text(y, p.x, p.y, style);
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

/* ------------------------------------------------------------------ */
/* Save files — one JSON envelope for every tool                       */
/*   { format, version, tool, role, id, meta, data, view }             */
/*   data = what the figure means (graded); view = how it was drawn.   */
/* ------------------------------------------------------------------ */

const FILE_FORMAT = 'happytheta';
const FILE_VERSION = 1;
const STORE_PREFIX = 'happytheta:save:';
const TOOLS = ['fbd', 'energy', 'motion', 'graph'];

HT.files = {
	FORMAT: FILE_FORMAT,
	VERSION: FILE_VERSION,

	newId(prefix = 's') {
		return prefix + '_' + Math.random().toString(36).slice(2, 10);
	},

	/* Build a fresh envelope, or update a previous one (keeps id + created) */
	wrap(tool, { title, data, view = {} }, prev) {
		const now = new Date().toISOString();
		return {
			format: FILE_FORMAT,
			version: FILE_VERSION,
			tool,
			role: 'response',
			id: prev ? prev.id : HT.files.newId('s'),
			meta: { title: title || 'Untitled', created: prev ? prev.meta.created : now, modified: now },
			data,
			view
		};
	},

	/* Validate text or an object; throws an Error with a readable message */
	parse(input, tool) {
		let f = input;
		if (typeof input === 'string') {
			try {
				f = JSON.parse(input);
			} catch {
				throw new Error('That file is not valid JSON.');
			}
		}
		if (!f || f.format !== FILE_FORMAT) throw new Error('That is not a Happy Theta file.');
		if (!TOOLS.includes(f.tool)) throw new Error(`Unknown tool "${f.tool}".`);
		if (tool && f.tool !== tool) throw new Error(`That file is for the ${HT.files.toolName(f.tool)}, not this page.`);
		if (typeof f.version !== 'number' || f.version > FILE_VERSION)
			throw new Error('That file was made by a newer version of Happy Theta.');
		if (!f.data || typeof f.data !== 'object') throw new Error('That file has no figure data.');
		return HT.files.migrate(f);
	},

	/* Upgrade older versions step by step. Only version 1 exists so far. */
	migrate(f) {
		f.meta = f.meta || {};
		f.view = f.view || {};
		return f;
	},

	toolName(tool) {
		return { fbd: 'Free Body Diagram', energy: 'Energy Diagram', motion: 'Motion Diagram', graph: 'Graph Maker' }[tool] || tool;
	},

	/* ---- localStorage (every call can throw: private mode, quota, blocked storage) ---- */
	key: (tool, id) => STORE_PREFIX + tool + ':' + id,

	list(tool) {
		const out = [];
		const pre = STORE_PREFIX + tool + ':';
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (!k || !k.startsWith(pre)) continue;
			try {
				const f = HT.files.parse(localStorage.getItem(k), tool);
				out.push(f);
			} catch (err) {
				console.warn('Skipping unreadable save', k, err);
			}
		}
		return out.sort((a, b) => String(b.meta.modified).localeCompare(String(a.meta.modified)));
	},

	read(tool, id) {
		const raw = localStorage.getItem(HT.files.key(tool, id));
		return raw ? HT.files.parse(raw, tool) : null;
	},

	write(file) {
		localStorage.setItem(HT.files.key(file.tool, file.id), JSON.stringify(file));
	},

	remove(tool, id) {
		localStorage.removeItem(HT.files.key(tool, id));
	},

	/* ---- files on disk: name.fbd.json etc. ---- */
	download(file) {
		const safe = (file.meta.title || 'figure').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'figure';
		const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `${safe}.${file.tool}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	},

	readUpload(blob, tool) {
		return blob.text().then((t) => HT.files.parse(t, tool));
	}
};

/* ------------------------------------------------------------------ */
/* Page document: each figure page registers how to save and load      */
/* ------------------------------------------------------------------ */

/*  HT.registerDoc({ tool, serialize() -> {data, view}, load(file), reset(), defaultTitle() })  */
HT.registerDoc = function (spec) {
	HT.docSpec = spec;
	HT.doc = null; // the envelope this page was last saved to / loaded from
	HT.actions.saveData = () => openSaveDialog();
	HT.actions.loadData = () => openLoadDialog();
	HT.actions.refreshAllData = () => {
		HT.doc = null;
		spec.reset();
	};
};

HT.loadFile = function (file) {
	HT.docSpec.load(file);
	HT.doc = file;
};

function fmtDate(iso) {
	const d = new Date(iso);
	return isNaN(d) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/* Small modal built on <dialog>; returns { dlg, setMessage, close } */
function modal(title, body, footer) {
	const msg = HT.el('p', { class: 'ht-dialog-msg', role: 'status' });
	const dlg = HT.el(
		'dialog',
		{ class: 'ht-dialog' },
		HT.el('h2', { text: title }),
		body,
		msg,
		HT.el('div', { class: 'ht-dialog-footer' }, footer)
	);
	dlg.addEventListener('close', () => dlg.remove());
	dlg.addEventListener('click', (e) => {
		if (e.target === dlg) dlg.close(); // backdrop
	});
	document.body.appendChild(dlg);
	dlg.showModal();
	return {
		dlg,
		close: () => dlg.close(),
		setMessage(text, isError = true) {
			msg.textContent = text;
			msg.classList.toggle('error', isError);
		}
	};
}

function openSaveDialog() {
	const spec = HT.docSpec;
	const cur = HT.doc;
	const name = HT.el('input', {
		type: 'text',
		class: 'ht-input',
		value: cur ? cur.meta.title : spec.defaultTitle(),
		'aria-label': 'Name'
	});
	const body = HT.el('label', { class: 'ht-field' }, HT.el('span', { text: 'Name' }), name);

	const build = (prev) => HT.files.wrap(spec.tool, { title: name.value.trim(), ...spec.serialize() }, prev);
	const save = (prev) => {
		try {
			const file = build(prev);
			HT.files.write(file);
			HT.doc = file;
			m.close();
		} catch (err) {
			console.error(err);
			m.setMessage(
				err && err.name === 'QuotaExceededError'
					? 'Browser storage is full. Delete some saves or download a file instead.'
					: 'This browser blocked saving (private window or storage turned off). Download a file instead.'
			);
		}
	};

	const footer = [
		HT.el('button', { type: 'button', class: 'btn btn-light btn-xs', text: 'Download file', onclick: () => HT.files.download(build(cur)) }),
		HT.el('span', { class: 'ht-spacer' }),
		HT.el('button', { type: 'button', class: 'btn btn-light btn-xs', text: 'Cancel', onclick: () => m.close() })
	];
	if (cur) {
		footer.push(HT.el('button', { type: 'button', class: 'btn btn-light btn-xs', text: 'Save as new', onclick: () => save(null) }));
		footer.push(HT.el('button', { type: 'button', class: 'btn btn-blue btn-xs', text: 'Save', onclick: () => save(cur) }));
	} else {
		footer.push(HT.el('button', { type: 'button', class: 'btn btn-blue btn-xs', text: 'Save', onclick: () => save(null) }));
	}
	const m = modal('Save ' + HT.files.toolName(spec.tool), body, footer);
	name.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') save(cur);
	});
	name.select();
}

function openLoadDialog() {
	const spec = HT.docSpec;
	const listBox = HT.el('ul', { class: 'ht-save-list' });
	const fileInput = HT.el('input', { type: 'file', accept: '.json,application/json', hidden: true });

	const open = (file) => {
		try {
			HT.loadFile(file);
			m.close();
		} catch (err) {
			console.error(err);
			m.setMessage('Could not open that figure: ' + err.message);
		}
	};

	const render = () => {
		let saves = [];
		try {
			saves = HT.files.list(spec.tool);
		} catch (err) {
			console.error(err);
			m.setMessage('This browser blocked reading saved figures.');
		}
		listBox.replaceChildren();
		if (!saves.length) listBox.appendChild(HT.el('li', { class: 'ht-save-empty', text: 'No saved figures yet.' }));
		for (const f of saves) {
			const del = HT.el('button', { type: 'button', class: 'btn btn-light btn-xs', text: 'Delete' });
			del.addEventListener('click', () => {
				if (del.dataset.armed) {
					try {
						HT.files.remove(spec.tool, f.id);
						if (HT.doc && HT.doc.id === f.id) HT.doc = null;
					} catch (err) {
						console.error(err);
					}
					render();
				} else {
					del.dataset.armed = '1';
					del.textContent = 'Confirm delete';
					del.classList.add('btn-red');
				}
			});
			listBox.appendChild(
				HT.el(
					'li',
					null,
					HT.el('div', { class: 'ht-save-info' }, HT.el('strong', { text: f.meta.title }), HT.el('small', { text: fmtDate(f.meta.modified) })),
					del,
					HT.el('button', { type: 'button', class: 'btn btn-blue btn-xs', text: 'Open', onclick: () => open(f) })
				)
			);
		}
	};

	fileInput.addEventListener('change', () => {
		const blob = fileInput.files[0];
		if (!blob) return;
		HT.files
			.readUpload(blob, spec.tool)
			.then(open)
			.catch((err) => m.setMessage(err.message));
	});

	const m = modal('Open ' + HT.files.toolName(spec.tool), HT.el('div', null, listBox, fileInput), [
		HT.el('button', { type: 'button', class: 'btn btn-light btn-xs', text: 'Open file…', onclick: () => fileInput.click() }),
		HT.el('span', { class: 'ht-spacer' }),
		HT.el('button', { type: 'button', class: 'btn btn-light btn-xs', text: 'Close', onclick: () => m.close() })
	]);
	render();
}

/* ------------------------------------------------------------------ */
/* Grid size + origin controls (shared by the figure tools)            */
/*   A grid is described by its extent along each axis, in cells:      */
/*   { x: { min, max }, y: { min, max } } with min <= 0 <= max, so the */
/*   origin is always on the grid. numCells = max - min, origin = -min. */
/* ------------------------------------------------------------------ */

HT.gridFromRange = function (r) {
	return {
		numCells: { x: r.x.max - r.x.min, y: r.y.max - r.y.min },
		origin: { x: -r.x.min, y: -r.y.min }
	};
};

/* Clean a saved extent: whole numbers, origin inside, size within limits */
HT.cleanAxisRange = function (a, fallback, { minCells = 1, maxCells = 30 } = {}) {
	const int = (v, d) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);
	let min = Math.min(0, int(a && a.min, fallback.min));
	let max = Math.max(0, int(a && a.max, fallback.max));
	while (max - min > maxCells) max > -min ? max-- : min++;
	while (max - min < minCells) max - 0 <= -min ? max++ : min--;
	return { min: min + 0, max: max + 0 };
};

/*
 * HT.gridControls({ axes, get, set, limits, names })
 *   axes:   which axes get controls, e.g. ['x', 'y'] or ['x']
 *   get():  returns the current { x: {min,max}, y: {min,max} } (only the listed axes are read)
 *   set(r): called with a new extent for one axis: set('x', { min, max })
 *   limits: { x: { minCells, maxCells }, y: … }
 *   names:  labels shown before each axis's buttons, e.g. { x: 'x', y: 'y' }
 * Returns { el, refresh() }. The row is hidden unless element controls are on.
 *
 *   −/+  remove or add a grid cell. An origin on an edge stays on that edge; otherwise
 *        cells go on the shorter side and come off the longer side, so a centred grid stays centred.
 *   arrows move the origin (and the axes through it) one cell across the grid.
 */
HT.gridControls = function ({ axes = ['x', 'y'], get, set, limits = {}, names = {} }) {
	const rows = {};
	const lim = (ax) => ({ minCells: 1, maxCells: 30, ...(limits[ax] || {}) });

	const change = (ax, fn) => {
		const r = get()[ax];
		const next = fn({ ...r });
		if (!next || (next.min === r.min && next.max === r.max)) return;
		set(ax, next);
		refresh();
	};
	/* An origin on an edge stays there: cells come and go at the far end.
	   Otherwise cells are added to the shorter side and removed from the longer side
	   (ties go to the positive side), so a centred grid stays centred. */
	const grow = (r, l) => {
		if (r.max - r.min >= l.maxCells) return null;
		if (r.max === 0) return { min: r.min - 1, max: r.max };
		if (r.min === 0 || -r.min >= r.max) return { min: r.min, max: r.max + 1 };
		return { min: r.min - 1, max: r.max };
	};
	const shrink = (r, l) => {
		if (r.max - r.min <= l.minCells) return null;
		if (r.max === 0) return { min: r.min + 1, max: r.max };
		if (r.min === 0 || r.max >= -r.min) return { min: r.min, max: r.max - 1 };
		return { min: r.min + 1, max: r.max };
	};
	// "toward min" moves the origin toward the low end of the grid (left / down)
	const shiftOrigin = (r, towardMin) => {
		if (towardMin) {
			if (r.min >= 0) return null;
			r.min++;
			r.max++;
		} else {
			if (r.max <= 0) return null;
			r.min--;
			r.max--;
		}
		return r;
	};

	const btn = (text, label, onclick) => HT.el('button', { type: 'button', class: 'grid-btn', text, 'aria-label': label, title: label, onclick });

	const groups = axes.map((ax) => {
		const l = () => lim(ax);
		const vertical = ax === 'y';
		const count = HT.el('span', { class: 'grid-count' });
		const minus = btn('−', `Fewer ${ax} grid cells`, () => change(ax, (r) => shrink(r, l())));
		const plus = btn('+', `More ${ax} grid cells`, () => change(ax, (r) => grow(r, l())));
		const lo = btn(vertical ? '▼' : '◀', `Move the origin ${vertical ? 'down' : 'left'}`, () => change(ax, (r) => shiftOrigin(r, true)));
		const hi = btn(vertical ? '▲' : '▶', `Move the origin ${vertical ? 'up' : 'right'}`, () => change(ax, (r) => shiftOrigin(r, false)));
		rows[ax] = { count, minus, plus, lo, hi };
		return HT.el(
			'span',
			{ class: 'grid-group' },
			HT.el('span', { class: 'grid-name', text: names[ax] || ax }),
			minus,
			count,
			plus,
			HT.el('span', { class: 'grid-sep', 'aria-hidden': 'true' }),
			lo,
			hi
		);
	});

	function refresh() {
		const r = get();
		for (const ax of axes) {
			const a = r[ax];
			const l = lim(ax);
			const w = rows[ax];
			w.count.textContent = String(a.max - a.min);
			w.minus.disabled = a.max - a.min <= l.minCells;
			w.plus.disabled = a.max - a.min >= l.maxCells;
			w.lo.disabled = a.min >= 0;
			w.hi.disabled = a.max <= 0;
		}
	}

	const el = HT.el('div', { class: 'grid-ctrls ctrl-only', role: 'group', 'aria-label': 'Grid size and origin' }, groups);
	refresh();
	return { el, refresh };
};
