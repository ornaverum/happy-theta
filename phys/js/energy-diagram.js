/* Energy Diagram page */
'use strict';

(function () {
	const { el, button, Stage, GridLogic, drawGridLines, gridStageSize } = HT;

	/* One value scale for every card on the page, so bars can be compared across cards.
	   min/max = whole blocks to the left/right of zero (see HT.gridControls). */
	const DEFAULT_SCALE = { min: -5, max: 5 };
	const SCALE_LIMITS = { minCells: 2, maxCells: 30 };
	let scale = { ...DEFAULT_SCALE };

	class EnergyDiagram {
		constructor(data, { originY = 1, initCellSize = 20 } = {}) {
			this.data = data; // { id, title, data: { energyBars: EnergyBar[] } }
			this.originY = originY;
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

		get numCells() {
			return { x: scale.max - scale.min, y: this.bars.length };
		}

		get origin() {
			return { x: -scale.min, y: this.originY };
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
			s.x = Math.round(Math.min(Math.max(s.x, scale.min), scale.max));
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
			const left = g.getStageFromPoint({ x: scale.min, y: 0 }).x; // the grid's left edge
			this.stage.text(bar.symbol, left - 0.85 * cs, a.y - 0.8 * cs, {
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
	/* Bar metadata is fixed in code; files store only the whole-number value of each bar. */
	const STATE_BARS = [
		{ pos: 3, name: 'Kinetic Energy', symbol: 'K', color: 'blue' },
		{ pos: 2, name: 'Gravitational Potential Energy', symbol: 'Ug', color: 'green' },
		{ pos: 1, name: 'Elastic Potential Energy', symbol: 'Uel', color: 'yellow' },
		{ pos: 0, name: 'Thermal Energy', symbol: 'Eth', color: 'red' },
		{ pos: -1, name: 'Total Energy', symbol: 'E', color: 'purple' }
	];
	const TRANSFER_BARS = [{ pos: 0, name: 'Work', symbol: 'W', color: 'orange' }];
	const DEFAULT_VALUES = {
		state: { K: 1, Ug: 1, Uel: -1, Eth: 3, E: 2 },
		transfer: { W: 1 }
	};
	const list = el('ul', { class: 'figure-list' });
	let figs = [];
	const scaleCtrls = HT.gridControls({
		axes: ['x'],
		names: { x: 'Scale' },
		limits: { x: SCALE_LIMITS },
		get: () => ({ x: scale }),
		set: (ax, r) => {
			scale = r;
			figs.forEach((f) => f.layout());
		}
	});
	HT.capture.append(scaleCtrls.el);
	const addRow = el(
		'div',
		{ class: 'add-row' },
		button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Energy State', extra: 'w-full', onclick: () => add('state') }),
		button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Energy Transfer', onclick: () => add('transfer') })
	);
	HT.capture.append(list, addRow);

	let cards = []; // in-memory: { id, kind, title, data: { energyBars } }, in page order
	let idInd = 0;

	function add(kind, values, id, title) {
		const bars = (kind === 'state' ? STATE_BARS : TRANSFER_BARS).map((b) => {
			const v = values && Number.isFinite(Number(values[b.symbol])) ? Number(values[b.symbol]) : DEFAULT_VALUES[kind][b.symbol];
			return { ...b, value: Math.max(scale.min, Math.min(scale.max, Math.round(v))) };
		});
		const data = { id: id || 'e' + idInd++, kind, title: title || 'Title', data: { energyBars: bars } };
		cards.push(data);
		// a transfer has a single row, so its origin sits on the grid's bottom edge
		const fig = new EnergyDiagram(data, kind === 'transfer' ? { originY: 0 } : undefined);
		figs.push(fig);
		list.appendChild(el('li', null, fig.root));
	}

	function clearPage() {
		cards = [];
		figs = [];
		idInd = 0;
		list.replaceChildren();
	}

	const values = (c) => Object.fromEntries(c.data.energyBars.map((b) => [b.symbol, b.value]));

	/*
	 * Saved form:
	 *   data.stores    = the bar symbols a state shows, top to bottom
	 *   data.sequence  = cards in page order:
	 *     { id, kind: 'state', values: { K, Ug, Uel, Eth, E } }   or   { id, kind: 'transfer', values: { W } }
	 *   data.scale     = { min, max }: the value range every card shows, in whole blocks (default -5 to 5)
	 *   Values are whole blocks within the scale.
	 */
	HT.registerDoc({
		tool: 'energy',
		defaultTitle: () => 'Energy diagram',
		serialize: () => ({
			data: {
				scale: { ...scale },
				stores: STATE_BARS.map((b) => b.symbol),
				sequence: cards.map((c) => ({ id: c.id, kind: c.kind, values: values(c) }))
			},
			view: {}
		}),
		load(file) {
			const seq = Array.isArray(file.data.sequence) ? file.data.sequence : [];
			scale = HT.cleanAxisRange(file.data.scale, DEFAULT_SCALE, SCALE_LIMITS);
			scaleCtrls.refresh();
			clearPage();
			seq.forEach((c, i) => {
				const kind = c.kind === 'transfer' ? 'transfer' : 'state';
				add(kind, c.values || {}, c.id == null ? 'e' + i : String(c.id));
			});
			idInd = cards.reduce((m, c) => Math.max(m, (parseInt(c.id.slice(1), 10) || 0) + 1), cards.length);
			if (!cards.length) add('state');
		},
		reset() {
			scale = { ...DEFAULT_SCALE };
			scaleCtrls.refresh();
			clearPage();
			add('state');
		}
	});

	add('state');
})();
