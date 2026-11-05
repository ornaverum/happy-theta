/* Countdown — interface and animations */
'use strict';

(function () {
	const { Game, apply } = window.Countdown;
	const $ = (s) => document.querySelector(s);
	const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion() ? 0 : ms));
	const SYMBOL = ['+', '−', '×'];

	const startScreen = $('#startScreen');
	const playScreen = $('#playScreen');
	const targetEl = $('#target');
	const boardEl = $('.board');
	const equationEl = $('#equation');
	const tilesEl = $('#tiles');
	const opsEl = $('.ops');
	const opBtns = [...document.querySelectorAll('.op')];
	const logEl = $('#log');
	const undoBtn = $('#undoBtn');
	const resultDialog = $('#resultDialog');
	const helpDialog = $('#helpDialog');

	let game = null;
	let tiles = []; // { id, value, big, made }
	let history = []; // snapshots of { tiles, steps }
	let steps = []; // { a, b, op, value }
	let picks = []; // tile ids, at most 2
	let nextId = 1;
	let busy = false;
	let over = false;
	let hoverOp = null;
	const tileEls = new Map();

	/* ================================================================ */
	/* Screens                                                          */
	/* ================================================================ */

	async function swapScreen(from, to) {
		if (!reduceMotion() && !from.hidden) {
			await from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px) scale(0.98)' }], { duration: 220, easing: 'ease-in' }).finished;
		}
		from.hidden = true;
		to.hidden = false;
		if (!reduceMotion()) {
			to.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
		}
	}

	function buildStartChoices() {
		const box = $('#bigChoices');
		for (let n = 1; n <= 5; n++) {
			const pips = Array.from({ length: 5 }, (_, i) => `<span class="pip${i < n ? ' on' : ''}"></span>`).join('');
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'big-choice';
			b.setAttribute('aria-label', `${n} big number${n > 1 ? 's' : ''}`);
			b.innerHTML = `<span class="n">${n}</span><span class="pips" aria-hidden="true">${pips}</span>`;
			b.addEventListener('click', () => startGame(n));
			box.appendChild(b);
		}
	}

	async function startGame(numBigs) {
		game = new Game(numBigs);
		game.setup();
		resetBoard();
		setTarget(game.targetValue, false);
		await swapScreen(startScreen, playScreen);
		setTarget(game.targetValue, true);
		await wait(250);
		renderTiles({ deal: true });
	}

	async function newGame() {
		closeDialog(resultDialog);
		await swapScreen(playScreen, startScreen);
	}

	/* ================================================================ */
	/* Target board                                                     */
	/* ================================================================ */

	let flapTimers = [];
	function setTarget(value, animate) {
		flapTimers.forEach(clearInterval);
		flapTimers = [];
		const digits = String(value).split('');
		targetEl.setAttribute('aria-label', `Target ${value}`);
		targetEl.replaceChildren(
			...digits.map((d) => {
				const f = document.createElement('span');
				f.className = 'flap';
				f.setAttribute('aria-hidden', 'true');
				f.textContent = animate ? '0' : d;
				return f;
			})
		);
		if (!animate || reduceMotion()) {
			[...targetEl.children].forEach((f, i) => (f.textContent = digits[i]));
			return;
		}
		[...targetEl.children].forEach((f, i) => {
			f.classList.add('spinning');
			const spin = setInterval(() => (f.textContent = String(Math.floor(Math.random() * 10))), 55);
			flapTimers.push(spin);
			setTimeout(() => {
				clearInterval(spin);
				f.textContent = digits[i];
				f.classList.remove('spinning');
				f.classList.add('landed');
			}, 450 + i * 260);
		});
	}

	/* ================================================================ */
	/* Tiles                                                            */
	/* ================================================================ */

	function resetBoard() {
		tiles = game.initialValues.map((v) => ({ id: nextId++, value: v, big: v >= 25, made: false }));
		history = [];
		steps = [];
		picks = [];
		over = false;
		boardEl.classList.remove('won');
		tilesEl.replaceChildren();
		tileEls.clear();
		renderLog(false);
		renderEquation();
		updateButtons();
	}

	function tileEl(t, index) {
		let e = tileEls.get(t.id);
		if (!e) {
			e = document.createElement('button');
			e.type = 'button';
			e.addEventListener('click', () => pick(t.id));
			tileEls.set(t.id, e);
		}
		e.className = 'tile' + (t.big ? ' big' : '') + (t.made ? ' made' : '') + (picks.includes(t.id) ? ' picked' : '');
		e.innerHTML = `<span class="order" aria-hidden="true">${index + 1}</span>${t.value}`;
		e.setAttribute('aria-label', `${t.value}${picks.includes(t.id) ? ', picked' : ''}`);
		e.setAttribute('aria-pressed', picks.includes(t.id) ? 'true' : 'false');
		e.disabled = over;
		return e;
	}

	/* Re-render tiles; animate moves (FLIP), dealing, popping results and restored tiles */
	function renderTiles({ deal = false, pop = null } = {}) {
		const before = new Map();
		tileEls.forEach((e, id) => e.isConnected && before.set(id, e.getBoundingClientRect()));
		const nodes = tiles.map((t, i) => tileEl(t, i));
		const keep = new Set(tiles.map((t) => t.id));
		[...tileEls.keys()].forEach((id) => !keep.has(id) && tileEls.delete(id));
		tilesEl.replaceChildren(...nodes);
		if (reduceMotion()) return;

		nodes.forEach((e, i) => {
			const id = tiles[i].id;
			if (deal) {
				e.animate(
					[
						{ opacity: 0, transform: `translateY(-60px) rotate(${i % 2 ? 8 : -8}deg) scale(0.8)` },
						{ opacity: 1, transform: 'none' }
					],
					{ duration: 420, delay: i * 90, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'backwards' }
				);
			} else if (pop && id === pop.id) {
				const now = e.getBoundingClientRect();
				const dx = pop.from.left - now.left;
				const dy = pop.from.top - now.top;
				e.animate(
					[
						{ transform: `translate(${dx}px, ${dy}px) scale(0.55)`, opacity: 0.4 },
						{ transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(1.14)`, opacity: 1, offset: 0.6 },
						{ transform: 'none' }
					],
					{ duration: 460, delay: 120, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' }
				);
			} else if (before.has(id)) {
				const was = before.get(id);
				const now = e.getBoundingClientRect();
				const dx = was.left - now.left;
				const dy = was.top - now.top;
				if (dx || dy) e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
			} else {
				e.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 60, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'backwards' });
			}
		});
	}

	/* A copy of the first tile flies into the second */
	function flyGhost(fromEl, toRect) {
		if (reduceMotion()) return;
		const r = fromEl.getBoundingClientRect();
		const g = fromEl.cloneNode(true);
		g.classList.add('ghost');
		Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', transition: 'none' });
		document.body.appendChild(g);
		const dx = toRect.left - r.left;
		const dy = toRect.top - r.top;
		g.animate(
			[
				{ transform: 'translateY(-10px)', opacity: 1 },
				{ transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 30}px) scale(0.9)`, opacity: 1, offset: 0.55 },
				{ transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0 }
			],
			{ duration: 340, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' }
		).finished.then(() => g.remove());
	}

	/* ================================================================ */
	/* Picking and combining                                            */
	/* ================================================================ */

	function pick(id) {
		if (busy || over) return;
		const at = picks.indexOf(id);
		if (at >= 0) picks.splice(at, 1);
		else if (picks.length < 2) picks.push(id);
		else picks[1] = id;
		refresh();
	}

	function cancelPicks() {
		if (!picks.length) return;
		picks = [];
		refresh();
	}

	function refresh() {
		tiles.forEach((t, i) => tileEl(t, i));
		renderEquation();
		updateButtons();
	}

	const tileById = (id) => tiles.find((t) => t.id === id);

	function stepText(s) {
		const [x, y] = s.op === 1 ? [Math.max(s.a, s.b), Math.min(s.a, s.b)] : [s.a, s.b];
		return `${x} ${SYMBOL[s.op]} ${y}`;
	}

	function renderEquation() {
		const [a, b] = picks.map(tileById);
		const slot = (v) => `<span class="slot${v !== undefined ? ' filled' : ''}">${v !== undefined ? v : '&nbsp;'}</span>`;
		if (!a) {
			equationEl.innerHTML = over ? '' : '<span class="hint">Pick a number</span>';
			return;
		}
		if (!b) {
			equationEl.innerHTML = `${slot(a.value)}<span class="q">?</span>${slot()}<span class="hint">Pick a second number</span>`;
			return;
		}
		if (hoverOp === null) {
			equationEl.innerHTML = `${slot(a.value)}<span class="q">?</span>${slot(b.value)}<span class="hint">Choose an operation</span>`;
			return;
		}
		const s = { a: a.value, b: b.value, op: hoverOp };
		const [x, y] = stepText(s).split(` ${SYMBOL[hoverOp]} `);
		equationEl.innerHTML = `${slot(x)}<span>${SYMBOL[hoverOp]}</span>${slot(y)}<span>=</span><span class="slot filled">${apply(hoverOp, a.value, b.value)}</span>`;
	}

	function updateButtons() {
		const ready = picks.length === 2 && !busy && !over;
		opBtns.forEach((b) => (b.disabled = !ready));
		opsEl.classList.toggle('ready', ready);
		undoBtn.disabled = history.length === 0 || busy;
	}

	async function combine(op) {
		if (picks.length !== 2 || busy || over) return;
		busy = true;
		hoverOp = null;
		const [a, b] = picks.map(tileById);
		const value = apply(op, a.value, b.value);
		const aEl = tileEls.get(a.id);
		const bRect = tileEls.get(b.id).getBoundingClientRect();

		history.push({ tiles: tiles.map((t) => ({ ...t })), steps: [...steps] });
		steps.push({ a: a.value, b: b.value, op, value });

		flyGhost(aEl, bRect);
		const result = { id: nextId++, value, big: false, made: true };
		tiles = tiles.filter((t) => t.id !== a.id).map((t) => (t.id === b.id ? result : t));
		picks = [];
		renderTiles({ pop: { id: result.id, from: bRect } });
		renderEquation();
		renderLog(true);
		updateButtons();

		await wait(480);
		busy = false;
		updateButtons();
		checkEnd();
	}

	function undo() {
		if (!history.length || busy) return;
		const snap = history.pop();
		tiles = snap.tiles;
		steps = snap.steps;
		picks = [];
		over = false;
		boardEl.classList.remove('won');
		renderTiles();
		renderLog(false);
		renderEquation();
		updateButtons();
	}

	function restart() {
		if (!game) return;
		closeDialog(resultDialog);
		resetBoard();
		renderTiles({ deal: true });
	}

	function renderLog(animateLast) {
		logEl.replaceChildren(
			...steps.map((s, i) => {
				const li = document.createElement('li');
				li.innerHTML = `<span>${stepText(s)}</span><span class="res">= ${s.value}</span>`;
				if (animateLast && i === steps.length - 1) li.classList.add('new');
				return li;
			})
		);
	}

	/* ================================================================ */
	/* Ending a game                                                    */
	/* ================================================================ */

	function checkEnd() {
		const target = game.targetValue;
		const hit = tiles.find((t) => t.value === target);
		if (hit) return win(hit);
		if (tiles.length <= 1) lose();
	}

	async function win(hit) {
		over = true;
		boardEl.classList.add('won');
		refresh();
		const e = tileEls.get(hit.id);
		if (e) e.classList.add('hit');
		await wait(900);
		const n = steps.length;
		openResult({
			cls: 'won',
			title: 'Target reached',
			text: `You made ${game.targetValue} in ${n} step${n === 1 ? '' : 's'}.`,
			steps,
			actions: [
				['Play these numbers again', restart],
				['New game', newGame, true]
			]
		});
	}

	async function lose() {
		over = true;
		refresh();
		await wait(350);
		const last = tiles[0] ? tiles[0].value : 0;
		const off = Math.abs(last - game.targetValue);
		openResult({
			cls: 'lost',
			title: 'Out of numbers',
			text: `You ended on ${last}, ${off} away from ${game.targetValue}.`,
			steps: [],
			actions: [
				['Show a solution', showSolution],
				['Try again', restart],
				['New game', newGame, true]
			]
		});
	}

	function showSolution() {
		if (!game) return;
		const sol = game.solutionSteps().map((s) => ({ ...s }));
		openResult({
			cls: '',
			title: `One way to make ${game.targetValue}`,
			text: sol.length ? 'There may be other ways too.' : '',
			steps: sol,
			actions: over
				? [
						['Try again', restart],
						['New game', newGame, true]
					]
				: [['Keep playing', () => closeDialog(resultDialog), true]]
		});
	}

	/* ================================================================ */
	/* Dialogs                                                          */
	/* ================================================================ */

	function openResult({ cls, title, text, steps: list, actions }) {
		resultDialog.className = 'sheet ' + cls;
		$('#resultTitle').textContent = title;
		$('#resultText').textContent = text;
		$('#resultSteps').replaceChildren(
			...list.map((s) => {
				const li = document.createElement('li');
				li.innerHTML = `<span>${stepText(s)}</span><span class="res">= ${s.value}</span>`;
				return li;
			})
		);
		const box = $('#resultActions');
		box.replaceChildren(
			...actions.map(([label, fn, strong]) => {
				const b = document.createElement('button');
				b.type = 'button';
				b.className = 'ctl' + (strong ? ' ctl-strong' : '');
				b.textContent = label;
				b.addEventListener('click', fn);
				return b;
			})
		);
		if (resultDialog.open) {
			// swap content in place with a quick fade
			if (!reduceMotion()) resultDialog.animate([{ opacity: 0.4, transform: 'scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 200 });
		} else {
			resultDialog.showModal();
		}
		const strong = box.querySelector('.ctl-strong');
		if (strong) strong.focus();
	}

	function closeDialog(d) {
		if (!d.open || d.classList.contains('closing')) return;
		if (reduceMotion()) return d.close();
		d.classList.add('closing');
		setTimeout(() => {
			d.close();
			d.classList.remove('closing');
		}, 190);
	}

	[resultDialog, helpDialog].forEach((d) => {
		d.addEventListener('cancel', (e) => {
			e.preventDefault();
			closeDialog(d);
		});
		d.addEventListener('click', (e) => e.target === d && closeDialog(d));
	});
	helpDialog.querySelector('[data-close]').addEventListener('click', () => closeDialog(helpDialog));

	/* ================================================================ */
	/* Wiring                                                           */
	/* ================================================================ */

	opBtns.forEach((b) => {
		const op = Number(b.dataset.op);
		b.addEventListener('click', () => combine(op));
		const enter = () => {
			if (b.disabled) return;
			hoverOp = op;
			renderEquation();
		};
		const leave = () => {
			hoverOp = null;
			renderEquation();
		};
		b.addEventListener('mouseenter', enter);
		b.addEventListener('focus', enter);
		b.addEventListener('mouseleave', leave);
		b.addEventListener('blur', leave);
	});

	undoBtn.addEventListener('click', undo);
	$('#restartBtn').addEventListener('click', restart);
	$('#newGameBtn').addEventListener('click', newGame);
	$('#solutionBtn').addEventListener('click', showSolution);
	$('#helpBtn').addEventListener('click', () => helpDialog.showModal());

	document.addEventListener('keydown', (e) => {
		if (e.ctrlKey || e.metaKey || e.altKey) {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !playScreen.hidden) {
				e.preventDefault();
				undo();
			}
			return;
		}
		if (resultDialog.open || helpDialog.open) return;
		if (startScreen.hidden === false) {
			if (/^[1-5]$/.test(e.key)) startGame(Number(e.key));
			return;
		}
		if (/^[1-5]$/.test(e.key)) {
			const t = tiles[Number(e.key) - 1];
			if (t) pick(t.id);
		} else if (e.key === '+') combine(0);
		else if (e.key === '-') combine(1);
		else if (e.key === '*' || e.key.toLowerCase() === 'x') combine(2);
		else if (e.key === 'Escape') cancelPicks();
		else if (e.key.toLowerCase() === 'u') undo();
	});

	buildStartChoices();
	window.CountdownApp = { get state() { return { tiles, steps, picks, target: game && game.targetValue, over }; } };
})();
