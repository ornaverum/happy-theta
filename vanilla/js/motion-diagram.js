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
	HT.capture.append(list, button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Diagram', extra: 'w-full', onclick: () => addNewMD() }));

	const mdSets = { title: 'Title', type: 'motion-diagram', id: 0, instances: [] };
	let idInd = 0;

	function addNewMD() {
		const data = { id: idInd++, title: 'Title', data: { posList: [], accList: [] } };
		mdSets.instances.push(data);
		list.appendChild(el('li', null, new MotionDiagram(data).root));
	}

	HT.actions.saveData = () => console.log('saveData from motion-diagram page');
	HT.actions.loadData = () => console.log('loadData from motion-diagram page');
	HT.actions.refreshAllData = () => {
		mdSets.instances = [];
		list.replaceChildren();
		addNewMD();
	};

	addNewMD();
})();
