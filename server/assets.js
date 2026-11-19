'use strict';
/* Pictures used by Theta Questions banks and Quiz Builder quizzes (teacher accounts).

   A bank or quiz save no longer carries its pictures: each image is stored once, under an id made from
   its content ("i" + 28 base-36 digits, see picId — shared/gate.js computes the same id), and the save
   keeps {name, mime, alt, ref: id}. The browser keeps the pictures in IndexedDB; this copy lets another
   computer fetch them. The id is checked against the data, so a picture can't be stored under the wrong id.

   GET  /assets                 → {ids: [...], bytes, quota}   which pictures this account has
   POST /assets/fetch {ids}     → {assets: [{id, mime, data}]} (stops at about 8 MB; ask again for the rest)
   POST /assets/put {assets: [{id, mime, data}]} → {stored: [ids], errors: [{id, error}]}
   GET  /assets/:id             → {id, mime, data}

   Pictures nothing refers to any more (no qbank/qquiz save of this account uses them) are deleted
   once they are a day old; that check runs at most once a day per account, on GET /assets. */
const express = require('express');
const { db } = require('./db');
const auth = require('./auth');

db.exec(`
CREATE TABLE IF NOT EXISTS user_assets (
	user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	id         TEXT NOT NULL,
	mime       TEXT NOT NULL,
	data       TEXT NOT NULL,                  -- data: URL
	size       INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY (user_id, id)
);
`);

const MAX_ONE = Number(process.env.ASSET_MAX_BYTES || 3 * 1024 * 1024); // one picture (as a data: URL)
const QUOTA = Number(process.env.ASSET_QUOTA_BYTES || 200 * 1024 * 1024); // all of one account's pictures
const FETCH_BYTES = 8 * 1024 * 1024;
const ID_RE = /^i[0-9a-z]{28}$/;
const DATA_RE = /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const TOOLS = ['qbank', 'qquiz'];

/* cyrb128 over the data: URL → "i" + 4 × 7 base-36 digits. Must match picId in shared/gate.js. */
function picId(s) {
	let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
	for (let i = 0; i < s.length; i++) {
		const k = s.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	h1 ^= h2 ^ h3 ^ h4;
	h2 ^= h1;
	h3 ^= h1;
	h4 ^= h1;
	return 'i' + [h1, h2, h3, h4].map((x) => (x >>> 0).toString(36).padStart(7, '0')).join('');
}

/* Every picture id a save refers to: any {ref} under an "image" key. */
function refsIn(data, out = new Set(), depth = 0) {
	if (!data || typeof data !== 'object' || depth > 8) return out;
	if (Array.isArray(data)) {
		for (const x of data) refsIn(x, out, depth + 1);
		return out;
	}
	for (const [k, v] of Object.entries(data)) {
		if (k === 'image' && v && typeof v === 'object' && typeof v.ref === 'string') out.add(v.ref);
		else if (v && typeof v === 'object') refsIn(v, out, depth + 1);
	}
	return out;
}

const q = {
	ids: db.prepare('SELECT id FROM user_assets WHERE user_id = ?'),
	one: db.prepare('SELECT id, mime, data FROM user_assets WHERE user_id = ? AND id = ?'),
	has: db.prepare('SELECT 1 FROM user_assets WHERE user_id = ? AND id = ?'),
	usage: db.prepare('SELECT COALESCE(SUM(size), 0) AS bytes FROM user_assets WHERE user_id = ?'),
	insert: db.prepare('INSERT OR IGNORE INTO user_assets (user_id, id, mime, data, size) VALUES (?, ?, ?, ?, ?)'),
	docs: db.prepare(`SELECT data FROM user_docs WHERE user_id = ? AND tool IN ('qbank', 'qquiz') AND data IS NOT NULL`),
	old: db.prepare(`SELECT id FROM user_assets WHERE user_id = ? AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`),
	del: db.prepare('DELETE FROM user_assets WHERE user_id = ? AND id = ?')
};

/* Delete this account's pictures that no save uses (and that are over a day old). */
function prune(userId) {
	const used = new Set();
	for (const r of q.docs.all(userId)) {
		try {
			refsIn(JSON.parse(r.data).data, used);
		} catch {}
	}
	let n = 0;
	db.transaction(() => {
		for (const { id } of q.old.all(userId)) if (!used.has(id)) n += q.del.run(userId, id).changes;
	})();
	return n;
}
const lastPrune = new Map(); // user id → time

/* For server-side exports (teacher.js export): put the pictures back inside a qbank/qquiz save. */
function inline(userId, doc) {
	if (!doc || !TOOLS.includes(doc.tool) || !doc.data) return doc;
	const walk = (o, depth = 0) => {
		if (!o || typeof o !== 'object' || depth > 8) return;
		if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
		for (const [k, v] of Object.entries(o)) {
			if (k === 'image' && v && typeof v === 'object' && typeof v.ref === 'string' && !v.data) {
				const row = q.one.get(userId, v.ref);
				if (row) o[k] = { name: v.name, mime: v.mime || row.mime, alt: v.alt, data: row.data };
			} else if (v && typeof v === 'object') walk(v, depth + 1);
		}
	};
	walk(doc.data);
	return doc;
}

const router = express.Router();
router.use(auth.requireTeacher);
router.use(express.json({ limit: 12 * 1024 * 1024 }));

router.get('/', (req, res) => {
	const uid = req.user.id;
	const now = Date.now();
	if (!lastPrune.has(uid) || now - lastPrune.get(uid) > 24 * 3600 * 1000) {
		lastPrune.set(uid, now);
		try {
			prune(uid);
		} catch (err) {
			console.warn('asset prune', err);
		}
	}
	res.json({ ids: q.ids.all(uid).map((r) => r.id), bytes: q.usage.get(uid).bytes, quota: QUOTA });
});

router.post('/fetch', (req, res) => {
	const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string' && ID_RE.test(x)).slice(0, 500) : [];
	const out = [];
	let bytes = 0;
	for (const id of ids) {
		const row = q.one.get(req.user.id, id);
		if (!row) continue;
		if (out.length && bytes + row.data.length > FETCH_BYTES) break;
		out.push(row);
		bytes += row.data.length;
	}
	res.json({ assets: out });
});

router.post('/put', (req, res) => {
	const list = Array.isArray(req.body?.assets) ? req.body.assets.slice(0, 500) : [];
	const stored = [];
	const errors = [];
	const uid = req.user.id;
	let used = q.usage.get(uid).bytes;
	for (const a of list) {
		const id = a && typeof a.id === 'string' ? a.id : '';
		const data = a && typeof a.data === 'string' ? a.data : '';
		if (!ID_RE.test(id)) {
			errors.push({ id, error: 'Bad id.' });
			continue;
		}
		if (q.has.get(uid, id)) {
			stored.push(id);
			continue;
		}
		if (!DATA_RE.test(data)) errors.push({ id, error: 'That isn’t a supported picture.' });
		else if (data.length > MAX_ONE) errors.push({ id, error: 'That picture is too big.' });
		else if (picId(data) !== id) errors.push({ id, error: 'The id doesn’t match the picture.' });
		else if (used + data.length > QUOTA) errors.push({ id, error: 'Your account is out of space for pictures.' });
		else {
			const mime = data.slice(5, data.indexOf(';'));
			q.insert.run(uid, id, mime, data, data.length);
			used += data.length;
			stored.push(id);
		}
	}
	res.json({ stored, errors });
});

router.get('/:id', (req, res) => {
	if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: 'Bad id.' });
	const row = q.one.get(req.user.id, req.params.id);
	if (!row) return res.status(404).json({ error: 'Not found.' });
	res.json(row);
});

module.exports = router;
module.exports.picId = picId;
module.exports.refsIn = refsIn;
module.exports.inline = inline;
module.exports.prune = prune;
