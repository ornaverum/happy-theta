'use strict';
/* WishIMay logins from the droplet's shell. Use the same DB_PATH as the server.
     node wish.js owner you@example.com [--name "The Waddells"]   create an owner login, or set its passphrase
     node wish.js passphrase owner@example.com                    set a new passphrase for an owner
     node wish.js guest-pass                                      set the family guest passphrase (owners can do this on the site)
     node wish.js guest-pass --off                                turn guest sign-in off (signs every guest out)
     node wish.js list                                            owners, the guest passphrase, and guests who have signed in
     node wish.js remove guest@example.com                        forget a guest (their purchases stay hidden)
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
const wishlist = require('./wishlist'); // creates the wish_* tables if needed
const auth = require('./auth');

function usage() {
	console.log('Usage: node wish.js owner|passphrase|remove <email> [--name "Name"] [--pass "passphrase"] [--dev]  |  guest-pass [--pass "words"] [--off]  |  list');
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
		const rows = db.prepare('SELECT role, email, name, last_login_at FROM wish_accounts ORDER BY role, last_login_at DESC').all();
		if (!rows.length) console.log(`No WishIMay logins yet in ${DB_PATH}. Start with: node wish.js owner you@example.com`);
		const g = wishlist.guestAccess.get();
		console.log(g.passphrase ? `Guest passphrase: "${g.passphrase}" (set ${g.setAt || '?'})` : 'Guest sign-in is off (no guest passphrase).');
		for (const r of rows) {
			const who = r.role === 'owner' ? r.email : `${r.name || '(no name)'}${wishlist.isStandInEmail(r.email) ? '' : `  <${r.email}>`}`;
			console.log(`${(r.role === 'owner' ? 'owner' : 'guest').padEnd(6)} ${who}${r.role === 'owner' && r.name ? `  (${r.name})` : ''}  last sign-in: ${r.last_login_at || 'never'}`);
		}
		return;
	}
	if (cmd === 'guest-pass') {
		if (argv.includes('--off')) {
			wishlist.guestAccess.off();
			db.prepare("DELETE FROM wish_sessions WHERE account_id IN (SELECT id FROM wish_accounts WHERE role = 'shopper')").run();
			console.log('Guest sign-in is off, and every guest is signed out.');
			return;
		}
		const pass = String(await askPassphrase()).trim().replace(/\s+/g, ' ');
		if (pass.replace(/[^\p{L}\p{N}]/gu, '').length < 8) {
			console.error('Use at least 8 letters or digits. A few random words works well.');
			process.exit(1);
		}
		wishlist.guestAccess.set(pass);
		console.log(`Guest passphrase set to "${pass}". People already signed in stay signed in (use --off first to sign them out).`);
		return;
	}
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) usage();
	if (cmd === 'shopper') {
		console.error('Shoppers no longer get their own logins. Set the family guest passphrase with: node wish.js guest-pass');
		process.exit(1);
	}
	if (cmd === 'owner') {
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
		if (!a || a.role !== 'owner') {
			console.error(`No owner login for ${email}. (Guests don't have their own passphrase; see guest-pass.)`);
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
			console.error(`No guest with the email ${email}.`);
			process.exit(1);
		}
		db.prepare('DELETE FROM wish_accounts WHERE id = ?').run(a.id);
		console.log(`Removed ${email}. Anything they marked bought stays hidden.`);
		return;
	}
	usage();
}

main();
