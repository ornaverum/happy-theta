/* Motion Diagram page */
'use strict';

(function () {
	const { el, button, editLabel, Stage, GridLogic, drawGridLines, gridStageSize } = HT;

	const POS = { radius: 8, fill: 'blue', opacity: 1 };
	const VEL = { strokeWidth: 3, stroke: 'green', fill: 'green', opacity: 1, pointerLength: 10, pointerWidth: 10 };

	class MotionDiagram {
		constructor(data, { numCells = { x: 10, y: 10 }, origin = { x: 5, y: 6 }, initCellSize = 20 } = {}) {
			this.data = data; // { id, title, data: { posList, accList } }
			this.numCells = numCells;
			this.origin = origin;
			this.initCellSize = initCellSize;
			this.onStage = false;
			this.preview = null; // { pt: grid point, shift: {x,y} px }
			this.build();
			this.layout();
			this.offResize = HT.onResize(() => (this.root.isConnected ? this.layout() : this.offResize()));
		}

		get posList() {
			return this.data.data.posList;
		}

		/* Positions are stored as grid points (+ a pixel nudge used only by 1D diagrams) */
		toStage(p) {
			const s = this.grid.getStageFromPoint(p.pt);
			return { x: s.x + p.shift.x, y: s.y + p.shift.y };
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
				move: (p) => this.handleMove(p),
				click: () => this.addPosition()
			});
			this.root = el(
				'main',
				{ class: 'panel center square pad' },
				title.el,
				el('div', { style: { display: 'flex' } }, el('div', { class: 'stage-container' }, stageBox))
			);
		}

		layout() {
			const { size, cellSize } = gridStageSize(this.numCells, this.initCellSize);
			this.grid = new GridLogic({ numCells: { ...this.numCells }, origin: { ...this.origin }, cellSize });
			this.stage.resize(size.x, size.y);
			this.draw();
		}

		/* 1D diagrams: nudge dots so repeated/reversed positions don't overlap */
		shiftPoint(pt, prior, prePrior) {
			const n = this.numCells;
			if (n.y > 0 && n.x > 0) return pt;
			if (!prior) return pt;
			const np = { ...pt };
			const dV = { x: pt.x - prior.x, y: pt.y - prior.y };
			np.y = prior.y;
			if (n.y == 0 && dV.x == 0) np.y += 10;
			else if (n.x == 0 && dV.y == 0) np.x += 10;
			if (prePrior) {
				const dV2 = { x: prior.x - prePrior.x, y: prior.y - prePrior.y };
				if (n.y == 0 && Math.sign(dV.x) == -Math.sign(dV2.x)) np.y += 10;
				else if (n.x == 0 && Math.sign(dV.y) == -Math.sign(dV2.y)) np.x += 10;
			}
			return np;
		}

		handleMove(p) {
			const pt = this.grid.getSnappedPointFromStage(p);
			const base = this.grid.getStageFromPoint(pt);
			let s = base;
			if (this.numCells.y == 0 || this.numCells.x == 0) {
				const L = this.posList;
				const prior = L.length ? this.toStage(L[L.length - 1]) : null;
				const prePrior = L.length > 1 ? this.toStage(L[L.length - 2]) : null;
				s = this.shiftPoint(base, prior, prePrior);
			}
			this.preview = { pt, shift: { x: s.x - base.x, y: s.y - base.y } };
			this.draw();
		}

		addPosition() {
			if (!this.preview) return;
			this.posList.push(HT.clone(this.preview));
			this.draw();
		}

		draw() {
			const s = this.stage;
			const n = this.numCells;
			s.clear();
			drawGridLines(s, this.grid);
			const xs = this.posList.map((p) => this.toStage(p));
			for (const x of xs) s.circle(x.x, x.y, POS.radius, POS);
			for (let i = 1; i < xs.length; i++) {
				const a = xs[i - 1];
				const b = xs[i];
				if ((n.y == 0 && a.x == b.x) || (n.x == 0 && a.y == b.y)) continue;
				s.arrow(a.x, a.y, b.x, b.y, VEL);
			}
			if (this.onStage && this.preview) {
				const p = this.toStage(this.preview);
				s.circle(p.x, p.y, POS.radius, { ...POS, opacity: 0.5 });
			}
		}
	}

	/* ---------------- page ---------------- */
	const list = el('ul', { class: 'figure-list' });
	HT.capture.append(list, button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Diagram', extra: 'w-full', onclick: () => addDiagram() }));

	const GRID = { numCells: { x: 10, y: 10 }, origin: { x: 5, y: 6 } };
	let diagrams = []; // in-memory: { id, title, data: { posList: [{ pt, shift }], accList } }
	let idInd = 0;

	function addDiagram(data) {
		if (!data) data = { id: 'm' + idInd++, title: 'Title', data: { posList: [], accList: [] } };
		diagrams.push(data);
		list.appendChild(el('li', null, new MotionDiagram(data, HT.clone(GRID)).root));
	}

	function clearPage() {
		diagrams = [];
		idInd = 0;
		list.replaceChildren();
	}

	const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
	const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

	/*
	 * Saved form:
	 *   data.diagrams[] = { id, title, dims, dt, dots: [{ x, y }] }   integer grid positions, in time order
	 *   view.diagrams[] = { id, shifts: [[px, py]] }                  pixel nudges that keep 1D dots from overlapping
	 */
	HT.registerDoc({
		tool: 'motion',
		defaultTitle: () => (diagrams[0] && diagrams[0].title !== 'Title' ? diagrams[0].title : 'Motion diagram'),
		serialize: () => {
			const n = GRID.numCells;
			const dims = n.x > 0 && n.y > 0 ? 2 : 1;
			return {
				data: {
					diagrams: diagrams.map((d) => ({
						id: d.id,
						title: d.title,
						dims,
						dt: 1,
						dots: d.data.posList.map((p) => (dims === 2 ? { x: p.pt.x, y: p.pt.y } : n.y == 0 ? { x: p.pt.x } : { y: p.pt.y }))
					}))
				},
				view: {
					grid: HT.clone(GRID),
					diagrams: diagrams.map((d) => ({ id: d.id, shifts: d.data.posList.map((p) => [p.shift.x, p.shift.y]) }))
				}
			};
		},
		load(file) {
			const saved = Array.isArray(file.data.diagrams) ? file.data.diagrams : [];
			const views = (file.view && Array.isArray(file.view.diagrams) ? file.view.diagrams : []);
			clearPage();
			saved.forEach((d, i) => {
				const id = d.id == null ? 'm' + i : String(d.id);
				const v = views.find((x) => x.id === id) || views[i] || {};
				const shifts = Array.isArray(v.shifts) ? v.shifts : [];
				const dots = Array.isArray(d.dots) ? d.dots : [];
				addDiagram({
					id,
					title: d.title == null ? 'Title' : String(d.title),
					data: {
						posList: dots.map((p, j) => ({
							pt: { x: int(p.x), y: int(p.y) },
							shift: { x: num(shifts[j] && shifts[j][0]), y: num(shifts[j] && shifts[j][1]) }
						})),
						accList: []
					}
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
