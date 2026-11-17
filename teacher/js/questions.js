/* Theta Questions — the question bank (teacher/questions.html).
   Banks are saves of tool 'qbank' (one envelope per bank, data = { framework, description, questions }),
   kept in this browser and synced to a teacher account by ../shared/gate.js like every other tool. */
(function () {
	'use strict';
	const QB = HT.QB, QF = HT.QF, U = HT.QUI, h = U.h;
	const TOOL = 'qbank';
	const LAST = 'happytheta:qbank:last';
	const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

	const S = {
		env: null, bank: null, cur: null, checked: new Set(),
		filter: { text: '', types: [], diffMin: 0, diffMax: 0, unit: '', topic: '', objective: '', tag: '', randomized: '' },
		sort: 'manual', tab: 'questions', fw: null, roll: 0, showKey: true, libVersions: {}, saveTimer: null, status: ''
	};
	const $ = {};

	/* ======================== storage ======================== */
	const banks = () => { try { return HT.files.list(TOOL); } catch { return []; } };
	function saveNow() {
		clearTimeout(S.saveTimer);
		S.saveTimer = null;
		if (!S.bank) return;
		try {
			S.env = HT.files.wrap(TOOL, { title: S.env.meta.title, data: S.bank }, S.env);
			HT.files.write(S.env);
			const kb = Math.round(JSON.stringify(S.env).length / 1024);
			setStatus(kb > 2500 ? `Saved · ${(kb / 1024).toFixed(1)} MB — large (images); the server keeps banks up to 3 MB` : 'Saved', kb > 2500);
		} catch (e) {
			setStatus(/quota|exceed/i.test(String(e)) ? 'Not saved: this browser’s storage is full. Remove images or delete old work.' : 'Not saved: ' + e.message, true);
		}
	}
	function touch(q) {
		if (q) q.modified = new Date().toISOString();
		setStatus('Saving…');
		clearTimeout(S.saveTimer);
		S.saveTimer = setTimeout(saveNow, 600);
	}
	window.addEventListener('beforeunload', () => { if (S.saveTimer) saveNow(); });
	function setStatus(t, err) {
		S.status = t;
		if ($.status) { $.status.textContent = t; $.status.classList.toggle('error', !!err); }
	}
	function openBank(env) {
		if (S.saveTimer) saveNow();
		S.env = env;
		S.bank = QB.normalizeBank(env.data);
		S.cur = S.bank.questions[0] ? S.bank.questions[0].id : null;
		S.checked.clear();
		ls.set(LAST, env.id);
		S.fw = null;
		U.loadFramework(S.bank.framework).then((fw) => { if (S.bank && S.bank.framework === fw.id) { S.fw = fw; renderFilters(); renderEditor(); } });
		renderAll();
	}
	function newBank(title, data) {
		const env = HT.files.wrap(TOOL, { title, data: QB.normalizeBank(data || { framework: (S.bank && S.bank.framework) || 'ap-physics-1', questions: [] }) });
		HT.files.write(env);
		return env;
	}
	const qById = (id) => S.bank.questions.find((q) => q.id === id);
	const current = () => (S.cur ? qById(S.cur) : null);

	/* ======================== examples for a first bank ======================== */
	function examples() {
		const fw = 'ap-physics-1';
		const o = (...codes) => codes.map((code) => ({ fw, code }));
		return [
			{ type: 'mc', title: 'Vector or scalar', stem: 'Which of these quantities is a **vector**?', choices: [{ text: 'Mass' }, { text: 'Velocity', correct: true, feedback: 'Velocity has a magnitude and a direction.' }, { text: 'Speed', feedback: 'Speed is the magnitude of velocity only.' }, { text: 'Time' }], tags: { unit: '1 Kinematics', topics: ['1.1 Scalars and Vectors in One Dimension'], objectives: o('1.1.A'), difficulty: 1 } },
			{ type: 'num', title: 'Average acceleration', stem: 'A cart’s velocity changes from {v0} m/s to {v1} m/s in {t} s. What is its average acceleration?', vars: [{ name: 'v0', min: 0, max: 6, step: 0.5 }, { name: 'v1', min: 8, max: 20, step: 1 }, { name: 't', min: 2, max: 8, step: 1 }], calcs: [{ name: 'a', expr: '(v1 - v0)/t' }], answer: { expr: 'a', unit: 'm/s^2^', tol: 2, tolMode: '%', sigfigs: 3 }, solution: 'a = (v~f~ − v~i~)/Δt = ({v1} − {v0})/{t} = {a} m/s^2^', tags: { unit: '1 Kinematics', topics: ['1.2 Displacement, Velocity, and Acceleration'], objectives: o('1.2.B'), difficulty: 2 } },
			{ type: 'num', title: 'Block on a ramp', stem: 'A {m} kg block rests on a frictionless ramp tilted {th}° above horizontal. What is the size of the component of its weight along the ramp? Use g = 9.8 m/s^2^.', vars: [{ name: 'm', min: 1, max: 10, step: 0.5 }, { name: 'th', min: 15, max: 60, step: 5 }], answer: { expr: 'm*9.8*sind(th)', unit: 'N', tol: 2, tolMode: '%', sigfigs: 3 }, tags: { unit: '2 Force and Translational Dynamics', topics: ['2.2 Forces and Free-Body Diagrams'], objectives: o('2.2.B'), difficulty: 3 } },
			{ type: 'mc', title: 'Newton’s second law', stem: 'A net force of {F} N acts on a {m} kg cart. What is the cart’s acceleration?', vars: [{ name: 'F', min: 4, max: 30, step: 2 }, { name: 'm', min: 2, max: 8, step: 1 }], constraint: 'F != m*m', choices: [{ text: '{=F/m} m/s^2^', correct: true }, { text: '{=F*m} m/s^2^', feedback: 'That multiplies instead of dividing.' }, { text: '{=m/F} m/s^2^', feedback: 'Upside down: a = F/m.' }, { text: '{F} m/s^2^' }], tags: { unit: '2 Force and Translational Dynamics', topics: ['2.5 Newton’s Second Law'], objectives: o('2.5.A'), difficulty: 2 } },
			{ type: 'ma', title: 'Elastic collisions', stem: 'Two carts collide elastically on a level, frictionless track. Which quantities of the two-cart system are the same before and after? Choose all that apply.', choices: [{ text: 'Total momentum', correct: true }, { text: 'Total kinetic energy', correct: true }, { text: 'The velocity of each cart' }, { text: 'The kinetic energy of each cart' }], tags: { unit: '4 Linear Momentum', topics: ['4.4 Elastic and Inelastic Collisions'], objectives: o('4.4.A'), difficulty: 3 } },
			{ type: 'match', title: 'SI units', stem: 'Match each quantity with its SI unit.', pairs: [{ left: 'Force', right: 'newton (N)' }, { left: 'Energy', right: 'joule (J)' }, { left: 'Power', right: 'watt (W)' }, { left: 'Momentum', right: 'kg·m/s' }], distractors: ['pascal (Pa)'], tags: { unit: '0 Basics', topics: ['0.1 SI Units and Conversion'], difficulty: 1 } }
		].map((x) => QB.normalize(x));
	}

	/* ======================== layout ======================== */
	function build() {
		const content = document.querySelector('.app .content') || document.body;
		$.status = h('span', { class: 'qb-status', text: S.status });
		$.bankSel = h('select', { class: 'qb-select bank', 'aria-label': 'Question bank', onchange: () => { const env = banks().find((b) => b.id === $.bankSel.value); if (env) openBank(env); } });
		$.fwSel = h('select', { class: 'qb-select', title: 'Course framework for objective tags', onchange: () => { S.bank.framework = $.fwSel.value; S.fw = null; touch(); U.loadFramework(S.bank.framework).then((fw) => { S.fw = fw; renderFilters(); renderEditor(); }); } }, U.FRAMEWORKS.map((f) => h('option', { value: f.id, text: f.label })));
		const bankMenu = U.menu('Bank', () => [
			{ label: 'New bank…', click: async () => { const t = await U.prompt('New question bank', 'Name', 'New question bank'); if (t) openBank(newBank(t)); } },
			{ label: 'Rename…', click: async () => { const t = await U.prompt('Rename bank', 'Name', S.env.meta.title); if (t) { S.env.meta.title = t; saveNow(); renderHead(); } } },
			{ label: 'Duplicate', click: () => { saveNow(); openBank(newBank(S.env.meta.title + ' (copy)', JSON.parse(JSON.stringify({ ...S.bank, questions: S.bank.questions.map((q) => ({ ...QB.copy(q), lib: null })) })))); U.toast('Made a copy of the bank.'); } },
			'-',
			{ label: 'Delete this bank…', danger: true, click: deleteBank }
		]);
		const addMenu = U.menu('Question', Object.entries(QB.TYPES).map(([t, label]) => ({ label, click: () => addQuestion(t) })), { cls: 'primary', icon: 'plus' });
		const exportMenu = U.menu('Export', () => {
			const shown = visible();
			const sel = S.bank.questions.filter((q) => S.checked.has(q.id));
			const scope = sel.length ? sel : shown;
			const what = sel.length ? `${sel.length} selected` : shown.length === S.bank.questions.length ? 'all' : `${shown.length} shown`;
			return [
				{ heading: `Questions: ${what}` },
				{ label: 'Canvas QTI (.zip)…', click: () => exportQTI(scope) },
				{ label: 'CSV spreadsheet', click: () => U.download(QF.slug(S.env.meta.title, 'questions') + '.csv', QF.toCSV(scope), 'text/csv') },
				{ label: 'Bank file (.qbank.json)', click: () => downloadBank(scope) },
				'-',
				{ label: 'Make a Canvas quiz from these…', click: () => toBuilder(scope) }
			];
		});
		$.head = h('header', { class: 'qb-head' },
			h('div', { class: 'qb-title' }, h('span', { class: 'qb-app', text: 'Theta Questions' }), h('div', { class: 'qb-row tight' }, $.bankSel, bankMenu)),
			h('label', { class: 'qb-fw' }, h('span', { text: 'Framework' }), $.fwSel),
			h('div', { class: 'qb-actions' }, $.status, addMenu, U.btn('Import', importQuestions, '', 'down'), exportMenu, h('a', { class: 'qb-btn', href: 'quiz-builder.html', title: 'Arrange questions into a Canvas quiz' }, U.icon('group'), h('span', { text: 'Quiz Builder' })))
		);
		$.tabs = h('nav', { class: 'qb-tabs' }, [['questions', 'Questions'], ['library', 'Shared library']].map(([k, t]) => h('button', { type: 'button', class: 'qb-tab', dataset: { k }, text: t, onclick: () => { S.tab = k; renderAll(); } })));
		$.filters = h('aside', { class: 'qb-filters', 'aria-label': 'Filters' });
		$.list = h('section', { class: 'qb-list', 'aria-label': 'Questions' });
		$.editor = h('section', { class: 'qb-editor', 'aria-label': 'Question editor' });
		$.bankView = h('div', { class: 'qb-main' }, $.filters, $.list, $.editor);
		$.libView = h('div', { class: 'qb-libview' });
		$.root = h('div', { class: 'qb' }, $.head, h('div', { class: 'qb-subhead' }, $.tabs), $.bankView, $.libView);
		content.append($.root);
		document.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNow(); }
		});
	}
	function renderAll() {
		renderHead();
		$.tabs.querySelectorAll('.qb-tab').forEach((b) => b.classList.toggle('on', b.dataset.k === S.tab));
		$.bankView.hidden = S.tab !== 'questions';
		$.libView.hidden = S.tab !== 'library';
		if (S.tab === 'library') renderLibrary();
		else { renderFilters(); renderList(); renderEditor(); }
	}
	function renderHead() {
		const all = banks();
		U.fill($.bankSel, ...all.map((b) => h('option', { value: b.id, selected: b.id === S.env.id, text: `${b.meta.title} (${b.id === S.env.id ? S.bank.questions.length : ((b.data && b.data.questions) || []).length})` })));
		$.fwSel.value = S.bank.framework;
		document.title = S.env.meta.title + ' · Theta Questions';
	}
	async function deleteBank() {
		if (!(await U.confirm('Delete bank', `Delete “${S.env.meta.title}” and its ${S.bank.questions.length} questions? This can’t be undone (download it first if you might want it).`, 'Delete', 'danger'))) return;
		clearTimeout(S.saveTimer); S.saveTimer = null;
		HT.files.remove(TOOL, S.env.id);
		const rest = banks();
		openBank(rest[0] || newBank('My question bank'));
	}

	/* ======================== filters ======================== */
	function visible() {
		return QB.sorted(S.bank.questions.filter((q) => QB.matches(q, S.filter)), S.sort);
	}
	function renderFilters() {
		if (!$.filters || S.tab !== 'questions') return;
		const f = S.filter, facets = QB.facets(S.bank.questions);
		const sel = (key, label, options, any = 'Any') => h('label', { class: 'qb-field' }, h('span', { text: label }), h('select', { class: 'qb-select', onchange: (e) => { f[key] = e.target.value; renderList(); } }, h('option', { value: '', text: any }), options.map((o) => (Array.isArray(o) ? h('option', { value: o[0], text: o[1], selected: String(f[key]) === String(o[0]) }) : h('option', { value: o, text: o, selected: f[key] === o })))));
		const search = h('input', { class: 'qb-input', type: 'search', placeholder: 'Search text, tags, codes…', value: f.text, oninput: (e) => { f.text = e.target.value; renderList(); } });
		const objIn = h('input', { class: 'qb-input', placeholder: 'e.g. 2.3 or 1.2.A', value: f.objective, list: 'qb-obj-codes', oninput: (e) => { f.objective = e.target.value.trim(); renderList(); } });
		const diff = [1, 2, 3, 4, 5].map((d) => [d, d + ' · ' + QB.DIFFICULTY[d]]);
		U.fill($.filters, 
			h('div', { class: 'qb-filter-head' }, U.icon('search'), h('b', { text: 'Find' }), h('button', { type: 'button', class: 'qb-link', text: 'Clear', onclick: () => { S.filter = { text: '', types: [], diffMin: 0, diffMax: 0, unit: '', topic: '', objective: '', tag: '', randomized: '' }; renderFilters(); renderList(); } })),
			search,
			h('fieldset', { class: 'qb-types' }, h('legend', { text: 'Type' }), Object.entries(QB.TYPES).map(([t, label]) => h('label', { class: 'qb-check' }, h('input', { type: 'checkbox', checked: f.types.includes(t), onchange: (e) => { f.types = e.target.checked ? [...f.types, t] : f.types.filter((x) => x !== t); renderList(); } }), h('span', { class: 'qb-type t-' + t, text: QB.TYPE_SHORT[t] }), ' ', label))),
			h('div', { class: 'qb-row2' }, sel('diffMin', 'Difficulty from', diff), sel('diffMax', 'to', diff)),
			sel('unit', 'Unit', facets.units),
			sel('topic', 'Topic', facets.topics),
			h('label', { class: 'qb-field' }, h('span', { text: 'Objective' }), h('div', { class: 'qb-row tight' }, objIn, U.btn('', async () => { const c = await U.pickObjectives(S.bank.framework, f.objective ? [f.objective] : []); if (c) { f.objective = c[c.length - 1] || ''; renderFilters(); renderList(); } }, 'icon', 'search', 'Pick from the framework')), h('datalist', { id: 'qb-obj-codes' }, facets.objectives.map((c) => h('option', { value: c })))),
			sel('tag', 'Tag', facets.tags),
			sel('randomized', 'Values', [['yes', 'Randomized'], ['no', 'Fixed']])
		);
	}

	/* ======================== list ======================== */
	function libState(q) {
		if (!q.lib) return null;
		const me = U.account();
		const mine = me && me.email === q.lib.owner;
		if (mine) return QB.sig(q) !== q.lib.sig ? { cls: 'warn', text: 'Changed since shared', title: 'Share it again to update the library' } : { cls: 'ok', text: 'Shared', title: 'In the shared library' };
		const v = S.libVersions[q.lib.id];
		if (v && v.version > q.lib.version) return { cls: 'warn', text: 'Update available', title: 'The library version is newer (Shared library tab)' };
		return { cls: '', text: 'From library', title: 'Pulled from ' + q.lib.owner };
	}
	function row(q, i, sortable) {
		const errs = QB.errors(q);
		const ls2 = libState(q);
		const d = q.tags.difficulty;
		const r = h('div', { class: 'qb-qrow' + (q.id === S.cur ? ' on' : '') + (S.checked.has(q.id) ? ' checked' : ''), dataset: { id: q.id }, draggable: sortable ? 'true' : null, tabindex: '0', onclick: (e) => { if (e.target.closest('input,button')) return; S.cur = q.id; renderList(); renderEditor(); }, onkeydown: (e) => { if (e.key === 'Enter') { S.cur = q.id; renderList(); renderEditor(); } } },
			h('input', { type: 'checkbox', checked: S.checked.has(q.id), 'aria-label': 'Select', onchange: (e) => { e.target.checked ? S.checked.add(q.id) : S.checked.delete(q.id); renderList(); } }),
			sortable ? h('span', { class: 'qb-grip', title: 'Drag to reorder' }, U.icon('grip')) : null,
			h('div', { class: 'qb-qmain' },
				h('div', { class: 'qb-qtop' }, h('span', { class: 'qb-type t-' + q.type, text: QB.TYPE_SHORT[q.type], title: QB.TYPES[q.type] }), h('span', { class: 'qb-qtext', text: QB.excerpt(q, 160) || '(no text yet)' })),
				h('div', { class: 'qb-qmeta' },
					QB.isRandom(q) ? h('span', { class: 'qb-badge rnd', title: 'Randomized values' }, U.icon('dice', 'qi xs'), 'random') : null,
					d ? h('span', { class: 'qb-diff d' + d, title: 'Difficulty: ' + QB.DIFFICULTY[d], text: '●'.repeat(d) + '○'.repeat(5 - d) }) : null,
					q.tags.unit ? h('span', { class: 'qb-badge', text: q.tags.unit.length > 28 ? q.tags.unit.slice(0, 27) + '…' : q.tags.unit }) : null,
					q.tags.objectives.slice(0, 3).map((o) => h('span', { class: 'qb-badge code', text: o.code })),
					q.tags.objectives.length > 3 ? h('span', { class: 'qb-badge code', text: '+' + (q.tags.objectives.length - 3) }) : null,
					q.tags.custom.slice(0, 3).map((t) => h('span', { class: 'qb-badge tag', text: t })),
					q.image ? h('span', { class: 'qb-badge', title: 'Has an image' }, U.icon('img', 'qi xs')) : null,
					ls2 ? h('span', { class: 'qb-badge lib ' + ls2.cls, title: ls2.title }, U.icon('cloud', 'qi xs'), ls2.text) : null,
					errs.length ? h('span', { class: 'qb-badge err', title: errs.map((e) => e.msg).join('\n') }, U.icon('warn', 'qi xs'), 'fix') : null
				)
			)
		);
		if (sortable) {
			r.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-qid', q.id); e.dataTransfer.effectAllowed = 'move'; r.classList.add('dragging'); });
			r.addEventListener('dragend', () => r.classList.remove('dragging'));
			r.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('text/x-qid')) { e.preventDefault(); r.classList.add('dropbefore'); } });
			r.addEventListener('dragleave', () => r.classList.remove('dropbefore'));
			r.addEventListener('drop', (e) => {
				e.preventDefault();
				r.classList.remove('dropbefore');
				const id = e.dataTransfer.getData('text/x-qid');
				if (!id || id === q.id) return;
				const qs = S.bank.questions;
				const from = qs.findIndex((x) => x.id === id);
				const [m] = qs.splice(from, 1);
				qs.splice(qs.findIndex((x) => x.id === q.id), 0, m);
				touch();
				renderList();
			});
		}
		return r;
	}
	function renderList() {
		if (S.tab !== 'questions') return;
		const shown = visible();
		const total = S.bank.questions.length;
		const sortable = S.sort === 'manual';
		const allChecked = shown.length && shown.every((q) => S.checked.has(q.id));
		const nChecked = S.checked.size;
		const head = h('div', { class: 'qb-list-head' },
			h('input', { type: 'checkbox', 'aria-label': 'Select all shown', checked: !!allChecked, indeterminate: !allChecked && shown.some((q) => S.checked.has(q.id)), onchange: (e) => { shown.forEach((q) => (e.target.checked ? S.checked.add(q.id) : S.checked.delete(q.id))); renderList(); } }),
			h('span', { class: 'qb-count', text: shown.length === total ? `${total} question${total === 1 ? '' : 's'}` : `${shown.length} of ${total} shown` }),
			h('label', { class: 'qb-sort' }, h('span', { text: 'Sort' }), h('select', { class: 'qb-select', onchange: (e) => { S.sort = e.target.value; renderList(); } }, Object.entries(QB.SORTS).map(([k, s]) => h('option', { value: k, text: s.label, selected: S.sort === k }))))
		);
		const bulk = nChecked ? h('div', { class: 'qb-bulk' },
			h('b', { text: `${nChecked} selected` }),
			U.menu('Tag', () => [
				{ label: 'Add a tag…', click: () => bulkEdit('tag') },
				{ label: 'Add a topic…', click: () => bulkEdit('topic') },
				{ label: 'Set unit…', click: () => bulkEdit('unit') },
				{ label: 'Add objectives…', click: () => bulkEdit('obj') },
				{ heading: 'Difficulty' },
				...[1, 2, 3, 4, 5].map((d) => ({ label: d + ' · ' + QB.DIFFICULTY[d], click: () => bulkEdit('diff', d) })),
				{ label: 'Clear difficulty', click: () => bulkEdit('diff', 0) },
				'-',
				{ label: 'Remove a tag…', click: () => bulkEdit('untag') }
			], { cls: 'sm' }),
			U.menu('Copy / move', () => {
				const others = banks().filter((b) => b.id !== S.env.id);
				return [
					{ label: 'Duplicate here', click: () => { const sel = S.bank.questions.filter((q) => S.checked.has(q.id)); S.bank.questions.push(...sel.map((q) => ({ ...QB.copy(q), lib: null }))); touch(); renderAll(); U.toast(`Duplicated ${sel.length}.`); } },
					...(others.length ? [{ heading: 'Copy to' }, ...others.map((b) => ({ label: b.meta.title, click: () => copyTo(b, false) })), { heading: 'Move to' }, ...others.map((b) => ({ label: b.meta.title, click: () => copyTo(b, true) }))] : [{ label: 'Copy to a new bank…', click: async () => { const t = await U.prompt('New bank', 'Name', 'New question bank'); if (t) copyTo(newBank(t), false); } }])
				];
			}, { cls: 'sm' }),
			U.btn('Share to library', () => share(S.bank.questions.filter((q) => S.checked.has(q.id))), 'sm', 'cloud'),
			U.btn('Make quiz', () => toBuilder(S.bank.questions.filter((q) => S.checked.has(q.id))), 'sm', 'group'),
			U.btn('Delete', () => removeQuestions([...S.checked]), 'sm danger', 'trash'),
			h('button', { type: 'button', class: 'qb-link', text: 'Clear selection', onclick: () => { S.checked.clear(); renderList(); } })
		) : null;
		const rows = shown.map((q, i) => row(q, i, sortable));
		const empty = !total
			? h('div', { class: 'qb-empty' }, h('p', { text: 'This bank is empty.' }), h('div', { class: 'qb-row' }, U.btn('Add a question', () => addQuestion('mc'), 'primary', 'plus'), U.btn('Import questions', importQuestions, '', 'down')))
			: !shown.length ? h('p', { class: 'qb-empty', text: 'No questions match the filters.' }) : null;
		U.fill($.list, head, bulk || '', h('div', { class: 'qb-rows' }, rows, empty || ''));
	}
	async function bulkEdit(kind, val) {
		const sel = S.bank.questions.filter((q) => S.checked.has(q.id));
		let v = val;
		if (kind === 'tag' || kind === 'topic' || kind === 'unit' || kind === 'untag') {
			v = await U.prompt({ tag: 'Add a tag', topic: 'Add a topic', unit: 'Set unit', untag: 'Remove a tag' }[kind], { tag: 'Tag', topic: 'Topic', unit: 'Unit (blank clears it)', untag: 'Tag or topic to remove' }[kind]);
			if (v == null) return;
		}
		if (kind === 'obj') { v = await U.pickObjectives(S.bank.framework, []); if (!v) return; }
		for (const q of sel) {
			if (kind === 'tag' && !q.tags.custom.includes(v)) q.tags.custom.push(v);
			if (kind === 'topic' && !q.tags.topics.includes(v)) q.tags.topics.push(v);
			if (kind === 'unit') q.tags.unit = v;
			if (kind === 'untag') { q.tags.custom = q.tags.custom.filter((t) => t !== v); q.tags.topics = q.tags.topics.filter((t) => t !== v); }
			if (kind === 'obj') for (const code of v) if (!q.tags.objectives.some((o) => o.code === code)) q.tags.objectives.push({ fw: S.bank.framework, code });
			if (kind === 'diff') q.tags.difficulty = v;
			q.modified = new Date().toISOString();
		}
		touch();
		renderFilters(); renderList(); renderEditor();
		U.toast(`Updated ${sel.length} question${sel.length === 1 ? '' : 's'}.`);
	}
	function copyTo(env, move) {
		const sel = S.bank.questions.filter((q) => S.checked.has(q.id));
		const target = HT.files.read(TOOL, env.id) || env;
		const data = QB.normalizeBank(target.data);
		data.questions.push(...sel.map((q) => (move ? q : { ...QB.copy(q), lib: q.lib })));
		HT.files.write(HT.files.wrap(TOOL, { title: target.meta.title, data }, target));
		if (move) { S.bank.questions = S.bank.questions.filter((q) => !S.checked.has(q.id)); S.checked.clear(); if (!qById(S.cur)) S.cur = null; touch(); }
		renderAll();
		U.toast(`${move ? 'Moved' : 'Copied'} ${sel.length} to “${target.meta.title}”.`);
	}
	function removeQuestions(ids) {
		const before = S.bank.questions.slice();
		const n = ids.length;
		S.bank.questions = S.bank.questions.filter((q) => !ids.includes(q.id));
		ids.forEach((id) => S.checked.delete(id));
		if (!qById(S.cur)) S.cur = null;
		touch();
		renderAll();
		U.toast(`Deleted ${n} question${n === 1 ? '' : 's'}.`, { undo: () => { S.bank.questions = before; touch(); renderAll(); } });
	}
	function addQuestion(type) {
		const q = QB.blank(type);
		if (S.filter.unit) q.tags.unit = S.filter.unit;
		if (S.filter.topic) q.tags.topics.push(S.filter.topic);
		const at = S.cur ? S.bank.questions.findIndex((x) => x.id === S.cur) + 1 : S.bank.questions.length;
		S.bank.questions.splice(at || S.bank.questions.length, 0, q);
		S.cur = q.id;
		S.tab = 'questions';
		touch();
		renderAll();
		const ta = $.editor.querySelector('textarea.stem');
		if (ta) ta.focus();
	}

	/* ======================== editor ======================== */
	const field = (label, input, hint) => h('label', { class: 'qb-field' }, h('span', { text: label }), input, hint ? h('small', { class: 'qb-hint', text: hint }) : null);
	function inp(get, set, attrs = {}) {
		const tag = attrs.rows ? 'textarea' : 'input';
		const e = h(tag, { class: 'qb-input' + (attrs.cls ? ' ' + attrs.cls : ''), ...attrs, cls: null, value: get() == null ? '' : String(get()) });
		e.addEventListener('input', () => { set(attrs.type === 'number' ? (e.value === '' ? null : Number(e.value)) : e.value); changed(); });
		if (tag === 'textarea') autosize(e);
		return e;
	}
	function autosize(t) {
		const fit = () => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 480) + 'px'; };
		t.addEventListener('input', fit);
		requestAnimationFrame(fit);
	}
	let derivedTimer = null;
	function changed() {
		const q = current();
		if (!q) return;
		touch(q);
		clearTimeout(derivedTimer);
		derivedTimer = setTimeout(() => { renderDerived(); const r = $.list.querySelector(`.qb-qrow[data-id="${q.id}"]`); if (r) r.replaceWith(row(q, 0, S.sort === 'manual')); }, 250);
	}
	function renderEditor() {
		if (!$.editor || S.tab !== 'questions') return;
		const q = current();
		if (!q) {
			U.fill($.editor, h('div', { class: 'qb-empty' }, h('p', { text: S.bank.questions.length ? 'Choose a question to edit it.' : 'Add or import questions to start.' }), h('p', { class: 'qb-hint', text: 'Tip: questions can randomize their numbers — open “Randomize values” in a numerical question.' })));
			return;
		}
		const typeSel = h('select', { class: 'qb-select', onchange: () => { const i = S.bank.questions.indexOf(q); const nq = QB.convert(q, typeSel.value); S.bank.questions[i] = nq; S.cur = nq.id; touch(nq); renderList(); renderEditor(); } }, Object.entries(QB.TYPES).map(([t, l]) => h('option', { value: t, text: l, selected: q.type === t })));
		const top = h('div', { class: 'qb-ed-top' },
			field('Type', typeSel),
			field('Title (optional)', inp(() => q.title, (v) => (q.title = v), { placeholder: 'Short name shown in lists and Canvas' })),
			field('Points', inp(() => q.points, (v) => (q.points = v == null ? 1 : v), { type: 'number', min: 0, step: 0.5, cls: 'narrow' })),
			h('div', { class: 'qb-ed-btns' },
				U.btn('', () => { const c = { ...QB.copy(q), lib: null }; S.bank.questions.splice(S.bank.questions.indexOf(q) + 1, 0, c); S.cur = c.id; touch(); renderAll(); U.toast('Duplicated.'); }, 'icon', 'copy', 'Duplicate'),
				U.btn('', () => share([q]), 'icon', 'cloud', 'Share to the library'),
				U.btn('', () => removeQuestions([q.id]), 'icon danger', 'trash', 'Delete'))
		);
		$.problems = h('div', { class: 'qb-problems' });
		const stem = inp(() => q.stem, (v) => (q.stem = v), { rows: 4, cls: 'stem', placeholder: 'Question text. **bold**, *italic*, x^2^, v~0~, \\( LaTeX \\), {v0} for a variable.' });
		const imgBox = h('div', { class: 'qb-img' });
		const drawImg = () => {
			U.fill(imgBox, 
				q.image ? h('div', { class: 'qb-img-has' }, h('img', { src: q.image.data, alt: '' }), h('div', { class: 'qb-col' }, inp(() => q.image.alt, (v) => (q.image.alt = v), { placeholder: 'Alt text (describe the picture for screen readers)' }), h('div', { class: 'qb-row' }, h('span', { class: 'qb-hint', text: `${q.image.name} · ${Math.round(q.image.data.length * 0.75 / 1024)} KB` }), U.btn('Replace', pickImg, 'sm'), U.btn('Remove', () => { q.image = null; changed(); drawImg(); }, 'sm danger')))) : U.btn('Add image', pickImg, 'sm', 'img')
			);
		};
		const pickImg = async () => {
			const [f] = await U.pickFiles({ accept: 'image/*' });
			if (!f) return;
			try { q.image = await U.readImage(f); changed(); drawImg(); } catch (e) { U.toast(e.message, { error: true }); }
		};
		drawImg();
		stem.addEventListener('paste', async (e) => {
			const file = [...(e.clipboardData ? e.clipboardData.files : [])].find((f) => /^image\//.test(f.type));
			if (!file) return;
			e.preventDefault();
			q.image = await U.readImage(file);
			changed(); drawImg();
		});
		U.fill($.editor, 
			h('div', { class: 'qb-ed' },
				top, $.problems,
				h('section', { class: 'qb-sec' }, h('h3', { text: 'Question' }), stem, imgBox),
				h('section', { class: 'qb-sec' }, h('h3', { text: { mc: 'Choices (one correct)', ma: 'Choices (mark every correct one)', num: 'Answer', match: 'Pairs' }[q.type] }), answerEditor(q)),
				randomEditor(q),
				tagEditor(q),
				feedbackEditor(q),
				h('section', { class: 'qb-sec preview' }, h('div', { class: 'qb-row' }, h('h3', { text: 'Student view' }), h('span', { class: 'grow' }), h('label', { class: 'qb-check' }, h('input', { type: 'checkbox', checked: S.showKey, onchange: (e) => { S.showKey = e.target.checked; renderDerived(); } }), ' Show answer'), QB.hasMath(q) ? U.btn('Re-roll', () => { S.roll++; renderDerived(); }, 'sm', 'dice') : null), ($.preview = h('div')))
			)
		);
		renderDerived();
	}
	function renderDerived() {
		const q = current();
		if (!q || !$.preview) return;
		const probs = QB.check(q);
		U.fill($.problems, ...probs.map((p) => h('p', { class: p.level === 'error' ? 'qb-err' : 'qb-warn' }, U.icon('warn', 'qi xs'), ' ' + p.msg)));
		let inst;
		try { inst = QB.instantiate(q, QB.hasMath(q) ? (S.roll ? S.roll * 7919 : 'base') : 'base'); } catch (e) { U.fill($.preview, h('p', { class: 'qb-err', text: e.message })); return; }
		U.fill($.preview, U.preview(q, inst, { key: S.showKey }));
		if ($.samples) { const t = U.varTable(q); U.fill($.samples, t ? h('div', null, h('p', { class: 'qb-hint', text: 'Sample rolls' }), t) : ''); }
		if ($.autoTags) U.fill($.autoTags, ...QB.autoTags(q).map((t) => h('span', { class: 'qb-badge auto', text: t })));
	}
	function answerEditor(q) {
		const box = h('div', { class: 'qb-answer' });
		if (q.type === 'mc' || q.type === 'ma') {
			const name = 'c_' + q.id;
			const draw = () => {
				U.fill(box, 
					...q.choices.map((c, i) => h('div', { class: 'qb-choice' + (c.correct ? ' right' : '') },
						h('input', { type: q.type === 'mc' ? 'radio' : 'checkbox', name, checked: c.correct, title: 'Correct', 'aria-label': 'Correct', onchange: (e) => { if (q.type === 'mc') q.choices.forEach((x) => (x.correct = x === c)); else c.correct = e.target.checked; changed(); draw(); } }),
						h('span', { class: 'qb-letter', text: String.fromCharCode(65 + i) }),
						h('div', { class: 'qb-col grow' }, inp(() => c.text, (v) => (c.text = v), { placeholder: 'Choice text (templates like {=F/m} work)' }), inp(() => c.feedback, (v) => (c.feedback = v), { placeholder: 'Feedback when chosen (optional)', cls: 'sub' })),
						h('div', { class: 'qb-col' }, U.btn('', () => { if (i > 0) { [q.choices[i - 1], q.choices[i]] = [q.choices[i], q.choices[i - 1]]; changed(); draw(); } }, 'icon xs', 'chev', 'Move up'), U.btn('', () => { q.choices.splice(i, 1); changed(); draw(); }, 'icon xs', 'x', 'Remove')))),
					h('div', { class: 'qb-row' }, U.btn('Add choice', () => { q.choices.push({ id: QB.newId('c'), text: '', correct: false, feedback: '' }); changed(); draw(); box.querySelectorAll('.qb-choice input.qb-input:not(.sub)')[q.choices.length - 1].focus(); }, 'sm', 'plus'), h('label', { class: 'qb-check' }, h('input', { type: 'checkbox', checked: q.shuffle, onchange: (e) => { q.shuffle = e.target.checked; changed(); } }), ' Shuffle choices'))
				);
				box.querySelectorAll('.qb-choice .qi.chev').forEach((s) => (s.style.transform = 'rotate(180deg)'));
			};
			draw();
		} else if (q.type === 'num') {
			const a = q.answer;
			const tolMode = h('select', { class: 'qb-select narrow', onchange: (e) => { a.tolMode = e.target.value; changed(); } }, h('option', { value: '%', text: '%', selected: a.tolMode === '%' }), h('option', { value: 'abs', text: '± units', selected: a.tolMode === 'abs' }));
			box.append(
				h('div', { class: 'qb-numrow' },
					field('Answer (number or formula)', inp(() => a.expr, (v) => (a.expr = v.trim()), { placeholder: 'e.g. 12.5   or   (v1 - v0)/t', cls: 'mono' })),
					field('Unit', inp(() => a.unit, (v) => (a.unit = v), { placeholder: 'm/s^2^', cls: 'narrow' })),
					field('Tolerance', h('div', { class: 'qb-row tight' }, inp(() => a.tol, (v) => (a.tol = v == null ? 0 : v), { type: 'number', min: 0, step: 'any', cls: 'narrow' }), tolMode)),
					field('Sig figs shown', inp(() => a.sigfigs, (v) => (a.sigfigs = v || 3), { type: 'number', min: 1, max: 10, cls: 'narrow' }))
				),
				h('p', { class: 'qb-hint', html: 'A formula may use the variables and worked values below and <code>+ − * / ^</code>, <code>sqrt</code>, <code>sin cos tan</code> (radians), <code>sind cosd tand asind…</code> (degrees), <code>ln log exp abs min max round pi</code>. Canvas has no unit box, so exports add “Give your answer in …”.' })
			);
		} else {
			const draw = () => {
				U.fill(box, 
					...q.pairs.map((p, i) => h('div', { class: 'qb-pair' }, inp(() => p.left, (v) => (p.left = v), { placeholder: 'Prompt' }), h('span', { class: 'arrow', text: '→' }), inp(() => p.right, (v) => (p.right = v), { placeholder: 'Match' }), U.btn('', () => { q.pairs.splice(i, 1); changed(); draw(); }, 'icon xs', 'x', 'Remove'))),
					h('div', { class: 'qb-row' }, U.btn('Add pair', () => { q.pairs.push({ id: QB.newId('p'), left: '', right: '' }); changed(); draw(); }, 'sm', 'plus')),
					field('Extra wrong matches (distractors), one per line', inp(() => q.distractors.join('\n'), (v) => (q.distractors = v.split('\n').map((s) => s.trim()).filter(Boolean)), { rows: 2 }))
				);
			};
			draw();
		}
		return box;
	}
	function randomEditor(q) {
		const open = q.vars.length > 0 || q.calcs.length > 0;
		const box = h('div');
		$.samples = h('div', { class: 'qb-samples' });
		const draw = () => {
			U.fill(box, 
				h('p', { class: 'qb-hint', html: 'Each student (or each exported version) gets values drawn from these ranges. Write <code>{name}</code> in the text to show a value, <code>{name:3s}</code> / <code>{name:2f}</code> to format it, or <code>{=2*m*g}</code> for a worked value inline.' }),
				h('table', { class: 'qb-vars' },
					h('tr', null, ['Variable', 'Min', 'Max', 'Step', ''].map((t) => h('th', { text: t }))),
					q.vars.map((v, i) => h('tr', null,
						h('td', null, inp(() => v.name, (x) => (v.name = x.trim()), { placeholder: 'v0', cls: 'mono' })),
						h('td', null, inp(() => v.min, (x) => (v.min = x == null ? 0 : x), { type: 'number', step: 'any' })),
						h('td', null, inp(() => v.max, (x) => (v.max = x == null ? 0 : x), { type: 'number', step: 'any' })),
						h('td', null, inp(() => v.step, (x) => (v.step = x), { type: 'number', step: 'any', min: 0, placeholder: '1' })),
						h('td', null, U.btn('', () => { q.vars.splice(i, 1); changed(); draw(); }, 'icon xs', 'x', 'Remove'))))
				),
				h('div', { class: 'qb-row' }, U.btn('Add variable', () => { q.vars.push({ name: nextName(q), min: 1, max: 10, step: 1 }); changed(); draw(); }, 'sm', 'plus'), h('span', { class: 'qb-hint', text: 'Same min and max = a constant.' })),
				h('table', { class: 'qb-vars calcs' },
					q.calcs.length ? h('tr', null, h('th', { text: 'Worked value' }), h('th'), h('th', { text: 'Formula' }), h('th')) : null,
					q.calcs.map((c, i) => h('tr', null, h('td', null, inp(() => c.name, (x) => (c.name = x.trim()), { cls: 'mono' })), h('td', { text: '=' }), h('td', { class: 'wide' }, inp(() => c.expr, (x) => (c.expr = x), { cls: 'mono', placeholder: '(v1 - v0)/t' })), h('td', null, U.btn('', () => { q.calcs.splice(i, 1); changed(); draw(); }, 'icon xs', 'x', 'Remove'))))
				),
				h('div', { class: 'qb-row' }, U.btn('Add worked value', () => { q.calcs.push({ name: 'w' + (q.calcs.length + 1), expr: '' }); changed(); draw(); }, 'sm', 'plus')),
				field('Only keep rolls where (optional)', inp(() => q.constraint, (v) => (q.constraint = v), { cls: 'mono', placeholder: 'e.g. v1 > v0 + 2 and F != m*a' })),
				$.samples
			);
			renderDerived();
		};
		draw();
		return h('details', { class: 'qb-sec', open: open || null }, h('summary', null, h('h3', null, U.icon('dice', 'qi'), ' Randomize values'), QB.isRandom(q) ? h('span', { class: 'qb-badge rnd', text: q.vars.length + ' variable' + (q.vars.length === 1 ? '' : 's') }) : null), box);
	}
	function nextName(q) {
		for (const n of ['a', 'b', 'c', 'm', 'v', 't', 'x', 'F', 'h', 'd']) if (!q.vars.some((v) => v.name === n) && !q.calcs.some((c) => c.name === n)) return n;
		return 'x' + (q.vars.length + 1);
	}
	function tagEditor(q) {
		const fw = S.fw;
		const facets = QB.facets(S.bank.questions);
		const units = [...new Set([...(fw ? fw.units : []), ...facets.units])];
		const topics = [...new Set([...(fw ? fw.topics : []), ...facets.topics])];
		const unitIn = inp(() => q.tags.unit, (v) => (q.tags.unit = v.trim()), { list: 'qb-units', placeholder: fw && fw.units.length ? 'Pick or type' : 'Unit name' });
		const objBox = h('div', { class: 'qb-objs' });
		const drawObjs = () => {
			U.fill(objBox, 
				...q.tags.objectives.map((o, i) => {
					const node = fw && fw.byCode.get(o.code);
					return h('span', { class: 'qb-chip code', title: node ? node.text : o.fw && o.fw !== S.bank.framework ? `From ${U.fwInfo(o.fw).label}` : '' }, o.code, h('button', { type: 'button', 'aria-label': 'Remove ' + o.code, onclick: () => { q.tags.objectives.splice(i, 1); changed(); drawObjs(); } }, '×'));
				}),
				U.btn('Pick…', async () => {
					const codes = await U.pickObjectives(S.bank.framework, q.tags.objectives.filter((o) => !o.fw || o.fw === S.bank.framework).map((o) => o.code));
					if (!codes) return;
					q.tags.objectives = [...q.tags.objectives.filter((o) => o.fw && o.fw !== S.bank.framework), ...codes.map((code) => ({ fw: S.bank.framework, code }))];
					changed(); drawObjs();
				}, 'sm', 'plus')
			);
			const first = q.tags.objectives[0];
			const node = first && fw && fw.byCode.get(first.code);
			objHint.textContent = node ? `${first.code}: ${node.text}` : '';
		};
		const objHint = h('small', { class: 'qb-hint clamp' });
		drawObjs();
		const diff = h('div', { class: 'qb-diffpick', role: 'radiogroup', 'aria-label': 'Difficulty' });
		const drawDiff = () => U.fill(diff, ...[1, 2, 3, 4, 5].map((d) => h('button', { type: 'button', class: 'd' + d + (q.tags.difficulty >= d ? ' on' : ''), role: 'radio', 'aria-checked': String(q.tags.difficulty === d), title: QB.DIFFICULTY[d], text: d, onclick: () => { q.tags.difficulty = q.tags.difficulty === d ? 0 : d; changed(); drawDiff(); } })), h('span', { class: 'qb-hint', text: q.tags.difficulty ? QB.DIFFICULTY[q.tags.difficulty] : 'not set' }));
		drawDiff();
		$.autoTags = h('span', { class: 'qb-autotags' });
		return h('section', { class: 'qb-sec' },
			h('h3', { text: 'Tags' }),
			h('div', { class: 'qb-tags' },
				field('Unit', h('div', null, unitIn, h('datalist', { id: 'qb-units' }, units.map((u) => h('option', { value: u }))))),
				h('div', { class: 'qb-field' }, h('span', { text: 'Topics' }), U.chips({ values: q.tags.topics, suggestions: topics, placeholder: 'Add a topic…', onchange: (v) => { q.tags.topics = v; changed(); } })),
				h('div', { class: 'qb-field' }, h('span', { text: `Objectives${S.bank.framework !== 'none' ? ' · ' + U.fwInfo(S.bank.framework).label : ''}` }), objBox, objHint),
				h('div', { class: 'qb-field' }, h('span', { text: 'Difficulty' }), diff),
				h('div', { class: 'qb-field' }, h('span', { text: 'Tags' }), U.chips({ values: q.tags.custom, suggestions: facets.tags.filter((t) => !QB.autoTags(QB.blank()).includes(t)), placeholder: 'Add a tag…', onchange: (v) => { q.tags.custom = v; changed(); } })),
				h('div', { class: 'qb-field' }, h('span', { text: 'Automatic' }), $.autoTags)
			)
		);
	}
	function feedbackEditor(q) {
		const has = q.feedback.correct || q.feedback.incorrect || q.feedback.general || q.solution;
		return h('details', { class: 'qb-sec', open: has ? true : null }, h('summary', null, h('h3', { text: 'Feedback and solution' })),
			h('div', { class: 'qb-fb' },
				field('When right', inp(() => q.feedback.correct, (v) => (q.feedback.correct = v), { rows: 1 })),
				field('When wrong', inp(() => q.feedback.incorrect, (v) => (q.feedback.incorrect = v), { rows: 1 })),
				field('Always (general feedback)', inp(() => q.feedback.general, (v) => (q.feedback.general = v), { rows: 1 })),
				field('Worked solution', inp(() => q.solution, (v) => (q.solution = v), { rows: 3, placeholder: 'Shown after answering in Canvas (as general feedback). Templates work here too.' }))
			));
	}

	/* ======================== import / export ======================== */
	async function importQuestions() {
		const r = await U.importDialog({ title: 'Import questions into “' + S.env.meta.title + '”', existing: S.bank.questions });
		if (!r) return;
		const fwFromFile = r.results.map((x) => x.framework).find(Boolean);
		const qs = r.questions.map((q) => {
			const c = QB.normalize(q);
			c.tags.objectives.forEach((o) => { if (!o.fw) o.fw = fwFromFile || S.bank.framework; });
			if (c.lib) c.lib = c.lib; // keeps library links from bank files
			return c;
		});
		const ids = new Set(S.bank.questions.map((q) => q.id));
		for (const q of qs) if (ids.has(q.id)) q.id = QB.newId('q');
		S.bank.questions.push(...qs);
		S.cur = qs[0] ? qs[0].id : S.cur;
		S.tab = 'questions';
		touch();
		renderAll();
		const bad = qs.filter((q) => QB.errors(q).length).length;
		U.toast(`Added ${qs.length} question${qs.length === 1 ? '' : 's'}${bad ? ` · ${bad} need fixing (marked “fix”)` : ''}.`);
	}
	function downloadBank(qs) {
		saveNow();
		const env = qs.length === S.bank.questions.length ? S.env : HT.files.wrap(TOOL, { title: S.env.meta.title + ' (part)', data: { ...S.bank, questions: qs } });
		HT.files.download(env);
	}
	async function exportQTI(qs) {
		if (!qs.length) return U.toast('No questions to export.', { error: true });
		const title = h('input', { class: 'qb-input', value: S.env.meta.title });
		const rnd = qs.filter((q) => QB.isRandom(q));
		const mode = h('select', { class: 'qb-select' }, h('option', { value: 'auto', text: 'Canvas formula questions where possible, otherwise versions' }), h('option', { value: 'variants', text: 'Versions: several rolls, Canvas picks one per student' }), h('option', { value: 'fixed', text: 'One fixed roll each' }));
		const nv = h('input', { class: 'qb-input narrow', type: 'number', min: 2, max: 50, value: 5 });
		const r = await U.modal('Export to Canvas (QTI)', h('div', { class: 'qb-col' },
			field('Quiz / bank name in Canvas', title),
			rnd.length ? h('div', { class: 'qb-col' }, h('p', null, `${rnd.length} of these ${qs.length} questions have randomized values.`), field('Randomized questions', mode), field('Versions per question', nv)) : null,
			h('p', { class: 'qb-hint', text: 'Every question goes in as its own item. To arrange questions, set points, or make “pick N of these” groups, use the Quiz Builder instead.' }),
			h('p', { class: 'qb-hint', text: 'In Canvas: Course › Settings › Import Course Content › QTI .zip file › choose the file › Import. It appears as a quiz (unpublished) and a question bank.' })
		), [{ label: 'Cancel' }, { label: 'Download .zip', cls: 'primary', value: true }]);
		if (!r) return;
		const m = mode.value;
		const quiz = { title: title.value.trim() || S.env.meta.title, entries: qs.map((q) => ({ kind: 'q', q, mode: m === 'auto' ? undefined : m, variants: Number(nv.value) || 5 })) };
		const out = QF.toQTI(quiz);
		U.download(QF.slug(quiz.title) + '.qti.zip', new Blob([out.zip], { type: 'application/zip' }));
		if (out.warnings.length) U.modal('Exported, with notes', h('ul', { class: 'qb-notes' }, out.warnings.map((w) => h('li', { text: w }))), [{ label: 'OK', cls: 'primary' }]);
		else U.toast(`Exported ${out.count} questions (${out.total} points).`);
	}
	function toBuilder(qs) {
		saveNow();
		try { sessionStorage.setItem('qb:handoff', JSON.stringify({ bank: S.env.id, ids: qs.map((q) => q.id), title: S.env.meta.title })); } catch {}
		location.href = 'quiz-builder.html?from=bank';
	}

	/* ======================== shared library ======================== */
	async function share(qs) {
		if (!U.isTeacher()) return U.modal('Shared library', h('p', { text: 'Sign in with a teacher account (Teacher Tools dashboard) to share questions with other teachers.' }), [{ label: 'OK', cls: 'primary' }]);
		const bad = qs.filter((q) => QB.errors(q).length);
		const ok = qs.filter((q) => !QB.errors(q).length);
		if (!ok.length) return U.toast('Fix the marked problems before sharing.', { error: true });
		const me = U.account();
		const go = await U.confirm('Share to the library', `Share ${ok.length} question${ok.length === 1 ? '' : 's'} with every teacher on Happy Theta${bad.length ? ` (${bad.length} with problems are left out)` : ''}? Others get copies; only you can change or remove what you share. Your email shows as the owner.`, 'Share');
		if (!go) return;
		const fw = U.fwInfo(S.bank.framework);
		const entries = ok.map((q) => ({ question: U.toLibrary(q), course: fw.id === 'none' ? null : { id: fw.id, label: fw.label }, id: q.lib ? q.lib.id : undefined, baseVersion: q.lib && q.lib.owner === me.email ? q.lib.version : undefined }));
		try {
			let made = 0, upd = 0, same = 0, conflicts = 0;
			for (let i = 0; i < entries.length; i += 100) {
				const { results } = await U.lib.batch(entries.slice(i, i + 100));
				results.forEach((r, j) => {
					const q = ok[i + j];
					if (r.status === 'created' || r.status === 'updated' || r.status === 'unchanged') {
						q.lib = { id: r.id, version: r.version, owner: me.email, sig: QB.sig(q) };
						r.status === 'created' ? made++ : r.status === 'updated' ? upd++ : same++;
					} else if (r.status === 'conflict') conflicts++;
				});
			}
			touch();
			renderList();
			U.toast(`Shared: ${made} new, ${upd} updated${same ? `, ${same} unchanged` : ''}${conflicts ? `, ${conflicts} changed elsewhere (not sent)` : ''}.`);
		} catch (e) { U.toast(e.message, { error: true }); }
	}
	async function refreshLibVersions() {
		if (!U.isTeacher()) return;
		const ids = [...new Set(S.bank.questions.filter((q) => q.lib).map((q) => q.lib.id))];
		if (!ids.length) return;
		try { S.libVersions = await U.lib.versions(ids); renderList(); } catch {}
	}
	const L = { q: '', course: null, type: '', diffMin: '', diffMax: '', codes: '', mine: false, sort: 'new', items: [], total: 0, loading: false, error: '', open: new Set() };
	function renderLibrary() {
		if (!U.isTeacher()) {
			U.fill($.libView, h('div', { class: 'qb-empty' }, h('h2', { text: 'Shared question library' }), h('p', { text: 'Teachers on Happy Theta share questions here and pull copies into their own banks.' }), h('p', { text: 'Sign in with a teacher account on the Teacher Tools dashboard to use it.' }), h('a', { class: 'qb-btn primary', href: 'index.html' }, 'Teacher Tools')));
			return;
		}
		if (L.course == null) L.course = S.bank.framework === 'none' ? '' : S.bank.framework;
		const run = () => { L.items = []; search(); };
		const qIn = h('input', { class: 'qb-input', type: 'search', placeholder: 'Search the library…', value: L.q, onkeydown: (e) => { if (e.key === 'Enter') { L.q = qIn.value; run(); } } });
		const selF = (key, opts, onch) => h('select', { class: 'qb-select', onchange: (e) => { L[key] = e.target.value; (onch || run)(); } }, opts.map(([v, t]) => h('option', { value: v, text: t, selected: String(L[key]) === String(v) })));
		const codeIn = h('input', { class: 'qb-input', placeholder: 'Objective code', value: L.codes, onkeydown: (e) => { if (e.key === 'Enter') { L.codes = codeIn.value.trim(); run(); } } });
		$.libResults = h('div', { class: 'qb-lib-results' });
		U.fill($.libView, 
			h('div', { class: 'qb-lib-bar' },
				qIn, U.btn('Search', () => { L.q = qIn.value; L.codes = codeIn.value.trim(); run(); }, 'primary', 'search'),
				selF('course', [['', 'All frameworks'], ...U.FRAMEWORKS.filter((f) => f.id !== 'none').map((f) => [f.id, f.label])]),
				selF('type', [['', 'All types'], ...Object.entries(QB.TYPES)]),
				selF('diffMin', [['', 'Any difficulty'], ...[1, 2, 3, 4, 5].map((d) => [d, d + '+ · ' + QB.DIFFICULTY[d]])]),
				codeIn,
				h('label', { class: 'qb-check' }, h('input', { type: 'checkbox', checked: L.mine, onchange: (e) => { L.mine = e.target.checked; run(); } }), ' Only mine'),
				selF('sort', [['new', 'Newest'], ['popular', 'Most pulled'], ['difficulty', 'Easiest first']])
			),
			$.libResults
		);
		if (!L.items.length && !L.loading) search();
		else drawLib();
	}
	async function search(more) {
		L.loading = true;
		L.error = '';
		drawLib();
		try {
			const r = await U.lib.search({ q: L.q, course: L.course, type: L.type, diffMin: L.diffMin, codes: L.codes, mine: L.mine ? 1 : '', sort: L.sort, limit: 40, offset: more ? L.items.length : 0 });
			L.items = more ? [...L.items, ...r.items] : r.items;
			L.total = r.total;
		} catch (e) { L.error = e.message; }
		L.loading = false;
		drawLib();
	}
	function drawLib() {
		if (!$.libResults) return;
		const inBank = new Map(S.bank.questions.filter((q) => q.lib).map((q) => [q.lib.id, q]));
		U.fill($.libResults, 
			L.error ? h('p', { class: 'qb-err', text: L.error }) : '',
			h('p', { class: 'qb-hint', text: L.loading ? 'Searching…' : `${L.total} question${L.total === 1 ? '' : 's'} in the library match.` }),
			...L.items.map((it) => {
				const q = QB.normalize(it.question);
				const have = inBank.get(it.id);
				const behind = have && have.lib.version < it.version && !it.mine;
				const pv = h('div', { class: 'qb-lib-pv' });
				const card = h('article', { class: 'qb-lib-card' },
					h('div', { class: 'qb-qtop' }, h('span', { class: 'qb-type t-' + q.type, text: QB.TYPE_SHORT[q.type] }), h('span', { class: 'qb-qtext', text: QB.excerpt(q, 220) })),
					h('div', { class: 'qb-qmeta' },
						it.course ? h('span', { class: 'qb-badge', text: it.course.label }) : null,
						QB.isRandom(q) ? h('span', { class: 'qb-badge rnd' }, U.icon('dice', 'qi xs'), 'random') : null,
						q.tags.difficulty ? h('span', { class: 'qb-diff d' + q.tags.difficulty, text: '●'.repeat(q.tags.difficulty) + '○'.repeat(5 - q.tags.difficulty) }) : null,
						q.tags.unit ? h('span', { class: 'qb-badge', text: q.tags.unit }) : null,
						q.tags.objectives.slice(0, 4).map((o) => h('span', { class: 'qb-badge code', text: o.code })),
						it.hasImage ? h('span', { class: 'qb-badge' }, U.icon('img', 'qi xs')) : null,
						h('span', { class: 'qb-hint', text: `${it.mine ? 'You' : it.owner} · ${it.pulls} pull${it.pulls === 1 ? '' : 's'} · v${it.version}` })
					),
					h('div', { class: 'qb-row' },
						U.btn(L.open.has(it.id) ? 'Hide' : 'Preview', async () => { if (L.open.has(it.id)) L.open.delete(it.id); else L.open.add(it.id); drawLib(); }, 'sm', 'eye'),
						have ? h('span', { class: 'qb-badge ' + (behind ? 'warn' : 'ok'), text: behind ? 'Older copy in this bank' : 'In this bank' }) : null,
						behind ? U.btn('Update my copy', () => pull(it, have), 'sm primary') : null,
						!have || it.mine ? U.btn(have ? 'Add another copy' : 'Add to bank', () => pull(it), 'sm' + (have ? '' : ' primary'), 'plus') : null,
						it.mine ? U.btn('Remove from library', async () => { if (await U.confirm('Remove from library', 'Remove this question from the shared library? Copies other teachers pulled stay in their banks.', 'Remove', 'danger')) { try { await U.lib.remove(it.id); S.bank.questions.forEach((x) => { if (x.lib && x.lib.id === it.id) x.lib = null; }); touch(); search(); } catch (e) { U.toast(e.message, { error: true }); } } }, 'sm danger', 'trash') : null
					),
					pv
				);
				if (L.open.has(it.id)) {
					pv.append(h('p', { class: 'qb-hint', text: 'Loading…' }));
					U.lib.get(it.id).then((full) => { const fq = QB.normalize(full.question); U.fill(pv, U.preview(fq, QB.instantiate(fq, 'base'))); }).catch((e) => U.fill(pv, h('p', { class: 'qb-err', text: e.message })));
				}
				return card;
			}),
			L.items.length < L.total && !L.loading ? U.btn('Load more', () => search(true), '') : ''
		);
	}
	async function pull(item, replace) {
		try {
			const full = await U.lib.pull(item.id);
			const q = U.fromLibrary(full);
			if (replace) {
				const i = S.bank.questions.indexOf(replace);
				q.id = replace.id;
				q.created = replace.created;
				S.bank.questions[i] = q;
			} else S.bank.questions.push(q);
			touch();
			S.libVersions[item.id] = { version: full.version };
			drawLib();
			U.toast(replace ? 'Updated your copy.' : `Added to “${S.env.meta.title}”.`);
		} catch (e) { U.toast(e.message, { error: true }); }
	}

	/* ======================== start ======================== */
	function start() {
		build();
		let all = banks();
		if (!all.length) all = [newBank('My question bank', { framework: 'ap-physics-1', questions: examples() })];
		const last = ls.get(LAST);
		openBank(all.find((b) => b.id === last) || all[0]);
		setStatus('Saved');
		refreshLibVersions();
	}
	start();
})();
