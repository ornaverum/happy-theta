'use strict';
/* Happy Theta API. Runs behind nginx, which serves the static phys/ pages and
   forwards /phys/api/ here. See README.md for setup. */
const express = require('express');
const { db } = require('./db');
const auth = require('./auth');

const BASE = process.env.BASE_PATH || '/phys';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_MESSAGE = 2000;
// Optional: "asmsa.org,students.asmsa.org" limits sign-up to those email domains. Empty = anyone.
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || '')
	.split(',')
	.map((d) => d.trim().toLowerCase())
	.filter(Boolean);

const q = {
	userByEmail: db.prepare('SELECT id, email, role, password_hash FROM users WHERE email = ?'),
	addUser: db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)'),
	addMessage: db.prepare('INSERT INTO messages (user_id, body) VALUES (?, ?) RETURNING id, body, created_at'),
	allMessages: db.prepare(
		`SELECT m.id, m.body, m.created_at, u.email FROM messages m JOIN users u ON u.id = m.user_id
		 ORDER BY m.created_at DESC, m.id DESC LIMIT ?`
	)
};

/* ---------- small helpers ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u) => ({ email: u.email, role: u.role });

// Simple in-memory limiter: at most `max` hits per key per window.
function limiter(max, windowMs) {
	const hits = new Map();
	setInterval(() => {
		const now = Date.now();
		for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
	}, windowMs).unref();
	return (key) => {
		const now = Date.now();
		let h = hits.get(key);
		if (!h || h.reset <= now) hits.set(key, (h = { n: 0, reset: now + windowMs }));
		return ++h.n <= max;
	};
}
const ipLimit = limiter(30, 15 * 60 * 1000); // sign-in/up attempts per IP
const emailLimit = limiter(10, 15 * 60 * 1000); // failed sign-ins per email

/* ---------- app ---------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback'); // nginx on the same machine sets X-Forwarded-For

const api = express.Router();
api.use((req, res, next) => {
	res.setHeader('Cache-Control', 'no-store');
	// State-changing requests must be same-origin JSON (blocks cross-site form posts).
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		if (!req.is('application/json')) return res.status(415).json({ error: 'Expected JSON.' });
		const origin = req.headers.origin;
		if (origin) {
			const host = req.headers['x-forwarded-host'] || req.headers.host;
			let ok = false;
			try {
				ok = new URL(origin).host === host;
			} catch {}
			if (!ok) return res.status(403).json({ error: 'Cross-site request blocked.' });
		}
	}
	next();
});
api.use(express.json({ limit: '16kb' }));
api.use(auth.loadUser);

api.post('/register', (req, res) => {
	if (!ipLimit(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
	const email = String(req.body?.email || '').trim().toLowerCase();
	const password = String(req.body?.password || '');
	if (email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
	if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(email.split('@')[1]))
		return res.status(400).json({ error: `Use your ${ALLOWED_DOMAINS.join(' or ')} email address.` });
	if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
	if (password.length > 200) return res.status(400).json({ error: 'Password is too long.' });
	if (q.userByEmail.get(email)) return res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' });
	const info = q.addUser.run(email, auth.hashPassword(password));
	auth.startSession(res, info.lastInsertRowid);
	res.status(201).json({ user: { email, role: 'student' } });
});

api.post('/login', (req, res) => {
	if (!ipLimit(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
	const email = String(req.body?.email || '').trim().toLowerCase();
	const password = String(req.body?.password || '');
	const user = q.userByEmail.get(email);
	const ok = auth.verifyPassword(password, user ? user.password_hash : auth.DUMMY_HASH) && !!user;
	if (!ok) {
		if (!emailLimit(email)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
		return res.status(401).json({ error: 'Email or password is incorrect.' });
	}
	auth.startSession(res, user.id);
	res.json({ user: publicUser(user) });
});

api.post('/logout', (req, res) => {
	auth.endSession(req, res);
	res.json({ ok: true });
});

// Never 401s, so pages can ask "am I signed in?" without a console error.
api.get('/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

api.post('/messages', auth.requireUser, (req, res) => {
	const body = String(req.body?.body || '').trim();
	if (!body) return res.status(400).json({ error: 'Type a message first.' });
	if (body.length > MAX_MESSAGE) return res.status(400).json({ error: `Messages can be at most ${MAX_MESSAGE} characters.` });
	res.status(201).json({ message: q.addMessage.get(req.user.id, body) });
});

api.get('/messages', auth.requireTeacher, (req, res) => {
	const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 5000);
	res.json({ messages: q.allMessages.all(limit) });
});

api.use((req, res) => res.status(404).json({ error: 'Not found.' }));
api.use((err, req, res, _next) => {
	if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON.' });
	if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
	console.error(err);
	res.status(500).json({ error: 'Server error.' });
});

app.use(`${BASE}/api`, api);

// Local development only: also serve the static pages (nginx does this in production).
if (process.env.STATIC_DIR) {
	app.get('/', (req, res) => res.redirect(`${BASE}/`));
	app.use(BASE, express.static(process.env.STATIC_DIR));
}

auth.purgeExpired();
setInterval(auth.purgeExpired, 60 * 60 * 1000).unref();

if (require.main === module) {
	app.listen(PORT, HOST, () => console.log(`Happy Theta API on http://${HOST}:${PORT}${BASE}/api`));
}

module.exports = app;
