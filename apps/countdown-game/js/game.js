/* Countdown game logic — ported from the original game.js / opNode.js without Underscore.
   Operations: 0 = +, 1 = − (always larger minus smaller), 2 = ×. */
'use strict';

(function () {
	/* --- tiny replacements for the Underscore helpers the original used --- */
	const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
	function sample(arr, n) {
		const copy = [...arr];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return n === undefined ? copy[0] : copy.slice(0, n);
	}
	function uniqBy(arr, key) {
		const seen = new Set();
		return arr.filter((x) => {
			const k = key(x);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}

	function apply(op, a, b) {
		if (op === 0) return a + b;
		if (op === 1) return Math.abs(a - b);
		return a * b;
	}

	class OpNode {
		constructor(parentA = null, parentB = null, op = 0, value = null) {
			this.a = parentA;
			this.b = parentB;
			this.op = op;
			this.value = value !== null ? value : apply(op, parentA.value, parentB.value);
			this.lineage = [this];
			if (parentA && parentB) {
				this.depth = parentA.depth + parentB.depth;
				this.lineage = this.lineage.concat(parentA.lineage).concat(parentB.lineage);
			} else {
				this.depth = 1;
			}
		}
	}

	class Game {
		constructor(numBigs = 1) {
			this.numBigs = numBigs;
			this.initialValues = [];
			this.nodeSet = [];
			this.targetNode = null;
			this.targetValue = 0;
		}

		generateValues() {
			const smallVals = range(1, 11).concat(range(1, 11));
			const bigVals = [25, 50, 75, 100, 25, 50, 75, 100];
			let vals = sample(bigVals, this.numBigs);
			if (this.numBigs < 5) vals = vals.concat(sample(smallVals, 5 - this.numBigs));
			this.initialValues = vals.sort((x, y) => y - x);
		}

		generateNodes() {
			this.nodeSet = this.initialValues.map((v) => new OpNode(null, null, 0, v));
		}

		/* Same search as the original: combine nodes (forEach sees the array length at the start of each loop) */
		iterateNodes() {
			this.nodeSet.forEach((a) => {
				this.nodeSet.forEach((b) => {
					if (!(a.lineage.includes(b) || b.lineage.includes(a))) {
						[0, 1, 2].forEach((op) => {
							const node = new OpNode(a, b, op);
							if (node.value < 1000) this.nodeSet.push(node);
						});
					}
				});
			});
			this.nodeSet = this.nodeSet.filter((n) => n.value > 100 && n.value < 1000 && n.value % 10 !== 0);
			this.nodeSet = uniqBy(this.nodeSet, (n) => n.value);
		}

		/* Deal numbers and pick a reachable target; redeal if no target qualifies */
		setup() {
			for (let tries = 0; tries < 50; tries++) {
				this.generateValues();
				this.generateNodes();
				this.iterateNodes();
				if (this.nodeSet.length) break;
			}
			this.targetNode = sample(this.nodeSet);
			this.targetValue = this.targetNode.value;
		}

		/* One way to reach the target, as a list of steps */
		solutionSteps(node = this.targetNode) {
			if (!node || !node.a || !node.b) return [];
			return [...this.solutionSteps(node.a), ...this.solutionSteps(node.b), { a: node.a.value, b: node.b.value, op: node.op, value: node.value }];
		}
	}

	window.Countdown = { Game, apply };
})();
