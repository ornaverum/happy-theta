/* Graph Maker page — qualitative motion graphs */
'use strict';

(function () {
	const { el, button, editLabel, Stage, GridLogic, drawGridLines } = HT;

	const Y_LABELS = {
		Position: { name: 'Position', color: 'blue' },
		Velocity: { name: 'Velocity', color: 'green' },
		Acceleration: { name: 'Acceleration', color: 'red' }
	};
	const NEXT_Y = { Position: 'Velocity', Velocity: 'Acceleration', Acceleration: 'Position' };

	class QualGraph {
		constructor(graph, { width = 200, height = 200, onDelete = () => {} } = {}) {
			this.graph = graph; // { title, graphID, groupID, pathList, labels }
			this.width = width;
			this.height = height;
			this.onDelete = onDelete;
			this.onStage = false;
			this.dotList = [];
			this.addingDot = true;
			this.previewDot = null;
			this.previewPath = null;
			this.grid = new GridLogic({ numCells: { x: 6, y: 6 }, origin: { x: 0, y: 3 } });
			this.build();
			this.draw();
		}

		get color() {
			return Y_LABELS[this.graph.labels.y].color;
		}

		build() {
			const header = el(
				'div',
				{ class: 'btn-header ctrl-only' },
				el(
					'div',
					{ class: 'btn-group', style: { width: 'auto' } },
					button({ cls: 'btn-red', icon: 'refresh', tip: 'Erase this graph', extra: 'btn-xs', onclick: () => this.erase() }),
					button({ cls: 'btn-red', icon: 'trash', tip: 'Delete this graph', extra: 'btn-xs', onclick: () => this.onDelete(this.graph.graphID) })
				)
			);
			this.title = editLabel({ text: this.graph.title, size: 'xs', onchange: (t) => (this.graph.title = t) });

			this.yLabel = el('div', {
				class: 'ylabel',
				text: this.graph.labels.y,
				onclick: () => {
					this.graph.labels.y = NEXT_Y[this.graph.labels.y];
					this.yLabel.textContent = this.graph.labels.y;
					this.draw();
				}
			});

			const stageBox = el('div');
			this.stage = new Stage(stageBox);
			this.stage.resize(this.width, this.height);
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
				click: () => this.handleClick()
			});

			this.root = el(
				'div',
				{ class: 'qual-graph' },
				header,
				this.title.el,
				el(
					'div',
					{ class: 'row' },
					el('div', { style: { margin: 'auto 0', position: 'relative' } }, this.yLabel),
					el('div', { style: { display: 'flex', flexDirection: 'column' } }, stageBox, el('div', { class: 'xlabel', text: this.graph.labels.x }))
				)
			);
		}

		setTitle(t) {
			this.graph.title = t;
			this.title.setText(t);
		}

		pathFor(a, b, curvature = 0) {
			const ctrl = a.y + (b.y - a.y) * 0.5 * (1 - curvature);
			return { x0: a.x, y0: a.y, cx: (a.x + b.x) / 2, cy: ctrl, x1: b.x, y1: b.y };
		}

		curvature(pos) {
			const d = this.dotList;
			if (d.length != 2) return 0;
			const a = d[0].y;
			const b = d[1].y;
			if (pos.y > Math.max(a, b) / 2 + (a + b) / 4) return -Math.sign(b - a);
			if (pos.y < Math.min(a, b) / 2 + (a + b) / 4) return Math.sign(b - a);
			return 0;
		}

		handleMove(pos) {
			if (this.addingDot) {
				this.previewDot = this.grid.getStageFromPoint(this.grid.getSnappedPointFromStage(pos));
			} else {
				this.previewPath = this.pathFor(this.dotList[0], this.dotList[1], this.curvature(pos));
			}
			this.draw();
		}

		handleClick() {
			if (this.addingDot) {
				if (!this.previewDot) return;
				this.dotList.push({ ...this.previewDot });
				if (this.dotList.length > 1) {
					this.addingDot = false;
					this.previewPath = this.pathFor(this.dotList[0], this.dotList[1], 0);
				}
			} else {
				this.graph.pathList.push(this.previewPath);
				this.dotList = [];
				this.previewPath = null;
				this.addingDot = true;
			}
			this.draw();
		}

		erase() {
			this.dotList = [];
			this.graph.pathList = [];
			this.previewPath = null;
			this.addingDot = true;
			this.draw();
		}

		draw() {
			const s = this.stage;
			const color = this.color;
			s.clear();
			drawGridLines(s, this.grid);
			for (const d of this.dotList) s.circle(d.x, d.y, 8, { fill: color, opacity: 1 });
			if (this.onStage && this.addingDot && this.previewDot) {
				s.circle(this.previewDot.x, this.previewDot.y, 8, { fill: color, opacity: 0.6 });
			}
			const paths = [...this.graph.pathList];
			if (!this.addingDot && this.previewPath) paths.unshift(this.previewPath);
			for (const p of paths) s.quad(p.x0, p.y0, p.cx, p.cy, p.x1, p.y1, { stroke: color, strokeWidth: 4 });
		}
	}

	/* ---------------- page ---------------- */
	const container = el('div', { class: 'panel center' });
	const addGroupBtn = button({
		cls: 'btn-alt',
		icon: 'plusCircle',
		text: 'Add New Group',
		extra: 'w-full ctrl-only',
		onclick: () => {
			groupIDs.push(++groupIDIncrement);
			render();
		}
	});
	HT.capture.append(container, addGroupBtn);

	let graphs = [];
	let groupIDs = [0];
	let groupIDIncrement = 0;
	let graphIDIncrement = 0;
	const views = new Map(); // graphID -> QualGraph

	function viewFor(g) {
		if (!views.has(g.graphID)) views.set(g.graphID, new QualGraph(g, { onDelete: handleDelete }));
		return views.get(g.graphID);
	}

	function addNewGraph(groupID) {
		graphs.push({ title: 'Title', graphID: ++graphIDIncrement, groupID, pathList: [], labels: { x: 'Time', y: 'Position' } });
		render();
	}

	function handleDelete(id) {
		graphs = graphs.filter((g) => g.graphID !== id);
		views.delete(id);
		render();
	}

	function labelGroupTitle(groupID) {
		let n = 0;
		for (const g of graphs) if (g.groupID === groupID) viewFor(g).setTitle(String.fromCharCode(65 + n++));
	}

	function render() {
		container.replaceChildren();
		for (const group of groupIDs) {
			const row = el('div', { class: 'group-row' });
			row.appendChild(
				el(
					'div',
					{ class: 'group-ctrls ctrl-only' },
					button({
						cls: 'btn-blue',
						icon: 'trash',
						tip: 'Delete Graph Group',
						onclick: () => {
							groupIDs = groupIDs.filter((g) => g !== group);
							render();
						}
					}),
					button({ cls: 'btn-blue', text: 'Autotitle', tip: 'Give graphs alphabetical titles', onclick: () => labelGroupTitle(group) })
				)
			);
			row.appendChild(el('div', { class: 'group-label' }, editLabel({ text: 'group 1', size: 'xl', vertical: true }).el));
			for (const g of graphs) if (g.groupID == group) row.appendChild(viewFor(g).root);
			row.appendChild(button({ cls: 'btn-alt', icon: 'plusCircle', extra: 'ctrl-only', onclick: () => addNewGraph(group) }));
			container.appendChild(row);
		}
	}

	HT.actions.saveData = () => console.log('saveData from graph-maker page');
	HT.actions.loadData = () => console.log('loadData from graph-maker page');
	HT.actions.refreshAllData = () => {
		graphs = [];
		views.clear();
		groupIDs = [0];
		graphIDIncrement = 0;
		groupIDIncrement = 0;
		addNewGraph(0);
	};

	graphs = [
		{ title: '', graphID: 0, groupID: 0, pathList: [], labels: { x: 'Time', y: 'Position' } },
		{ title: '', graphID: 1, groupID: 0, pathList: [], labels: { x: 'Time', y: 'Velocity' } },
		{ title: '', graphID: 2, groupID: 0, pathList: [], labels: { x: 'Time', y: 'Acceleration' } }
	];
	graphIDIncrement = graphs.length;
	render();
})();
