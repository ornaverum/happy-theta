/* Theta Scheduler — shared activity library (needs the Happy Theta server and a teacher account).
   Teachers share activities from their courses; anyone can search, pull a copy into their own course and
   change it there. Objectives travel as AP-style codes, so an activity shared from one sequence lands on
   the matching objectives in another. Load after scheduler.js (uses account.js for HT.api). */
'use strict';

(function () {
	const S = HT.sched;
	const app = HT.schedApp;
	const el = HT.el;
	const L = (S.lib = {});

	/* ------------------------------------------------------------------ */
	/* Converting between course activities and library items              */
	/* ------------------------------------------------------------------ */

	const isPractice = (tree) => /practice/i.test(tree.name) || tree.id === 'practices';
	const isStructural = (n) => ['unit', 'topic', 'subtopic'].includes(n.kind) && /^U/.test(n.code);

	/* Objective codes for the library. Science practices get an "SP-" prefix. A link to a unit/topic of a
	   reorganized sequence (codes like "U1.3") becomes the codes of what it holds, since other courses
	   won't have that node. */
	L.codesFor = function (data, ids, { precise = false } = {}) {
		const out = new Set();
		for (const id of ids || []) {
			const f = S.findNode(data, id);
			if (!f) continue;
			const { tree, node } = f;
			if (isPractice(tree)) {
				out.add('SP-' + node.code);
				continue;
			}
			if (!isStructural(node) && !precise) {
				out.add(node.code);
				continue;
			}
			// expand: the objectives inside it; a partial copy (an LO split across topics) lists its parts
			const ix = S.treeIndex(tree);
			const take = (n) => {
				if (isStructural(n)) return ix.kids(n.id).forEach(take);
				if (n.meta && n.meta.partial) return ix.kids(n.id).forEach(take);
				if (n.code) out.add(n.code);
			};
			take(node);
		}
		return [...out];
	};

	/* Course nodes for a library code: exact code matches (every copy), else the objectives under that code */
	L.nodesForCode = function (data, code) {
		const ids = [];
		const prac = code.startsWith('SP-');
		const c = prac ? code.slice(3) : code;
		for (const t of data.objectiveTrees) {
			if (isPractice(t) !== prac) continue;
			const exact = t.nodes.filter((n) => n.code === c && !isStructural(n));
			if (exact.length) {
				ids.push(...exact.map((n) => n.id));
				continue;
			}
			const under = t.nodes.filter((n) => n.code.startsWith(c + '.') && !isStructural(n));
			if (under.length) {
				const minLen = Math.min(...under.map((n) => n.code.split('.').length));
				ids.push(...under.filter((n) => n.code.split('.').length === minLen).map((n) => n.id));
			}
		}
		return ids;
	};

	const tagOf = (data, setId, id) => {
		const set = data.tagSets.find((s) => s.id === setId);
		const t = set && id && set.tags.find((x) => x.id === id);
		return t ? { id: t.id, label: t.label, color: t.color } : null;
	};

	L.toItem = function (data, a) {
		const meets = S.genDays(data).filter((d) => d.meet).map((d) => d.date);
		const span = a.start ? meets.filter((d) => d >= a.start && d <= (a.end || a.start)).length : 0;
		const topic = a.start ? S.topicAt(data, a.start) : null;
		return {
			title: a.title,
			type: tagOf(data, 'type', a.tags && a.tags.type),
			interaction: tagOf(data, 'interaction', a.tags && a.tags.interaction),
			assessment: a.assessment || 'none',
			expectedMin: a.expectedMin ?? null,
			inClass: !!a.inClass,
			spanMeetings: Math.max(0, span - 1),
			objectiveCodes: L.codesFor(data, a.objectiveIds),
			topicHint: topic ? topic.title : '',
			links: (a.links || []).filter((l) => /^https?:\/\//i.test(l.url || '')),
			notes: a.notes || ''
		};
	};

	/* A short fingerprint of what's shared, to notice local edits since the last sync */
	L.sig = function (item) {
		const { topicHint, ...rest } = item;
		void topicHint;
		const s = JSON.stringify(rest, Object.keys(rest).sort());
		let h = 5381;
		for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
		return (h >>> 0).toString(36);
	};

	/* Find or add a tag in a course tag set (mutates data — call inside commit) */
	function ensureTag(data, setId, t, defaults = {}) {
		if (!t) return undefined;
		let set = data.tagSets.find((s) => s.id === setId);
		if (!set) {
			set = { id: setId, name: setId === 'type' ? 'Activity type' : 'Student interaction', tags: [] };
			data.tagSets.push(set);
		}
		const hit = set.tags.find((x) => x.id === t.id) || set.tags.find((x) => x.label.toLowerCase() === t.label.toLowerCase());
		if (hit) return hit.id;
		const id = set.tags.some((x) => x.id === t.id) ? S.newId('tag') : t.id;
		set.tags.push({ id, label: t.label, color: t.color || '#6b7280', ...defaults });
		return id;
	}

	/* Library entry → fields of a course activity (mutates data's tag sets) */
	L.fields = function (data, entry) {
		const it = entry.item;
		const objectiveIds = [...new Set(it.objectiveCodes.flatMap((c) => L.nodesForCode(data, c)))];
		const tags = {};
		const ty = ensureTag(data, 'type', it.type, { countsAs: 'practice' });
		if (ty) tags.type = ty;
		const inter = ensureTag(data, 'interaction', it.interaction);
		if (inter) tags.interaction = inter;
		return {
			title: it.title,
			tags,
			assessment: it.assessment,
			expectedMin: it.expectedMin,
			inClass: it.inClass,
			links: JSON.parse(JSON.stringify(it.links || [])),
			notes: it.notes,
			objectiveIds,
			libraryId: entry.id,
			libraryVersion: entry.version,
			libraryOwner: entry.owner,
			librarySig: L.sig(it)
		};
	};

	/* Start + end dates for a pulled activity placed on `date` (spanning the same number of meetings) */
	function datesFrom(data, date, spanMeetings) {
		if (!date) return { start: null, end: null };
		const meets = S.genDays(data).filter((d) => d.meet).map((d) => d.date);
		const i = meets.findIndex((d) => d >= date);
		if (i < 0 || !spanMeetings) return { start: date, end: date };
		return { start: date, end: meets[Math.min(meets.length - 1, i + spanMeetings)] || date };
	}

	/* How a course activity stands against the library */
	L.status = function (data, a, me) {
		if (!a.libraryId) return 'new';
		const changed = L.sig(L.toItem(data, a)) !== a.librarySig;
		if (me && a.libraryOwner === me.email) return changed ? 'changed' : 'synced';
		return changed ? 'modified-copy' : 'copy';
	};

	/* ------------------------------------------------------------------ */
	/* Server                                                              */
	/* ------------------------------------------------------------------ */

	const lib = {
		me: undefined, // undefined = not checked yet, null = signed out
		meError: '',
		results: [],
		total: 0,
		sel: null,
		loading: false,
		error: '',
		f: { q: '', node: '', type: '', assessment: '', interaction: '', where: '', min: '', max: '', mine: false, sort: 'new' },
		versions: {} // libraryId -> { version, owner, mine }
	};
	L.state = lib;

	async function whoAmI() {
		if (lib.me !== undefined) return lib.me;
		if (!HT.api) {
			lib.me = null;
			lib.meError = 'The library page script (account.js) is missing.';
			return null;
		}
		try {
			const { user } = await HT.api('me');
			lib.me = user;
			lib.meError = '';
		} catch (err) {
			lib.me = null;
			// why it failed decides what to tell the teacher (see gate())
			lib.meError =
				location.protocol === 'file:' ? 'file' : err.status === 0 ? 'offline' : err.status === 404 || err.status === 405 || err.status >= 500 ? 'no-api' : err.message;
		}
		return lib.me;
	}

	const del = (path) => HT.api(path, { method: 'DELETE', body: {} });

	async function refreshVersions() {
		const ids = [...new Set(app.data.activities.map((a) => a.libraryId).filter(Boolean))];
		if (!ids.length || !lib.me || lib.me.role !== 'teacher') return;
		try {
			const out = {};
			for (let i = 0; i < ids.length; i += 200) Object.assign(out, (await HT.api('library/versions?ids=' + ids.slice(i, i + 200).map(encodeURIComponent).join(','))).versions);
			lib.versions = out;
		} catch {}
	}

	function searchCodes() {
		if (!lib.f.node) return [];
		return L.codesFor(app.data, [lib.f.node], { precise: true });
	}

	async function search() {
		const f = lib.f;
		const p = new URLSearchParams();
		if (f.q) p.set('q', f.q);
		if (f.type) p.set('type', f.type);
		if (f.assessment) p.set('assessment', f.assessment);
		if (f.interaction) p.set('interaction', f.interaction);
		if (f.where) p.set('inClass', f.where);
		if (f.min !== '') p.set('min', f.min);
		if (f.max !== '') p.set('max', f.max);
		if (f.mine) p.set('mine', '1');
		const codes = searchCodes();
		if (codes.length) p.set('codes', codes.slice(0, 500).join(','));
		p.set('sort', f.sort);
		p.set('limit', '200');
		lib.loading = true;
		lib.searchedAt = Date.now();
		draw();
		try {
			const r = await HT.api('library?' + p.toString());
			lib.results = r.items;
			lib.total = r.total;
			lib.error = '';
			if (lib.sel && !lib.results.some((x) => x.id === lib.sel)) lib.sel = null;
		} catch (err) {
			lib.error = err.message;
		}
		lib.loading = false;
		draw();
	}

	/* ------------------------------------------------------------------ */
	/* Library view                                                        */
	/* ------------------------------------------------------------------ */

	let root = null;
	const draw = () => {
		if (root && app.view === 'library') renderInto(root);
	};

	app.views.library = {
		title: 'Library',
		render: (container) => {
			root = container;
			renderInto(container);
			// coming back to the tab (or after an edit elsewhere): refresh, so shares made from the calendar show up
			if (lib.me && lib.me.role === 'teacher' && Date.now() - (lib.searchedAt || 0) > 1500) search();
			if (lib.me === undefined)
				whoAmI().then(async (me) => {
					if (me && me.role === 'teacher') {
						await refreshVersions();
						await search();
					} else draw();
				});
		}
	};

	/* What to say when the library can't be used yet */
	function serverHelp() {
		const api = new URL(HT.root + 'api/', location.href).href;
		const code = (t) => el('code', { text: t });
		const setup = el(
			'ol',
			{ class: 'lib-steps' },
			el('li', null, 'On the computer with the repo: ', code('cd server'), ', then ', code('npm install'), ' (once), then ', code('npm run dev'), '.'),
			el('li', null, 'Open ', el('a', { href: 'http://localhost:3000/phys/teacher/scheduler.html', text: 'localhost:3000/phys/teacher/scheduler.html' }), ' (not the file, and not another local server).'),
			el('li', null, 'Sign up on that site. The confirmation link is printed in the ', code('npm run dev'), ' window.'),
			el('li', null, 'Make your account a teacher: ', code('node teacher.js add you@asmsa.org --dev'), ' in ', code('server/'), '.')
		);
		const keep = el('p', { class: 'sched-hint', text: 'Your course still works and saves in this browser. Courses are kept per web address, so a course made on one address (or as a file) won’t appear on another — use Download / Open… to move it.' });
		switch (lib.meError) {
			case 'file':
				return [el('p', { text: 'This page is open as a file, so it can’t reach the Happy Theta server, where the shared library lives. To use the library on your own computer:' }), setup, keep];
			case 'offline':
				return [el('p', null, 'The library lives on the Happy Theta server, and nothing answered at ', code(api), '. Either you’re offline or the server (API) isn’t running there. To try it on your own computer:'), setup, keep];
			case 'no-api':
				return [el('p', null, 'This site is up, but its library server (the API at ', code(api), ') isn’t. On the droplet, start the ', code('happytheta-api'), ' service and check nginx forwards ', code('/phys/api/'), ' to it (server/README.md, “Install on the droplet”). Or try it on your own computer:'), setup, keep];
			default:
				return [
					el('p', null, 'Sign in with a teacher account to search the shared library and share your activities. ', el('a', { href: HT.loginUrl ? HT.loginUrl() : '../account/login.html', text: 'Sign in' })),
					lib.meError ? el('p', { class: 'sched-hint', text: 'Server said: ' + lib.meError }) : null
				];
		}
	}

	function gate() {
		if (lib.me === undefined) return el('p', { class: 'sched-hint', text: 'Connecting to the library…' });
		if (!lib.me)
			return el(
				'div',
				{ class: 'card lib-gate' },
				el('h2', { text: 'Activity library' }),
				...serverHelp(),
				app.btn('Try again', () => ((lib.me = undefined), app.render()))
			);
		if (lib.me.role !== 'teacher')
			return el('div', { class: 'card lib-gate' }, el('h2', { text: 'Activity library' }), el('p', { text: `The library is for teachers. You're signed in as ${lib.me.email}, which isn't a teacher account.` }));
		return null;
	}

	function renderInto(container) {
		const g = gate();
		if (g) return container.replaceChildren(el('div', { class: 'sched-page' }, g));
		const d = app.data;
		const f = lib.f;
		const set = (k, v, now = true) => {
			f[k] = v;
			if (now) search();
		};
		const typeSet = d.tagSets.find((s) => s.id === 'type') || { tags: [] };
		const interSet = d.tagSets.find((s) => s.id === 'interaction') || { tags: [] };

		// topic choices: units / topics / subtopics of each content tree
		const nodeOpts = [['', 'Any objective']];
		for (const t of d.objectiveTrees) {
			const ix = S.treeIndex(t);
			for (const n of ix.flat()) {
				if (n.hidden) continue;
				const r = S.rankOf(t, n, ix);
				if (r > (t.kindLevels ? 2 : 1)) continue;
				nodeOpts.push([n.id, `${'  '.repeat(ix.depth(n))}${n.code} ${n.text}`.slice(0, 90)]);
			}
		}
		const q = app.input({ type: 'search', value: f.q, placeholder: 'Words in the title, notes, topic…', 'aria-label': 'Search' });
		let t0 = 0;
		q.addEventListener('input', () => {
			clearTimeout(t0);
			t0 = setTimeout(() => set('q', q.value.trim()), 300);
		});
		const sel = (key, opts, label) => {
			const s = app.select(opts, f[key], { 'aria-label': label });
			s.addEventListener('change', () => set(key, s.value));
			return app.field(label, s);
		};
		const num = (key, label) => {
			const i = app.input({ type: 'number', min: '0', step: '5', value: f[key], 'aria-label': label });
			i.addEventListener('change', () => set(key, i.value));
			return app.field(label, i);
		};
		const mine = el('input', { type: 'checkbox', checked: f.mine });
		mine.addEventListener('change', () => set('mine', mine.checked));

		const filters = el(
			'aside',
			{ class: 'lib-filters' },
			app.field('Search', q),
			sel('node', nodeOpts, 'Topic or objective'),
			sel('type', [['', 'Any type'], ...typeSet.tags.map((t) => [t.id, t.label])], 'Activity type'),
			sel('assessment', [['', 'Any'], ...S.ASSESSMENT], 'Assessment'),
			sel('interaction', [['', 'Any'], ...interSet.tags.map((t) => [t.id, t.label])], 'Student interaction'),
			sel('where', [['', 'In or out of class'], ['1', 'In class'], ['0', 'Outside class']], 'Where'),
			el('div', { class: 'sched-row2' }, num('min', 'Min minutes'), num('max', 'Max minutes')),
			el('label', { class: 'sched-check' }, mine, ' Only what I’ve shared'),
			sel('sort', [['new', 'Recently updated'], ['popular', 'Most pulled'], ['title', 'Title'], ['minutes', 'Shortest first']], 'Sort'),
			app.btn('Clear filters', () => {
				Object.assign(f, { q: '', node: '', type: '', assessment: '', interaction: '', where: '', min: '', max: '', mine: false });
				search();
			})
		);

		const inCourse = new Map();
		for (const a of d.activities) if (a.libraryId) inCourse.set(a.libraryId, a);
		const list = el(
			'div',
			{ class: 'lib-results' },
			el(
				'div',
				{ class: 'lib-head' },
				el('strong', { text: lib.loading ? 'Searching…' : `${lib.total} activit${lib.total === 1 ? 'y' : 'ies'}` }),
				el('span', { class: 'ht-spacer' }),
				app.btn('Share my activities…', () => shareDialog(), 'btn-blue'),
				app.btn('Refresh', () => (refreshVersions(), search()))
			),
			lib.error ? el('p', { class: 'sched-summary error', text: lib.error }) : null,
			...lib.results.map((r) => card(r, inCourse.get(r.id))),
			!lib.loading && !lib.results.length && !lib.error ? el('p', { class: 'sched-hint', text: 'Nothing matches. Try fewer filters — or share some of your own activities.' }) : null
		);

		const chosen = lib.results.find((r) => r.id === lib.sel);
		const detail = el('aside', { class: 'lib-detail' }, chosen ? detailPane(chosen, inCourse.get(chosen.id)) : el('p', { class: 'sched-hint', text: 'Pick an activity to see it and add it to your course.' }));
		container.replaceChildren(el('div', { class: 'lib-page' }, filters, list, detail));
	}

	const short = (email) => (email || '').split('@')[0];
	function chips(it) {
		return [
			it.type ? el('span', { class: 'lib-chip', style: { borderColor: it.type.color, color: it.type.color }, text: it.type.label }) : null,
			it.expectedMin !== null && it.expectedMin !== undefined ? el('span', { class: 'lib-chip', text: `${it.expectedMin} min` }) : null,
			it.assessment !== 'none' ? el('span', { class: 'lib-chip ' + it.assessment, text: it.assessment }) : null,
			el('span', { class: 'lib-chip', text: it.inClass ? 'in class' : 'outside class' }),
			it.interaction ? el('span', { class: 'lib-chip', text: it.interaction.label }) : null
		];
	}

	function card(r, copy) {
		const it = r.item;
		const behind = copy && copy.libraryVersion < r.version;
		return el(
			'button',
			{ type: 'button', class: 'lib-card' + (lib.sel === r.id ? ' sel' : ''), onclick: () => ((lib.sel = r.id), draw()) },
			el('div', { class: 'lib-title' }, it.title, copy ? el('span', { class: 'lib-badge' + (behind ? ' warn' : ''), text: behind ? 'update available' : 'in your course' }) : null),
			el('div', { class: 'lib-chips' }, chips(it)),
			el(
				'div',
				{ class: 'lib-meta' },
				(it.objectiveCodes.slice(0, 5).join(' · ') || 'no objectives') + (it.objectiveCodes.length > 5 ? ` +${it.objectiveCodes.length - 5}` : ''),
				el('span', { class: 'ht-spacer' }),
				`${r.mine ? 'you' : short(r.owner)} · v${r.version} · pulled ${r.pulls}×`
			)
		);
	}

	function detailPane(r, copy) {
		const d = app.data;
		const it = r.item;
		const mapped = [...new Set(it.objectiveCodes.flatMap((c) => L.nodesForCode(d, c)))];
		const missing = it.objectiveCodes.filter((c) => !L.nodesForCode(d, c).length);
		const date = app.input({ type: 'date', value: S.today() >= d.course.termStart && S.today() <= d.course.termEnd ? S.today() : d.course.termStart });
		const parts = [
			el('h2', { class: 'lib-dtitle', text: it.title }),
			el('div', { class: 'lib-chips' }, chips(it)),
			el('p', { class: 'sched-hint', text: `Shared by ${r.mine ? 'you' : r.owner} · version ${r.version} · updated ${new Date(r.updatedAt).toLocaleDateString()} · added to courses ${r.pulls}×${r.forkedFrom ? ' · adapted from another library activity' : ''}` }),
			it.topicHint ? el('p', null, el('strong', { text: 'Used with: ' }), it.topicHint) : null,
			el(
				'div',
				{ class: 'ht-field' },
				el('span', { text: 'Objectives' }),
				el('div', { class: 'obj-chips' }, it.objectiveCodes.map((c) => el('span', { class: 'obj-chip' + (missing.includes(c) ? ' missing' : ''), title: missing.includes(c) ? 'Not in this course’s objectives' : '', text: c }))),
				el('span', { class: 'sched-hint', text: `Links to ${mapped.length} objective${mapped.length === 1 ? '' : 's'} in this course` + (missing.length ? `; ${missing.length} code${missing.length === 1 ? '' : 's'} not found here` : '') + '.' })
			),
			it.spanMeetings ? el('p', { class: 'sched-hint', text: `Spans ${it.spanMeetings + 1} class meetings.` }) : null,
			it.links.length
				? el('div', { class: 'ht-field' }, el('span', { text: 'Files and links' }), el('ul', { class: 'lib-links' }, it.links.map((l) => el('li', null, el('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', text: l.label || l.url })))))
				: null,
			it.notes ? el('div', { class: 'ht-field' }, el('span', { text: 'Notes' }), el('p', { class: 'lib-notes', text: it.notes })) : null
		];
		const add = async (onDate) => {
			let entry = r;
			try {
				entry = await HT.api('library/' + r.id + '/pull', { method: 'POST', body: {} });
			} catch {}
			app.commit((dd) => {
				const a = S.newActivity({ ...L.fields(dd, entry), ...datesFrom(dd, onDate ? date.value : null, entry.item.spanMeetings) });
				// already have a linked copy? then this one is a separate copy (one link per course)
				dd.activities.push(dd.activities.some((x) => x.libraryId === entry.id) ? S.unlinkedCopy(a, { id: a.id }) : a);
			});
			lib.versions[r.id] = { version: entry.version, owner: entry.owner, mine: entry.mine };
			app.flash(onDate ? `Added “${it.title}” on ${S.fmtShort(date.value)}` : `Added “${it.title}” to your activity bank`);
			search();
		};
		const actions = el('div', { class: 'lib-actions' });
		actions.append(app.btn('Add to activity bank', () => add(false), 'btn-blue'), el('div', { class: 'set-line' }, date, app.btn('Add on this date', () => add(true))));
		if (copy && copy.libraryVersion < r.version)
			actions.append(
				app.btn(`Update my copy to version ${r.version}`, () => {
					app.commit((dd) => {
						const a = dd.activities.find((x) => x.id === copy.id);
						Object.assign(a, L.fields(dd, r));
					});
					app.flash('Your copy now matches the library (dates kept)');
					draw();
				})
			);
		if (r.mine) {
			actions.append(
				el(
					'div',
					{ class: 'set-line' },
					app.btn('Edit in library…', () => editDialog(r)),
					(() => {
						const b = app.btn('Remove from library', async () => {
							if (!b.dataset.armed) {
								b.dataset.armed = '1';
								b.textContent = 'Confirm: remove for everyone';
								b.classList.add('btn-red');
								return;
							}
							try {
								await del('library/' + r.id);
								lib.sel = null;
								app.flash('Removed from the library. Copies already in courses stay.');
								search();
							} catch (err) {
								lib.error = err.message;
								draw();
							}
						});
						return b;
					})()
				)
			);
		}
		parts.push(actions);
		return el('div', { class: 'lib-dwrap' }, parts);
	}

	/* Owner edits an item directly in the library */
	function editDialog(r) {
		const it = r.item;
		const d = app.data;
		const typeSet = d.tagSets.find((s) => s.id === 'type') || { tags: [] };
		const title = app.input({ type: 'text', value: it.title });
		const typeOpts = [['', '—'], ...typeSet.tags.map((t) => [t.id, t.label])];
		if (it.type && !typeSet.tags.some((t) => t.id === it.type.id)) typeOpts.push([it.type.id, it.type.label]);
		const type = app.select(typeOpts, it.type ? it.type.id : '');
		const assess = app.select(S.ASSESSMENT, it.assessment);
		const mins = app.input({ type: 'number', min: '0', step: '5', value: it.expectedMin ?? '' });
		const inClass = el('input', { type: 'checkbox', checked: it.inClass });
		const codes = el('textarea', { class: 'ht-input', rows: '2', text: it.objectiveCodes.join(', ') });
		const links = el('textarea', { class: 'ht-input', rows: '3', placeholder: 'Label | https://…  (one per line)', text: it.links.map((l) => `${l.label} | ${l.url}`).join('\n') });
		const notes = el('textarea', { class: 'ht-input', rows: '4', text: it.notes });
		const body = el(
			'div',
			{ class: 'sched-form' },
			app.field('Title', title),
			el('div', { class: 'sched-row2' }, app.field('Activity type', type), app.field('Assessment', assess)),
			el('div', { class: 'sched-row2' }, app.field('Expected minutes', mins), el('label', { class: 'sched-check' }, inClass, ' In class')),
			app.field('Objective codes (comma separated, e.g. 1.2.A, 2.4.A.3, SP-1.A)', codes),
			app.field('Files and links', links),
			app.field('Notes', notes)
		);
		const m = app.dialog('Edit library activity', body, [
			el('span', { class: 'ht-spacer' }),
			app.btn('Cancel', () => m.close()),
			app.btn(
				'Save to library',
				async () => {
					const t = typeSet.tags.find((x) => x.id === type.value) || (it.type && it.type.id === type.value ? it.type : null);
					const item = {
						...it,
						title: title.value.trim(),
						type: t ? { id: t.id, label: t.label, color: t.color } : null,
						assessment: assess.value,
						expectedMin: mins.value === '' ? null : +mins.value,
						inClass: inClass.checked,
						objectiveCodes: codes.value.split(/[\s,]+/).filter(Boolean),
						links: links.value
							.split('\n')
							.map((line) => {
								const [a, b] = line.includes('|') ? line.split('|') : ['', line];
								return { label: a.trim(), url: (b || '').trim() };
							})
							.filter((l) => l.url),
						notes: notes.value
					};
					try {
						await HT.api('library/' + r.id, { method: 'PUT', body: { item, baseVersion: r.version } });
						m.close();
						app.flash('Saved to the library');
						search();
					} catch (err) {
						m.error(err.status === 409 ? 'Someone (maybe you, elsewhere) changed this since it loaded. Close, refresh and try again.' : err.message);
					}
				},
				'btn-blue'
			)
		], { wide: true });
	}

	/* ------------------------------------------------------------------ */
	/* Share (merge) course activities into the library                    */
	/* ------------------------------------------------------------------ */

	const STATUS_TEXT = {
		new: 'New — not in the library yet (a copy is added as its own activity)',
		changed: 'Changed since you shared it',
		'modified-copy': 'Your edited copy of someone else’s — shares as your own version',
		synced: 'Up to date',
		copy: 'Unchanged copy of someone else’s'
	};

	async function shareDialog(onlyIds) {
		const me = await whoAmI();
		if (!me || me.role !== 'teacher') return app.flash(me ? 'Only teacher accounts can share to the library.' : 'Sign in with a teacher account to use the library (see the Library tab).');
		const d = app.data;
		const rows = d.activities
			.map((a) => ({ a, st: L.status(d, a, me) }))
			.filter((x) => (onlyIds ? onlyIds.includes(x.a.id) : true))
			.sort((x, y) => (x.a.start || '9999').localeCompare(y.a.start || '9999'));
		const pending = rows.filter((x) => ['new', 'changed', 'modified-copy'].includes(x.st));
		const quiet = rows.length - pending.length;
		const filter = app.input({ type: 'search', placeholder: 'Filter', 'aria-label': 'Filter activities' });
		const box = el('div', { class: 'share-list' });
		const checks = new Map();
		const drawList = () => {
			const ql = filter.value.toLowerCase();
			box.replaceChildren(
				...pending
					.filter((x) => !ql || x.a.title.toLowerCase().includes(ql))
					.map((x) => {
						if (!checks.has(x.a.id)) checks.set(x.a.id, x.st !== 'modified-copy' || !!onlyIds);
						const cb = el('input', { type: 'checkbox', checked: checks.get(x.a.id) });
						cb.addEventListener('change', () => checks.set(x.a.id, cb.checked));
						return el(
							'label',
							{ class: 'share-row' },
							cb,
							el('span', { class: 'share-title', text: x.a.title }),
							el('span', { class: 'share-date', text: x.a.start ? S.fmtShort(x.a.start) : 'bank' }),
							el('span', { class: 'share-st st-' + x.st, text: STATUS_TEXT[x.st] })
						);
					})
			);
			if (!pending.length) box.append(el('p', { class: 'sched-hint', text: 'Everything in this course is already in the library, or a copy you haven’t changed.' }));
		};
		filter.addEventListener('input', drawList);
		drawList();
		const all = app.btn('Select all', () => (pending.forEach((x) => checks.set(x.a.id, true)), drawList()));
		const none = app.btn('Select none', () => (pending.forEach((x) => checks.set(x.a.id, false)), drawList()));
		const body = el(
			'div',
			{ class: 'sched-form' },
			el('p', {
				class: 'sched-hint',
				text: 'Shared activities can be found and copied by every teacher on this site. Dates stay private; the library keeps the activity, its type, time, objectives (as AP codes), links and notes. Activities you shared before are updated in place.'
			}),
			el('div', { class: 'set-line' }, filter, all, none),
			box,
			quiet ? el('p', { class: 'sched-hint', text: `${quiet} other activit${quiet === 1 ? 'y is' : 'ies are'} up to date or unchanged copies.` }) : null
		);
		const send = async (force) => {
			const picked = pending.filter((x) => checks.get(x.a.id));
			if (!picked.length) return m.error('Pick at least one activity.');
			const entries = picked.map((x) => {
				const item = L.toItem(d, x.a);
				if (x.st === 'new') return x.a.libraryForkedFrom ? { item, forkedFrom: x.a.libraryForkedFrom } : { item };
				if (x.st === 'changed') return { id: x.a.libraryId, baseVersion: force ? undefined : x.a.libraryVersion, item };
				return { id: x.a.libraryId, item }; // someone else's: the server makes it a new item of yours
			});
			let res;
			try {
				res = await HT.api('library/batch', { method: 'POST', body: { entries } });
			} catch (err) {
				return m.error(err.message);
			}
			const conflicts = [];
			app.commit((dd) => {
				res.results.forEach((r, i) => {
					const a = dd.activities.find((x) => x.id === picked[i].a.id);
					if (!a) return;
					if (r.status === 'conflict') return conflicts.push(a.title);
					if (r.status === 'error') return;
					a.libraryId = r.id;
					a.libraryVersion = r.version;
					a.libraryOwner = me.email;
					a.librarySig = L.sig(L.toItem(dd, a));
				});
			});
			const done = res.results.filter((r) => ['created', 'updated', 'unchanged'].includes(r.status)).length;
			if (conflicts.length) {
				m.error(`${conflicts.length} had been changed in the library since you last shared them (${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '…' : ''}). “Share anyway” replaces the library version with yours.`);
				sendBtn.textContent = 'Share anyway';
				sendBtn.onclick = () => send(true);
				pending.forEach((x) => checks.set(x.a.id, conflicts.includes(x.a.title)));
				drawList();
				return;
			}
			m.close();
			app.flash(`Shared ${done} activit${done === 1 ? 'y' : 'ies'} to the library`);
			await refreshVersions();
			if (app.view === 'library') search();
		};
		const sendBtn = app.btn('Share selected', () => send(false), 'btn-blue');
		const m = app.dialog('Share to the library', body, [el('span', { class: 'ht-spacer' }), app.btn('Cancel', () => m.close()), sendBtn], { wide: true });
	}
	L.shareDialog = shareDialog;

	/* ------------------------------------------------------------------ */
	/* A line in the activity editor                                       */
	/* ------------------------------------------------------------------ */

	(app.editorExtras = app.editorExtras || []).push((o, kind) => {
		if (kind !== 'activity') return null;
		const me = lib.me;
		const st = me ? L.status(app.data, o, me) : o.libraryId ? 'copy' : 'new';
		const v = o.libraryId && lib.versions[o.libraryId];
		const behind = v && v.version > (o.libraryVersion || 0);
		const text = !o.libraryId
			? o.libraryForkedFrom
				? 'A separate copy of a library activity — sharing it adds a new library activity; the original is not changed.'
				: 'Not in the shared library.'
			: st === 'synced'
				? `Shared to the library (version ${o.libraryVersion}).`
				: st === 'changed'
					? 'Shared to the library — you’ve changed it since.'
					: `From ${short(o.libraryOwner)}’s library activity (version ${o.libraryVersion})${st === 'modified-copy' ? ', changed here' : ''}.`;
		return el(
			'div',
			{ class: 'ed-lib' },
			el('span', { class: 'sched-hint', text: text + (behind ? ` Version ${v.version} is available in the Library.` : '') }),
			['new', 'changed', 'modified-copy'].includes(st) ? app.btn(st === 'changed' ? 'Update library' : 'Share to library', () => shareDialog([o.id])) : null
		);
	});
})();
