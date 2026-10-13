'use strict';
/* Manage teacher accounts from the droplet's shell.
     node teacher.js add someone@asmsa.org      make an existing account a teacher
     node teacher.js remove someone@asmsa.org   back to student
     node teacher.js list                       show all teachers
   The person must register on the site first. Use the same DB_PATH as the server.
   Add --dev to use the local test database that `npm run dev` uses. */
const path = require('path');
const args = process.argv.slice(2).filter((a) => a !== '--dev');
if (process.argv.includes('--dev')) process.env.DB_PATH = path.join(__dirname, 'data', 'dev.db');
const { db, DB_PATH } = require('./db');

const [cmd, emailArg] = args;
const email = String(emailArg || '').trim().toLowerCase();

function setRole(role) {
	if (!email) return usage();
	const r = db.prepare('UPDATE users SET role = ? WHERE email = ?').run(role, email);
	if (!r.changes) {
		console.error(`No account for ${email} in ${DB_PATH}. They need to register on the site first.`);
		process.exit(1);
	}
	console.log(`${email} is now a ${role}.`);
}

function usage() {
	console.log('Usage: node teacher.js add <email> | remove <email> | list');
	process.exit(1);
}

if (cmd === 'add') setRole('teacher');
else if (cmd === 'remove') setRole('student');
else if (cmd === 'list') {
	const rows = db.prepare("SELECT email, created_at FROM users WHERE role = 'teacher' ORDER BY email").all();
	if (!rows.length) console.log('No teachers yet.');
	rows.forEach((r) => console.log(`${r.email}  (registered ${r.created_at.slice(0, 10)})`));
} else usage();
