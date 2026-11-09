/* Physics dashboard (phys/index.html). Starts with sign-in (or guest preview), then shows
   - teachers: the tools, the newest student messages, their saved figures, a link to Teacher Tools
   - students: the tools, their saved figures, a box to message their teacher
   - guests:   the tools and their saved figures (in this browser only). */
'use strict';
(async function () {
	const el = HT.el;
	const page = document.getElementById('page');

	const TOOLS = [
		{ tool: 'fbd', name: 'Free Body Diagram', href: 'figures/free-body-diagram.html', desc: 'Forces on an object, by type and agent, with the net force. 1D or 2D, tilted axes.', icon: 'M12 4v16M4 12h16M12 4l-3 3M12 4l3 3M20 12l-3-3M20 12l-3 3' },
		{ tool: 'motion', name: 'Motion Diagram', href: 'figures/motion-diagram.html', desc: 'Dots at equal time steps with velocity arrows drawn for you.', icon: 'M4 16h.01M9 14h.01M14 11h.01M19 7h.01M5 15l3-1M10 13l3-1.5M15 10l3-2.5' },
		{ tool: 'energy', name: 'Energy Diagram', href: 'figures/energy-diagram.html', desc: 'Energy bar charts: states (K, Ug, Uel, Eth) and the work between them.', icon: 'M5 20V10M10 20V4M15 20v-7M20 20v-4M3 20h18' },
		{ tool: 'graph', name: 'Graph Maker', href: 'figures/graph-maker.html', desc: 'Qualitative position, velocity and acceleration vs time graphs.', icon: 'M4 4v16h16M7 15l4-5 3 3 5-6' },
		{ tool: null, name: 'Advanced Graph Maker', href: 'figures/advanced-graph-maker.html', desc: 'Freeform graphs from equations and data.', icon: 'M4 4v16h16M6 16c3-9 6-9 9-3s3 2 4-4' },
		{ tool: null, name: 'GIF Maker', href: 'cv-apps/gif-maker.html', desc: 'Turn a set of frames into an animated GIF.', icon: 'M4 6h16v12H4zM8 6v12M16 6v12M4 10h4M4 14h4M16 10h4M16 14h4' }
	];
	const toolHref = Object.fromEntries(TOOLS.filter((t) => t.tool).map((t) => [t.tool, t]));

	const svg = (d) => {
		const NS = 'http://www.w3.org/2000/svg';
		const s = document.createElementNS(NS, 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('fill', 'none');
		s.setAttribute('stroke', 'currentColor');
		s.setAttribute('stroke-width', '2');
		s.setAttribute('stroke-linecap', 'round');
		s.setAttribute('stroke-linejoin', 'round');
		const p = document.createElementNS(NS, 'path');
		p.setAttribute('d', d);
		s.append(p);
		return s;
	};
	const when = (iso) => {
		const d = new Date(iso);
		if (isNaN(d)) return '';
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
	};

	const ctx = await HTGate.start({ section: 'phys' });
	const user = ctx.user;
	const teacher = ctx.kind === 'user' && user.role === 'teacher';
	if (user) HT.user = user;
	document.querySelector('.navbar').after(HTGate.userBar());
	document.body.classList.add(teacher ? 'pd-teacher' : 'pd-student');

	/* ---- header ---- */
	const name = user ? user.email.split('@')[0] : '';
	page.append(
		el(
			'header',
			{ class: 'pd-head' },
			el('div', null,
				el('p', { class: 'pd-kicker', text: teacher ? 'Teacher dashboard' : ctx.kind === 'guest' ? 'Guest preview' : 'Student dashboard' }),
				el('h1', { text: teacher ? `Welcome, ${name}` : user ? `Hi, ${name}!` : 'Physics tools' }),
				el('p', { class: 'pd-sub', text: teacher
					? 'Your tools, your students’ messages, and the figures you’ve saved.'
					: user
						? 'Pick a tool to draw a figure. Everything you save goes to your account.'
						: 'Try any tool. What you save stays in this browser; sign in to keep it on every computer.' })
			),
			teacher ? el('a', { class: 'btn btn-blue', href: '../teacher/', text: 'Teacher tools →' }) : null
		)
	);

	/* ---- tools ---- */
	page.append(
		el('h2', { class: 'pd-label', text: 'Tools' }),
		el('div', { class: 'pd-tools' }, TOOLS.map((t) => el('a', { class: 'pd-tool', href: t.href }, el('span', { class: 'pd-ico' }, svg(t.icon)), el('b', { text: t.name }), el('span', { text: t.desc }))))
	);

	const cols = el('div', { class: 'pd-cols' });
	page.append(cols);

	/* ---- teacher: student messages ---- */
	if (teacher) {
		const summary = el('p', { class: 'pd-muted', text: 'Loading…' });
		const filter = el('input', { type: 'search', class: 'search', placeholder: 'Filter by email or text', 'aria-label': 'Filter messages' });
		const list = el('ul', { class: 'pd-msgs' });
		const refresh = el('button', { type: 'button', class: 'btn btn-alt', text: 'Refresh' });
		let messages = [];
		const draw = () => {
			const f = filter.value.trim().toLowerCase();
			const shown = (f ? messages.filter((m) => m.email.toLowerCase().includes(f) || m.body.toLowerCase().includes(f)) : messages).slice(0, 30);
			const students = new Set(messages.map((m) => m.email)).size;
			summary.textContent = messages.length ? `${messages.length} message${messages.length === 1 ? '' : 's'} from ${students} student${students === 1 ? '' : 's'}` : 'No messages yet.';
			list.replaceChildren(
				...shown.map((m) =>
					el('li', null, el('div', { class: 'pd-msg-top' }, el('strong', { text: m.email }), el('span', { class: 'pd-muted', text: HT.formatTime(m.created_at) })), el('p', { text: m.body }))
				)
			);
		};
		const load = async () => {
			refresh.disabled = true;
			try {
				({ messages } = await HT.api('messages?limit=500'));
				draw();
			} catch (e) {
				summary.textContent = e.message;
			}
			refresh.disabled = false;
		};
		filter.addEventListener('input', draw);
		refresh.addEventListener('click', load);
		cols.append(
			el('section', { class: 'pd-panel pd-wide', id: 'messages' },
				el('div', { class: 'pd-panel-head' }, el('h2', { text: 'Student messages' }), el('div', { class: 'pd-row' }, filter, refresh)),
				summary,
				list,
				el('p', { class: 'small' }, el('a', { href: 'dashboard.html', text: 'All messages as a table →' }))
			)
		);
		load();
	}

	/* ---- saved figures ---- */
	const saves = HTGate.listSaves(['fbd', 'motion', 'energy', 'graph']);
	cols.append(
		el('section', { class: 'pd-panel' },
			el('div', { class: 'pd-panel-head' }, el('h2', { text: ctx.kind === 'guest' ? 'Saved in this browser' : 'Your saved figures' })),
			saves.length
				? el('ul', { class: 'pd-saves' }, saves.slice(0, 10).map((s) => el('li', null, el('a', { href: toolHref[s.tool].href, text: s.title }), el('span', { class: 'pd-muted', text: `${toolHref[s.tool].name} · ${when(s.modified)}` }))))
				: el('p', { class: 'pd-muted', text: 'Nothing saved yet. In a tool, use Save to keep a figure; open it again with Open.' })
		)
	);

	/* ---- student: message your teacher ---- */
	if (!teacher) {
		const box = el('section', { class: 'pd-panel', id: 'message' }, el('div', { class: 'pd-panel-head' }, el('h2', { text: 'Message your teacher' })));
		if (ctx.kind === 'guest') {
			box.append(el('p', { class: 'pd-muted', text: 'Sign in to send your teacher a message.' }));
		} else {
			const MAX = 2000;
			const body = el('textarea', { maxlength: String(MAX + 100), rows: '5', 'aria-label': 'Message', placeholder: 'A question, a link to your work, anything…' });
			const counter = el('span', { class: 'counter', text: `0 / ${MAX}` });
			const status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
			const send = el('button', { type: 'submit', class: 'btn btn-blue', text: 'Send' });
			body.addEventListener('input', () => {
				counter.textContent = `${body.value.length} / ${MAX}`;
				counter.classList.toggle('over', body.value.length > MAX);
			});
			const form = el('form', { class: 'field' }, body, el('div', { class: 'form-row' }, counter, send), status);
			form.addEventListener('submit', async (e) => {
				e.preventDefault();
				const text = body.value.trim();
				if (!text) return HT.setStatus(status, 'Type a message first.', 'error');
				send.disabled = true;
				HT.setStatus(status, 'Sending…');
				try {
					const { message } = await HT.api('messages', { method: 'POST', body: { body: text } });
					body.value = '';
					counter.textContent = `0 / ${MAX}`;
					HT.setStatus(status, `Sent at ${HT.formatTime(message.created_at)}.`, 'ok');
				} catch (err) {
					HT.setStatus(status, err.message, 'error');
				}
				send.disabled = false;
			});
			box.append(form);
		}
		cols.append(box);
	}

	/* ---- guest work → account ---- */
	if (ctx.kind === 'user') {
		const g = HTGate.guestSaves(['fbd', 'motion', 'energy', 'graph']);
		if (g.length) {
			const text = el('p', { text: `This browser has ${g.length} figure${g.length === 1 ? '' : 's'} from a guest preview. Copy ${g.length === 1 ? 'it' : 'them'} into your account?` });
			const yes = el('button', { type: 'button', class: 'btn btn-blue', text: 'Copy into my account' });
			const no = el('button', { type: 'button', class: 'btn btn-alt', text: 'Not now' });
			const banner = el('div', { class: 'pd-banner' }, text, yes, no);
			no.onclick = () => banner.remove();
			yes.onclick = async () => {
				yes.disabled = true;
				const n = await HTGate.importGuest(['fbd', 'motion', 'energy', 'graph']);
				text.textContent = `Copied ${n}. Reload to see them in your list.`;
				yes.remove();
				no.textContent = 'OK';
			};
			page.querySelector('.pd-head').after(banner);
		}
	}

	page.append(el('div', { class: 'pd-data' }, HTGate.dataPanel({ onImported: () => setTimeout(() => location.reload(), 1800) })));
	page.append(el('p', { class: 'pd-foot' }, el('a', { href: '../index.html', text: '← All Happy Theta apps' })));
	page.hidden = false;
})();
