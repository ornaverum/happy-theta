/* Maze — a 21×21 maze grown from the center. Roll the marble to the top-left corner.
   Maze generation follows the original (depth-first "recursive backtracker" from the middle cell). */
'use strict';

(function () {
	const L = 21; // cells per side
	const STEP_MS = 115; // time to roll one cell

	const canvas = document.getElementById('gameCanvas');
	const ctx = canvas.getContext('2d');
	const board = document.getElementById('board');
	const movesEl = document.getElementById('moves');
	const winEl = document.getElementById('win');
	const winText = document.getElementById('winText');

	const COLORS = {
		paper: '#fbfcf7',
		grid: '#e2e8ef',
		wall: '#123674',
		goal: '#f4e3ae',
		flag: '#e3b341',
		pole: '#7a5b12',
		trail: 'rgba(0, 89, 74, 0.28)'
	};

	let south, east; // walls: south[i] = wall below cell i, east[i] = wall right of cell i
	let player, anim, pending, moves, visited, shortest, won;
	let size = 0; // canvas size in CSS px
	let cell = 0;
	let pad = 0;

	const idx = (x, y) => y * L + x;

	/* ---------------- maze generation ---------------- */

	function generate() {
		south = new Uint8Array(L * L).fill(1);
		east = new Uint8Array(L * L).fill(1);
		const seen = new Uint8Array(L * L);
		const start = Math.floor(L / 2);
		let cur = idx(start, start);
		seen[cur] = 1;
		const stack = [cur];
		let left = L * L - 1;
		while (left > 0) {
			const x = cur % L;
			const y = Math.floor(cur / L);
			const options = [];
			if (y > 0 && !seen[idx(x, y - 1)]) options.push('n');
			if (x < L - 1 && !seen[idx(x + 1, y)]) options.push('e');
			if (y < L - 1 && !seen[idx(x, y + 1)]) options.push('s');
			if (x > 0 && !seen[idx(x - 1, y)]) options.push('w');
			if (!options.length) {
				stack.pop();
				cur = stack[stack.length - 1];
				continue;
			}
			const dir = options[Math.floor(Math.random() * options.length)];
			let next;
			if (dir === 'n') {
				next = idx(x, y - 1);
				south[next] = 0;
			} else if (dir === 's') {
				next = idx(x, y + 1);
				south[cur] = 0;
			} else if (dir === 'e') {
				next = idx(x + 1, y);
				east[cur] = 0;
			} else {
				next = idx(x - 1, y);
				east[next] = 0;
			}
			seen[next] = 1;
			stack.push(next);
			cur = next;
			left--;
		}
	}

	function blocked(x, y, dx, dy) {
		if (dx === 1) return x === L - 1 || east[idx(x, y)];
		if (dx === -1) return x === 0 || east[idx(x - 1, y)];
		if (dy === 1) return y === L - 1 || south[idx(x, y)];
		return y === 0 || south[idx(x, y - 1)];
	}

	/* length of the shortest route from the start to the goal */
	function shortestRoute(sx, sy) {
		const dist = new Int32Array(L * L).fill(-1);
		const q = [idx(sx, sy)];
		dist[q[0]] = 0;
		for (let h = 0; h < q.length; h++) {
			const c = q[h];
			const x = c % L;
			const y = Math.floor(c / L);
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				if (blocked(x, y, dx, dy)) continue;
				const n = idx(x + dx, y + dy);
				if (dist[n] < 0) {
					dist[n] = dist[c] + 1;
					q.push(n);
				}
			}
		}
		return dist[0];
	}

	/* ---------------- game state ---------------- */

	function newGame() {
		generate();
		const s = Math.floor(L / 2);
		player = { x: s, y: s };
		anim = null;
		pending = null;
		moves = 0;
		won = false;
		visited = new Set([idx(s, s)]);
		shortest = shortestRoute(s, s);
		movesEl.textContent = '0';
		winEl.hidden = true;
		draw();
		canvas.focus?.();
	}

	function tryMove(dx, dy) {
		if (won) return;
		if (anim) {
			pending = [dx, dy]; // remember the next turn while rolling
			return;
		}
		if (blocked(player.x, player.y, dx, dy)) return;
		startRoll(dx, dy, null);
		requestAnimationFrame(tick);
	}

	/* t0 = null means "start on the next frame drawn"; a number continues seamlessly from the last roll */
	function startRoll(dx, dy, t0) {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		anim = { fx: player.x, fy: player.y, tx: player.x + dx, ty: player.y + dy, t0, dur: reduce ? 1 : STEP_MS };
	}

	function tick(now) {
		if (!anim) return;
		if (anim.t0 === null) anim.t0 = now; // time the roll from the first frame actually drawn
		const t = Math.max(0, Math.min(1, (now - anim.t0) / anim.dur));
		if (t < 1) {
			draw(t);
			return requestAnimationFrame(tick);
		}
		// arrived
		const endTime = anim.t0 + anim.dur;
		player.x = anim.tx;
		player.y = anim.ty;
		anim = null;
		moves++;
		movesEl.textContent = String(moves);
		visited.add(idx(player.x, player.y));
		if (player.x === 0 && player.y === 0) {
			draw();
			return win();
		}
		// a key pressed mid-roll: keep rolling from exactly where this roll ended
		if (pending) {
			const [dx, dy] = pending;
			pending = null;
			if (!blocked(player.x, player.y, dx, dy)) {
				startRoll(dx, dy, Math.min(endTime, now));
				return tick(now);
			}
		}
		draw();
	}

	function win() {
		won = true;
		const extra = moves - shortest;
		winText.textContent =
			`${moves} moves. ` + (extra <= 0 ? 'That’s the shortest route!' : `The shortest route takes ${shortest}.`);
		winEl.hidden = false;
		document.getElementById('againBtn').focus();
	}

	/* ---------------- drawing ---------------- */

	function resize() {
		// keep the whole board on screen
		const avail = Math.max(260, Math.min(640, window.innerHeight - 190, window.innerWidth - 32));
		document.documentElement.style.setProperty('--board', avail + 'px');
		const inner = board.clientWidth - 24; // board padding
		size = Math.max(200, inner);
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(size * dpr);
		canvas.height = Math.round(size * dpr);
		canvas.style.height = size + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		pad = Math.max(3, size * 0.012);
		cell = (size - pad * 2) / L;
		draw();
	}

	const cx = (x) => pad + (x + 0.5) * cell;
	const cy = (y) => pad + (y + 0.5) * cell;

	function draw(t = 0) {
		if (!south) return;
		ctx.clearRect(0, 0, size, size);

		// graph-paper floor
		ctx.fillStyle = COLORS.paper;
		ctx.fillRect(0, 0, size, size);
		ctx.strokeStyle = COLORS.grid;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i <= L; i++) {
			const p = pad + i * cell;
			ctx.moveTo(p, pad);
			ctx.lineTo(p, pad + L * cell);
			ctx.moveTo(pad, p);
			ctx.lineTo(pad + L * cell, p);
		}
		ctx.stroke();

		// goal square
		ctx.fillStyle = COLORS.goal;
		ctx.fillRect(pad, pad, cell, cell);

		// trail of visited squares
		ctx.fillStyle = COLORS.trail;
		visited.forEach((c) => {
			ctx.beginPath();
			ctx.arc(cx(c % L), cy(Math.floor(c / L)), cell * 0.1, 0, Math.PI * 2);
			ctx.fill();
		});

		// walls
		ctx.strokeStyle = COLORS.wall;
		ctx.lineWidth = Math.max(2.5, cell * 0.17);
		ctx.lineCap = 'round';
		ctx.beginPath();
		const x0 = pad;
		const y0 = pad;
		const end = pad + L * cell;
		ctx.moveTo(x0, y0 + cell); // left edge, open beside the goal
		ctx.lineTo(x0, end);
		ctx.lineTo(end, end);
		ctx.lineTo(end, y0);
		ctx.lineTo(x0, y0);
		for (let y = 0; y < L; y++) {
			for (let x = 0; x < L; x++) {
				const c = idx(x, y);
				if (south[c] && y < L - 1) {
					ctx.moveTo(x0 + x * cell, y0 + (y + 1) * cell);
					ctx.lineTo(x0 + (x + 1) * cell, y0 + (y + 1) * cell);
				}
				if (east[c] && x < L - 1) {
					ctx.moveTo(x0 + (x + 1) * cell, y0 + y * cell);
					ctx.lineTo(x0 + (x + 1) * cell, y0 + (y + 1) * cell);
				}
			}
		}
		ctx.stroke();

		drawFlag();
		drawMarble(t);
	}

	function drawFlag() {
		const bx = cx(0) - cell * 0.12;
		const top = cy(0) - cell * 0.32;
		const bottom = cy(0) + cell * 0.3;
		ctx.strokeStyle = COLORS.pole;
		ctx.lineWidth = Math.max(1.5, cell * 0.07);
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(bx, bottom);
		ctx.lineTo(bx, top);
		ctx.stroke();
		ctx.fillStyle = COLORS.flag;
		ctx.beginPath();
		ctx.moveTo(bx, top);
		ctx.lineTo(bx + cell * 0.38, top + cell * 0.13);
		ctx.lineTo(bx, top + cell * 0.27);
		ctx.closePath();
		ctx.fill();
	}

	function drawMarble(t) {
		let x = player.x;
		let y = player.y;
		if (anim) {
			const e = 1 - Math.pow(1 - t, 3); // ease out
			x = anim.fx + (anim.tx - anim.fx) * e;
			y = anim.fy + (anim.ty - anim.fy) * e;
		}
		const px = cx(x);
		const py = cy(y);
		const r = cell * 0.31;
		// soft shadow
		ctx.fillStyle = 'rgba(18, 54, 116, 0.18)';
		ctx.beginPath();
		ctx.ellipse(px + r * 0.15, py + r * 0.55, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
		ctx.fill();
		// marble body with highlight
		const g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r);
		g.addColorStop(0, '#ff9c80');
		g.addColorStop(0.45, '#d9432b');
		g.addColorStop(1, '#8f2312');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(px, py, r, 0, Math.PI * 2);
		ctx.fill();
	}

	/* ---------------- input ---------------- */

	const KEYS = {
		ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
		Up: [0, -1], Down: [0, 1], Left: [-1, 0], Right: [1, 0],
		w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
		W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0]
	};
	document.addEventListener('keydown', (e) => {
		const dir = KEYS[e.key];
		if (!dir || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.target.tagName === 'BUTTON' && won) return;
		e.preventDefault(); // stop the page from scrolling
		tryMove(dir[0], dir[1]);
	});

	// swipe on touch screens
	let swipe = null;
	canvas.addEventListener('pointerdown', (e) => (swipe = { x: e.clientX, y: e.clientY }));
	canvas.addEventListener('pointerup', (e) => {
		if (!swipe) return;
		const dx = e.clientX - swipe.x;
		const dy = e.clientY - swipe.y;
		swipe = null;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
		if (Math.abs(dx) > Math.abs(dy)) tryMove(Math.sign(dx), 0);
		else tryMove(0, Math.sign(dy));
	});

	document.getElementById('newBtn').addEventListener('click', newGame);
	document.getElementById('againBtn').addEventListener('click', newGame);
	window.addEventListener('resize', resize);

	newGame();
	resize();

	// for testing from the console
	window.Maze = { get state() { return { player, moves, won, shortest }; }, blocked, newGame, tryMove };
})();
