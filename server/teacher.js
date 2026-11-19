'use strict';
/* Manage accounts from the droplet's shell. Use the same DB_PATH (and PUBLIC_URL) as the server.
     node teacher.js add someone@asmsa.org …       make accounts teachers. Emails with no account yet are
                                                   pre-approved: they start as teachers when they sign up.
                                                   Several at once: add a@asmsa.org b@asmsa.org, or add $(cat list.txt)
     node teacher.js remove someone@asmsa.org …    back to student (or no longer pre-approved)
     node teacher.js list                          show all teachers and pre-approved emails
     node teacher.js users                         show every account and whether it's confirmed
     node teacher.js verify someone@asmsa.org      confirm an email by hand (if the email never arrived)
     node teacher.js reset-link someone@asmsa.org  print a 1-hour pass-phrase reset link to pass on yourself
     node teacher.js export someone@asmsa.org > their-work.json
                                                   everything they've saved, as one backup file (the same kind the
                                                   dashboards' "Export all my work" makes; question-bank pictures are put back
                                                   inside their banks, but Theta Marks / Maps pictures and attachments only
                                                   live in their browser). --out file.json writes a file instead.
     node teacher.js import someone@asmsa.org file.json
                                                   add the saves in a backup or tool file to their account (nothing is
                                                   overwritten: a save whose id is already there gets a new id)
   Add --dev to use the local test database that `npm run dev` uses. */
const path = require('path');
const argv = process.argv.slice(2).filter((a) => a !== '--dev');
const outIdx = argv.indexOf('--out');
const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;
const args = outIdx >= 0 ? argv.filter((_, i) => i !== outIdx && i !== outIdx + 1) : argv;
if (process.argv.includes('--dev')) process.env.DB_PATH = path.join(__dirname, 'data', 'dev.db');
const { db, DB_PATH } = require('./db');

const [cmd, emailArg, fileArg] = args;
const emails = args.slice(1).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
const email = String(emailArg || '').trim().toLowerCase();
const BASE = process.env.BASE_PATH ?? '/phys';

function usage() {
	console.log('Usage: node teacher.js add|remove <email> [more emails…]  |  verify|reset-link|export <email>  |  import <email> <file>  |  list  |  users');
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userRow = db.prepare('SELECT id, email, role, email_verified_at FROM users WHERE email = ?');

if (cmd === 'add' || cmd === 'remove') {
	if (!emails.length) usage();
	const teacher = cmd === 'add';
	for (const e of emails) {
		const u = userRow.get(e);
		if (u) {
			db.prepare('UPDATE users SET role = ? WHERE id = ?').run(teacher ? 'teacher' : 'student', u.id);
			db.prepare('DELETE FROM teacher_invites WHERE email = ?').run(e);
			console.log(`${u.email} is now a ${teacher ? 'teacher' : 'student'}.`);
			if (teacher && !u.email_verified_at) console.log(`  Note: ${u.email} hasn't confirmed their email yet, so they can't sign in until they do.`);
		} else if (teacher) {
			if (!EMAIL_RE.test(e)) {
				console.log(`Skipped "${e}": not an email address.`);
				continue;
			}
			db.prepare('INSERT OR IGNORE INTO teacher_invites (email) VALUES (?)').run(e);
			console.log(`${e} is pre-approved: no account yet, it starts as a teacher when they sign up.`);
		} else {
			const gone = db.prepare('DELETE FROM teacher_invites WHERE email = ?').run(e).changes;
			console.log(gone ? `${e} is no longer pre-approved.` : `No account or pre-approval for ${e}.`);
		}
	}
} else if (cmd === 'list') {
	const rows = db.prepare("SELECT email, created_at FROM users WHERE role = 'teacher' ORDER BY email").all();
	if (!rows.length) console.log('No teachers yet.');
	rows.forEach((r) => console.log(`${r.email}  (signed up ${r.created_at.slice(0, 10)})`));
	const inv = db.prepare('SELECT email, added_at FROM teacher_invites ORDER BY email').all();
	if (inv.length) {
		console.log('\nPre-approved, not signed up yet:');
		inv.forEach((r) => console.log(`${r.email}  (added ${r.added_at.slice(0, 10)})`));
	}
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
	console.log(`Pass-phrase reset link for ${u.email} (works once, for 1 hour):\n${PUBLIC_URL}${BASE}/account/reset.html#t=${token}`);
	if (PUBLIC_URL.includes('localhost')) console.log('(PUBLIC_URL is not set, so this link points at localhost.)');
} else if (cmd === 'export') {
	const u = findUser();
	const bundle = require('./bundle');
	require('./docs'); // makes sure the user_docs table exists
	const assets = require('./assets'); // question pictures go back inside their banks / quizzes
	const rows = db.prepare('SELECT data FROM user_docs WHERE user_id = ? AND data IS NOT NULL ORDER BY tool, modified').all(u.id);
	const out = bundle.make(rows.map((r) => assets.inline(u.id, JSON.parse(r.data))), { who: u.email, from: 'server' });
	const text = JSON.stringify(out, null, 1);
	if (outFile) {
		require('fs').writeFileSync(outFile, text);
		console.error(`Wrote ${rows.length} save${rows.length === 1 ? '' : 's'} for ${u.email} to ${outFile}.`);
	} else {
		process.stdout.write(text + '\n');
		console.error(`${rows.length} save${rows.length === 1 ? '' : 's'} for ${u.email}.`);
	}
	console.error('Pictures in Theta Marks and files attached in Theta Maps are not on the server, so they are not included.');
} else if (cmd === 'import') {
	const u = findUser();
	if (!fileArg) usage();
	const bundle = require('./bundle');
	const { TOOLS } = require('./docs');
	let parsed;
	try {
		parsed = bundle.read(require('fs').readFileSync(fileArg, 'utf8'));
	} catch (err) {
		console.error(`Couldn't read ${fileArg}: ${err.message}`);
		process.exit(1);
	}
	const allowed = TOOLS[u.role] || TOOLS.student;
	const has = db.prepare('SELECT 1 FROM user_docs WHERE user_id = ? AND tool = ? AND doc_id = ?');
	const ins = db.prepare('INSERT INTO user_docs (user_id, tool, doc_id, rev, title, modified, data, size) VALUES (?, ?, ?, 1, ?, ?, ?, ?)');
	const counts = {};
	let skipped = 0;
	db.transaction(() => {
		for (const doc of parsed.docs) {
			if (!allowed.includes(doc.tool)) {
				skipped++;
				continue;
			}
			while (has.get(u.id, doc.tool, doc.id)) doc.id = bundle.newId();
			const json = JSON.stringify(doc);
			ins.run(u.id, doc.tool, doc.id, String(doc.meta.title || '').slice(0, 200), String(doc.meta.modified || '').slice(0, 40), json, json.length);
			counts[doc.tool] = (counts[doc.tool] || 0) + 1;
		}
	})();
	const NAMES = { fbd: 'Free Body Diagram', energy: 'Energy Diagram', motion: 'Motion Diagram', graph: 'Graph Maker', scheduler: 'Theta Scheduler course', schedtemplate: 'scheduler template', mindmap: 'Theta Maps map', marks: 'Theta Marks collection' };
	const list = Object.entries(counts).map(([t, n]) => `${n} × ${NAMES[t] || t}`).join(', ') || 'nothing';
	console.log(`Added ${list} to ${u.email}.`);
	if (skipped) console.log(`Skipped ${skipped} save${skipped === 1 ? '' : 's'} for tools a ${u.role} account can't store (make them a teacher first to bring those in).`);
	if (parsed.assetCount) console.log(`The file also has ${parsed.assetCount} picture/attachment${parsed.assetCount === 1 ? '' : 's'}; those only come back through the dashboard's Import, in the browser.`);
	console.log('They appear the next time that person opens any Happy Theta page.');
} else usage();
