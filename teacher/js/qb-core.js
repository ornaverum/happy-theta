/* Theta Questions — question model, expression evaluator, randomizer, tags, filters.
   Shared by questions.html (the bank) and quiz-builder.html (Canvas export). Pure logic: also runs in Node
   (module.exports), which the tests use.

   A question:
   { id, type: 'mc' | 'ma' | 'num' | 'match', title, stem, image: {name, mime, data} | null, points,
     choices:  [{ id, text, correct, feedback }]                      mc (one correct) / ma (one or more)
     answer:   { expr, unit, tol, tolMode: '%' | 'abs', sigfigs }      num: expr is a number or a formula
     pairs:    [{ id, left, right }], distractors: [text]               match
     vars:     [{ name, min, max, step }]     random inputs (min = max → a constant)
     calcs:    [{ name, expr }]               worked values, in order (may use vars and earlier calcs)
     constraint: expr                          re-roll until this is true (non-zero), e.g. "v1 > v0"
     shuffle, feedback: { correct, incorrect, general }, solution,
     tags: { unit, topics: [], objectives: [{ fw, code }], difficulty: 0..5, custom: [] },
     source: { kind, name } | null, lib: { id, version, owner, sig } | null, created, modified }

   Text fields use a small markup: **bold**, *italic*, ^sup^, ~sub~, `code`, LaTeX in \( … \) or \[ … \],
   and templates: {v0} (a variable or calc), {v0:2f} / {v0:3s} (fixed decimals / sig figs),
   {=2*v0*t} (any expression, same format suffixes). */
(function () {
	'use strict';
	const G = typeof window !== 'undefined' ? window : globalThis;
	const HT = (G.HT = G.HT || {});
	const QB = {};
	HT.QB_VERSION = '2026-11-19b'; // cache-buster for files loaded on demand (framework seeds)

	QB.TYPES = { mc: 'Multiple choice', ma: 'Multiple answer', num: 'Numerical', match: 'Matching' };
	QB.TYPE_SHORT = { mc: 'MC', ma: 'MA', num: 'NUM', match: 'MATCH' };
	QB.DIFFICULTY = ['', 'Very easy', 'Easy', 'Medium', 'Hard', 'Very hard'];

	const rid = (p) => p + '_' + Math.random().toString(36).slice(2, 10);
	QB.newId = rid;
	const now = () => new Date().toISOString();
	const str = (v, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
	const num = (v, d = null) => {
		if (v === '' || v == null) return d;
		const n = Number(v);
		return Number.isFinite(n) ? n : d;
	};
	const uniq = (a) => [...new Set(a.filter(Boolean))];

	/* =====================================================================
	   Expressions: + - * / ^ (or **), unary minus, parentheses, functions,
	   constants pi and e. Trig in radians; sind/cosd/tand/asind/… in degrees.
	   ===================================================================== */
	const FUNCS = {
		sin: [1, Math.sin], cos: [1, Math.cos], tan: [1, Math.tan],
		asin: [1, Math.asin], acos: [1, Math.acos], atan: [1, Math.atan], atan2: [2, Math.atan2],
		sind: [1, (x) => Math.sin((x * Math.PI) / 180)], cosd: [1, (x) => Math.cos((x * Math.PI) / 180)], tand: [1, (x) => Math.tan((x * Math.PI) / 180)],
		asind: [1, (x) => (Math.asin(x) * 180) / Math.PI], acosd: [1, (x) => (Math.acos(x) * 180) / Math.PI], atand: [1, (x) => (Math.atan(x) * 180) / Math.PI],
		sqrt: [1, Math.sqrt], abs: [1, Math.abs], ln: [1, Math.log], log: [1, Math.log10], exp: [1, Math.exp],
		floor: [1, Math.floor], ceil: [1, Math.ceil],
		round: [[1, 2], (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n],
		min: [[1, 20], Math.min], max: [[1, 20], Math.max], pow: [2, Math.pow]
	};
	const CONSTS = { pi: Math.PI, e: Math.E };
	QB.FUNCTIONS = Object.keys(FUNCS);
	const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
	QB.isName = (s) => IDENT.test(s) && !(s in FUNCS) && !(s in CONSTS);

	function tokenize(src) {
		const out = [];
		let i = 0;
		const s = String(src);
		while (i < s.length) {
			const c = s[i];
			if (/\s/.test(c)) { i++; continue; }
			const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
			if (m) { out.push({ t: 'num', v: Number(m[0]), at: i }); i += m[0].length; continue; }
			const w = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
			if (w) { out.push(w[0] === 'and' || w[0] === 'or' ? { t: 'op', v: w[0], at: i } : { t: 'id', v: w[0], at: i }); i += w[0].length; continue; }
			if (s.startsWith('**', i)) { out.push({ t: 'op', v: '^', at: i }); i += 2; continue; }
			const two = s.slice(i, i + 2);
			if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two === '&&' ? 'and' : two === '||' ? 'or' : two, at: i }); i += 2; continue; }
			if (c === '<' || c === '>' || c === '≤' || c === '≥' || c === '≠') { out.push({ t: 'op', v: c === '≤' ? '<=' : c === '≥' ? '>=' : c === '≠' ? '!=' : c, at: i }); i++; continue; }
			if ('+-*/^(),'.includes(c)) { out.push({ t: 'op', v: c, at: i }); i++; continue; }
			if (c === '×' || c === '·') { out.push({ t: 'op', v: '*', at: i }); i++; continue; }
			if (c === '−') { out.push({ t: 'op', v: '-', at: i }); i++; continue; }
			if (c === 'π') { out.push({ t: 'id', v: 'pi', at: i }); i++; continue; }
			throw new Error(`Unexpected "${c}"`);
		}
		return out;
	}

	QB.parse = function (src) {
		const toks = tokenize(src);
		let p = 0;
		const peek = () => toks[p];
		const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
		const expect = (v) => {
			if (!isOp(v)) throw new Error(peek() ? `Expected "${v}" near "${String(src).slice(peek().at, peek().at + 8)}"` : `Expected "${v}" at the end`);
			p++;
		};
		function expr() {
			let a = andExpr();
			while (isOp('or')) { p++; a = { t: 'bin', op: 'or', a, b: andExpr() }; }
			return a;
		}
		function andExpr() {
			let a = cmp();
			while (isOp('and')) { p++; a = { t: 'bin', op: 'and', a, b: cmp() }; }
			return a;
		}
		function cmp() {
			let a = sum();
			while (['<', '>', '<=', '>=', '==', '!='].some(isOp)) { const op = toks[p++].v; a = { t: 'bin', op, a, b: sum() }; }
			return a;
		}
		function sum() {
			let a = term();
			while (isOp('+') || isOp('-')) { const op = toks[p++].v; a = { t: 'bin', op, a, b: term() }; }
			return a;
		}
		function term() {
			let a = unary();
			while (isOp('*') || isOp('/')) { const op = toks[p++].v; a = { t: 'bin', op, a, b: unary() }; }
			return a;
		}
		function unary() {
			if (isOp('-')) { p++; return { t: 'neg', a: unary() }; }
			if (isOp('+')) { p++; return unary(); }
			return power();
		}
		function power() {
			const base = primary();
			if (isOp('^')) { p++; return { t: 'bin', op: '^', a: base, b: unary() }; }
			return base;
		}
		function primary() {
			const k = peek();
			if (!k) throw new Error('The expression ends too soon');
			if (k.t === 'num') { p++; return { t: 'num', v: k.v }; }
			if (k.t === 'id') {
				p++;
				if (isOp('(')) {
					if (!FUNCS[k.v]) throw new Error(`Unknown function "${k.v}"`);
					p++;
					const args = [];
					if (!isOp(')')) { args.push(expr()); while (isOp(',')) { p++; args.push(expr()); } }
					expect(')');
					const ar = FUNCS[k.v][0];
					const [lo, hi] = Array.isArray(ar) ? ar : [ar, ar];
					if (args.length < lo || args.length > hi) throw new Error(`${k.v}() takes ${lo === hi ? lo : lo + '–' + hi} value${hi > 1 ? 's' : ''}`);
					return { t: 'call', f: k.v, args };
				}
				if (k.v in CONSTS) return { t: 'const', n: k.v };
				if (FUNCS[k.v]) throw new Error(`${k.v} needs parentheses: ${k.v}(…)`);
				return { t: 'var', n: k.v };
			}
			if (isOp('(')) { p++; const e = expr(); expect(')'); return e; }
			throw new Error(`Unexpected "${k.v}"`);
		}
		if (!toks.length) throw new Error('Empty expression');
		const ast = expr();
		if (p < toks.length) throw new Error(`Unexpected "${toks[p].v}"`);
		return ast;
	};

	QB.evalAst = function (n, scope) {
		switch (n.t) {
			case 'num': return n.v;
			case 'const': return CONSTS[n.n];
			case 'var':
				if (!(n.n in scope)) throw new Error(`Unknown name "${n.n}"`);
				return scope[n.n];
			case 'neg': return -QB.evalAst(n.a, scope);
			case 'call': return FUNCS[n.f][1](...n.args.map((a) => QB.evalAst(a, scope)));
			case 'bin': {
				const a = QB.evalAst(n.a, scope), b = QB.evalAst(n.b, scope);
				switch (n.op) {
					case '+': return a + b;
					case '-': return a - b;
					case '*': return a * b;
					case '/': return a / b;
					case '^': return Math.pow(a, b);
					case '<': return +(a < b);
					case '>': return +(a > b);
					case '<=': return +(a <= b);
					case '>=': return +(a >= b);
					case '==': return +(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
					case '!=': return +!(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
					case 'and': return +(!!a && !!b);
					case 'or': return +(!!a || !!b);
				}
				return NaN;
			}
		}
		throw new Error('Bad expression');
	};
	QB.evaluate = (src, scope = {}) => QB.evalAst(QB.parse(src), scope);
	QB.namesIn = function (ast, out = new Set()) {
		if (ast.t === 'var') out.add(ast.n);
		for (const k of ['a', 'b']) if (ast[k]) QB.namesIn(ast[k], out);
		if (ast.args) ast.args.forEach((x) => QB.namesIn(x, out));
		return out;
	};

	/* Canvas formula syntax (classic Formula questions). Canvas trig is radians; log is base 10. */
	QB.toCanvas = function (n) {
		const P = (x) => '(' + QB.toCanvas(x) + ')';
		switch (n.t) {
			case 'num': return String(n.v);
			case 'const': return n.n;
			case 'var': return n.n;
			case 'neg': return '-' + P(n.a);
			case 'bin':
				if (!'+-*/^'.includes(n.op)) throw new Error('Canvas formulas can\'t use comparisons');
				return P(n.a) + n.op + P(n.b);
			case 'call': {
				const a = n.args.map(QB.toCanvas);
				if (/^(sin|cos|tan)d$/.test(n.f)) return `${n.f.slice(0, 3)}((${a[0]})*pi/180)`;
				if (/^a(sin|cos|tan)d$/.test(n.f)) return `(${n.f.slice(0, 4)}(${a[0]})*180/pi)`;
				if (n.f === 'pow') return `(${a[0]})^(${a[1]})`;
				if (n.f === 'round' && a.length === 2) return `(round((${a[0]})*10^(${a[1]}))/10^(${a[1]}))`;
				return `${n.f}(${a.join(',')})`;
			}
		}
		return '';
	};

	/* =====================================================================
	   Number formatting
	   ===================================================================== */
	QB.fmtSig = function (x, n = 3) {
		if (!Number.isFinite(x)) return String(x);
		if (x === 0) return n > 1 ? '0.' + '0'.repeat(n - 1) : '0';
		const e = Math.floor(Math.log10(Math.abs(x)));
		if (e >= 6 || e < -3) {
			const [m, ex] = x.toExponential(Math.max(0, n - 1)).split('e');
			return `${m} × 10^${Number(ex)}^`;
		}
		const s = x.toPrecision(n);
		return s.includes('e') ? String(Math.round(x)) : s;
	};
	QB.fmtFixed = (x, d) => (Number.isFinite(x) ? x.toFixed(Math.max(0, Math.min(10, d))) : String(x));
	/* Plain number for answers/var sets: ~12 significant digits, no float noise. */
	QB.clean = (x) => (Number.isFinite(x) ? Number(x.toPrecision(12)) : x);
	QB.decimalsOf = function (x) {
		const s = String(x);
		if (/e-/i.test(s)) return Number(s.split(/e-/i)[1]) + ((s.split(/e/i)[0].split('.')[1] || '').length);
		return (s.split('.')[1] || '').length;
	};
	/* Decimal places that show `sig` significant figures of a value like x. */
	QB.decimalsForSig = (x, sig = 3) => (x === 0 || !Number.isFinite(x) ? Math.max(0, sig - 1) : Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(x)))));

	/* =====================================================================
	   Random values
	   ===================================================================== */
	QB.rng = function (seed) {
		let a = seed == null ? (Math.random() * 2 ** 32) >>> 0 : seed >>> 0;
		return () => {
			a = (a + 0x6d2b79f5) >>> 0;
			let t = a;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	};
	QB.varStep = (v) => (num(v.step) > 0 ? num(v.step) : 1);
	QB.varDecimals = (v) => Math.max(QB.decimalsOf(num(v.min, 0)), QB.decimalsOf(num(v.max, 0)), QB.decimalsOf(QB.varStep(v)));
	QB.drawVar = function (v, rnd) {
		const lo = num(v.min, 0), hi = num(v.max, lo), step = QB.varStep(v);
		if (hi <= lo) return lo;
		const n = Math.floor((hi - lo) / step + 1e-9);
		return Number((lo + Math.floor(rnd() * (n + 1)) * step).toFixed(QB.varDecimals(v)));
	};
	QB.isRandom = (q) => (q.vars || []).some((v) => num(v.max, 0) > num(v.min, 0));
	QB.hasMath = (q) => (q.vars || []).length > 0 || (q.calcs || []).length > 0 || (q.type === 'num' && q.answer && !isNumberText(q.answer.expr));
	const isNumberText = (s) => /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(String(s == null ? '' : s));
	QB.isNumberText = isNumberText;

	/* Values for one roll: { scope, ok } (ok false when the constraint never held). */
	QB.roll = function (q, seed) {
		const rnd = QB.rng(seed);
		let scope, ok = true;
		for (let tries = 0; tries < 300; tries++) {
			scope = {};
			for (const v of q.vars || []) if (v.name) scope[v.name] = QB.drawVar(v, rnd);
			for (const c of q.calcs || []) if (c.name && c.expr) scope[c.name] = QB.evaluate(c.expr, scope);
			if (!q.constraint || !String(q.constraint).trim()) return { scope, ok };
			if (QB.evaluate(q.constraint, scope)) return { scope, ok };
		}
		ok = false;
		return { scope, ok };
	};
	/* The first roll: every variable at its minimum (what a static preview shows). */
	QB.baseScope = function (q) {
		const scope = {};
		for (const v of q.vars || []) if (v.name) scope[v.name] = num(v.min, 0);
		for (const c of q.calcs || []) if (c.name && c.expr) try { scope[c.name] = QB.evaluate(c.expr, scope); } catch { scope[c.name] = NaN; }
		return scope;
	};

	/* Fill {name}, {name:3s}, {=expr:2f} in a text. Names that aren't variables are left alone (LaTeX braces). */
	QB.fillTemplate = function (text, scope, q) {
		const varDec = {};
		for (const v of (q && q.vars) || []) varDec[v.name] = QB.varDecimals(v);
		const sig = (q && q.answer && num(q.answer.sigfigs)) || 3;
		const fmt = (val, spec, name) => {
			const m = /^(\d+)([sf])$/.exec(spec || '');
			if (m) return m[2] === 's' ? QB.fmtSig(val, Number(m[1])) : QB.fmtFixed(val, Number(m[1]));
			if (name != null && name in varDec) return QB.fmtFixed(val, varDec[name]);
			return QB.fmtSig(val, sig);
		};
		return String(text || '').replace(/\{(=[^{}]+?|[A-Za-z_][A-Za-z0-9_]*)(?::(\d+[sf]))?\}/g, (all, body, spec) => {
			if (body[0] === '=') {
				try { return fmt(QB.evaluate(body.slice(1), scope), spec); } catch { return all; }
			}
			if (!(body in scope)) return all;
			return fmt(scope[body], spec, body);
		});
	};
	QB.templateNames = function (text) {
		const out = new Set();
		String(text || '').replace(/\{(=[^{}]+?|[A-Za-z_][A-Za-z0-9_]*)(?::\d+[sf])?\}/g, (all, body) => {
			if (body[0] === '=') try { QB.namesIn(QB.parse(body.slice(1)), out); } catch {}
			else out.add(body);
		});
		return out;
	};
	QB.hasExprTemplate = (text) => /\{=[^{}]+\}/.test(String(text || ''));

	/* =====================================================================
	   Questions
	   ===================================================================== */
	QB.blank = function (type = 'mc') {
		const t = now();
		const q = {
			id: rid('q'), type, title: '', stem: '', image: null, points: 1,
			choices: [], answer: { expr: '', unit: '', tol: 2, tolMode: '%', sigfigs: 3 }, pairs: [], distractors: [],
			vars: [], calcs: [], constraint: '', shuffle: true,
			feedback: { correct: '', incorrect: '', general: '' }, solution: '',
			tags: { unit: '', topics: [], objectives: [], difficulty: 0, custom: [] },
			source: null, lib: null, created: t, modified: t
		};
		if (type === 'mc' || type === 'ma') q.choices = [0, 1, 2, 3].map((i) => ({ id: rid('c'), text: '', correct: i === 0, feedback: '' }));
		if (type === 'match') q.pairs = [0, 1, 2].map(() => ({ id: rid('p'), left: '', right: '' }));
		return q;
	};

	QB.normalize = function (raw) {
		const r = raw && typeof raw === 'object' ? raw : {};
		const type = QB.TYPES[r.type] ? r.type : 'mc';
		const q = QB.blank(type);
		q.id = typeof r.id === 'string' && /^[\w-]{1,64}$/.test(r.id) ? r.id : q.id;
		q.title = str(r.title, 200);
		q.stem = str(r.stem);
		q.image = QB.normImage(r.image);
		q.points = num(r.points, 1);
		if (type === 'mc' || type === 'ma') {
			q.choices = (Array.isArray(r.choices) ? r.choices : []).map((c) => ({ id: typeof c.id === 'string' ? c.id : rid('c'), text: str(c.text, 4000), correct: !!c.correct, feedback: str(c.feedback, 4000) }));
			if (type === 'mc') { let seen = false; for (const c of q.choices) { if (c.correct && seen) c.correct = false; if (c.correct) seen = true; } }
		}
		const a = r.answer || {};
		q.answer = { expr: str(a.expr != null ? a.expr : a.value != null ? a.value : '', 500).trim(), unit: str(a.unit, 60), tol: num(a.tol, 2), tolMode: a.tolMode === 'abs' ? 'abs' : '%', sigfigs: Math.min(10, Math.max(1, num(a.sigfigs, 3))) };
		if (type === 'match') {
			q.pairs = (Array.isArray(r.pairs) ? r.pairs : []).map((p) => ({ id: typeof p.id === 'string' ? p.id : rid('p'), left: str(p.left, 2000), right: str(p.right, 2000) }));
			q.distractors = (Array.isArray(r.distractors) ? r.distractors : []).map((d) => str(d, 2000)).filter((d) => d.trim());
		}
		q.vars = (Array.isArray(r.vars) ? r.vars : []).map((v) => ({ name: str(v.name, 40).trim(), min: num(v.min, 0), max: num(v.max, num(v.min, 0)), step: num(v.step, null) }));
		q.calcs = (Array.isArray(r.calcs) ? r.calcs : []).map((c) => ({ name: str(c.name, 40).trim(), expr: str(c.expr, 500).trim() }));
		q.constraint = str(r.constraint, 500).trim();
		q.shuffle = r.shuffle !== false;
		const f = r.feedback || {};
		q.feedback = { correct: str(f.correct, 4000), incorrect: str(f.incorrect, 4000), general: str(f.general, 4000) };
		q.solution = str(r.solution);
		const t = r.tags || {};
		q.tags = {
			unit: str(t.unit, 120),
			topics: uniq((Array.isArray(t.topics) ? t.topics : []).map((x) => str(x, 120).trim())),
			objectives: (Array.isArray(t.objectives) ? t.objectives : []).filter((o) => o && o.code).map((o) => ({ fw: str(o.fw, 60), code: str(o.code, 40) })),
			difficulty: Math.min(5, Math.max(0, Math.round(num(t.difficulty, 0)))),
			custom: uniq((Array.isArray(t.custom) ? t.custom : []).map((x) => str(x, 60).trim()))
		};
		q.source = r.source && typeof r.source === 'object' ? { kind: str(r.source.kind, 30), name: str(r.source.name, 200) } : null;
		q.lib = r.lib && typeof r.lib === 'object' && r.lib.id ? { id: str(r.lib.id, 64), version: num(r.lib.version, 1), owner: str(r.lib.owner, 200), sig: str(r.lib.sig, 40), forkedFrom: str(r.lib.forkedFrom, 64) } : null;
		q.created = typeof r.created === 'string' ? r.created : q.created;
		q.modified = typeof r.modified === 'string' ? r.modified : q.modified;
		return q;
	};

	/* Change type, keeping what carries over. */
	QB.convert = function (q, type) {
		if (q.type === type) return q;
		const out = QB.normalize({ ...q, type });
		if ((type === 'mc' || type === 'ma') && !out.choices.length) out.choices = QB.blank(type).choices;
		if (type === 'match' && !out.pairs.length) out.pairs = QB.blank('match').pairs;
		if (type === 'mc' && !out.choices.some((c) => c.correct) && out.choices[0]) out.choices[0].correct = true;
		return out;
	};

	/* A picture: {name, mime, data: 'data:image/…', alt}. Saves keep only a reference ({…, ref}, see
	   shared/gate.js) and the data is filled back in from this computer's store; if it isn't here yet the
	   picture keeps its ref and data is ''. */
	QB.normImage = function (im) {
		if (!im || typeof im !== 'object') return null;
		const has = typeof im.data === 'string' && /^data:image\//.test(im.data);
		const ref = typeof im.ref === 'string' && /^i[0-9a-z]{28}$/.test(im.ref) ? im.ref : '';
		if (!has && !ref) return null;
		const out = { name: str(im.name, 120) || 'image', mime: str(im.mime, 60) || (has ? im.data.slice(5, im.data.indexOf(';')) : 'image/png'), data: has ? im.data : '', alt: str(im.alt, 300) };
		if (!has) out.ref = ref;
		return out;
	};
	QB.imageMissing = (q) => !!(q.image && !q.image.data);

	QB.copy = function (q, keepId) {
		const c = QB.normalize(JSON.parse(JSON.stringify(q)));
		if (!keepId) {
			c.id = rid('q');
			c.created = c.modified = now();
		}
		return c;
	};

	/* A question with every template filled for one roll: what a student would see. */
	QB.instantiate = function (q, seed) {
		let r;
		try { r = seed === 'base' ? { scope: QB.baseScope(q), ok: true } : QB.roll(q, seed); } catch { r = { scope: QB.baseScope(q), ok: false }; }
		const { scope, ok } = r;
		const fill = (s) => QB.fillTemplate(s, scope, q);
		const out = {
			type: q.type, stem: fill(q.stem), scope, ok, image: q.image, points: q.points,
			feedback: { correct: fill(q.feedback.correct), incorrect: fill(q.feedback.incorrect), general: fill(q.feedback.general) },
			solution: fill(q.solution)
		};
		if (q.type === 'mc' || q.type === 'ma') out.choices = q.choices.map((c) => ({ id: c.id, text: fill(c.text), correct: c.correct, feedback: fill(c.feedback) }));
		if (q.type === 'match') {
			out.pairs = q.pairs.map((p) => ({ id: p.id, left: fill(p.left), right: fill(p.right) }));
			out.distractors = q.distractors.map(fill);
		}
		if (q.type === 'num') {
			let v = NaN;
			try { v = QB.evaluate(q.answer.expr, scope); } catch {}
			out.answer = { value: QB.clean(v), unit: q.answer.unit, tol: q.answer.tol, tolMode: q.answer.tolMode, sigfigs: q.answer.sigfigs, shown: QB.fmtSig(v, q.answer.sigfigs || 3) };
			out.range = QB.tolRange(v, q.answer);
		}
		return out;
	};
	QB.tolRange = function (v, a) {
		const t = Math.abs(num(a.tol, 0));
		const d = a.tolMode === 'abs' ? t : (Math.abs(v) * t) / 100;
		return [QB.clean(v - d), QB.clean(v + d)];
	};

	/* Problems: [{level: 'error'|'warn', msg}] */
	QB.check = function (q) {
		const out = [];
		const err = (msg) => out.push({ level: 'error', msg });
		const warn = (msg) => out.push({ level: 'warn', msg });
		if (!String(q.stem || '').trim()) err('The question has no text.');
		if (QB.imageMissing(q)) err('Its picture hasn’t reached this computer yet (open it signed in and online, or re-add the picture).');
		const names = new Set();
		for (const v of q.vars || []) {
			if (!v.name) { err('A variable has no name.'); continue; }
			if (!QB.isName(v.name)) err(`"${v.name}" can't be a variable name (letters, digits, _; not a function name).`);
			if (names.has(v.name)) err(`"${v.name}" is defined twice.`);
			names.add(v.name);
			if (num(v.max, 0) < num(v.min, 0)) err(`${v.name}: max is less than min.`);
			if (v.step != null && !(v.step > 0)) err(`${v.name}: step must be more than 0.`);
		}
		for (const c of q.calcs || []) {
			if (!c.name) { err('A worked value has no name.'); continue; }
			if (!QB.isName(c.name)) err(`"${c.name}" can't be a name.`);
			if (names.has(c.name)) err(`"${c.name}" is defined twice.`);
			try {
				for (const n of QB.namesIn(QB.parse(c.expr))) if (!names.has(n)) err(`${c.name} uses "${n}", which isn't defined above it.`);
			} catch (e) { err(`${c.name} = ${c.expr}: ${e.message}`); }
			names.add(c.name);
		}
		const checkExpr = (label, src) => {
			try {
				for (const n of QB.namesIn(QB.parse(src))) if (!names.has(n)) err(`${label} uses "${n}", which isn't a variable.`);
			} catch (e) { err(`${label}: ${e.message}`); }
		};
		if (q.constraint) checkExpr('The condition', q.constraint);
		const texts = [q.stem, q.solution, q.feedback.correct, q.feedback.incorrect, q.feedback.general];
		if (q.type === 'mc' || q.type === 'ma') {
			const filled = q.choices.filter((c) => String(c.text).trim());
			if (filled.length < 2) err('Add at least two answer choices.');
			const nc = q.choices.filter((c) => c.correct).length;
			if (q.type === 'mc' && nc !== 1) err('Mark exactly one correct choice.');
			if (q.type === 'ma' && nc < 1) err('Mark at least one correct choice.');
			const seen = new Set();
			for (const c of filled) {
				const k = String(c.text).trim().toLowerCase();
				if (!QB.hasExprTemplate(c.text) && seen.has(k)) warn(`Two choices say "${c.text.trim()}".`);
				seen.add(k);
			}
			q.choices.forEach((c) => texts.push(c.text, c.feedback));
		}
		if (q.type === 'num') {
			if (!q.answer.expr) err('Give the answer (a number or a formula).');
			else checkExpr('The answer', q.answer.expr);
			if (!(num(q.answer.tol, 0) >= 0)) err('Tolerance must be 0 or more.');
			if (num(q.answer.tol, 0) === 0 && QB.hasMath(q) && !isNumberText(q.answer.expr)) warn('A calculated answer with 0 tolerance is hard to hit; give a little.');
		}
		if (q.type === 'match') {
			const ok = q.pairs.filter((p) => String(p.left).trim() && String(p.right).trim());
			if (ok.length < 2) err('Add at least two complete pairs.');
			if (q.pairs.some((p) => !String(p.left).trim() !== !String(p.right).trim())) warn('A pair is half filled in; it will be left out.');
			const lefts = ok.map((p) => p.left.trim().toLowerCase());
			if (new Set(lefts).size < lefts.length) err('Two prompts on the left are the same.');
			q.pairs.forEach((p) => texts.push(p.left, p.right));
			texts.push(...q.distractors);
		}
		for (const t of texts) {
			String(t || '').replace(/\{=([^{}]+?)(?::\d+[sf])?\}/g, (all, e) => {
				try { for (const n of QB.namesIn(QB.parse(e))) if (!names.has(n)) err(`{=${e}} uses "${n}", which isn't a variable.`); } catch (x) { err(`{=${e}}: ${x.message}`); }
			});
		}
		if (!out.some((p) => p.level === 'error') && QB.hasMath(q)) {
			try {
				const r = QB.roll(q, 1);
				if (!r.ok) warn('The condition was never true in 300 rolls; widen the ranges.');
				if (q.type === 'num') {
					const v = QB.evaluate(q.answer.expr, r.scope);
					if (!Number.isFinite(v)) err('The answer comes out as ' + v + ' for some values (divide by zero? square root of a negative?).');
				}
			} catch (e) { err(e.message); }
		}
		return out;
	};
	QB.errors = (q) => QB.check(q).filter((p) => p.level === 'error');

	/* Automatic tags, shown beside the teacher's tags and searchable. */
	QB.autoTags = function (q) {
		const out = [QB.TYPES[q.type]];
		if (QB.isRandom(q)) out.push('Randomized');
		else if (QB.hasMath(q)) out.push('Calculated');
		if (q.image) out.push('Image');
		if (/\\\(|\\\[/.test(q.stem)) out.push('Math');
		return out;
	};

	/* Content signature: stays the same when only tags/ids/dates change. */
	QB.sig = function (q) {
		const pick = { type: q.type, title: q.title, stem: q.stem, img: q.image ? (q.image.data ? q.image.data.length + q.image.data.slice(-40) : 'ref:' + q.image.ref) : '', choices: (q.choices || []).map((c) => [c.text, c.correct, c.feedback]), answer: q.type === 'num' ? q.answer : null, pairs: (q.pairs || []).map((p) => [p.left, p.right]), d: q.distractors, vars: q.vars, calcs: q.calcs, k: q.constraint, f: q.feedback, s: q.solution, points: q.points, tags: q.tags };
		const s = JSON.stringify(pick);
		let h1 = 0x811c9dc5, h2 = 0;
		for (let i = 0; i < s.length; i++) {
			h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
			h2 = (Math.imul(h2, 31) + s.charCodeAt(i)) >>> 0;
		}
		return h1.toString(36) + h2.toString(36);
	};

	/* =====================================================================
	   Plain text and HTML from the markup
	   ===================================================================== */
	const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	QB.esc = esc;
	function inline(s) {
		return s
			.replace(/`([^`\n]+)`/g, '<code>$1</code>')
			.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
			.replace(/\*([^*\s][^*\n]*?)\*/g, '<em>$1</em>')
			.replace(/\^([^\s^]+)\^/g, '<sup>$1</sup>')
			.replace(/~([^\s~]+)~/g, '<sub>$1</sub>');
	}
	/* Markup → HTML. Math in \( \) and \[ \] is left as TeX for MathJax/KaTeX (Canvas renders it). */
	QB.toHtml = function (text, { para = true } = {}) {
		const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
		const parts = src.split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/);
		let html = parts.map((p, i) => (i % 2 ? esc(p) : inline(esc(p)))).join('');
		if (!para) return html.replace(/\n/g, '<br>');
		const paras = html.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
		return paras.map((p) => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
	};
	QB.toPlain = (text) => String(text == null ? '' : text).replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\s][^*\n]*?)\*/g, '$1').replace(/\^([^\s^]+)\^/g, '^$1').replace(/~([^\s~]+)~/g, '_$1').replace(/`([^`\n]+)`/g, '$1');
	QB.excerpt = (q, n = 140) => {
		const t = QB.toPlain(q.title || q.stem).replace(/\s+/g, ' ').trim();
		return t.length > n ? t.slice(0, n - 1) + '…' : t;
	};

	/* =====================================================================
	   Filtering and sorting
	   ===================================================================== */
	/* f: { text, types: [], diffMin, diffMax, unit, topic, objective (code prefix), tag, randomized: 'yes'|'no'|'' , source } */
	QB.matches = function (q, f) {
		if (!f) return true;
		if (f.types && f.types.length && !f.types.includes(q.type)) return false;
		const d = q.tags.difficulty || 0;
		if (f.diffMin && d < f.diffMin) return false;
		if (f.diffMax && (d === 0 || d > f.diffMax)) return false;
		if (f.unit && q.tags.unit !== f.unit) return false;
		if (f.topic && !q.tags.topics.includes(f.topic)) return false;
		if (f.objective) {
			const c = f.objective;
			if (!q.tags.objectives.some((o) => o.code === c || o.code.startsWith(c + '.') || c.startsWith(o.code + '.'))) return false;
		}
		if (f.tag && !q.tags.custom.includes(f.tag) && !QB.autoTags(q).includes(f.tag)) return false;
		if (f.randomized === 'yes' && !QB.isRandom(q)) return false;
		if (f.randomized === 'no' && QB.isRandom(q)) return false;
		if (f.text) {
			const hay = [q.title, q.stem, q.solution, q.tags.unit, ...q.tags.topics, ...q.tags.custom, ...q.tags.objectives.map((o) => o.code), ...(q.choices || []).map((c) => c.text), ...(q.pairs || []).flatMap((p) => [p.left, p.right]), q.answer.unit, ...QB.autoTags(q)].join(' \n ').toLowerCase();
			for (const w of String(f.text).toLowerCase().split(/\s+/).filter(Boolean)) if (!hay.includes(w)) return false;
		}
		return true;
	};
	const codeKey = (c) => String(c || '').split('.').map((p) => (/^\d+$/.test(p) ? p.padStart(4, '0') : p)).join('.');
	QB.SORTS = {
		manual: { label: 'Bank order', fn: null },
		modified: { label: 'Recently changed', fn: (a, b) => String(b.modified).localeCompare(String(a.modified)) },
		created: { label: 'Oldest first', fn: (a, b) => String(a.created).localeCompare(String(b.created)) },
		difficulty: { label: 'Difficulty', fn: (a, b) => (a.tags.difficulty || 9) - (b.tags.difficulty || 9) },
		objective: { label: 'Objective', fn: (a, b) => codeKey((a.tags.objectives[0] || {}).code || '~').localeCompare(codeKey((b.tags.objectives[0] || {}).code || '~')) },
		unit: { label: 'Unit', fn: (a, b) => (a.tags.unit || '~').localeCompare(b.tags.unit || '~', undefined, { numeric: true }) },
		type: { label: 'Type', fn: (a, b) => Object.keys(QB.TYPES).indexOf(a.type) - Object.keys(QB.TYPES).indexOf(b.type) },
		title: { label: 'Title / text', fn: (a, b) => QB.excerpt(a).localeCompare(QB.excerpt(b), undefined, { numeric: true }) }
	};
	QB.sorted = function (qs, key) {
		const s = QB.SORTS[key];
		if (!s || !s.fn) return qs.slice();
		return qs.map((q, i) => [q, i]).sort((x, y) => s.fn(x[0], y[0]) || x[1] - y[1]).map((x) => x[0]);
	};
	/* Values in use, for filter menus and suggestions. */
	QB.facets = function (qs) {
		const units = new Set(), topics = new Set(), tags = new Set(), objectives = new Set();
		for (const q of qs) {
			if (q.tags.unit) units.add(q.tags.unit);
			q.tags.topics.forEach((t) => topics.add(t));
			q.tags.custom.forEach((t) => tags.add(t));
			QB.autoTags(q).forEach((t) => tags.add(t));
			q.tags.objectives.forEach((o) => objectives.add(o.code));
		}
		const s = (set) => [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
		return { units: s(units), topics: s(topics), tags: s(tags), objectives: [...objectives].sort((a, b) => codeKey(a).localeCompare(codeKey(b))) };
	};

	/* A bank: the data of one 'qbank' save. */
	QB.normalizeBank = function (d) {
		const b = d && typeof d === 'object' ? d : {};
		return {
			framework: typeof b.framework === 'string' ? b.framework : 'ap-physics-1',
			description: str(b.description, 4000),
			questions: (Array.isArray(b.questions) ? b.questions : []).map(QB.normalize)
		};
	};

	HT.QB = QB;
	if (typeof module !== 'undefined' && module.exports) module.exports = QB;
})();
