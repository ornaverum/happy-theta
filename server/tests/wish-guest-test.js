'use strict';
/* Tests for WishIMay sign-in: owners (email + passphrase) and guests (family passphrase + name).
   `node tests/wish-guest-test.js` — uses a throwaway database and a local server on a random port. */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wishguest-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.COOKIE_SECURE = '0';
const express = require('express');
const auth = require('../auth');
const wishlist = require('../wishlist');
const { db } = require('../db');

// An owner, and a shopper made the old way (own passphrase) to check the move to guest sign-in.
db.prepare('INSERT INTO wish_accounts (role, email, name, pass_hash) VALUES (?, ?, ?, ?)').run(
	'owner',
	'fam@example.com',
	'Family',
	auth.hashPassword('owner pass one')
);
db.prepare('INSERT INTO wish_accounts (role, email, name, pass_hash) VALUES (?, ?, ?, ?)').run(
	'shopper',
	'aunt@example.com',
	'Aunt Sue',
	auth.hashPassword('aunt pass one')
);
wishlist.guestAccess.set('Maple River Otter');

const app = express();
app.use(`${wishlist.WISH_BASE}/api`, wishlist);
const server = app.listen(0, '127.0.0.1');
let B = '';
let ORIGIN = '';
let n = 0;
function jar() {
	let c = '';
	return async (p, method = 'GET', body) => {
		const r = await fetch(B + p, {
			method,
			headers: { 'content-type': 'application/json', cookie: c, origin: ORIGIN },
			body: method === 'GET' ? undefined : JSON.stringify(body || {})
		});
		const sc = r.headers.get('set-cookie');
		if (sc) c = sc.split(';')[0];
		let d = {};
		try {
			d = await r.json();
		} catch {}
		return { s: r.status, d };
	};
}
const ok = (cond, msg) => {
	assert.ok(cond, msg);
	n++;
};
server.on('listening', () => {
	ORIGIN = `http://127.0.0.1:${server.address().port}`;
	B = `${ORIGIN}${wishlist.WISH_BASE}/api/`;
	run().catch((e) => {
		console.error('FAIL', e.message);
		process.exit(1);
	});
});
const run = async () => {
	const owner = jar(),
		g1 = jar(),
		g2 = jar(),
		g3 = jar(),
		aunt = jar(),
		bad = jar();
	let r = await owner('login', 'POST', { email: 'fam@example.com', passphrase: 'owner pass one' });
	ok(r.s === 200 && r.d.account.role === 'owner', 'owner login');
	r = await owner('guest-access');
	ok(r.d.passphrase === 'Maple River Otter' && r.d.guests.length === 1, 'owner sees passphrase + old shopper');
	// add a person + item
	const p = (await owner('people', 'POST', { name: 'Mom' })).d.person;
	const it = (await owner('items', 'POST', { personId: p.id, title: 'Skillet', price: 30 })).d.item;
	// old shopper passphrase login no longer works on /login
	r = await aunt('login', 'POST', { email: 'aunt@example.com', passphrase: 'aunt pass one' });
	ok(r.s === 401 && r.d.guest, 'shopper blocked from owner login');
	r = await g1('guest-status');
	ok(r.d.open === true, 'status open');
	r = await g1('guest-login', 'POST', { passphrase: 'maple-river   OTTER', name: 'Grandpa' });
	ok(
		r.s === 200 && r.d.account.role === 'shopper' && r.d.account.email === '' && r.d.account.name === 'Grandpa',
		'guest login forgiving match ' + JSON.stringify(r)
	);
	r = await g1('list');
	ok(r.s === 200 && r.d.items.length === 1, 'guest list');
	r = await g1('items/' + it.id + '/purchase', 'POST');
	ok(r.s === 200, 'guest buys');
	r = await g2('guest-login', 'POST', { passphrase: 'Maple River Otter', name: 'grandpa' });
	ok(r.s === 200, 'same name again');
	r = await g2('list');
	ok(r.d.items.length === 1 && r.d.items[0].purchasedAt, 'same name sees own purchase');
	r = await aunt('guest-login', 'POST', { passphrase: 'Maple River Otter', name: 'Aunt Sue', email: 'AUNT@example.com' });
	ok(r.s === 200 && r.d.account.email === 'aunt@example.com', 'old shopper via email');
	r = await aunt('list');
	ok(r.d.items.length === 0, 'bought hidden for others');
	r = await g3('guest-login', 'POST', { passphrase: 'Maple River Otter', name: '' });
	ok(r.s === 400, 'name required');
	r = await g3('guest-login', 'POST', { passphrase: 'Maple River Otter', name: 'X', email: 'fam@example.com' });
	ok(r.s === 409, 'owner email refused');
	r = await g3('guest-login', 'POST', { passphrase: 'Maple River Otter', name: 'X', email: 'nope' });
	ok(r.s === 400, 'bad email');
	r = await g3('guest-access');
	ok(r.s === 401, 'guest-access needs owner (not signed in)');
	r = await g1('guest-access');
	ok(r.s === 403, 'guest cannot see guest-access');
	r = await g1('passphrase', 'POST', { current: 'x', next: 'yyyyyyyy' });
	ok(r.s === 403, 'guest has no passphrase to change');
	r = await g1('items', 'POST', { personId: p.id, title: 'x' });
	ok(r.s === 403, 'guest cannot add');
	// owner changes passphrase with sign-out
	r = await owner('guest-access', 'PUT', { passphrase: 'short' });
	ok(r.s === 400, 'too short');
	r = await owner('guest-access', 'PUT', { passphrase: 'cedar  honey kettle tiger', signOutGuests: true });
	ok(r.s === 200 && r.d.passphrase === 'cedar honey kettle tiger', 'changed');
	r = await g1('list');
	ok(r.s === 401, 'old guest signed out');
	r = await owner('list');
	ok(r.s === 200, 'owner still in');
	// change without sign-out
	await aunt('guest-login', 'POST', { passphrase: 'cedar honey kettle tiger', name: 'Aunt Sue', email: 'aunt@example.com' });
	r = await owner('guest-access', 'PUT', { passphrase: 'cedar honey kettle tiger two', signOutGuests: false });
	ok(r.d.signedIn === 1, 'kept signed in count ' + JSON.stringify(r));
	r = await aunt('list');
	ok(r.s === 200, 'guest kept');
	r = await owner('guests/sign-out', 'POST');
	ok(r.d.signedIn === 0, 'sign out all');
	r = await aunt('list');
	ok(r.s === 401, 'aunt out');
	// forget a guest
	const gp = (await owner('guest-access')).d.guests.find((x) => x.name.toLowerCase() === 'grandpa');
	r = await owner('guests/' + gp.id, 'DELETE');
	ok(r.s === 200 && !r.d.guests.some((x) => x.id === gp.id), 'forget');
	const g4 = jar();
	await g4('guest-login', 'POST', { passphrase: 'cedar honey kettle tiger two', name: 'Zed' });
	r = await g4('list');
	ok(r.d.items.length === 0, 'forgotten guest purchase stays hidden');
	// turn off
	r = await owner('guest-access', 'DELETE');
	ok(r.d.passphrase === '' && r.d.signedIn === 0, 'off');
	r = await g4('list');
	ok(r.s === 401, 'guests out when off');
	r = await g4('guest-login', 'POST', { passphrase: 'anything at all', name: 'Zed' });
	ok(r.s === 403 && r.d.closed, 'closed');
	r = await g4('guest-status');
	ok(r.d.open === false, 'status closed');
	r = await owner('guest-access', 'PUT', { passphrase: 'Maple River Otter' });
	ok(r.s === 200, 'back on');
	// wrong passphrases → limit after 20 from one IP
	for (let i = 0; i < 20; i++) r = await bad('guest-login', 'POST', { passphrase: 'wrong ' + i, name: 'B' });
	ok(r.s === 401, 'wrong passphrase 401');
	r = await bad('guest-login', 'POST', { passphrase: 'Maple River Otter', name: 'B' });
	ok(r.s === 429, 'locked out after 20 wrong (even right one)');
	console.log(`wish guest tests passed (${n} checks)`);
	server.close();
	fs.rmSync(tmp, { recursive: true, force: true });
	process.exit(0);
};
