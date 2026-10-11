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

	/* Force ids look like "f3"; the number picks the colour */
	const idNum = (id) => parseInt(String(id).slice(1), 10) || 0;
	const colorOf = (id) => COLORS[idNum(id) % 12];

	/*
	 * One diagram's data — exactly what is saved in the file:
	 *   { id, title, axes: { rotation }, forces: [{ id, type, label, agent, on, dx, dy }] }
	 * dx, dy are integer grid components in the diagram's own (possibly rotated) axes, +y up.
	 * rotation is in whole degrees, counterclockwise.
	 */
	function newDiagramData(id) {
		return { id, title: 'Title', axes: { rotation: 0 }, forces: [] };
	}

	class FreeBodyDiagram {
		constructor(data, { numCells = { x: 10, y: 10 }, origin = { x: 5, y: 5 }, initCellSize = 20 } = {}) {
			this.data = data;
			this.numCells = numCells;
			this.origin = origin;
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

		get rotation() {
			return this.data.axes.rotation || 0;
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
			this.paintRotation();

			const left = el('div', { class: 'fbd-left' }, el('div', { class: 'label-bold', text: 'Free Body Diagram' }), stageBox, axesRow);

			this.chart = el('div', { class: 'tao-chart' });
			this.root = el('main', { class: 'panel pad' }, title.el, el('div', { class: 'fbd-cols' }, left, this.chart));
			this.renderChart();
		}

		layout() {
			const { size, cellSize } = gridStageSize(this.numCells, this.initCellSize);
			this.grid = new GridLogic({ numCells: { ...this.numCells }, origin: { ...this.origin }, cellSize });
			this.stage.resize(size.x, size.y);
			this.draw();
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
			const n = Math.max(this.numCells.x, this.numCells.y);
			return Math.min(1, (n + 1) / (n * (Math.abs(Math.cos(t)) + Math.abs(Math.sin(t)))));
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
			return { x: Math.max(min, Math.min(max, pt.x)), y: Math.max(minY, Math.min(maxY, pt.y)) };
		}

		/* ---- drawing ---- */

		drawForce(v, { opacity, color, strokeWidth }) {
			const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
			const p = this.grid.getStageFromPoint({ x: v.dx, y: v.dy });
			this.stage.arrow(o.x, o.y, p.x, p.y, { ...ARROW, opacity, fill: color, stroke: color, strokeWidth });
		}

		draw() {
			const s = this.stage;
			s.clear();
			const net = this.net;
			this.withAxes(() => {
				drawGridLines(s, this.grid);
				if (this.onStage) {
					this.drawForce({ dx: this.preview.x, dy: this.preview.y }, { opacity: 0.5, color: COLORS[this.nextId % 12].cc, strokeWidth: 3 });
				}
				for (const f of this.forces) this.drawForce(f, { opacity: 1, color: colorOf(f.id).cc, strokeWidth: 3 });
				if (net.dx == 0 && net.dy == 0) {
					const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
					s.circle(o.x, o.y, 8, { fill: 'black' });
				} else {
					this.drawForce(net, { opacity: 0.5, color: 'black', strokeWidth: 6 });
				}
			});
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
		if (!data) data = newDiagramData('d' + idInd++);
		diagrams.push(data);
		list.appendChild(el('li', null, new FreeBodyDiagram(data).root));
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
		return {
			id: str(d.id) || 'd' + i,
			title: str(d.title ?? 'Title'),
			axes: { rotation: Math.max(-90, Math.min(90, int(d.axes && d.axes.rotation))) },
			forces: (Array.isArray(d.forces) ? d.forces : []).map((f, j) => ({
				id: /^f\d+$/.test(f.id) ? f.id : 'f' + j,
				type: TYPE_NAME[f.type] ? f.type : '',
				label: str(f.label),
				agent: str(f.agent),
				on: str(f.on),
				dx: int(f.dx),
				dy: int(f.dy)
			}))
		};
	}

	HT.registerDoc({
		tool: 'fbd',
		defaultTitle: () => (diagrams[0] && diagrams[0].title !== 'Title' ? diagrams[0].title : 'Free body diagram'),
		serialize: () => ({ data: { diagrams: HT.clone(diagrams) }, view: { grid: { numCells: { x: 10, y: 10 }, origin: { x: 5, y: 5 } } } }),
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
