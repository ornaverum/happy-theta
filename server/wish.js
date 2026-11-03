'use strict';
/* WishIMay logins from the droplet's shell. Use the same DB_PATH as the server.
     node wish.js owner you@example.com [--name "The Waddells"]   create the shared owner login, or set its passphrase
     node wish.js shopper aunt@example.com [--name "Aunt Sue"]    create a shopper login (owners can also do this on the site)
     node wish.js passphrase someone@example.com                  set a new passphrase for any login
     node wish.js list                                            every login
     node wish.js remove someone@example.com                      delete a shopper login
   You're asked for the passphrase (or pass --pass "words here"). Add --dev for the local test database. */
const path = require('path');
const readline = require('readline');

const argv = process.argv.slice(2);
if (argv.includes('--dev')) process.env.DB_PATH = path.join(__dirname, 'data', 'dev.db');
const opt = (name) => {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : undefined;
};
const positional = argv.filter((a, i) => !a.startsWith('--') && !['--name', '--pass'].includes(argv[i - 1]));
const [cmd, emailArg] = positional;
const email = String(emailArg || '').trim().toLowerCase();

const { db, DB_PATH } = require('./db');
require('./wishlist'); // creates the wish_* tables if needed
const auth = require('./auth');

function usage() {
	console.log('Usage: node wish.js owner|shopper|passphrase|remove <email> [--name "Name"] [--pass "passphrase"] [--dev]  |  list');
	process.exit(1);
}

async function askPassphrase() {
	const given = opt('--pass');
	if (given !== undefined) return given;
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const ask = (qs) => new Promise((r) => rl.question(qs, r));
	const a = await ask('Passphrase (at least 6 characters): ');
	const b = await ask('Type it again: ');
	rl.close();
	if (a !== b) {
		console.error('Those didn’t match.');
		process.exit(1);
	}
	return a;
}

function checkPass(p) {
	if (p.length < 6) {
		console.error('A passphrase needs at least 6 characters.');
		process.exit(1);
	}
}

const find = () => db.prepare('SELECT id, role, email, name FROM wish_accounts WHERE email = ?').get(email);

async function main() {
	if (cmd === 'list') {
		const rows = db.prepare('SELECT role, email, name, last_login_at FROM wish_accounts ORDER BY role, email').all();
		if (!rows.length) console.log(`No WishIMay logins yet in ${DB_PATH}. Start with: node wish.js owner you@example.com`);
		for (const r of rows) console.log(`${r.role.padEnd(8)} ${r.email}${r.name ? `  (${r.name})` : ''}  last sign-in: ${r.last_login_at || 'never'}`);
		return;
	}
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) usage();
	if (cmd === 'owner' || cmd === 'shopper') {
		const existing = find();
		if (existing && existing.role !== cmd) {
			console.error(`${email} is already a ${existing.role} login.`);
			process.exit(1);
		}
		const pass = await askPassphrase();
		checkPass(pass);
		const name = opt('--name');
		if (existing) {
			db.prepare('UPDATE wish_accounts SET pass_hash = ? WHERE id = ?').run(auth.hashPassword(pass), existing.id);
			if (name !== undefined) db.prepare('UPDATE wish_accounts SET name = ? WHERE id = ?').run(name, existing.id);
			db.prepare('DELETE FROM wish_sessions WHERE account_id = ?').run(existing.id);
			console.log(`Updated the ${cmd} login ${email}.`);
		} else {
			db.prepare('INSERT INTO wish_accounts (role, email, name, pass_hash) VALUES (?, ?, ?, ?)').run(cmd, email, name || '', auth.hashPassword(pass));
			console.log(`Created the ${cmd} login ${email}.`);
		}
		return;
	}
	if (cmd === 'passphrase') {
		const a = find();
		if (!a) {
			console.error(`No WishIMay login for ${email}.`);
			process.exit(1);
		}
		const pass = await askPassphrase();
		checkPass(pass);
		db.prepare('UPDATE wish_accounts SET pass_hash = ? WHERE id = ?').run(auth.hashPassword(pass), a.id);
		db.prepare('DELETE FROM wish_sessions WHERE account_id = ?').run(a.id);
		console.log(`New passphrase set for ${email}; they're signed out everywhere.`);
		return;
	}
	if (cmd === 'remove') {
		const a = find();
		if (!a || a.role !== 'shopper') {
			console.error(`No shopper login for ${email}.`);
			process.exit(1);
		}
		db.prepare('DELETE FROM wish_accounts WHERE id = ?').run(a.id);
		console.log(`Removed ${email}. Anything they marked bought stays hidden.`);
		return;
	}
	usage();
}

main();
