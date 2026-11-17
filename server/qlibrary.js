'use strict';
/* Shared question library for Theta Questions (teacher/questions.html) and the Quiz Builder.
   Teachers share questions from their banks; any teacher can search the library and pull a copy into a bank,
   where it's theirs to change. Only the owner can change or remove a library question.
   A question is stored in the bank's own JSON shape (teacher/js/qb-core.js documents it); this file only
   checks sizes and types, keeps known fields, and drops the bank-only ones (lib link, source).
   Each question carries its course framework ({ id, label }, e.g. "ap-physics-1") so objective codes mean
   one thing.

   GET    /                 search: q, type (mc|ma|num|match), course, codes (comma list), unit, topic,
                            diffMin, diffMax, randomized (1|0), mine (1), sort (new|popular|difficulty), limit, offset
                            → { total, items: [{ id, owner, mine, version, pulls, ..., question (no image data), hasImage }] }
   GET    /facets           → { courses: [{id,label,count}], units: [...], topics: [...] }
   GET    /versions?ids=    → { versions: { id: { version, mine } } }
   GET    /:id              one, with the image
   POST   /batch            { entries: [{ question, course, id?, baseVersion? }] } → { results: [{ status, id, version }] }
   DELETE /:id              owner only
   POST   /:id/pull         counts a pull, returns the full question */
const crypto = require('crypto');
const express = require('express');
const { db } = require('./db');
const auth = require('./auth');

db.exec(`
CREATE TABLE IF NOT EXISTS question_library (
	id          TEXT PRIMARY KEY,
	owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	data        TEXT NOT NULL,              -- { question, course } JSON
	version     INTEGER NOT NULL DEFAULT 1,
	forked_from TEXT,
	pulls       INTEGER NOT NULL DEFAULT 0,
	created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS question_library_owner ON question_library(owner_id);
`);

const q = {
	all: db.prepare('SELECT l.*, u.email AS owner FROM question_library l JOIN users u ON u.id = l.owner_id'),
	one: db.prepare('SELECT l.*, u.email AS owner FROM question_library l JOIN users u ON u.id = l.owner_id WHERE l.id = ?'),
	insert: db.prepare('INSERT INTO question_library (id, owner_id, data, forked_from) VALUES (?, ?, ?, ?)'),
	update: db.prepare("UPDATE question_library SET data = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_id = ?"),
	remove: db.prepare('DELETE FROM question_library WHERE id = ? AND owner_id = ?'),
	pull: db.prepare('UPDATE question_library SET pulls = pulls + 1 WHERE id = ?')
};

/* ---------- validation ---------- */
const MAX_IMAGE = 1.5 * 1024 * 1024; // data: URL characters
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : typeof v === 'number' ? String(v).slice(0, max) : '');
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const COURSE_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const CODE_RE = /^[A-Za-z0-9][\w.\-]{0,39}$/;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const TYPES = ['mc', 'ma', 'num', 'match'];
const list = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
const course = (c) => (c && typeof c === 'object' && COURSE_RE.test(c.id) ? { id: c.id, label: str(c.label, 80) || c.id } : null);

function clean(raw) {
	if (!raw || typeof raw !== 'object') return { error: 'Missing question.' };
	if (!TYPES.includes(raw.type)) return { error: 'Unknown question type.' };
	const stem = str(raw.stem, 20000);
	if (!stem.trim()) return { error: 'A question needs text.' };
	let image = null;
	if (raw.image && typeof raw.image.data === 'string') {
		if (!/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(raw.image.data)) return { error: 'That image isn’t a supported picture.' };
		if (raw.image.data.length > MAX_IMAGE) return { error: 'The image is too big for the library (about 1 MB at most).' };
		image = { name: str(raw.image.name, 120), mime: str(raw.image.mime, 40), data: raw.image.data, alt: str(raw.image.alt, 300) };
	}
	const t = raw.tags || {};
	const a = raw.answer || {};
	const f = raw.feedback || {};
	return {
		question: {
			type: raw.type, title: str(raw.title, 200), stem, image, points: Math.max(0, Math.min(1000, num(raw.points, 1))),
			choices: list(raw.choices, 30).map((c) => ({ id: str(c && c.id, 40), text: str(c && c.text, 4000), correct: !!(c && c.correct), feedback: str(c && c.feedback, 4000) })),
			answer: { expr: str(a.expr, 500), unit: str(a.unit, 60), tol: num(a.tol, 2), tolMode: a.tolMode === 'abs' ? 'abs' : '%', sigfigs: Math.max(1, Math.min(10, num(a.sigfigs, 3))) },
			pairs: list(raw.pairs, 40).map((p) => ({ id: str(p && p.id, 40), left: str(p && p.left, 2000), right: str(p && p.right, 2000) })),
			distractors: list(raw.distractors, 40).map((d) => str(d, 2000)),
			vars: list(raw.vars, 30).filter((v) => v && NAME_RE.test(v.name)).map((v) => ({ name: v.name, min: num(v.min, 0), max: num(v.max, 0), step: v.step == null || v.step === '' ? null : num(v.step, null) })),
			calcs: list(raw.calcs, 30).filter((c) => c && NAME_RE.test(c.name)).map((c) => ({ name: c.name, expr: str(c.expr, 500) })),
			constraint: str(raw.constraint, 500), shuffle: raw.shuffle !== false,
			feedback: { correct: str(f.correct, 4000), incorrect: str(f.incorrect, 4000), general: str(f.general, 4000) },
			solution: str(raw.solution, 20000),
			tags: {
				unit: str(t.unit, 120),
				topics: [...new Set(list(t.topics, 30).map((x) => str(x, 120).trim()).filter(Boolean))],
				objectives: list(t.objectives, 100).filter((o) => o && CODE_RE.test(o.code)).map((o) => ({ fw: str(o.fw, 60), code: o.code })),
				difficulty: Math.max(0, Math.min(5, Math.round(num(t.difficulty, 0)))),
				custom: [...new Set(list(t.custom, 30).map((x) => str(x, 60).trim()).filter(Boolean))]
			}
		}
	};
}

const isRandom = (qq) => qq.vars.some((v) => v.max > v.min);
const out = (row, me, withImage) => {
	const d = JSON.parse(row.data);
	const question = { ...d.question };
	const hasImage = !!question.image;
	if (!withImage && question.image) question.image = { ...question.image, data: '' };
	return { id: row.id, owner: row.owner, mine: !!me && row.owner_id === me.id, version: row.version, pulls: row.pulls, forkedFrom: row.forked_from || null, createdAt: row.created_at, updatedAt: row.updated_at, course: d.course || null, question, hasImage };
};
const related = (a, b) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.');

const router = express.Router();
router.use(express.json({ limit: '12mb' }));
router.use(auth.requireTeacher);

router.get('/', (req, res) => {
	const Q = req.query;
	const words = String(Q.q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
	const codes = String(Q.codes || '').split(',').map((c) => c.trim()).filter((c) => CODE_RE.test(c)).slice(0, 200);
	const types = String(Q.type || '').split(',').filter((t) => TYPES.includes(t));
	const crs = COURSE_RE.test(String(Q.course || '')) ? String(Q.course) : '';
	const dmin = num(Q.diffMin, 0), dmax = num(Q.diffMax, 0);
	let rows = q.all.all().map((r) => out(r, req.user, false));
	rows = rows.filter(({ question: qq, course: c, mine, owner }) => {
		if (Q.mine === '1' && !mine) return false;
		if (crs && !(c && c.id === crs)) return false;
		if (types.length && !types.includes(qq.type)) return false;
		if (Q.unit && qq.tags.unit !== Q.unit) return false;
		if (Q.topic && !qq.tags.topics.includes(Q.topic)) return false;
		if (dmin && qq.tags.difficulty < dmin) return false;
		if (dmax && (!qq.tags.difficulty || qq.tags.difficulty > dmax)) return false;
		if (Q.randomized === '1' && !isRandom(qq)) return false;
		if (Q.randomized === '0' && isRandom(qq)) return false;
		if (codes.length && !qq.tags.objectives.some((o) => codes.some((s) => related(o.code, s)))) return false;
		if (words.length) {
			const hay = [qq.title, qq.stem, qq.solution, qq.tags.unit, ...qq.tags.topics, ...qq.tags.custom, ...qq.tags.objectives.map((o) => o.code), ...qq.choices.map((x) => x.text), ...qq.pairs.flatMap((p) => [p.left, p.right]), owner].join(' ').toLowerCase();
			if (!words.every((w) => hay.includes(w))) return false;
		}
		return true;
	});
	const by = {
		new: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
		popular: (a, b) => b.pulls - a.pulls || b.updatedAt.localeCompare(a.updatedAt),
		difficulty: (a, b) => (a.question.tags.difficulty || 9) - (b.question.tags.difficulty || 9) || b.updatedAt.localeCompare(a.updatedAt)
	}[String(Q.sort || 'new')] || ((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	rows.sort(by);
	const limit = Math.min(Math.max(parseInt(Q.limit, 10) || 50, 1), 200);
	const offset = Math.max(parseInt(Q.offset, 10) || 0, 0);
	res.json({ total: rows.length, items: rows.slice(offset, offset + limit) });
});

router.get('/facets', (req, res) => {
	const courses = new Map(), units = new Set(), topics = new Set();
	for (const r of q.all.all()) {
		const d = JSON.parse(r.data);
		const c = d.course || { id: null, label: 'No framework' };
		(courses.get(c.id) || courses.set(c.id, { id: c.id, label: c.label, count: 0 }).get(c.id)).count++;
		if (d.question.tags.unit) units.add(d.question.tags.unit);
		d.question.tags.topics.forEach((t) => topics.add(t));
	}
	const s = (x) => [...x].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
	res.json({ courses: [...courses.values()].sort((a, b) => String(a.label).localeCompare(String(b.label))), units: s(units), topics: s(topics) });
});

router.get('/versions', (req, res) => {
	const versions = {};
	for (const id of String(req.query.ids || '').split(',').filter(Boolean).slice(0, 1000)) {
		const r = q.one.get(id);
		if (r) versions[id] = { version: r.version, mine: r.owner_id === req.user.id };
	}
	res.json({ versions });
});

router.get('/:id', (req, res) => {
	const r = q.one.get(req.params.id);
	if (!r) return res.status(404).json({ error: 'That question is no longer in the library.' });
	res.json(out(r, req.user, true));
});

function save(entry, user) {
	const c = clean(entry && entry.question);
	if (c.error) return { status: 'error', error: c.error };
	const id = typeof entry.id === 'string' ? entry.id : null;
	const existing = id ? q.one.get(id) : null;
	const data = JSON.stringify({ question: c.question, course: course(entry.course) || (existing ? JSON.parse(existing.data).course : null) });
	if (existing && existing.owner_id === user.id) {
		if (Number.isInteger(entry.baseVersion) && entry.baseVersion !== existing.version)
			return { status: 'conflict', id, version: existing.version, error: 'This question was changed in the library since you last shared it.' };
		if (existing.data === data) return { status: 'unchanged', id, version: existing.version };
		q.update.run(data, id, user.id);
		return { status: 'updated', id, version: existing.version + 1 };
	}
	const newId = 'qlib_' + crypto.randomBytes(9).toString('base64url');
	const forked = existing ? existing.id : typeof entry.forkedFrom === 'string' ? entry.forkedFrom.slice(0, 40) : null;
	q.insert.run(newId, user.id, data, forked);
	return { status: 'created', id: newId, version: 1, forkedFrom: forked };
}

router.post('/batch', (req, res) => {
	const entries = Array.isArray(req.body && req.body.entries) ? req.body.entries : null;
	if (!entries) return res.status(400).json({ error: 'Expected a list of questions.' });
	if (entries.length > 200) return res.status(400).json({ error: 'At most 200 questions at a time.' });
	const results = db.transaction(() => entries.map((e) => save(e, req.user)))();
	res.json({ results });
});

router.delete('/:id', (req, res) => {
	const existing = q.one.get(req.params.id);
	if (!existing) return res.status(404).json({ error: 'That question is no longer in the library.' });
	if (existing.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the teacher who shared a question can remove it.' });
	q.remove.run(req.params.id, req.user.id);
	res.json({ ok: true });
});

router.post('/:id/pull', (req, res) => {
	const r = q.one.get(req.params.id);
	if (!r) return res.status(404).json({ error: 'That question is no longer in the library.' });
	q.pull.run(r.id);
	res.json(out(q.one.get(r.id), req.user, true));
});

module.exports = router;
