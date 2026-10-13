'use strict';
/* Password hashing (scrypt, built into Node) and cookie sessions stored in SQLite. */
const crypto = require('crypto');
const { db } = require('./db');

/* ---------- passwords ---------- */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
	const salt = crypto.randomBytes(16);
	const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
	return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

function verifyPassword(password, stored) {
	const [alg, N, r, p, saltB64, hashB64] = String(stored).split('$');
	if (alg !== 'scrypt') return false;
	const expected = Buffer.from(hashB64, 'base64');
	const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p });
	return crypto.timingSafeEqual(actual, expected);
}

// Used when the email doesn't exist, so a failed login takes the same time either way.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

/* ---------- sessions ---------- */
const COOKIE = 'ht_session';
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);
const BASE = process.env.BASE_PATH || '/phys';
const SECURE = process.env.COOKIE_SECURE !== '0'; // set COOKIE_SECURE=0 only for local http testing

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const q = {
	insert: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
	find: db.prepare(
		`SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = ? AND s.expires_at > ?`
	),
	remove: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
	purge: db.prepare('DELETE FROM sessions WHERE expires_at <= ?')
};

function cookieHeader(value, maxAgeSec) {
	const parts = [`${COOKIE}=${value}`, `Path=${BASE}`, 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
	if (SECURE) parts.push('Secure');
	return parts.join('; ');
}

function readToken(req) {
	const raw = req.headers.cookie || '';
	for (const part of raw.split(';')) {
		const i = part.indexOf('=');
		if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
	}
	return null;
}

function startSession(res, userId) {
	const token = crypto.randomBytes(32).toString('base64url');
	const maxAge = SESSION_DAYS * 86400;
	q.insert.run(sha256(token), userId, Date.now() + maxAge * 1000);
	res.setHeader('Set-Cookie', cookieHeader(token, maxAge));
}

function endSession(req, res) {
	const token = readToken(req);
	if (token) q.remove.run(sha256(token));
	res.setHeader('Set-Cookie', cookieHeader('', 0));
}

/* Express middleware: sets req.user (or null). */
function loadUser(req, _res, next) {
	const token = readToken(req);
	req.user = token ? q.find.get(sha256(token), Date.now()) || null : null;
	next();
}

function requireUser(req, res, next) {
	if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
	next();
}

function requireTeacher(req, res, next) {
	if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
	if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only.' });
	next();
}

function purgeExpired() {
	q.purge.run(Date.now());
}

module.exports = {
	hashPassword,
	verifyPassword,
	DUMMY_HASH,
	startSession,
	endSession,
	loadUser,
	requireUser,
	requireTeacher,
	purgeExpired
};
