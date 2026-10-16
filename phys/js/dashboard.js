/* Teacher dashboard: every student message, newest first. */
'use strict';
(async function () {
	const $ = (id) => document.getElementById(id);
	let messages = [];

	function showOnly(text) {
		$('page').hidden = false;
		document.querySelector('.dash-tools').hidden = true;
		document.querySelector('.msg-table').hidden = true;
		$('summary').textContent = '';
		$('empty').hidden = false;
		$('empty').textContent = text;
	}

	function render() {
		const f = $('filter').value.trim().toLowerCase();
		const shown = f ? messages.filter((m) => m.email.toLowerCase().includes(f) || m.body.toLowerCase().includes(f)) : messages;
		const students = new Set(messages.map((m) => m.email)).size;
		$('summary').textContent =
			`${messages.length} message${messages.length === 1 ? '' : 's'} from ${students} student${students === 1 ? '' : 's'}` +
			(f ? ` · ${shown.length} shown` : '');
		$('rows').replaceChildren(
			...shown.map((m) =>
				HT.el(
					'tr',
					null,
					HT.el('td', { class: 'when', text: HT.formatTime(m.created_at), title: new Date(m.created_at).toLocaleString() }),
					HT.el('td', { class: 'who', text: m.email }),
					HT.el('td', { class: 'body', text: m.body })
				)
			)
		);
		$('empty').hidden = shown.length > 0;
		$('empty').textContent = messages.length ? 'No messages match that filter.' : 'No messages yet.';
	}

	async function load() {
		$('refresh').disabled = true;
		try {
			({ messages } = await HT.api('messages'));
			render();
		} catch (e) {
			if (e.status === 401) return location.replace(HT.loginUrl());
			$('summary').textContent = e.message;
		} finally {
			$('refresh').disabled = false;
		}
	}

	let user;
	try {
		user = await HT.requireLogin();
	} catch (e) {
		return showOnly(e.message);
	}
	if (user.role !== 'teacher') return showOnly('This page is for teachers. Ask your teacher if you think you should have access.');

	$('page').hidden = false;
	$('filter').addEventListener('input', render);
	$('refresh').addEventListener('click', load);
	load();
})();
