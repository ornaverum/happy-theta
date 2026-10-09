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

	const ARROW = { strokeWidth: 3, pointerLength: 10, pointerWidth: 10 };

	class FreeBodyDiagram {
		constructor(data, { numCells = { x: 10, y: 10 }, origin = { x: 5, y: 5 }, initCellSize = 20 } = {}) {
			this.data = data; // { id, title, data: { forceList } }
			this.numCells = numCells;
			this.origin = origin;
			this.initCellSize = initCellSize;
			this.nextId = 0;
			this.preview = { x: 0, y: 0 };
			this.onStage = false;
			this.net = { x: 0, y: 0 };
			this.build();
			this.layout();
			this.offResize = HT.onResize(() => (this.root.isConnected ? this.layout() : this.offResize()));
		}

		get forces() {
			return this.data.data.forceList;
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
					this.preview = this.grid.getSnappedPointFromStage(p);
					this.draw();
				},
				click: () => this.addForce()
			});

			const left = el('div', { class: 'fbd-left' }, el('div', { class: 'label-bold', text: 'Free Body Diagram' }), stageBox);

			this.chart = el('div', { class: 'tao-chart' });
			this.root = el(
				'main',
				{ class: 'panel pad' },
				title.el,
				el('div', { class: 'fbd-cols' }, left, this.chart)
			);
			this.renderChart();
		}

		layout() {
			const { size, cellSize } = gridStageSize(this.numCells, this.initCellSize);
			this.grid = new GridLogic({ numCells: { ...this.numCells }, origin: { ...this.origin }, cellSize });
			this.stage.resize(size.x, size.y);
			this.draw();
		}

		drawForce(comps, { opacity, color, strokeWidth }) {
			const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
			const p = this.grid.getStageFromPoint(comps);
			this.stage.arrow(o.x, o.y, p.x, p.y, { ...ARROW, opacity, fill: color, stroke: color, strokeWidth });
		}

		draw() {
			const s = this.stage;
			s.clear();
			drawGridLines(s, this.grid);
			if (this.onStage) {
				this.drawForce(this.preview, { opacity: 0.5, color: COLORS[this.nextId % 12].cc, strokeWidth: 3 });
			}
			for (const f of this.forces) {
				this.drawForce(f.components, { opacity: 1, color: COLORS[f.id % 12].cc, strokeWidth: 3 });
			}
			if (this.forces.length == 0 || (this.net.x == 0 && this.net.y == 0)) {
				const o = this.grid.getStageFromPoint({ x: 0, y: 0 });
				s.circle(o.x, o.y, 8, { fill: 'black' });
			} else {
				this.drawForce(this.net, { opacity: 0.5, color: 'black', strokeWidth: 6 });
			}
		}

		addForce() {
			this.forces.push({
				id: this.nextId++,
				components: { ...this.preview },
				tao: { symbol: 'F', type: 'force', agent: 'agent', object: 'object', color: 'green', editText: false }
			});
			this.update();
		}

		deleteForce(id) {
			this.data.data.forceList = this.forces.filter((f) => f.id !== id);
			this.update();
		}

		update() {
			this.net = { x: 0, y: 0 };
			for (const f of this.forces) {
				this.net.x += f.components.x;
				this.net.y += f.components.y;
			}
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
			const zero = this.forces.length == 0 || (this.net.x == 0 && this.net.y == 0);
			items.appendChild(el('div', { class: 'net-force' }, el('div', { text: 'Net Force' + (zero ? ' = 0' : '') })));
			c.appendChild(items);
		}

		taoRow(force) {
			const t = force.tao;
			const fields = ['symbol', 'type', 'agent', 'object'];
			const editBtn = el(
				'button',
				{
					type: 'button',
					class: 'icon-btn',
					onclick: () => {
						t.editText = !t.editText;
						this.renderChart();
					}
				},
				icon('edit')
			);
			const delBtn = el('button', { type: 'button', class: 'icon-btn', onclick: () => this.deleteForce(force.id) }, icon('trash'));

			let cells;
			if (t.editText) {
				cells = fields.map((k) =>
					el('input', {
						value: t[k],
						placeholder: k === 'symbol' ? 'Symbol' : '',
						oninput: (e) => (t[k] = e.target.value),
						onkeydown: (e) => {
							if (e.key === 'Enter') {
								t.editText = false;
								this.renderChart();
							}
						}
					})
				);
			} else {
				cells = fields.map((k) =>
					el('div', {
						text: t[k],
						ondblclick: () => {
							t.editText = true;
							this.renderChart();
						}
					})
				);
			}
			return el('div', { class: 'tao-row', style: { background: COLORS[force.id % 12].bg } }, editBtn, cells, delBtn);
		}
	}

	/* ---------------- page ---------------- */
	const list = el('ul', { class: 'figure-list fbd' });
	const addBtn = el('div', { style: { display: 'flex' } }, button({ cls: 'btn-alt', icon: 'plusCircle', text: 'Add New Diagram', extra: 'w-full', onclick: () => addNewFBD() }));
	HT.capture.append(list, addBtn);

	const fbdSets = { title: 'Title', type: 'free-body-diagram', id: 0, instances: [] };
	let idInd = 0;

	function addNewFBD() {
		const data = { id: idInd++, title: 'Title', data: { forceList: [] } };
		fbdSets.instances.push(data);
		const fig = new FreeBodyDiagram(data);
		list.appendChild(el('li', null, fig.root));
	}

	HT.actions.saveData = () => console.log('saveData from free-body-diagram page');
	HT.actions.loadData = () => console.log('loadData from free-body-diagram page');
	HT.actions.refreshAllData = () => {
		fbdSets.instances = [];
		list.replaceChildren();
		addNewFBD();
	};

	addNewFBD();
})();
