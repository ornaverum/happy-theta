'use strict';
/* node tests/passphrase-test.js — made-up pass phrases always pass the check; typed ones don't. */
const assert = require('assert');
const p = require('../passphrase');

for (let i = 0; i < 5000; i++) {
	const g = p.generate();
	assert.strictEqual(p.check(g), null, g);
	assert.ok(/^[a-z][A-Za-z]+$/.test(g), 'camelCase ' + g);
	const n = p.tokens(g).filter((w) => !['the', 'a', 'an'].includes(w)).length;
	assert.ok(n >= 4 && n <= 6, '4–6 words ' + g);
	assert.ok(!/\b(a [aeiou]|an [^aeiou])/.test(p.tokens(g).join(' ')), 'a/an ' + g);
}
assert.strictEqual(p.check('the sleepy otter dances quietly'), null); // spaces are fine
assert.strictEqual(p.check('TheSleepyOtterDancesQuietly'), null);
assert.ok(p.check('hunter2hunter2'));
assert.ok(p.check('theOtterDancesQuietly')); // 3 words
assert.ok(p.check('theSleepyOtterDanceQuietly')); // agreement
assert.ok(p.check('sevenSleepyOtterJugglesTheMoon')); // plural
assert.strictEqual(p.canonical('The Sleepy-Otter dances QUIETLY'), 'thesleepyotterdancesquietly');
console.log('all passed', p.bits().map((b) => b.bits).join(' '));
