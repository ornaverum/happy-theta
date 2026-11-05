/* Wish I May — family wish list (owners add wishes as different people; shoppers browse and buy).
   Talks to the API at ./api/ (server/wishlist.js). Plain JS, no build step. */
'use strict';

(function () {
	const API = 'api';
	const app = document.getElementById('app');
	const bandTools = document.getElementById('bandTools');
	const toastEl = document.getElementById('toast');

	const PRIORITY = { 1: 'Top wish', 2: 'Would love', 3: 'Nice to have' };
	const PALETTE = ['#d6336c', '#2f6fd6', '#2e9e6b', '#e8730c', '#7a4fd1', '#0f8fa8', '#b8860b', '#c2410c', '#4b5563'];
	const WORDS = ('apple maple river candle meadow pebble lantern harbor willow cocoa velvet sparrow comet orchard ' +
		'button biscuit garden sunny marble pepper violet thistle juniper otter falcon cedar honey cobalt ' +
		'tulip quartz walnut maple breeze cricket saffron canyon pickle kettle mitten ribbon puzzle tiger').split(' ');

	const S = {
		account: null,
		people: [],
		items: [],
		tab: 'list', // shopper: 'list' | 'mine'
		filters: { q: '', people: [], priority: '', min: '', max: '', sort: 'new' },
		persona: null, // owner: person id, or 'all'
		ownerSort: 'new',
		compare: false // the server can look up other stores' prices (SerpApi key set)
	};

	/* ---------- small helpers ---------- */
	const $ = (sel, root = document) => root.querySelector(sel);
	function el(tag, attrs, ...kids) {
		const n = document.createElement(tag);
		for (const [k, v] of Object.entries(attrs || {})) {
			if (v === null || v === undefined || v === false) continue;
			if (k === 'class') n.className = v;
			else if (k === 'text') n.textContent = v;
			else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? n.style.setProperty(sk, sv) : (n.style[sk] = sv);
			else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
			else n.setAttribute(k, v === true ? '' : v);
		}
		for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : String(c));
		return n;
	}
	const store = {
		get(k, d) {
			try {
				const v = localStorage.getItem('wishimay:' + k);
				return v === null ? d : JSON.parse(v);
			} catch {
				return d;
			}
		},
		set(k, v) {
			try {
				localStorage.setItem('wishimay:' + k, JSON.stringify(v));
			} catch {}
		}
	};

	async function api(path, { method = 'GET', body } = {}) {
		if (window.WishDemo) return window.WishDemo.handle(path, { method, body }); // guest demo (js/wish-demo.js)
		const opts = { method, credentials: 'same-origin', headers: {} };
		if (method !== 'GET') {
			opts.headers['Content-Type'] = 'application/json';
			opts.body = JSON.stringify(body || {});
		}
		let res;
		try {
			res = await fetch(`${API}/${path}`, opts);
		} catch {
			throw new Error('Can’t reach the server. Check your connection and try again.');
		}
		let data = {};
		try {
			data = await res.json();
		} catch {}
		if (res.status === 401 && path !== 'login') {
			S.account = null;
			render();
		}
		if (!res.ok) throw Object.assign(new Error(data.error || `Something went wrong (${res.status}).`), { status: res.status, data });
		return data;
	}

	const money = (amount, currency) => {
		if (amount === null || amount === undefined) return null;
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
		} catch {
			return `${amount.toFixed(2)} ${currency || ''}`.trim();
		}
	};
	const shortDate = (iso) => {
		const d = new Date(iso);
		if (isNaN(d)) return '';
		const opts = { month: 'short', day: 'numeric' };
		if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
		return d.toLocaleDateString(undefined, opts);
	};
	const personOf = (id) => S.people.find((p) => p.id === id) || { id, name: 'Someone', color: '#6c6589' };
	const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
	const hostOf = (u) => {
		try {
			return new URL(u).hostname.replace(/^www\./, '');
		} catch {
			return '';
		}
	};

	function stars(priority) {
		const n = 4 - priority; // 1 → 3 stars
		return el(
			'span',
			{ class: 'stars', title: PRIORITY[priority], 'aria-label': PRIORITY[priority] },
			...[1, 2, 3].map((i) => el('span', { class: i <= n ? '' : 'off', 'aria-hidden': 'true', text: '★' }))
		);
	}

	const giftIcon = () => {
		const NS = 'http://www.w3.org/2000/svg';
		const s = document.createElementNS(NS, 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('class', 'noimg');
		s.setAttribute('aria-hidden', 'true');
		const p = document.createElementNS(NS, 'path');
		p.setAttribute('d', 'M20 7h-2.2A3 3 0 0012 3.8 3 3 0 006.2 7H4a1 1 0 00-1 1v3a1 1 0 001 1h1v8a1 1 0 001 1h12a1 1 0 001-1v-8h1a1 1 0 001-1V8a1 1 0 00-1-1zM15 5a1 1 0 010 2h-2V6a1 1 0 011-1h1zM9 5h1a1 1 0 011 1v1H9a1 1 0 010-2zM5 9h6v1H5zm2 3h4v7H7zm6 7v-7h4v7zm6-9h-6V9h6z');
		s.append(p);
		return s;
	};

	function itemImage(item) {
		const box = el('div', { class: 'gift-img' });
		const src = safeUrl(item.imageUrl);
		if (src) {
			const img = el('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
			img.addEventListener('error', () => img.replaceWith(giftIcon()));
			box.append(img);
		} else box.append(giftIcon());
		return box;
	}

	let toastTimer = 0;
	function toast(text, action) {
		clearTimeout(toastTimer);
		toastEl.replaceChildren(el('span', { text }));
		if (action) toastEl.append(el('button', { type: 'button', text: action.label, onclick: () => { toastEl.hidden = true; action.run(); } }));
		toastEl.hidden = false;
		toastTimer = setTimeout(() => (toastEl.hidden = true), action ? 7000 : 3500);
	}

	/* A <dialog> that removes itself when closed. build(dlg) returns its content. */
	function modal(build, { className } = {}) {
		const dlg = el('dialog', { class: className || null });
		dlg.append(build(dlg));
		dlg.addEventListener('close', () => dlg.remove());
		document.body.append(dlg);
		dlg.showModal();
		const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input, select, textarea, button');
		if (first) first.focus();
		return dlg;
	}

	function confirmBox({ title, body, ok = 'Delete', danger = true }) {
		return new Promise((resolve) => {
			let answer = false;
			const dlg = modal((d) =>
				el(
					'div',
					{ class: 'dlg' },
					el('h2', { text: title }),
					body ? el('p', { class: 'lede', text: body }) : null,
					el(
						'div',
						{ class: 'dlg-actions' },
						el('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => d.close() }),
						el('button', {
							type: 'button',
							class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
							text: ok,
							onclick: () => {
								answer = true;
								d.close();
							}
						})
					)
				)
			);
			dlg.addEventListener('close', () => resolve(answer));
		});
	}

	// Replace the page content, skipping empty slots (replaceChildren would print them as "null").
	const show = (...nodes) => app.replaceChildren(...nodes.flat().filter((n) => n !== null && n !== undefined && n !== false));

	const setMsg = (node, text, kind = 'error') => {
		node.textContent = text || '';
		node.className = `msg ${text ? kind : ''}`;
	};

	/* ---------- data ---------- */
	async function load() {
		const d = await api('list');
		S.people = d.people;
		S.items = d.items;
		S.compare = !!d.compare;
	}

	/* ---------- top band ---------- */
	function renderBand() {
		bandTools.replaceChildren();
		if (!S.account) return (bandTools.hidden = true);
		bandTools.hidden = false;
		if (S.account.role === 'owner') {
			const sel = el('select', { id: 'personaSel', 'aria-label': 'Wishing as' });
			for (const p of S.people) sel.append(el('option', { value: p.id, text: p.name, selected: S.persona === p.id }));
			if (S.people.length > 1) sel.append(el('option', { value: 'all', text: 'Everyone', selected: S.persona === 'all' }));
			sel.addEventListener('change', () => {
				S.persona = sel.value === 'all' ? 'all' : Number(sel.value);
				store.set('persona', S.persona);
				renderOwner();
			});
			if (S.people.length) bandTools.append(el('span', { class: 'persona' }, el('label', { for: 'personaSel', text: 'Wishing as' }), sel));
			bandTools.append(
				el('button', { type: 'button', class: 'band-btn', text: 'People', onclick: peopleDialog }),
				el('button', { type: 'button', class: 'band-btn', text: 'Shopper logins', onclick: shoppersDialog })
			);
		} else {
			bandTools.append(el('span', { class: 'who' }, 'Shopping as ', el('b', { text: S.account.name || S.account.email })));
		}
		bandTools.append(
			el('button', { type: 'button', class: 'band-btn', text: 'Passphrase', title: 'Change your passphrase', onclick: passphraseDialog }),
			el('button', { type: 'button', class: 'band-btn', text: 'Sign out', onclick: signOut })
		);
	}

	async function signOut() {
		try {
			await api('logout', { method: 'POST' });
		} catch {}
		S.account = null;
		S.items = [];
		S.people = [];
		render();
	}

	/* ---------- sign in ---------- */
	function renderSignIn() {
		const email = el('input', { class: 'input', type: 'email', name: 'email', autocomplete: 'username', required: true, autofocus: true });
		const pass = el('input', { class: 'input', type: 'password', name: 'passphrase', autocomplete: 'current-password', required: true });
		const msg = el('p', { class: 'msg', role: 'alert' });
		const btn = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Sign in' });
		const form = el(
			'form',
			{
				onsubmit: async (e) => {
					e.preventDefault();
					btn.disabled = true;
					setMsg(msg, '');
					try {
						const d = await api('login', { method: 'POST', body: { email: email.value, passphrase: pass.value } });
						S.account = d.account;
						await start();
					} catch (err) {
						setMsg(msg, err.message);
						btn.disabled = false;
						pass.select();
					}
				}
			},
			el('label', { class: 'field' }, el('span', { text: 'Email' }), email),
			el('label', { class: 'field' }, el('span', { text: 'Passphrase' }), pass),
			btn,
			msg
		);
		show(
			el(
				'section',
				{ class: 'signin' },
				el('h1', { text: 'Sign in' }),
				el('p', { class: 'verse', text: 'I wish I may, I wish I might…' }),
				form,
				el('p', { class: 'hint', text: 'Use the email and passphrase the family gave you.' })
			)
		);
		email.focus();
	}

	/* ================================================================== */
	/* Shoppers                                                            */
	/* ================================================================== */

	function shopperVisible() {
		const f = S.filters;
		const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
		const min = f.min === '' ? null : Number(f.min);
		const max = f.max === '' ? null : Number(f.max);
		let list = S.items.filter((it) => (S.tab === 'mine' ? !!it.purchasedAt : !it.purchasedAt));
		if (S.tab === 'list') {
			list = list.filter((it) => {
				if (f.people.length && !f.people.includes(it.personId)) return false;
				if (f.priority && it.priority !== Number(f.priority)) return false;
				if (min !== null && (it.price === null || it.price < min)) return false;
				if (max !== null && (it.price === null || it.price > max)) return false;
				if (words.length) {
					const hay = `${it.title} ${it.description} ${it.notes} ${it.siteName} ${personOf(it.personId).name}`.toLowerCase();
					if (!words.every((w) => hay.includes(w))) return false;
				}
				return true;
			});
		}
		const byNew = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id);
		const priceAsc = (a, b) => (a.price === null) - (b.price === null) || a.price - b.price || byNew(a, b);
		const sorts = {
			new: byNew,
			old: (a, b) => -byNew(a, b),
			priority: (a, b) => a.priority - b.priority || byNew(a, b),
			'price-asc': priceAsc,
			'price-desc': (a, b) => (a.price === null) - (b.price === null) || b.price - a.price || byNew(a, b),
			person: (a, b) => {
				const pa = S.people.findIndex((p) => p.id === a.personId);
				const pb = S.people.findIndex((p) => p.id === b.personId);
				return pa - pb || a.priority - b.priority || byNew(a, b);
			},
			name: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
		};
		const sort = S.tab === 'mine' ? (a, b) => (a.purchasedAt < b.purchasedAt ? 1 : -1) : sorts[f.sort] || byNew;
		return list.sort(sort);
	}

	function renderShopper() {
		const open = S.items.filter((i) => !i.purchasedAt).length;
		const mine = S.items.filter((i) => i.purchasedAt).length;
		const tab = (id, label, count) =>
			el(
				'button',
				{
					type: 'button',
					role: 'tab',
					class: 'tab',
					'aria-selected': String(S.tab === id),
					onclick: () => {
						S.tab = id;
						renderShopper();
					}
				},
				label,
				el('span', { class: 'count', text: `(${count})` })
			);
		const parts = [el('div', { class: 'tabs', role: 'tablist' }, tab('list', 'Wish list', open), tab('mine', 'My purchases', mine))];
		if (S.tab === 'list') parts.push(renderFilters());
		const grid = el('div', { class: 'grid', id: 'grid' });
		parts.push(el('p', { class: 'result-line', id: 'resultLine' }), grid);
		show(...parts);
		fillGrid();
	}

	function renderFilters() {
		const f = S.filters;
		const save = () => {
			store.set('filters', f);
			fillGrid();
		};
		const search = el('input', { class: 'input', type: 'search', placeholder: 'Search wishes', value: f.q, 'aria-label': 'Search wishes' });
		search.addEventListener('input', () => {
			f.q = search.value;
			save();
		});
		const prio = el(
			'select',
			{ class: 'select', 'aria-label': 'Priority' },
			el('option', { value: '', text: 'Any priority' }),
			...[1, 2, 3].map((p) => el('option', { value: p, text: `${'★'.repeat(4 - p)} ${PRIORITY[p]}`, selected: String(f.priority) === String(p) }))
		);
		prio.addEventListener('change', () => {
			f.priority = prio.value;
			save();
		});
		const num = (key, label) => {
			const i = el('input', { class: 'input', type: 'number', min: 0, step: 1, inputmode: 'decimal', placeholder: label, value: f[key], 'aria-label': `${label} price` });
			i.addEventListener('input', () => {
				f[key] = i.value;
				save();
			});
			return i;
		};
		const sort = el(
			'select',
			{ class: 'select', 'aria-label': 'Sort by' },
			...[
				['new', 'Newest first'],
				['old', 'Oldest first'],
				['priority', 'Most wanted first'],
				['price-asc', 'Price: low to high'],
				['price-desc', 'Price: high to low'],
				['person', 'By person'],
				['name', 'Name A–Z']
			].map(([v, t]) => el('option', { value: v, text: t, selected: f.sort === v }))
		);
		sort.addEventListener('change', () => {
			f.sort = sort.value;
			save();
		});

		const chips = el('div', { class: 'people-filter', role: 'group', 'aria-label': 'Show wishes for' });
		const paintChips = () => {
			chips.replaceChildren(el('span', { class: 'label', text: 'For' }));
			for (const p of S.people) {
				chips.append(
					el('button', {
						type: 'button',
						class: 'tag',
						style: { '--c': p.color },
						'aria-pressed': String(f.people.includes(p.id)),
						text: p.name,
						onclick: () => {
							f.people = f.people.includes(p.id) ? f.people.filter((x) => x !== p.id) : [...f.people, p.id];
							paintChips();
							save();
						}
					})
				);
			}
			if (f.people.length)
				chips.append(el('button', { type: 'button', class: 'tag clear', text: 'Everyone', onclick: () => { f.people = []; paintChips(); save(); } }));
		};
		paintChips();

		return el(
			'div',
			null,
			el(
				'div',
				{ class: 'filters' },
				el('label', { class: 'field search' }, el('span', { text: 'Search' }), search),
				el('label', { class: 'field' }, el('span', { text: 'Priority' }), prio),
				el('div', { class: 'field' }, el('span', { text: 'Price' }), el('div', { class: 'price-range' }, num('min', 'Min'), '–', num('max', 'Max'))),
				el('label', { class: 'field' }, el('span', { text: 'Sort' }), sort)
			),
			S.people.length > 1 ? chips : null
		);
	}

	function fillGrid() {
		const grid = $('#grid');
		const line = $('#resultLine');
		if (!grid) return;
		const list = shopperVisible();
		const total = S.items.filter((i) => (S.tab === 'mine' ? i.purchasedAt : !i.purchasedAt)).length;
		line.textContent = S.tab === 'list' && list.length !== total ? `Showing ${list.length} of ${total} wishes` : '';
		if (!list.length) {
			grid.replaceChildren(
				el(
					'div',
					{ class: 'empty', style: { gridColumn: '1 / -1' } },
					S.tab === 'mine'
						? [el('h2', { text: 'Nothing bought yet' }), el('p', { text: 'Gifts you mark as bought show up here, hidden from everyone else.' })]
						: total
							? [el('h2', { text: 'No wishes match' }), el('p', { text: 'Try clearing the search or widening the price range.' })]
							: [el('h2', { text: 'Every wish is granted' }), el('p', { text: 'Nothing left on the list right now. Check back later.' })]
				)
			);
			return;
		}
		grid.replaceChildren(...list.map(shopperCard));
	}

	function shopperCard(it) {
		const p = personOf(it.personId);
		const price = money(it.price, it.currency);
		const card = el(
			'article',
			{ class: 'gift', style: { '--c': p.color }, 'data-id': it.id },
			itemImage(it),
			el(
				'div',
				{ class: 'gift-body' },
				el('div', { class: 'gift-top' }, el('span', { class: 'who-tag', text: `For ${p.name}` }), stars(it.priority)),
				el('h3', { text: it.title }),
				it.description ? el('p', { class: 'desc', text: it.description }) : null,
				it.notes ? el('p', { class: 'notes', text: it.notes }) : null,
				el(
					'div',
					{ class: 'gift-meta' },
					price ? el('span', { class: 'price', text: price }) : el('span', { class: 'price unknown', text: 'Price not listed' }),
					el('span', { class: 'added', text: it.purchasedAt ? `Bought ${shortDate(it.purchasedAt)}` : `Added ${shortDate(it.createdAt)}` })
				),
				it.purchasedAt ? null : offersBlock(it),
				el('div', { class: 'gift-actions' }, ...shopperActions(it))
			)
		);
		return card;
	}

	function shopperActions(it) {
		const url = safeUrl(it.url);
		if (it.purchasedAt) {
			return [
				url ? el('a', { class: 'btn btn-sm', href: url, target: '_blank', rel: 'noopener noreferrer', text: 'View in shop' }) : null,
				el('button', { type: 'button', class: 'btn btn-sm btn-quiet', text: 'I didn’t buy it', onclick: () => undoPurchase(it) })
			];
		}
		return [
			url
				? el('button', { type: 'button', class: 'btn btn-star', text: `Buy${hostOf(url) ? ` at ${shortHost(url)}` : ''}`, onclick: () => goBuy(it) })
				: el('button', { type: 'button', class: 'btn btn-star', text: 'Mark as bought', onclick: () => askBought(it) })
		];
	}
	const shortHost = (u) => {
		const h = hostOf(u);
		if (/^[\d.]+$|:/.test(h)) return 'shop';
		const known = { 'amazon.com': 'Amazon', 'target.com': 'Target', 'walmart.com': 'Walmart', 'etsy.com': 'Etsy', 'ebay.com': 'eBay', 'bestbuy.com': 'Best Buy' };
		const base = h.split('.').slice(-2).join('.');
		return known[base] || (base.length <= 18 ? base : 'shop');
	};

	function goBuy(it) {
		window.open(it.url, '_blank', 'noopener,noreferrer');
		askBought(it);
	}

	function askBought(it) {
		const p = personOf(it.personId);
		const src = safeUrl(it.imageUrl);
		modal(
			(d) =>
				el(
					'div',
					{ class: 'dlg' },
					src ? el('img', { class: 'item-thumb', src, alt: '', referrerpolicy: 'no-referrer' }) : null,
					el('h2', { text: 'Did you buy it?' }),
					el('p', { text: `“${it.title}” for ${p.name}. If you bought it, we’ll take it off the list so nobody else buys it too. ${p.name} won’t be told.` }),
					el(
						'div',
						{ class: 'dlg-actions' },
						el('button', { type: 'button', class: 'btn', text: 'Not yet', onclick: () => d.close() }),
						el('button', {
							type: 'button',
							class: 'btn btn-primary',
							text: 'Yes, I bought it',
							autofocus: true,
							onclick: async (e) => {
								e.target.disabled = true;
								d.close();
								await markBought(it);
							}
						})
					)
				),
			{ className: 'bought-dlg' }
		);
	}

	async function markBought(it) {
		try {
			await api(`items/${it.id}/purchase`, { method: 'POST' });
			await fadeOut(it.id);
			it.purchasedAt = new Date().toISOString();
			renderShopper();
			toast(`Marked “${clip(it.title)}” as bought.`, { label: 'Undo', run: () => undoPurchase(it) });
		} catch (err) {
			if (err.data && err.data.taken) {
				S.items = S.items.filter((x) => x.id !== it.id);
				renderShopper();
				toast('Someone else already bought that one, so it’s off the list.');
			} else if (err.status === 404) {
				await refresh();
				toast('That wish was just removed from the list.');
			} else toast(err.message);
		}
	}

	async function undoPurchase(it) {
		try {
			await api(`items/${it.id}/purchase`, { method: 'DELETE' });
			it.purchasedAt = null;
			renderShopper();
			toast(`“${clip(it.title)}” is back on the list.`);
		} catch (err) {
			toast(err.message);
		}
	}

	/* ----- the same item at other stores (Google Shopping + eBay, looked up by the server) ----- */
	const ago = (iso) => {
		const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
		if (!(m >= 0)) return '';
		if (m < 2) return 'just now';
		if (m < 60) return `${m} min ago`;
		const h = Math.round(m / 60);
		if (h < 36) return `${h} hr ago`;
		return shortDate(iso);
	};
	const checking = new Set(); // item ids being looked up right now

	function offersBlock(it) {
		if (!S.compare) return null;
		const offers = it.offers || [];
		const busy = checking.has(it.id) || (!it.offersCheckedAt && Date.now() - Date.parse(it.lookingSince || it.createdAt) < 60000);
		const checkBtn = (label) =>
			el('button', { type: 'button', class: 'linkish', text: busy ? 'Checking…' : label, disabled: busy, onclick: () => checkOffers(it) });
		if (!offers.length) {
			return el(
				'div',
				{ class: 'offers offers-none' },
				busy ? el('span', { text: 'Looking for other stores…' }) : it.offersCheckedAt ? el('span', { text: 'No other stores found.' }) : null,
				!busy ? checkBtn(it.offersCheckedAt ? 'Check again' : 'Compare other stores') : null
			);
		}
		const isNew = (o) => !o.condition || /^(brand )?new$/i.test(o.condition);
		const best = offers.find(isNew) || offers[0]; // headline a new one; used ones are in the list
		const saving = it.price > 0 && best.price < it.price * 0.97 ? it.price - best.price : 0;
		const rows = offers.map((o) => {
			const a = el(
				'a',
				{ class: 'offer', href: o.link, target: '_blank', rel: 'noopener noreferrer', title: o.title },
				el('span', { class: 'offer-store', text: o.store }),
				!isNew(o) ? el('span', { class: 'offer-cond', text: o.condition }) : null,
				el('span', { class: 'offer-price', text: money(o.price, o.currency) }),
				o.shipping ? el('span', { class: 'offer-ship', text: o.shipping }) : null
			);
			// Shoppers buying from another store still get asked "Did you buy it?"
			if (S.account.role === 'shopper') a.addEventListener('click', () => setTimeout(() => askBought(it), 50));
			return el('li', null, a);
		});
		return el(
			'details',
			{ class: 'offers' },
			el(
				'summary',
				null,
				el('span', null, `${offers.length === 1 ? 'Also at' : 'From'} `, el('b', { text: money(best.price, best.currency) }), ` at ${best.store}${isNew(best) ? '' : ` (${best.condition.toLowerCase()})`}`),
				saving ? el('span', { class: 'offer-save', text: `${money(saving, it.currency)} less` }) : null
			),
			el('ul', null, ...rows),
			el(
				'p',
				{ class: 'offers-foot' },
				el('span', { text: `Prices from Google Shopping and eBay, ${ago(it.offersCheckedAt)}. Check the size and model before buying.` }),
				' ',
				checkBtn('Check again')
			)
		);
	}

	async function checkOffers(it) {
		checking.add(it.id);
		rerender();
		try {
			const r = await api(`items/${it.id}/offers`, { method: 'POST' });
			it.offers = r.offers;
			it.offersCheckedAt = r.checkedAt;
			if (r.error) toast(`Some stores couldn’t be checked. ${r.error}`);
			else if (r.cached && S.account.role === 'shopper') toast('Those prices were checked recently.');
		} catch (err) {
			toast(err.message);
		} finally {
			checking.delete(it.id);
			rerender(it.id);
		}
	}
	// Redraw without losing which "other stores" lists are open.
	function rerender(openId) {
		if (document.querySelector('dialog[open]')) return;
		const open = new Set([...document.querySelectorAll('.gift')].filter((c) => c.querySelector('details.offers[open]')).map((c) => c.dataset.id));
		if (openId) open.add(String(openId));
		if (S.account.role === 'shopper') fillGrid();
		else renderOwner();
		for (const id of open) {
			const d = document.querySelector(`.gift[data-id="${id}"] details.offers`);
			if (d) d.open = true;
		}
	}

	const clip = (s) => (s.length > 40 ? s.slice(0, 38) + '…' : s);
	function fadeOut(id) {
		const card = document.querySelector(`.gift[data-id="${id}"]`);
		if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
		card.classList.add('leaving');
		return new Promise((r) => setTimeout(r, 320));
	}

	/* ================================================================== */
	/* Owners                                                              */
	/* ================================================================== */

	function ensurePersona() {
		if (S.persona === 'all' && S.people.length > 1) return;
		if (!S.people.some((p) => p.id === S.persona)) S.persona = S.people.length ? S.people[0].id : null;
	}

	function renderOwner() {
		ensurePersona();
		renderBand();
		if (!S.people.length) {
			show(
				el(
					'section',
					{ class: 'empty' },
					el('h2', { text: 'Who’s wishing?' }),
					el('p', { text: 'Add the people whose wishes go on this list. You switch between them to add each person’s items.' }),
					el('p', null, el('button', { type: 'button', class: 'btn btn-primary', text: 'Add people', onclick: peopleDialog }))
				)
			);
			return;
		}
		const all = S.persona === 'all';
		const who = all ? null : personOf(S.persona);
		const items = S.items.filter((it) => all || it.personId === S.persona);
		const sorters = {
			new: (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
			priority: (a, b) => a.priority - b.priority || (a.createdAt < b.createdAt ? 1 : -1),
			'price-asc': (a, b) => (a.price === null) - (b.price === null) || a.price - b.price,
			name: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
		};
		items.sort(sorters[S.ownerSort] || sorters.new);

		const linkInput = el('input', { class: 'input', type: 'url', placeholder: 'Paste a link to the item (Amazon, a shop page…)', 'aria-label': 'Link to the item' });
		const quick = el(
			'form',
			{
				class: 'quick-add',
				onsubmit: (e) => {
					e.preventDefault();
					itemDialog({ url: linkInput.value.trim(), personId: all ? S.people[0].id : S.persona }, { fetchNow: !!linkInput.value.trim() });
					linkInput.value = '';
				}
			},
			linkInput,
			el('button', { class: 'btn btn-primary', type: 'submit', text: 'Add a wish' })
		);
		const sortSel = el(
			'select',
			{ class: 'select', 'aria-label': 'Sort' },
			...[
				['new', 'Newest first'],
				['priority', 'Most wanted first'],
				['price-asc', 'Price: low to high'],
				['name', 'Name A–Z']
			].map(([v, t]) => el('option', { value: v, text: t, selected: S.ownerSort === v }))
		);
		sortSel.addEventListener('change', () => {
			S.ownerSort = sortSel.value;
			store.set('ownerSort', S.ownerSort);
			renderOwner();
		});

		show(
			el(
				'div',
				{ class: 'owner-head' },
				el(
					'div',
					null,
					el('h1', { text: all ? 'Everyone’s wishes' : `${who.name}’s wishes` }),
					el('p', { class: 'lede', text: all ? 'Every wish on the list.' : `Add, edit or remove ${who.name}’s wishes. Shoppers see the list, but nobody here sees what’s been bought.` })
				)
			),
			quick,
			items.length > 1 ? el('div', { class: 'owner-sort' }, el('span', { text: `${items.length} wishes` }), sortSel) : null,
			items.length
				? el('div', { class: 'grid' }, ...items.map(ownerCard))
				: el('div', { class: 'empty' }, el('h2', { text: 'No wishes yet' }), el('p', { text: 'Paste a link above, or add a wish without one.' }))
		);
	}

	function ownerCard(it) {
		const p = personOf(it.personId);
		const price = money(it.price, it.currency);
		const url = safeUrl(it.url);
		return el(
			'article',
			{ class: 'gift', style: { '--c': p.color }, 'data-id': it.id },
			itemImage(it),
			el(
				'div',
				{ class: 'gift-body' },
				el('div', { class: 'gift-top' }, el('span', { class: 'who-tag', text: p.name }), stars(it.priority)),
				el('h3', { text: it.title }),
				it.notes ? el('p', { class: 'notes', text: it.notes }) : null,
				el(
					'div',
					{ class: 'gift-meta' },
					price ? el('span', { class: 'price', text: price }) : el('span', { class: 'price unknown', text: 'No price' }),
					url ? el('a', { class: 'added', href: url, target: '_blank', rel: 'noopener noreferrer', text: hostOf(url) }) : el('span', { class: 'added', text: `Added ${shortDate(it.createdAt)}` })
				),
				offersBlock(it),
				el(
					'div',
					{ class: 'gift-actions' },
					el('button', { type: 'button', class: 'btn btn-sm', text: 'Edit', onclick: () => itemDialog(it) }),
					el('button', { type: 'button', class: 'btn btn-sm btn-danger', text: 'Delete', onclick: () => deleteItem(it) })
				)
			)
		);
	}

	async function deleteItem(it) {
		const ok = await confirmBox({ title: 'Delete this wish?', body: `“${it.title}” comes off ${personOf(it.personId).name}’s list for everyone.` });
		if (!ok) return;
		try {
			await api(`items/${it.id}`, { method: 'DELETE' });
			S.items = S.items.filter((x) => x.id !== it.id);
			renderOwner();
			toast('Wish deleted.');
		} catch (err) {
			toast(err.message);
		}
	}

	/* ----- add / edit a wish ----- */
	function itemDialog(item, { fetchNow = false } = {}) {
		const editing = !!item.id;
		const v = {
			personId: item.personId,
			url: item.url || '',
			title: item.title || '',
			imageUrl: item.imageUrl || '',
			description: item.description || '',
			price: item.price ?? '',
			currency: item.currency || 'USD',
			priority: item.priority || 2,
			notes: item.notes || '',
			siteName: item.siteName || '',
			searchQuery: item.searchQuery || ''
		};
		let priceChecked = false;

		const person = el('select', { class: 'select', name: 'person' }, ...S.people.map((p) => el('option', { value: p.id, text: p.name, selected: p.id === v.personId })));
		const url = el('input', { class: 'input', type: 'url', name: 'url', value: v.url, placeholder: 'https://…' });
		const fetchBtn = el('button', { type: 'button', class: 'btn', text: 'Get details' });
		const fetchMsg = el('p', { class: 'msg', role: 'status' });
		const title = el('input', { class: 'input', name: 'title', value: v.title, required: true, maxlength: 300 });
		const price = el('input', { class: 'input', name: 'price', value: v.price, inputmode: 'decimal', placeholder: 'e.g. 24.99' });
		const currency = el('select', { class: 'select', name: 'currency' }, ...['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'JPY', 'MXN', 'INR'].map((c) => el('option', { value: c, text: c, selected: c === v.currency })));
		if (![...currency.options].some((o) => o.value === v.currency)) currency.append(el('option', { value: v.currency, text: v.currency, selected: true }));
		const imageUrl = el('input', { class: 'input', type: 'url', name: 'image', value: v.imageUrl, placeholder: 'https://… (picture link)' });
		const thumb = el('div', { class: 'thumb' });
		const paintThumb = () => {
			const src = safeUrl(imageUrl.value.trim());
			thumb.replaceChildren(src ? el('img', { src, alt: '', referrerpolicy: 'no-referrer' }) : giftIcon());
		};
		imageUrl.addEventListener('input', paintThumb);
		paintThumb();
		const description = el('textarea', { class: 'textarea', name: 'description', maxlength: 2000, rows: 3 });
		description.value = v.description;
		const notes = el('input', { class: 'input', name: 'notes', value: v.notes, maxlength: 1000, placeholder: 'Size, color, “any brand is fine”…' });
		const prio = el(
			'div',
			{ class: 'prio-pick', role: 'radiogroup', 'aria-label': 'How much do you want it?' },
			...[1, 2, 3].map((p) =>
				el('label', null, el('input', { type: 'radio', name: 'prio', value: p, checked: v.priority === p }), stars(p), PRIORITY[p])
			)
		);
		const searchQuery = el('input', { class: 'input', name: 'search', value: v.searchQuery, maxlength: 150, placeholder: 'Blank = use the name, e.g. “Kindle Paperwhite 16GB”' });
		const msg = el('p', { class: 'msg', role: 'alert' });
		const save = el('button', { type: 'submit', class: 'btn btn-primary', text: editing ? 'Save changes' : 'Add wish' });

		async function getDetails() {
			const link = url.value.trim();
			if (!link) return setMsg(fetchMsg, 'Paste the item’s link first.');
			fetchBtn.disabled = true;
			setMsg(fetchMsg, 'Reading the page…', 'ok');
			try {
				const r = await api('preview', { method: 'POST', body: { url: link } });
				if (r.title) title.value = r.title;
				if (r.image) imageUrl.value = r.image;
				if (r.description && !description.value.trim()) description.value = r.description;
				if (r.price !== null && r.price !== undefined) {
					price.value = r.price;
					priceChecked = true;
				}
				if (r.currency) {
					if (![...currency.options].some((o) => o.value === r.currency)) currency.append(el('option', { value: r.currency, text: r.currency }));
					currency.value = r.currency;
				}
				v.siteName = r.siteName || '';
				paintThumb();
				const missing = [!r.title && 'name', !r.image && 'picture', (r.price === null || r.price === undefined) && 'price'].filter(Boolean);
				setMsg(fetchMsg, missing.length ? `Got what we could. Fill in the ${missing.join(' and ')} by hand.` : 'Details filled in. Check them before saving.', missing.length ? 'error' : 'ok');
			} catch (err) {
				setMsg(fetchMsg, err.message);
			} finally {
				fetchBtn.disabled = false;
			}
		}
		fetchBtn.addEventListener('click', getDetails);

		const dlg = modal((d) =>
			el(
				'form',
				{
					class: 'dlg',
					onsubmit: async (e) => {
						e.preventDefault();
						setMsg(msg, '');
						save.disabled = true;
						const body = {
							personId: Number(person.value),
							url: url.value.trim(),
							title: title.value.trim(),
							imageUrl: imageUrl.value.trim(),
							description: description.value.trim(),
							price: price.value.trim(),
							currency: currency.value,
							priority: Number((prio.querySelector('input:checked') || {}).value || 2),
							notes: notes.value.trim(),
							siteName: v.siteName,
							searchQuery: searchQuery.value.trim(),
							priceChecked
						};
						try {
							const r = editing ? await api(`items/${item.id}`, { method: 'PUT', body }) : await api('items', { method: 'POST', body });
							const same = editing && r.item.title === item.title && r.item.searchQuery === item.searchQuery;
							r.item.offers = same ? item.offers || [] : [];
							r.item.offersCheckedAt = same ? item.offersCheckedAt : null;
							if (!same && S.compare) {
								r.item.lookingSince = new Date().toISOString(); // shows "Looking…" while the server checks
								setTimeout(refresh, 8000);
								setTimeout(refresh, 20000);
							}
							S.items = editing ? S.items.map((x) => (x.id === item.id ? r.item : x)) : [r.item, ...S.items];
							d.close();
							if (!editing && S.persona !== 'all') S.persona = r.item.personId;
							store.set('persona', S.persona);
							renderOwner();
							toast(editing ? 'Changes saved.' : 'Wish added.');
						} catch (err) {
							setMsg(msg, err.message);
							save.disabled = false;
						}
					}
				},
				el('h2', { text: editing ? 'Edit wish' : 'Add a wish' }),
				el('label', { class: 'field' }, el('span', { text: 'Link to the item' }), el('div', { class: 'fetch-row' }, url, fetchBtn), fetchMsg),
				el('label', { class: 'field' }, el('span', { text: 'Name' }), title),
				el('div', { class: 'preview-img' }, thumb, el('label', { class: 'field' }, el('span', { text: 'Picture' }), imageUrl)),
				el('div', { class: 'row3' }, el('label', { class: 'field' }, el('span', { text: 'For' }), person), el('label', { class: 'field' }, el('span', { text: 'Price' }), price), el('label', { class: 'field' }, el('span', { text: 'Currency' }), currency)),
				el('div', { class: 'field' }, el('span', { text: 'How much do you want it?' }), prio),
				el('label', { class: 'field' }, el('span', { text: 'Notes for shoppers' }), notes),
				el('label', { class: 'field' }, el('span', { text: 'Description' }), description),
				S.compare ? el('label', { class: 'field' }, el('span', { text: 'Words to search other stores with' }), searchQuery) : null,
				msg,
				el('div', { class: 'dlg-actions' }, el('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => d.close() }), save)
			)
		);
		if (fetchNow) getDetails();
		else (editing ? title : url).focus();
		return dlg;
	}

	/* ----- people (personas) ----- */
	function peopleDialog() {
		const listEl = el('ul', { class: 'list' });
		const msg = el('p', { class: 'msg', role: 'alert' });
		const paint = () => {
			listEl.replaceChildren(
				...S.people.map((p) => {
					const name = el('input', { class: 'input grow', value: p.name, 'aria-label': 'Name', maxlength: 60 });
					const color = el('input', { class: 'swatch', type: 'color', value: p.color, 'aria-label': `${p.name}’s color` });
					const commit = async () => {
						if (name.value.trim() === p.name && color.value === p.color) return;
						try {
							const r = await api(`people/${p.id}`, { method: 'PUT', body: { name: name.value, color: color.value } });
							Object.assign(p, r.person);
							setMsg(msg, 'Saved.', 'ok');
							renderOwner();
						} catch (err) {
							setMsg(msg, err.message);
						}
					};
					name.addEventListener('change', commit);
					color.addEventListener('change', commit);
					const count = S.items.filter((i) => i.personId === p.id).length;
					return el(
						'li',
						null,
						color,
						name,
						el('small', { text: `${count} wish${count === 1 ? '' : 'es'}` }),
						el('button', {
							type: 'button',
							class: 'btn btn-sm btn-danger',
							text: 'Remove',
							onclick: async () => {
								const ok = await confirmBox({ title: `Remove ${p.name}?`, body: count ? `Their ${count} wish${count === 1 ? '' : 'es'} will be deleted too.` : 'They have no wishes on the list.', ok: 'Remove' });
								if (!ok) return;
								try {
									await api(`people/${p.id}`, { method: 'DELETE' });
									S.people = S.people.filter((x) => x.id !== p.id);
									S.items = S.items.filter((i) => i.personId !== p.id);
									paint();
									renderOwner();
								} catch (err) {
									setMsg(msg, err.message);
								}
							}
						})
					);
				})
			);
			if (!S.people.length) listEl.append(el('li', null, el('span', { class: 'grow', text: 'Nobody yet.' })));
		};
		paint();
		const newName = el('input', { class: 'input', placeholder: 'Name', maxlength: 60, 'aria-label': 'New person’s name' });
		const add = el(
			'form',
			{
				class: 'pass-row',
				onsubmit: async (e) => {
					e.preventDefault();
					if (!newName.value.trim()) return newName.focus();
					try {
						const color = PALETTE[S.people.length % PALETTE.length];
						const r = await api('people', { method: 'POST', body: { name: newName.value, color } });
						S.people.push(r.person);
						if (S.persona === null) S.persona = r.person.id;
						newName.value = '';
						setMsg(msg, '');
						paint();
						renderOwner();
						newName.focus();
					} catch (err) {
						setMsg(msg, err.message);
					}
				}
			},
			newName,
			el('button', { type: 'submit', class: 'btn btn-primary', text: 'Add person' })
		);
		modal((d) =>
			el(
				'div',
				{ class: 'dlg' },
				el('h2', { text: 'People on the list' }),
				el('p', { class: 'lede', text: 'Each person gets their own wishes and color. Changes save as you go.' }),
				listEl,
				add,
				msg,
				el('div', { class: 'dlg-actions' }, el('button', { type: 'button', class: 'btn', text: 'Done', onclick: () => d.close() }))
			)
		);
		newName.focus();
	}

	/* ----- shopper logins ----- */
	const suggestPassphrase = () => {
		const pick = () => WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length];
		return `${pick()} ${pick()} ${pick()}`;
	};

	async function shoppersDialog() {
		const listEl = el('ul', { class: 'list' });
		const msg = el('p', { class: 'msg', role: 'alert' });
		let shoppers = [];
		const paint = () => {
			listEl.replaceChildren(
				...shoppers.map((s) =>
					el(
						'li',
						null,
						el(
							'div',
							{ class: 'grow' },
							el('b', { text: s.name || s.email }),
							el('small', { text: `${s.name ? s.email + ' · ' : ''}${s.last_login_at ? 'last signed in ' + shortDate(s.last_login_at) : 'hasn’t signed in yet'}` })
						),
						el('button', { type: 'button', class: 'btn btn-sm', text: 'New passphrase', onclick: () => resetPass(s) }),
						el('button', {
							type: 'button',
							class: 'btn btn-sm btn-danger',
							text: 'Remove',
							onclick: async () => {
								const ok = await confirmBox({ title: `Remove ${s.name || s.email}?`, body: 'They won’t be able to sign in. Anything they marked as bought stays off the list.', ok: 'Remove' });
								if (!ok) return;
								try {
									shoppers = (await api(`shoppers/${s.id}`, { method: 'DELETE' })).shoppers;
									paint();
								} catch (err) {
									setMsg(msg, err.message);
								}
							}
						})
					)
				)
			);
			if (!shoppers.length) listEl.append(el('li', null, el('span', { class: 'grow', text: 'No shopper logins yet. Add one below.' })));
		};
		async function resetPass(s) {
			const pass = suggestPassphrase();
			const ok = await confirmBox({ title: 'Give a new passphrase?', body: `${s.name || s.email}’s new passphrase will be “${pass}”. They’ll be signed out until they use it.`, ok: 'Set passphrase', danger: false });
			if (!ok) return;
			try {
				shoppers = (await api(`shoppers/${s.id}`, { method: 'PUT', body: { passphrase: pass } })).shoppers;
				paint();
				setMsg(msg, `New passphrase for ${s.email}: “${pass}”. Pass it on to them.`, 'ok');
			} catch (err) {
				setMsg(msg, err.message);
			}
		}

		const email = el('input', { class: 'input', type: 'email', placeholder: 'Email', 'aria-label': 'Shopper email', required: true });
		const name = el('input', { class: 'input', placeholder: 'Name (e.g. Aunt Sue)', 'aria-label': 'Shopper name', maxlength: 80 });
		const pass = el('input', { class: 'input', value: suggestPassphrase(), 'aria-label': 'Passphrase', required: true, minlength: 6 });
		const form = el(
			'form',
			{
				class: 'add-row',
				onsubmit: async (e) => {
					e.preventDefault();
					try {
						const given = pass.value;
						shoppers = (await api('shoppers', { method: 'POST', body: { email: email.value, name: name.value, passphrase: given } })).shoppers;
						setMsg(msg, `Added ${email.value.trim()}. Their passphrase is “${given}”. Pass it on with the site address.`, 'ok');
						email.value = name.value = '';
						pass.value = suggestPassphrase();
						paint();
					} catch (err) {
						setMsg(msg, err.message);
					}
				}
			},
			email,
			name,
			el('div', { class: 'pass-row full' }, pass, el('button', { type: 'button', class: 'btn', text: 'Suggest', onclick: () => (pass.value = suggestPassphrase()) })),
			el('button', { type: 'submit', class: 'btn btn-primary full', text: 'Add shopper' })
		);

		modal((d) =>
			el(
				'div',
				{ class: 'dlg' },
				el('h2', { text: 'Shopper logins' }),
				el('p', { class: 'lede', text: 'Shoppers sign in with an email and passphrase you give them. They see every wish, but not this page.' }),
				listEl,
				el('p', { class: 'subhead', text: 'Add a shopper' }),
				form,
				msg,
				el('div', { class: 'dlg-actions' }, el('button', { type: 'button', class: 'btn', text: 'Done', onclick: () => d.close() }))
			)
		);
		try {
			shoppers = (await api('shoppers')).shoppers;
		} catch (err) {
			setMsg(msg, err.message);
		}
		paint();
	}

	/* ----- change your own passphrase ----- */
	function passphraseDialog() {
		const cur = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true });
		const next = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', required: true, minlength: 6 });
		const msg = el('p', { class: 'msg', role: 'alert' });
		modal((d) =>
			el(
				'form',
				{
					class: 'dlg',
					onsubmit: async (e) => {
						e.preventDefault();
						try {
							await api('passphrase', { method: 'POST', body: { current: cur.value, next: next.value } });
							d.close();
							toast('Passphrase changed. Other devices are signed out.');
						} catch (err) {
							setMsg(msg, err.message);
						}
					}
				},
				el('h2', { text: 'Change your passphrase' }),
				S.account.role === 'owner' ? el('p', { class: 'lede', text: 'This is the shared family login, so let the other owners know.' }) : null,
				el('label', { class: 'field' }, el('span', { text: 'Current passphrase' }), cur),
				el('label', { class: 'field' }, el('span', { text: 'New passphrase' }), next, el('small', { text: 'At least 6 characters. A few words is easy to remember.' })),
				msg,
				el('div', { class: 'dlg-actions' }, el('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => d.close() }), el('button', { type: 'submit', class: 'btn btn-primary', text: 'Change passphrase' }))
			)
		);
	}

	/* ================================================================== */
	/* Startup                                                             */
	/* ================================================================== */

	function render() {
		renderBand();
		if (!S.account) return renderSignIn();
		if (S.account.role === 'owner') renderOwner();
		else renderShopper();
	}

	async function refresh() {
		if (!S.account) return;
		try {
			await load();
			if (document.querySelector('dialog[open]')) return; // don't redraw under an open dialog
			if (S.account.role === 'shopper') {
				renderShopper();
			} else renderOwner();
		} catch {}
	}

	async function start() {
		try {
			await load();
		} catch (err) {
			show(el('div', { class: 'empty' }, el('h2', { text: 'Couldn’t load the list' }), el('p', { text: err.message })));
			return;
		}
		if (S.account.role === 'owner') {
			S.persona = store.get('persona', null);
			S.ownerSort = store.get('ownerSort', 'new');
		} else {
			S.filters = { ...S.filters, ...store.get('filters', {}) };
			S.filters.people = (S.filters.people || []).filter((id) => S.people.some((p) => p.id === id));
		}
		render();
	}

	// Shoppers: pick up other people's purchases when coming back to the tab, and every 2 minutes.
	let lastRefresh = 0;
	const maybeRefresh = () => {
		if (S.account && S.account.role === 'shopper' && Date.now() - lastRefresh > 15000 && !document.hidden) {
			lastRefresh = Date.now();
			refresh();
		}
	};
	window.addEventListener('focus', maybeRefresh);
	document.addEventListener('visibilitychange', maybeRefresh);
	setInterval(() => {
		lastRefresh = 0;
		maybeRefresh();
	}, 120000);

	(async () => {
		try {
			S.account = (await api('me')).account;
		} catch (err) {
			show(el('div', { class: 'empty' }, el('h2', { text: 'Couldn’t reach the server' }), el('p', { text: err.message })));
			return;
		}
		if (S.account) await start();
		else render();
	})();
})();
