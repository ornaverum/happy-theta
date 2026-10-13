'use strict';
/* SQLite storage: users, sessions, email tokens, messages. One file, created on first run. */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'happytheta.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
	id                INTEGER PRIMARY KEY,
	email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash     TEXT NOT NULL,
	role              TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
	created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	email_verified_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
	token_hash TEXT PRIMARY KEY,
	user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
-- One-time links sent by email. purpose: 'verify' (confirm email) or 'reset' (new password).
-- Only a SHA-256 of the token is stored, like sessions. A 'verify' link carries the password
-- hash chosen at the sign-up that sent it; that password only takes effect when the link is
-- used, so someone else signing up with your email can't choose your password.
CREATE TABLE IF NOT EXISTS email_tokens (
	token_hash       TEXT PRIMARY KEY,
	user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	purpose          TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
	expires_at       INTEGER NOT NULL,
	pending_password TEXT
);
CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens(user_id, purpose);
CREATE TABLE IF NOT EXISTS messages (
	id         INTEGER PRIMARY KEY,
	user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	body       TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS messages_created ON messages(created_at);
`);

// Migration for databases made before email verification existed: add the column and
// count those earlier accounts as verified, so nobody already using the site gets locked out.
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'email_verified_at')) {
	db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
	db.exec('UPDATE users SET email_verified_at = created_at');
}

module.exports = { db, DB_PATH };
