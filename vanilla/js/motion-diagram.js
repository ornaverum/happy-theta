/* Motion Diagram page */
'use strict';

(function () {
	const { el, button, editLabel, Stage, GridLogic, drawGridLines, gridStageSize } = HT;

	const POS = { radius: 8, fill: 'blue', opacity: 1 };
	const VEL = { strokeWidth: 3, stroke: 'green', fill: 'green', opacity: 1, pointerLength: 10, pointerWidth: 10 };

	/* The three layouts. A 1D grid has zero cells across, so it draws as a single number line. */
	const MODES = {
		'2d': { label: '2D', numCells: { x: 10, y: 10 }, origin: { x: 5, y: 6 } },
		horizontal: { label: '1D horizontal', numCells: { x: 10, y: 0 }, origin: { x: 5, y: 0 } },
		vertical: { label: '1D vertical', numCells: { x: 0, y: 10 }, origin: { x: 0, y: 5 } }
	};
	const MODE_ORDER = ['2d', 'horizontal', 'vertical'];

	/* 1D dots step sideways by this fraction of a cell for each new lane */
	const LANE_STEP = 0.4;
	const EXTRA_ROOM = 1.5; // extra cells of canvas beside a 1D line, on the side the lanes stack
	const MAX_SPREAD = 2.2; // lanes squeeze together past this many cells from the line

	/*
	 * Lanes keep 1D dots from landing on top of each other.
	 * Dots start on the axis (lane 0). A dot moves to the next lane when the motion reverses
	 * or when it doesn't move. Within one lane the positions only ever increase or only decrease,
	 * so no two dots in a lane can overlap.
	 */
	function lanesFor(coords) {
		const lanes = [];
		let lane = 0;
		let lastDir = 0;
		coords.forEach((c, i) => {
			if (i > 0) {
				const dir = Math.sign(c - coords[i - 1]);
				if (dir === 0 || (lastDir !== 0 && dir !== lastDir)) lane++;
				if (dir !== 0) lastDir = dir;
			}
			lanes.push(lane);
		});
		return lanes;
	}

	class MotionDiagram {
		constructor(data, { initCellSize = 20 } = {}) {
			this.data = data; // { id, title, mode, dots: [{ x, y }] } — integer grid points
			this.initCellSize = initCellSize;
			this.onStage = false;
			this.preview = null; // grid point under the mouse
			this.build();
			this.layout();
			this.offResize = HT.onResize(() => (this.root.isConnected ? this.layout() : this.offResize()));
		}

		get mode() {
			return MODES[this.data.mode] ? this.data.mode : '2d';
		}

		get is1D() {
			return this.mode !== '2d';
		}

		/* the coordinate that matters in 1D */
		coord(pt) {
			return this.mode === 'vertical' ? pt.y : pt.x;
		}

		build() {
			const title = editLabel({ text: this.data.title, size: 'xl2', onchange: (t) => (this.data.title = t) });

			this.modeBtns = MODE_ORDER.map((m) =>
				el('button', {
					type: 'button',
					class: 'btn btn-light btn-xs',
					text: MODES[m].label,
					'aria-pressed': 'false',
					onclick: () => this.setMode(m)
				})
			);
			const modeRow = el('div', { class: 'md-modes ctrl-only', role: 'group', 'aria-label': 'Diagram type' }, this.modeBtns);

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
				move: (p) => this.handleMove(p),
				click: () => this.addPosition()
			});
			this.root = el(
				'main',
				{ class: 'panel center square pad' },
				title.el,
				modeRow,
				el('div', { style: { display: 'flex' } }, el('div', { class: 'stage-container' }, stageBox))
			);
			this.paintModes();
		}

		paintModes() {
			MODE_ORDER.forEach((m, i) => {
				const on = m === this.mode;
				this.modeBtns[i].setAttribute('aria-pressed', String(on));
				this.modeBtns[i].classList.toggle('btn-blue', on);
				this.modeBtns[i].classList.toggle('btn-light', !on);
			});
		}

		/* Switching keeps what it can: 1D horizontal keeps x, 1D vertical keeps y, 2D keeps both. */
		setMode(mode) {
			if (mode === this.mode) return;
			this.data.dots = this.data.dots.map((p) =>
				mode === 'horizontal' ? { x: p.x, y: 0 } : mode === 'vertical' ? { x: 0, y: p.y } : { x: p.x, y: p.y }
			);
			this.data.mode = mode;
			this.preview = null;
			this.paintModes();
			this.layout();
		}

		layout() {
			const m = MODES[this.mode];
			const { size, cellSize } = gridStageSize(m.numCells, this.initCellSize);
			this.grid = new GridLogic({ numCells: { ...m.numCells }, origin: { ...m.origin }, cellSize });
			// the grid draws from the top-left, so the extra room lands below (or right of) the line
			const extra = EXTRA_ROOM * cellSize;
			if (this.mode === 'horizontal') this.stage.resize(size.x, size.y + extra);
			else if (this.mode === 'vertical') this.stage.resize(size.x + extra, size.y);
			else this.stage.resize(size.x, size.y);
			this.draw();
		}

		/* Keep clicks on the grid (and on the line in 1D) */
		snap(p) {
			const m = MODES[this.mode];
			const pt = this.grid.getSnappedPointFromStage(p);
			const clamp = (v, axis) => Math.max(-m.origin[axis], Math.min(m.numCells[axis] - m.origin[axis], v));
			return { x: clamp(pt.x, 'x') + 0, y: clamp(pt.y, 'y') + 0 }; // + 0 turns -0 into 0
		}

		/* Stage pixel positions for a list of dots, with the 1D lane offsets applied */
		stagePoints(dots) {
			if (!this.is1D) return dots.map((p) => this.grid.getStageFromPoint(p));
			const lanes = lanesFor(dots.map((p) => this.coord(p)));
			const top = Math.max(0, ...lanes);
			const step = this.grid.cellSize * Math.min(LANE_STEP, top ? MAX_SPREAD / top : LANE_STEP);
			return dots.map((p, i) => {
				const s = this.grid.getStageFromPoint(p);
				// horizontal lines stack downward, vertical lines stack to the right
				return this.mode === 'horizontal' ? { x: s.x, y: s.y + lanes[i] * step } : { x: s.x + lanes[i] * step, y: s.y };
			});
		}

		handleMove(p) {
			this.preview = this.snap(p);
			this.draw();
		}

		addPosition() {
			if (!this.preview) return;
			this.data.dots.push({ ...this.preview });
			this.draw();
		}

		draw() {
			const s = this.stage;
			s.clear();
			drawGridLines(s, this.grid);
			const dots = this.data.dots;
			const showPreview = this.onStage && this.preview;
			// place the preview with the real dots so it shows the lane it would land in
			const xs = this.stagePoints(showPreview ? [...dots, this.preview] : dots);
			const n = dots.length;
			for (let i = 1; i < n; i++) {
				if (this.coord(dots[i]) === this.coord(dots[i - 1]) && (this.is1D || dots[i].y === dots[i - 1].y)) continue;
				s.arrow(xs[i - 1].x, xs[i - 1].y, xs[i].x, xs[i].y, VEL);
			}
			for (let i = 0; i < n; i++) s.circle(xs[i].x, xs[i].y, POS.radius, POS);
			if (showPreview) s.circle(xs[n].x, xs[n].y, POS.radius, { ...POS, opacity: 0.5 });
		}
	}

	/* ---------------- page ---------------- */
	const list = el('ul', { class: 'figure-list' });
	HT.capture.append(list, button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Diagram', extra: 'w-full', onclick: () => addDiagram() }));

	let diagrams = []; // { id, title, mode, dots }
	let idInd = 0;

	function addDiagram(data) {
		if (!data) {
			// new diagrams start in the same layout as the last one on the page
			const last = diagrams[diagrams.length - 1];
			data = { id: 'm' + idInd++, title: 'Title', mode: last ? last.mode : '2d', dots: [] };
		}
		diagrams.push(data);
		list.appendChild(el('li', null, new MotionDiagram(data).root));
	}

	function clearPage() {
		diagrams = [];
		idInd = 0;
		list.replaceChildren();
	}

	const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

	/*
	 * Saved form:
	 *   data.diagrams[] = { id, title, mode, dims, dt, dots }
	 *     mode: '2d' | 'horizontal' | 'vertical'; dims: 2 or 1
	 *     dots: integer grid positions in time order — { x, y } in 2D, { x } horizontal, { y } vertical
	 * The sideways offsets of 1D dots are worked out from the dots, so they are not saved.
	 */
	HT.registerDoc({
		tool: 'motion',
		defaultTitle: () => (diagrams[0] && diagrams[0].title !== 'Title' ? diagrams[0].title : 'Motion diagram'),
		serialize: () => ({
			data: {
				diagrams: diagrams.map((d) => ({
					id: d.id,
					title: d.title,
					mode: d.mode,
					dims: d.mode === '2d' ? 2 : 1,
					dt: 1,
					dots: d.dots.map((p) => (d.mode === 'horizontal' ? { x: p.x } : d.mode === 'vertical' ? { y: p.y } : { x: p.x, y: p.y }))
				}))
			},
			view: {}
		}),
		load(file) {
			const saved = Array.isArray(file.data.diagrams) ? file.data.diagrams : [];
			clearPage();
			saved.forEach((d, i) => {
				const mode = MODES[d.mode] ? d.mode : '2d';
				addDiagram({
					id: d.id == null ? 'm' + i : String(d.id),
					title: d.title == null ? 'Title' : String(d.title),
					mode,
					dots: (Array.isArray(d.dots) ? d.dots : []).map((p) => ({
						x: mode === 'vertical' ? 0 : int(p.x),
						y: mode === 'horizontal' ? 0 : int(p.y)
					}))
				});
			});
			idInd = diagrams.reduce((m, d) => Math.max(m, (parseInt(d.id.slice(1), 10) || 0) + 1), diagrams.length);
			if (!diagrams.length) addDiagram();
		},
		reset() {
			clearPage();
			addDiagram();
		}
	});

	addDiagram();
})();
