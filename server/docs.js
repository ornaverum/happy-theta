'use strict';
/* Saved work for signed-in users. Every Happy Theta tool saves the same JSON envelope
   ({format:'happytheta', tool, id, meta, data, view}); the browser keeps a copy in localStorage and
   shared/gate.js syncs it here, so a signed-in user's work follows them to any computer.
   Guests (preview mode) never call this: their work stays in their browser.

   GET    /docs?tools=a,b        list (no data): [{tool, id, rev, title, modified, deleted}]
   GET    /docs/:tool/:id        one doc: {doc, rev}
   PUT    /docs/:tool/:id        {doc, baseRev} → {rev}; 409 {conflict, rev} if someone saved since baseRev
   DELETE /docs/:tool/:id        {baseRev} → {rev}; leaves a tombstone so other computers delete it too */
const express = require('express');
const { db } = require('./db');
const auth = require('./auth');

db.exec(`
CREATE TABLE IF NOT EXISTS user_docs (
	user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	tool       TEXT NOT NULL,
	doc_id     TEXT NOT NULL,
	rev        INTEGER NOT NULL DEFAULT 1,     -- bumped on every save
	title      TEXT NOT NULL DEFAULT '',
	modified   TEXT NOT NULL DEFAULT '',       -- the envelope's meta.modified (set by the browser)
	data       TEXT,                           -- the whole envelope as JSON; NULL once deleted
	size       INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY (user_id, tool, doc_id)
);
`);

// Which tools each role may store. Teacher tools (scheduler, maps) are for teacher accounts only.
const TOOLS = {
	student: ['fbd', 'energy', 'motion', 'graph', 'marks'],
	teacher: ['fbd', 'energy', 'motion', 'graph', 'marks', 'scheduler', 'schedtemplate', 'mindmap']
};
const MAX_DOC = Number(process.env.DOC_MAX_BYTES || 3 * 1024 * 1024); // one save
const MAX_TOTAL = Number(process.env.DOC_QUOTA_BYTES || 60 * 1024 * 1024); // everything one user stores
const MAX_COUNT = 3000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const q = {
	list: db.prepare('SELECT tool, doc_id AS id, rev, title, modified, data IS NULL AS deleted FROM user_docs WHERE user_id = ?'),
	one: db.prepare('SELECT rev, data FROM user_docs WHERE user_id = ? AND tool = ? AND doc_id = ?'),
	usage: db.prepare('SELECT COALESCE(SUM(size), 0) AS bytes, COUNT(*) AS n FROM user_docs WHERE user_id = ? AND data IS NOT NULL'),
	insert: db.prepare('INSERT INTO user_docs (user_id, tool, doc_id, rev, title, modified, data, size) VALUES (?, ?, ?, 1, ?, ?, ?, ?)'),
	update: db.prepare(
		`UPDATE user_docs SET rev = rev + 1, title = ?, modified = ?, data = ?, size = ?,
		 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND tool = ? AND doc_id = ?`
	),
	tomb: db.prepare(
		`UPDATE user_docs SET rev = rev + 1, data = NULL, size = 0,
		 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND tool = ? AND doc_id = ?`
	)
};

const router = express.Router();
router.use(auth.requireUser);
router.use(express.json({ limit: MAX_DOC + 64 * 1024 }));

const allowed = (req) => TOOLS[req.user.role] || TOOLS.student;

function target(req, res) {
	const { tool, id } = req.params;
	if (!ID_RE.test(id)) return res.status(400).json({ error: 'Bad id.' }), null;
	if (!allowed(req).includes(tool))
		return res.status(403).json({ error: 'Your account can’t save this tool’s work to the server.' }), null;
	return { tool, id };
}

router.get('/', (req, res) => {
	const want = String(req.query.tools || '')
		.split(',')
		.filter(Boolean);
	const ok = allowed(req);
	const docs = q.list
		.all(req.user.id)
		.filter((d) => ok.includes(d.tool) && (!want.length || want.includes(d.tool)))
		.map((d) => ({ ...d, deleted: !!d.deleted }));
	res.json({ docs, tools: ok });
});

router.get('/:tool/:id', (req, res) => {
	const t = target(req, res);
	if (!t) return;
	const row = q.one.get(req.user.id, t.tool, t.id);
	if (!row) return res.status(404).json({ error: 'Not found.' });
	res.json({ rev: row.rev, doc: row.data ? JSON.parse(row.data) : null, deleted: !row.data });
});

router.put('/:tool/:id', (req, res) => {
	const t = target(req, res);
	if (!t) return;
	const doc = req.body?.doc;
	if (!doc || typeof doc !== 'object' || doc.format !== 'happytheta' || doc.tool !== t.tool || doc.id !== t.id || !doc.data)
		return res.status(400).json({ error: 'That isn’t a Happy Theta save for this tool.' });
	const json = JSON.stringify(doc);
	if (json.length > MAX_DOC) return res.status(413).json({ error: 'This save is too big to keep on the server.' });
	const title = String(doc.meta?.title || '').slice(0, 200);
	const modified = String(doc.meta?.modified || '').slice(0, 40);
	const baseRev = Number(req.body?.baseRev) || 0;

	const result = db.transaction(() => {
		const row = q.one.get(req.user.id, t.tool, t.id);
		const use = q.usage.get(req.user.id);
		const oldSize = row && row.data ? row.data.length : 0;
		if (use.bytes - oldSize + json.length > MAX_TOTAL) return { status: 413, body: { error: 'Your account is out of storage space. Delete some old work.' } };
		if (!row) {
			if (use.n >= MAX_COUNT) return { status: 413, body: { error: 'Your account has too many saves. Delete some old work.' } };
			q.insert.run(req.user.id, t.tool, t.id, title, modified, json, json.length);
			return { status: 200, body: { rev: 1 } };
		}
		// Someone else (another computer) saved since this browser last synced: don't overwrite.
		// A deleted doc can always be brought back.
		if (row.data && row.rev !== baseRev) return { status: 409, body: { conflict: true, rev: row.rev } };
		q.update.run(title, modified, json, json.length, req.user.id, t.tool, t.id);
		return { status: 200, body: { rev: row.rev + 1 } };
	})();
	res.status(result.status).json(result.body);
});

router.delete('/:tool/:id', (req, res) => {
	const t = target(req, res);
	if (!t) return;
	const row = q.one.get(req.user.id, t.tool, t.id);
	if (!row) return res.json({ rev: 0 });
	const baseRev = Number(req.body?.baseRev) || 0;
	if (row.data && row.rev !== baseRev) return res.status(409).json({ conflict: true, rev: row.rev });
	if (row.data) q.tomb.run(req.user.id, t.tool, t.id);
	res.json({ rev: row.data ? row.rev + 1 : row.rev });
});

module.exports = router;
module.exports.TOOLS = TOOLS;
