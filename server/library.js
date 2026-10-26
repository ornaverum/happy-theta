'use strict';
/* Shared activity library for Theta Scheduler. Teachers publish activities from their courses; any teacher
   can search the library and pull a copy into their own course, where it's theirs to change.
   Only the owner can change or delete a library item. Objectives are stored as AP-style codes
   ("1.2.A", "2.4.A.3") so an item lines up with any course built on those codes, whatever its sequence. */
const crypto = require('crypto');
const express = require('express');
const { db } = require('./db');
const auth = require('./auth');

db.exec(`
CREATE TABLE IF NOT EXISTS library_items (
	id          TEXT PRIMARY KEY,
	owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	data        TEXT NOT NULL,              -- the activity, JSON (see clean() for the fields)
	version     INTEGER NOT NULL DEFAULT 1, -- bumped on every change, so copies can tell they're behind
	forked_from TEXT,                       -- the library item this one started as, if any
	pulls       INTEGER NOT NULL DEFAULT 0, -- how many times it was added to a course
	created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS library_owner ON library_items(owner_id);
`);

const q = {
	all: db.prepare('SELECT l.*, u.email AS owner FROM library_items l JOIN users u ON u.id = l.owner_id'),
	one: db.prepare('SELECT l.*, u.email AS owner FROM library_items l JOIN users u ON u.id = l.owner_id WHERE l.id = ?'),
	insert: db.prepare('INSERT INTO library_items (id, owner_id, data, forked_from) VALUES (?, ?, ?, ?)'),
	update: db.prepare(
		"UPDATE library_items SET data = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_id = ?"
	),
	remove: db.prepare('DELETE FROM library_items WHERE id = ? AND owner_id = ?'),
	pull: db.prepare('UPDATE library_items SET pulls = pulls + 1 WHERE id = ?')
};

/* ---------- validation: keep only known fields, with limits ---------- */
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const CODE_RE = /^[A-Za-z0-9][\w.\-]{0,39}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const tag = (t) =>
	t && typeof t === 'object' && str(t.label, 60)
		? { id: str(t.id, 60) || str(t.label, 60).toLowerCase().replace(/\s+/g, '-'), label: str(t.label, 60), color: COLOR_RE.test(t.color) ? t.color : '#6b7280' }
		: null;

function clean(item) {
	if (!item || typeof item !== 'object') return { error: 'Missing activity.' };
	const title = str(item.title, 200);
	if (!title) return { error: 'An activity needs a title.' };
	const minutes = item.expectedMin === null || item.expectedMin === undefined || item.expectedMin === '' ? null : Number(item.expectedMin);
	const links = (Array.isArray(item.links) ? item.links : [])
		.slice(0, 20)
		.map((l) => ({ label: str(l && l.label, 200), url: str(l && l.url, 2000) }))
		.filter((l) => /^https?:\/\//i.test(l.url));
	const codes = [...new Set((Array.isArray(item.objectiveCodes) ? item.objectiveCodes : []).map((c) => str(c, 40)).filter((c) => CODE_RE.test(c)))].slice(0, 300);
	return {
		item: {
			title,
			type: tag(item.type),
			interaction: tag(item.interaction),
			assessment: ['formative', 'summative'].includes(item.assessment) ? item.assessment : 'none',
			expectedMin: Number.isFinite(minutes) && minutes >= 0 ? Math.min(Math.round(minutes), 100000) : null,
			inClass: !!item.inClass,
			spanMeetings: Number.isInteger(item.spanMeetings) && item.spanMeetings >= 0 ? Math.min(item.spanMeetings, 60) : 0,
			objectiveCodes: codes,
			topicHint: str(item.topicHint, 200),
			links,
			notes: str(item.notes, 8000)
		}
	};
}

const out = (row, me) => ({
	id: row.id,
	owner: row.owner,
	mine: !!me && row.owner_id === me.id,
	version: row.version,
	pulls: row.pulls,
	forkedFrom: row.forked_from || null,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	item: JSON.parse(row.data)
});

/* Does an item's objective code relate to a searched code? Same, more specific, or broader. */
const related = (a, b) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.');

const router = express.Router();
router.use(express.json({ limit: '1mb' }));
router.use(auth.requireTeacher);

/* Search. Query: q (words in title/notes/topic), type (tag id or label), assessment, interaction,
   inClass (1/0), min, max (minutes), codes (comma list: matches items linked to the same, a more
   specific, or a broader objective), mine (1), sort (new|popular|title|minutes), limit, offset */
router.get('/', (req, res) => {
	const Q = req.query;
	const words = String(Q.q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
	const codes = String(Q.codes || '').split(',').map((c) => c.trim()).filter((c) => CODE_RE.test(c)).slice(0, 500);
	const min = Q.min === undefined || Q.min === '' ? null : Number(Q.min);
	const max = Q.max === undefined || Q.max === '' ? null : Number(Q.max);
	const typ = String(Q.type || '').toLowerCase();
	const inter = String(Q.interaction || '').toLowerCase();
	let rows = q.all.all().map((r) => out(r, req.user));
	rows = rows.filter(({ item, mine, owner }) => {
		if (Q.mine === '1' && !mine) return false;
		if (typ && !(item.type && (item.type.id.toLowerCase() === typ || item.type.label.toLowerCase() === typ))) return false;
		if (inter && !(item.interaction && (item.interaction.id.toLowerCase() === inter || item.interaction.label.toLowerCase() === inter))) return false;
		if (Q.assessment && item.assessment !== Q.assessment) return false;
		if (Q.inClass === '1' && !item.inClass) return false;
		if (Q.inClass === '0' && item.inClass) return false;
		if (min !== null && Number.isFinite(min) && !(item.expectedMin !== null && item.expectedMin >= min)) return false;
		if (max !== null && Number.isFinite(max) && !(item.expectedMin !== null && item.expectedMin <= max)) return false;
		if (codes.length && !item.objectiveCodes.some((c) => codes.some((s) => related(c, s)))) return false;
		if (words.length) {
			const hay = [item.title, item.notes, item.topicHint, item.type && item.type.label, owner, ...item.objectiveCodes].join(' ').toLowerCase();
			if (!words.every((w) => hay.includes(w))) return false;
		}
		return true;
	});
	const sort = String(Q.sort || 'new');
	const by = {
		new: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
		popular: (a, b) => b.pulls - a.pulls || b.updatedAt.localeCompare(a.updatedAt),
		title: (a, b) => a.item.title.localeCompare(b.item.title, undefined, { numeric: true }),
		minutes: (a, b) => (a.item.expectedMin ?? 1e9) - (b.item.expectedMin ?? 1e9)
	}[sort] || ((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	rows.sort(by);
	const limit = Math.min(Math.max(parseInt(Q.limit, 10) || 50, 1), 500);
	const offset = Math.max(parseInt(Q.offset, 10) || 0, 0);
	res.json({ total: rows.length, items: rows.slice(offset, offset + limit) });
});

/* Versions of several items at once (comma list of ids) — lets a course see which copies are behind */
router.get('/versions', (req, res) => {
	const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 1000);
	const versions = {};
	for (const id of ids) {
		const r = q.one.get(id);
		if (r) versions[id] = { version: r.version, owner: r.owner, mine: r.owner_id === req.user.id };
	}
	res.json({ versions });
});

router.get('/:id', (req, res) => {
	const r = q.one.get(req.params.id);
	if (!r) return res.status(404).json({ error: 'That activity is no longer in the library.' });
	res.json(out(r, req.user));
});

/* Add one or many (merge): each entry { item, id?, baseVersion?, forkedFrom? }.
   With an id you own: update it (if baseVersion is given and the library moved on, that entry is
   reported as a conflict instead). Without one, or an id you don't own: create a new item of yours. */
function save(entry, user) {
	const c = clean(entry && entry.item);
	if (c.error) return { status: 'error', error: c.error };
	const data = JSON.stringify(c.item);
	const id = typeof entry.id === 'string' ? entry.id : null;
	const existing = id ? q.one.get(id) : null;
	if (existing && existing.owner_id === user.id) {
		if (Number.isInteger(entry.baseVersion) && entry.baseVersion !== existing.version)
			return { status: 'conflict', id, version: existing.version, error: 'This activity was changed in the library since you last synced it.' };
		if (existing.data === data) return { status: 'unchanged', id, version: existing.version };
		q.update.run(data, id, user.id);
		return { status: 'updated', id, version: existing.version + 1 };
	}
	const newId = 'lib_' + crypto.randomBytes(9).toString('base64url');
	const forked = existing ? existing.id : typeof entry.forkedFrom === 'string' ? entry.forkedFrom.slice(0, 40) : null;
	q.insert.run(newId, user.id, data, forked);
	return { status: 'created', id: newId, version: 1, forkedFrom: forked };
}

router.post('/', (req, res) => {
	const r = save(req.body || {}, req.user);
	if (r.status === 'error') return res.status(400).json({ error: r.error });
	if (r.status === 'conflict') return res.status(409).json(r);
	res.status(r.status === 'created' ? 201 : 200).json({ ...r, ...out(q.one.get(r.id), req.user) });
});

router.post('/batch', (req, res) => {
	const entries = Array.isArray(req.body && req.body.entries) ? req.body.entries : null;
	if (!entries) return res.status(400).json({ error: 'Expected a list of activities.' });
	if (entries.length > 500) return res.status(400).json({ error: 'At most 500 activities at a time.' });
	const results = db.transaction(() => entries.map((e) => save(e, req.user)))();
	res.json({ results });
});

router.put('/:id', (req, res) => {
	const existing = q.one.get(req.params.id);
	if (!existing) return res.status(404).json({ error: 'That activity is no longer in the library.' });
	if (existing.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the person who shared an activity can change it. Pull a copy and share your version instead.' });
	const r = save({ ...(req.body || {}), id: req.params.id }, req.user);
	if (r.status === 'error') return res.status(400).json({ error: r.error });
	if (r.status === 'conflict') return res.status(409).json(r);
	res.json({ ...r, ...out(q.one.get(r.id), req.user) });
});

router.delete('/:id', (req, res) => {
	const existing = q.one.get(req.params.id);
	if (!existing) return res.status(404).json({ error: 'That activity is no longer in the library.' });
	if (existing.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the person who shared an activity can remove it.' });
	q.remove.run(req.params.id, req.user.id);
	res.json({ ok: true });
});

/* Count a pull and return the item (the copy itself is made in the browser) */
router.post('/:id/pull', (req, res) => {
	const r = q.one.get(req.params.id);
	if (!r) return res.status(404).json({ error: 'That activity is no longer in the library.' });
	q.pull.run(r.id);
	res.json(out(q.one.get(r.id), req.user));
});

module.exports = router;
