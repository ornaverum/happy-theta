'use strict';
/* WishIMay — a family wish list, served at /wish/ with its API at /wish/api/.

   Two kinds of login, both separate from the Happy Theta school accounts:
   - owner: one shared account for the family. Inside it you switch "persona" (a person on the list)
     to add, edit and delete that person's items. Owners never see what's been bought.
   - shopper: an email + passphrase the owners hand out. Shoppers browse, sort and filter, open the
     shop page, and mark items bought. A bought item disappears for every shopper; the buyer still
     sees it under "My purchases" and can undo.
   The first owner login is made on the droplet with `node wish.js owner <email>` (no web sign-up). */
const crypto = require('crypto');
const express = require('express');
const { db } = require('./db');
const auth = require('./auth'); // reuses scrypt hashing only; sessions here are separate
const { preview } = require('./wish-preview');

const WISH_BASE = process.env.WISH_BASE_PATH || '/wish';
const COOKIE = 'wish_session';
const SESSION_DAYS = Number(process.env.WISH_SESSION_DAYS || 60);
const SECURE = process.env.COOKIE_SECURE !== '0';

db.exec(`
CREATE TABLE IF NOT EXISTS wish_accounts (
	id            INTEGER PRIMARY KEY,
	role          TEXT NOT NULL CHECK (role IN ('owner', 'shopper')),
	email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
	name          TEXT NOT NULL DEFAULT '',
	pass_hash     TEXT NOT NULL,
	created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS wish_sessions (
	token_hash TEXT PRIMARY KEY,
	account_id INTEGER NOT NULL REFERENCES wish_accounts(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wish_sessions_account ON wish_sessions(account_id);
-- The people whose wishes are on the list ("personas" of the shared owner account)
CREATE TABLE IF NOT EXISTS wish_people (
	id         INTEGER PRIMARY KEY,
	name       TEXT NOT NULL,
	color      TEXT NOT NULL DEFAULT '#2f6fd6',
	sort       INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS wish_items (
	id               INTEGER PRIMARY KEY,
	person_id        INTEGER NOT NULL REFERENCES wish_people(id) ON DELETE CASCADE,
	title            TEXT NOT NULL,
	url              TEXT NOT NULL DEFAULT '',
	image_url        TEXT NOT NULL DEFAULT '',
	description      TEXT NOT NULL DEFAULT '',
	price_cents      INTEGER,                    -- NULL = unknown
	currency         TEXT NOT NULL DEFAULT 'USD',
	priority         INTEGER NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)), -- 1 high, 2 medium, 3 low
	notes            TEXT NOT NULL DEFAULT '',   -- size, color, "any brand is fine"…
	site_name        TEXT NOT NULL DEFAULT '',
	price_checked_at TEXT,
	created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS wish_items_person ON wish_items(person_id);
-- One row per bought item. shopper_id becomes NULL if that shopper login is removed, so the item
-- stays bought (hidden) rather than reappearing.
CREATE TABLE IF NOT EXISTS wish_purchases (
	item_id      INTEGER PRIMARY KEY REFERENCES wish_items(id) ON DELETE CASCADE,
	shopper_id   INTEGER REFERENCES wish_accounts(id) ON DELETE SET NULL,
	purchased_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`);
// Added with price comparison: optional words to search other stores with (blank = the item's name).
if (!db.prepare('PRAGMA table_info(wish_items)').all().some((c) => c.name === 'search_query'))
	db.exec("ALTER TABLE wish_items ADD COLUMN search_query TEXT NOT NULL DEFAULT ''");
const compare = require('./wish-compare'); // other stores' prices, via SerpApi (off without SERPAPI_KEY)

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const ITEM_COLS = `i.id, i.person_id, i.title, i.url, i.image_url, i.description, i.price_cents, i.currency,
	i.priority, i.notes, i.site_name, i.search_query, i.price_checked_at, i.created_at, i.updated_at`;
const q = {
	accountByEmail: db.prepare('SELECT * FROM wish_accounts WHERE email = ?'),
	accountById: db.prepare('SELECT id, role, email, name FROM wish_accounts WHERE id = ?'),
	touchLogin: db.prepare(`UPDATE wish_accounts SET last_login_at = ${NOW} WHERE id = ?`),
	sessionInsert: db.prepare('INSERT INTO wish_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)'),
	sessionFind: db.prepare(
		`SELECT a.id, a.role, a.email, a.name FROM wish_sessions s JOIN wish_accounts a ON a.id = s.account_id
		 WHERE s.token_hash = ? AND s.expires_at > ?`
	),
	sessionRemove: db.prepare('DELETE FROM wish_sessions WHERE token_hash = ?'),
	sessionsForAccount: db.prepare('DELETE FROM wish_sessions WHERE account_id = ?'),
	sessionPurge: db.prepare('DELETE FROM wish_sessions WHERE expires_at <= ?'),

	people: db.prepare('SELECT id, name, color, sort FROM wish_people ORDER BY sort, name COLLATE NOCASE'),
	person: db.prepare('SELECT id, name, color, sort FROM wish_people WHERE id = ?'),
	personInsert: db.prepare('INSERT INTO wish_people (name, color, sort) VALUES (?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM wish_people)) RETURNING id, name, color, sort'),
	personUpdate: db.prepare('UPDATE wish_people SET name = ?, color = ? WHERE id = ? RETURNING id, name, color, sort'),
	personSort: db.prepare('UPDATE wish_people SET sort = ? WHERE id = ?'),
	personDelete: db.prepare('DELETE FROM wish_people WHERE id = ?'),

	ownerItems: db.prepare(`SELECT ${ITEM_COLS} FROM wish_items i ORDER BY i.created_at DESC, i.id DESC`),
	// Shoppers: everything nobody has bought, plus what this shopper bought (flagged).
	shopperItems: db.prepare(
		`SELECT ${ITEM_COLS}, p.purchased_at FROM wish_items i
		 LEFT JOIN wish_purchases p ON p.item_id = i.id
		 WHERE p.item_id IS NULL OR p.shopper_id = ?
		 ORDER BY i.created_at DESC, i.id DESC`
	),
	item: db.prepare(`SELECT ${ITEM_COLS} FROM wish_items i WHERE i.id = ?`),
	itemInsert: db.prepare(
		`INSERT INTO wish_items (person_id, title, url, image_url, description, price_cents, currency, priority, notes, site_name, search_query, price_checked_at)
		 VALUES (@person_id, @title, @url, @image_url, @description, @price_cents, @currency, @priority, @notes, @site_name, @search_query, @price_checked_at) RETURNING id`
	),
	itemUpdate: db.prepare(
		`UPDATE wish_items SET person_id = @person_id, title = @title, url = @url, image_url = @image_url, description = @description,
		 price_cents = @price_cents, currency = @currency, priority = @priority, notes = @notes, site_name = @site_name, search_query = @search_query,
		 price_checked_at = COALESCE(@price_checked_at, price_checked_at), updated_at = ${NOW} WHERE id = @id`
	),
	itemDelete: db.prepare('DELETE FROM wish_items WHERE id = ?'),

	purchase: db.prepare('SELECT item_id, shopper_id, purchased_at FROM wish_purchases WHERE item_id = ?'),
	purchaseInsert: db.prepare('INSERT INTO wish_purchases (item_id, shopper_id) VALUES (?, ?)'),
	purchaseDelete: db.prepare('DELETE FROM wish_purchases WHERE item_id = ? AND shopper_id = ?'),

	// No purchase counts here: owners must not be able to tell what's been bought.
	shoppers: db.prepare(
		`SELECT a.id, a.email, a.name, a.created_at, a.last_login_at
		 FROM wish_accounts a WHERE a.role = 'shopper' ORDER BY a.name COLLATE NOCASE, a.email`
	),
	accountInsert: db.prepare('INSERT INTO wish_accounts (role, email, name, pass_hash) VALUES (?, ?, ?, ?) RETURNING id, role, email, name, created_at'),
	accountUpdateName: db.prepare('UPDATE wish_accounts SET name = ? WHERE id = ?'),
	accountUpdatePass: db.prepare('UPDATE wish_accounts SET pass_hash = ? WHERE id = ?'),
	accountDelete: db.prepare("DELETE FROM wish_accounts WHERE id = ? AND role = 'shopper'")
};

/* ---------- sessions (own cookie, scoped to /wish) ---------- */
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
function cookieHeader(value, maxAgeSec) {
	const parts = [`${COOKIE}=${value}`, `Path=${WISH_BASE}`, 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
	if (SECURE) parts.push('Secure');
	return parts.join('; ');
}
function readToken(req) {
	for (const part of String(req.headers.cookie || '').split(';')) {
		const i = part.indexOf('=');
		if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
	}
	return null;
}
function startSession(res, accountId) {
	const token = crypto.randomBytes(32).toString('base64url');
	const maxAge = SESSION_DAYS * 86400;
	q.sessionInsert.run(sha256(token), accountId, Date.now() + maxAge * 1000);
	res.setHeader('Set-Cookie', cookieHeader(token, maxAge));
}
function purgeExpired() {
	q.sessionPurge.run(Date.now());
}

/* ---------- validation ---------- */
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const httpUrl = (v) => {
	const s = str(v, 2000);
	if (!s) return '';
	try {
		const u = new URL(s);
		return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
	} catch {
		return null;
	}
};
function passphraseProblem(p) {
	if (p.length < 6) return 'A passphrase needs at least 6 characters.';
	if (p.length > 200) return 'That passphrase is too long.';
	return null;
}

function cleanItem(body) {
	const person_id = Number(body?.personId);
	if (!Number.isInteger(person_id) || !q.person.get(person_id)) return { error: 'Choose whose wish this is.' };
	const title = str(body.title, 300);
	if (!title) return { error: 'An item needs a name.' };
	const url = httpUrl(body.url);
	if (url === null) return { error: 'The shop link must start with http:// or https://.' };
	const image_url = httpUrl(body.imageUrl);
	if (image_url === null) return { error: 'The picture link must start with http:// or https://.' };
	let price_cents = null;
	if (body.price !== null && body.price !== undefined && body.price !== '') {
		const n = Number(String(body.price).replace(/[^0-9.]/g, ''));
		if (!isFinite(n) || n < 0 || n > 1e7) return { error: 'Enter the price as a number, like 24.99.' };
		price_cents = Math.round(n * 100);
	}
	const currency = /^[A-Z]{3}$/.test(body.currency) ? body.currency : 'USD';
	const priority = [1, 2, 3].includes(Number(body.priority)) ? Number(body.priority) : 2;
	return {
		item: {
			person_id,
			title,
			url,
			image_url,
			description: str(body.description, 2000),
			price_cents,
			currency,
			priority,
			notes: str(body.notes, 1000),
			site_name: str(body.siteName, 100),
			search_query: str(body.searchQuery, 150),
			price_checked_at: body.priceChecked ? new Date().toISOString() : null
		}
	};
}

const itemOut = (r, withPurchase) => {
	const o = {
		id: r.id,
		personId: r.person_id,
		title: r.title,
		url: r.url,
		imageUrl: r.image_url,
		description: r.description,
		price: r.price_cents === null ? null : r.price_cents / 100,
		currency: r.currency,
		priority: r.priority,
		notes: r.notes,
		siteName: r.site_name,
		searchQuery: r.search_query,
		priceCheckedAt: r.price_checked_at,
		createdAt: r.created_at,
		updatedAt: r.updated_at
	};
	if (withPurchase) o.purchasedAt = r.purchased_at || null; // only ever the viewer's own purchase
	return o;
};
const accountOut = (a) => ({ role: a.role, email: a.email, name: a.name });

/* ---------- rate limits (in memory) ---------- */
function limiter(max, windowMs) {
	const hits = new Map();
	setInterval(() => {
		const now = Date.now();
		for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
	}, windowMs).unref();
	const hit = (key) => {
		const now = Date.now();
		let h = hits.get(key);
		if (!h || h.reset <= now) hits.set(key, (h = { n: 0, reset: now + windowMs }));
		return ++h.n <= max;
	};
	// true once `key` has used up its allowance (without counting this as another hit)
	hit.over = (key) => {
		const h = hits.get(key);
		return !!h && h.reset > Date.now() && h.n >= max;
	};
	return hit;
}
const ipLimit = limiter(200, 15 * 60 * 1000);
const failLimit = limiter(10, 15 * 60 * 1000); // failed logins per email
const previewLimit = limiter(60, 15 * 60 * 1000); // page fetches per owner session
const offersLimit = limiter(20, 60 * 60 * 1000); // other-store checks per login per hour (each = 2 SerpApi searches)
const TOO_MANY = { error: 'Too many attempts. Try again in a few minutes.' };

/* ---------- routes ---------- */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const router = express.Router();

router.use((req, res, next) => {
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
	const token = readToken(req);
	req.wish = token ? q.sessionFind.get(sha256(token), Date.now()) || null : null;
	next();
});
router.use(express.json({ limit: '64kb' }));

const signedIn = (req, res, next) => (req.wish ? next() : res.status(401).json({ error: 'Please sign in.' }));
const ownerOnly = (req, res, next) => {
	if (!req.wish) return res.status(401).json({ error: 'Please sign in.' });
	if (req.wish.role !== 'owner') return res.status(403).json({ error: 'Only the list owners can do that.' });
	next();
};
const shopperOnly = (req, res, next) => {
	if (!req.wish) return res.status(401).json({ error: 'Please sign in.' });
	if (req.wish.role !== 'shopper') return res.status(403).json({ error: 'Only shoppers can mark items bought.' });
	next();
};
const idParam = (req) => {
	const n = Number(req.params.id);
	return Number.isInteger(n) && n > 0 ? n : null;
};

router.post('/login', (req, res) => {
	if (!ipLimit(req.ip)) return res.status(429).json(TOO_MANY);
	const email = str(req.body?.email, 254).toLowerCase();
	const pass = String(req.body?.passphrase || '');
	// After 10 wrong passphrases for an email, even the right one waits out the 15 minutes.
	if (failLimit.over(email)) return res.status(429).json(TOO_MANY);
	const acct = q.accountByEmail.get(email);
	const ok = auth.verifyPassword(pass, acct ? acct.pass_hash : auth.DUMMY_HASH) && !!acct;
	if (!ok) {
		if (!failLimit(email)) return res.status(429).json(TOO_MANY);
		return res.status(401).json({ error: 'That email and passphrase don’t match. Check with whoever set up your login.' });
	}
	q.touchLogin.run(acct.id);
	startSession(res, acct.id);
	res.json({ account: accountOut(acct) });
});

router.post('/logout', (req, res) => {
	const token = readToken(req);
	if (token) q.sessionRemove.run(sha256(token));
	res.setHeader('Set-Cookie', cookieHeader('', 0));
	res.json({ ok: true });
});

// Never 401s, so the page can ask "who am I?" quietly.
router.get('/me', (req, res) => res.json({ account: req.wish ? accountOut(req.wish) : null }));

/* Everything a page needs in one call: people + items (shaped for the viewer's role). */
router.get('/list', signedIn, (req, res) => {
	const people = q.people.all();
	const items =
		req.wish.role === 'owner'
			? q.ownerItems.all().map((r) => itemOut(r, false))
			: q.shopperItems.all(req.wish.id).map((r) => itemOut(r, true));
	const offers = compare.enabled() ? compare.allOffers() : new Map();
	for (const it of items) {
		const o = offers.get(it.id);
		it.offers = o ? o.offers : [];
		it.offersCheckedAt = o ? o.checkedAt : null;
	}
	res.json({ people, items, compare: compare.enabled() });
});

/* ----- people (personas) ----- */
router.post('/people', ownerOnly, (req, res) => {
	const name = str(req.body?.name, 60);
	if (!name) return res.status(400).json({ error: 'Give the person a name.' });
	const color = COLOR_RE.test(req.body?.color) ? req.body.color : '#2f6fd6';
	res.status(201).json({ person: q.personInsert.get(name, color) });
});
router.put('/people/:id', ownerOnly, (req, res) => {
	const id = idParam(req);
	const cur = id && q.person.get(id);
	if (!cur) return res.status(404).json({ error: 'That person isn’t on the list.' });
	const name = str(req.body?.name, 60) || cur.name;
	const color = COLOR_RE.test(req.body?.color) ? req.body.color : cur.color;
	res.json({ person: q.personUpdate.get(name, color, id) });
});
router.post('/people/order', ownerOnly, (req, res) => {
	const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
	db.transaction(() => ids.forEach((id, i) => q.personSort.run(i + 1, id)))();
	res.json({ people: q.people.all() });
});
router.delete('/people/:id', ownerOnly, (req, res) => {
	const id = idParam(req);
	if (!id || !q.person.get(id)) return res.status(404).json({ error: 'That person isn’t on the list.' });
	q.personDelete.run(id); // their items go too
	res.json({ ok: true });
});

/* ----- items ----- */
router.post('/items', ownerOnly, (req, res) => {
	const c = cleanItem(req.body);
	if (c.error) return res.status(400).json({ error: c.error });
	const { id } = q.itemInsert.get(c.item);
	checkInBackground(id);
	res.status(201).json({ item: itemOut(q.item.get(id), false) });
});
router.put('/items/:id', ownerOnly, (req, res) => {
	const id = idParam(req);
	const before = id && q.item.get(id);
	if (!before) return res.status(404).json({ error: 'That item is gone.' });
	const c = cleanItem(req.body);
	if (c.error) return res.status(400).json({ error: c.error });
	q.itemUpdate.run({ ...c.item, id });
	// New name or search words → the saved prices are for something else; look again.
	if (compare.searchQuery(before) !== compare.searchQuery(c.item)) checkInBackground(id, true);
	res.json({ item: itemOut(q.item.get(id), false) });
});
router.delete('/items/:id', ownerOnly, (req, res) => {
	const id = idParam(req);
	if (!id || !q.item.get(id)) return res.status(404).json({ error: 'That item is gone.' });
	q.itemDelete.run(id);
	res.json({ ok: true });
});

/* ----- purchases (shoppers) ----- */
const markBought = db.transaction((itemId, shopperId) => {
	const existing = q.purchase.get(itemId);
	if (existing) return existing.shopper_id === shopperId ? 'mine' : 'taken';
	q.purchaseInsert.run(itemId, shopperId);
	return 'ok';
});
router.post('/items/:id/purchase', shopperOnly, (req, res) => {
	const id = idParam(req);
	if (!id || !q.item.get(id)) return res.status(404).json({ error: 'That item was removed from the list.' });
	const r = markBought(id, req.wish.id);
	if (r === 'taken') return res.status(409).json({ error: 'Someone else already marked this as bought.', taken: true });
	res.json({ ok: true, purchase: q.purchase.get(id) });
});
router.delete('/items/:id/purchase', shopperOnly, (req, res) => {
	const id = idParam(req);
	const info = id ? q.purchaseDelete.run(id, req.wish.id) : { changes: 0 };
	if (!info.changes) return res.status(404).json({ error: 'You haven’t marked that item as bought.' });
	res.json({ ok: true });
});

/* ----- reading a product page (owners) ----- */
router.post(
	'/preview',
	ownerOnly,
	wrap(async (req, res) => {
		if (!previewLimit(req.wish.id)) return res.status(429).json({ error: 'That’s a lot of pages in a short time. Try again in a few minutes.' });
		const url = str(req.body?.url, 2000);
		if (!url) return res.status(400).json({ error: 'Paste a link first.' });
		const r = await preview(url);
		res.status(r.ok ? 200 : 422).json(r);
	})
);

/* ----- the same item at other stores (Google Shopping + eBay through SerpApi) ----- */
const OWNER_FRESH_MS = 15 * 60 * 1000; // owners may re-check after 15 minutes
const SHOPPER_FRESH_MS = 24 * 60 * 60 * 1000; // shoppers get the saved prices if they're under a day old
function checkInBackground(id, clearFirst) {
	if (!compare.enabled()) return;
	if (clearFirst) compare.clear(id);
	compare.checkItem(q.item.get(id)).catch((err) => console.warn('WishIMay price check:', err.message));
}
router.post(
	'/items/:id/offers',
	signedIn,
	wrap(async (req, res) => {
		if (!compare.enabled()) return res.status(404).json({ error: 'Price comparison isn’t set up on this site.' });
		const id = idParam(req);
		const item = id && q.item.get(id);
		// Shoppers can only look up items they can see (not ones someone else bought).
		const p = item && q.purchase.get(id);
		if (!item || (req.wish.role === 'shopper' && p && p.shopper_id !== req.wish.id))
			return res.status(404).json({ error: 'That item isn’t on the list any more.' });
		const saved = compare.offersFor(id);
		const age = saved.checkedAt ? Date.now() - Date.parse(saved.checkedAt) : Infinity;
		if (age < (req.wish.role === 'owner' ? OWNER_FRESH_MS : SHOPPER_FRESH_MS) && !saved.error) return res.json({ ...saved, cached: true });
		if (!offersLimit(req.wish.id)) return res.status(429).json({ error: 'That’s a lot of price checks. Try again in a while.' });
		try {
			res.json(await compare.checkItem(item));
		} catch (err) {
			res.status(err.status || 502).json({ error: err.message, ...compare.offersFor(id) });
		}
	})
);
router.get('/compare-status', ownerOnly, (req, res) => res.json(compare.status()));

/* ----- shopper logins (owners manage them) ----- */
router.get('/shoppers', ownerOnly, (req, res) => res.json({ shoppers: q.shoppers.all() }));
router.post('/shoppers', ownerOnly, (req, res) => {
	const email = str(req.body?.email, 254).toLowerCase();
	const name = str(req.body?.name, 80);
	const pass = String(req.body?.passphrase || '');
	if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter the shopper’s email address.' });
	const pErr = passphraseProblem(pass);
	if (pErr) return res.status(400).json({ error: pErr });
	if (q.accountByEmail.get(email)) return res.status(409).json({ error: 'There’s already a login with that email.' });
	q.accountInsert.get('shopper', email, name, auth.hashPassword(pass));
	res.status(201).json({ shoppers: q.shoppers.all() });
});
router.put('/shoppers/:id', ownerOnly, (req, res) => {
	const id = idParam(req);
	const acct = id && q.accountById.get(id);
	if (!acct || acct.role !== 'shopper') return res.status(404).json({ error: 'That shopper login doesn’t exist.' });
	if (typeof req.body?.name === 'string') q.accountUpdateName.run(str(req.body.name, 80), id);
	if (req.body?.passphrase !== undefined) {
		const pass = String(req.body.passphrase);
		const pErr = passphraseProblem(pass);
		if (pErr) return res.status(400).json({ error: pErr });
		q.accountUpdatePass.run(auth.hashPassword(pass), id);
		q.sessionsForAccount.run(id); // signs them out everywhere; they use the new passphrase
	}
	res.json({ shoppers: q.shoppers.all() });
});
router.delete('/shoppers/:id', ownerOnly, (req, res) => {
	const id = idParam(req);
	const info = id ? q.accountDelete.run(id) : { changes: 0 };
	if (!info.changes) return res.status(404).json({ error: 'That shopper login doesn’t exist.' });
	res.json({ shoppers: q.shoppers.all() });
});

/* ----- the owner account's own passphrase ----- */
router.post('/passphrase', signedIn, (req, res) => {
	const acct = q.accountByEmail.get(req.wish.email);
	if (!auth.verifyPassword(String(req.body?.current || ''), acct.pass_hash)) return res.status(400).json({ error: 'Your current passphrase isn’t right.' });
	const next = String(req.body?.next || '');
	const pErr = passphraseProblem(next);
	if (pErr) return res.status(400).json({ error: pErr });
	q.accountUpdatePass.run(auth.hashPassword(next), acct.id);
	q.sessionsForAccount.run(acct.id);
	startSession(res, acct.id);
	res.json({ ok: true });
});

router.use((req, res) => res.status(404).json({ error: 'Not found.' }));
router.use((err, req, res, _next) => {
	if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON.' });
	if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
	console.error(err);
	res.status(500).json({ error: 'Server error.' });
});

purgeExpired();
setInterval(purgeExpired, 60 * 60 * 1000).unref();

module.exports = router;
module.exports.WISH_BASE = WISH_BASE;
module.exports.queries = q; // for wish.js (the command-line tool)
