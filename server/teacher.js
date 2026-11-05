'use strict';
/* Manage accounts from the droplet's shell. Use the same DB_PATH (and PUBLIC_URL) as the server.
     node teacher.js add someone@asmsa.org         make an account a teacher
     node teacher.js remove someone@asmsa.org      back to student
     node teacher.js list                          show all teachers
     node teacher.js users                         show every account and whether it's confirmed
     node teacher.js verify someone@asmsa.org      confirm an email by hand (if the email never arrived)
     node teacher.js reset-link someone@asmsa.org  print a 1-hour password-reset link to pass on yourself
   Add --dev to use the local test database that `npm run dev` uses. */
const path = require('path');
const args = process.argv.slice(2).filter((a) => a !== '--dev');
if (process.argv.includes('--dev')) process.env.DB_PATH = path.join(__dirname, 'data', 'dev.db');
const { db, DB_PATH } = require('./db');

const [cmd, emailArg] = args;
const email = String(emailArg || '').trim().toLowerCase();
const BASE = process.env.BASE_PATH || '/phys';

function usage() {
	console.log('Usage: node teacher.js add|remove|verify|reset-link <email>  |  list  |  users');
	process.exit(1);
}

function findUser() {
	if (!email) usage();
	const u = db.prepare('SELECT id, email, role, email_verified_at FROM users WHERE email = ?').get(email);
	if (!u) {
		console.error(`No account for ${email} in ${DB_PATH}. They need to sign up on the site first.`);
		process.exit(1);
	}
	return u;
}

function setRole(role) {
	const u = findUser();
	db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
	console.log(`${u.email} is now a ${role}.`);
	if (!u.email_verified_at) console.log(`Note: ${u.email} hasn't confirmed their email yet, so they can't sign in until they do.`);
}

if (cmd === 'add') setRole('teacher');
else if (cmd === 'remove') setRole('student');
else if (cmd === 'list') {
	const rows = db.prepare("SELECT email, created_at FROM users WHERE role = 'teacher' ORDER BY email").all();
	if (!rows.length) console.log('No teachers yet.');
	rows.forEach((r) => console.log(`${r.email}  (signed up ${r.created_at.slice(0, 10)})`));
} else if (cmd === 'users') {
	const rows = db.prepare('SELECT email, role, created_at, email_verified_at FROM users ORDER BY created_at').all();
	if (!rows.length) console.log('No accounts yet.');
	rows.forEach((r) =>
		console.log(`${r.email.padEnd(36)} ${r.role.padEnd(8)} signed up ${r.created_at.slice(0, 10)}  ${r.email_verified_at ? 'confirmed' : 'NOT CONFIRMED'}`)
	);
} else if (cmd === 'verify') {
	const u = findUser();
	if (u.email_verified_at) {
		console.log(`${u.email} is already confirmed.`);
		process.exit(0);
	}
	// Use the password from their most recent sign-up, if there is one still on file.
	const pending = db
		.prepare("SELECT pending_password FROM email_tokens WHERE user_id = ? AND purpose = 'verify' AND pending_password IS NOT NULL ORDER BY expires_at DESC LIMIT 1")
		.get(u.id);
	db.transaction(() => {
		if (pending) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(pending.pending_password, u.id);
		db.prepare("UPDATE users SET email_verified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(u.id);
		db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'verify'").run(u.id);
	})();
	console.log(`${u.email} is now confirmed.`);
	if (pending) console.log('They can sign in with the password they chose when they signed up.');
	else console.log(`No sign-up password is on file (their links expired), so give them a reset link:  node teacher.js reset-link ${u.email}`);
} else if (cmd === 'reset-link') {
	const u = findUser();
	const auth = require('./auth');
	const { PUBLIC_URL } = require('./mail');
	const token = auth.createEmailToken(u.id, 'reset');
	console.log(`Password-reset link for ${u.email} (works once, for 1 hour):\n${PUBLIC_URL}${BASE}/account/reset.html#t=${token}`);
	if (PUBLIC_URL.includes('localhost')) console.log('(PUBLIC_URL is not set, so this link points at localhost.)');
} else usage();
