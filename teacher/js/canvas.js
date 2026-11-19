/* Theta Canvas (teacher/canvas.html): manage a Canvas course's content — assignments and groups, quizzes
   (Classic and New), modules, pages, announcements, and due dates — through the Happy Theta server.
   Course content only: no students, submissions or grades (the server enforces this too). */
(function () {
	'use strict';
	const U = HT.QUI, h = U.h, CV = HT.Canvas;
	const S = { conn: null, courses: [], course: null, courseObj: null, tab: 'assign', d: {}, loading: false, err: '', open: new Set() };
	const $ = {};
	const TABS = [['assign', 'Assignments'], ['quizzes', 'Quizzes'], ['modules', 'Modules'], ['pages', 'Pages'], ['ann', 'Announcements'], ['dates', 'Dates']];
	const cp = (rest = '') => `/api/v1/courses/${S.course}${rest}`;
	const nq = (rest = '') => `/api/quiz/v1/courses/${S.course}${rest}`;
	const field = (label, input, cls) => h('label', { class: 'qb-field ' + (cls || '') }, h('span', { text: label }), input);
	const chk = (label, checked) => { const i = h('input', { type: 'checkbox', checked: !!checked }); return [h('label', { class: 'qb-check' }, i, ' ' + label), i]; };
	const dt = (iso) => h('input', { class: 'qb-input', type: 'datetime-local', value: CV.toLocal(iso) });
	const num = (v, attrs = {}) => h('input', { class: 'qb-input', type: 'number', step: 'any', value: v == null ? '' : v, ...attrs });
	async function act(fn, ok) {
		try { const r = await fn(); if (ok) U.toast(ok); return r; }
		catch (e) { if (e.status === 401 || /access token/.test(e.message)) S.conn = null; U.toast(e.message, { error: true, ms: 8000 }); throw e; }
	}
	const pubBadge = (p) => h('span', { class: 'qb-badge ' + (p ? 'ok' : ''), text: p ? 'Published' : 'Unpublished' });

	/* ======================== shell ======================== */
	function build() {
		const content = document.querySelector('.app .content') || document.body;
		$.courseSel = h('select', { class: 'qb-select bank', 'aria-label': 'Canvas course', onchange: () => selectCourse($.courseSel.value) });
		$.connBtn = U.btn('Connection', connectionDialog, '', 'cloud');
		$.openLink = h('a', { class: 'qb-btn', target: '_blank', rel: 'noopener' }, h('span', { text: 'Open in Canvas ↗' }));
		$.head = h('header', { class: 'qb-head' },
			h('div', { class: 'qb-title' }, h('span', { class: 'qb-app', text: 'Theta Canvas' }), h('div', { class: 'qb-row tight' }, $.courseSel)),
			h('div', { class: 'qb-actions' }, $.status = h('span', { class: 'qb-status' }), U.btn('Refresh', () => load(true), '', null, 'Reload from Canvas'), $.openLink, $.connBtn));
		$.tabs = h('nav', { class: 'qb-tabs' }, TABS.map(([k, t]) => h('button', { type: 'button', class: 'qb-tab', dataset: { k }, text: t, onclick: () => { S.tab = k; renderTabs(); load(); } })));
		$.main = h('div', { class: 'cv-main' });
		content.append(h('div', { class: 'qb' }, $.head, h('div', { class: 'qb-subhead' }, $.tabs, h('span', { class: 'qb-hint cv-note', text: 'Course content only — Theta Canvas never reads students, submissions or grades.' })), $.main));
	}
	function renderTabs() { $.tabs.querySelectorAll('.qb-tab').forEach((b) => b.classList.toggle('on', b.dataset.k === S.tab)); }
	const setStatus = (t) => { $.status.textContent = t || ''; };

	async function start() {
		build();
		renderTabs();
		if (!U.isTeacher()) {
			U.fill($.main, h('div', { class: 'qb-empty' }, h('h2', { text: 'Theta Canvas' }), h('p', { text: 'Manage your Canvas course’s assignments, quizzes, modules, pages and announcements from here.' }), h('p', { text: 'It needs a teacher account: sign in on the Teacher Tools dashboard (it isn’t available in guest preview).' }), h('a', { class: 'qb-btn primary', href: 'index.html' }, 'Teacher Tools')));
			$.head.querySelector('.qb-actions').hidden = true;
			return;
		}
		try { S.conn = await CV.connection(true); } catch (e) { U.fill($.main, h('p', { class: 'qb-err', text: e.message })); return; }
		if (!S.conn.configured) return U.fill($.main, h('div', { class: 'qb-empty' }, h('h2', { text: 'Theta Canvas isn’t switched on yet' }), h('p', { text: 'The site’s administrator needs to set CANVAS_TOKEN_KEY in /etc/happytheta/api.env and restart the API (see server/README.md, “Theta Canvas”).' })));
		if (!S.conn.connected) return connectView();
		await loadCourses();
	}
	async function loadCourses() {
		setStatus('Loading courses…');
		try { S.courses = await CV.courses(); } catch (e) { setStatus(''); return U.fill($.main, h('div', { class: 'qb-empty' }, h('p', { class: 'qb-err', text: e.message }), U.btn('Connection settings', connectionDialog, 'primary'))); }
		setStatus('');
		S.courses.sort((a, b) => String(a.name).localeCompare(String(b.name)));
		const saved = CV.courseId;
		U.fill($.courseSel, h('option', { value: '', text: S.courses.length ? 'Choose a course…' : 'No teaching courses found' }), S.courses.map((c) => h('option', { value: c.id, text: `${c.name}${c.term && c.term.name && !/default/i.test(c.term.name) ? ' · ' + c.term.name : ''}`, selected: String(c.id) === saved })));
		$.connBtn.title = `${S.conn.name || 'Connected'} · ${S.conn.baseUrl} · token ${S.conn.tokenHint}`;
		if (saved && S.courses.some((c) => String(c.id) === saved)) selectCourse(saved);
		else U.fill($.main, h('div', { class: 'qb-empty' }, h('p', { text: 'Choose one of your Canvas courses above.' })));
	}
	function selectCourse(id) {
		S.course = id || null;
		CV.courseId = id;
		S.d = {};
		S.courseObj = S.courses.find((c) => String(c.id) === String(id)) || null;
		$.openLink.href = id ? CV.courseUrl(id) : '#';
		$.openLink.hidden = !id;
		if (id) load(true);
	}

	/* ======================== connection ======================== */
	function connectForm(onDone) {
		const base = h('input', { class: 'qb-input', placeholder: 'https://yourschool.instructure.com', value: (S.conn && S.conn.baseUrl) || '' });
		const tok = h('input', { class: 'qb-input mono', type: 'password', autocomplete: 'off', placeholder: S.conn && S.conn.connected ? `Saved (${S.conn.tokenHint}) — paste a new one to replace it` : 'Paste the token here' });
		const msg = h('p', { class: 'qb-hint' });
		const go = U.btn('Connect', async () => {
			msg.textContent = 'Checking with Canvas…'; msg.className = 'qb-hint';
			try {
				const r = await CV.connect(base.value.trim(), tok.value.trim());
				tok.value = '';
				S.conn = await CV.connection(true);
				U.toast(`Connected as ${r.name}.`);
				onDone && onDone();
				await loadCourses();
			} catch (e) { msg.textContent = e.message; msg.className = 'qb-err'; }
		}, 'primary');
		return h('div', { class: 'cv-connect' },
			field('Canvas address', base),
			field('Access token', tok),
			h('div', { class: 'qb-row' }, go, msg),
			h('details', { class: 'cv-help' }, h('summary', { text: 'How to make an access token' }),
				h('ol', { class: 'qb-notes', style: { listStyle: 'decimal' } },
					h('li', null, 'In Canvas, click your picture (Account) › Settings.'),
					h('li', null, 'Under “Approved Integrations”, click “+ New Access Token”.'),
					h('li', null, 'Purpose: “Happy Theta”. Give it an expiry date (for example the end of the school year), then Generate Token.'),
					h('li', null, 'Copy the token (Canvas shows it only once) and paste it here.')),
				h('p', { class: 'qb-hint', text: 'The token lets programs act as you in Canvas. Happy Theta stores it encrypted, only uses it for course-content requests (assignments, quizzes, modules, pages, announcements), never for students or grades, and never shows it again. You can delete it here (Forget) or in Canvas at any time.' }))
		);
	}
	function connectView() {
		U.fill($.main, h('div', { class: 'cv-welcome' }, h('h2', { text: 'Connect to Canvas' }), h('p', { text: 'Theta Canvas manages your course’s assignments, quizzes, modules, pages and announcements. Connect it once with a Canvas access token; it’s saved (encrypted) to your Happy Theta teacher account, so it works on any computer you sign in on.' }), connectForm()));
		U.fill($.courseSel, h('option', { text: 'Not connected' }));
		$.openLink.hidden = true;
	}
	function connectionDialog() {
		const c = S.conn || {};
		U.modal('Canvas connection', h('div', { class: 'qb-col' },
			c.connected ? h('p', null, 'Connected as ', h('b', { text: c.name || '?' }), ` to ${c.baseUrl} (token ${c.tokenHint}).`) : h('p', { text: 'Not connected.' }),
			connectForm(() => document.querySelector('.qb-dlg') && document.querySelector('.qb-dlg').close())),
		[...(c.connected ? [{ label: 'Forget token', cls: 'danger', click: async () => { await CV.disconnect(); S.conn = await CV.connection(true); connectView(); U.toast('Token deleted from Happy Theta. (You can also delete it in Canvas › Settings.)'); } }] : []), { label: 'Close' }], { wide: true });
	}

	/* ======================== loading ======================== */
	const NEEDS = { assign: ['groups', 'assignments', 'course'], quizzes: ['quizzes', 'nquizzes', 'groups'], modules: ['modules'], pages: ['pages'], ann: ['ann'], dates: ['assignments', 'groups', 'quizzes'] };
	const LOADERS = {
		groups: () => CV.get(cp('/assignment_groups')),
		assignments: () => CV.get(cp('/assignments'), { order_by: 'position' }),
		course: () => CV.get(cp('')),
		quizzes: () => CV.get(cp('/quizzes')),
		nquizzes: () => CV.get(nq('/quizzes')).catch(() => null), // null: New Quizzes not available in this course
		modules: () => CV.get(cp('/modules'), { 'include[]': 'items' }),
		pages: () => CV.get(cp('/pages'), { sort: 'title' }),
		ann: () => CV.get(cp('/discussion_topics'), { only_announcements: 'true' })
	};
	async function need(keys, force) {
		await Promise.all(keys.filter((k) => force || !(k in S.d)).map(async (k) => { S.d[k] = await LOADERS[k](); }));
	}
	async function load(force) {
		if (!S.course) return;
		renderTabs();
		setStatus('Loading…');
		U.fill($.main, h('p', { class: 'qb-hint cv-pad', text: 'Loading from Canvas…' }));
		try {
			if (force) S.d = {};
			await need(NEEDS[S.tab], false);
			setStatus('');
			render();
		} catch (e) {
			setStatus('');
			U.fill($.main, h('div', { class: 'qb-empty' }, h('p', { class: 'qb-err', text: e.message }), U.btn('Try again', () => load(true)), /access token|connect/i.test(e.message) ? U.btn('Connection settings', connectionDialog, 'primary') : null));
		}
	}
	async function reload(keys) { await need(keys, true); render(); }
	function render() {
		const keep = $.main.scrollTop;
		({ assign: renderAssign, quizzes: renderQuizzes, modules: renderModules, pages: renderPages, ann: renderAnn, dates: renderDates })[S.tab]();
		$.main.scrollTop = keep;
	}

	/* ======================== assignments ======================== */
	const kindOf = (a) => (a.is_quiz_assignment || a.quiz_id ? 'quiz' : a.is_quiz_lti_assignment ? 'nquiz' : (a.submission_types || []).includes('discussion_topic') ? 'disc' : 'assign');
	const KIND = { quiz: ['Quiz', 't-mc'], nquiz: ['New Quiz', 't-ma'], disc: ['Discussion', 't-match'], assign: ['Assignment', 't-num'] };
	function renderAssign() {
		const groups = (S.d.groups || []).slice().sort((a, b) => a.position - b.position);
		const weighted = !!(S.d.course && S.d.course.apply_assignment_group_weights);
		const byGroup = new Map(groups.map((g) => [g.id, []]));
		for (const a of S.d.assignments || []) (byGroup.get(a.assignment_group_id) || byGroup.set(a.assignment_group_id, []).get(a.assignment_group_id)).push(a);
		const total = groups.reduce((s, g) => s + (Number(g.group_weight) || 0), 0);
		U.fill($.main, h('div', { class: 'cv-pad cv-col' },
			h('div', { class: 'qb-row' },
				U.btn('Assignment', () => editAssignment(null), 'primary', 'plus'), U.btn('Group', () => editGroup(null), '', 'plus'),
				h('label', { class: 'qb-check', title: 'Canvas: “Weight final grade based on assignment groups”' }, h('input', { type: 'checkbox', checked: weighted, onchange: async (e) => { await act(() => CV.put(cp(''), { course: { apply_assignment_group_weights: e.target.checked } }), e.target.checked ? 'Group weights on.' : 'Group weights off.').catch(() => {}); reload(['course']); } }), ' Weight the final grade by group'),
				weighted ? h('span', { class: 'qb-hint' + (Math.abs(total - 100) > 0.01 ? ' cv-warnt' : ''), text: `weights total ${Math.round(total * 100) / 100}%` }) : null),
			groups.length ? null : h('p', { class: 'qb-hint', text: 'No assignment groups yet.' }),
			...groups.map((g) => {
				const items = (byGroup.get(g.id) || []).sort((a, b) => (a.position || 0) - (b.position || 0));
				return h('section', { class: 'cv-card' },
					h('div', { class: 'cv-card-head' }, h('b', { text: g.name }), weighted ? h('span', { class: 'qb-badge', text: (g.group_weight || 0) + '%' }) : null, h('span', { class: 'qb-hint', text: `${items.length} item${items.length === 1 ? '' : 's'} · ${items.reduce((s, a) => s + (a.points_possible || 0), 0)} pts` }), h('span', { class: 'grow' }),
						U.btn('', () => editGroup(g), 'icon xs', 'copy', 'Edit group'), U.btn('', () => deleteGroup(g), 'icon xs', 'trash', 'Delete group')),
					items.length ? h('div', { class: 'cv-rows' }, items.map(assignRow)) : h('p', { class: 'qb-hint cv-padx', text: 'Empty.' }));
			})
		));
	}
	function assignRow(a) {
		const k = kindOf(a);
		return h('div', { class: 'cv-row' },
			h('span', { class: 'qb-type ' + KIND[k][1], text: KIND[k][0] }),
			h('a', { class: 'cv-name', href: a.html_url, target: '_blank', rel: 'noopener', text: a.name }),
			h('span', { class: 'cv-meta', text: `${a.points_possible != null ? a.points_possible + ' pts' : ''}${a.due_at ? ' · due ' + CV.fmt(a.due_at) : ''}` }),
			pubToggle(a.published, (v) => (k === 'quiz' ? CV.put(cp(`/quizzes/${a.quiz_id}`), { quiz: { published: v } }) : CV.put(cp(`/assignments/${a.id}`), { assignment: { published: v } })), ['assignments', 'quizzes']),
			U.btn('', () => (k === 'quiz' ? editClassicQuiz(a.quiz_id) : k === 'nquiz' ? editNewQuiz(a.id) : editAssignment(a)), 'icon xs', 'copy', 'Edit'),
			U.btn('', () => deleteAssignment(a), 'icon xs', 'trash', 'Delete'));
	}
	function pubToggle(on, call, reloadKeys) {
		return h('button', { type: 'button', class: 'cv-pub' + (on ? ' on' : ''), title: on ? 'Published — click to unpublish' : 'Unpublished — click to publish', 'aria-pressed': String(!!on), onclick: async () => { await act(() => call(!on), !on ? 'Published.' : 'Unpublished.').catch(() => {}); reload(reloadKeys.filter((k) => k in S.d)); } }, on ? '● Published' : '○ Unpublished');
	}
	function htmlEditor(html, label = 'Description') {
		const ta = h('textarea', { class: 'qb-input mono', rows: 8, value: html || '', placeholder: 'HTML, e.g. <p>Read section 2.3 and answer…</p>' });
		const frame = h('iframe', { class: 'cv-preview', sandbox: '', title: 'Preview' });
		const pv = h('label', { class: 'qb-check' }, h('input', { type: 'checkbox', onchange: (e) => { frame.hidden = !e.target.checked; ta.hidden = e.target.checked; frame.srcdoc = `<style>body{font:15px system-ui;margin:8px}</style>${ta.value}`; } }), ' Preview');
		frame.hidden = true;
		return { el: h('div', { class: 'qb-field cv-span' }, h('div', { class: 'qb-row' }, h('span', { class: 'cv-lbl', text: label }), pv), ta, frame), get value() { return ta.value; } };
	}
	function datesBlock(o) {
		const due = dt(o.due_at), un = dt(o.unlock_at), lock = dt(o.lock_at);
		return { el: h('div', { class: 'cv-dates cv-span' }, field('Due', due), field('Available from', un), field('Until', lock)), get: () => ({ due_at: CV.fromLocal(due.value), unlock_at: CV.fromLocal(un.value), lock_at: CV.fromLocal(lock.value) }) };
	}
	const groupSelect = (id) => h('select', { class: 'qb-select' }, (S.d.groups || []).map((g) => h('option', { value: g.id, text: g.name, selected: g.id === id })));
	async function editAssignment(a) {
		await need(['groups']);
		const isNew = !a;
		a = a || { name: '', points_possible: 10, submission_types: ['online_upload'], grading_type: 'points', published: false, assignment_group_id: (S.d.groups[0] || {}).id };
		const name = h('input', { class: 'qb-input', value: a.name });
		const pts = num(a.points_possible, { min: 0 });
		const grp = groupSelect(a.assignment_group_id);
		const gt = h('select', { class: 'qb-select' }, [['points', 'Points'], ['percent', 'Percentage'], ['pass_fail', 'Complete / incomplete'], ['letter_grade', 'Letter grade'], ['gpa_scale', 'GPA scale'], ['not_graded', 'Not graded']].map(([v, t]) => h('option', { value: v, text: t, selected: a.grading_type === v })));
		const TYPES = [['online_text_entry', 'Text entry'], ['online_upload', 'File upload'], ['online_url', 'Website URL'], ['media_recording', 'Media recording'], ['on_paper', 'On paper'], ['none', 'No submission']];
		const st = TYPES.map(([v, t]) => chk(t, (a.submission_types || []).includes(v)));
		const [pubL, pub] = chk('Published', a.published);
		const desc = htmlEditor(a.description);
		const dates = datesBlock(a);
		const r = await U.modal(isNew ? 'New assignment' : 'Edit assignment', h('div', { class: 'cv-form' },
			field('Name', name, 'cv-span'), field('Points', pts), field('Group', grp), field('Display grade as', gt),
			h('div', { class: 'qb-field cv-span' }, h('span', { class: 'cv-lbl', text: 'Submission type' }), h('div', { class: 'qb-row' }, st.map((x) => x[0]))),
			dates.el, desc.el, pubL), [{ label: 'Cancel' }, { label: isNew ? 'Create' : 'Save', cls: 'primary', click: async ({ setMessage }) => {
				if (!name.value.trim()) { setMessage('Give it a name.'); return false; }
				let types = TYPES.filter((_, i) => st[i][1].checked).map(([v]) => v);
				if (types.includes('none') || types.includes('on_paper')) types = types.filter((t) => t === 'none' || t === 'on_paper').slice(0, 1);
				const body = { assignment: { name: name.value.trim(), points_possible: Number(pts.value) || 0, assignment_group_id: Number(grp.value) || undefined, grading_type: gt.value, submission_types: types.length ? types : ['none'], description: desc.value, published: pub.checked, ...dates.get() } };
				await act(() => (isNew ? CV.post(cp('/assignments'), body) : CV.put(cp(`/assignments/${a.id}`), body)), isNew ? 'Assignment created.' : 'Saved.');
			} }], { wide: true });
		if (r) reload(['assignments']);
	}
	async function deleteAssignment(a) {
		if (!(await U.confirm('Delete from Canvas', `Delete “${a.name}” from the Canvas course? Canvas keeps deleted items for a while (Course › /undelete), but student work on it becomes hard to reach.`, 'Delete', 'danger'))) return;
		const k = kindOf(a);
		await act(() => (k === 'quiz' ? CV.del(cp(`/quizzes/${a.quiz_id}`)) : CV.del(cp(`/assignments/${a.id}`))), 'Deleted.').catch(() => {});
		reload(['assignments', ...(k === 'quiz' ? ['quizzes'] : [])].filter((x) => x in S.d || x === 'assignments'));
	}
	async function editGroup(g) {
		const isNew = !g;
		const name = h('input', { class: 'qb-input', value: g ? g.name : '' });
		const w = num(g ? g.group_weight : 0, { min: 0, max: 100 });
		const r = await U.modal(isNew ? 'New assignment group' : 'Edit group', h('div', { class: 'cv-form' }, field('Name', name, 'cv-span'), field('Weight (%)', w), h('p', { class: 'qb-hint cv-span', text: 'Weights only count when “Weight the final grade by group” is on.' })), [{ label: 'Cancel' }, { label: isNew ? 'Create' : 'Save', cls: 'primary', click: async ({ setMessage }) => {
			if (!name.value.trim()) { setMessage('Give it a name.'); return false; }
			const body = { name: name.value.trim(), group_weight: Number(w.value) || 0 };
			await act(() => (isNew ? CV.post(cp('/assignment_groups'), body) : CV.put(cp(`/assignment_groups/${g.id}`), body)), 'Saved.');
		} }]);
		if (r) reload(['groups']);
	}
	async function deleteGroup(g) {
		const others = (S.d.groups || []).filter((x) => x.id !== g.id);
		const count = (S.d.assignments || []).filter((a) => a.assignment_group_id === g.id).length;
		const sel = h('select', { class: 'qb-select' }, h('option', { value: '', text: count ? 'Delete them too' : '—' }), others.map((o) => h('option', { value: o.id, text: 'Move them to ' + o.name, selected: o === others[0] && count > 0 })));
		const r = await U.modal('Delete group', h('div', { class: 'qb-col' }, h('p', { text: `Delete the group “${g.name}”?` }), count ? field(`Its ${count} assignment${count === 1 ? '' : 's'}`, sel) : null), [{ label: 'Cancel' }, { label: 'Delete', cls: 'danger', value: true }]);
		if (!r) return;
		await act(() => CV.del(cp(`/assignment_groups/${g.id}`), sel.value ? { move_assignments_to: sel.value } : {}), 'Group deleted.').catch(() => {});
		reload(['groups', 'assignments']);
	}

	/* ======================== quizzes ======================== */
	function renderQuizzes() {
		const cq = (S.d.quizzes || []).slice().sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { numeric: true }));
		const nqs = S.d.nquizzes;
		U.fill($.main, h('div', { class: 'cv-pad cv-col' },
			h('div', { class: 'qb-row' },
				U.btn('Empty quiz', newQuiz, '', 'plus'),
				U.btn('Import a QTI file…', importQTIFile, '', 'down'),
				h('a', { class: 'qb-btn primary', href: 'quiz-builder.html', title: 'Build a quiz from your question banks, then “Send to Canvas”' }, U.icon('group'), h('span', { text: 'Build in Quiz Builder' }))),
			h('section', { class: 'cv-card' }, h('div', { class: 'cv-card-head' }, h('b', { text: 'Classic Quizzes' }), h('span', { class: 'qb-hint', text: `${cq.length}` })),
				cq.length ? h('div', { class: 'cv-rows' }, cq.map((z) => h('div', { class: 'cv-row' },
					h('span', { class: 'qb-type t-mc', text: { assignment: 'Graded', practice_quiz: 'Practice', graded_survey: 'Survey', survey: 'Survey' }[z.quiz_type] || 'Quiz' }),
					h('a', { class: 'cv-name', href: z.html_url, target: '_blank', rel: 'noopener', text: z.title }),
					h('span', { class: 'cv-meta', text: `${z.question_count || 0} questions · ${z.points_possible || 0} pts${z.time_limit ? ` · ${z.time_limit} min` : ''}${z.due_at ? ' · due ' + CV.fmt(z.due_at) : ''}` }),
					pubToggle(z.published, (v) => CV.put(cp(`/quizzes/${z.id}`), { quiz: { published: v } }), ['quizzes']),
					U.btn('Questions', () => classicQuestions(z), 'sm'),
					U.btn('', () => editClassicQuiz(z.id), 'icon xs', 'copy', 'Settings'),
					U.btn('', async () => { if (await U.confirm('Delete quiz', `Delete “${z.title}” from Canvas?`, 'Delete', 'danger')) { await act(() => CV.del(cp(`/quizzes/${z.id}`)), 'Deleted.').catch(() => {}); reload(['quizzes']); } }, 'icon xs', 'trash', 'Delete')))) : h('p', { class: 'qb-hint cv-padx', text: 'None.' })),
			h('section', { class: 'cv-card' }, h('div', { class: 'cv-card-head' }, h('b', { text: 'New Quizzes' }), h('span', { class: 'qb-hint', text: nqs ? `${nqs.length}` : 'not available in this course' })),
				nqs && nqs.length ? h('div', { class: 'cv-rows' }, nqs.map((z) => h('div', { class: 'cv-row' },
					h('span', { class: 'qb-type t-ma', text: 'New' }),
					h('span', { class: 'cv-name', text: z.title }),
					h('span', { class: 'cv-meta', text: `${z.points_possible || 0} pts${z.due_at ? ' · due ' + CV.fmt(z.due_at) : ''}` }),
					pubToggle(z.published, (v) => CV.put(cp(`/assignments/${z.id}`), { assignment: { published: v } }), ['nquizzes']),
					U.btn('Questions', () => newQuizItems(z), 'sm'),
					U.btn('', () => editNewQuiz(z.id), 'icon xs', 'copy', 'Settings'),
					U.btn('', async () => { if (await U.confirm('Delete quiz', `Delete “${z.title}” from Canvas?`, 'Delete', 'danger')) { await act(() => CV.del(nq(`/quizzes/${z.id}`)), 'Deleted.').catch(() => {}); reload(['nquizzes']); } }, 'icon xs', 'trash', 'Delete')))) : nqs ? h('p', { class: 'qb-hint cv-padx', text: 'None.' }) : null),
			h('p', { class: 'qb-hint', text: 'Questions are written in Theta Questions and sent with Quiz Builder (or a QTI file). Here you can change quiz settings, edit question wording and points, and remove questions.' })
		));
	}
	async function editClassicQuiz(id) {
		await need(['groups']);
		const z = await act(() => CV.get(cp(`/quizzes/${id}`)));
		const title = h('input', { class: 'qb-input', value: z.title });
		const type = h('select', { class: 'qb-select' }, [['assignment', 'Graded quiz'], ['practice_quiz', 'Practice quiz'], ['graded_survey', 'Graded survey'], ['survey', 'Ungraded survey']].map(([v, t]) => h('option', { value: v, text: t, selected: z.quiz_type === v })));
		const grp = groupSelect(z.assignment_group_id);
		const tl = num(z.time_limit, { min: 0, placeholder: 'none' });
		const att = num(z.allowed_attempts === -1 ? '' : z.allowed_attempts, { min: 1, placeholder: 'unlimited' });
		const [shL, sh] = chk('Shuffle answers', z.shuffle_answers), [oneL, one] = chk('One question at a time', z.one_question_at_a_time), [cgbL, cgb] = chk('Lock questions after answering', z.cant_go_back), [scL, sc] = chk('Let students see the correct answers', z.show_correct_answers), [pubL, pub] = chk('Published', z.published);
		const desc = htmlEditor(z.description, 'Instructions');
		const dates = datesBlock(z);
		const r = await U.modal('Quiz settings', h('div', { class: 'cv-form' }, field('Title', title, 'cv-span'), field('Type', type), field('Group', grp), field('Time limit (minutes)', tl), field('Attempts', att), dates.el, h('div', { class: 'qb-col cv-span' }, shL, oneL, cgbL, scL, pubL), desc.el), [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', click: async () => {
			await act(() => CV.put(cp(`/quizzes/${id}`), { quiz: { title: title.value.trim() || z.title, quiz_type: type.value, assignment_group_id: Number(grp.value) || undefined, time_limit: Number(tl.value) || null, allowed_attempts: Number(att.value) || -1, shuffle_answers: sh.checked, one_question_at_a_time: one.checked, cant_go_back: one.checked && cgb.checked, show_correct_answers: sc.checked, published: pub.checked, description: desc.value, notify_of_update: false, ...dates.get() } }), 'Saved.');
		} }], { wide: true });
		if (r) reload(['quizzes', 'assignments'].filter((k) => k in S.d));
	}
	async function classicQuestions(z) {
		const box = h('div', { class: 'cv-qlist' }, h('p', { class: 'qb-hint', text: 'Loading…' }));
		const draw = async () => {
			const qs = await act(() => CV.get(cp(`/quizzes/${z.id}/questions`)));
			U.fill(box, qs.length ? qs.map((q, i) => {
				const right = (q.answers || []).filter((a) => a.weight > 0).map((a) => a.text || a.html || (a.exact != null ? `${a.exact} ± ${a.margin || 0}` : '') || (a.answer_match_left ? `${a.answer_match_left} → ${a.answer_match_right}` : '')).filter(Boolean);
				const frame = h('iframe', { class: 'cv-qtext', sandbox: '', srcdoc: `<style>body{font:14px system-ui;margin:0}</style>${q.question_text || ''}`, title: 'Question text' });
				return h('div', { class: 'cv-q' },
					h('div', { class: 'qb-row' }, h('b', { text: `${i + 1}. ${q.question_name || 'Question'}` }), h('span', { class: 'qb-badge', text: String(q.question_type || '').replace(/_question$/, '').replace(/_/g, ' ') }), h('span', { class: 'qb-hint', text: `${q.points_possible} pt` }), q.quiz_group_id ? h('span', { class: 'qb-badge', text: 'in a group' }) : null, h('span', { class: 'grow' }),
						U.btn('Edit', () => editQuestion(z, q, draw), 'sm'), U.btn('', async () => { if (await U.confirm('Remove question', 'Remove this question from the quiz?', 'Remove', 'danger')) { await act(() => CV.del(cp(`/quizzes/${z.id}/questions/${q.id}`)), 'Removed.').catch(() => {}); draw(); } }, 'icon xs', 'trash', 'Remove')),
					frame, right.length ? h('p', { class: 'qb-hint' }, 'Answer: ', right.join(' · ')) : null);
			}) : [h('p', { class: 'qb-hint', text: 'No questions (questions inside question groups that pull from a question bank aren’t listed).' })]);
		};
		draw().catch(() => {});
		U.modal(`Questions · ${z.title}`, h('div', { class: 'qb-col' }, z.published ? h('p', { class: 'qb-warn', text: 'This quiz is published: edits reach students after you click “Publish changes” (or Save It Now in Canvas).' }) : null, box), [
			...(z.published ? [{ label: 'Publish changes', cls: 'primary', click: async () => { await act(() => CV.put(cp(`/quizzes/${z.id}`), { quiz: { published: true, notify_of_update: false } }), 'Changes published.'); return false; } }] : []),
			{ label: 'Close' }], { wide: true });
	}
	async function editQuestion(z, q, after) {
		const name = h('input', { class: 'qb-input', value: q.question_name || '' });
		const pts = num(q.points_possible, { min: 0 });
		const txt = htmlEditor(q.question_text, 'Question text (HTML)');
		const r = await U.modal('Edit question', h('div', { class: 'cv-form' }, field('Name', name), field('Points', pts), txt.el, h('p', { class: 'qb-hint cv-span', text: 'Answers stay as they are. To change answers, edit the question in Theta Questions and send the quiz again.' })), [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', click: async () => {
			await act(() => CV.put(cp(`/quizzes/${z.id}/questions/${q.id}`), { question: { question_name: name.value, question_text: txt.value, points_possible: Number(pts.value) || 0 } }), 'Question saved.');
		} }], { wide: true });
		if (r) after();
	}
	async function editNewQuiz(id) {
		const z = await act(() => CV.get(nq(`/quizzes/${id}`)));
		const st = z.quiz_settings || {};
		const title = h('input', { class: 'qb-input', value: z.title });
		const pts = num(z.points_possible, { min: 0 });
		const tl = num(st.has_time_limit ? Math.round((st.session_time_limit_in_seconds || 0) / 60) : '', { min: 0, placeholder: 'none' });
		const [shL, sh] = chk('Shuffle answers', st.shuffle_answers);
		const desc = htmlEditor(z.instructions, 'Instructions');
		const dates = datesBlock(z);
		const r = await U.modal('New Quiz settings', h('div', { class: 'cv-form' }, field('Title', title, 'cv-span'), field('Points', pts), field('Time limit (minutes)', tl), dates.el, h('div', { class: 'qb-col cv-span' }, shL), desc.el), [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', click: async () => {
			const mins = Number(tl.value) || 0;
			await act(() => CV.patch(nq(`/quizzes/${id}`), { quiz: { title: title.value.trim() || z.title, points_possible: Number(pts.value) || 0, instructions: desc.value, ...dates.get(), quiz_settings: { shuffle_answers: sh.checked, has_time_limit: mins > 0, session_time_limit_in_seconds: mins > 0 ? mins * 60 : null } } }), 'Saved.');
		} }], { wide: true });
		if (r) reload(['nquizzes', 'assignments'].filter((k) => k in S.d));
	}
	async function newQuizItems(z) {
		const box = h('div', { class: 'cv-qlist' }, h('p', { class: 'qb-hint', text: 'Loading…' }));
		const draw = async () => {
			const items = await act(() => CV.get(nq(`/quizzes/${z.id}/items`)));
			U.fill(box, items.length ? items.sort((a, b) => a.position - b.position).map((it, i) => {
				const e = it.entry || {};
				return h('div', { class: 'cv-q' }, h('div', { class: 'qb-row' }, h('b', { text: `${i + 1}. ${e.title || it.entry_type || 'Item'}` }), h('span', { class: 'qb-badge', text: e.interaction_type_slug || it.entry_type || '' }), h('span', { class: 'qb-hint', text: `${it.points_possible ?? ''} pt` }), h('span', { class: 'grow' }),
					U.btn('', async () => { if (await U.confirm('Remove question', 'Remove this question from the quiz?', 'Remove', 'danger')) { await act(() => CV.del(nq(`/quizzes/${z.id}/items/${it.id}`)), 'Removed.').catch(() => {}); draw(); } }, 'icon xs', 'trash', 'Remove')),
					e.item_body ? h('iframe', { class: 'cv-qtext', sandbox: '', srcdoc: `<style>body{font:14px system-ui;margin:0}</style>${e.item_body}`, title: 'Question text' }) : null);
			}) : [h('p', { class: 'qb-hint', text: 'No questions yet.' })]);
		};
		draw().catch(() => {});
		U.modal(`Questions · ${z.title}`, box, [{ label: 'Close' }], { wide: true });
	}
	async function newQuiz() {
		const title = h('input', { class: 'qb-input', value: 'New quiz', autofocus: true });
		const eng = h('select', { class: 'qb-select' }, h('option', { value: 'classic', text: 'Classic Quiz' }), S.d.nquizzes ? h('option', { value: 'new', text: 'New Quiz' }) : null);
		const r = await U.modal('Empty quiz', h('div', { class: 'cv-form' }, field('Title', title, 'cv-span'), field('Kind', eng), h('p', { class: 'qb-hint cv-span', text: 'It’s created unpublished with no questions. Usually it’s quicker to build the quiz in Quiz Builder and send it here.' })), [{ label: 'Cancel' }, { label: 'Create', cls: 'primary', click: async () => {
			if (eng.value === 'new') await act(() => CV.post(nq('/quizzes'), { quiz: { title: title.value.trim() || 'New quiz', points_possible: 0 } }), 'Quiz created.');
			else await act(() => CV.post(cp('/quizzes'), { quiz: { title: title.value.trim() || 'New quiz', quiz_type: 'assignment', published: false } }), 'Quiz created.');
		} }]);
		if (r) reload(['quizzes', 'nquizzes']);
	}
	async function importQTIFile() {
		const [f] = await U.pickFiles({ accept: '.zip' });
		if (!f) return;
		await U.sendQTIDialog({ name: f.name, bytes: await U.readBytes(f), courseId: S.course, title: f.name.replace(/\.(qti\.)?zip$/i, '') });
		reload(['quizzes', 'nquizzes', 'assignments'].filter((k) => k in S.d));
	}

	/* ======================== modules ======================== */
	const ITEM_TYPES = { Assignment: 'Assignment', Quiz: 'Quiz', Page: 'Page', Discussion: 'Discussion', SubHeader: 'Text header', ExternalUrl: 'Link', File: 'File', ExternalTool: 'External tool' };
	function renderModules() {
		const mods = (S.d.modules || []).slice().sort((a, b) => a.position - b.position);
		U.fill($.main, h('div', { class: 'cv-pad cv-col' },
			h('div', { class: 'qb-row' }, U.btn('Module', async () => { const n = await U.prompt('New module', 'Name'); if (n) { await act(() => CV.post(cp('/modules'), { module: { name: n, position: mods.length + 1 } }), 'Module added.').catch(() => {}); reload(['modules']); } }, 'primary', 'plus')),
			mods.length ? null : h('p', { class: 'qb-hint', text: 'No modules yet.' }),
			...mods.map((m, mi) => {
				const items = (m.items || []).slice().sort((a, b) => a.position - b.position);
				return h('section', { class: 'cv-card' },
					h('div', { class: 'cv-card-head' }, h('b', { text: m.name }), h('span', { class: 'qb-hint', text: `${items.length} item${items.length === 1 ? '' : 's'}${m.unlock_at ? ' · opens ' + CV.fmt(m.unlock_at) : ''}` }), h('span', { class: 'grow' }),
						pubToggle(m.published, (v) => CV.put(cp(`/modules/${m.id}`), { module: { published: v } }), ['modules']),
						U.btn('', () => moveModule(m, -1), 'icon xs', 'chev', 'Move up'), U.btn('', () => moveModule(m, 1), 'icon xs', 'chev', 'Move down'),
						U.btn('Item', () => addModuleItem(m), 'sm', 'plus'),
						U.btn('', () => editModule(m), 'icon xs', 'copy', 'Rename / settings'),
						U.btn('', async () => { if (await U.confirm('Delete module', `Delete the module “${m.name}”? Its assignments, quizzes and pages stay in the course.`, 'Delete', 'danger')) { await act(() => CV.del(cp(`/modules/${m.id}`)), 'Module deleted.').catch(() => {}); reload(['modules']); } }, 'icon xs', 'trash', 'Delete module')),
					items.length ? h('div', { class: 'cv-rows' }, items.map((it, i) => h('div', { class: 'cv-row', style: { paddingLeft: 0.75 + (it.indent || 0) * 1.25 + 'rem' } },
						h('span', { class: 'qb-badge', text: ITEM_TYPES[it.type] || it.type }),
						it.html_url && it.type !== 'SubHeader' ? h('a', { class: 'cv-name', href: it.html_url, target: '_blank', rel: 'noopener', text: it.title }) : h('b', { class: 'cv-name', text: it.title }),
						h('span', { class: 'grow' }),
						pubToggle(it.published, (v) => CV.put(cp(`/modules/${m.id}/items/${it.id}`), { module_item: { published: v } }), ['modules']),
						U.btn('', () => itemUpdate(m, it, { position: Math.max(1, it.position - 1) }), 'icon xs', 'chev', 'Move up'),
						U.btn('', () => itemUpdate(m, it, { position: it.position + 1 }), 'icon xs', 'chev', 'Move down'),
						U.btn('←', () => itemUpdate(m, it, { indent: Math.max(0, (it.indent || 0) - 1) }), 'icon xs', null, 'Outdent'),
						U.btn('→', () => itemUpdate(m, it, { indent: Math.min(5, (it.indent || 0) + 1) }), 'icon xs', null, 'Indent'),
						mods.length > 1 ? h('select', { class: 'qb-select cv-move', title: 'Move to another module', onchange: (e) => e.target.value && itemUpdate(m, it, { module_id: Number(e.target.value) }) }, h('option', { value: '', text: 'Move to…' }), mods.filter((x) => x !== m).map((x) => h('option', { value: x.id, text: x.name }))) : null,
						U.btn('', async () => { await act(() => CV.del(cp(`/modules/${m.id}/items/${it.id}`)), 'Removed from the module.').catch(() => {}); reload(['modules']); }, 'icon xs', 'x', 'Remove from module (the content stays in the course)')))) : h('p', { class: 'qb-hint cv-padx', text: 'Empty module.' }));
			})));
		// "up" chevrons
		$.main.querySelectorAll('.cv-card-head .qb-btn[title="Move up"] .qi, .cv-row .qb-btn[title="Move up"] .qi').forEach((s) => (s.style.transform = 'rotate(180deg)'));
	}
	async function moveModule(m, d) {
		const pos = Math.max(1, m.position + d);
		await act(() => CV.put(cp(`/modules/${m.id}`), { module: { position: pos } })).catch(() => {});
		reload(['modules']);
	}
	async function itemUpdate(m, it, change) {
		await act(() => CV.put(cp(`/modules/${m.id}/items/${it.id}`), { module_item: change })).catch(() => {});
		reload(['modules']);
	}
	async function editModule(m) {
		const name = h('input', { class: 'qb-input', value: m.name });
		const un = dt(m.unlock_at);
		const [seqL, seq] = chk('Students must go through items in order', m.require_sequential_progress);
		const r = await U.modal('Module', h('div', { class: 'cv-form' }, field('Name', name, 'cv-span'), field('Lock until', un), seqL), [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', click: async () => {
			await act(() => CV.put(cp(`/modules/${m.id}`), { module: { name: name.value.trim() || m.name, unlock_at: CV.fromLocal(un.value), require_sequential_progress: seq.checked } }), 'Saved.');
		} }]);
		if (r) reload(['modules']);
	}
	async function addModuleItem(m) {
		await need(['assignments', 'quizzes', 'pages']).catch(() => {});
		const type = h('select', { class: 'qb-select' }, ['Assignment', 'Quiz', 'Page', 'SubHeader', 'ExternalUrl'].map((t) => h('option', { value: t, text: ITEM_TYPES[t] })));
		const pick = h('select', { class: 'qb-select' });
		const title = h('input', { class: 'qb-input', placeholder: 'Text shown in the module' });
		const url = h('input', { class: 'qb-input', placeholder: 'https://…' });
		const pf = field('Which', pick), tf = field('Title', title), uf = field('Address', url);
		const used = new Set((m.items || []).map((i) => i.type + ':' + (i.content_id || i.page_url)));
		const draw = () => {
			const t = type.value;
			const list = t === 'Assignment' ? (S.d.assignments || []).filter((a) => !a.quiz_id).map((a) => [a.id, a.name]) : t === 'Quiz' ? (S.d.quizzes || []).map((z) => [z.id, z.title]) : t === 'Page' ? (S.d.pages || []).map((p) => [p.url, p.title]) : [];
			U.fill(pick, list.map(([v, n]) => h('option', { value: v, text: n + (used.has(t + ':' + v) ? '  (already here)' : '') })));
			pf.hidden = !['Assignment', 'Quiz', 'Page'].includes(t);
			tf.hidden = !['SubHeader', 'ExternalUrl'].includes(t);
			uf.hidden = t !== 'ExternalUrl';
		};
		type.addEventListener('change', draw);
		draw();
		const r = await U.modal('Add to “' + m.name + '”', h('div', { class: 'cv-form' }, field('Kind', type), pf, tf, uf, h('p', { class: 'qb-hint cv-span', text: 'New Quizzes are listed under Assignment.' })), [{ label: 'Cancel' }, { label: 'Add', cls: 'primary', click: async ({ setMessage }) => {
			const t = type.value;
			const item = { type: t, position: (m.items || []).length + 1 };
			if (t === 'Page') item.page_url = pick.value;
			else if (t === 'Assignment' || t === 'Quiz') item.content_id = Number(pick.value);
			else { item.title = title.value.trim(); if (!item.title) { setMessage('Give it a title.'); return false; } }
			if (t === 'ExternalUrl') { item.external_url = url.value.trim(); item.new_tab = true; if (!/^https?:\/\//.test(item.external_url)) { setMessage('Give a full address starting with https://'); return false; } }
			if (['Page', 'Assignment', 'Quiz'].includes(t) && !pick.value) { setMessage('Nothing to choose.'); return false; }
			await act(() => CV.post(cp(`/modules/${m.id}/items`), { module_item: item }), 'Added.');
		} }]);
		if (r) reload(['modules']);
	}

	/* ======================== pages ======================== */
	function renderPages() {
		const ps = S.d.pages || [];
		U.fill($.main, h('div', { class: 'cv-pad cv-col' },
			h('div', { class: 'qb-row' }, U.btn('Page', () => editPage(null), 'primary', 'plus')),
			h('section', { class: 'cv-card' }, ps.length ? h('div', { class: 'cv-rows' }, ps.map((p) => h('div', { class: 'cv-row' },
				p.front_page ? h('span', { class: 'qb-badge ok', text: 'Front page' }) : null,
				h('a', { class: 'cv-name', href: p.html_url, target: '_blank', rel: 'noopener', text: p.title }),
				h('span', { class: 'cv-meta', text: p.updated_at ? 'edited ' + CV.fmt(p.updated_at) : '' }),
				pubToggle(p.published, (v) => CV.put(cp(`/pages/${encodeURIComponent(p.url)}`), { wiki_page: { published: v } }), ['pages']),
				U.btn('', () => editPage(p), 'icon xs', 'copy', 'Edit'),
				U.btn('', async () => { if (await U.confirm('Delete page', `Delete the page “${p.title}”?`, 'Delete', 'danger')) { await act(() => CV.del(cp(`/pages/${encodeURIComponent(p.url)}`)), 'Page deleted.').catch(() => {}); reload(['pages']); } }, 'icon xs', 'trash', 'Delete')))) : h('p', { class: 'qb-hint cv-padx', text: 'No pages yet.' }))));
	}
	async function editPage(p) {
		const full = p ? await act(() => CV.get(cp(`/pages/${encodeURIComponent(p.url)}`))) : { title: '', body: '', published: false, front_page: false };
		const title = h('input', { class: 'qb-input', value: full.title });
		const body = htmlEditor(full.body, 'Content (HTML)');
		const [pubL, pub] = chk('Published', full.published), [fpL, fp] = chk('Use as the course front page', full.front_page);
		const r = await U.modal(p ? 'Edit page' : 'New page', h('div', { class: 'cv-form' }, field('Title', title, 'cv-span'), body.el, pubL, fpL), [{ label: 'Cancel' }, { label: p ? 'Save' : 'Create', cls: 'primary', click: async ({ setMessage }) => {
			if (!title.value.trim()) { setMessage('Give it a title.'); return false; }
			const wiki_page = { title: title.value.trim(), body: body.value, published: pub.checked || fp.checked, front_page: fp.checked };
			await act(() => (p ? CV.put(cp(`/pages/${encodeURIComponent(p.url)}`), { wiki_page }) : CV.post(cp('/pages'), { wiki_page })), 'Page saved.');
		} }], { wide: true });
		if (r) reload(['pages']);
	}

	/* ======================== announcements ======================== */
	function renderAnn() {
		const list = (S.d.ann || []).slice().sort((a, b) => String(b.delayed_post_at || b.posted_at || '').localeCompare(String(a.delayed_post_at || a.posted_at || '')));
		U.fill($.main, h('div', { class: 'cv-pad cv-col' },
			h('div', { class: 'qb-row' }, U.btn('Announcement', () => editAnn(null), 'primary', 'plus')),
			h('section', { class: 'cv-card' }, list.length ? h('div', { class: 'cv-rows' }, list.map((a) => {
				const future = a.delayed_post_at && new Date(a.delayed_post_at) > new Date();
				return h('div', { class: 'cv-row' },
					future ? h('span', { class: 'qb-badge warn', text: 'Scheduled' }) : h('span', { class: 'qb-badge ok', text: 'Posted' }),
					h('a', { class: 'cv-name', href: a.html_url, target: '_blank', rel: 'noopener', text: a.title }),
					h('span', { class: 'cv-meta', text: CV.fmt(a.delayed_post_at || a.posted_at) }),
					U.btn('', () => editAnn(a), 'icon xs', 'copy', 'Edit'),
					U.btn('', async () => { if (await U.confirm('Delete announcement', `Delete “${a.title}”?`, 'Delete', 'danger')) { await act(() => CV.del(cp(`/discussion_topics/${a.id}`)), 'Deleted.').catch(() => {}); reload(['ann']); } }, 'icon xs', 'trash', 'Delete'));
			})) : h('p', { class: 'qb-hint cv-padx', text: 'No announcements.' }))));
	}
	async function editAnn(a) {
		const title = h('input', { class: 'qb-input', value: a ? a.title : '' });
		const msg = htmlEditor(a ? a.message : '', 'Message (HTML)');
		const when = dt(a ? a.delayed_post_at : null);
		const r = await U.modal(a ? 'Edit announcement' : 'New announcement', h('div', { class: 'cv-form' }, field('Title', title, 'cv-span'), msg.el, field('Post at (blank = now)', when), h('p', { class: 'qb-hint cv-span', text: 'Canvas sends announcements to students when they post (by their notification settings).' })), [{ label: 'Cancel' }, { label: a ? 'Save' : 'Post', cls: 'primary', click: async ({ setMessage }) => {
			if (!title.value.trim()) { setMessage('Give it a title.'); return false; }
			const body = { title: title.value.trim(), message: msg.value, is_announcement: true, published: true, delayed_post_at: CV.fromLocal(when.value) };
			await act(() => (a ? CV.put(cp(`/discussion_topics/${a.id}`), body) : CV.post(cp('/discussion_topics'), body)), a ? 'Saved.' : when.value ? 'Scheduled.' : 'Posted.');
		} }], { wide: true });
		if (r) reload(['ann']);
	}

	/* ======================== dates ======================== */
	const D = { edits: new Map(), sel: new Set(), group: '', shift: 7 };
	function renderDates() {
		const groups = new Map((S.d.groups || []).map((g) => [g.id, g.name]));
		const rows = (S.d.assignments || []).filter((a) => !D.group || String(a.assignment_group_id) === D.group)
			.slice().sort((a, b) => String(a.due_at || '9').localeCompare(String(b.due_at || '9')) || String(a.name).localeCompare(String(b.name)));
		const cur = (a, k) => (D.edits.get(a.id) && k in D.edits.get(a.id) ? D.edits.get(a.id)[k] : a[k]);
		const setE = (a, k, v) => { const e = D.edits.get(a.id) || {}; if ((v || null) === (a[k] || null)) delete e[k]; else e[k] = v; Object.keys(e).length ? D.edits.set(a.id, e) : D.edits.delete(a.id); };
		const shiftN = h('input', { class: 'qb-input narrow', type: 'number', value: D.shift, oninput: (e) => (D.shift = Number(e.target.value) || 0) });
		const doShift = () => {
			const ms = D.shift * 86400000;
			for (const a of rows) if (D.sel.has(a.id)) for (const k of ['due_at', 'unlock_at', 'lock_at']) { const v = cur(a, k); if (v) setE(a, k, new Date(new Date(v).getTime() + ms).toISOString()); }
			renderDates();
		};
		const nEdits = D.edits.size;
		const allSel = rows.length && rows.every((a) => D.sel.has(a.id));
		U.fill($.main, h('div', { class: 'cv-pad cv-col' },
			h('div', { class: 'qb-row' },
				h('select', { class: 'qb-select', onchange: (e) => { D.group = e.target.value; renderDates(); } }, h('option', { value: '', text: 'All groups' }), [...groups].map(([id, n]) => h('option', { value: id, text: n, selected: String(id) === D.group }))),
				h('span', { class: 'qb-hint', text: D.sel.size ? `${D.sel.size} selected:` : 'Select rows, then' }), U.btn('Shift by', doShift, 'sm', null, 'Move every date of the selected items'), shiftN, h('span', { class: 'qb-hint', text: 'days' }),
				h('span', { class: 'grow' }),
				nEdits ? h('button', { type: 'button', class: 'qb-link', text: 'Undo all changes', onclick: () => { D.edits.clear(); renderDates(); } }) : null,
				U.btn(nEdits ? `Save ${nEdits} change${nEdits === 1 ? '' : 's'} to Canvas` : 'No changes', saveDates, nEdits ? 'primary' : '', 'check')),
			h('div', { class: 'cv-card' }, h('table', { class: 'cv-dates-t' },
				h('tr', null, h('th', null, h('input', { type: 'checkbox', checked: !!allSel, 'aria-label': 'Select all', onchange: (e) => { rows.forEach((a) => (e.target.checked ? D.sel.add(a.id) : D.sel.delete(a.id))); renderDates(); } })), h('th', { text: 'Item' }), h('th', { text: 'Group' }), h('th', { text: 'Due' }), h('th', { text: 'Available from' }), h('th', { text: 'Until' })),
				rows.map((a) => {
					const ch = D.edits.get(a.id) || {};
					const inp = (k) => h('input', { class: 'qb-input' + (k in ch ? ' cv-changed' : ''), type: 'datetime-local', value: CV.toLocal(cur(a, k)), onchange: (e) => { setE(a, k, CV.fromLocal(e.target.value)); renderDates(); } });
					return h('tr', { class: D.edits.has(a.id) ? 'changed' : '' },
						h('td', null, h('input', { type: 'checkbox', checked: D.sel.has(a.id), onchange: (e) => { e.target.checked ? D.sel.add(a.id) : D.sel.delete(a.id); renderDates(); } })),
						h('td', null, h('span', { class: 'qb-type ' + KIND[kindOf(a)][1], text: KIND[kindOf(a)][0] }), ' ', a.name),
						h('td', { class: 'qb-hint', text: groups.get(a.assignment_group_id) || '' }),
						h('td', null, inp('due_at')), h('td', null, inp('unlock_at')), h('td', null, inp('lock_at')));
				}))),
			h('p', { class: 'qb-hint', text: 'Times are in this computer’s time zone. Items with different dates for different sections keep those; only the main (“Everyone”) dates change here.' })));
	}
	async function saveDates() {
		if (!D.edits.size) return;
		const all = new Map((S.d.assignments || []).map((a) => [a.id, a]));
		let ok = 0, bad = 0;
		setStatus('Saving dates…');
		for (const [id, e] of D.edits) {
			const a = all.get(id);
			try {
				if (a && a.quiz_id) await CV.put(cp(`/quizzes/${a.quiz_id}`), { quiz: e });
				else await CV.put(cp(`/assignments/${id}`), { assignment: e });
				D.edits.delete(id); ok++;
			} catch (err) { bad++; U.toast(`${a ? a.name : id}: ${err.message}`, { error: true }); }
		}
		setStatus('');
		U.toast(`Saved dates for ${ok} item${ok === 1 ? '' : 's'}${bad ? `, ${bad} failed` : ''}.`);
		reload(['assignments', 'quizzes']);
	}

	start();
})();
