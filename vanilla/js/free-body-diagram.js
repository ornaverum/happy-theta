/* Free Body Diagram page */
'use strict';

(function () {
	const { el, button, icon, editLabel, Stage, GridLogic, drawGridLines, gridStageSize } = HT;

	const COLORS = [
		{ bg: '#fbbf24', cc: '#fb923c' }, // amber-400
		{ bg: '#1d4ed8', cc: '#1d4ed8' }, // blue-700
		{ bg: '#dc2626', cc: '#dc2626' }, // red-600
		{ bg: '#14532d', cc: '#14532d' }, // green-900
		{ bg: '#6b21a8', cc: '#6d28d9' }, // purple-800
		{ bg: '#9a3412', cc: '#9a3412' }, // orange-800
		{ bg: '#059669', cc: '#059669' }, // emerald-600
		{ bg: '#67e8f9', cc: '#6ee7b7' }, // cyan-300
		{ bg: '#e11d48', cc: '#ec4899' }, // rose-600
		{ bg: '#7c3aed', cc: '#7c3aed' }, // violet-600
		{ bg: '#a3e635', cc: '#a3e635' }, // lime-400
		{ bg: '#c026d3', cc: '#d946ef' } // fuchsia-600
	];

	/* Fixed list so answers can be matched exactly when grading */
	const FORCE_TYPES = [
		['gravitational', 'Gravitational'],
		['normal', 'Normal'],
		['tension', 'Tension'],
		['friction-kinetic', 'Kinetic friction'],
		['friction-static', 'Static friction'],
		['applied', 'Applied'],
		['spring', 'Spring'],
		['air-resistance', 'Air resistance'],
		['buoyant', 'Buoyant'],
		['electric', 'Electric'],
		['magnetic', 'Magnetic']
	];
	const TYPE_NAME = Object.fromEntries(FORCE_TYPES);

	const ARROW = { strokeWidth: 3, pointerLength: 10, pointerWidth: 10 };
	const DEG = Math.PI / 180;

	/* The three layouts. A 1D grid has zero cells across, so it draws as a single number line. */
	const MODES = {
		'2d': { label: '2D' },
		horizontal: { label: '1D horizontal' },
		vertical: { label: '1D vertical' }
	};

	/* Grid extent in cells on each side of the origin (see HT.gridControls) */
	const DEFAULT_GRID = { x: { min: -5, max: 5 }, y: { min: -5, max: 5 } };
	const GRID_LIMITS = { x: { minCells: 2, maxCells: 24 }, y: { minCells: 2, maxCells: 24 } };
	const MODE_ORDER = ['2d', 'horizontal', 'vertical'];

	/* Arrows pointing the same way would lie on top of each other, so each extra one in the same
	   direction is nudged sideways by this fraction of a cell, alternating sides: 0, +1, -1, +2, -2 … */
	const OVERLAP_STEP = 0.3;
	const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
	const dirKey = (v) => {
		const g = gcd(v.dx, v.dy) || 1;
		return v.dx / g + ',' + v.dy / g;
	};
	function sideSlots(vectors) {
		const seen = new Map();
		return vectors.map((v) => {
			const k = dirKey(v);
			const n = seen.get(k) || 0;
			seen.set(k, n + 1);
			return n === 0 ? 0 : n % 2 ? (n + 1) / 2 : -n / 2;
		});
	}

	/* Force ids look like "f3"; the number picks the colour */
	const idNum = (id) => parseInt(String(id).slice(1), 10) || 0;
	const colorOf = (id) => COLORS[idNum(id) % 12];

	/*
	 * One diagram's data — exactly what is saved in the file:
	 *   { id, title, mode, grid, axes: { rotation }, forces: [{ id, type, label, agent, on, dx, dy }] }
	 * grid = { x: { min, max }, y: { min, max } }: how many cells the grid has on each side of the origin.
	 * mode is '2d', 'horizontal' or 'vertical'. In 1D every force lies on the line (dy = 0 or dx = 0).
	 * dx, dy are integer grid components in the diagram's own (possibly rotated) axes, +y up.
	 * rotation is in whole degrees, counterclockwise; it is only used in 2D.
	 */
	function newDiagramData(id, mode = '2d', grid = DEFAULT_GRID) {
		return { id, title: 'Title', mode, grid: HT.clone(grid), axes: { rotation: 0 }, forces: [] };
	}

	class FreeBodyDiagram {
		constructor(data, { initCellSize = 20 } = {}) {
			this.data = data;
			this.initCellSize = initCellSize;
			this.nextId = data.forces.reduce((m, f) => Math.max(m, idNum(f.id) + 1), 0);
			this.editing = new Set(); // force ids whose row is in edit mode (not saved)
			this.preview = { x: 0, y: 0 };
			this.onStage = false;
			this.build();
			this.layout();
			this.offResize = HT.onResize(() => (this.root.isConnected ? this.layout() : this.offResize()));
		}

		get forces() {
			return this.data.forces;
		}

		get mode() {
			return MODES[this.data.mode] ? this.data.mode : '2d';
		}

		/* The extent in use: a 1D line keeps only the axis along it */
		get range() {
			const g = this.data.grid;
			const none = { min: 0, max: 0 };
			if (this.mode === 'horizontal') return { x: g.x, y: none };
			if (this.mode === 'vertical') return { x: none, y: g.y };
			return g;
		}

		get numCells() {
			return HT.gridFromRange(this.range).numCells;
		}

		get origin() {
			return HT.gridFromRange(this.range).origin;
		}

		buildGridControls() {
			const axes = this.mode === 'horizontal' ? ['x'] : this.mode === 'vertical' ? ['y'] : ['x', 'y'];
			this.gridCtrls = HT.gridControls({
				axes,
				limits: GRID_LIMITS,
				get: () => this.data.grid,
				set: (ax, r) => {
					this.data.grid[ax] = r;
					this.layout();
				}
			});
			this.gridBox.replaceChildren(this.gridCtrls.el);
		}

		get rotation() {
			return this.mode === '2d' ? this.data.axes.rotation || 0 : 0;
		}

		get net() {
			let dx = 0;
			let dy = 0;
			for (const f of this.forces) {
				dx += f.dx;
				dy += f.dy;
			}
			return { dx, dy };
		}

		build() {
			const title = editLabel({ text: this.data.title, size: 'xl2', onchange: (t) => (this.data.title = t) });

			const stageBox = el('div', { class: 'stage-container' });
			this.stage = new Stage(stageBox);
			this.stage.on({
				enter: () => {
					this.onStage = true;
					this.draw();
				},
				leave: () => {
					this.onStage = false;
					this.draw();
				},
				move: (p) => {
					this.preview = this.snap(p);
					this.draw();
				},
				click: () => this.addForce()
			});

			/* Axis rotation (for inclines). Arrows keep their components, so they turn with the axes. */
			this.rotOut = el('output');
			this.rotInput = el('input', {
				type: 'range',
				min: -90,
				max: 90,
				step: 1,
				value: this.rotation,
				'aria-label': 'Axis rotation in degrees',
				oninput: (e) => this.setRotation(parseInt(e.target.value, 10))
			});
			const axesRow = el(
				'div',
				{ class: 'fbd-axes ctrl-only' },
				el('span', { text: 'Rotate axes' }),
				this.rotInput,
				this.rotOut,
				button({ cls: 'btn-light', text: 'Reset', extra: 'btn-xs', onclick: () => this.setRotation(0) })
			);
			this.axesRow = axesRow;
			this.paintRotation();

			this.modeBtns = MODE_ORDER.map((m) =>
				el('button', { type: 'button', class: 'btn btn-light btn-xs', text: MODES[m].label, 'aria-pressed': 'false', onclick: () => this.setMode(m) })
			);
			const modeRow = el('div', { class: 'fbd-modes ctrl-only', role: 'group', 'aria-label': 'Diagram type' }, this.modeBtns);
			this.paintModes();

			this.gridBox = el('div');
			this.buildGridControls();

			const left = (this.leftCol = el(
				'div',
				{ class: 'fbd-left' },
				el('div', { class: 'label-bold', text: 'Free Body Diagram' }),
				modeRow,
				stageBox,
				this.gridBox,
				axesRow
			));

			this.chart = el('div', { class: 'tao-chart' });
			this.root = el('main', { class: 'panel pad' }, title.el, el('div', { class: 'fbd-cols' }, left, this.chart));
			this.renderChart();
		}

		layout() {
			let { size, cellSize } = gridStageSize(this.numCells, this.initCellSize);
			// a wide 1D line must still fit beside the force chart
			const avail = this.leftCol.clientWidth - 32;
			if (avail > 0 && size.x > avail) {
				const f = avail / size.x;
				size = { x: size.x * f, y: size.y * f };
				cellSize *= f;
			}
			this.grid = new GridLogic({ numCells: { ...this.numCells }, origin: { ...this.origin }, cellSize });
			this.stage.resize(size.x, size.y);
			this.draw();
		}

		/* ---- layout mode ---- */

		paintModes() {
			MODE_ORDER.forEach((m, i) => {
				const on = m === this.mode;
				this.modeBtns[i].setAttribute('aria-pressed', String(on));
				this.modeBtns[i].classList.toggle('btn-blue', on);
				this.modeBtns[i].classList.toggle('btn-light', !on);
			});
			this.axesRow.hidden = this.mode !== '2d'; // rotating only makes sense in 2D
		}

		/* Switching to 1D keeps each force's part along the line; a force with nothing left is removed. */
		setMode(mode) {
			if (mode === this.mode) return;
			if (mode !== '2d') {
				this.data.forces = this.forces
					.map((f) => ({ ...f, dx: mode === 'vertical' ? 0 : f.dx, dy: mode === 'horizontal' ? 0 : f.dy }))
					.filter((f) => f.dx !== 0 || f.dy !== 0);
				this.data.axes.rotation = 0;
				for (const id of [...this.editing]) if (!this.forces.some((f) => f.id === id)) this.editing.delete(id);
			}
			this.data.mode = mode;
			this.preview = { x: 0, y: 0 };
			this.paintModes();
			this.paintRotation();
			this.buildGridControls();
			this.layout();
			this.renderChart();
		}

		/* ---- rotated axes ---- */

		setRotation(deg) {
			this.data.axes.rotation = Math.max(-90, Math.min(90, Math.round(deg) || 0));
			this.paintRotation();
			this.draw();
		}

		paintRotation() {
			this.rotInput.value = this.rotation;
			this.rotOut.textContent = this.rotation + '°';
		}

		/* Shrink the rotated grid so its corners stay on the canvas */
		fitScale() {
			const t = this.rotation * DEG;
			if (!t) return 1;
			const r = this.range;
			const c = Math.cos(t);
			const sn = Math.sin(t);
			// room from the origin to each canvas edge, in cells (the canvas has about 1 cell of margin)
			const room = { left: -r.x.min + 1, right: r.x.max + 1, down: -r.y.min + 1, up: r.y.max + 1 };
			let k = 1;
			for (const x of [r.x.min, r.x.max]) {
				for (const y of [r.y.min, r.y.max]) {
					const rx = x * c - y * sn;
					const ry = x * sn + y * c;
					if (rx > 0) k = Math.min(k, room.right / rx);
					if (rx < 0) k = Math.min(k, room.left / -rx);
					if (ry > 0) k = Math.min(k, room.up / ry);
					if (ry < 0) k = Math.min(k, room.down / -ry);
				}
			}
			return k;
		}

		/* Apply the axis rotation (counterclockwise on screen) about the origin */
		withAxes(fn) {
			const c = this.stage.ctx;
			const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
			const k = this.fitScale();
			c.save();
			c.translate(o.x, o.y);
			c.rotate(-this.rotation * DEG); // canvas y points down, so negative = counterclockwise
			c.scale(k, k);
			c.translate(-o.x, -o.y);
			fn();
			c.restore();
		}

		/* Grid-frame stage point -> where it lands on screen once the axes are rotated (inverse of snap's first step) */
		toScreen(q) {
			const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
			const t = this.rotation * DEG;
			const k = this.fitScale();
			const vx = q.x - o.x;
			const vy = q.y - o.y;
			return { x: o.x + k * (vx * Math.cos(t) + vy * Math.sin(t)), y: o.y + k * (-vx * Math.sin(t) + vy * Math.cos(t)) };
		}

		/* Pointer (stage px) -> nearest grid point in the rotated axes */
		snap(p) {
			const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
			const t = this.rotation * DEG;
			const k = this.fitScale();
			const vx = (p.x - o.x) / k;
			const vy = (p.y - o.y) / k;
			const q = { x: o.x + vx * Math.cos(t) - vy * Math.sin(t), y: o.y + vx * Math.sin(t) + vy * Math.cos(t) };
			const pt = this.grid.getSnappedPointFromStage(q);
			const max = this.numCells.x - this.origin.x;
			const min = -this.origin.x;
			const maxY = this.numCells.y - this.origin.y;
			const minY = -this.origin.y;
			// + 0 turns -0 into 0
			return { x: Math.max(min, Math.min(max, pt.x)) + 0, y: Math.max(minY, Math.min(maxY, pt.y)) + 0 };
		}

		/* ---- drawing ---- */

		/* slot = how many steps to nudge the arrow sideways (see sideSlots) */
		drawForce(v, { opacity, color, strokeWidth }, slot = 0) {
			const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
			const p = this.grid.getStageFromPoint({ x: v.dx, y: v.dy });
			let ox = 0;
			let oy = 0;
			if (slot) {
				const len = Math.hypot(p.x - o.x, p.y - o.y) || 1;
				const d = slot * OVERLAP_STEP * this.grid.cellSize;
				ox = (-(p.y - o.y) / len) * d; // perpendicular to the arrow
				oy = ((p.x - o.x) / len) * d;
			}
			this.stage.arrow(o.x + ox, o.y + oy, p.x + ox, p.y + oy, { ...ARROW, opacity, fill: color, stroke: color, strokeWidth });
		}

		draw() {
			const s = this.stage;
			s.clear();
			const net = this.net;
			const preview = { dx: this.preview.x, dy: this.preview.y };
			const showPreview = this.onStage && (preview.dx || preview.dy);
			// the preview goes last so existing arrows never move while the mouse does
			const slots = sideSlots(showPreview ? [...this.forces, preview] : this.forces);
			this.withAxes(() => {
				drawGridLines(s, this.grid);
				this.forces.forEach((f, i) => this.drawForce(f, { opacity: 1, color: colorOf(f.id).cc, strokeWidth: 3 }, slots[i]));
				if (showPreview) {
					this.drawForce(preview, { opacity: 0.5, color: COLORS[this.nextId % 12].cc, strokeWidth: 3 }, slots[this.forces.length]);
				}
				if (net.dx == 0 && net.dy == 0) {
					const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
					s.circle(o.x, o.y, 8, { fill: 'black' });
				} else {
					this.drawForce(net, { opacity: 0.5, color: 'black', strokeWidth: 6 });
				}
			});
			// labels turn with the axes but stay upright
			HT.drawAxisLabels(s, this.grid, { map: (q) => this.toScreen(q) });
		}

		/* ---- editing ---- */

		addForce() {
			if (this.preview.x === 0 && this.preview.y === 0) return; // a zero-length arrow isn't a force
			this.forces.push({ id: 'f' + this.nextId++, type: '', label: 'F', agent: '', on: '', dx: this.preview.x, dy: this.preview.y });
			this.update();
		}

		deleteForce(id) {
			this.data.forces = this.forces.filter((f) => f.id !== id);
			this.editing.delete(id);
			this.update();
		}

		update() {
			this.draw();
			this.renderChart();
		}

		renderChart() {
			const c = this.chart;
			c.replaceChildren(el('div', { class: 'tao-chart-title' }, el('p', { text: 'Type/Agent/Object Chart' })));

			if (this.forces.length == 0) {
				c.appendChild(
					el('div', { class: 'tao-empty' }, el('p', { text: 'No Forces Yet' }), el('p', { text: 'Add a force by clicking on the FBD' }))
				);
			} else {
				c.appendChild(
					el(
						'div',
						{ class: 'tao-row', style: { fontWeight: '700' } },
						el('p'),
						el('p', { style: { margin: '0 auto' }, text: 'Symbol' }),
						el('p', { style: { margin: '0 auto' }, text: 'Type' }),
						el('p', { style: { margin: '0 auto' }, text: 'Agent' }),
						el('p', { style: { margin: '0 auto' }, text: 'Object' }),
						el('p')
					)
				);
			}

			const items = el('div');
			for (const force of this.forces) items.appendChild(this.taoRow(force));

			items.appendChild(el('div', { class: 'hr-label' }, el('hr'), el('span', { text: '=' })));
			const net = this.net;
			const zero = net.dx == 0 && net.dy == 0;
			items.appendChild(el('div', { class: 'net-force' }, el('div', { text: 'Net Force' + (zero ? ' = 0' : '') })));
			c.appendChild(items);
		}

		taoRow(force) {
			const editing = this.editing.has(force.id);
			const toggle = (on) => {
				if (on) this.editing.add(force.id);
				else this.editing.delete(force.id);
				this.renderChart();
			};
			const editBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Edit force', onclick: () => toggle(!editing) }, icon('edit'));
			const delBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Delete force', onclick: () => this.deleteForce(force.id) }, icon('trash'));
			const done = (e) => {
				if (e.key === 'Enter') toggle(false);
			};

			let cells;
			if (editing) {
				const text = (k, ph) => el('input', { value: force[k], placeholder: ph, oninput: (e) => (force[k] = e.target.value), onkeydown: done });
				const type = el(
					'select',
					{ 'aria-label': 'Force type', onchange: (e) => (force.type = e.target.value), onkeydown: done },
					el('option', { value: '', text: 'Type…' }),
					FORCE_TYPES.map(([v, name]) => el('option', { value: v, text: name, selected: force.type === v }))
				);
				cells = [text('label', 'Symbol'), type, text('agent', 'Agent'), text('on', 'Object')];
			} else {
				const show = (txt, ph) => el('div', { class: txt ? null : 'placeholder', text: txt || ph, ondblclick: () => toggle(true) });
				cells = [show(force.label, 'symbol'), show(TYPE_NAME[force.type], 'type'), show(force.agent, 'agent'), show(force.on, 'object')];
			}
			return el('div', { class: 'tao-row', style: { background: colorOf(force.id).bg } }, editBtn, cells, delBtn);
		}
	}

	/* ---------------- page ---------------- */
	const list = el('ul', { class: 'figure-list fbd' });
	const addBtn = el(
		'div',
		{ style: { display: 'flex' } },
		button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Diagram', extra: 'w-full', onclick: () => addDiagram() })
	);
	HT.capture.append(list, addBtn);

	let diagrams = [];
	let idInd = 0;

	function addDiagram(data) {
		if (!data) {
			// new diagrams start in the same layout as the last one on the page
			const last = diagrams[diagrams.length - 1];
			data = newDiagramData('d' + idInd++, last && MODES[last.mode] ? last.mode : '2d', last ? last.grid : DEFAULT_GRID);
		}
		diagrams.push(data);
		const fig = new FreeBodyDiagram(data);
		list.appendChild(el('li', null, fig.root));
		fig.layout(); // again, now that the column has a width
	}

	function clearPage() {
		diagrams = [];
		idInd = 0;
		list.replaceChildren();
	}

	/* Read a saved diagram defensively: integers only, known fields only */
	function cleanDiagram(d, i) {
		const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
		const str = (v) => (v == null ? '' : String(v));
		const mode = MODES[d.mode] ? d.mode : '2d';
		return {
			id: str(d.id) || 'd' + i,
			title: str(d.title ?? 'Title'),
			mode,
			grid: {
				x: HT.cleanAxisRange(d.grid && d.grid.x, DEFAULT_GRID.x, GRID_LIMITS.x),
				y: HT.cleanAxisRange(d.grid && d.grid.y, DEFAULT_GRID.y, GRID_LIMITS.y)
			},
			axes: { rotation: mode === '2d' ? Math.max(-90, Math.min(90, int(d.axes && d.axes.rotation))) : 0 },
			forces: (Array.isArray(d.forces) ? d.forces : [])
				.map((f, j) => ({
					id: /^f\d+$/.test(f.id) ? f.id : 'f' + j,
					type: TYPE_NAME[f.type] ? f.type : '',
					label: str(f.label),
					agent: str(f.agent),
					on: str(f.on),
					dx: mode === 'vertical' ? 0 : int(f.dx),
					dy: mode === 'horizontal' ? 0 : int(f.dy)
				}))
				.filter((f) => f.dx !== 0 || f.dy !== 0)
		};
	}

	HT.registerDoc({
		tool: 'fbd',
		defaultTitle: () => (diagrams[0] && diagrams[0].title !== 'Title' ? diagrams[0].title : 'Free body diagram'),
		serialize: () => ({ data: { diagrams: HT.clone(diagrams) }, view: {} }),
		load(file) {
			const saved = Array.isArray(file.data.diagrams) ? file.data.diagrams : [];
			const clean = saved.map(cleanDiagram);
			clearPage();
			clean.forEach((d) => addDiagram(d));
			idInd = clean.reduce((m, d) => Math.max(m, (parseInt(d.id.slice(1), 10) || 0) + 1), clean.length);
			if (!clean.length) addDiagram();
		},
		reset() {
			clearPage();
			addDiagram();
		}
	});

	addDiagram();
})();
