/* Wish I May — guest demo. Opened as wish/?demo=1 (from the My Apps guest preview).
   Stands in for the server: a made-up family list kept in this browser's localStorage only.
   wish.js sends every API call to WishDemo.handle() when this is loaded and ?demo is in the URL.
   Switch between the owner and shopper views with the bar at the top. */
'use strict';
(function () {
	if (!new URLSearchParams(location.search).has('demo')) return;
	const KEY = 'wishimay:demo:v1';
	const now = () => new Date().toISOString();
	const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

	function seed() {
		const people = [
			{ id: 1, name: 'Mom', color: '#d6336c', sort: 1 },
			{ id: 2, name: 'Dad', color: '#2f6fd6', sort: 2 },
			{ id: 3, name: 'Sam', color: '#2e9e6b', sort: 3 }
		];
		const it = (id, personId, title, price, priority, description, notes, d) => ({
			id, personId, title, url: '', imageUrl: '', description, price, currency: 'USD', priority, notes,
			siteName: '', searchQuery: '', priceCheckedAt: null, createdAt: daysAgo(d), updatedAt: daysAgo(d)
		});
		const items = [
			it(1, 1, 'Cast iron skillet, 12 inch', 34.99, 1, 'Pre-seasoned, with a helper handle.', '', 9),
			it(2, 1, 'Herb garden starter kit', 22.5, 3, 'Basil, parsley, thyme and chives with pots.', 'For the kitchen window', 6),
			it(3, 2, 'Cordless drill set', 89.0, 1, '20 V, two batteries, case.', '', 12),
			it(4, 2, 'Paperback: a good mystery novel', 14.99, 2, 'Anything by an author he hasn’t read yet.', 'Ask Sam for ideas', 3),
			it(5, 3, 'Telescope for beginners', 129.0, 1, '70 mm refractor with a sturdy tripod.', 'Wants to see Saturn’s rings', 4),
			it(6, 3, 'Sketchbook and drawing pencils', 18.75, 2, 'Spiral-bound, heavy paper.', '', 2),
			it(7, 3, 'Board game: cooperative, 2–4 players', 39.99, 3, '', '', 1)
		];
		// Item 3 was "bought" by another shopper, so shoppers don't see it.
		return { role: 'owner', nextId: 100, people, items, purchases: { 3: { by: 'other', at: daysAgo(2) } } };
	}
	const load = () => {
		try {
			return JSON.parse(localStorage.getItem(KEY)) || seed();
		} catch {
			return seed();
		}
	};
	const save = (s) => {
		try {
			localStorage.setItem(KEY, JSON.stringify(s));
		} catch {}
	};
	const fail = (status, error) => Promise.reject(Object.assign(new Error(error), { status, data: { error } }));
	const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
	const url = (v) => {
		const s = str(v, 2000);
		if (!s) return '';
		try {
			const u = new URL(s);
			return /^https?:$/.test(u.protocol) ? u.toString() : null;
		} catch {
			return null;
		}
	};

	function cleanItem(s, b) {
		const personId = Number(b && b.personId);
		if (!s.people.some((p) => p.id === personId)) return { error: 'Choose whose wish this is.' };
		const title = str(b.title, 300);
		if (!title) return { error: 'An item needs a name.' };
		const u = url(b.url);
		if (u === null) return { error: 'The shop link must start with http:// or https://.' };
		const img = url(b.imageUrl);
		if (img === null) return { error: 'The picture link must start with http:// or https://.' };
		let price = null;
		if (b.price !== null && b.price !== undefined && b.price !== '') {
			price = Number(String(b.price).replace(/[^0-9.]/g, ''));
			if (!isFinite(price) || price < 0 || price > 1e5) return { error: 'Enter the price as a number, like 24.99.' };
			price = Math.round(price * 100) / 100;
		}
		return {
			item: {
				personId, title, url: u, imageUrl: img, description: str(b.description, 2000), price,
				currency: /^[A-Z]{3}$/.test(b.currency) ? b.currency : 'USD',
				priority: [1, 2, 3].includes(Number(b.priority)) ? Number(b.priority) : 2,
				notes: str(b.notes, 1000), siteName: str(b.siteName, 100), searchQuery: str(b.searchQuery, 150), priceCheckedAt: null
			}
		};
	}
	const out = (it, s) => {
		const o = { ...it, offers: [], offersCheckedAt: null };
		if (s.role === 'shopper') o.purchasedAt = s.purchases[it.id] && s.purchases[it.id].by === 'me' ? s.purchases[it.id].at : null;
		return o;
	};
	const account = (s) => (s.role === 'owner' ? { role: 'owner', email: 'family@example.com', name: 'The family' } : { role: 'shopper', email: 'aunt.jo@example.com', name: 'Aunt Jo' });

	async function handle(path, { method = 'GET', body } = {}) {
		const s = load();
		const m = path.match(/^(\w+)(?:\/(\d+|order))?(?:\/(\w+))?$/) || [];
		const [, res, idRaw, sub] = m;
		const id = Number(idRaw);
		const owner = s.role === 'owner';
		const done = (v) => (save(s), v);

		if (path === 'me') return { account: account(s) };
		if (path === 'logout') {
			location.href = '../';
			return new Promise(() => {});
		}
		if (path === 'list') {
			const items = s.items
				.filter((it) => owner || !s.purchases[it.id] || s.purchases[it.id].by === 'me')
				.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
				.map((it) => out(it, s));
			return { people: [...s.people].sort((a, b) => a.sort - b.sort), items, compare: false };
		}
		if (res === 'people') {
			if (!owner) return fail(403, 'Only the list owners can do that.');
			if (idRaw === 'order') {
				(body.ids || []).forEach((pid, i) => {
					const p = s.people.find((x) => x.id === Number(pid));
					if (p) p.sort = i + 1;
				});
				return done({ people: s.people });
			}
			if (method === 'POST') {
				const name = str(body && body.name, 80);
				if (!name) return fail(400, 'Give the person a name.');
				const person = { id: s.nextId++, name, color: /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#6c6589', sort: s.people.length + 1 };
				s.people.push(person);
				return done({ person });
			}
			const p = s.people.find((x) => x.id === id);
			if (!p) return fail(404, 'That person isn’t on the list.');
			if (method === 'PUT') {
				p.name = str(body.name, 80) || p.name;
				if (/^#[0-9a-f]{6}$/i.test(body.color)) p.color = body.color;
				return done({ person: p });
			}
			if (method === 'DELETE') {
				s.people = s.people.filter((x) => x !== p);
				s.items = s.items.filter((it) => it.personId !== id);
				return done({ ok: true });
			}
		}
		if (res === 'items') {
			if (sub === 'purchase') {
				if (owner) return fail(403, 'Only shoppers can mark items bought.');
				if (!s.items.some((it) => it.id === id)) return fail(404, 'That item was removed from the list.');
				if (method === 'POST') {
					if (s.purchases[id] && s.purchases[id].by !== 'me') return fail(409, 'Someone else already marked this as bought.');
					s.purchases[id] = { by: 'me', at: now() };
					return done({ ok: true });
				}
				if (!s.purchases[id] || s.purchases[id].by !== 'me') return fail(404, 'You haven’t marked that item as bought.');
				delete s.purchases[id];
				return done({ ok: true });
			}
			if (sub === 'offers') return fail(404, 'Price comparison isn’t part of the demo.');
			if (!owner) return fail(403, 'Only the list owners can do that.');
			if (method === 'POST') {
				const c = cleanItem(s, body);
				if (c.error) return fail(400, c.error);
				const item = { id: s.nextId++, ...c.item, createdAt: now(), updatedAt: now() };
				s.items.push(item);
				return done({ item: out(item, s) });
			}
			const it = s.items.find((x) => x.id === id);
			if (!it) return fail(404, 'That item is gone.');
			if (method === 'PUT') {
				const c = cleanItem(s, body);
				if (c.error) return fail(400, c.error);
				Object.assign(it, c.item, { updatedAt: now() });
				return done({ item: out(it, s) });
			}
			if (method === 'DELETE') {
				s.items = s.items.filter((x) => x !== it);
				delete s.purchases[id];
				return done({ ok: true });
			}
		}
		if (path === 'preview') return fail(422, 'The demo can’t read shop pages. Fill in the details by hand.');
		if (path === 'shoppers' && method === 'GET') return { shoppers: [{ id: 50, email: 'aunt.jo@example.com', name: 'Aunt Jo', created_at: daysAgo(30), last_login_at: daysAgo(1) }] };
		if (res === 'shoppers' || path === 'passphrase') return fail(400, 'Logins can’t be changed in the demo.');
		if (path === 'compare-status') return { enabled: false };
		return fail(404, 'Not part of the demo.');
	}

	/* The bar across the top: which view, reset, back. */
	function bar() {
		const s = load();
		const b = document.createElement('div');
		b.className = 'demo-bar';
		b.innerHTML =
			'<span><b>Demo list</b> — made-up family, saved in this browser only.</span>' +
			'<span class="demo-views" role="group" aria-label="View as">View as ' +
			'<button type="button" data-role="owner">Owner</button><button type="button" data-role="shopper">Shopper</button></span>' +
			'<button type="button" class="demo-link" data-reset>Start over</button>' +
			'<a class="demo-link" href="../">Back to My Apps</a>';
		b.querySelectorAll('[data-role]').forEach((btn) => {
			btn.setAttribute('aria-pressed', String(btn.dataset.role === s.role));
			btn.onclick = () => {
				const t = load();
				t.role = btn.dataset.role;
				save(t);
				location.reload();
			};
		});
		b.querySelector('[data-reset]').onclick = () => {
			if (!confirm('Put the demo list back the way it started?')) return;
			const t = seed();
			t.role = load().role;
			save(t);
			location.reload();
		};
		document.body.prepend(b);
	}
	if (document.body) bar();
	else document.addEventListener('DOMContentLoaded', bar);

	window.WishDemo = { handle };
})();
