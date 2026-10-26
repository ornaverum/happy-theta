'use strict';
/* Happy Theta API. Runs behind nginx, which serves the static phys/ pages and
   forwards /phys/api/ here. See README.md for setup. */
const express = require('express');
const { db } = require('./db');
const auth = require('./auth');
const mail = require('./mail');

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
	userByEmail: db.prepare('SELECT id, email, role, password_hash, email_verified_at FROM users WHERE email = ?'),
	userById: db.prepare('SELECT id, email, role FROM users WHERE id = ?'),
	addUser: db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)'),
	setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
	markVerified: db.prepare(
		"UPDATE users SET email_verified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND email_verified_at IS NULL"
	),
	addMessage: db.prepare('INSERT INTO messages (user_id, body) VALUES (?, ?) RETURNING id, body, created_at'),
	allMessages: db.prepare(
		`SELECT m.id, m.body, m.created_at, u.email FROM messages m JOIN users u ON u.id = m.user_id
		 ORDER BY m.created_at DESC, m.id DESC LIMIT ?`
	)
};

/* ---------- small helpers ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u) => ({ email: u.email, role: u.role });
const domainOk = (email) => !ALLOWED_DOMAINS.length || ALLOWED_DOMAINS.includes(email.split('@')[1]);
const readEmail = (req) => String(req.body?.email || '').trim().toLowerCase();
const TOO_MANY = { error: 'Too many attempts. Try again in a few minutes.' };

function passwordProblem(password) {
	if (password.length < 8) return 'Password must be at least 8 characters.';
	if (password.length > 200) return 'Password is too long.';
	return null;
}

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
// Per IP address. Generous because a whole school can share one address; the per-email
// limits below are what protect individual accounts.
const ipLimit = limiter(300, 15 * 60 * 1000); // account requests per IP
const emailLimit = limiter(10, 15 * 60 * 1000); // failed sign-ins per email
const mailLimit = limiter(5, 60 * 60 * 1000); // emails sent to one address per hour (stops inbox spamming)

async function sendVerification(user, pendingPassword) {
	const token = auth.createEmailToken(user.id, 'verify', pendingPassword);
	await mail.send(mail.verifyEmail(user.email, token, BASE));
}

async function sendReset(user) {
	const token = auth.createEmailToken(user.id, 'reset');
	await mail.send(mail.resetEmail(user.email, token, BASE));
}

// Express 4 doesn't catch rejected promises from async handlers.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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
api.use(auth.loadUser);
// Shared activity library for Theta Scheduler (teachers only; its own larger body limit)
api.use('/library', require('./library'));
api.use(express.json({ limit: '16kb' }));

/* Create an account, or (for an email not yet confirmed) send a fresh confirmation link.
   The account can't sign in until a link is clicked, and the password chosen here only
   takes effect then. The page's "Resend" button calls this again. */
api.post(
	'/register',
	wrap(async (req, res) => {
		if (!ipLimit(req.ip)) return res.status(429).json(TOO_MANY);
		const email = readEmail(req);
		const password = String(req.body?.password || '');
		if (email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
		if (!domainOk(email)) return res.status(400).json({ error: `Use your ${ALLOWED_DOMAINS.join(' or ')} email address.` });
		const pwErr = passwordProblem(password);
		if (pwErr) return res.status(400).json({ error: pwErr });

		let user = q.userByEmail.get(email);
		if (user && user.email_verified_at)
			return res.status(409).json({ error: 'An account with that email already exists. Sign in, or use "Forgot password?".' });
		if (!mailLimit(email))
			return res.status(429).json({ error: "We've sent several emails to that address recently. Check your inbox (and spam folder), or try again in an hour." });
		if (!user) {
			const info = q.addUser.run(email, auth.UNVERIFIED_HASH);
			user = { id: info.lastInsertRowid, email };
		}
		try {
			await sendVerification(user, auth.hashPassword(password));
		} catch (err) {
			console.error('verification email failed:', err.message);
			return res.status(502).json({ error: "Your account was created, but the confirmation email couldn't be sent. Try signing in in a few minutes to get a new one." });
		}
		res.status(201).json({ verify: true, email });
	})
);

api.post('/login', (req, res) => {
	if (!ipLimit(req.ip)) return res.status(429).json(TOO_MANY);
	const email = readEmail(req);
	const password = String(req.body?.password || '');
	const user = q.userByEmail.get(email);
	if (user && !user.email_verified_at)
		return res.status(403).json({ error: "This email hasn't been confirmed yet. Use the link we emailed you, or send a new one.", unverified: true });
	const ok = auth.verifyPassword(password, user ? user.password_hash : auth.DUMMY_HASH) && !!user;
	if (!ok) {
		if (!emailLimit(email)) return res.status(429).json(TOO_MANY);
		return res.status(401).json({ error: 'Email or password is incorrect.' });
	}
	auth.startSession(res, user.id);
	res.json({ user: publicUser(user) });
});

/* The link in the confirmation email lands on verify.html, which posts the token here. */
api.post('/verify', (req, res) => {
	if (!ipLimit(req.ip)) return res.status(429).json(TOO_MANY);
	const row = auth.consumeEmailToken(String(req.body?.token || ''), 'verify');
	if (!row)
		return res.status(400).json({ error: 'This confirmation link is invalid, already used, or expired. If your email is already confirmed, just sign in. Otherwise sign in to get a new link.' });
	if (row.pending_password) q.setPassword.run(row.pending_password, row.user_id);
	q.markVerified.run(row.user_id);
	auth.startSession(res, row.user_id);
	res.json({ user: publicUser(q.userById.get(row.user_id)) });
});

/* Email a password-reset link. Same answer whether or not the account exists. */
api.post(
	'/password/forgot',
	wrap(async (req, res) => {
		if (!ipLimit(req.ip)) return res.status(429).json(TOO_MANY);
		const email = readEmail(req);
		if (email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
		const user = q.userByEmail.get(email);
		if (user && mailLimit(email)) {
			try {
				await sendReset(user);
			} catch (err) {
				console.error('reset email failed:', err.message);
			}
		}
		res.json({ ok: true, message: "If there's an account for that email, we've sent a link to reset its password. It works for 1 hour. Check your spam folder too." });
	})
);

/* reset.html checks its link first, so it can show the email or say the link is dead. */
api.post('/password/check', (req, res) => {
	if (!ipLimit(req.ip)) return res.status(429).json(TOO_MANY);
	const row = auth.peekEmailToken(String(req.body?.token || ''), 'reset');
	if (!row) return res.status(400).json({ error: 'This reset link is invalid, already used, or expired. Ask for a new one.' });
	res.json({ email: row.email });
});

api.post('/password/reset', (req, res) => {
	if (!ipLimit(req.ip)) return res.status(429).json(TOO_MANY);
	const password = String(req.body?.password || '');
	const pwErr = passwordProblem(password);
	if (pwErr) return res.status(400).json({ error: pwErr });
	const row = auth.consumeEmailToken(String(req.body?.token || ''), 'reset');
	if (!row) return res.status(400).json({ error: 'This reset link is invalid, already used, or expired. Ask for a new one.' });
	q.setPassword.run(auth.hashPassword(password), row.user_id);
	q.markVerified.run(row.user_id); // they just proved they read this inbox
	auth.endAllSessions(row.user_id); // sign out everywhere else
	auth.startSession(res, row.user_id);
	res.json({ user: publicUser(q.userById.get(row.user_id)) });
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
	app.listen(PORT, HOST, () => {
		console.log(`Happy Theta API on http://${HOST}:${PORT}${BASE}/api (${mail.describe()})`);
		if (process.env.NODE_ENV === 'production' && mail.TRANSPORT === 'log')
			console.warn('WARNING: MAIL_TRANSPORT is "log", so confirmation and reset emails are only printed here, not sent.');
		if (process.env.NODE_ENV === 'production' && !process.env.PUBLIC_URL)
			console.warn('WARNING: PUBLIC_URL is not set, so emailed links point at localhost.');
	});
}

module.exports = app;
