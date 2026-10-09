/* Energy Diagram page */
'use strict';

(function () {
	const { el, button, Stage, GridLogic, drawGridLines, gridStageSize } = HT;

	class EnergyDiagram {
		constructor(data, { origin = { x: 5, y: 1 }, initCellSize = 20 } = {}) {
			this.data = data; // { id, title, data: { energyBars: EnergyBar[] } }
			this.numCells = { x: 10, y: this.bars.length };
			this.origin = origin;
			this.initCellSize = initCellSize;
			this.onStage = false;
			this.preview = { pos: undefined, value: 0, color: 'purple', opacity: 0.3 };
			this.build();
			this.layout();
			this.offResize = HT.onResize(() => (this.root.isConnected ? this.layout() : this.offResize()));
		}

		get bars() {
			return this.data.data.energyBars;
		}

		build() {
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
				click: (p) => this.handleClick(p)
			});
			this.root = el('div', { class: 'panel center' }, el('div', { class: 'energy-title', text: 'Energy Diagram' }), stageBox);
		}

		layout() {
			const { size, cellSize } = gridStageSize(this.numCells, this.initCellSize);
			this.grid = new GridLogic({ numCells: { ...this.numCells }, origin: { ...this.origin }, cellSize });
			this.stage.resize(size.x, size.y);
			// row anchor for each bar: stage position of (0, pos), nudged down 1px
			this.rowPos = {};
			for (const b of this.bars) {
				const p = this.grid.getStageFromPoint({ x: 0, y: b.pos });
				this.rowPos[b.pos] = { x: p.x, y: p.y + 1 };
			}
			this.draw();
		}

		snap(p) {
			const s = this.grid.getPointFromStage(p);
			s.y = Math.floor(s.y);
			s.x = Math.round(Math.min(Math.max(s.x, -5), 5));
			return s;
		}

		handleClick(p) {
			const s = this.snap(p);
			const bar = this.bars.find((b) => b.pos === s.y);
			if (bar) {
				bar.value = s.x;
				this.draw();
			}
		}

		handleMove(p) {
			const s = this.snap(p);
			const bar = this.bars.find((b) => b.pos == s.y);
			if (!bar) return;
			this.preview.pos = bar.pos;
			this.preview.value = s.x;
			this.preview.color = bar.color;
			this.draw();
		}

		drawBar(bar) {
			const a = this.rowPos[bar.pos];
			if (!a) return;
			const cs = this.grid.cellSize;
			const v = bar.value;
			const x = v === 0 ? a.x - 5 : v >= 0 ? a.x : a.x + v * cs;
			const w = v === 0 ? 10 : Math.abs(v) * cs;
			this.stage.rect(x, a.y - 0.9 * cs, w, (0.7 * cs) | 0, {
				fill: bar.color,
				stroke: '#445544',
				strokeWidth: 1,
				opacity: bar.opacity || 0.7
			});
		}

		drawLabel(bar) {
			const a = this.rowPos[bar.pos];
			if (!a) return;
			const g = this.grid;
			const cs = g.cellSize;
			this.stage.text(bar.symbol, a.x - ((g.numCells.x + 1.7) / 2) * cs, a.y - 0.8 * cs, {
				fontSize: 0.5 * cs,
				fill: bar.color,
				stroke: 'black',
				strokeWidth: 0.5
			});
		}

		draw() {
			const s = this.stage;
			s.clear();
			drawGridLines(s, this.grid);
			this.bars.forEach((b) => this.drawLabel(b));
			this.bars.forEach((b) => this.drawBar(b));
			if (this.onStage && this.preview.pos !== undefined) this.drawBar(this.preview);
		}
	}

	/* ---------------- page ---------------- */
	const defaultED = {
		title: 'Title',
		data: {
			energyBars: [
				{ pos: 3, name: 'Kinetic Energy', symbol: 'K', value: 1, color: 'blue' },
				{ pos: 2, name: 'Gravitational Potential Energy', symbol: 'Ug', value: 1, color: 'green' },
				{ pos: 1, name: 'Elastic Potential Energy', symbol: 'Uel', value: -1, color: 'yellow' },
				{ pos: 0, name: 'Thermal Energy', symbol: 'Eth', value: 3, color: 'red' },
				{ pos: -1, name: 'Total Energy', symbol: 'E', value: 2, color: 'purple' }
			]
		}
	};

	const defaultW = {
		title: 'Title',
		data: { energyBars: [{ pos: 0, name: 'Work', symbol: 'W', value: 1, color: 'orange' }] }
	};

	const list = el('ul', { class: 'figure-list' });
	const addRow = el(
		'div',
		{ class: 'add-row' },
		button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Energy State', extra: 'w-full', onclick: () => addNewED() }),
		button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Energy Transfer', onclick: () => addNewW() })
	);
	HT.capture.append(list, addRow);

	const engSets = { title: 'Title', type: 'energy-diagram', id: 0, instances: [] };
	let idInd = 0;

	function add(template, opts) {
		const data = { ...HT.clone(template), id: idInd++ };
		engSets.instances.push(data);
		list.appendChild(el('li', null, new EnergyDiagram(data, opts).root));
	}
	const addNewED = () => add(defaultED);
	// a transfer has a single row, so its origin sits on the grid's bottom edge
	const addNewW = () => add(defaultW, { origin: { x: 5, y: 0 } });

	HT.actions.saveData = () => console.log('saveData from energy-diagram page');
	HT.actions.loadData = () => console.log('loadData from energy-diagram page');
	HT.actions.refreshAllData = () => {
		engSets.instances = [];
		list.replaceChildren();
		addNewED();
	};

	addNewED();
})();
