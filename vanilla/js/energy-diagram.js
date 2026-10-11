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
	const MIN = -5;
	const MAX = 5;

	const list = el('ul', { class: 'figure-list' });
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
			return { ...b, value: Math.max(MIN, Math.min(MAX, Math.round(v))) };
		});
		const data = { id: id || 'e' + idInd++, kind, title: title || 'Title', data: { energyBars: bars } };
		cards.push(data);
		// a transfer has a single row, so its origin sits on the grid's bottom edge
		const opts = kind === 'transfer' ? { origin: { x: 5, y: 0 } } : undefined;
		list.appendChild(el('li', null, new EnergyDiagram(data, opts).root));
	}

	function clearPage() {
		cards = [];
		idInd = 0;
		list.replaceChildren();
	}

	const values = (c) => Object.fromEntries(c.data.energyBars.map((b) => [b.symbol, b.value]));

	/*
	 * Saved form:
	 *   data.stores    = the bar symbols a state shows, top to bottom
	 *   data.sequence  = cards in page order:
	 *     { id, kind: 'state', values: { K, Ug, Uel, Eth, E } }   or   { id, kind: 'transfer', values: { W } }
	 *   Values are whole blocks from -5 to 5.
	 */
	HT.registerDoc({
		tool: 'energy',
		defaultTitle: () => 'Energy diagram',
		serialize: () => ({
			data: {
				stores: STATE_BARS.map((b) => b.symbol),
				sequence: cards.map((c) => ({ id: c.id, kind: c.kind, values: values(c) }))
			},
			view: {}
		}),
		load(file) {
			const seq = Array.isArray(file.data.sequence) ? file.data.sequence : [];
			clearPage();
			seq.forEach((c, i) => {
				const kind = c.kind === 'transfer' ? 'transfer' : 'state';
				add(kind, c.values || {}, c.id == null ? 'e' + i : String(c.id));
			});
			idInd = cards.reduce((m, c) => Math.max(m, (parseInt(c.id.slice(1), 10) || 0) + 1), cards.length);
			if (!cards.length) add('state');
		},
		reset() {
			clearPage();
			add('state');
		}
	});

	add('state');
})();
