'use strict';
/* WishIMay: find the same item at other stores, through SerpApi (https://serpapi.com).
   One SerpApi key covers both searches:
   - engine=google_shopping: offers from many stores (Target, Walmart, Amazon, the maker's own shop…)
   - engine=ebay: eBay listings (no eBay developer key needed)
   Each check uses 2 SerpApi searches. Results are saved per item, re-checked at most every few hours,
   and a monthly budget keeps the account inside its plan. The key never leaves the server.

   Settings (environment, e.g. /etc/happytheta/api.env):
     SERPAPI_KEY             required to turn the feature on
     SERPAPI_MONTHLY_LIMIT   searches per calendar month this site may use (default 240; free plan is 250)
     SERPAPI_GL              country for Google Shopping (default "us")
     SERPAPI_LOCATION        optional city for local prices, e.g. "Hot Springs,Arkansas,United States"
     SERPAPI_BASE_URL        only for tests (a fake SerpApi) */
const { db } = require('./db');
const { parsePrice } = require('./wish-preview');

const BASE = process.env.SERPAPI_BASE_URL || 'https://serpapi.com/search.json';
const TIMEOUT_MS = 20000;
const MAX_GOOGLE = 6;
const MAX_EBAY = 4;

db.exec(`
CREATE TABLE IF NOT EXISTS wish_offers (
	id          INTEGER PRIMARY KEY,
	item_id     INTEGER NOT NULL REFERENCES wish_items(id) ON DELETE CASCADE,
	source      TEXT NOT NULL CHECK (source IN ('google', 'ebay')),
	store       TEXT NOT NULL,
	title       TEXT NOT NULL,
	price_cents INTEGER NOT NULL,
	currency    TEXT NOT NULL DEFAULT 'USD',
	condition   TEXT NOT NULL DEFAULT '',  -- eBay: "Brand New", "Pre-Owned"…; Google: "Used" when marked
	shipping    TEXT NOT NULL DEFAULT '',
	link        TEXT NOT NULL,
	thumbnail   TEXT NOT NULL DEFAULT '',
	position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS wish_offers_item ON wish_offers(item_id);
CREATE TABLE IF NOT EXISTS wish_offer_checks (
	item_id    INTEGER PRIMARY KEY REFERENCES wish_items(id) ON DELETE CASCADE,
	checked_at TEXT NOT NULL,
	query      TEXT NOT NULL DEFAULT '',
	error      TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS wish_api_usage (
	month    TEXT PRIMARY KEY,  -- "2026-11"
	searches INTEGER NOT NULL DEFAULT 0
);
`);

const q = {
	offersAll: db.prepare('SELECT * FROM wish_offers ORDER BY item_id, position'),
	offersFor: db.prepare('SELECT * FROM wish_offers WHERE item_id = ? ORDER BY position'),
	checksAll: db.prepare('SELECT item_id, checked_at, error FROM wish_offer_checks'),
	check: db.prepare('SELECT item_id, checked_at, query, error FROM wish_offer_checks WHERE item_id = ?'),
	clearOffers: db.prepare('DELETE FROM wish_offers WHERE item_id = ?'),
	addOffer: db.prepare(
		`INSERT INTO wish_offers (item_id, source, store, title, price_cents, currency, condition, shipping, link, thumbnail, position)
		 VALUES (@item_id, @source, @store, @title, @price_cents, @currency, @condition, @shipping, @link, @thumbnail, @position)`
	),
	setCheck: db.prepare(
		`INSERT INTO wish_offer_checks (item_id, checked_at, query, error) VALUES (?, ?, ?, ?)
		 ON CONFLICT(item_id) DO UPDATE SET checked_at = excluded.checked_at, query = excluded.query, error = excluded.error`
	),
	usage: db.prepare('SELECT searches FROM wish_api_usage WHERE month = ?'),
	addUsage: db.prepare('INSERT INTO wish_api_usage (month, searches) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET searches = searches + excluded.searches')
};

const enabled = () => !!process.env.SERPAPI_KEY;
const monthlyLimit = () => Number(process.env.SERPAPI_MONTHLY_LIMIT) || 240;
const thisMonth = () => new Date().toISOString().slice(0, 7);
const usedThisMonth = () => (q.usage.get(thisMonth()) || { searches: 0 }).searches;

/* ---------- matching: is a result really the same item? ---------- */
const STOP = new Set('a an and the for with of in on to by from at or new pack set item items x'.split(' '));
function words(s) {
	return String(s || '')
		.toLowerCase()
		.replace(/[’']/g, '')
		.replace(/(\d)\s+(gb|tb|mb|oz|lbs?|in|ft|mm|cm|ml|qt|pk|pack|pcs?|w|v|mah)\b/g, '$1$2') // "16 GB" = "16GB"
		.split(/[^a-z0-9.]+/)
		.map((w) => w.replace(/^\.+|\.+$/g, ''))
		.filter((w) => w.length > 1 && !STOP.has(w));
}

/* A shop-page title is often long ("Kindle Paperwhite (16 GB) – Black, Ad-Supported | Amazon").
   Keep the part before the first separator, without brackets, at most 8 words. */
function searchQuery(item) {
	if (item.search_query && item.search_query.trim()) return item.search_query.trim().slice(0, 150);
	let t = String(item.title || '');
	t = t.split(/\s[|–—-]\s|,\s|:\s/)[0];
	t = t.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
	return t.split(/\s+/).filter(Boolean).slice(0, 8).join(' ').slice(0, 150);
}

/* Share of the query's words that appear in the result title (1 = every word). */
function matchScore(query, title) {
	const qw = [...new Set(words(query))].slice(0, 8);
	if (!qw.length) return 0;
	const tw = new Set(words(title));
	return qw.filter((w) => tw.has(w)).length / qw.length;
}

const httpsLink = (u) => {
	try {
		const url = new URL(String(u || ''));
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString().slice(0, 2000) : '';
	} catch {
		return '';
	}
};
const str = (v, n) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n) : '');

/* ---------- turning SerpApi answers into offers ---------- */
function googleOffers(data, query, fallbackCurrency) {
	const rows = [...(data.inline_shopping_results || []), ...(data.shopping_results || [])];
	const out = [];
	for (const r of rows) {
		const price = typeof r.extracted_price === 'number' ? r.extracted_price : parsePrice(r.price)?.amount;
		const link = httpsLink(r.link || r.product_link);
		if (!(price > 0) || !link || !r.title) continue;
		out.push({
			source: 'google',
			store: str(r.source, 80) || 'Store',
			title: str(r.title, 300),
			price,
			currency: parsePrice(r.price)?.currency || fallbackCurrency,
			condition: r.second_hand_condition ? str(r.second_hand_condition, 40) || 'Used' : '',
			shipping: str(r.delivery, 80),
			link,
			thumbnail: httpsLink(r.thumbnail),
			score: matchScore(query, r.title)
		});
	}
	return out;
}

function ebayOffers(data, query, fallbackCurrency) {
	const out = [];
	for (const r of data.organic_results || []) {
		const p = r.price || {};
		const price = typeof p.extracted === 'number' ? p.extracted : typeof p.from?.extracted === 'number' ? p.from.extracted : parsePrice(p.raw || p.from?.raw)?.amount;
		const link = httpsLink(r.link);
		if (!(price > 0) || !link || !r.title) continue;
		if (r.buying_format && /auction/i.test(String(r.buying_format)) && !/buy it now/i.test(String(r.buying_format_text || ''))) continue; // auction prices aren't real prices yet
		out.push({
			source: 'ebay',
			store: 'eBay',
			title: str(r.title, 300),
			price,
			currency: parsePrice(p.raw || p.from?.raw)?.currency || fallbackCurrency,
			condition: str(r.condition, 40),
			shipping: str(r.shipping, 80),
			link,
			thumbnail: httpsLink(r.thumbnail),
			score: matchScore(query, r.title)
		});
	}
	return out;
}

/* Keep good matches, drop accessories (far cheaper than the item), one offer per store, cheapest first. */
function pickOffers(offers, query, itemPrice, max) {
	const qLen = new Set(words(query)).size;
	const need = qLen <= 2 ? 1 : qLen <= 4 ? 0.75 : 0.6;
	let good = offers.filter((o) => o.score >= need);
	if (itemPrice > 0) good = good.filter((o) => o.price >= itemPrice * 0.35 && o.price <= itemPrice * 4);
	good.sort((a, b) => a.price - b.price || b.score - a.score);
	const seen = new Set();
	const out = [];
	for (const o of good) {
		const key = o.source === 'ebay' ? o.link : o.store.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(o);
		if (out.length >= max) break;
	}
	return out;
}

async function serpapi(params) {
	const url = new URL(BASE);
	for (const [k, v] of Object.entries({ ...params, api_key: process.env.SERPAPI_KEY })) if (v !== undefined && v !== '') url.searchParams.set(k, v);
	let res;
	try {
		res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
	} catch (err) {
		throw new Error(err.name === 'TimeoutError' ? 'The price search took too long.' : 'Couldn’t reach the price-search service.');
	}
	let data = {};
	try {
		data = await res.json();
	} catch {}
	if (!res.ok || data.error) {
		const msg = String(data.error || `HTTP ${res.status}`);
		// "hasn't returned any results" is a normal empty answer, not a failure
		if (/hasn['’]t returned any results/i.test(msg)) {
			q.addUsage.run(thisMonth(), 1); // count it anyway, to stay safely inside the plan
			return { empty: true };
		}
		if (res.status === 401 || /invalid api key/i.test(msg)) throw new Error('The SerpApi key isn’t valid. Check SERPAPI_KEY in the server settings.');
		if (res.status === 429 || /run out of searches|plan/i.test(msg)) throw new Error('The SerpApi account is out of searches for this month.');
		throw new Error('The price-search service had a problem. Try again later.');
	}
	q.addUsage.run(thisMonth(), 1); // SerpApi only counts successful searches
	return data;
}

const inFlight = new Map(); // item id → promise, so two clicks don't spend 4 searches

/* Search both engines for one item and save the results. item = wish_items row (snake_case). */
function checkItem(item) {
	if (inFlight.has(item.id)) return inFlight.get(item.id);
	const job = (async () => {
		const query = searchQuery(item);
		if (!query) throw new Error('Give the item a name first.');
		if (usedThisMonth() + 2 > monthlyLimit())
			throw Object.assign(new Error('This month’s price searches are used up. They start again on the 1st.'), { status: 429 });
		const currency = item.currency || 'USD';
		const itemPrice = item.price_cents ? item.price_cents / 100 : 0;
		const gl = process.env.SERPAPI_GL || 'us';
		const [g, e] = await Promise.allSettled([
			serpapi({ engine: 'google_shopping', q: query, gl, hl: 'en', location: process.env.SERPAPI_LOCATION }),
			serpapi({ engine: 'ebay', _nkw: query, ebay_domain: 'ebay.com', buying_format: 'BIN' })
		]);
		if (g.status === 'rejected' && e.status === 'rejected') {
			q.setCheck.run(item.id, new Date().toISOString(), query, g.reason.message);
			throw g.reason;
		}
		const offers = [
			...pickOffers(g.status === 'fulfilled' && !g.value.empty ? googleOffers(g.value, query, currency) : [], query, itemPrice, MAX_GOOGLE),
			...pickOffers(e.status === 'fulfilled' && !e.value.empty ? ebayOffers(e.value, query, currency) : [], query, itemPrice, MAX_EBAY)
		].sort((a, b) => a.price - b.price);
		const partialError = g.status === 'rejected' ? 'Google Shopping: ' + g.reason.message : e.status === 'rejected' ? 'eBay: ' + e.reason.message : '';
		db.transaction(() => {
			q.clearOffers.run(item.id);
			offers.forEach((o, i) =>
				q.addOffer.run({
					item_id: item.id,
					source: o.source,
					store: o.store,
					title: o.title,
					price_cents: Math.round(o.price * 100),
					currency: o.currency || currency,
					condition: o.condition,
					shipping: o.shipping,
					link: o.link,
					thumbnail: o.thumbnail,
					position: i
				})
			);
			q.setCheck.run(item.id, new Date().toISOString(), query, partialError);
		})();
		return offersFor(item.id);
	})();
	inFlight.set(item.id, job);
	job.finally(() => inFlight.delete(item.id)).catch(() => {});
	return job;
}

const offerOut = (o) => ({
	source: o.source,
	store: o.store,
	title: o.title,
	price: o.price_cents / 100,
	currency: o.currency,
	condition: o.condition,
	shipping: o.shipping,
	link: o.link
});

function offersFor(itemId) {
	const c = q.check.get(itemId);
	return { offers: q.offersFor.all(itemId).map(offerOut), checkedAt: c ? c.checked_at : null, error: c ? c.error : '' };
}

/* Every item's saved offers, for the list endpoint: Map(itemId → {offers, checkedAt}) */
function allOffers() {
	const map = new Map();
	for (const c of q.checksAll.all()) map.set(c.item_id, { offers: [], checkedAt: c.checked_at });
	for (const o of q.offersAll.all()) {
		if (!map.has(o.item_id)) map.set(o.item_id, { offers: [], checkedAt: null });
		map.get(o.item_id).offers.push(offerOut(o));
	}
	return map;
}

/* Forget an item's saved offers (its name changed, so they're for something else). */
const clear = (itemId) => db.transaction(() => {
	q.clearOffers.run(itemId);
	db.prepare('DELETE FROM wish_offer_checks WHERE item_id = ?').run(itemId);
})();

const status = () => ({ enabled: enabled(), used: usedThisMonth(), limit: monthlyLimit() });

module.exports = { enabled, checkItem, clear, offersFor, allOffers, status, searchQuery, matchScore, pickOffers, googleOffers, ebayOffers };
