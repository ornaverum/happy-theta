'use strict';
/* Tests for WishIMay's other-store prices: `node tests/wish-compare-test.js`.
   SerpApi is replaced by a small local server, so no key or searches are used. */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wishcmp-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.SERPAPI_KEY = 'test-key';
process.env.SERPAPI_MONTHLY_LIMIT = '7';

let failed = 0;
const test = async (name, fn) => {
	try {
		await fn();
		console.log('ok  ', name);
	} catch (err) {
		failed++;
		console.log('FAIL', name, '\n     ', err.message);
	}
};

const GOOGLE = {
	inline_shopping_results: [{ title: 'Kindle Paperwhite 16GB Black', source: 'Target', price: '$139.99', extracted_price: 139.99, link: 'https://www.target.com/p/kindle' }],
	shopping_results: [
		{ title: 'Amazon Kindle Paperwhite (16 GB)', source: 'Best Buy', price: '$149.99', extracted_price: 149.99, product_link: 'https://www.google.com/shopping/product/1', delivery: 'Free delivery' },
		{ title: 'Kindle Paperwhite 16 GB Black', source: 'Target', price: '$141.00', extracted_price: 141, product_link: 'https://www.google.com/shopping/product/2' },
		{ title: 'Kindle Paperwhite case, leather', source: 'Etsy', price: '$12.00', extracted_price: 12, product_link: 'https://www.google.com/shopping/product/3' },
		{ title: 'Garden hose 50 ft', source: 'Walmart', price: '$140.00', extracted_price: 140, product_link: 'https://www.google.com/shopping/product/4' },
		{ title: 'Kindle Paperwhite 16GB, used', source: 'Back Market', price: '$95.00', extracted_price: 95, second_hand_condition: 'used', product_link: 'https://www.google.com/shopping/product/5' },
		{ title: 'Kindle Paperwhite 16GB', source: 'Shady', price: '$130', extracted_price: 130, product_link: 'javascript:alert(1)' }
	]
};
const EBAY = {
	organic_results: [
		{ title: 'Kindle Paperwhite 16GB 11th gen NEW SEALED', link: 'https://www.ebay.com/itm/1', price: { raw: '$120.00', extracted: 120 }, condition: 'Brand New', shipping: 'Free shipping' },
		{ title: 'Kindle Paperwhite 16GB lot', link: 'https://www.ebay.com/itm/2', price: { from: { raw: '$110.00', extracted: 110 }, to: { raw: '$130.00', extracted: 130 } }, condition: 'Pre-Owned' },
		{ title: 'Kindle Paperwhite 16GB auction', link: 'https://www.ebay.com/itm/3', price: { raw: '$40.00', extracted: 40 }, buying_format: 'Auction' },
		{ title: 'Phone charger', link: 'https://www.ebay.com/itm/4', price: { raw: '$130.00', extracted: 130 } }
	]
};

let mode = 'ok';
const seen = [];
const fake = http.createServer((req, res) => {
	const u = new URL(req.url, 'http://x');
	seen.push(Object.fromEntries(u.searchParams));
	const send = (code, body) => setTimeout(() => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)), 30);
	if (u.searchParams.get('api_key') !== 'test-key' || mode === 'badkey') return send(401, { error: 'Invalid API key. Your API key should be here: https://serpapi.com/manage-api-key' });
	if (mode === 'empty') return send(200, { error: "Google hasn't returned any results for this query." });
	if (mode === 'ebaydown' && u.searchParams.get('engine') === 'ebay') return send(500, { error: 'Something broke' });
	send(200, u.searchParams.get('engine') === 'ebay' ? EBAY : GOOGLE);
});

(async () => {
	await new Promise((r) => fake.listen(0, '127.0.0.1', r));
	process.env.SERPAPI_BASE_URL = `http://127.0.0.1:${fake.address().port}/search.json`;
	const { db } = require('../db');
	require('../wishlist'); // makes the tables
	const cmp = require('../wish-compare');

	await test('search words come from a tidy version of the name', () => {
		assert.strictEqual(cmp.searchQuery({ title: 'Kindle Paperwhite (16 GB) – Black, Ad-Supported | Amazon' }), 'Kindle Paperwhite');
		assert.strictEqual(cmp.searchQuery({ title: 'LEGO Icons Orchid 10311 Building Set for Adults' }), 'LEGO Icons Orchid 10311 Building Set for Adults');
		assert.strictEqual(cmp.searchQuery({ title: 'Mug', search_query: '  blue ceramic mug 16oz ' }), 'blue ceramic mug 16oz');
	});

	await test('match score counts the search words in a result title', () => {
		assert.strictEqual(cmp.matchScore('Kindle Paperwhite 16GB', 'Amazon Kindle Paperwhite 16GB Black'), 1);
		assert.ok(cmp.matchScore('Kindle Paperwhite 16GB', 'Garden hose') === 0);
	});

	await test('Google results: direct links preferred, bad links dropped, used marked', () => {
		const o = cmp.googleOffers(GOOGLE, 'Kindle Paperwhite 16GB', 'USD');
		assert.strictEqual(o[0].link, 'https://www.target.com/p/kindle');
		assert.ok(!o.some((x) => x.store === 'Shady'));
		assert.strictEqual(o.find((x) => x.store === 'Back Market').condition, 'used');
	});

	await test('eBay results: price ranges use the low end, auctions skipped', () => {
		const o = cmp.ebayOffers(EBAY, 'Kindle Paperwhite 16GB', 'USD');
		assert.strictEqual(o.find((x) => x.link.endsWith('/2')).price, 110);
		assert.ok(!o.some((x) => x.link.endsWith('/3')));
	});

	await test('picking: off-topic and accessory results go, one per store, cheapest first', () => {
		const q = 'Kindle Paperwhite 16GB';
		const o = cmp.pickOffers(cmp.googleOffers(GOOGLE, q, 'USD'), q, 149.99, 6);
		const stores = o.map((x) => x.store);
		assert.deepStrictEqual(stores, ['Back Market', 'Target', 'Best Buy']);
		assert.strictEqual(o[1].price, 139.99);
	});

	const person = db.prepare("INSERT INTO wish_people (name) VALUES ('Jo') RETURNING id").get().id;
	const addItem = (title, price) =>
		db.prepare('INSERT INTO wish_items (person_id, title, price_cents) VALUES (?, ?, ?) RETURNING *').get(person, title, price);
	const item = addItem('Kindle Paperwhite 16GB', 14999);

	await test('a check asks both engines and saves the offers', async () => {
		const r = await cmp.checkItem(item);
		assert.ok(seen.some((p) => p.engine === 'google_shopping' && p.q === 'Kindle Paperwhite 16GB' && p.gl === 'us'));
		assert.ok(seen.some((p) => p.engine === 'ebay' && p._nkw === 'Kindle Paperwhite 16GB' && p.ebay_domain === 'ebay.com'));
		assert.ok(r.checkedAt);
		assert.strictEqual(r.error, '');
		assert.deepStrictEqual(r.offers.map((o) => o.store), ['Back Market', 'eBay', 'eBay', 'Target', 'Best Buy']);
		assert.strictEqual(cmp.allOffers().get(item.id).offers.length, 5);
		assert.strictEqual(cmp.status().used, 2);
	});

	await test('two clicks at once spend one check', async () => {
		const before = seen.length;
		await Promise.all([cmp.checkItem(item), cmp.checkItem(item)]);
		assert.strictEqual(seen.length - before, 2);
		assert.strictEqual(cmp.status().used, 4);
	});

	await test('one engine failing keeps the other’s offers and notes the problem', async () => {
		mode = 'ebaydown';
		const r = await cmp.checkItem(item);
		mode = 'ok';
		assert.ok(r.offers.length >= 1 && r.offers.every((o) => o.source === 'google'));
		assert.match(r.error, /^eBay:/);
	});

	await test('no results is an empty list, not an error', async () => {
		mode = 'empty';
		const r = await cmp.checkItem(addItem('Zxqv nonsense thing', null));
		mode = 'ok';
		assert.deepStrictEqual(r.offers, []);
		assert.strictEqual(r.error, '');
	});

	await test('the monthly budget stops checks before SerpApi is called', async () => {
		// limit 7: used so far 4 + 1 (eBay failed, not counted) + 2 (empty answers are counted) = 7
		const before = seen.length;
		await assert.rejects(cmp.checkItem(item), /used up/);
		assert.strictEqual(seen.length, before);
	});

	await test('a bad key gives a clear message', async () => {
		process.env.SERPAPI_MONTHLY_LIMIT = '100';
		mode = 'badkey';
		await assert.rejects(cmp.checkItem(item), /key isn’t valid/);
		mode = 'ok';
	});

	await test('the key is sent to SerpApi but never stored with offers', () => {
		const rows = db.prepare('SELECT * FROM wish_offers').all();
		assert.ok(!JSON.stringify(rows).includes('test-key'));
	});

	await test('clear() forgets an item’s offers; deleting an item removes them', () => {
		cmp.clear(item.id);
		assert.strictEqual(cmp.offersFor(item.id).checkedAt, null);
		db.prepare('DELETE FROM wish_items').run();
		assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM wish_offers').get().n, 0);
	});

	fake.close();
	db.close();
	fs.rmSync(tmp, { recursive: true, force: true });
	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
})();
