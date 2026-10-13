/* Math expression parser for the Advanced Graph Maker.
   HT.compileExpr('2x^2 - 3sin(x)', ['x']) -> (x) => number   (throws on syntax errors)
   Supports + - * / ^, implicit multiplication (2x, 3(x+1), x sin x), |abs|,
   constants pi/π/e, variables, and common functions. No eval(). */
'use strict';

(function () {
	const FUNCS = {
		sin: Math.sin, cos: Math.cos, tan: Math.tan,
		sec: (v) => 1 / Math.cos(v), csc: (v) => 1 / Math.sin(v), cot: (v) => 1 / Math.tan(v),
		asin: Math.asin, acos: Math.acos, atan: Math.atan,
		arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
		sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
		sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
		ln: Math.log, log: Math.log10, exp: Math.exp,
		floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, sgn: Math.sign
	};
	const CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E };

	/* Normalize unicode math characters */
	function normalize(s) {
		return s
			.replace(/[−–]/g, '-')
			.replace(/[⋅·×]/g, '*')
			.replace(/÷/g, '/')
			.replace(/√/g, 'sqrt')
			.replace(/θ/g, 'theta')
			.replace(/[𝑥]/gu, 'x')
			.replace(/[𝑦]/gu, 'y')
			.replace(/[𝑡]/gu, 't')
			.replace(/²/g, '^2')
			.replace(/³/g, '^3')
			.replace(/⁻¹/g, '^(-1)')
			.replace(/\*\*/g, '^');
	}

	function tokenize(src, vars) {
		const s = normalize(src);
		const names = [...Object.keys(FUNCS), ...Object.keys(CONSTS), ...vars, 'theta'].sort((a, b) => b.length - a.length);
		const toks = [];
		let i = 0;
		while (i < s.length) {
			const c = s[i];
			if (/\s/.test(c)) {
				i++;
				continue;
			}
			const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
			if (num && /[\d.]/.test(c)) {
				toks.push({ t: 'num', v: parseFloat(num[0]) });
				i += num[0].length;
				continue;
			}
			if ('+-*/^(),|'.includes(c) || c === '[' || c === ']' || c === '{' || c === '}') {
				const map = { '[': '(', ']': ')', '{': '(', '}': ')' };
				toks.push({ t: 'op', v: map[c] || c });
				i++;
				continue;
			}
			if (/[a-zA-Zπ]/.test(c)) {
				// greedily split a run of letters into known names (so "xsinx" -> x sin x)
				let matched = null;
				for (const n of names) {
					if (s.startsWith(n, i)) {
						matched = n;
						break;
					}
				}
				if (!matched) throw new Error(`Unknown name near "${s.slice(i, i + 8)}"`);
				if (FUNCS[matched]) toks.push({ t: 'fn', v: matched });
				else if (matched in CONSTS) toks.push({ t: 'num', v: CONSTS[matched] });
				else toks.push({ t: 'var', v: matched === 'theta' ? (vars.includes('theta') ? 'theta' : matched) : matched });
				i += matched.length;
				continue;
			}
			throw new Error(`Unexpected "${c}"`);
		}
		return toks;
	}

	/* Recursive-descent parser producing a closure tree */
	function parse(toks, vars) {
		let p = 0;
		let absDepth = 0;
		const peek = () => toks[p];
		const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
		const expect = (v) => {
			if (!isOp(v)) throw new Error(`Expected "${v}"`);
			p++;
		};

		// can the current token start an implicit-multiplication operand?
		const startsOperand = () => {
			const k = peek();
			if (!k) return false;
			if (k.t === 'num' || k.t === 'var' || k.t === 'fn') return true;
			if (k.t === 'op' && k.v === '(') return true;
			if (k.t === 'op' && k.v === '|' && absDepth === 0) return true;
			return false;
		};

		function expr() {
			let left = term();
			while (isOp('+') || isOp('-')) {
				const op = toks[p++].v;
				const a = left;
				const b = term();
				left = op === '+' ? (e) => a(e) + b(e) : (e) => a(e) - b(e);
			}
			return left;
		}

		function term() {
			let left = unary();
			for (;;) {
				if (isOp('*') || isOp('/')) {
					const op = toks[p++].v;
					const a = left;
					const b = unary();
					left = op === '*' ? (e) => a(e) * b(e) : (e) => a(e) / b(e);
				} else if (startsOperand()) {
					const a = left;
					const b = power();
					left = (e) => a(e) * b(e);
				} else break;
			}
			return left;
		}

		function unary() {
			if (isOp('-')) {
				p++;
				const a = unary();
				return (e) => -a(e);
			}
			if (isOp('+')) {
				p++;
				return unary();
			}
			return power();
		}

		function power() {
			const base = primary();
			if (isOp('^')) {
				p++;
				const ex = unary(); // right-associative, allows 2^-x
				return (e) => Math.pow(base(e), ex(e));
			}
			return base;
		}

		function primary() {
			const k = peek();
			if (!k) throw new Error('Unexpected end of expression');
			if (k.t === 'num') {
				p++;
				const v = k.v;
				return () => v;
			}
			if (k.t === 'var') {
				p++;
				const name = k.v;
				if (!vars.includes(name)) throw new Error(`Variable "${name}" isn't used here`);
				return (e) => e[name];
			}
			if (k.t === 'fn') {
				p++;
				const f = FUNCS[k.v];
				// optional power on the function name: sin^2(x)
				let pw = null;
				if (isOp('^')) {
					p++;
					pw = primary();
				}
				let arg;
				if (isOp('(')) {
					p++;
					arg = expr();
					expect(')');
				} else {
					arg = power(); // sin x, sqrt 2
				}
				return pw ? (e) => Math.pow(f(arg(e)), pw(e)) : (e) => f(arg(e));
			}
			if (k.t === 'op' && k.v === '(') {
				p++;
				const a = expr();
				expect(')');
				return a;
			}
			if (k.t === 'op' && k.v === '|') {
				p++;
				absDepth++;
				const a = expr();
				absDepth--;
				expect('|');
				return (e) => Math.abs(a(e));
			}
			throw new Error(`Unexpected "${k.v}"`);
		}

		const root = expr();
		if (p < toks.length) throw new Error(`Unexpected "${toks[p].v}"`);
		return root;
	}

	HT.compileExpr = function (src, vars = ['x']) {
		if (!src || !String(src).trim()) return null;
		const fn = parse(tokenize(String(src), vars), vars);
		return (...args) => {
			const env = {};
			vars.forEach((v, i) => (env[v] = args[i]));
			return fn(env);
		};
	};

	/* Parse a plain number field (allows expressions like "2pi", "-π/2") */
	HT.parseNum = function (src, fallback = NaN) {
		if (src === undefined || src === null || String(src).trim() === '') return fallback;
		try {
			const v = HT.compileExpr(String(src), [])();
			return Number.isFinite(v) ? v : fallback;
		} catch {
			return fallback;
		}
	};
})();
