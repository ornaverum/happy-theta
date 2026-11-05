// Run with: node apps/crochet/tests/pattern-test.js   (no dependencies)
'use strict';
require('../js/shape.js');
require('../js/pattern.js');
const SS = globalThis.SS;
const assert = require('assert');
const gauge = { stitches: 20, rows: 22 };
let checks = 0;

function checkRounds(res, label) {
  let prev = res.start.type === 'chain' ? res.start.n : null;
  res.rounds.forEach((r, i) => {
    if (r.first) { prev = r.n; return; }
    const used = r.ops.reduce((s, o) => s + (o === 'dec' ? 2 : 1), 0);
    const made = r.ops.reduce((s, o) => s + (o === 'inc' ? 2 : 1), 0);
    assert.strictEqual(used, prev, label + ' rnd ' + (i + 1) + ': works ' + used + ' sts, previous round has ' + prev);
    assert.strictEqual(made, r.n, label + ' rnd ' + (i + 1) + ': makes ' + made + ', count says ' + r.n);
    prev = r.n; checks++;
  });
}

// every primitive: stitch arithmetic adds up
Object.keys(SS.PRIMITIVES).forEach(k => checkRounds(SS.generate(SS.makePart(k), gauge), k));

// classic cylinder: 6, 12, 18, 24 then straight, BLO at both corners
const cyl = SS.generate(SS.makePart('cylinder'), gauge);
assert.deepStrictEqual(cyl.rounds.slice(0, 4).map(r => r.n), [6, 12, 18, 24]);
assert.ok(cyl.rounds.filter(r => r.blo).length === 2, 'cylinder should have two BLO rounds');
checks += 2;

// sculpted lopsided part still adds up; scale changes the counts
const egg = SS.makePart('egg');
egg.disp = SS.makeDisp(64, 72);
for (let j = 20; j < 40; j++) for (let i = 5; i < 15; i++) egg.disp.data[j * 64 + i] = 0.8;
checkRounds(SS.generate(egg, gauge), 'sculpted egg');
const big = SS.makePart('sphere'); big.scale = [2, 2, 2];
assert.ok(SS.generate(big, gauge).rounds.length > SS.generate(SS.makePart('sphere'), gauge).rounds.length);
checks++;

// UK terms swap sc -> dc
const uk = SS.linesToText(SS.toLines(cyl, 'UK'));
assert.ok(/\bdc\b/.test(uk) && !/\bsc\b/.test(uk));
checks++;

console.log('pattern tests passed (' + checks + ' checks)');
