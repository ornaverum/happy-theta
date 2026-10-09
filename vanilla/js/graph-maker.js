/* Graph Maker page — qualitative motion graphs.
   Click twice to place the endpoints of a segment, move the mouse to bend it, click again to keep it. */
'use strict';

(function () {
	const { el, button, editLabel, Stage } = HT;

	const Y_LABELS = {
		Position: { name: 'Position', color: 'blue' },
		Velocity: { name: 'Velocity', color: 'green' },
		Acceleration: { name: 'Acceleration', color: 'red' }
	};
	const NEXT_Y = { Position: 'Velocity', Velocity: 'Acceleration', Acceleration: 'Position' };

	/* Grid in graph units: time 0..6 to the right, value -3..3 */
	const COLS = 6;
	const ROWS = 6;
	const Y_MAX = 3;
	/* Canvas padding around the grid (room for the axis arrowheads) */
	const PAD = { l: 4, r: 16, t: 16, b: 4 };

	let graphSize = 200; // grid width/height in px; set by fitGraphs()

	class QualGraph {
		constructor(graph, { onDelete = () => {} } = {}) {
			this.graph = graph; // { title, graphID, groupID, pathList, labels }
			this.onDelete = onDelete;
			this.onStage = false;
			this.dotList = []; // endpoints being placed, in graph units
			this.addingDot = true;
			this.previewDot = null;
			this.previewPath = null;
			this.build();
			this.resize();
		}

		get color() {
			return Y_LABELS[this.graph.labels.y].color;
		}

		/* graph units <-> canvas pixels */
		toPx(p) {
			const cs = graphSize / COLS;
			return { x: PAD.l + p.x * cs, y: PAD.t + (Y_MAX - p.y) * cs };
		}
		snap(px) {
			const cs = graphSize / COLS;
			const x = Math.round((px.x - PAD.l) / cs);
			const y = Y_MAX - Math.round((px.y - PAD.t) / cs);
			return { x: Math.min(COLS, Math.max(0, x)), y: Math.min(Y_MAX, Math.max(Y_MAX - ROWS, y)) };
		}

		build() {
			const ctrls = el(
				'div',
				{ class: 'qg-ctrls ctrl-only' },
				button({ cls: 'btn-red', icon: 'refresh', tip: 'Erase this graph', extra: 'btn-xs', onclick: () => this.erase() }),
				button({ cls: 'btn-red', icon: 'trash', tip: 'Delete this graph', extra: 'btn-xs', onclick: () => this.onDelete(this.graph.graphID) })
			);
			this.title = editLabel({ text: this.graph.title, size: 'md', onchange: (t) => (this.graph.title = t) });

			this.yLabel = el('button', {
				type: 'button',
				class: 'qg-ylabel',
				title: 'Click to switch between position, velocity and acceleration',
				onclick: () => {
					this.graph.labels.y = NEXT_Y[this.graph.labels.y];
					this.paintYLabel();
					this.draw();
				}
			});
			this.paintYLabel();

			const stageBox = el('div', { class: 'qg-stage' });
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

			this.xLabel = el('div', { class: 'qg-xlabel', text: this.graph.labels.x });

			this.root = el(
				'div',
				{ class: 'qg-card' },
				el('div', { class: 'qg-head' }, this.title.el, ctrls),
				el('div', { class: 'qg-body' }, this.yLabel, stageBox, el('div'), this.xLabel)
			);
		}

		paintYLabel() {
			this.yLabel.textContent = this.graph.labels.y;
			this.yLabel.style.color = this.color;
		}

		resize() {
			const w = PAD.l + graphSize + PAD.r;
			const h = PAD.t + graphSize + PAD.b;
			this.stage.resize(w, h);
			// line the labels up with the grid itself, not the padded canvas
			this.yLabel.style.marginTop = PAD.t + 'px';
			this.yLabel.style.marginBottom = PAD.b + 'px';
			this.xLabel.style.paddingLeft = PAD.l + 'px';
			this.xLabel.style.paddingRight = PAD.r + 'px';
			this.draw();
		}

		setTitle(t) {
			this.graph.title = t;
			this.title.setText(t);
		}

		/* Quadratic curve between two endpoints; curvature -1, 0 or 1 */
		pathFor(a, b, curvature = 0) {
			const ctrl = a.y + (b.y - a.y) * 0.5 * (1 - curvature);
			return { a: { ...a }, b: { ...b }, c: { x: (a.x + b.x) / 2, y: ctrl } };
		}

		curvature(pos) {
			if (this.dotList.length != 2) return 0;
			const a = this.toPx(this.dotList[0]).y;
			const b = this.toPx(this.dotList[1]).y;
			if (pos.y > Math.max(a, b) / 2 + (a + b) / 4) return -Math.sign(b - a);
			if (pos.y < Math.min(a, b) / 2 + (a + b) / 4) return Math.sign(b - a);
			return 0;
		}

		handleMove(pos) {
			if (this.addingDot) this.previewDot = this.snap(pos);
			else this.previewPath = this.pathFor(this.dotList[0], this.dotList[1], this.curvature(pos));
			this.draw();
		}

		handleClick(pos) {
			if (this.addingDot) {
				this.dotList.push(this.snap(pos));
				if (this.dotList.length > 1) {
					this.addingDot = false;
					this.previewPath = this.pathFor(this.dotList[0], this.dotList[1], 0);
				}
			} else {
				this.graph.pathList.push(this.previewPath);
				this.dotList = [];
				this.previewPath = null;
				this.addingDot = true;
				this.previewDot = this.snap(pos);
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

		drawGrid() {
			const s = this.stage;
			const cs = graphSize / COLS;
			for (let i = 0; i <= COLS; i++) {
				const x = PAD.l + i * cs;
				s.line(x, PAD.t, x, PAD.t + graphSize, { stroke: '#9ca3af', strokeWidth: 1 });
			}
			for (let j = 0; j <= ROWS; j++) {
				const y = PAD.t + j * cs;
				s.line(PAD.l, y, PAD.l + graphSize, y, { stroke: '#9ca3af', strokeWidth: 1 });
			}
			// axes: time axis through value 0 with an arrow on the right; value axis with an arrow on top
			const o = this.toPx({ x: 0, y: 0 });
			const axis = { stroke: 'black', fill: 'black', strokeWidth: 3, pointerLength: 9, pointerWidth: 9 };
			s.arrow(o.x, o.y, PAD.l + graphSize + PAD.r - 2, o.y, axis);
			s.arrow(o.x, PAD.t + graphSize, o.x, 2, axis);
		}

		drawPath(p, opacity = 1) {
			const a = this.toPx(p.a);
			const b = this.toPx(p.b);
			const c = this.toPx(p.c);
			this.stage.quad(a.x, a.y, c.x, c.y, b.x, b.y, { stroke: this.color, strokeWidth: 4, opacity });
		}

		draw() {
			const s = this.stage;
			const color = this.color;
			const r = Math.max(5, graphSize / 30);
			s.clear();
			this.drawGrid();
			for (const p of this.graph.pathList) this.drawPath(p);
			if (!this.addingDot && this.previewPath) this.drawPath(this.previewPath, 0.6);
			for (const d of this.dotList) {
				const q = this.toPx(d);
				s.circle(q.x, q.y, r, { fill: color });
			}
			if (this.onStage && this.addingDot && this.previewDot) {
				const q = this.toPx(this.previewDot);
				s.circle(q.x, q.y, r, { fill: color, opacity: 0.5 });
			}
		}
	}

	/* ---------------- page ---------------- */
	const container = el('div', { class: 'gm-groups' });
	const addGroupBtn = button({
		cls: 'btn-alt',
		icon: 'plusCircle',
		text: 'Add New Group',
		extra: 'w-full ctrl-only gm-add-group',
		onclick: () => {
			groupIDs.push(++groupIDIncrement);
			render();
		}
	});
	const hint = el('p', {
		class: 'gm-hint',
		text: 'Click two grid points to place a segment’s endpoints, move the mouse up or down to bend it, then click again to keep it. Click a graph’s side label to switch between position, velocity and acceleration.'
	});
	HT.capture.append(container, addGroupBtn);
	HT.capture.parentElement.insertBefore(hint, HT.capture);

	let graphs = [];
	let groupIDs = [0];
	let groupIDIncrement = 0;
	let graphIDIncrement = 0;
	const views = new Map(); // graphID -> QualGraph
	const groupLabels = new Map(); // groupID -> label text

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

	/* Size the graphs so a whole group fits across the page */
	function fitGraphs() {
		const perRow = Math.max(3, ...groupIDs.map((id) => graphs.filter((g) => g.groupID == id).length));
		const sample = container.querySelector('.gm-graphs');
		const avail = ((sample ? sample.clientWidth : container.clientWidth - 160) || 600) - (HT.ctrl ? 64 : 0); // room for the + button
		// each card adds the y-label column, canvas padding, card padding and the gap
		const overhead = 28 + PAD.l + PAD.r + 24 + 16;
		const size = Math.floor(Math.min(280, Math.max(140, avail / perRow - overhead)));
		const snapped = size - (size % COLS); // whole-pixel cells keep the grid crisp
		if (snapped !== graphSize) {
			graphSize = snapped;
			views.forEach((v) => v.resize());
		}
	}

	function render() {
		container.replaceChildren();
		for (const group of groupIDs) {
			if (!groupLabels.has(group)) groupLabels.set(group, `Group ${groupIDs.indexOf(group) + 1}`);
			const label = editLabel({ text: groupLabels.get(group), size: 'lg', vertical: true, onchange: (t) => groupLabels.set(group, t) });
			const ctrls = el(
				'div',
				{ class: 'gm-group-ctrls ctrl-only' },
				button({
					cls: 'btn-blue',
					icon: 'trash',
					tip: 'Delete Graph Group',
					extra: 'btn-xs',
					onclick: () => {
						groupIDs = groupIDs.filter((g) => g !== group);
						render();
					}
				}),
				button({ cls: 'btn-blue', text: 'Autotitle', tip: 'Give graphs alphabetical titles', extra: 'btn-xs', onclick: () => labelGroupTitle(group) })
			);
			const graphsBox = el('div', { class: 'gm-graphs' });
			for (const g of graphs) if (g.groupID == group) graphsBox.appendChild(viewFor(g).root);
			graphsBox.appendChild(
				el(
					'button',
					{ type: 'button', class: 'gm-add-graph ctrl-only', 'data-tip': 'Add a graph to this group', onclick: () => addNewGraph(group) },
					HT.icon('plusCircle')
				)
			);
			container.appendChild(el('section', { class: 'gm-group' }, el('div', { class: 'gm-group-side' }, label.el, ctrls), graphsBox));
		}
		fitGraphs();
	}

	HT.onResize(fitGraphs);
	document.addEventListener('ht-ctrl', () => requestAnimationFrame(fitGraphs));

	HT.actions.saveData = () => console.log('saveData from graph-maker page');
	HT.actions.loadData = () => console.log('loadData from graph-maker page');
	HT.actions.refreshAllData = () => {
		graphs = [];
		views.clear();
		groupLabels.clear();
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
