/* Happy Theta — sign-in gate, guest preview and save syncing, shared by every section of the site
   (phys/, teacher/, apps/). Plain script, no build step, no dependencies.

   Dashboards:  <script src="../shared/gate.js"></script> then
                HTGate.start({ section: 'teacher' }).then((ctx) => …)   // shows the sign-in screen first
   Tool pages:  <script src="../shared/gate.js" data-gate="tool" data-section="teacher"></script>
                followed by the page's own scripts written as
                <script type="text/x-ht-deferred" data-src="js/app.js"></script>
                The gate decides signed-in vs guest, syncs, and only then runs those scripts.

   How saving works. Every tool keeps its saves in localStorage under "happytheta:…" (core.js HT.files).
   That set of keys is the "space" the page sees. There is one space per person using this browser:
     guest       — preview mode: never leaves this browser
     u:<id>      — a signed-in account: a local copy, synced with the server (/api/docs)
   Switching moves the keys aside ("htstash:<space>:…") and brings the other space's keys back, so the
   tools themselves never need to know. Signing out deletes the account's local copy (school computers
   are shared); the server still has it. */
(function () {
	'use strict';
	if (window.HTGate) return;

	const script = document.currentScript;
	const SITE = new URL('../', script.src).href; // shared/gate.js → site root
	const API = SITE + 'api/';
	const PREFIX = 'happytheta:';
	const SAVE_PREFIX = 'happytheta:save:';
	const META_KEY = 'happytheta:sync:meta'; // lives inside the space, so it moves with it
	const SPACE_KEY = 'htsync:space';
	const GUEST_KEY = (section) => 'htsync:guest:' + section;
	const STASH = (space) => 'htstash:' + space + ':';

	const SECTIONS = {
		phys: { name: 'Happy Theta Physics', short: 'Physics', home: 'phys/index.html', tools: ['fbd', 'energy', 'motion', 'graph'] },
		teacher: { name: 'Teacher Tools', short: 'Teacher tools', home: 'teacher/index.html', tools: ['scheduler', 'schedtemplate', 'mindmap'], teacherOnly: true },
		apps: { name: 'My Apps', short: 'My apps', home: 'apps/index.html', tools: ['marks'] }
	};
	const TOOL_NAMES = { fbd: 'Free Body Diagram', energy: 'Energy Diagram', motion: 'Motion Diagram', graph: 'Graph Maker', scheduler: 'Theta Scheduler', schedtemplate: 'Scheduler template', mindmap: 'Theta Maps', marks: 'Theta Marks' };

	/* ---------------- small helpers ---------------- */
	const ls = {
		get(k) {
			try {
				return localStorage.getItem(k);
			} catch {
				return null;
			}
		},
		set(k, v) {
			try {
				localStorage.setItem(k, v);
				return true;
			} catch {
				return false;
			}
		},
		del(k) {
			try {
				localStorage.removeItem(k);
			} catch {}
		},
		keys(prefix) {
			const out = [];
			try {
				for (let i = 0; i < localStorage.length; i++) {
					const k = localStorage.key(i);
					if (k && k.startsWith(prefix)) out.push(k);
				}
			} catch {}
			return out;
		}
	};
	const json = (s, d) => {
		try {
			return s ? JSON.parse(s) : d;
		} catch {
			return d;
		}
	};

	function el(tag, attrs, ...kids) {
		const n = document.createElement(tag);
		for (const [k, v] of Object.entries(attrs || {})) {
			if (v === null || v === undefined || v === false) continue;
			if (k === 'class') n.className = v;
			else if (k === 'text') n.textContent = v;
			else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
			else n.setAttribute(k, v === true ? '' : v);
		}
		for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : String(c));
		return n;
	}

	// Styles for everything the gate draws (prefixed htg-).
	(function addCss() {
		if (document.querySelector('link[data-htg]')) return;
		const l = document.createElement('link');
		l.rel = 'stylesheet';
		l.href = new URL('gate.css', script.src).href;
		l.dataset.htg = '';
		document.head.append(l);
	})();

	/* ---------------- API ---------------- */
	async function api(path, { method = 'GET', body, timeout = 15000, keepalive = false } = {}) {
		if (location.protocol === 'file:') throw Object.assign(new Error('This page is open as a file, so it can’t reach the server.'), { status: 0, offline: true });
		const ctl = new AbortController();
		const timer = setTimeout(() => ctl.abort(), timeout);
		let res;
		try {
			res = await fetch(API + path, {
				method,
				credentials: 'same-origin',
				headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
				body: method === 'GET' ? undefined : JSON.stringify(body || {}),
				signal: ctl.signal,
				keepalive
			});
		} catch {
			throw Object.assign(new Error('Can’t reach the server. Check your connection and try again.'), { status: 0, offline: true });
		} finally {
			clearTimeout(timer);
		}
		let data = {};
		try {
			data = await res.json();
		} catch {}
		if (!res.ok) {
			// 404/405/5xx with no JSON error = the site is up but the API isn't running behind it
			const noApi = !data.error && (res.status === 404 || res.status === 405 || res.status >= 500);
			throw Object.assign(new Error(data.error || (noApi ? 'The site’s server isn’t running right now.' : `Server error (${res.status}).`)), {
				status: res.status,
				data,
				offline: noApi
			});
		}
		return data;
	}

	/* ---------------- spaces ---------------- */
	const currentSpace = () => ls.get(SPACE_KEY);

	function moveKeys(fromPrefix, toPrefix) {
		for (const k of ls.keys(fromPrefix)) {
			const v = ls.get(k);
			if (v !== null && ls.set(toPrefix + k.slice(fromPrefix.length), v)) ls.del(k);
		}
	}

	/* Make `space` the one the tools see. Work saved before accounts existed (no space recorded yet)
	   counts as guest work. */
	function useSpace(space) {
		let cur = currentSpace();
		if (cur === space) return;
		if (!cur && ls.keys(PREFIX).length) cur = 'guest';
		if (cur) moveKeys(PREFIX, STASH(cur));
		else for (const k of ls.keys(PREFIX)) ls.del(k);
		moveKeys(STASH(space), PREFIX);
		ls.set(SPACE_KEY, space);
	}

	/* Delete an account's local copy (on sign-out). */
	function forgetSpace(space) {
		if (currentSpace() === space) {
			for (const k of ls.keys(PREFIX)) ls.del(k);
			ls.del(SPACE_KEY);
		}
		for (const k of ls.keys(STASH(space))) ls.del(k);
	}

	// Another tab switched accounts / modes: this page's view of storage is stale.
	let pageSpace = null;
	window.addEventListener('storage', (e) => {
		if (e.key !== SPACE_KEY || !pageSpace || e.newValue === pageSpace) return;
		pageSpace = null;
		document.body.append(
			el('div', { class: 'htg-veil' }, el('div', { class: 'htg-card htg-small' }, el('h2', { text: 'Switched in another tab' }), el('p', { text: 'You signed in, signed out or started a guest preview in another tab. Reloading this page…' })))
		);
		setTimeout(() => location.reload(), 1200);
	});

	/* ---------------- sync (signed-in space only) ---------------- */
	const Sync = {
		active: false,
		allowed: [], // tools the server stores for this account
		state: 'idle', // idle | saving | offline | error
		message: '',
		listeners: new Set(),
		timer: null,
		chain: Promise.resolve()
	};
	const meta = () => Object.assign({ revs: {}, dirty: {} }, json(ls.get(META_KEY), {}));
	const setMeta = (m) => ls.set(META_KEY, JSON.stringify(m));
	const keyOf = (tool, id) => tool + ':' + id;
	const saveKey = (tool, id) => SAVE_PREFIX + tool + ':' + id;
	function localSaves() {
		const out = new Map();
		for (const k of ls.keys(SAVE_PREFIX)) {
			const rest = k.slice(SAVE_PREFIX.length);
			const i = rest.indexOf(':');
			if (i > 0) out.set(rest, { tool: rest.slice(0, i), id: rest.slice(i + 1) });
		}
		return out;
	}
	function setState(state, message = '') {
		Sync.state = state;
		Sync.message = message;
		Sync.listeners.forEach((fn) => fn(state, message));
	}
	const pendingCount = () => Object.keys(meta().dirty).length;

	function mark(tool, id, kind) {
		if (!Sync.active || !Sync.allowed.includes(tool)) return;
		const m = meta();
		m.dirty[keyOf(tool, id)] = kind;
		setMeta(m);
		clearTimeout(Sync.timer);
		setState('saving');
		Sync.timer = setTimeout(() => queue(pushAll), 1200);
	}
	const queue = (fn) => (Sync.chain = Sync.chain.then(fn).catch((err) => console.warn('sync', err)));

	/* Two computers changed the same save: keep the server's version under the original id and this
	   computer's version as a copy, so nothing is lost. */
	async function keepBoth(tool, id, serverRev) {
		const m = meta();
		const k = keyOf(tool, id);
		const mine = json(ls.get(saveKey(tool, id)), null);
		if (mine) {
			const copyId = 's_' + Math.random().toString(36).slice(2, 10);
			const copy = { ...mine, id: copyId, meta: { ...(mine.meta || {}), title: (mine.meta?.title || 'Untitled') + ' (this computer’s copy)' } };
			ls.set(saveKey(tool, copyId), JSON.stringify(copy));
			m.dirty[keyOf(tool, copyId)] = 'put';
		}
		const r = await api(`docs/${tool}/${encodeURIComponent(id)}`);
		if (r.doc) ls.set(saveKey(tool, id), JSON.stringify(r.doc));
		else ls.del(saveKey(tool, id));
		m.revs[k] = r.rev ?? serverRev;
		delete m.dirty[k];
		setMeta(m);
	}

	async function pushOne(k, kind) {
		const i = k.indexOf(':');
		const tool = k.slice(0, i);
		const id = k.slice(i + 1);
		const m = meta();
		const baseRev = m.revs[k] || 0;
		try {
			if (kind === 'del') {
				const r = await api(`docs/${tool}/${encodeURIComponent(id)}`, { method: 'DELETE', body: { baseRev } });
				const n = meta();
				n.revs[k] = r.rev;
				if (n.dirty[k] === 'del') delete n.dirty[k];
				setMeta(n);
				return;
			}
			const raw = ls.get(saveKey(tool, id));
			if (!raw) {
				const n = meta();
				delete n.dirty[k];
				setMeta(n);
				return;
			}
			const r = await api(`docs/${tool}/${encodeURIComponent(id)}`, { method: 'PUT', body: { doc: JSON.parse(raw), baseRev } });
			const n = meta();
			n.revs[k] = r.rev;
			// only clear if nothing changed while the request was out
			if (n.dirty[k] === 'put' && ls.get(saveKey(tool, id)) === raw) delete n.dirty[k];
			setMeta(n);
		} catch (err) {
			if (err.status === 409) return keepBoth(tool, id, err.data && err.data.rev);
			throw err;
		}
	}

	async function pushAll() {
		const dirty = meta().dirty;
		const keys = Object.keys(dirty);
		if (!keys.length) return setState('idle');
		setState('saving');
		try {
			for (const k of keys) await pushOne(k, dirty[k]);
			if (pendingCount()) {
				clearTimeout(Sync.timer);
				Sync.timer = setTimeout(() => queue(pushAll), 800);
			} else setState('idle');
		} catch (err) {
			if (err.offline || err.status === 0) setState('offline', 'Saved on this computer. It’ll reach your account when you’re back online.');
			else if (err.status === 401) setState('error', 'You’ve been signed out. Sign in again to save to your account.');
			else setState('error', err.message);
		}
	}

	/* Full sync when a page opens: pull what other computers saved, push what this one changed. */
	async function syncAll() {
		const { docs, tools } = await api('docs');
		Sync.allowed = tools;
		const m = meta();
		const local = localSaves();
		for (const d of docs) {
			const k = keyOf(d.tool, d.id);
			const dirty = m.dirty[k];
			const have = local.has(k);
			local.delete(k);
			if (d.deleted) {
				if (!dirty || (dirty === 'del')) {
					ls.del(saveKey(d.tool, d.id));
					m.revs[k] = d.rev;
					delete m.dirty[k];
				}
				// edited here after it was deleted elsewhere: the push brings it back
				continue;
			}
			if (dirty) {
				if (m.revs[k] !== d.rev) {
					setMeta(m);
					await keepBoth(d.tool, d.id, d.rev);
					Object.assign(m, meta());
				}
				continue;
			}
			if (!have || m.revs[k] !== d.rev) {
				const r = await api(`docs/${d.tool}/${encodeURIComponent(d.id)}`);
				if (r.doc) ls.set(saveKey(d.tool, d.id), JSON.stringify(r.doc));
				m.revs[k] = r.rev;
			}
		}
		// Saves only on this computer (made offline, or before the server had them): send them up.
		for (const [k, { tool }] of local) if (tools.includes(tool) && !m.dirty[k]) m.dirty[k] = 'put';
		setMeta(m);
		await pushAll();
	}

	window.HTSync = {
		changed: (tool, id) => mark(tool, id, 'put'),
		removed: (tool, id) => mark(tool, id, 'del'),
		onState: (fn) => (Sync.listeners.add(fn), fn(Sync.state, Sync.message)),
		get state() {
			return Sync.state;
		},
		pending: pendingCount,
		flush: () => queue(pushAll)
	};
	// Leaving the page: try once more (the dirty list is kept, so the next page load pushes anyway).
	document.addEventListener('visibilitychange', () => {
		if (document.hidden && Sync.active && pendingCount()) {
			clearTimeout(Sync.timer);
			queue(pushAll);
		}
	});

	/* ---------------- what this browser should use ---------------- */
	function sectionOf(name) {
		const s = SECTIONS[name];
		if (!s) throw new Error('Unknown section ' + name);
		return { ...s, key: name, homeUrl: SITE + s.home };
	}
	const canUse = (sec, user) => !!user && (!sec.teacherOnly || user.role === 'teacher');
	const cachedUser = () => json(ls.get('htsync:user'), null); // last signed-in user, for offline use

	async function whoAmI() {
		try {
			const { user } = await api('me', { timeout: 6000 });
			return { user, reachable: true };
		} catch (err) {
			return { user: null, reachable: false, why: err.message };
		}
	}

	async function enterUser(user, sec) {
		useSpace('u:' + user.id);
		pageSpace = currentSpace();
		ls.set('htsync:user', JSON.stringify(user));
		Sync.active = true;
		Sync.allowed = sec.tools;
		try {
			await syncAll();
		} catch (err) {
			if (err.offline || err.status === 0) setState('offline', 'Couldn’t reach the server. Working from this computer’s copy.');
			else setState('error', err.message);
		}
		return (Gate.ctx = { kind: 'user', user, section: sec.key });
	}
	function enterGuest(sec, note) {
		useSpace('guest');
		pageSpace = currentSpace();
		Sync.active = false;
		return (Gate.ctx = { kind: 'guest', user: null, section: sec.key, note });
	}

	/* ---------------- the sign-in screen ---------------- */
	function brand(sec, sub) {
		return el(
			'header',
			{ class: 'htg-head' },
			el('img', { src: SITE + 'branding/happy-theta-icon.svg', alt: '' }),
			el('div', null, el('h1', { text: sec.name }), el('p', { text: sub }))
		);
	}

	function phraseWords(phrase) {
		const words = phrase.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').split(' ');
		return el('span', { class: 'htg-phrase-text', 'aria-label': phrase }, words.map((w, i) => el('span', { class: i % 2 ? 'b' : 'a', text: w })));
	}

	function loginScreen(sec, { reachable, why, user }) {
		return new Promise((resolve) => {
			const done = (v) => {
				screen.remove();
				resolve(v);
			};
			const status = el('p', { class: 'htg-status', role: 'status', 'aria-live': 'polite' });
			const say = (t, kind) => {
				status.textContent = t || '';
				status.className = 'htg-status' + (kind ? ' ' + kind : '');
			};
			const guestBtn = el('button', {
				type: 'button',
				class: 'htg-btn htg-ghost htg-wide',
				text: 'Preview as a guest',
				onclick: () => {
					ls.set(GUEST_KEY(sec.key), '1');
					done(enterGuest(sec));
				}
			});
			const guestNote = el('p', { class: 'htg-note', text: 'Try everything without an account. Guest work is saved in this browser only.' });
			const foot = el('p', { class: 'htg-foot' }, el('a', { href: SITE + 'index.html', text: '← All Happy Theta apps' }));
			const card = el('div', { class: 'htg-card' });
			const screen = el('div', { class: 'htg-screen' }, card);

			// Signed in, but this section is for teachers
			if (user && !canUse(sec, user)) {
				card.append(
					brand(sec, 'Teacher accounts only'),
					el('p', null, 'You’re signed in as ', el('strong', { text: user.email }), ', which is a student account. Teacher tools need a teacher account.'),
					el('div', { class: 'htg-stack' }, guestBtn, el('button', { type: 'button', class: 'htg-btn htg-ghost htg-wide', text: 'Sign out', onclick: () => Gate.signOut() }), el('a', { class: 'htg-btn htg-ghost htg-wide', href: SITE + 'phys/index.html', text: 'Go to Physics' })),
					foot
				);
				document.body.append(screen);
				return;
			}

			// No server (opened as a file, offline, or the API isn't running)
			if (!reachable) {
				card.append(
					brand(sec, 'Sign-in isn’t available right now'),
					el('p', { class: 'htg-warn', text: (why || 'Can’t reach the server.') + ' You can still use everything as a guest; your work stays in this browser.' }),
					el('div', { class: 'htg-stack' }, guestBtn, el('button', { type: 'button', class: 'htg-btn htg-ghost htg-wide', text: 'Try again', onclick: () => location.reload() })),
					foot
				);
				document.body.append(screen);
				guestBtn.focus();
				return;
			}

			let tab = 'in';
			const tabs = el('div', { class: 'htg-tabs', role: 'tablist' });
			const body = el('div');
			const setTab = (t) => {
				tab = t;
				say('');
				tabs.replaceChildren(
					el('button', { type: 'button', role: 'tab', 'aria-selected': String(t === 'in'), text: 'Sign in', onclick: () => setTab('in') }),
					el('button', { type: 'button', role: 'tab', 'aria-selected': String(t === 'up'), text: 'Create account', onclick: () => setTab('up') })
				);
				body.replaceChildren(t === 'in' ? signInForm() : signUpForm());
				const f = body.querySelector('input:not([type=hidden])');
				if (f) f.focus();
			};

			const emailInput = (id, value = '') =>
				el('label', { class: 'htg-field' }, el('span', { text: 'Email' }), el('input', { id, type: 'email', autocomplete: 'username', required: true, maxlength: 254, value }));

			let remembered = { email: '', phrase: '' };

			function checkEmailView(email, phrase) {
				body.replaceChildren(
					el('div', { class: 'htg-check' }, el('h2', { text: 'Check your email' }), el('p', null, 'We sent a link to ', el('strong', { text: email }), '. Click it to confirm your address and finish making your account. It works for 48 hours. Check your spam folder too.')),
					el('div', { class: 'htg-row' },
						el('button', {
							type: 'button',
							class: 'htg-btn htg-ghost',
							text: 'Send the link again',
							onclick: async (e) => {
								e.target.disabled = true;
								try {
									await api('register', { method: 'POST', body: { email, password: phrase } });
									say('Sent a new link.', 'ok');
								} catch (err) {
									say(err.message, 'error');
								}
								e.target.disabled = false;
							}
						}),
						el('button', { type: 'button', class: 'htg-btn htg-ghost', text: 'Back to sign in', onclick: () => setTab('in') })
					)
				);
			}

			function signInForm() {
				const pass = el('input', { id: 'htgPass', type: 'password', autocomplete: 'current-password', required: true, maxlength: 200, placeholder: 'e.g. theSleepyOtterJugglesQuietly', spellcheck: 'false' });
				const show = el('button', {
					type: 'button',
					class: 'htg-peek',
					text: 'Show',
					'aria-label': 'Show pass phrase',
					onclick: () => {
						pass.type = pass.type === 'password' ? 'text' : 'password';
						show.textContent = pass.type === 'password' ? 'Show' : 'Hide';
					}
				});
				const go = el('button', { type: 'submit', class: 'htg-btn htg-primary htg-wide', text: 'Sign in' });
				const form = el(
					'form',
					{ novalidate: true },
					emailInput('htgEmail', remembered.email),
					el('label', { class: 'htg-field' }, el('span', { text: 'Pass phrase' }), el('div', { class: 'htg-pass' }, pass, show)),
					el('p', { class: 'htg-link-right' }, el('a', { href: SITE + 'phys/account/forgot.html', text: 'Forgot your pass phrase?' })),
					go
				);
				form.addEventListener('submit', async (e) => {
					e.preventDefault();
					const email = form.querySelector('#htgEmail').value.trim();
					if (!email || !pass.value) return say('Enter your email and pass phrase.', 'error');
					go.disabled = true;
					say('Signing in…');
					try {
						const { user } = await api('login', { method: 'POST', body: { email, password: pass.value } });
						if (!canUse(sec, user)) {
							screen.remove();
							return resolve(loginScreen(sec, { reachable: true, user }));
						}
						say('Loading your work…', 'ok');
						done(await enterUser(user, sec));
					} catch (err) {
						go.disabled = false;
						if (err.data && err.data.unverified) {
							remembered = { email, phrase: pass.value };
							say('');
							return checkEmailView(email, pass.value);
						}
						say(err.message, 'error');
					}
				});
				return form;
			}

			function signUpForm() {
				let phrase = '';
				const shown = el('div', { class: 'htg-phrase', 'aria-live': 'polite' }, el('span', { class: 'htg-muted', text: 'Making one up…' }));
				const hiddenPass = el('input', { type: 'password', autocomplete: 'new-password', hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
				const again = el('button', { type: 'button', class: 'htg-btn htg-ghost', text: 'Another one' });
				const copy = el('button', { type: 'button', class: 'htg-btn htg-ghost', text: 'Copy' });
				const saved = el('input', { type: 'checkbox', id: 'htgSaved' });
				const go = el('button', { type: 'submit', class: 'htg-btn htg-primary htg-wide', text: 'Create account', disabled: true });
				async function roll() {
					again.disabled = true;
					try {
						phrase = (await api('passphrase')).passphrase;
						shown.replaceChildren(phraseWords(phrase));
						hiddenPass.value = phrase;
						saved.checked = false;
						go.disabled = true;
					} catch (err) {
						say(err.message, 'error');
					}
					again.disabled = false;
				}
				again.onclick = roll;
				copy.onclick = async () => {
					try {
						await navigator.clipboard.writeText(phrase);
						copy.textContent = 'Copied';
						setTimeout(() => (copy.textContent = 'Copy'), 1500);
					} catch {
						say('Couldn’t copy. Select the words and copy them yourself.', 'error');
					}
				};
				saved.onchange = () => (go.disabled = !saved.checked || !phrase);
				const form = el(
					'form',
					{ novalidate: true },
					emailInput('htgNewEmail'),
					el('div', { class: 'htg-field' },
						el('span', { text: 'Your pass phrase' }),
						shown,
						hiddenPass,
						el('div', { class: 'htg-row' }, again, copy),
						el('span', { class: 'htg-hint', text: 'The site makes it up for you. Type it in camelCase as shown — or with spaces, any capitals; both work.' })
					),
					el('label', { class: 'htg-check-row' }, saved, el('span', { text: 'I’ve written it down or saved it in my password manager.' })),
					go
				);
				form.addEventListener('submit', async (e) => {
					e.preventDefault();
					const email = form.querySelector('#htgNewEmail').value.trim();
					if (!email) return say('Enter your email.', 'error');
					go.disabled = true;
					say('Creating your account…');
					try {
						await api('register', { method: 'POST', body: { email, password: phrase } });
						remembered = { email, phrase };
						say('');
						checkEmailView(email, phrase);
					} catch (err) {
						go.disabled = false;
						say(err.message, 'error');
					}
				});
				roll();
				return form;
			}

			card.append(
				brand(sec, sec.teacherOnly ? 'Sign in with your teacher account' : 'Sign in to keep your work on every computer'),
				tabs,
				body,
				status,
				el('div', { class: 'htg-or' }, el('span', { text: 'or' })),
				guestBtn,
				guestNote,
				foot
			);
			document.body.append(screen);
			setTab('in');
		});
	}

	/* ---------------- the little status chip on tool pages ---------------- */
	function chip(sec) {
		const ctx = Gate.ctx;
		const dot = el('span', { class: 'htg-dot' });
		const label = el('span', { class: 'htg-chip-text' });
		const btn = el('button', { type: 'button', class: 'htg-chip', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, dot, label);
		const menu = el('div', { class: 'htg-menu', hidden: true });
		const wrap = el('div', { class: 'htg-chip-wrap' }, btn, menu);
		const fillMenu = () =>
			menu.replaceChildren(
				ctx.kind === 'user'
					? el('p', null, 'Signed in as ', el('strong', { text: ctx.user.email }), ctx.user.role === 'teacher' ? ' (teacher)' : '')
					: el('p', null, el('strong', { text: 'Guest preview. ' }), 'Your work is saved in this browser only.'),
				Sync.message ? el('p', { class: 'htg-muted', text: Sync.message }) : null,
				el('a', { href: sec.homeUrl, text: sec.short + ' dashboard' }),
				ctx.kind === 'user'
					? el('button', { type: 'button', text: 'Sign out', onclick: () => Gate.signOut() })
					: el('button', { type: 'button', text: 'Sign in instead', onclick: () => Gate.exitGuest() })
			);
		btn.onclick = (e) => {
			e.stopPropagation();
			fillMenu();
			menu.hidden = !menu.hidden;
			btn.setAttribute('aria-expanded', String(!menu.hidden));
		};
		document.addEventListener('click', (e) => {
			if (!wrap.contains(e.target)) {
				menu.hidden = true;
				btn.setAttribute('aria-expanded', 'false');
			}
		});
		const paint = (state) => {
			if (ctx.kind === 'guest') {
				dot.className = 'htg-dot guest';
				label.textContent = 'Guest preview';
				btn.title = 'Saved in this browser only';
				return;
			}
			const name = ctx.user.email.split('@')[0];
			const text = { idle: 'Saved', saving: 'Saving…', offline: 'Offline', error: 'Not saved' }[state] || 'Saved';
			dot.className = 'htg-dot ' + state;
			label.textContent = `${name} · ${text}`;
			btn.title = Sync.message || (state === 'idle' ? 'Saved to your account' : '');
		};
		if (ctx.kind === 'user') window.HTSync.onState(paint);
		else paint();
		const navInner = document.querySelector('.navbar-inner');
		if (navInner) navInner.append(wrap);
		else {
			wrap.classList.add('htg-floating');
			document.body.append(wrap);
		}
	}

	async function runDeferred() {
		// The page's deferred tags come after this script; wait until the parser has seen them.
		if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
		const list = [...document.querySelectorAll('script[type="text/x-ht-deferred"]')];
		return list.reduce(
			(p, old) =>
				p.then(
					() =>
						new Promise((res) => {
							const s = document.createElement('script');
							s.src = old.dataset.src;
							s.async = false;
							s.onload = s.onerror = res;
							old.replaceWith(s);
						})
				),
			Promise.resolve()
		);
	}

	/* ---------------- public ---------------- */
	const Gate = {
		SITE,
		API,
		SECTIONS,
		TOOL_NAMES,
		ctx: null,
		api,
		el,

		/* Decide signed-in vs guest for this page. Dashboards show the sign-in screen when needed;
		   tool pages send you to their dashboard instead. Resolves to {kind:'user'|'guest', user}. */
		async start({ section, tool = false } = {}) {
			const sec = sectionOf(section);
			const me = await whoAmI();
			if (me.user && canUse(sec, me.user)) return enterUser(me.user, sec);
			if (!me.reachable) {
				// No server: keep working on a signed-in copy if that's what this browser had, else guest.
				const cu = cachedUser();
				if (cu && currentSpace() === 'u:' + cu.id && canUse(sec, cu)) {
					useSpace('u:' + cu.id);
					pageSpace = currentSpace();
					Sync.active = true;
					Sync.allowed = sec.tools;
					setState('offline', 'Couldn’t reach the server. Working from this computer’s copy.');
					return (Gate.ctx = { kind: 'user', user: cu, section: sec.key, offline: true });
				}
				if (tool) return enterGuest(sec, me.why);
			}
			if (ls.get(GUEST_KEY(sec.key)) && !(me.user && canUse(sec, me.user))) return enterGuest(sec);
			if (tool) {
				const next = location.pathname + location.search + location.hash;
				location.replace(sec.homeUrl + '?next=' + encodeURIComponent(next));
				return new Promise(() => {});
			}
			const ctx = await loginScreen(sec, me);
			// Came here from a tool page: go back to it.
			const next = new URLSearchParams(location.search).get('next');
			if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
				location.replace(next);
				return new Promise(() => {});
			}
			return ctx;
		},

		async signOut() {
			const ctx = Gate.ctx;
			if (ctx && ctx.kind === 'user') {
				clearTimeout(Sync.timer);
				await Sync.chain;
				if (Sync.active && pendingCount()) await pushAll();
				const left = Sync.active ? pendingCount() : 0;
				if (left && !confirm(`${left} change${left === 1 ? '' : 's'} haven’t reached the server yet and will be lost if you sign out now. Sign out anyway?`)) return;
				forgetSpace('u:' + ctx.user.id);
			} else {
				const cu = cachedUser(); // signing out from a page that didn't start the gate
				if (cu) forgetSpace('u:' + cu.id);
			}
			try {
				await api('logout', { method: 'POST', body: {} });
			} catch {}
			ls.del('htsync:user');
			Object.keys(SECTIONS).forEach((s) => ls.del(GUEST_KEY(s)));
			location.href = sectionOf((ctx && ctx.section) || 'phys').homeUrl;
		},

		exitGuest() {
			Object.keys(SECTIONS).forEach((s) => ls.del(GUEST_KEY(s)));
			location.href = sectionOf((Gate.ctx && Gate.ctx.section) || 'phys').homeUrl;
		},

		/* Saves in the current space for some tools: [{tool, id, title, modified}] newest first. */
		listSaves(tools) {
			const out = [];
			for (const [, { tool, id }] of localSaves()) {
				if (tools && !tools.includes(tool)) continue;
				const f = json(ls.get(saveKey(tool, id)), null);
				if (f && f.data) out.push({ tool, id, title: (f.meta && f.meta.title) || 'Untitled', modified: (f.meta && f.meta.modified) || '' });
			}
			return out.sort((a, b) => String(b.modified).localeCompare(String(a.modified)));
		},

		/* Guest-preview saves still on this computer, while signed in. */
		guestSaves(tools) {
			const pre = STASH('guest') + SAVE_PREFIX.slice(PREFIX.length); // stashed keys drop the "happytheta:" prefix
			return ls
				.keys(pre)
				.map((k) => json(ls.get(k), null))
				.filter((f) => f && f.data && (!tools || tools.includes(f.tool)));
		},

		/* Copy guest-preview saves into the signed-in account (guest copies are kept). */
		async importGuest(tools) {
			if (!Gate.ctx || Gate.ctx.kind !== 'user') return 0;
			let n = 0;
			for (const f of Gate.guestSaves(tools)) {
				if (!Sync.allowed.includes(f.tool)) continue;
				const exists = ls.get(saveKey(f.tool, f.id));
				const copy = exists ? { ...f, id: 's_' + Math.random().toString(36).slice(2, 10) } : f;
				ls.set(saveKey(copy.tool, copy.id), JSON.stringify(copy));
				mark(copy.tool, copy.id, 'put');
				n++;
			}
			await queue(pushAll);
			return n;
		},

		/* "Signed in as … · Sign out" for dashboards. */
		userBar(sec) {
			const ctx = Gate.ctx;
			const s = sectionOf(sec || ctx.section);
			const bar = el('div', { class: 'htg-userbar' });
			if (ctx.kind === 'user') {
				const state = el('span', { class: 'htg-muted' });
				if (ctx.user) window.HTSync.onState((st, msg) => (state.textContent = st === 'idle' ? '' : msg || (st === 'saving' ? 'Saving…' : '')));
				bar.append(
					el('span', null, 'Signed in as ', el('strong', { text: ctx.user.email }), ctx.user.role === 'teacher' ? el('span', { class: 'htg-tag', text: 'teacher' }) : null),
					state,
					el('button', { type: 'button', class: 'htg-linkbtn', text: 'Sign out', onclick: () => Gate.signOut() })
				);
			} else {
				bar.classList.add('guest');
				bar.append(
					el('span', null, el('strong', { text: 'Guest preview' }), ' — your work is saved in this browser only.'),
					el('button', { type: 'button', class: 'htg-linkbtn', text: 'Sign in or create an account', onclick: () => Gate.exitGuest() })
				);
			}
			return bar;
		}
	};
	window.HTGate = Gate;

	// Tool pages: gate, then run the page's own scripts.
	if (script.dataset.gate === 'tool') {
		const sec = sectionOf(script.dataset.section || 'phys');
		document.documentElement.classList.add('htg-wait');
		Gate.start({ section: sec.key, tool: true })
			.then(() => runDeferred())
			.then(() => {
				document.documentElement.classList.remove('htg-wait');
				chip(sec);
			});
	}
})();
