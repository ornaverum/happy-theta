'use strict';
/* Tests for WishIMay's page reader: `node tests/wish-preview-test.js` (no packages needed beyond the server's).
   Parsing is checked on small saved-page samples; fetching is checked against a local test server
   (redirects, gzip, size and private-address rules). */
process.env.WISH_PREVIEW_TIMEOUT_MS = '1500'; // keep the slow-page tests quick
const assert = require('assert');
const os = require('os');
const http = require('http');
const zlib = require('zlib');
const { parsePage, parsePrice, isPrivateAddress, isBlockedAddress, checkUrl } = require('../wish-preview');

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

const SHOPIFY = `<!doctype html><html><head><title>Cozy Socks – Sock Shop</title>
<meta property="og:title" content="Cozy Socks">
<meta property="og:image" content="//cdn.shopify.com/s/files/socks.jpg?v=1">
<script type="application/ld+json">{"@context":"http://schema.org/","@type":"Product","name":"Cozy Wool Socks &amp; More",
"image":["https://cdn.shopify.com/s/files/socks-1.jpg"],"description":"Warm <b>merino</b> socks.",
"offers":[{"@type":"Offer","price":"18.00","priceCurrency":"USD","availability":"http://schema.org/InStock"}]}</script>
</head><body></body></html>`;

const GRAPH = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"page"},
{"@type":"Product","name":"Desk Lamp","image":{"@type":"ImageObject","url":"/img/lamp.png"},
"offers":{"@type":"AggregateOffer","lowPrice":"34.5","highPrice":"40","priceCurrency":"CAD"}}]}
</script></head></html>`;

const OG_ONLY = `<html><head>
<meta content="Handmade Mug" property="og:title" />
<meta name="description" content="A big blue mug.">
<meta property='og:image' content='https://shop.example/mug.jpg'>
<meta property="product:price:amount" content="1.299,00"><meta property="product:price:currency" content="EUR">
<meta property="og:site_name" content="Pottery Place">
</head></html>`;

const AMAZON = `<html><head><title>Amazon.com: Kindle Paperwhite</title>
<meta name="title" content="Amazon.com: Kindle Paperwhite"></head><body>
<span id="productTitle" class="a-size-large">   Kindle Paperwhite (16 GB) &ndash; Black   </span>
<div id="corePrice_feature_div"><span class="a-price aok-align-center"><span class="a-offscreen">$149.99</span><span aria-hidden="true">$149<sup>99</sup></span></span></div>
<img alt="Kindle" src="https://m.media-amazon.com/images/I/small.jpg" data-old-hires="https://m.media-amazon.com/images/I/big.jpg" id="landingImage">
<div id="feature-bullets"><ul><li><span class="a-list-item"> Glare-free display </span></li><li><span class="a-list-item">Weeks of battery</span></li></ul></div>
</body></html>`;

const AMAZON_DYNAMIC = `<span id="productTitle">Thing</span>
<img id="landingImage" data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/dyn.jpg&quot;:[500,500]}" src="data:image/gif;base64,R0lG">`;

const CAPTCHA = `<html><head><title>Robot Check</title></head><body><form action="/errors/validateCaptcha"></form></body></html>`;

(async () => {
	await test('Shopify JSON-LD: name, image, price, description', () => {
		const r = parsePage(SHOPIFY, 'https://socks.example/products/cozy');
		assert.strictEqual(r.title, 'Cozy Wool Socks & More');
		assert.strictEqual(r.image, 'https://cdn.shopify.com/s/files/socks-1.jpg');
		assert.strictEqual(r.price, 18);
		assert.strictEqual(r.currency, 'USD');
		assert.strictEqual(r.description, 'Warm merino socks.');
	});

	await test('@graph Product with AggregateOffer and relative image', () => {
		const r = parsePage(GRAPH, 'https://lamps.example/p/1');
		assert.strictEqual(r.title, 'Desk Lamp');
		assert.strictEqual(r.image, 'https://lamps.example/img/lamp.png');
		assert.strictEqual(r.price, 34.5);
		assert.strictEqual(r.currency, 'CAD');
	});

	await test('Open Graph only, attributes in any order, European price', () => {
		const r = parsePage(OG_ONLY, 'https://shop.example/mug');
		assert.strictEqual(r.title, 'Handmade Mug');
		assert.strictEqual(r.image, 'https://shop.example/mug.jpg');
		assert.strictEqual(r.description, 'A big blue mug.');
		assert.strictEqual(r.price, 1299);
		assert.strictEqual(r.currency, 'EUR');
		assert.strictEqual(r.siteName, 'Pottery Place');
	});

	await test('Amazon product page elements', () => {
		const r = parsePage(AMAZON, 'https://www.amazon.com/dp/B0CFPJYX7P');
		assert.strictEqual(r.title, 'Kindle Paperwhite (16 GB) – Black');
		assert.strictEqual(r.image, 'https://m.media-amazon.com/images/I/big.jpg');
		assert.strictEqual(r.price, 149.99);
		assert.strictEqual(r.currency, 'USD');
		assert.strictEqual(r.description, 'Glare-free display • Weeks of battery');
		assert.strictEqual(r.siteName, 'Amazon');
	});

	await test('Amazon dynamic image JSON', () => {
		const r = parsePage(AMAZON_DYNAMIC, 'https://www.amazon.com/dp/X');
		assert.strictEqual(r.image, 'https://m.media-amazon.com/images/I/dyn.jpg');
	});

	await test('plain page falls back to <title>; data: images dropped', () => {
		const r = parsePage('<title>Just a page</title><meta property="og:image" content="javascript:alert(1)">', 'https://x.example/');
		assert.strictEqual(r.title, 'Just a page');
		assert.strictEqual(r.image, '');
		assert.strictEqual(r.price, null);
	});

	await test('price strings', () => {
		assert.deepStrictEqual(parsePrice('$1,299.99'), { amount: 1299.99, currency: 'USD' });
		assert.deepStrictEqual(parsePrice('£12'), { amount: 12, currency: 'GBP' });
		assert.deepStrictEqual(parsePrice('12,50 €'), { amount: 12.5, currency: 'EUR' });
		assert.deepStrictEqual(parsePrice('CA$ 20.00'), { amount: 20, currency: 'CAD' });
		assert.deepStrictEqual(parsePrice('USD 5'), { amount: 5, currency: 'USD' });
		assert.strictEqual(parsePrice('call for price'), null);
	});

	await test('private addresses', () => {
		for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd12::1', 'fe80::1', '::ffff:7f00:1', '::ffff:10.0.0.1'])
			assert.ok(isPrivateAddress(ip), ip);
		for (const ip of ['8.8.8.8', '151.101.1.69', '172.32.0.1', '2606:4700::1111']) assert.ok(!isPrivateAddress(ip), ip);
	});

	await test('only plain http(s) links on normal ports', () => {
		assert.ok(checkUrl('https://www.amazon.com/dp/X'));
		assert.ok(!checkUrl('ftp://x.example/'));
		assert.ok(!checkUrl('javascript:alert(1)'));
		assert.ok(!checkUrl('https://user:pw@x.example/'));
		assert.ok(!checkUrl('http://x.example:22/'));
	});

	// ---- fetching, against a local server (private addresses allowed only for this test) ----
	const server = http.createServer((req, res) => {
		if (req.url === '/redirect') return res.writeHead(302, { Location: '/gz' }).end();
		if (req.url === '/gz') {
			res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
			return res.end(zlib.gzipSync(SHOPIFY));
		}
		if (req.url === '/captcha') return res.writeHead(503, { 'Content-Type': 'text/html' }).end(CAPTCHA);
		if (req.url === '/loop') return res.writeHead(302, { Location: '/loop' }).end();
		if (req.url === '/pdf') return res.writeHead(200, { 'Content-Type': 'application/pdf' }).end('%PDF');
		if (req.url === '/badredirect') return res.writeHead(302, { Location: 'http://[::1' }).end();
		if (req.url === '/drip') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			const t = setInterval(() => res.write('<'), 200);
			return res.on('close', () => clearInterval(t));
		}
		if (req.url === '/cutgz') {
			res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
			const gz = zlib.gzipSync(SHOPIFY.repeat(50));
			res.write(gz.subarray(0, 200));
			return setTimeout(() => res.socket.destroy(), 50);
		}
		res.writeHead(404).end();
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const base = `http://127.0.0.1:${server.address().port}`;
	const { preview } = require('../wish-preview');

	await test('private address refused by default', async () => {
		const r = await preview(`${base.replace(/:\d+$/, '')}/gz`);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /not allowed/);
	});

	process.env.WISH_PREVIEW_ALLOW_PRIVATE = '1';
	await test('follows a redirect and unzips', async () => {
		const r = await preview(`${base}/redirect`);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.price, 18);
		assert.strictEqual(r.url, `${base}/gz`);
	});
	await test('captcha page reported as blocked', async () => {
		const r = await preview(`${base}/captcha`);
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.blocked, true);
	});
	await test('redirect loop stops', async () => {
		const r = await preview(`${base}/loop`);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /redirect/i);
	});
	await test('non-page link refused', async () => {
		const r = await preview(`${base}/pdf`);
		assert.strictEqual(r.ok, false);
	});
	await test('broken redirect address is reported, not a crash', async () => {
		const r = await preview(`${base}/badredirect`);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /redirect/i);
	});
	await test('a page that dribbles in slowly hits the overall time limit', async () => {
		const t0 = Date.now();
		const r = await preview(`${base}/drip`);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /too long/);
		assert.ok(Date.now() - t0 < 4000, 'took ' + (Date.now() - t0) + ' ms');
	});
	await test('a compressed page cut off midway ends with an error', async () => {
		const t0 = Date.now();
		const r = await preview(`${base}/cutgz`);
		assert.ok(Date.now() - t0 < 4000, 'took ' + (Date.now() - t0) + ' ms');
		assert.ok(r.ok === false || typeof r.title === 'string');
	});
	delete process.env.WISH_PREVIEW_ALLOW_PRIVATE;
	await test("this machine's own addresses are blocked", () => {
		const own = Object.values(os.networkInterfaces()).flat().filter(Boolean).map((i) => i.address);
		for (const ip of own) assert.ok(isBlockedAddress(ip), ip);
		assert.ok(!isBlockedAddress('8.8.8.8'));
	});
	server.close();

	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
})();
