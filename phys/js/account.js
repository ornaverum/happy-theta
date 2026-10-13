/* HappyTheta accounts — talks to the server API at <site root>/api/.
   Load after core.js. Pages call HT.requireLogin() before showing anything private. */
'use strict';

HT.api = async function (path, { method = 'GET', body } = {}) {
	let res;
	try {
		res = await fetch(HT.root + 'api/' + path, {
			method,
			credentials: 'same-origin',
			headers: body ? { 'Content-Type': 'application/json' } : {},
			body: body ? JSON.stringify(body) : undefined
		});
	} catch {
		throw Object.assign(new Error("Can't reach the server. Check your connection and try again."), { status: 0 });
	}
	let data = {};
	try {
		data = await res.json();
	} catch {}
	if (!res.ok) throw Object.assign(new Error(data.error || `Server error (${res.status}).`), { status: res.status });
	return data;
};

/* Where to go after signing in: only same-site paths, never another host. */
HT.safeNext = function (next) {
	return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : null;
};

HT.loginUrl = function () {
	const here = location.pathname + location.search;
	return HT.root + 'account/login.html?next=' + encodeURIComponent(here);
};

/* Resolves to the signed-in user, or sends the browser to the sign-in page. */
HT.requireLogin = async function () {
	const { user } = await HT.api('me');
	if (!user) {
		location.replace(HT.loginUrl());
		return new Promise(() => {}); // page is leaving
	}
	HT.user = user;
	HT.showUserBar(user);
	return user;
};

HT.signOut = async function () {
	try {
		await HT.api('logout', { method: 'POST', body: {} });
	} catch {}
	location.href = HT.root + 'account/login.html';
};

/* "Signed in as … · Sign out" strip under the navbar. */
HT.showUserBar = function (user) {
	if (document.querySelector('.user-bar')) return;
	const bar = HT.el(
		'div',
		{ class: 'user-bar' },
		HT.el('span', null, 'Signed in as ', HT.el('strong', { text: user.email }), user.role === 'teacher' ? ' (teacher)' : ''),
		user.role === 'teacher' ? HT.el('a', { href: HT.root + 'dashboard.html', text: 'Dashboard' }) : null,
		HT.el('button', { type: 'button', class: 'link-btn', text: 'Sign out', onclick: HT.signOut })
	);
	const nav = document.querySelector('.navbar');
	nav ? nav.after(bar) : document.body.prepend(bar);
};

HT.formatTime = (iso) =>
	new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
