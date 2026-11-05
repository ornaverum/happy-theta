/* Advanced Graph Maker — a Cartesian graphing tool (modeled on GraphFree's Cartesian grid tool).
   Plain JavaScript, no libraries. Depends on core.js and math-expr.js. */
'use strict';

(function () {
	const { el, compileExpr, parseNum } = HT;

	/* ================================================================== */
	/* Constants                                                          */
	/* ================================================================== */

	const PALETTE = ['#000000', '#686868', '#cccccc', '#0000ff', '#008400', '#cc0022', '#7000dd', '#c000d3', '#e67300'];
	const PLOT_COLORS = ['#000000', '#0000ff', '#cc0022', '#008400', '#7000dd', '#e67300', '#c000d3', '#686868'];
	const WIDTHS = [1, 2, 3.5, 5];
	const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20];
	const MARKER_SIZES = [8, 10, 12, 14, 16];
	const DASHES = [
		['', 'Solid'],
		['3 3', 'Dotted'],
		['5 5', 'Short dash'],
		['8 4', 'Dash'],
		['12 4', 'Long dash'],
		['12 4 4 4', 'Dash-dot']
	];
	const SHAPES = [
		['circle', '● Circle'],
		['square', '■ Square'],
		['diamond', '◆ Diamond'],
		['plus', '+ Plus'],
		['x', '× X']
	];
	const OPS = [
		['lt', 'x <'],
		['le', 'x ≤'],
		['gt', 'x >'],
		['ge', 'x ≥'],
		['eq', 'x ='],
		['neq', 'x ≠'],
		['ltlt', '< x <'],
		['ltle', '< x ≤'],
		['lelt', '≤ x <'],
		['lele', '≤ x ≤']
	];
	const PLOT_TYPES = [
		['function', 'Function'],
		['conic', 'Conic/Implicit'],
		['polar', 'Polar'],
		['parametric', 'Parametric'],
		['scatter', 'Scatter Plot'],
		['piecewise', 'Piecewise'],
		['asymptotes', 'Asymptotes'],
		['polygon', 'Polygon'],
		['slopefield', 'Slope Field'],
		['vectors', 'Vectors'],
		['step', 'Step Function']
	];
	const TYPE_NAME = Object.fromEntries(PLOT_TYPES);
	const SPECIAL_CHARS = '° ∠ ∞ π θ μ σ ∑ Δ λ 𝑖 𝑥 𝑦 𝑡 ∝ √ ≤ ≥ ≠ ≈ ± ∓ ⋅ × ÷ − ƒ 𝑔 ′ ″ ‴ ∫ ⟨ ⟩ ∴ ² ³ ⁻¹ ← ↑ → ↓ 𝑂 𝑅'.split(' ');
	const FONT = 'Helvetica, Arial, sans-serif';
	const pt2px = (pt) => (pt * 4) / 3;

	/* ================================================================== */
	/* State                                                              */
	/* ================================================================== */

	const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
	const style = (color, dash = '', w = 2) => ({ w, color, dash });

	const state = {
		bg: { transparent: false, color: '#ffffff' },
		size: { w: '250', h: '250', ml: '30', mr: '30', mt: '30', mb: '30' },
		grid: {
			x: { min: '0', max: '10', minor: '1', major: '', labels: '5' },
			y: { min: '0', max: '10', minor: '1', major: '', labels: '5' },
			mode: 'full',
			lineW: 1,
			lineColor: '#686868',
			labelSize: 12,
			labelColor: '#000000',
			xLabel: '',
			yLabel: '',
			axisW: 2,
			axisColor: '#000000',
			axisLabelSize: 12,
			axisLabelColor: '#000000'
		},
		plots: [],
		shading: range(5, () => ({ x: '', y: '', color: '#0000ff', opacity: 'normal' })),
		captions: {
			top: { text: '', size: 16, color: '#000000' },
			bottom: { text: '', size: 16, color: '#000000' },
			left: { text: '', size: 16, color: '#000000' },
			right: { text: '', size: 16, color: '#000000' }
		},
		annotations: range(10, () => ({ text: '', size: 12, color: '#000000' })),
		legend: { size: 12, color: '#000000' },
		offsets: {} // draggable text offsets, keyed by item
	};

	let plotSeq = 0;
	function newPlot(type) {
		const color = PLOT_COLORS[state.plots.length % PLOT_COLORS.length];
		const base = { id: ++plotSeq, type, hidden: false, legend: '', style: style(color) };
		switch (type) {
			case 'function':
				return { ...base, expr: '', edgeArrows: false };
			case 'conic':
				return { ...base, expr: '', edgeArrows: false };
			case 'polar':
				return { ...base, expr: '', tmin: '0', tmax: '2π', edgeArrows: false };
			case 'parametric':
				return { ...base, xexpr: '', yexpr: '', tmin: '0', tmax: '10', dirArrows: 2 };
			case 'scatter':
				return { ...base, method: 'points', points: range(9, () => ({ x: '', y: '' })), list: '', marker: { shape: 'circle', color, size: 12 } };
			case 'piecewise':
				return { ...base, rows: range(4, () => ({ expr: '', lo: '', op: 'ltlt', hi: '' })), edgeArrows: false, showEnds: true, endSize: 12 };
			case 'asymptotes':
				return { ...base, vx: ['', '', ''], hy: ['', ''], edgeArrows: false, style: style(color, '5 5') };
			case 'polygon':
				return { ...base, method: 'points', points: range(9, () => ({ x: '', y: '' })), list: '', close: true, fill: 'semi', fillColor: color };
			case 'slopefield':
				return { ...base, expr: '', sx: '1', sy: '1' };
			case 'vectors':
				return { ...base, rows: range(8, () => ({ tx: '', ty: '', hx: '', hy: '' })) };
			case 'step':
				return { ...base, kind: 'floor', a: '1', k: '0', b: '1', h: '0', endSize: 12 };
		}
	}

	/* ================================================================== */
	/* Geometry helpers                                                   */
	/* ================================================================== */

	const fmt = (v) => {
		const r = Math.round(v * 1e10) / 1e10;
		return (r < 0 ? '−' : '') + String(Math.abs(r));
	};

	function gridValues(min, max, step) {
		if (!(step > 0) || !(max > min)) return [];
		const out = [];
		const start = Math.ceil(min / step - 1e-9);
		for (let i = start; i * step <= max + 1e-9 * step; i++) {
			out.push(i * step);
			if (out.length > 2000) break;
		}
		return out;
	}

	const isMultiple = (v, step) => step > 0 && Math.abs(v / step - Math.round(v / step)) < 1e-7;

	/* Clip a polyline to a rectangle. Returns visible pieces; each piece knows whether its ends were cut by the edge. */
	function clipPolyline(pts, r) {
		const pieces = [];
		let cur = null;
		const push = (p, cut) => {
			if (!cur) {
				cur = { pts: [p], startCut: cut, endCut: false };
				pieces.push(cur);
			} else cur.pts.push(p);
		};
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const b = pts[i + 1];
			const seg = clipSegment(a, b, r);
			if (!seg) {
				if (cur) {
					cur.endCut = true;
					cur = null;
				}
				continue;
			}
			const [p0, p1, cut0, cut1] = seg;
			if (!cur || cut0) {
				if (cur) cur.endCut = true;
				cur = null;
				push(p0, cut0);
			}
			push(p1, false);
			if (cut1) {
				cur.endCut = true;
				cur = null;
			}
		}
		return pieces.filter((p) => p.pts.length > 1);
	}

	/* Liang–Barsky */
	function clipSegment(a, b, r) {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		let t0 = 0;
		let t1 = 1;
		const p = [-dx, dx, -dy, dy];
		const q = [a.x - r.x0, r.x1 - a.x, a.y - r.y0, r.y1 - a.y];
		for (let i = 0; i < 4; i++) {
			if (p[i] === 0) {
				if (q[i] < 0) return null;
			} else {
				const t = q[i] / p[i];
				if (p[i] < 0) {
					if (t > t1) return null;
					if (t > t0) t0 = t;
				} else {
					if (t < t0) return null;
					if (t < t1) t1 = t;
				}
			}
		}
		return [
			{ x: a.x + t0 * dx, y: a.y + t0 * dy },
			{ x: a.x + t1 * dx, y: a.y + t1 * dy },
			t0 > 0,
			t1 < 1
		];
	}

	/* ================================================================== */
	/* Rendering                                                          */
	/* ================================================================== */

	function computeLayout() {
		const s = state.size;
		const W = Math.max(20, parseNum(s.w, 250));
		const H = Math.max(20, parseNum(s.h, 250));
		const ml = Math.max(0, parseNum(s.ml, 30));
		const mr = Math.max(0, parseNum(s.mr, 30));
		const mt = Math.max(0, parseNum(s.mt, 30));
		const mb = Math.max(0, parseNum(s.mb, 30));
		const c = state.captions;
		const band = (cap) => (cap.text.trim() ? pt2px(cap.size) + 10 : 0);
		const bt = band(c.top);
		const bb = band(c.bottom);
		const bl = band(c.left);
		const br = band(c.right);
		const g = state.grid;
		let xmin = parseNum(g.x.min, 0);
		let xmax = parseNum(g.x.max, 10);
		let ymin = parseNum(g.y.min, 0);
		let ymax = parseNum(g.y.max, 10);
		if (!(xmax > xmin)) [xmin, xmax] = [0, 10];
		if (!(ymax > ymin)) [ymin, ymax] = [0, 10];
		const gx = bl + ml;
		const gy = bt + mt;
		return {
			W, H, gx, gy, bt, bb, bl, br,
			total: { w: Math.round(bl + ml + W + mr + br), h: Math.round(bt + mt + H + mb + bb) },
			xmin, xmax, ymin, ymax,
			rect: { x0: gx, y0: gy, x1: gx + W, y1: gy + H },
			px: (x) => gx + ((x - xmin) / (xmax - xmin)) * W,
			py: (y) => gy + ((ymax - y) / (ymax - ymin)) * H,
			mx: (px) => xmin + ((px - gx) / W) * (xmax - xmin),
			my: (py) => ymax - ((py - gy) / H) * (ymax - ymin)
		};
	}

	function setStroke(ctx, st) {
		ctx.strokeStyle = st.color;
		ctx.lineWidth = st.w;
		ctx.setLineDash(st.dash ? st.dash.split(' ').map(Number) : []);
		ctx.lineCap = st.dash ? 'butt' : 'round';
		ctx.lineJoin = 'round';
	}

	function arrowHead(ctx, x, y, ang, w, color) {
		const len = 7 + 2.2 * w;
		const half = 3.5 + 1.2 * w;
		ctx.save();
		ctx.setLineDash([]);
		ctx.translate(x, y);
		ctx.rotate(ang);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(-len, half);
		ctx.lineTo(-len * 0.75, 0);
		ctx.lineTo(-len, -half);
		ctx.closePath();
		ctx.fillStyle = color;
		ctx.fill();
		ctx.restore();
	}

	function strokePolyline(ctx, pts) {
		if (pts.length < 2) return;
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
		ctx.stroke();
	}

	/* Draw polylines clipped to the plot area, with optional arrows where a curve leaves the area */
	function drawCurves(ctx, L, polylines, st, edgeArrows, skipArrows) {
		setStroke(ctx, st);
		for (const line of polylines) {
			const pieces = clipPolyline(line, L.rect);
			for (const pc of pieces) {
				strokePolyline(ctx, pc.pts);
				if (edgeArrows && !skipArrows) {
					const n = pc.pts.length;
					if (pc.startCut) {
						const a = pc.pts[0];
						const b = pc.pts[Math.min(2, n - 1)];
						arrowHead(ctx, a.x, a.y, Math.atan2(a.y - b.y, a.x - b.x), st.w, st.color);
					}
					if (pc.endCut) {
						const a = pc.pts[n - 1];
						const b = pc.pts[Math.max(0, n - 3)];
						arrowHead(ctx, a.x, a.y, Math.atan2(a.y - b.y, a.x - b.x), st.w, st.color);
					}
				}
			}
		}
		ctx.setLineDash([]);
	}

	const CLAMP = 1e5;
	const clampPx = (v) => Math.max(-CLAMP, Math.min(CLAMP, v));

	/* Sample y = f(x) over [a, b], splitting at gaps and jump discontinuities */
	function sampleFunction(f, a, b, L, n) {
		const lines = [];
		let cur = [];
		let prev = null;
		const N = n || Math.max(400, Math.round(L.W * 3));
		for (let i = 0; i <= N; i++) {
			const x = a + ((b - a) * i) / N;
			let y;
			try {
				y = f(x);
			} catch {
				y = NaN;
			}
			if (!Number.isFinite(y)) {
				if (cur.length > 1) lines.push(cur);
				cur = [];
				prev = null;
				continue;
			}
			if (prev) {
				const jump = Math.abs(L.py(y) - L.py(prev.y));
				if (jump > L.H * 0.5) {
					const ym = f((x + prev.x) / 2);
					const lo = Math.min(y, prev.y);
					const hi = Math.max(y, prev.y);
					if (!Number.isFinite(ym) || ym < lo - (hi - lo) * 0.25 || ym > hi + (hi - lo) * 0.25) {
						if (cur.length > 1) lines.push(cur);
						cur = [];
					}
				}
			}
			cur.push({ x: L.px(x), y: clampPx(L.py(y)) });
			prev = { x, y };
		}
		if (cur.length > 1) lines.push(cur);
		return lines;
	}

	function sampleParam(fx, fy, a, b, L, N = 2000) {
		const lines = [];
		let cur = [];
		for (let i = 0; i <= N; i++) {
			const t = a + ((b - a) * i) / N;
			let x;
			let y;
			try {
				x = fx(t);
				y = fy(t);
			} catch {
				x = NaN;
			}
			if (!Number.isFinite(x) || !Number.isFinite(y)) {
				if (cur.length > 1) lines.push(cur);
				cur = [];
				continue;
			}
			const p = { x: clampPx(L.px(x)), y: clampPx(L.py(y)) };
			const last = cur[cur.length - 1];
			if (last && Math.hypot(p.x - last.x, p.y - last.y) > Math.max(L.W, L.H)) {
				if (cur.length > 1) lines.push(cur);
				cur = [];
			}
			cur.push(p);
		}
		if (cur.length > 1) lines.push(cur);
		return lines;
	}

	/* Marching squares for F(x, y) = 0, joined into polylines */
	function implicitCurves(F, L) {
		const nx = Math.min(300, Math.max(60, Math.round(L.W / 2)));
		const ny = Math.min(300, Math.max(60, Math.round(L.H / 2)));
		const xs = range(nx + 1, (i) => L.xmin + ((L.xmax - L.xmin) * i) / nx);
		const ys = range(ny + 1, (j) => L.ymin + ((L.ymax - L.ymin) * j) / ny);
		const v = range(nx + 1, (i) =>
			range(ny + 1, (j) => {
				try {
					return F(xs[i], ys[j]);
				} catch {
					return NaN;
				}
			})
		);
		const segs = [];
		const edgePt = (x0, y0, f0, x1, y1, f1) => {
			const t = f0 / (f0 - f1);
			const x = x0 + t * (x1 - x0);
			const y = y0 + t * (y1 - y0);
			// reject sign flips across a pole (|F| should shrink near a real crossing)
			let fm;
			try {
				fm = F(x, y);
			} catch {
				fm = NaN;
			}
			if (!Number.isFinite(fm) || Math.abs(fm) > Math.max(Math.abs(f0), Math.abs(f1))) return null;
			return { x, y };
		};
		for (let i = 0; i < nx; i++) {
			for (let j = 0; j < ny; j++) {
				const c = [v[i][j], v[i + 1][j], v[i + 1][j + 1], v[i][j + 1]];
				if (c.some((q) => !Number.isFinite(q))) continue;
				const P = [
					[xs[i], ys[j]],
					[xs[i + 1], ys[j]],
					[xs[i + 1], ys[j + 1]],
					[xs[i], ys[j + 1]]
				];
				const hits = [];
				for (let e = 0; e < 4; e++) {
					const a = e;
					const b = (e + 1) % 4;
					if (c[a] === 0 && c[b] === 0) continue;
					if ((c[a] <= 0 && c[b] > 0) || (c[a] > 0 && c[b] <= 0)) {
						const p = edgePt(P[a][0], P[a][1], c[a], P[b][0], P[b][1], c[b]);
						if (p) hits.push(p);
					}
				}
				if (hits.length === 2) segs.push([hits[0], hits[1]]);
				else if (hits.length === 4) {
					segs.push([hits[0], hits[1]]);
					segs.push([hits[2], hits[3]]);
				}
			}
		}
		// join segments into polylines by shared endpoints
		const key = (p) => Math.round(p.x * 1e6) + ',' + Math.round(p.y * 1e6);
		const ends = new Map();
		segs.forEach((s, idx) => {
			for (const p of s) {
				const k = key(p);
				if (!ends.has(k)) ends.set(k, []);
				ends.get(k).push(idx);
			}
		});
		const used = new Uint8Array(segs.length);
		const lines = [];
		const extend = (line, atEnd) => {
			for (;;) {
				const tip = atEnd ? line[line.length - 1] : line[0];
				const cand = (ends.get(key(tip)) || []).find((i) => !used[i]);
				if (cand === undefined) return;
				used[cand] = 1;
				const [a, b] = segs[cand];
				const next = key(a) === key(tip) ? b : a;
				if (atEnd) line.push(next);
				else line.unshift(next);
			}
		};
		segs.forEach((s, i) => {
			if (used[i]) return;
			used[i] = 1;
			const line = [s[0], s[1]];
			extend(line, true);
			extend(line, false);
			lines.push(line.map((p) => ({ x: L.px(p.x), y: L.py(p.y) })));
		});
		return lines;
	}

	function drawMarker(ctx, x, y, shape, size, color) {
		const r = size / 2;
		ctx.save();
		ctx.setLineDash([]);
		ctx.fillStyle = color;
		ctx.strokeStyle = color;
		ctx.lineWidth = Math.max(1.5, size / 6);
		ctx.lineCap = 'round';
		ctx.beginPath();
		if (shape === 'circle') {
			ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
			ctx.fill();
		} else if (shape === 'square') {
			ctx.rect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
			ctx.fill();
		} else if (shape === 'diamond') {
			ctx.moveTo(x, y - r);
			ctx.lineTo(x + r, y);
			ctx.lineTo(x, y + r);
			ctx.lineTo(x - r, y);
			ctx.closePath();
			ctx.fill();
		} else if (shape === 'plus') {
			ctx.moveTo(x - r, y);
			ctx.lineTo(x + r, y);
			ctx.moveTo(x, y - r);
			ctx.lineTo(x, y + r);
			ctx.stroke();
		} else {
			const d = r * 0.8;
			ctx.moveTo(x - d, y - d);
			ctx.lineTo(x + d, y + d);
			ctx.moveTo(x + d, y - d);
			ctx.lineTo(x - d, y + d);
			ctx.stroke();
		}
		ctx.restore();
	}

	function endpoint(ctx, x, y, size, color, closed, bg) {
		ctx.save();
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.arc(x, y, size / 2.6, 0, Math.PI * 2);
		ctx.fillStyle = closed ? color : bg;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = color;
		ctx.stroke();
		ctx.restore();
	}

	function parsePointList(text) {
		const nums = (text.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi) || []).map(Number);
		const out = [];
		for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i], y: nums[i + 1] });
		return out;
	}

	function pointsOf(plot) {
		if (plot.method === 'list') return parsePointList(plot.list);
		return plot.points
			.map((p) => ({ x: parseNum(p.x), y: parseNum(p.y) }))
			.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
	}

	/* Piecewise bound helpers */
	function pieceDomain(row, L) {
		const lo = parseNum(row.lo);
		const hi = parseNum(row.hi);
		const two = row.op.length === 4;
		switch (row.op) {
			case 'lt': return { a: -Infinity, b: hi, aIn: false, bIn: false };
			case 'le': return { a: -Infinity, b: hi, aIn: false, bIn: true };
			case 'gt': return { a: hi, b: Infinity, aIn: false, bIn: false };
			case 'ge': return { a: hi, b: Infinity, aIn: true, bIn: false };
			case 'eq': return { point: hi };
			case 'neq': return { a: -Infinity, b: Infinity, hole: hi };
		}
		if (two) return { a: lo, b: hi, aIn: row.op[1] === 'e', bIn: row.op[3] === 'e' };
		return null;
	}

	/* Each plot type draws itself. `mode` is 'normal' or 'boundary' (black strokes for shading masks). */
	function drawPlot(ctx, L, plot, mode, errors, bg) {
		const boundary = mode === 'boundary';
		const st = boundary ? { w: Math.max(2, plot.style.w), color: '#000', dash: '' } : plot.style;
		const err = (m) => errors && errors.set(plot.id, m);
		const tryCompile = (src, vars, label) => {
			try {
				return compileExpr(src, vars);
			} catch (e) {
				err(`${label}: ${e.message}`);
				return null;
			}
		};
		const ctxClip = (fn) => {
			ctx.save();
			ctx.beginPath();
			ctx.rect(L.gx, L.gy, L.W, L.H);
			ctx.clip();
			fn();
			ctx.restore();
		};

		switch (plot.type) {
			case 'function': {
				const f = tryCompile(plot.expr, ['x'], 'f(x)');
				if (!f) return;
				const pad = (L.xmax - L.xmin) * 0.02;
				drawCurves(ctx, L, sampleFunction(f, L.xmin - pad, L.xmax + pad, L), st, plot.edgeArrows, boundary);
				return;
			}
			case 'conic': {
				const src = plot.expr.trim();
				if (!src) return;
				const sides = src.split('=');
				if (sides.length > 2) return err('Curve: use a single "="');
				const lhs = tryCompile(sides[0], ['x', 'y'], 'Curve');
				const rhs = sides.length === 2 ? tryCompile(sides[1], ['x', 'y'], 'Curve') : () => 0;
				if (!lhs || !rhs) return;
				drawCurves(ctx, L, implicitCurves((x, y) => lhs(x, y) - rhs(x, y), L), st, plot.edgeArrows, boundary);
				return;
			}
			case 'polar': {
				const r = tryCompile(plot.expr, ['theta'], 'r(θ)');
				if (!r) return;
				const a = parseNum(plot.tmin, 0);
				const b = parseNum(plot.tmax, 2 * Math.PI);
				const lines = sampleParam((t) => r(t) * Math.cos(t), (t) => r(t) * Math.sin(t), a, b, L, 3000);
				drawCurves(ctx, L, lines, st, plot.edgeArrows, boundary);
				return;
			}
			case 'parametric': {
				const fx = tryCompile(plot.xexpr, ['t'], 'x(t)');
				const fy = tryCompile(plot.yexpr, ['t'], 'y(t)');
				if (!fx || !fy) return;
				const a = parseNum(plot.tmin, 0);
				const b = parseNum(plot.tmax, 10);
				const lines = sampleParam(fx, fy, a, b, L);
				drawCurves(ctx, L, lines, st, false, boundary);
				if (!boundary && plot.dirArrows > 0) {
					// direction arrows spaced evenly along the visible curve
					const vis = lines.flatMap((ln) => clipPolyline(ln, L.rect).map((p) => p.pts));
					const lens = vis.map((pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0));
					const total = lens.reduce((s, v) => s + v, 0);
					for (let k = 1; k <= plot.dirArrows; k++) {
						let target = (total * k) / (plot.dirArrows + 1);
						for (let v = 0; v < vis.length; v++) {
							if (target > lens[v]) {
								target -= lens[v];
								continue;
							}
							const pts = vis[v];
							for (let i = 1; i < pts.length; i++) {
								const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
								if (target <= d) {
									const t = d ? target / d : 0;
									const x = pts[i - 1].x + t * (pts[i].x - pts[i - 1].x);
									const y = pts[i - 1].y + t * (pts[i].y - pts[i - 1].y);
									arrowHead(ctx, x + 4 * Math.cos(Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)), y + 4 * Math.sin(Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)), Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x), st.w, st.color);
									break;
								}
								target -= d;
							}
							break;
						}
					}
				}
				return;
			}
			case 'scatter': {
				if (boundary) return;
				const m = plot.marker;
				ctxClip(() => pointsOf(plot).forEach((p) => drawMarker(ctx, L.px(p.x), L.py(p.y), m.shape, m.size, m.color)));
				return;
			}
			case 'piecewise': {
				const ends = [];
				plot.rows.forEach((row, i) => {
					if (!row.expr.trim()) return;
					const f = tryCompile(row.expr, ['x'], `Piece ${i + 1}`);
					if (!f) return;
					const d = pieceDomain(row, L);
					if (!d) return;
					if (d.point !== undefined) {
						if (Number.isFinite(d.point)) ends.push({ x: d.point, y: f(d.point), closed: true });
						return;
					}
					if (!Number.isFinite(d.a) && d.a !== -Infinity) return;
					if (!Number.isFinite(d.b) && d.b !== Infinity) return;
					const a = Math.max(d.a, L.xmin - (L.xmax - L.xmin));
					const b = Math.min(d.b, L.xmax + (L.xmax - L.xmin));
					if (!(b > a)) return;
					const lines = sampleFunction(f, a, b, L, Math.max(200, Math.round(((b - a) / (L.xmax - L.xmin)) * L.W * 3)));
					drawCurves(ctx, L, lines, st, plot.edgeArrows, boundary);
					if (Number.isFinite(d.a)) ends.push({ x: d.a, y: f(d.a), closed: d.aIn });
					if (Number.isFinite(d.b)) ends.push({ x: d.b, y: f(d.b), closed: d.bIn });
					if (d.hole !== undefined && Number.isFinite(d.hole)) ends.push({ x: d.hole, y: f(d.hole), closed: false });
				});
				if (!boundary && plot.showEnds) {
					ctxClip(() =>
						ends.forEach((e) => {
							if (Number.isFinite(e.y)) endpoint(ctx, L.px(e.x), L.py(e.y), plot.endSize, st.color, e.closed, bg);
						})
					);
				}
				return;
			}
			case 'asymptotes': {
				const lines = [];
				for (const v of plot.vx) {
					const x = parseNum(v);
					if (Number.isFinite(x)) lines.push([{ x: L.px(x), y: L.gy - 1e4 }, { x: L.px(x), y: L.gy + L.H + 1e4 }]);
				}
				plot.hy.forEach((src, i) => {
					if (!src.trim()) return;
					const f = tryCompile(src, ['x'], `y = (#${i + 1})`);
					if (f) lines.push(...sampleFunction(f, L.xmin - (L.xmax - L.xmin) * 0.02, L.xmax + (L.xmax - L.xmin) * 0.02, L, 400));
				});
				drawCurves(ctx, L, lines, st, plot.edgeArrows, boundary);
				return;
			}
			case 'polygon': {
				const pts = pointsOf(plot).map((p) => ({ x: L.px(p.x), y: L.py(p.y) }));
				if (pts.length < 2) return;
				ctxClip(() => {
					ctx.beginPath();
					ctx.moveTo(pts[0].x, pts[0].y);
					pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
					if (plot.close) ctx.closePath();
					if (!boundary && plot.fill !== 'none' && pts.length > 2) {
						ctx.globalAlpha = plot.fill === 'semi' ? 0.3 : 1;
						ctx.fillStyle = plot.fillColor;
						ctx.fill();
						ctx.globalAlpha = 1;
					}
					setStroke(ctx, st);
					ctx.stroke();
					ctx.setLineDash([]);
				});
				return;
			}
			case 'slopefield': {
				if (boundary) return;
				const f = tryCompile(plot.expr, ['x', 'y'], 'dy/dx');
				if (!f) return;
				const sx = parseNum(plot.sx, 1);
				const sy = parseNum(plot.sy, 1);
				if (!(sx > 0) || !(sy > 0)) return err('Spacing must be positive');
				const kx = L.W / (L.xmax - L.xmin);
				const ky = L.H / (L.ymax - L.ymin);
				const len = 0.35 * Math.min(sx * kx, sy * ky);
				const xs = gridValues(L.xmin, L.xmax, sx);
				const ys = gridValues(L.ymin, L.ymax, sy);
				if (xs.length * ys.length > 20000) return err('Spacing is too small');
				ctx.save();
				ctx.beginPath();
				ctx.rect(L.gx, L.gy, L.W, L.H);
				ctx.clip();
				setStroke(ctx, st);
				ctx.beginPath();
				for (const x of xs) {
					for (const y of ys) {
						let m;
						try {
							m = f(x, y);
						} catch {
							m = NaN;
						}
						let ang;
						if (Number.isFinite(m)) ang = Math.atan2(-m * ky, kx);
						else if (Math.abs(m) === Infinity) ang = Math.PI / 2;
						else continue;
						const cx = L.px(x);
						const cy = L.py(y);
						ctx.moveTo(cx - len * Math.cos(ang), cy - len * Math.sin(ang));
						ctx.lineTo(cx + len * Math.cos(ang), cy + len * Math.sin(ang));
					}
				}
				ctx.stroke();
				ctx.setLineDash([]);
				ctx.restore();
				return;
			}
			case 'vectors': {
				ctxClip(() => {
					for (const r of plot.rows) {
						const t = { x: parseNum(r.tx), y: parseNum(r.ty) };
						const h = { x: parseNum(r.hx), y: parseNum(r.hy) };
						if (![t.x, t.y, h.x, h.y].every(Number.isFinite)) continue;
						const a = { x: L.px(t.x), y: L.py(t.y) };
						const b = { x: L.px(h.x), y: L.py(h.y) };
						const ang = Math.atan2(b.y - a.y, b.x - a.x);
						const back = 4 + 1.5 * st.w;
						setStroke(ctx, st);
						ctx.lineCap = 'butt';
						strokePolyline(ctx, [a, { x: b.x - back * Math.cos(ang), y: b.y - back * Math.sin(ang) }]);
						if (!boundary) arrowHead(ctx, b.x, b.y, ang, st.w, st.color);
					}
					ctx.setLineDash([]);
				});
				return;
			}
			case 'step': {
				const a = parseNum(plot.a, 1);
				const k = parseNum(plot.k, 0);
				const b = parseNum(plot.b, 1);
				const h = parseNum(plot.h, 0);
				if (!b) return err('Horizontal stretch cannot be 0');
				const e = (n) => n / b + h; // where b(x - h) = n
				const u0 = b * (L.xmin - h);
				const u1 = b * (L.xmax - h);
				const nLo = Math.floor(Math.min(u0, u1)) - 1;
				const nHi = Math.ceil(Math.max(u0, u1)) + 1;
				if (nHi - nLo > 2000) return err('Too many steps to draw');
				const segs = [];
				const dots = [];
				for (let n = nLo; n <= nHi; n++) {
					// floor: value n on [e(n), e(n+1)); ceiling: value n on (e(n-1), e(n)]
					const [inc, exc] = plot.kind === 'floor' ? [e(n), e(n + 1)] : [e(n), e(n - 1)];
					const y = a * n + k;
					segs.push([{ x: L.px(inc), y: L.py(y) }, { x: L.px(exc), y: L.py(y) }]);
					dots.push({ x: inc, y, closed: true }, { x: exc, y, closed: false });
				}
				drawCurves(ctx, L, segs, st, false, boundary);
				if (!boundary) ctxClip(() => dots.forEach((d) => endpoint(ctx, L.px(d.x), L.py(d.y), plot.endSize, st.color, d.closed, bg)));
				return;
			}
		}
	}

	/* Shading: flood-fill the region containing a point, bounded by axes and plotted curves */
	function drawShading(ctx, L, scale, axes) {
		const areas = state.shading.filter((s) => Number.isFinite(parseNum(s.x)) && Number.isFinite(parseNum(s.y)));
		if (!areas.length) return;
		const w = Math.ceil(L.total.w * scale);
		const h = Math.ceil(L.total.h * scale);
		const bc = document.createElement('canvas');
		bc.width = w;
		bc.height = h;
		const b = bc.getContext('2d', { willReadFrequently: true });
		b.scale(scale, scale);
		b.strokeStyle = '#000';
		b.lineWidth = 2;
		b.strokeRect(L.gx, L.gy, L.W, L.H);
		b.beginPath();
		b.moveTo(L.gx, axes.xAxisY);
		b.lineTo(L.gx + L.W, axes.xAxisY);
		b.moveTo(axes.yAxisX, L.gy);
		b.lineTo(axes.yAxisX, L.gy + L.H);
		b.stroke();
		state.plots.forEach((p) => !p.hidden && drawPlot(b, L, p, 'boundary', null, '#fff'));
		const wall = b.getImageData(0, 0, w, h).data;

		for (const s of areas) {
			const sx = Math.round(L.px(parseNum(s.x)) * scale);
			const sy = Math.round(L.py(parseNum(s.y)) * scale);
			if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
			const blocked = (i) => wall[i * 4 + 3] > 40;
			if (blocked(sy * w + sx)) continue;
			const fill = new Uint8Array(w * h);
			const stack = [sy * w + sx];
			while (stack.length) {
				const i = stack.pop();
				if (fill[i] || blocked(i)) continue;
				// scanline fill
				let l = i;
				const row = Math.floor(i / w) * w;
				while (l > row && !fill[l - 1] && !blocked(l - 1)) l--;
				let r = i;
				while (r < row + w - 1 && !fill[r + 1] && !blocked(r + 1)) r++;
				for (let j = l; j <= r; j++) {
					fill[j] = 1;
					if (j - w >= 0 && !fill[j - w] && !blocked(j - w)) stack.push(j - w);
					if (j + w < w * h && !fill[j + w] && !blocked(j + w)) stack.push(j + w);
				}
			}
			const out = new ImageData(w, h);
			const hex = s.color.replace('#', '');
			const rgb = [0, 2, 4].map((o) => parseInt(hex.substr(o, 2), 16));
			const alpha = s.opacity === 'darker' ? 0x84 : 0x48;
			for (let i = 0; i < w * h; i++) {
				// grow 1px into the boundary so the fill meets the curve
				if (fill[i] || (blocked(i) && (fill[i - 1] || fill[i + 1] || fill[i - w] || fill[i + w]))) {
					out.data[i * 4] = rgb[0];
					out.data[i * 4 + 1] = rgb[1];
					out.data[i * 4 + 2] = rgb[2];
					out.data[i * 4 + 3] = alpha;
				}
			}
			const oc = document.createElement('canvas');
			oc.width = w;
			oc.height = h;
			oc.getContext('2d').putImageData(out, 0, 0);
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(oc, 0, 0);
			ctx.restore();
		}
	}

	/* Text items that can be dragged; their hit boxes are rebuilt on every render */
	let hitBoxes = [];

	function drawText(ctx, key, text, x, y, { size, color, align = 'left', baseline = 'middle', rotate = 0, halo = null }) {
		const off = state.offsets[key] || { dx: 0, dy: 0 };
		x += off.dx;
		y += off.dy;
		ctx.save();
		ctx.font = `${pt2px(size)}px ${FONT}`;
		ctx.fillStyle = color;
		ctx.textAlign = align;
		ctx.textBaseline = baseline;
		ctx.translate(x, y);
		ctx.rotate(rotate);
		if (halo) {
			ctx.lineWidth = 3;
			ctx.lineJoin = 'round';
			ctx.strokeStyle = halo;
			ctx.strokeText(text, 0, 0);
		}
		ctx.fillText(text, 0, 0);
		ctx.restore();
		if (key) {
			ctx.font = `${pt2px(size)}px ${FONT}`;
			const w = ctx.measureText(text).width;
			const h = pt2px(size);
			let bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
			let by = baseline === 'middle' ? y - h / 2 : baseline === 'bottom' ? y - h : y;
			if (rotate) [bx, by] = [x - h / 2, y - w / 2];
			hitBoxes.push({ key, x: bx - 3, y: by - 3, w: (rotate ? h : w) + 6, h: (rotate ? w : h) + 6 });
		}
	}

	function render(ctx, scale, errors) {
		const L = computeLayout();
		const g = state.grid;
		const bg = state.bg.transparent ? '#ffffff' : state.bg.color;
		hitBoxes = [];
		ctx.setTransform(scale, 0, 0, scale, 0, 0);
		ctx.clearRect(0, 0, L.total.w, L.total.h);
		if (!state.bg.transparent) {
			ctx.fillStyle = state.bg.color;
			ctx.fillRect(0, 0, L.total.w, L.total.h);
		}

		const sp = {
			xMinor: parseNum(g.x.minor),
			xMajor: parseNum(g.x.major),
			xLab: parseNum(g.x.labels),
			yMinor: parseNum(g.y.minor),
			yMajor: parseNum(g.y.major),
			yLab: parseNum(g.y.labels)
		};

		// axis positions
		const xAxisVal = L.ymin <= 0 && L.ymax >= 0 ? 0 : L.ymin > 0 ? L.ymin : L.ymax;
		const yAxisVal = L.xmin <= 0 && L.xmax >= 0 ? 0 : L.xmin > 0 ? L.xmin : L.xmax;
		const axes = { xAxisY: L.py(xAxisVal), yAxisX: L.px(yAxisVal) };

		// grid lines
		if (g.mode === 'full') {
			ctx.save();
			ctx.strokeStyle = g.lineColor;
			ctx.setLineDash([]);
			const line = (x0, y0, x1, y1, w) => {
				ctx.lineWidth = w;
				ctx.beginPath();
				ctx.moveTo(x0, y0);
				ctx.lineTo(x1, y1);
				ctx.stroke();
			};
			for (const x of gridValues(L.xmin, L.xmax, sp.xMinor)) line(L.px(x), L.gy, L.px(x), L.gy + L.H, g.lineW);
			for (const y of gridValues(L.ymin, L.ymax, sp.yMinor)) line(L.gx, L.py(y), L.gx + L.W, L.py(y), g.lineW);
			for (const x of gridValues(L.xmin, L.xmax, sp.xMajor)) line(L.px(x), L.gy, L.px(x), L.gy + L.H, g.lineW * 2);
			for (const y of gridValues(L.ymin, L.ymax, sp.yMajor)) line(L.gx, L.py(y), L.gx + L.W, L.py(y), g.lineW * 2);
			ctx.restore();
		}

		drawShading(ctx, L, scale, axes);

		// axes (extend past the grid with arrowheads at both ends)
		const ext = 10 + g.axisW * 2;
		ctx.save();
		ctx.strokeStyle = g.axisColor;
		ctx.lineWidth = g.axisW;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(L.gx, axes.xAxisY);
		ctx.lineTo(L.gx + L.W + ext - 4, axes.xAxisY);
		ctx.moveTo(axes.yAxisX, L.gy - ext + 4);
		ctx.lineTo(axes.yAxisX, L.gy + L.H);
		ctx.stroke();
		// arrowheads only at the positive ends: right of the x-axis, top of the y-axis
		arrowHead(ctx, L.gx + L.W + ext, axes.xAxisY, 0, g.axisW, g.axisColor);
		arrowHead(ctx, axes.yAxisX, L.gy - ext, -Math.PI / 2, g.axisW, g.axisColor);

		// tick marks (ticks mode)
		if (g.mode === 'ticks') {
			ctx.strokeStyle = g.lineColor;
			ctx.beginPath();
			for (const x of gridValues(L.xmin, L.xmax, sp.xMinor)) {
				const t = isMultiple(x, sp.xMajor) ? 6 : 4;
				ctx.lineWidth = g.lineW;
				ctx.moveTo(L.px(x), axes.xAxisY - t);
				ctx.lineTo(L.px(x), axes.xAxisY + t);
			}
			for (const y of gridValues(L.ymin, L.ymax, sp.yMinor)) {
				const t = isMultiple(y, sp.yMajor) ? 6 : 4;
				ctx.moveTo(axes.yAxisX - t, L.py(y));
				ctx.lineTo(axes.yAxisX + t, L.py(y));
			}
			ctx.stroke();
		}
		ctx.restore();

		// number labels
		const lab = { size: g.labelSize, color: g.labelColor, halo: bg };
		for (const x of gridValues(L.xmin, L.xmax, sp.xLab)) {
			if (Math.abs(x - yAxisVal) < 1e-9 && yAxisVal === 0) continue;
			drawText(ctx, null, fmt(x), L.px(x), axes.xAxisY + 5, { ...lab, align: 'center', baseline: 'top' });
		}
		for (const y of gridValues(L.ymin, L.ymax, sp.yLab)) {
			if (Math.abs(y - xAxisVal) < 1e-9 && xAxisVal === 0) continue;
			drawText(ctx, null, fmt(y), axes.yAxisX - 6, L.py(y), { ...lab, align: 'right', baseline: 'middle' });
		}

		// plots
		for (const p of state.plots) if (!p.hidden) drawPlot(ctx, L, p, 'normal', errors, bg);

		// axis labels
		const al = { size: g.axisLabelSize, color: g.axisLabelColor };
		if (g.xLabel.trim()) drawText(ctx, 'xLabel', g.xLabel, L.gx + L.W + ext + 6, axes.xAxisY, { ...al, align: 'left', baseline: 'middle' });
		if (g.yLabel.trim()) drawText(ctx, 'yLabel', g.yLabel, axes.yAxisX, L.gy - ext - 4, { ...al, align: 'center', baseline: 'bottom' });

		// legend
		const entries = state.plots.filter((p) => !p.hidden && p.legend.trim());
		if (entries.length) {
			const off = state.offsets.legend || { dx: 0, dy: 0 };
			const fs = pt2px(state.legend.size);
			ctx.font = `${fs}px ${FONT}`;
			const sw = 26;
			const textW = Math.max(...entries.map((p) => ctx.measureText(p.legend).width));
			const bw = sw + 8 + textW + 16;
			const lh = fs + 6;
			const bh = entries.length * lh + 8;
			const bx = L.gx + L.W - bw - 6 + off.dx;
			const by = L.gy + 6 + off.dy;
			ctx.save();
			ctx.fillStyle = 'rgba(255,255,255,0.9)';
			ctx.strokeStyle = '#686868';
			ctx.lineWidth = 1;
			ctx.fillRect(bx, by, bw, bh);
			ctx.strokeRect(bx, by, bw, bh);
			entries.forEach((p, i) => {
				const cy = by + 4 + lh * i + lh / 2;
				if (p.type === 'scatter') drawMarker(ctx, bx + 8 + sw / 2, cy, p.marker.shape, Math.min(p.marker.size, 12), p.marker.color);
				else {
					setStroke(ctx, p.style);
					strokePolyline(ctx, [{ x: bx + 8, y: cy }, { x: bx + 8 + sw, y: cy }]);
					ctx.setLineDash([]);
				}
				ctx.fillStyle = state.legend.color;
				ctx.textAlign = 'left';
				ctx.textBaseline = 'middle';
				ctx.font = `${fs}px ${FONT}`;
				ctx.fillText(p.legend, bx + 16 + sw, cy);
			});
			ctx.restore();
			hitBoxes.push({ key: 'legend', x: bx, y: by, w: bw, h: bh });
		}

		// annotations (stacked near the center by default)
		state.annotations.forEach((a, i) => {
			if (!a.text.trim()) return;
			drawText(ctx, 'ann' + i, a.text, L.gx + L.W / 2, L.gy + L.H / 2 + (i - 2) * 18, { size: a.size, color: a.color, align: 'center' });
		});

		// captions
		const c = state.captions;
		if (c.top.text.trim()) drawText(ctx, 'capTop', c.top.text, L.gx + L.W / 2, 4, { ...c.top, align: 'center', baseline: 'top' });
		if (c.bottom.text.trim()) drawText(ctx, 'capBottom', c.bottom.text, L.gx + L.W / 2, L.total.h - 4, { ...c.bottom, align: 'center', baseline: 'bottom' });
		if (c.left.text.trim()) drawText(ctx, 'capLeft', c.left.text, 4 + pt2px(c.left.size) / 2, L.gy + L.H / 2, { ...c.left, align: 'center', rotate: -Math.PI / 2 });
		if (c.right.text.trim()) drawText(ctx, 'capRight', c.right.text, L.total.w - 4 - pt2px(c.right.size) / 2, L.gy + L.H / 2, { ...c.right, align: 'center', rotate: Math.PI / 2 });

		return L;
	}

	/* ================================================================== */
	/* Page: preview + export                                             */
	/* ================================================================== */

	const canvas = el('canvas', { class: 'agm-canvas' });
	const ctx = canvas.getContext('2d');
	const sizeNote = el('p', { class: 'agm-note' });
	const copyStatus = el('span', { class: 'agm-status' });
	let displayScale = 1.5;
	let pending = 0;

	function redraw() {
		cancelAnimationFrame(pending);
		pending = requestAnimationFrame(() => {
			const L0 = computeLayout();
			const avail = Math.max(200, previewBox.clientWidth - 24);
			displayScale = Math.min(1.6, avail / L0.total.w);
			const dpr = window.devicePixelRatio || 1;
			const s = displayScale * dpr;
			canvas.width = Math.ceil(L0.total.w * s);
			canvas.height = Math.ceil(L0.total.h * s);
			canvas.style.width = L0.total.w * displayScale + 'px';
			canvas.style.height = L0.total.h * displayScale + 'px';
			const errors = new Map();
			const L = render(ctx, s, errors);
			sizeNote.textContent = `Size including margins, captions, etc. is ${L.total.w} × ${L.total.h} pixels.`;
			document.querySelectorAll('.agm-err').forEach((n) => (n.textContent = errors.get(Number(n.dataset.pid)) || ''));
		});
	}

	const EXPORT_SCALE = 2;
	function exportCanvas() {
		const L = computeLayout();
		const c = document.createElement('canvas');
		c.width = L.total.w * EXPORT_SCALE;
		c.height = L.total.h * EXPORT_SCALE;
		render(c.getContext('2d'), EXPORT_SCALE, null);
		redraw(); // restore preview hit boxes
		return c;
	}

	function download() {
		const a = document.createElement('a');
		a.href = exportCanvas().toDataURL('image/png');
		a.download = 'graph.png';
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	function copyToClipboard() {
		exportCanvas().toBlob(async (blob) => {
			try {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				copyStatus.textContent = 'Copied!';
			} catch {
				copyStatus.textContent = 'Copy failed — use Download instead.';
			}
			setTimeout(() => (copyStatus.textContent = ''), 2500);
		});
	}

	/* Dragging text items */
	let drag = null;
	const toGraph = (e) => {
		const r = canvas.getBoundingClientRect();
		return { x: (e.clientX - r.left) / displayScale, y: (e.clientY - r.top) / displayScale };
	};
	const hitAt = (p) => [...hitBoxes].reverse().find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
	canvas.addEventListener('pointerdown', (e) => {
		const p = toGraph(e);
		const hit = hitAt(p);
		if (!hit) return;
		const off = state.offsets[hit.key] || { dx: 0, dy: 0 };
		drag = { key: hit.key, start: p, off: { ...off } };
		canvas.setPointerCapture(e.pointerId);
	});
	canvas.addEventListener('pointermove', (e) => {
		const p = toGraph(e);
		if (drag) {
			state.offsets[drag.key] = { dx: drag.off.dx + p.x - drag.start.x, dy: drag.off.dy + p.y - drag.start.y };
			redraw();
		} else canvas.style.cursor = hitAt(p) ? 'move' : 'default';
	});
	canvas.addEventListener('pointerup', () => (drag = null));
	canvas.addEventListener('pointercancel', () => (drag = null));

	const previewBox = el('div', { class: 'agm-preview' }, canvas);
	const side = el(
		'div',
		{ class: 'agm-side' },
		el('p', { class: 'agm-hint', text: 'Use the mouse to reposition the labels, captions, annotations and legend.' }),
		el(
			'div',
			{ class: 'agm-export' },
			HT.button({ cls: 'btn-dark', icon: 'fileExport', text: 'Download', onclick: download }),
			HT.button({ cls: 'btn-dark', icon: 'fileCopy', text: 'Copy to Clipboard', onclick: copyToClipboard })
		),
		copyStatus,
		sizeNote,
		HT.button({ cls: 'btn-alt', icon: 'refresh', text: 'Reset text positions', onclick: () => ((state.offsets = {}), redraw()) })
	);

	/* ================================================================== */
	/* Settings UI                                                        */
	/* ================================================================== */

	const on = (fn) => () => {
		fn();
		redraw();
	};

	function text(obj, key, attrs = {}) {
		return el('input', {
			type: 'text',
			spellcheck: 'false',
			class: 'agm-in ' + (attrs.cls || ''),
			value: obj[key],
			placeholder: attrs.placeholder || '',
			'aria-label': attrs.label || key,
			oninput: (e) => {
				obj[key] = e.target.value;
				redraw();
			}
		});
	}

	function select(obj, key, options, { label, numeric = false, onchange } = {}) {
		const s = el(
			'select',
			{
				class: 'agm-sel',
				'aria-label': label || key,
				onchange: (e) => {
					obj[key] = numeric ? Number(e.target.value) : e.target.value;
					if (onchange) onchange();
					redraw();
				}
			},
			options.map(([v, t]) => el('option', { value: String(v), text: t }))
		);
		s.value = String(obj[key]);
		return s;
	}

	function color(obj, key, label) {
		return el('input', {
			type: 'color',
			class: 'agm-color',
			list: 'agm-palette',
			value: obj[key],
			'aria-label': label || 'color',
			oninput: (e) => {
				obj[key] = e.target.value;
				redraw();
			}
		});
	}

	function toggle(obj, key, label, onchange) {
		const box = el('input', {
			type: 'checkbox',
			onchange: (e) => {
				obj[key] = e.target.checked;
				if (onchange) onchange();
				redraw();
			}
		});
		box.checked = !!obj[key];
		return el('label', { class: 'toggle agm-toggle' }, box, el('span', { class: 'track' }), el('span', { class: 'toggle-label', text: label }));
	}

	const widthSel = (obj, key = 'w', label = 'width') => select(obj, key, WIDTHS.map((w) => [w, `${w} px`]), { label, numeric: true });
	const fontSel = (obj, key = 'size', label = 'font size') => select(obj, key, FONT_SIZES.map((v) => [v, `${v} pt`]), { label, numeric: true });
	const dashSel = (obj, key = 'dash') => select(obj, key, DASHES, { label: 'dash style' });
	const styleRow = (st) => el('div', { class: 'agm-inline' }, widthSel(st), color(st, 'color'), dashSel(st));

	const field = (label, ...controls) => el('div', { class: 'agm-field' }, el('span', { class: 'agm-label', text: label }), el('div', { class: 'agm-inline' }, controls));

	function section(title, body, open = false) {
		const d = el('details', { class: 'agm-sec' }, el('summary', { text: title }), el('div', { class: 'agm-body' }, body));
		d.open = open;
		return d;
	}

	/* -------- Background -------- */
	const bgSection = section('Background', [
		el('div', { class: 'agm-row' }, field('Transparent?', toggle(state.bg, 'transparent', 'transparent background')), field('Background color', color(state.bg, 'color')))
	]);

	/* -------- Plot size -------- */
	const s = state.size;
	const sizeSection = section('Plot Size & Margins', [
		el(
			'div',
			{ class: 'agm-row' },
			field('Width × Height', text(s, 'w', { cls: 'w4' }), ' × ', text(s, 'h', { cls: 'w4' })),
			field('Left margin', text(s, 'ml', { cls: 'w4' })),
			field('Right margin', text(s, 'mr', { cls: 'w4' })),
			field('Top margin', text(s, 'mt', { cls: 'w4' })),
			field('Bottom margin', text(s, 'mb', { cls: 'w4' }))
		),
		el('p', { class: 'agm-help', text: 'Width and height are for the grid itself, in pixels. Downloads are saved at 2× for sharp printing.' })
	]);

	/* -------- Grid -------- */
	const g = state.grid;
	const axisRow = (ax, name) =>
		el(
			'div',
			{ class: 'agm-row' },
			field(`Viewing region (${name})`, text(g[ax], 'min', { cls: 'w5' }), ` ≤ ${name} ≤ `, text(g[ax], 'max', { cls: 'w5' })),
			field('Grid lines every', text(g[ax], 'minor', { cls: 'w4' })),
			field('Major lines every', text(g[ax], 'major', { cls: 'w4' })),
			field('Labels every', text(g[ax], 'labels', { cls: 'w4' }))
		);
	const gridSection = section(
		'Grid',
		[
			axisRow('x', 'x'),
			axisRow('y', 'y'),
			el(
				'div',
				{ class: 'agm-row' },
				field('Ticks or gridlines?', select(g, 'mode', [['full', 'Full gridlines'], ['ticks', 'Ticks only'], ['none', 'None']])),
				field('Gridline style', widthSel(g, 'lineW'), color(g, 'lineColor')),
				field('Gridline label style', fontSel(g, 'labelSize'), color(g, 'labelColor'))
			),
			el(
				'div',
				{ class: 'agm-row' },
				field('Label for x-axis', text(g, 'xLabel', { cls: 'w8' })),
				field('Label for y-axis', text(g, 'yLabel', { cls: 'w8' })),
				field('Axis style', widthSel(g, 'axisW'), color(g, 'axisColor')),
				field('Axis label style', fontSel(g, 'axisLabelSize'), color(g, 'axisLabelColor'))
			)
		],
		true
	);

	/* -------- Plots -------- */
	const plotList = el('div', { class: 'agm-plots' });
	const typeMenu = el('div', { class: 'agm-menu', hidden: true });
	PLOT_TYPES.forEach(([t, name]) =>
		typeMenu.appendChild(
			el('button', {
				type: 'button',
				text: name,
				onclick: () => {
					typeMenu.hidden = true;
					state.plots.push(newPlot(t));
					renderPlots();
					redraw();
				}
			})
		)
	);
	const addPlotBtn = HT.button({ cls: 'btn-blue', icon: 'plusCircle', text: 'Add New Plot', onclick: () => (typeMenu.hidden = !typeMenu.hidden) });
	const removeAllBtn = HT.button({
		cls: 'btn-red',
		icon: 'trash',
		text: 'Remove All Plots',
		onclick: () => {
			state.plots = [];
			renderPlots();
			redraw();
		}
	});
	document.addEventListener('click', (e) => {
		if (!typeMenu.hidden && !typeMenu.contains(e.target) && !addPlotBtn.contains(e.target)) typeMenu.hidden = true;
	});

	function pointsEditor(plot) {
		const grid = el(
			'div',
			{ class: 'agm-points' },
			plot.points.map((p) => el('div', { class: 'agm-pt' }, '(', text(p, 'x', { cls: 'w4', label: 'x' }), ',', text(p, 'y', { cls: 'w4', label: 'y' }), ')'))
		);
		const area = el('textarea', {
			class: 'agm-in agm-area',
			rows: '5',
			placeholder: 'One point per line, e.g.\n1, 2\n3, 4.5',
			oninput: (e) => {
				plot.list = e.target.value;
				redraw();
			}
		});
		area.value = plot.list;
		const showMode = () => {
			grid.hidden = plot.method !== 'points';
			area.hidden = plot.method !== 'list';
		};
		showMode();
		return [
			field('Input method', select(plot, 'method', [['points', 'Individual points'], ['list', 'One long list']], { onchange: showMode })),
			el('div', { class: 'agm-field' }, el('span', { class: 'agm-label', text: 'Points (x, y)' }), grid, area)
		];
	}

	function plotBody(plot) {
		const st = plot.style;
		const arrows = (label = 'Edge arrows?') => field(label, toggle(plot, 'edgeArrows', 'Plot arrows'));
		switch (plot.type) {
			case 'function':
				return [field('f(x)', text(plot, 'expr', { cls: 'w16', placeholder: 'e.g. x^2 - 3' })), el('div', { class: 'agm-row' }, arrows(), field('Plot style', styleRow(st)))];
			case 'conic':
				return [
					field('Curve', text(plot, 'expr', { cls: 'w16', placeholder: 'e.g. x^2/9 + y^2/4 = 1' })),
					el('div', { class: 'agm-row' }, arrows(), field('Plot style', styleRow(st)))
				];
			case 'polar':
				return [
					el('div', { class: 'agm-row' }, field('r(θ)', text(plot, 'expr', { cls: 'w16', placeholder: 'e.g. 2 + 2cos(θ)' })), field('Domain', text(plot, 'tmin', { cls: 'w5' }), ' ≤ θ ≤ ', text(plot, 'tmax', { cls: 'w5' }))),
					el('div', { class: 'agm-row' }, arrows(), field('Plot style', styleRow(st)))
				];
			case 'parametric':
				return [
					el(
						'div',
						{ class: 'agm-row' },
						field('x(t)', text(plot, 'xexpr', { cls: 'w10', placeholder: 'e.g. 3cos(t)' })),
						field('y(t)', text(plot, 'yexpr', { cls: 'w10', placeholder: 'e.g. 3sin(t)' })),
						field('Domain', text(plot, 'tmin', { cls: 'w5' }), ' ≤ t ≤ ', text(plot, 'tmax', { cls: 'w5' }))
					),
					el('div', { class: 'agm-row' }, field('Plot style', styleRow(st)), field('Direction arrows', select(plot, 'dirArrows', [0, 1, 2, 3, 4].map((n) => [n, String(n)]), { numeric: true })))
				];
			case 'scatter': {
				const m = plot.marker;
				return [
					...pointsEditor(plot),
					field('Marker style', select(m, 'shape', SHAPES), color(m, 'color'), select(m, 'size', MARKER_SIZES.map((v) => [v, `${v} px`]), { numeric: true }))
				];
			}
			case 'piecewise':
				return [
					el('div', { class: 'agm-pw-head' }, el('span', { class: 'agm-label', text: 'f(x)' }), el('span', { class: 'agm-label', text: 'if' })),
					...plot.rows.map((r) => {
						const lo = text(r, 'lo', { cls: 'w5', label: 'lower bound' });
						const showLo = () => (lo.style.visibility = r.op.length === 4 ? 'visible' : 'hidden');
						showLo();
						return el('div', { class: 'agm-pw-row' }, text(r, 'expr', { cls: 'w14', label: 'f(x)' }), lo, select(r, 'op', OPS, { label: 'operator', onchange: showLo }), text(r, 'hi', { cls: 'w5', label: 'upper bound' }));
					}),
					el(
						'div',
						{ class: 'agm-row' },
						arrows(),
						field('Plot style', styleRow(st)),
						field('Endpoints', toggle(plot, 'showEnds', 'show endpoints?')),
						field('Endpoint size', select(plot, 'endSize', MARKER_SIZES.map((v) => [v, `${v} px`]), { numeric: true }))
					)
				];
			case 'asymptotes':
				return [
					field('Vertical asymptotes', ...plot.vx.map((_, i) => el('span', { class: 'agm-inline' }, 'x = ', text(plot.vx, i, { cls: 'w5' })))),
					field('Horizontal/slant asymptotes', ...plot.hy.map((_, i) => el('span', { class: 'agm-inline' }, 'y = ', text(plot.hy, i, { cls: 'w8' })))),
					el('div', { class: 'agm-row' }, arrows(), field('Asymptote style', styleRow(st)))
				];
			case 'polygon':
				return [
					...pointsEditor(plot),
					el(
						'div',
						{ class: 'agm-row' },
						field('Outline style', styleRow(st)),
						field('Close polygon?', toggle(plot, 'close', 'Close Polygon?')),
						field('Fill style', select(plot, 'fill', [['none', 'None'], ['filled', 'Solid'], ['semi', 'Semi-transparent']]), color(plot, 'fillColor'))
					)
				];
			case 'slopefield':
				return [
					el('div', { class: 'agm-row' }, field('dy/dx', text(plot, 'expr', { cls: 'w12', placeholder: 'e.g. x - y' })), field('Spacing (x)', text(plot, 'sx', { cls: 'w4' })), field('Spacing (y)', text(plot, 'sy', { cls: 'w4' }))),
					field('Segment style', styleRow(st))
				];
			case 'vectors':
				return [
					el('div', { class: 'agm-vec-head' }, el('span', { class: 'agm-label', text: 'Tails' }), el('span', { class: 'agm-label', text: 'Heads' })),
					el(
						'div',
						{ class: 'agm-vecs' },
						plot.rows.map((r) =>
							el(
								'div',
								{ class: 'agm-vec' },
								el('span', { class: 'agm-pt' }, '(', text(r, 'tx', { cls: 'w4' }), ',', text(r, 'ty', { cls: 'w4' }), ')'),
								el('span', { text: '→' }),
								el('span', { class: 'agm-pt' }, '(', text(r, 'hx', { cls: 'w4' }), ',', text(r, 'hy', { cls: 'w4' }), ')')
							)
						)
					),
					field('Vector style', styleRow(st))
				];
			case 'step':
				return [
					field('Which step function?', select(plot, 'kind', [['floor', 'Greatest Integer (a.k.a. Floor)'], ['ceiling', 'Least Integer (a.k.a. Ceiling)']])),
					el(
						'div',
						{ class: 'agm-row' },
						field('Vertical stretch', text(plot, 'a', { cls: 'w4' })),
						field('Vertical shift', text(plot, 'k', { cls: 'w4' })),
						field('Horizontal stretch', text(plot, 'b', { cls: 'w4' })),
						field('Horizontal shift', text(plot, 'h', { cls: 'w4' }))
					),
					el('p', { class: 'agm-help', text: 'y = a · ⌊b(x − h)⌋ + k  (vertical stretch a, vertical shift k, horizontal stretch b, horizontal shift h)' }),
					el('div', { class: 'agm-row' }, field('Plot style', styleRow(st)), field('Endpoint size', select(plot, 'endSize', MARKER_SIZES.map((v) => [v, `${v} px`]), { numeric: true })))
				];
		}
		return [];
	}

	function renderPlots() {
		plotList.replaceChildren();
		removeAllBtn.hidden = state.plots.length === 0;
		state.plots.forEach((plot, i) => {
			const move = (d) => {
				const j = i + d;
				if (j < 0 || j >= state.plots.length) return;
				[state.plots[i], state.plots[j]] = [state.plots[j], state.plots[i]];
				renderPlots();
				redraw();
			};
			const link = (label, fn, tip) => el('button', { type: 'button', class: 'agm-link', text: label, title: tip || '', onclick: fn });
			const head = el(
				'div',
				{ class: 'agm-plot-head' },
				el('span', { class: 'agm-plot-title', text: `Plot ${i + 1}: ${TYPE_NAME[plot.type]}` }),
				el(
					'span',
					{ class: 'agm-plot-actions' },
					link('↑', () => move(-1), 'Move up'),
					link('↓', () => move(1), 'Move down'),
					link(plot.hidden ? 'SHOW' : 'HIDE', () => {
						plot.hidden = !plot.hidden;
						renderPlots();
						redraw();
					}),
					link('DUPLICATE', () => {
						const copy = HT.clone(plot);
						copy.id = ++plotSeq;
						state.plots.splice(i + 1, 0, copy);
						renderPlots();
						redraw();
					}),
					link('REMOVE', () => {
						state.plots.splice(i, 1);
						renderPlots();
						redraw();
					})
				)
			);
			const card = el('div', { class: 'agm-plot' + (plot.hidden ? ' is-hidden' : '') }, head, el('div', { class: 'agm-plot-body' }, plotBody(plot), el('p', { class: 'agm-err', 'data-pid': plot.id })));
			plotList.appendChild(card);
		});
		renderLegendFields();
	}

	const plotsSection = section(
		'Plots',
		[
			el('div', { class: 'agm-inline agm-add' }, el('div', { class: 'agm-menu-wrap' }, addPlotBtn, typeMenu), removeAllBtn),
			plotList,
			el('p', { class: 'agm-help', text: 'Type math the way you write it: 2x^2 - 3x + 1, sqrt(x), |x|, sin(2x), e^x, ln(x), pi or π. Use θ (or theta) for polar and t for parametric.' })
		],
		true
	);

	/* -------- Shading -------- */
	const shadingSection = section('Shading', [
		el('p', { class: 'agm-help', text: 'Pick a point inside the region to shade. The region is bounded by the axes and your plots.' }),
		el(
			'div',
			{ class: 'agm-shade-grid' },
			el('span', { class: 'agm-label', text: 'Point in shaded area' }),
			el('span', { class: 'agm-label', text: 'Shade color' }),
			el('span', { class: 'agm-label', text: 'Opacity' }),
			state.shading.flatMap((a) => [
				el('span', { class: 'agm-pt' }, '(', text(a, 'x', { cls: 'w4' }), ',', text(a, 'y', { cls: 'w4' }), ')'),
				color(a, 'color'),
				select(a, 'opacity', [['normal', 'Normal'], ['darker', 'Darker']])
			])
		)
	]);

	/* -------- Captions -------- */
	const capRow = (key, name) => field(name, text(state.captions[key], 'text', { cls: 'w16' }), fontSel(state.captions[key]), color(state.captions[key], 'color'));
	const captionsSection = section('Captions', [capRow('top', 'Top caption'), capRow('bottom', 'Bottom caption'), capRow('left', 'Left caption'), capRow('right', 'Right caption')]);

	/* -------- Annotations -------- */
	const annotationsSection = section('Annotations', [
		el('div', { class: 'agm-ann-head' }, el('span', { class: 'agm-label', text: 'Annotation text' }), el('span', { class: 'agm-label', text: 'Style' })),
		...state.annotations.map((a, i) => el('div', { class: 'agm-inline agm-ann' }, text(a, 'text', { cls: 'w16', label: `annotation ${i + 1}` }), fontSel(a), color(a, 'color'))),
		el('p', { class: 'agm-help', text: 'Annotations start near the middle of the graph. Drag them where you want them.' })
	]);

	/* -------- Legend -------- */
	const legendFields = el('div');
	function renderLegendFields() {
		legendFields.replaceChildren();
		if (!state.plots.length) {
			legendFields.appendChild(el('p', { class: 'agm-help', text: 'More legend settings will be visible when you add some plots to the graph.' }));
			return;
		}
		state.plots.forEach((p, i) => legendFields.appendChild(field(`Plot ${i + 1} Legend`, text(p, 'legend', { cls: 'w16', placeholder: TYPE_NAME[p.type] }))));
	}
	const legendSection = section('Legend', [field('Text style', fontSel(state.legend), color(state.legend, 'color')), legendFields]);

	/* -------- Special characters -------- */
	const charStatus = el('span', { class: 'agm-status' });
	let lastInput = null;
	document.addEventListener('focusin', (e) => {
		if (e.target.matches && e.target.matches('input.agm-in, textarea.agm-in')) lastInput = e.target;
	});
	const charsSection = section('Special Characters', [
		el('p', { class: 'agm-help', text: 'Click a character to copy it to the clipboard, then paste it into any text box (axis labels, captions, etc.).' }),
		el(
			'div',
			{ class: 'agm-chars' },
			SPECIAL_CHARS.map((ch) =>
				el('button', {
					type: 'button',
					class: 'agm-char',
					text: ch,
					onclick: async () => {
						try {
							await navigator.clipboard.writeText(ch);
							charStatus.textContent = `Copied ${ch}`;
						} catch {
							charStatus.textContent = 'Clipboard unavailable';
						}
						setTimeout(() => (charStatus.textContent = ''), 1500);
					}
				})
			)
		),
		charStatus
	]);

	const palette = el('datalist', { id: 'agm-palette' }, PALETTE.map((c) => el('option', { value: c })));

	/* -------- Assemble page -------- */
	const page = el(
		'div',
		{ class: 'agm' },
		palette,
		el('h1', { class: 'agm-title', text: 'Advanced Graph Maker' }),
		el('div', { class: 'agm-top' }, previewBox, side),
		el('div', { class: 'agm-settings' }, bgSection, sizeSection, gridSection, plotsSection, shadingSection, captionsSection, annotationsSection, legendSection, charsSection)
	);
	document.querySelector('.content').appendChild(page);

	HT.onResize(redraw);
	renderPlots();
	redraw();

	// handy for testing from the console
	HT.agm = { state, redraw, newPlot, renderPlots, exportCanvas };
})();
