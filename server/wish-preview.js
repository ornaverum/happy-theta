'use strict';
/* WishIMay: read a product page and pull out its title, picture, description and price.

   fetchPage() downloads the page safely:
   - only http/https, at most 5 redirects, 10 s, 2 MB;
   - every address it connects to (including after redirects) must be a public one, checked at
     connect time, so a link can't be used to reach the droplet itself or a private network.
   parsePage() is plain string work (no DOM, no packages) so it can be tested on saved HTML:
   JSON-LD Product data first, then Open Graph / Twitter / itemprop tags, then a few
   Amazon-specific spots, then the <title>. */
const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const os = require('os');
const zlib = require('zlib');
const { pipeline } = require('stream');

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = Number(process.env.WISH_PREVIEW_TIMEOUT_MS) || 12000; // for the whole fetch, redirects included
const MAX_REDIRECTS = 5;
// Many shops refuse requests that don't look like a browser; this one says who it is at the end.
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 WishIMay/1.0';

/* ---------- which addresses are off limits ---------- */
// This machine's own addresses (a droplet's public IP sits on its own network card), so a link can't
// reach services that only a cloud firewall hides from the outside.
const OWN_ADDRESSES = new Set(
	Object.values(os.networkInterfaces())
		.flat()
		.filter(Boolean)
		.map((i) => i.address.toLowerCase())
);

function isBlockedAddress(ip) {
	return isPrivateAddress(ip) || OWN_ADDRESSES.has(String(ip).toLowerCase());
}

function isPrivateAddress(ip) {
	if (net.isIPv4(ip)) {
		const [a, b] = ip.split('.').map(Number);
		return (
			a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || // this host, private, loopback, CGNAT
			(a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
			(a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224 // link-local, private, special, multicast/reserved
		);
	}
	if (net.isIPv6(ip)) {
		const v = ip.toLowerCase();
		if (v === '::' || v === '::1') return true;
		// IPv4 written inside IPv6 (::ffff:1.2.3.4, ::ffff:102:304, ::1.2.3.4, 64:ff9b::1.2.3.4) → check the IPv4 part
		const embedded = v.match(/^(?:::ffff:(?:0:)?|::|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
		if (embedded) {
			if (embedded[1]) return isPrivateAddress(embedded[1]);
			const hi = parseInt(embedded[2], 16);
			const lo = parseInt(embedded[3], 16);
			return isPrivateAddress([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));
		}
		return /^(fc|fd|fe8|fe9|fea|feb|ff|2001:db8|100::)/.test(v); // unique-local, link-local, multicast, documentation, discard
	}
	return true;
}

// Used by http(s).request at connect time, so a name can't resolve to a public address when we
// check it and a private one when we connect.
function safeLookup(hostname, options, callback) {
	if (typeof options === 'function') [callback, options] = [options, {}];
	dns.lookup(hostname, { all: true }, (err, addrs) => {
		if (err) return callback(err);
		const allowPrivate = process.env.WISH_PREVIEW_ALLOW_PRIVATE === '1'; // local tests only
		const ok = addrs.filter((a) => allowPrivate || !isBlockedAddress(a.address));
		if (!ok.length) return callback(Object.assign(new Error('That address is not allowed.'), { code: 'EPRIVATE' }));
		if (options && options.all) return callback(null, ok);
		callback(null, ok[0].address, ok[0].family);
	});
}

function checkUrl(raw) {
	let u;
	try {
		u = new URL(String(raw).trim());
	} catch {
		return null;
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
	if (u.username || u.password) return null;
	if (u.port && !['80', '443', '8080', '8443'].includes(u.port) && process.env.WISH_PREVIEW_ALLOW_PRIVATE !== '1') return null;
	return u;
}

function getOnce(u, msLeft) {
	return new Promise((resolve, reject) => {
		const lib = u.protocol === 'https:' ? https : http;
		let settled = false;
		const finish = (fn, v) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			fn(v);
		};
		const fail = (err) => {
			finish(reject, err);
			req.destroy();
		};
		// One deadline for this request, however slowly the page dribbles in.
		const timer = setTimeout(() => fail(Object.assign(new Error('The page took too long to answer.'), { code: 'ETIMEDOUT' })), Math.max(1, msLeft));
		const req = lib.request(
			u,
			{
				method: 'GET',
				lookup: safeLookup,
				timeout: Math.max(1, msLeft),
				headers: {
					'User-Agent': USER_AGENT,
					Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
					'Accept-Language': 'en-US,en;q=0.9',
					'Accept-Encoding': 'gzip, deflate, br'
				}
			},
			(res) => {
				if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
					res.resume();
					let next = null;
					try {
						next = new URL(res.headers.location, u).toString();
					} catch {} // a broken Location header is reported below, never thrown here
					return finish(resolve, { redirect: next, badRedirect: !next });
				}
				const enc = String(res.headers['content-encoding'] || '').toLowerCase();
				const decoder = enc === 'gzip' ? zlib.createGunzip() : enc === 'deflate' ? zlib.createInflate() : enc === 'br' ? zlib.createBrotliDecompress() : null;
				// pipeline passes errors and cut-off connections along, so nothing is left hanging
				const stream = decoder ? pipeline(res, decoder, (err) => err && fail(err)) : res;
				if (!decoder) {
					res.on('error', fail);
					res.on('close', () => !res.complete && fail(Object.assign(new Error('The page stopped loading.'), { code: 'ECONNRESET' })));
				}
				const chunks = [];
				let size = 0;
				const done = (truncated) =>
					finish(resolve, { status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), truncated });
				stream.on('data', (c) => {
					if (settled) return;
					size += c.length;
					if (size > MAX_BYTES) {
						done(true);
						req.destroy();
					} else chunks.push(c);
				});
				stream.on('end', () => done(false));
				stream.on('error', fail);
			}
		);
		req.on('timeout', () => fail(Object.assign(new Error('The page took too long to answer.'), { code: 'ETIMEDOUT' })));
		req.on('error', fail);
		req.end();
	});
}

// Node connects straight to an IP-address link without calling safeLookup, so check those here.
function blockIpLiteral(u) {
	const host = u.hostname.replace(/^\[|\]$/g, '');
	if (net.isIP(host) && isBlockedAddress(host) && process.env.WISH_PREVIEW_ALLOW_PRIVATE !== '1')
		throw Object.assign(new Error('That address is not allowed.'), { code: 'EPRIVATE' });
}

async function fetchPage(rawUrl) {
	let u = checkUrl(rawUrl);
	if (!u) throw Object.assign(new Error('Enter a full web address starting with http:// or https://.'), { code: 'EBADURL' });
	const deadline = Date.now() + TIMEOUT_MS;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		blockIpLiteral(u);
		const left = deadline - Date.now();
		if (left <= 0) throw Object.assign(new Error('The page took too long to answer.'), { code: 'ETIMEDOUT' });
		const r = await getOnce(u, left);
		if (r.badRedirect) throw Object.assign(new Error('The page redirected somewhere we can’t follow.'), { code: 'EBADURL' });
		if (!r.redirect) return { ...r, url: u.toString() };
		const next = checkUrl(r.redirect);
		if (!next) throw Object.assign(new Error('The page redirected somewhere we can’t follow.'), { code: 'EBADURL' });
		u = next;
	}
	throw Object.assign(new Error('Too many redirects.'), { code: 'EREDIRECT' });
}

/* ---------- parsing ---------- */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', reg: '®', trade: '™', copy: '©', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', euro: '€', pound: '£', yen: '¥', cent: '¢' };
function decode(s) {
	return String(s)
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
		.replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const safeChar = (n) => (n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '');
const clean = (s, max) => decode(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, max);

function attrs(tag) {
	const out = {};
	const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
	let m;
	while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
	return out;
}

/* "$1,299.99", "1.299,99 €", "12" → { amount, currency } */
const SYMBOLS = { $: 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY', '₹': 'INR', C$: 'CAD', A$: 'AUD', CA$: 'CAD', AU$: 'AUD' };
function parsePrice(raw, currencyHint) {
	if (raw === null || raw === undefined) return null;
	if (typeof raw === 'number') return isFinite(raw) && raw >= 0 ? { amount: raw, currency: currencyHint || null } : null;
	const s = decode(String(raw)).trim();
	const m = s.match(/(\d[\d.,\s]*\d|\d)/);
	if (!m) return null;
	let num = m[1].replace(/\s/g, '');
	const lastComma = num.lastIndexOf(',');
	const lastDot = num.lastIndexOf('.');
	if (lastComma > lastDot) {
		// "1.299,99" or "12,99" → comma is the decimal mark if 1–2 digits follow it
		num = /,\d{1,2}$/.test(num) ? num.replace(/\./g, '').replace(',', '.') : num.replace(/,/g, '');
	} else num = num.replace(/,/g, '');
	const amount = Number(num);
	if (!isFinite(amount) || amount < 0 || amount > 1e7) return null;
	let currency = currencyHint || null;
	if (!currency) {
		const code = s.match(/\b([A-Z]{3})\b/);
		if (code) currency = code[1];
		else for (const [sym, cur] of Object.entries(SYMBOLS).sort((a, b) => b[0].length - a[0].length)) if (s.includes(sym)) { currency = cur; break; }
	}
	return { amount, currency };
}

function walkJsonLd(node, found) {
	if (!node || typeof node !== 'object' || found.length > 20) return;
	if (Array.isArray(node)) return node.forEach((n) => walkJsonLd(n, found));
	const type = [].concat(node['@type'] || []).map(String);
	if (type.some((t) => /^(Product|ProductGroup|IndividualProduct|Book|Offer)$/i.test(t))) found.push(node);
	if (node['@graph']) walkJsonLd(node['@graph'], found);
	if (node.mainEntity) walkJsonLd(node.mainEntity, found);
	if (node.itemListElement) walkJsonLd(node.itemListElement, found);
}

const firstImage = (img) => {
	if (!img) return '';
	if (typeof img === 'string') return img;
	if (Array.isArray(img)) return firstImage(img[0]);
	return img.url || img.contentUrl || img['@id'] || '';
};

function offerPrice(offers) {
	for (const o of [].concat(offers || [])) {
		if (!o || typeof o !== 'object') continue;
		const cur = o.priceCurrency || o.priceSpecification?.priceCurrency;
		const raw = o.price ?? o.lowPrice ?? o.priceSpecification?.price ?? o.highPrice;
		const p = parsePrice(raw, cur);
		if (p) return p;
		if (o.offers) {
			const inner = offerPrice(o.offers);
			if (inner) return inner;
		}
	}
	return null;
}

function absolute(src, base) {
	if (!src) return '';
	try {
		const u = new URL(decode(src).trim(), base);
		return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString().slice(0, 2000) : '';
	} catch {
		return '';
	}
}

function parsePage(html, pageUrl) {
	html = String(html || '');
	const head = html.slice(0, 600000);
	const meta = {};
	for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
		const a = attrs(tag);
		const key = (a.property || a.name || a.itemprop || '').toLowerCase();
		if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
	}
	const itemprop = {};
	for (const tag of html.match(/<[a-z]+\b[^>]*\bitemprop\s*=\s*["']?(price|pricecurrency|name|image)\b[^>]*>/gi) || []) {
		const a = attrs(tag);
		const k = String(a.itemprop).toLowerCase();
		if (!(k in itemprop)) itemprop[k] = a.content ?? a.src ?? a.href ?? null;
	}

	// JSON-LD product data (most shops, including Shopify and Target)
	const products = [];
	for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
		try {
			walkJsonLd(JSON.parse(m[1].trim().replace(/^<!--|-->$/g, '')), products);
		} catch {}
	}
	const product = products.find((p) => !/^Offer$/i.test([].concat(p['@type'])[0])) || products[0] || null;

	const out = { title: '', image: '', description: '', price: null, currency: null, siteName: '' };
	if (product) {
		out.title = clean(product.name, 300);
		out.image = firstImage(product.image);
		out.description = clean(product.description, 1000);
		const p = offerPrice(product.offers) || offerPrice(product['@type'] === 'Offer' ? product : null) || offerPrice(product.hasVariant?.flatMap?.((v) => v.offers || []));
		if (p) [out.price, out.currency] = [p.amount, p.currency];
	}

	out.title ||= clean(meta['og:title'] || meta['twitter:title'] || itemprop.name, 300);
	out.image ||= meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'] || itemprop.image || '';
	out.description ||= clean(meta['og:description'] || meta['twitter:description'] || meta.description, 1000);
	out.siteName = clean(meta['og:site_name'] || meta['application-name'], 100);
	if (out.price === null) {
		const p =
			parsePrice(meta['product:price:amount'] || meta['og:price:amount'] || meta['twitter:data1'] && /\d/.test(meta['twitter:data1']) && meta['twitter:data1'], meta['product:price:currency'] || meta['og:price:currency']) ||
			parsePrice(itemprop.price, itemprop.pricecurrency);
		if (p) [out.price, out.currency] = [p.amount, p.currency];
	}

	// Amazon pages: title, main picture and price live in their own elements
	const host = (() => {
		try {
			return new URL(pageUrl).hostname.toLowerCase();
		} catch {
			return '';
		}
	})();
	if (/(^|\.)amazon\.|(^|\.)amzn\./.test(host) || /id=["']productTitle["']/.test(html)) {
		const t = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
		if (t) out.title = clean(t[1], 300) || out.title;
		const img = html.match(/<img\b[^>]*\bid=["']landingImage["'][^>]*>/i) || html.match(/<img\b[^>]*\bid=["']imgBlkFront["'][^>]*>/i);
		if (img) {
			const a = attrs(img[0]);
			let src = a['data-old-hires'];
			if (!src && a['data-a-dynamic-image']) {
				try {
					src = Object.keys(JSON.parse(decode(a['data-a-dynamic-image'])))[0];
				} catch {}
			}
			out.image = src || a.src || out.image;
		}
		if (out.price === null) {
			const core = html.match(/id=["'](?:corePrice_feature_div|corePriceDisplay_desktop_feature_div|apex_desktop)["'][\s\S]{0,4000}?class=["']a-offscreen["'][^>]*>([^<]+)</i) ||
				html.match(/class=["']a-price[^"']*["'][^>]*>\s*<span class=["']a-offscreen["'][^>]*>([^<]+)</i);
			const p = core && parsePrice(core[1]);
			if (p) [out.price, out.currency] = [p.amount, p.currency];
		}
		if (!out.description) {
			const bullets = html.match(/id=["']feature-bullets["'][\s\S]*?<\/ul>/i);
			if (bullets) out.description = (bullets[0].match(/<span class=["']a-list-item["'][^>]*>([\s\S]*?)<\/span>/gi) || []).map((s) => clean(s, 300)).filter(Boolean).slice(0, 4).join(' • ').slice(0, 1000);
		}
		out.siteName ||= 'Amazon';
	}

	if (!out.title) {
		const t = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
		if (t) out.title = clean(t[1], 300);
	}
	if (!out.image) {
		const l = head.match(/<link\b[^>]*rel=["']?image_src["']?[^>]*>/i);
		if (l) out.image = attrs(l[0]).href || '';
	}
	out.image = absolute(out.image, pageUrl);
	if (out.price !== null) out.price = Math.round(out.price * 100) / 100;
	if (out.currency && !/^[A-Z]{3}$/.test(out.currency)) out.currency = null;
	return out;
}

/* Pages that answered with a "prove you're human" screen instead of the product */
function looksBlocked(html, status) {
	const s = String(html || '').slice(0, 200000);
	return (
		status === 403 || status === 429 || status === 503 ||
		/validateCaptcha|api-services-support@amazon\.com|Robot Check|captcha-delivery|px-captcha|cf-chl-|Attention Required!|Access Denied/i.test(s)
	);
}

/* The whole job: { ok, title, image, description, price, currency, siteName, url } or { ok:false, error } */
async function preview(rawUrl) {
	let page;
	try {
		page = await fetchPage(rawUrl);
	} catch (err) {
		const msg = {
			EBADURL: err.message,
			EPRIVATE: 'That address is not allowed.',
			EREDIRECT: err.message,
			ETIMEDOUT: 'The page took too long to answer.',
			ENOTFOUND: 'That website could not be found. Check the address.',
			ECONNRESET: 'The page stopped loading partway. Try again.'
		}[err.code];
		return { ok: false, error: msg || 'Could not reach that page.' };
	}
	const type = String(page.headers['content-type'] || '');
	if (type && !/html|xml/i.test(type)) {
		if (/^image\//i.test(type)) return { ok: true, partial: true, url: page.url, title: '', image: page.url, description: '', price: null, currency: null, siteName: '' };
		return { ok: false, error: 'That link isn’t a web page.' };
	}
	const data = parsePage(page.body, page.url);
	const blocked = looksBlocked(page.body, page.status) && data.price === null && !data.image;
	if (blocked)
		return { ok: false, blocked: true, error: 'That shop didn’t let us read the page (it asked for a “prove you’re human” check). Fill in the details by hand.' };
	return { ok: true, partial: !data.title || data.price === null || !data.image, url: page.url, ...data };
}

module.exports = { preview, parsePage, parsePrice, isPrivateAddress, isBlockedAddress, checkUrl, fetchPage };
