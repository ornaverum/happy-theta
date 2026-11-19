'use strict';
/* Theta Canvas: manage a Canvas course's content (assignments, groups, quizzes, modules, pages, announcements)
   from teacher/canvas.html and Quiz Builder. Browsers can't call Canvas directly (CORS), so the calls come
   through here, made with the teacher's own Canvas access token.

   Course content only. Requests are checked against an ALLOWLIST of endpoints (ROUTES below); anything about
   users, enrollments, submissions, grades, gradebook, analytics, conversations… is refused, `include[]` values
   that add student data are refused, and student-related fields are removed from every response (SCRUB).

   The token is stored encrypted (AES-256-GCM) with a key from the environment, CANVAS_TOKEN_KEY, which never
   reaches the database: a copy of the database alone can't use the tokens. It is never logged or sent back.
   Canvas addresses are limited to CANVAS_ALLOWED_HOSTS (default *.instructure.com) so the server can't be
   pointed at other machines.

   GET    /canvas/connection       → { configured, connected, baseUrl, tokenHint, name }
   PUT    /canvas/connection       { baseUrl, token } → checks the token with Canvas, saves it → { name }
   DELETE /canvas/connection       forgets the token
   POST   /canvas/call             { method, path, query, body } → { status, data } (allowlisted; GETs follow pages)
   POST   /canvas/qti              { courseId, name, data (base64 zip), newQuizzes, bankName } → { migration }  */
const crypto = require('crypto');
const express = require('express');
const { db } = require('./db');
const auth = require('./auth');

db.exec(`
CREATE TABLE IF NOT EXISTS canvas_tokens (
	user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	base_url   TEXT NOT NULL,
	token_enc  TEXT NOT NULL,     -- base64(iv | tag | ciphertext), AES-256-GCM
	hint       TEXT NOT NULL,     -- last 4 characters, to show which token is saved
	name       TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`);
const q = {
	get: db.prepare('SELECT * FROM canvas_tokens WHERE user_id = ?'),
	put: db.prepare(`INSERT INTO canvas_tokens (user_id, base_url, token_enc, hint, name) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET base_url = excluded.base_url, token_enc = excluded.token_enc, hint = excluded.hint,
		name = excluded.name, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`),
	del: db.prepare('DELETE FROM canvas_tokens WHERE user_id = ?')
};

/* ---------- token encryption ---------- */
const KEY = process.env.CANVAS_TOKEN_KEY ? crypto.createHash('sha256').update(process.env.CANVAS_TOKEN_KEY).digest() : null;
if (!KEY) console.warn('canvas: CANVAS_TOKEN_KEY is not set, so Theta Canvas is turned off (see server/README.md).');
const seal = (text, userId) => {
	const iv = crypto.randomBytes(12);
	const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
	c.setAAD(Buffer.from('canvas:' + userId)); // a row copied to another user won't decrypt
	const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
	return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
};
const open = (b64, userId) => {
	const b = Buffer.from(b64, 'base64');
	const d = crypto.createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12));
	d.setAAD(Buffer.from('canvas:' + userId));
	d.setAuthTag(b.subarray(12, 28));
	return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
};

/* ---------- which Canvas hosts ---------- */
const HOSTS = String(process.env.CANVAS_ALLOWED_HOSTS || '*.instructure.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const ALLOW_HTTP = process.env.CANVAS_ALLOW_HTTP === '1'; // local testing against a mock only
function cleanBase(raw) {
	let u;
	try { u = new URL(String(raw || '').trim()); } catch { return null; }
	if (u.protocol !== 'https:' && !(ALLOW_HTTP && u.protocol === 'http:')) return null;
	if (u.username || u.password) return null;
	const host = u.hostname.toLowerCase();
	const ok = HOSTS.some((h) => (h.startsWith('*.') ? host.endsWith(h.slice(1)) && host.length > h.length - 1 : host === h));
	return ok ? u.origin : null;
}

/* ---------- the allowlist ---------- */
const ID = '(\\d+)';
const C = `^/api/v1/courses/${ID}`;
const NQ = `^/api/quiz/v1/courses/${ID}`;
const ROUTES = [
	['GET', '^/api/v1/users/self$'],
	['GET', '^/api/v1/courses$'],
	['GET', `${C}$`],
	['PUT', `${C}$`, (b) => onlyKeys(b, { course: ['apply_assignment_group_weights'] })],
	['GET|POST', `${C}/assignments$`],
	['GET|PUT|DELETE', `${C}/assignments/${ID}$`],
	['GET|POST', `${C}/assignment_groups$`],
	['GET|PUT|DELETE', `${C}/assignment_groups/${ID}$`],
	['GET|POST', `${C}/quizzes$`],
	['GET|PUT|DELETE', `${C}/quizzes/${ID}$`],
	['POST', `${C}/quizzes/${ID}/reorder$`],
	['GET|POST', `${C}/quizzes/${ID}/questions$`],
	['GET|PUT|DELETE', `${C}/quizzes/${ID}/questions/${ID}$`],
	['POST', `${C}/quizzes/${ID}/groups$`],
	['GET|PUT|DELETE', `${C}/quizzes/${ID}/groups/${ID}$`],
	['GET|POST', `${C}/modules$`],
	['GET|PUT|DELETE', `${C}/modules/${ID}$`],
	['GET|POST', `${C}/modules/${ID}/items$`],
	['GET|PUT|DELETE', `${C}/modules/${ID}/items/${ID}$`],
	['GET|POST', `${C}/pages$`],
	['GET|PUT|DELETE', `${C}/pages/[A-Za-z0-9_%.-]{1,200}$`],
	['GET|POST', `${C}/discussion_topics$`],
	['GET|PUT|DELETE', `${C}/discussion_topics/${ID}$`],
	['GET', `${C}/content_migrations/${ID}$`],
	['GET', `${C}/content_migrations/${ID}/migration_issues$`],
	['GET', '^/api/v1/progress/(\\d+)$'],
	['GET|POST', `${NQ}/quizzes$`],
	['GET|PATCH|DELETE', `${NQ}/quizzes/${ID}$`],
	['GET|POST', `${NQ}/quizzes/${ID}/items$`],
	['GET|PATCH|DELETE', `${NQ}/quizzes/${ID}/items/${ID}$`]
].map(([m, re, check]) => ({ methods: m.split('|'), re: new RegExp(re), check }));

/* Query parameters that may be passed on, and the include[] values that may be asked for. */
const QUERY_OK = new Set(['move_assignments_to', 'per_page', 'page', 'include[]', 'search_term', 'only_announcements', 'order_by', 'sort', 'enrollment_type', 'state[]', 'scope', 'filter']);
const INCLUDE_OK = new Set(['items', 'content_details', 'assignments', 'discussion_topic', 'term', 'syllabus_body', 'body', 'public_description']);
const QUERY_NO = /student|user|submission|grade|enrollment|observ|override/i;

/* Removed from every response, at any depth. */
const SCRUB = new Set([
	'submission', 'submissions', 'submission_summary', 'needs_grading_count', 'needs_grading_count_by_section', 'overrides',
	'assignment_overrides', 'all_dates', 'student_ids', 'students', 'enrollments', 'users', 'participants', 'recent_students',
	'total_students', 'score', 'grade', 'current_score', 'final_score', 'current_grade', 'final_grade', 'rubric_assessment',
	'score_statistics', 'unread_count', 'read_state', 'subscribed', 'topic_children', 'group_topic_children', 'sections', 'course_progress',
	'last_activity_at', 'observed_users', 'quiz_submission', 'completion_requirement_met', 'state'
]);
const scrub = (v, depth = 0) => {
	if (depth > 20 || v == null || typeof v !== 'object') return v;
	if (Array.isArray(v)) return v.map((x) => scrub(x, depth + 1));
	const o = {};
	for (const [k, x] of Object.entries(v)) if (!SCRUB.has(k)) o[k] = scrub(x, depth + 1);
	return o;
};

function onlyKeys(body, shape) {
	if (!body || typeof body !== 'object') return 'Missing body.';
	for (const [k, v] of Object.entries(body)) {
		if (!shape[k]) return `“${k}” can’t be changed here.`;
		for (const kk of Object.keys(v || {})) if (!shape[k].includes(kk)) return `“${k}.${kk}” can’t be changed here.`;
	}
	return null;
}
function checkRequest(method, path, query, body) {
	if (typeof path !== 'string' || path.length > 400 || /\.\.|\/\/|[?#\s\\]/.test(path)) return 'Bad path.';
	const r = ROUTES.find((x) => x.methods.includes(method) && x.re.test(path));
	if (!r) return 'Theta Canvas only works with course content; that request isn’t allowed.';
	for (const [k, v] of Object.entries(query || {})) {
		if (!QUERY_OK.has(k)) return `The “${k}” option isn’t allowed.`;
		const vals = Array.isArray(v) ? v : [v];
		if (vals.some((x) => typeof x !== 'string' && typeof x !== 'number')) return 'Bad option value.';
		if (k === 'include[]' && vals.some((x) => !INCLUDE_OK.has(String(x)))) return 'That include[] option isn’t allowed.';
		if (k === 'enrollment_type' && !vals.every((x) => x === 'teacher' || x === 'ta' || x === 'designer')) return 'Only your own teaching courses can be listed.';
		if (vals.some((x) => QUERY_NO.test(String(x)) && k !== 'enrollment_type')) return 'Student-related options aren’t allowed.';
	}
	if (path === '/api/v1/courses' && !query.enrollment_type) return 'Only your own teaching courses can be listed.';
	if (r.check) { const e = r.check(body); if (e) return e; }
	if (body != null && JSON.stringify(body).length > 1_500_000) return 'That change is too big.';
	return null;
}

/* ---------- talking to Canvas ---------- */
const TIMEOUT = 30000;
async function canvasFetch(base, token, method, path, query, body) {
	const url = new URL(base + path);
	for (const [k, v] of Object.entries(query || {})) for (const x of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(x));
	if (method === 'GET' && !url.searchParams.has('per_page')) url.searchParams.set('per_page', '100');
	const out = [];
	let next = url.toString(), pages = 0, status = 0, data = null;
	while (next && pages < 30) {
		const res = await fetch(next, {
			method,
			headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', ...(body != null ? { 'Content-Type': 'application/json' } : {}) },
			body: body != null && method !== 'GET' ? JSON.stringify(body) : undefined,
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT)
		});
		status = res.status;
		const text = await res.text();
		try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 300) }; }
		if (!res.ok || method !== 'GET' || !Array.isArray(data)) break;
		out.push(...data);
		pages++;
		const m = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '');
		next = m && new URL(m[1]).origin === new URL(base).origin ? m[1] : null; // never follow a link off the Canvas host
		data = out;
	}
	return { status, data };
}
const canvasError = (status, data) => {
	const msg = (data && (data.message || (data.errors && (Array.isArray(data.errors) ? data.errors.map((e) => e.message || e).join('; ') : JSON.stringify(data.errors).slice(0, 300))))) || '';
	if (status === 401) return 'Canvas didn’t accept the access token (expired or deleted?). Enter a new one in Theta Canvas › Connection.';
	if (status === 403) return 'Canvas says you aren’t allowed to do that in this course.' + (msg ? ' (' + msg + ')' : '');
	if (status === 404) return 'Canvas couldn’t find that (it may have been deleted).';
	return `Canvas error ${status}${msg ? ': ' + msg : ''}`;
};

function connectionOf(user) {
	const row = q.get.get(user.id);
	if (!row) return null;
	try { return { base: row.base_url, token: open(row.token_enc, user.id), row }; } catch { return null; }
}

/* ---------- routes ---------- */
const router = express.Router();
router.use(auth.requireTeacher);
router.use(express.json({ limit: '16mb' }));
const needKey = (req, res, next) => (KEY ? next() : res.status(503).json({ error: 'Theta Canvas isn’t set up on this server yet (the administrator needs to set CANVAS_TOKEN_KEY).' }));
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
	console.error('canvas:', e && e.name, e && e.message && e.message.replace(/Bearer\s+\S+/g, 'Bearer …'));
	res.status(502).json({ error: e && e.name === 'TimeoutError' ? 'Canvas took too long to answer.' : 'Couldn’t reach Canvas. Check the Canvas address.' });
});

router.get('/connection', (req, res) => {
	if (!KEY) return res.json({ configured: false, connected: false });
	const row = q.get.get(req.user.id);
	res.json({ configured: true, connected: !!row, baseUrl: row ? row.base_url : '', tokenHint: row ? '…' + row.hint : '', name: row ? row.name : '', allowedHosts: HOSTS });
});

router.put('/connection', needKey, wrap(async (req, res) => {
	const base = cleanBase(req.body && req.body.baseUrl);
	if (!base) return res.status(400).json({ error: `Use your school’s Canvas address, like https://yourschool.instructure.com (allowed: ${HOSTS.join(', ')}).` });
	let token = String((req.body && req.body.token) || '').trim();
	const existing = q.get.get(req.user.id);
	if (!token && existing) token = open(existing.token_enc, req.user.id); // changing only the address
	if (!/^[\x21-\x7e]{20,300}$/.test(token)) return res.status(400).json({ error: 'That doesn’t look like a Canvas access token.' });
	const r = await canvasFetch(base, token, 'GET', '/api/v1/users/self', {}, null);
	if (r.status !== 200 || !r.data || !r.data.id) return res.status(400).json({ error: canvasError(r.status, r.data) });
	const name = String(r.data.name || r.data.short_name || '').slice(0, 120);
	q.put.run(req.user.id, base, seal(token, req.user.id), token.slice(-4), name);
	res.json({ ok: true, name, baseUrl: base });
}));

router.delete('/connection', (req, res) => {
	q.del.run(req.user.id);
	res.json({ ok: true });
});

router.post('/call', needKey, wrap(async (req, res) => {
	const conn = connectionOf(req.user);
	if (!conn) return res.status(409).json({ error: 'Connect to Canvas first (Theta Canvas › Connection).', notConnected: true });
	const { method = 'GET', path, query = {}, body = null } = req.body || {};
	const M = String(method).toUpperCase();
	const bad = checkRequest(M, path, query, body);
	if (bad) return res.status(403).json({ error: bad });
	const r = await canvasFetch(conn.base, conn.token, M, path, query, ['GET', 'DELETE'].includes(M) && body == null ? null : body);
	if (r.status >= 400) return res.status(r.status === 401 ? 401 : 400).json({ error: canvasError(r.status, r.data), canvasStatus: r.status });
	res.json({ status: r.status, data: scrub(r.data) });
}));

/* QTI import: create a content migration, upload the zip where Canvas says, return the migration to poll. */
router.post('/qti', needKey, wrap(async (req, res) => {
	const conn = connectionOf(req.user);
	if (!conn) return res.status(409).json({ error: 'Connect to Canvas first.', notConnected: true });
	const b = req.body || {};
	const course = String(b.courseId || '');
	if (!/^\d+$/.test(course)) return res.status(400).json({ error: 'Choose a course.' });
	const zip = Buffer.from(String(b.data || ''), 'base64');
	if (zip.length < 22 || zip.length > 12 * 1024 * 1024 || zip.readUInt32LE(0) !== 0x04034b50) return res.status(400).json({ error: 'That isn’t a QTI .zip (or it’s over 12 MB).' });
	const name = String(b.name || 'quiz.qti.zip').replace(/[^\w.\- ]+/g, '').slice(0, 100) || 'quiz.qti.zip';
	const settings = { import_quizzes_next: !!b.newQuizzes };
	if (b.bankName) settings.question_bank_name = String(b.bankName).slice(0, 200);
	const mig = await canvasFetch(conn.base, conn.token, 'POST', `/api/v1/courses/${course}/content_migrations`, {}, {
		migration_type: 'qti_converter', pre_attachment: { name, size: zip.length, content_type: 'application/zip' }, settings
	});
	if (mig.status >= 400 || !mig.data || !mig.data.pre_attachment || !mig.data.pre_attachment.upload_url)
		return res.status(400).json({ error: mig.status >= 400 ? canvasError(mig.status, mig.data) : 'Canvas didn’t give an upload address.' });
	const pa = mig.data.pre_attachment;
	const up = new URL(pa.upload_url);
	if (up.protocol !== 'https:' && !(ALLOW_HTTP && up.protocol === 'http:')) return res.status(502).json({ error: 'Canvas gave an unexpected upload address.' });
	const form = new FormData();
	for (const [k, v] of Object.entries(pa.upload_params || {})) form.append(k, String(v));
	form.append('file', new Blob([zip], { type: 'application/zip' }), name);
	// The upload goes to Canvas's file store (often another host), without the token.
	let ur = await fetch(up, { method: 'POST', body: form, redirect: 'manual', signal: AbortSignal.timeout(60000) });
	if (ur.status >= 300 && ur.status < 400 && ur.headers.get('location')) {
		const loc = new URL(ur.headers.get('location'), up);
		const sameCanvas = loc.origin === new URL(conn.base).origin;
		ur = await fetch(loc, { method: 'GET', headers: sameCanvas ? { Authorization: 'Bearer ' + conn.token } : {}, signal: AbortSignal.timeout(TIMEOUT) });
	}
	if (!ur.ok) return res.status(502).json({ error: `Uploading the file to Canvas failed (${ur.status}).` });
	res.json({ migration: { id: mig.data.id, workflow_state: mig.data.workflow_state, progress_url: mig.data.progress_url } });
}));

module.exports = router;
module.exports._test = { checkRequest, scrub, cleanBase };
