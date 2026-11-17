/* Quiz Builder (teacher/quiz-builder.html): pick questions from Theta Questions banks, imported files
   (Canvas QTI, GIFT, Aiken, CSV, text, Google Forms) or the shared library; arrange them, make "pick N"
   groups, set points and how randomized questions go over; download a Canvas QTI .zip.
   Quizzes are saves of tool 'qquiz'. Each entry keeps a snapshot of its question (so the quiz doesn't
   change behind your back) plus a link to the bank question it came from, to offer updates. */
(function () {
	'use strict';
	const QB = HT.QB, QF = HT.QF, U = HT.QUI, h = U.h;
	const TOOL = 'qquiz', BANK = 'qbank';
	const LAST = 'happytheta:qquiz:last', LAST_SRC = 'happytheta:qquiz:src';
	const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
	const eid = () => QB.newId('e');

	const S = { env: null, quiz: null, src: '', srcFilter: { text: '', type: '', objective: '' }, picked: new Set(), imported: [], importStructures: [], lib: { items: [], total: 0, loading: false, error: '', q: '' }, open: new Set(), saveTimer: null, sel: new Set() };
	const $ = {};

	/* ======================== storage ======================== */
	const quizzes = () => { try { return HT.files.list(TOOL); } catch { return []; } };
	const banks = () => { try { return HT.files.list(BANK); } catch { return []; } };
	const bankQs = (id) => { const b = banks().find((x) => x.id === id); return b ? QB.normalizeBank(b.data).questions : []; };
	function normalizeQuiz(d) {
		const x = d && typeof d === 'object' ? d : {};
		const st = x.settings || {};
		const item = (it) => ({ id: it.id || eid(), q: QB.normalize(it.q), ref: it.ref && it.ref.bank ? { bank: String(it.ref.bank), qid: String(it.ref.qid), sig: String(it.ref.sig || '') } : null, mode: ['formula', 'variants', 'fixed'].includes(it.mode) ? it.mode : '', variants: Number(it.variants) || 0, points: it.points == null ? null : Number(it.points) });
		return {
			description: typeof x.description === 'string' ? x.description : '',
			settings: { shuffleAnswers: st.shuffleAnswers !== false, timeLimit: Number(st.timeLimit) || 0, attempts: Number(st.attempts) || 1, oneAtATime: !!st.oneAtATime, cantGoBack: !!st.cantGoBack, showCorrect: !!st.showCorrect },
			unitHint: x.unitHint !== false,
			defaultVariants: Number(x.defaultVariants) || 5,
			formulaSets: Number(x.formulaSets) || 50,
			entries: (Array.isArray(x.entries) ? x.entries : []).map((e) => (e.kind === 'group' ? { id: e.id || eid(), kind: 'group', title: String(e.title || 'Question group'), pick: Number(e.pick) || 1, points: Number(e.points) || 1, items: (e.items || []).filter((it) => it && it.q).map(item) } : e.q ? { ...item(e), kind: 'q' } : null)).filter(Boolean)
		};
	}
	function saveNow() {
		clearTimeout(S.saveTimer); S.saveTimer = null;
		if (!S.quiz) return;
		try {
			S.env = HT.files.wrap(TOOL, { title: S.env.meta.title, data: S.quiz }, S.env);
			HT.files.write(S.env);
			setStatus('Saved');
		} catch (e) { setStatus(/quota|exceed/i.test(String(e)) ? 'Not saved: browser storage is full.' : 'Not saved: ' + e.message, true); }
	}
	function touch() { setStatus('Saving…'); clearTimeout(S.saveTimer); S.saveTimer = setTimeout(saveNow, 600); }
	window.addEventListener('beforeunload', () => { if (S.saveTimer) saveNow(); });
	function setStatus(t, err) { if ($.status) { $.status.textContent = t; $.status.classList.toggle('error', !!err); } }
	function newQuiz(title, entries = []) {
		const env = HT.files.wrap(TOOL, { title, data: normalizeQuiz({ entries }) });
		HT.files.write(env);
		return env;
	}
	function openQuiz(env) {
		if (S.saveTimer) saveNow();
		S.env = env;
		S.quiz = normalizeQuiz(env.data);
		S.sel.clear(); S.open.clear();
		ls.set(LAST, env.id);
		renderAll();
	}

	/* ======================== helpers ======================== */
	const allItems = () => S.quiz.entries.flatMap((e) => (e.kind === 'group' ? e.items : [e]));
	const modeOf = (it) => it.mode || QF.defaultMode(it.q);
	const usedKeys = () => {
		const s = new Set();
		for (const it of allItems()) { if (it.ref) s.add(it.ref.bank + ':' + it.ref.qid); s.add('sig:' + QB.sig(it.q)); }
		return s;
	};
	const makeItem = (q, ref) => ({ id: eid(), q: QB.copy(q, true), ref: ref || null, mode: '', variants: 0, points: null });
	function totals() {
		let pts = 0, n = 0;
		for (const e of S.quiz.entries) {
			if (e.kind === 'group') { const k = Math.min(e.pick, e.items.length); pts += k * e.points; n += k; }
			else { pts += e.points != null ? e.points : e.q.points; n++; }
		}
		return { pts, n };
	}
	function quizForExport() {
		return {
			title: S.env.meta.title, description: S.quiz.description, settings: S.quiz.settings, unitHint: S.quiz.unitHint, formulaSets: S.quiz.formulaSets,
			entries: S.quiz.entries.map((e) => (e.kind === 'group'
				? { kind: 'group', title: e.title, pick: e.pick, points: e.points, items: e.items.map((it) => ({ q: it.q, mode: it.mode || undefined, variants: it.variants || S.quiz.defaultVariants })) }
				: { kind: 'q', q: e.q, mode: e.mode || undefined, variants: e.variants || S.quiz.defaultVariants, points: e.points != null ? e.points : e.q.points }))
		};
	}

	/* ======================== layout ======================== */
	function build() {
		const content = document.querySelector('.app .content') || document.body;
		$.status = h('span', { class: 'qb-status' });
		$.quizSel = h('select', { class: 'qb-select bank', 'aria-label': 'Quiz', onchange: () => { const env = quizzes().find((x) => x.id === $.quizSel.value); if (env) openQuiz(env); } });
		const quizMenu = U.menu('Quiz', () => [
			{ label: 'New quiz…', click: async () => { const t = await U.prompt('New quiz', 'Name', 'New quiz'); if (t) openQuiz(newQuiz(t)); } },
			{ label: 'Rename…', click: async () => { const t = await U.prompt('Rename quiz', 'Name', S.env.meta.title); if (t) { S.env.meta.title = t; saveNow(); renderAll(); } } },
			{ label: 'Duplicate', click: () => { saveNow(); const env = newQuiz(S.env.meta.title + ' (copy)'); env.data = JSON.parse(JSON.stringify(S.quiz)); HT.files.write(env); openQuiz(env); } },
			'-',
			{ label: 'Download quiz file (.qquiz.json)', click: () => { saveNow(); HT.files.download(S.env); } },
			{ label: 'Open a quiz file…', click: openQuizFile },
			'-',
			{ label: 'Delete this quiz…', danger: true, click: async () => { if (!(await U.confirm('Delete quiz', `Delete “${S.env.meta.title}”? Its questions stay in their banks.`, 'Delete', 'danger'))) return; clearTimeout(S.saveTimer); S.saveTimer = null; HT.files.remove(TOOL, S.env.id); const rest = quizzes(); openQuiz(rest[0] || newQuiz('New quiz')); } }
		]);
		$.head = h('header', { class: 'qb-head' },
			h('div', { class: 'qb-title' }, h('span', { class: 'qb-app', text: 'Quiz Builder' }), h('div', { class: 'qb-row tight' }, $.quizSel, quizMenu)),
			h('div', { class: 'qb-actions' }, $.status, h('a', { class: 'qb-btn', href: 'questions.html' }, U.icon('copy'), h('span', { text: 'Theta Questions' })), U.btn('Download for Canvas', exportQTI, 'primary', 'down'))
		);
		$.src = h('section', { class: 'qz-src', 'aria-label': 'Add questions' });
		$.quizPane = h('section', { class: 'qz-quiz', 'aria-label': 'Quiz' });
		$.root = h('div', { class: 'qb' }, $.head, h('div', { class: 'qz-main' }, $.src, $.quizPane));
		content.append($.root);
		document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNow(); } });
	}
	function renderAll() {
		U.fill($.quizSel, ...quizzes().map((q) => h('option', { value: q.id, text: q.meta.title, selected: q.id === S.env.id })));
		document.title = S.env.meta.title + ' · Quiz Builder';
		renderSource();
		renderQuiz();
	}

	/* ======================== source pane ======================== */
	function sourceQuestions() {
		if (S.src.startsWith('bank:')) { const id = S.src.slice(5); return bankQs(id).map((q) => ({ q, ref: { bank: id, qid: q.id, sig: QB.sig(q) } })); }
		if (S.src === 'imported') return S.imported.map((q) => ({ q, ref: null }));
		return [];
	}
	function renderSource() {
		const bs = banks();
		if (!S.src || (S.src.startsWith('bank:') && !bs.some((b) => 'bank:' + b.id === S.src))) S.src = ls.get(LAST_SRC) && (ls.get(LAST_SRC) === 'imported' || ls.get(LAST_SRC) === 'library' || bs.some((b) => 'bank:' + b.id === ls.get(LAST_SRC))) ? ls.get(LAST_SRC) : bs[0] ? 'bank:' + bs[0].id : 'imported';
		const srcSel = h('select', { class: 'qb-select', 'aria-label': 'Where questions come from', onchange: (e) => { S.src = e.target.value; ls.set(LAST_SRC, S.src); S.picked.clear(); renderSource(); } },
			bs.length ? h('optgroup', { label: 'My banks' }, bs.map((b) => h('option', { value: 'bank:' + b.id, selected: S.src === 'bank:' + b.id, text: `${b.meta.title} (${((b.data && b.data.questions) || []).length})` }))) : null,
			h('option', { value: 'imported', selected: S.src === 'imported', text: `Imported files${S.imported.length ? ` (${S.imported.length})` : ''}` }),
			h('option', { value: 'library', selected: S.src === 'library', text: 'Shared library' })
		);
		const f = S.srcFilter;
		const search = h('input', { class: 'qb-input', type: 'search', placeholder: S.src === 'library' ? 'Search the library (Enter)…' : 'Search…', value: S.src === 'library' ? S.lib.q : f.text });
		search.addEventListener(S.src === 'library' ? 'keydown' : 'input', (e) => { if (S.src === 'library') { if (e.key === 'Enter') { S.lib.q = search.value; libSearch(); } } else { f.text = search.value; drawSourceList(); } });
		const typeSel = h('select', { class: 'qb-select', onchange: (e) => { f.type = e.target.value; S.src === 'library' ? libSearch() : drawSourceList(); } }, h('option', { value: '', text: 'All types' }), Object.entries(QB.TYPES).map(([t, l]) => h('option', { value: t, text: l, selected: f.type === t })));
		const objIn = h('input', { class: 'qb-input', placeholder: 'Objective', value: f.objective, style: { width: '7rem' } });
		objIn.addEventListener(S.src === 'library' ? 'change' : 'input', () => { f.objective = objIn.value.trim(); S.src === 'library' ? libSearch() : drawSourceList(); });
		$.srcList = h('div', { class: 'qz-src-list' });
		$.srcFoot = h('div', { class: 'qz-src-foot' });
		const tools = S.src === 'imported'
			? h('div', { class: 'qb-row' }, U.btn('Import files or text…', importFiles, 'primary sm', 'down'), S.imported.length ? U.btn('Save to a bank…', saveImportedToBank, 'sm') : null, S.imported.length ? h('button', { type: 'button', class: 'qb-link', text: 'Clear', onclick: () => { S.imported = []; S.importStructures = []; S.picked.clear(); renderSource(); } }) : null)
			: S.src === 'library' && !U.isTeacher() ? h('p', { class: 'qb-hint', text: 'Sign in with a teacher account to use the shared library.' }) : null;
		U.fill($.src, 
			h('div', { class: 'qz-src-head' },
				h('div', { class: 'qb-row tight' }, h('b', { text: 'Add questions from', style: { whiteSpace: 'nowrap', fontSize: '0.8125rem' } }), srcSel),
				tools,
				S.importStructures.length && S.src === 'imported' ? h('div', { class: 'qb-row' }, h('span', { class: 'qb-hint', text: 'A Canvas quiz came with its layout (groups, points).' }), ...S.importStructures.map((st, i) => U.btn(`Use layout of “${st.title || 'quiz ' + (i + 1)}”`, () => useLayout(st), 'sm'))) : null,
				h('div', { class: 'qb-row tight' }, search, typeSel, objIn)
			),
			$.srcList, $.srcFoot
		);
		if (S.src === 'library') { if (U.isTeacher() && !S.lib.items.length && !S.lib.loading) libSearch(); else drawSourceList(); }
		else drawSourceList();
	}
	function filteredSource() {
		const f = S.srcFilter;
		return sourceQuestions().filter(({ q }) => QB.matches(q, { text: f.text, types: f.type ? [f.type] : [], objective: f.objective }));
	}
	function srcRow(q, key, used, extra) {
		const r = h('div', { class: 'qz-srow' + (used ? ' used' : ''), draggable: 'true' },
			h('input', { type: 'checkbox', checked: S.picked.has(key), 'aria-label': 'Choose', onchange: (e) => { e.target.checked ? S.picked.add(key) : S.picked.delete(key); drawFoot(); } }),
			h('div', { class: 'qb-qmain' },
				h('div', { class: 'qb-qtop' }, h('span', { class: 'qb-type t-' + q.type, text: QB.TYPE_SHORT[q.type] }), h('span', { class: 'qb-qtext', text: QB.excerpt(q, 150) || '(no text)' })),
				h('div', { class: 'qb-qmeta' },
					used ? h('span', { class: 'qb-badge ok' }, U.icon('check', 'qi xs'), 'in quiz') : null,
					QB.isRandom(q) ? h('span', { class: 'qb-badge rnd' }, U.icon('dice', 'qi xs'), 'random') : null,
					q.tags.difficulty ? h('span', { class: 'qb-diff d' + q.tags.difficulty, text: '●'.repeat(q.tags.difficulty) + '○'.repeat(5 - q.tags.difficulty) }) : null,
					q.tags.objectives.slice(0, 3).map((o) => h('span', { class: 'qb-badge code', text: o.code })),
					QB.errors(q).length ? h('span', { class: 'qb-badge err', title: QB.errors(q)[0].msg }, U.icon('warn', 'qi xs'), 'fix') : null,
					q.source && q.source.name ? h('span', { class: 'qb-hint', text: q.source.name }) : null,
					extra || null
				)
			),
			U.btn('', () => addKeys([key]), 'icon xs', 'plus', 'Add to the end of the quiz')
		);
		r.addEventListener('dragstart', (e) => { const keys = S.picked.has(key) ? [...S.picked] : [key]; e.dataTransfer.setData('text/x-src', JSON.stringify(keys)); e.dataTransfer.effectAllowed = 'copy'; });
		return r;
	}
	function drawSourceList() {
		if (!$.srcList) return;
		const used = usedKeys();
		if (S.src === 'library') {
			if (!U.isTeacher()) { U.fill($.srcList, ); drawFoot(); return; }
			U.fill($.srcList, 
				S.lib.error ? h('p', { class: 'qb-err', text: S.lib.error }) : '',
				h('p', { class: 'qb-hint', style: { padding: '0.5rem 0.75rem' }, text: S.lib.loading ? 'Searching…' : `${S.lib.total} in the library match.` }),
				...S.lib.items.map((it) => srcRow(QB.normalize(it.question), 'lib:' + it.id, used.has('sig:' + QB.sig(QB.normalize(it.question))), h('span', { class: 'qb-hint', text: it.mine ? 'you' : it.owner }))),
				S.lib.items.length < S.lib.total ? h('div', { style: { padding: '0.5rem 0.75rem' } }, U.btn('Load more', () => libSearch(true), 'sm')) : ''
			);
		} else {
			const list = filteredSource();
			U.fill($.srcList, ...(list.length ? list.map(({ q, ref }) => srcRow(q, ref ? 'bank:' + ref.bank + ':' + q.id : 'imp:' + q.id, ref ? used.has(ref.bank + ':' + ref.qid) : used.has('sig:' + QB.sig(q)))) : [h('p', { class: 'qb-empty', text: S.src === 'imported' ? 'Import a Canvas export, GIFT, Aiken, CSV, Google Forms file or pasted text to choose from it.' : sourceQuestions().length ? 'Nothing matches.' : 'This bank is empty.' })]));
		}
		drawFoot();
	}
	function drawFoot() {
		if (!$.srcFoot) return;
		const keys = S.src === 'library' ? S.lib.items.map((it) => 'lib:' + it.id) : filteredSource().map(({ q, ref }) => (ref ? 'bank:' + ref.bank + ':' + q.id : 'imp:' + q.id));
		const n = S.picked.size;
		const groups = S.quiz.entries.filter((e) => e.kind === 'group');
		U.fill($.srcFoot, 
			h('button', { type: 'button', class: 'qb-link', text: keys.length && keys.every((k) => S.picked.has(k)) ? 'Select none' : 'Select all shown', onclick: () => { const all = keys.every((k) => S.picked.has(k)); keys.forEach((k) => (all ? S.picked.delete(k) : S.picked.add(k))); drawSourceList(); } }),
			h('span', { class: 'qb-hint', text: n ? `${n} chosen` : 'Choose questions, then add them' }),
			h('span', { class: 'grow' }),
			U.btn('Add to quiz', () => addKeys([...S.picked]), 'primary sm', 'plus'),
			U.menu('Group', () => [
				{ label: 'Add as a new “pick 1” group', disabled: !n, click: () => addKeys([...S.picked], 'new') },
				...(groups.length ? [{ heading: 'Add to group' }, ...groups.map((g) => ({ label: g.title, disabled: !n, click: () => addKeys([...S.picked], g.id) }))] : [])
			], { cls: 'sm' })
		);
	}
	/* keys → [{q, ref}] (library items are pulled, which counts the pull) */
	async function resolveKeys(keys) {
		const out = [];
		for (const k of keys) {
			if (k.startsWith('bank:')) {
				const [, bank, qid] = k.split(':');
				const q = bankQs(bank).find((x) => x.id === qid);
				if (q) out.push({ q, ref: { bank, qid, sig: QB.sig(q) } });
			} else if (k.startsWith('imp:')) {
				const q = S.imported.find((x) => x.id === k.slice(4));
				if (q) out.push({ q, ref: null });
			} else if (k.startsWith('lib:')) {
				try { const full = await U.lib.pull(k.slice(4)); out.push({ q: U.fromLibrary(full), ref: null }); } catch (e) { U.toast(e.message, { error: true }); }
			}
		}
		return out;
	}
	async function addKeys(keys, groupId, beforeId) {
		if (!keys.length) return U.toast('Choose some questions first.');
		const found = await resolveKeys(keys);
		const items = found.map(({ q, ref }) => makeItem(q, ref));
		insertItems(items, groupId, beforeId);
		S.picked.clear();
		touch();
		renderQuiz(); drawSourceList();
		const bad = items.filter((it) => QB.errors(it.q).length).length;
		U.toast(`Added ${items.length} question${items.length === 1 ? '' : 's'}${bad ? ` · ${bad} need fixing before export` : ''}.`);
	}
	function insertItems(items, groupId, beforeId) {
		if (groupId === 'new') {
			S.quiz.entries.push({ id: eid(), kind: 'group', title: 'Question group ' + (S.quiz.entries.filter((e) => e.kind === 'group').length + 1), pick: 1, points: items[0] ? items[0].q.points : 1, items });
		} else if (groupId) {
			const g = S.quiz.entries.find((e) => e.id === groupId);
			if (g) g.items.push(...items);
		} else {
			const at = beforeId ? S.quiz.entries.findIndex((e) => e.id === beforeId) : -1;
			const es = items.map((it) => ({ ...it, kind: 'q' }));
			if (at >= 0) S.quiz.entries.splice(at, 0, ...es); else S.quiz.entries.push(...es);
		}
	}
	async function importFiles() {
		const r = await U.importDialog({ title: 'Import questions to choose from', existing: [], action: 'Use' });
		if (!r) return;
		const ids = new Set(S.imported.map((q) => q.id));
		for (const q of r.questions) { if (ids.has(q.id)) q.id = QB.newId('q'); S.imported.push(q); }
		const chosen = new Set(r.questions.map((q) => q.id));
		for (const res of r.results) if (res.structure && res.structure.some((s) => s.kind === 'group')) S.importStructures.push({ title: res.title, structure: res.structure, ids: new Set(res.questions.map((q) => q.id)), chosen });
		S.src = 'imported';
		renderSource();
		U.toast(`${r.questions.length} question${r.questions.length === 1 ? '' : 's'} ready to add.`);
	}
	function useLayout(st) {
		const byId = new Map(S.imported.map((q) => [q.id, q]));
		for (const s of st.structure) {
			if (s.kind === 'group') {
				const items = s.ids.map((id) => byId.get(id)).filter(Boolean).map((q) => makeItem(q, null));
				if (items.length) S.quiz.entries.push({ id: eid(), kind: 'group', title: s.title, pick: Math.min(s.pick, items.length), points: s.points, items });
			} else {
				const q = byId.get(s.id);
				if (q) S.quiz.entries.push({ ...makeItem(q, null), kind: 'q', points: s.points });
			}
		}
		touch(); renderQuiz(); drawSourceList();
		U.toast('Added the quiz with its groups and points.');
	}
	async function saveImportedToBank() {
		const bs = banks();
		const sel = h('select', { class: 'qb-select' }, bs.map((b) => h('option', { value: b.id, text: b.meta.title })), h('option', { value: '__new', text: 'A new bank…' }));
		const which = h('select', { class: 'qb-select' }, h('option', { value: 'picked', text: `Chosen questions (${[...S.picked].filter((k) => k.startsWith('imp:')).length})` }), h('option', { value: 'all', text: `All imported (${S.imported.length})`, selected: !S.picked.size }));
		const r = await U.modal('Save imported questions to a bank', h('div', { class: 'qb-col' }, h('label', { class: 'qb-field' }, h('span', { text: 'Which' }), which), h('label', { class: 'qb-field' }, h('span', { text: 'Bank' }), sel)), [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', value: true }]);
		if (!r) return;
		const qs = which.value === 'all' ? S.imported : S.imported.filter((q) => S.picked.has('imp:' + q.id));
		if (!qs.length) return U.toast('Nothing chosen.');
		let env;
		if (sel.value === '__new') { const t = await U.prompt('New bank', 'Name', 'Imported questions'); if (!t) return; env = HT.files.wrap(BANK, { title: t, data: { framework: 'ap-physics-1', questions: [] } }); }
		else env = HT.files.read(BANK, sel.value);
		const data = QB.normalizeBank(env.data);
		const have = new Set(data.questions.map(QB.sig));
		const add = qs.filter((q) => !have.has(QB.sig(q))).map((q) => QB.copy(q));
		data.questions.push(...add);
		HT.files.write(HT.files.wrap(BANK, { title: env.meta.title, data }, env.data ? env : null));
		U.toast(`Saved ${add.length} to “${env.meta.title}”${qs.length - add.length ? ` (${qs.length - add.length} were already there)` : ''}.`);
	}
	async function libSearch(more) {
		if (!U.isTeacher()) return;
		S.lib.loading = true; S.lib.error = '';
		drawSourceList();
		try {
			const f = S.srcFilter;
			const r = await U.lib.search({ q: S.lib.q, type: f.type, codes: f.objective, limit: 40, offset: more ? S.lib.items.length : 0 });
			S.lib.items = more ? [...S.lib.items, ...r.items] : r.items;
			S.lib.total = r.total;
		} catch (e) { S.lib.error = e.message; }
		S.lib.loading = false;
		drawSourceList();
	}

	/* ======================== quiz pane ======================== */
	const field = (label, input, cls) => h('label', { class: 'qb-field ' + (cls || '') }, h('span', { text: label }), input);
	function settingsCard() {
		const st = S.quiz.settings;
		const num = (get, set, attrs = {}) => { const i = h('input', { class: 'qb-input', type: 'number', min: 0, ...attrs, value: get() || '' }); i.addEventListener('input', () => { set(Number(i.value) || 0); touch(); if (attrs.re) renderSummary(); }); return i; };
		const chk = (label, get, set) => h('label', { class: 'qb-check' }, h('input', { type: 'checkbox', checked: get(), onchange: (e) => { set(e.target.checked); touch(); } }), ' ' + label);
		const title = h('input', { class: 'qb-input', value: S.env.meta.title });
		title.addEventListener('change', () => { S.env.meta.title = title.value.trim() || 'Quiz'; saveNow(); U.fill($.quizSel, ...quizzes().map((q) => h('option', { value: q.id, text: q.meta.title, selected: q.id === S.env.id }))); });
		const desc = h('textarea', { class: 'qb-input', rows: 2, placeholder: 'Instructions shown to students before they start (optional)', value: S.quiz.description });
		desc.addEventListener('input', () => { S.quiz.description = desc.value; touch(); });
		return h('details', { class: 'qb-sec', open: !S.quiz.entries.length || null },
			h('summary', null, h('h3', { text: 'Quiz settings' }), h('span', { class: 'qb-hint', text: `${st.timeLimit ? st.timeLimit + ' min · ' : ''}${st.attempts > 0 ? st.attempts + ' attempt' + (st.attempts === 1 ? '' : 's') : 'unlimited attempts'}` })),
			h('div', { class: 'qz-settings' },
				field('Quiz name in Canvas', title, 'span2'),
				field('Time limit (minutes, 0 = none)', num(() => st.timeLimit, (v) => (st.timeLimit = v))),
				field('Attempts (0 = unlimited)', num(() => st.attempts, (v) => (st.attempts = v))),
				field('Instructions', desc, 'span4'),
				h('div', { class: 'qb-col span2' }, chk('Shuffle answer choices', () => st.shuffleAnswers, (v) => (st.shuffleAnswers = v)), chk('One question at a time', () => st.oneAtATime, (v) => (st.oneAtATime = v)), chk('…and lock questions after answering', () => st.cantGoBack, (v) => (st.cantGoBack = v)), chk('Let students see the correct answers', () => st.showCorrect, (v) => (st.showCorrect = v))),
				h('div', { class: 'qb-col span2' }, chk('Add “Give your answer in (unit)” to numerical questions', () => S.quiz.unitHint, (v) => (S.quiz.unitHint = v)), field('Versions per randomized question (default)', num(() => S.quiz.defaultVariants, (v) => (S.quiz.defaultVariants = Math.max(2, Math.min(50, v || 5))), { min: 2, max: 50 })), field('Value sets per Canvas formula question', num(() => S.quiz.formulaSets, (v) => (S.quiz.formulaSets = Math.max(1, Math.min(200, v || 50))), { min: 1, max: 200 })))
			),
			h('p', { class: 'qb-hint', text: 'Canvas keeps the quiz unpublished after import, so you can still change dates, availability and anything else there.' })
		);
	}
	function renderSummary() {
		if (!$.summary) return;
		const { pts, n } = totals();
		const items = allItems();
		const rnd = items.filter((it) => QB.isRandom(it.q)).length;
		const bad = items.filter((it) => QB.errors(it.q).length);
		U.fill($.summary, 
			h('span', null, h('b', { text: n }), ` question${n === 1 ? '' : 's'} per student`),
			h('span', null, h('b', { text: Math.round(pts * 100) / 100 }), ' points'),
			rnd ? h('span', null, h('b', { text: rnd }), ' randomized') : null,
			bad.length ? h('span', { class: 'qb-badge err' }, U.icon('warn', 'qi xs'), `${bad.length} need${bad.length === 1 ? 's' : ''} fixing`) : null,
			h('span', { class: 'grow' }),
			U.btn('New group', () => { S.quiz.entries.push({ id: eid(), kind: 'group', title: 'Question group ' + (S.quiz.entries.filter((e) => e.kind === 'group').length + 1), pick: 1, points: 1, items: [] }); touch(); renderQuiz(); }, 'sm', 'group'),
			S.sel.size > 1 ? U.btn(`Group ${S.sel.size} checked`, groupChecked, 'sm') : null,
			S.sel.size ? U.btn(`Remove ${S.sel.size} checked`, () => { removeIds([...S.sel]); }, 'sm danger', 'trash') : null
		);
	}
	function renderQuiz() {
		if (!$.quizPane) return;
		$.summary = h('div', { class: 'qz-summary' });
		$.entries = h('div', { class: 'qz-entries' });
		const end = h('div', { class: 'qz-drop-end', text: S.quiz.entries.length ? 'Drop here to add at the end' : 'Choose questions on the left and click “Add to quiz”, or drag them here.' });
		dropTarget(end, { end: true });
		U.fill($.quizPane, h('div', { class: 'qz-quiz-in' }, settingsCard(), h('section', { class: 'qb-sec' }, $.summary, $.entries, end)));
		renderSummary();
		let n = 0;
		for (const e of S.quiz.entries) {
			if (e.kind === 'group') { $.entries.append(groupEl(e, n)); n += Math.min(e.pick, e.items.length); }
			else $.entries.append(itemEl(e, ++n, null));
		}
	}
	function modeControl(it) {
		if (!QB.hasMath(it.q) || !QB.isRandom(it.q)) return null;
		const why = QF.formulaProblem(it.q);
		const m = modeOf(it);
		const sel = h('select', { class: 'qb-select', title: 'How Canvas gets the random values', onchange: (e) => { it.mode = e.target.value; touch(); renderQuiz(); } },
			h('option', { value: 'formula', text: 'Canvas formula', disabled: !!why, selected: m === 'formula', title: why || 'Canvas draws values for each student' }),
			h('option', { value: 'variants', text: 'Versions', selected: m === 'variants' }),
			h('option', { value: 'fixed', text: 'One roll', selected: m === 'fixed' })
		);
		const nv = m === 'variants' ? h('input', { class: 'qb-input narrow', type: 'number', min: 2, max: 50, title: 'How many versions', value: it.variants || S.quiz.defaultVariants, oninput: (e) => { it.variants = Number(e.target.value) || 0; touch(); } }) : null;
		return h('span', { class: 'qz-ctrl' }, U.icon('dice', 'qi xs'), sel, nv);
	}
	function bankStatus(it) {
		if (!it.ref) return null;
		const cur = bankQs(it.ref.bank).find((x) => x.id === it.ref.qid);
		if (!cur) return h('span', { class: 'qb-hint', title: 'The bank question was deleted; this quiz keeps its copy.', text: 'not in bank' });
		if (QB.sig(cur) === it.ref.sig) return null;
		return U.btn('Bank copy changed · update', () => { it.q = QB.copy(cur, true); it.ref.sig = QB.sig(cur); touch(); renderQuiz(); }, 'sm', null, 'Replace this snapshot with the bank’s current version');
	}
	function itemEl(it, num, group) {
		const errs = QB.errors(it.q);
		const pv = h('div', { class: 'qz-pv', hidden: !S.open.has(it.id) });
		if (S.open.has(it.id)) {
			let seed = QB.isRandom(it.q) ? 12345 : 'base';
			const draw = () => U.fill(pv, U.preview(it.q, QB.instantiate(it.q, seed)), QB.isRandom(it.q) ? h('div', { class: 'qb-row' }, U.btn('Another version', () => { seed = Math.floor(Math.random() * 1e9); draw(); }, 'sm', 'dice'), h('a', { class: 'qb-link', href: it.ref ? 'questions.html' : null, text: it.ref ? 'Edit in Theta Questions' : '' })) : null, errs.length ? h('div', { class: 'qz-warn-list' }, errs.map((e) => h('p', { class: 'qb-err', text: e.msg }))) : null);
			draw();
		}
		const pts = group ? null : h('input', { class: 'qb-input narrow', type: 'number', min: 0, step: 0.5, title: 'Points', 'aria-label': 'Points', value: it.points != null ? it.points : it.q.points, oninput: (e) => { it.points = e.target.value === '' ? null : Number(e.target.value); touch(); renderSummary(); } });
		const el = h('div', { class: 'qz-entry' + (S.sel.has(it.id) ? ' sel' : ''), draggable: 'true', dataset: { id: it.id } },
			h('div', { class: 'qz-ehead' },
				h('input', { type: 'checkbox', checked: S.sel.has(it.id), 'aria-label': 'Check', onchange: (e) => { e.target.checked ? S.sel.add(it.id) : S.sel.delete(it.id); el.classList.toggle('sel', e.target.checked); renderSummary(); } }),
				h('span', { class: 'qb-grip', title: 'Drag to move' }, U.icon('grip')),
				group ? null : h('span', { class: 'qz-num', text: num + '.' }),
				h('span', { class: 'qb-type t-' + it.q.type, text: QB.TYPE_SHORT[it.q.type] }),
				h('span', { class: 'qb-qtext', tabindex: '0', title: 'Show / hide preview', text: QB.excerpt(it.q, 120), onclick: () => { S.open.has(it.id) ? S.open.delete(it.id) : S.open.add(it.id); renderQuiz(); }, onkeydown: (e) => { if (e.key === 'Enter') e.target.click(); } }),
				errs.length ? h('span', { class: 'qb-badge err', title: errs.map((x) => x.msg).join('\n') }, U.icon('warn', 'qi xs'), 'fix') : null,
				bankStatus(it),
				modeControl(it),
				pts ? h('span', { class: 'qz-ctrl' }, pts, h('span', { class: 'qb-hint', text: 'pt' })) : null,
				U.btn('', () => removeIds([it.id]), 'icon xs', 'x', 'Remove from quiz')
			),
			pv
		);
		el.addEventListener('dragstart', (e) => { e.stopPropagation(); e.dataTransfer.setData('text/x-entry', it.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
		el.addEventListener('dragend', () => el.classList.remove('dragging'));
		dropTarget(el, { before: it.id, group: group ? group.id : null });
		return el;
	}
	function groupEl(g, startNum) {
		const k = Math.min(g.pick, g.items.length);
		const title = h('input', { class: 'qb-input', value: g.title, style: { maxWidth: '16rem', fontWeight: '600' }, oninput: (e) => { g.title = e.target.value; touch(); } });
		const pick = h('input', { class: 'qb-input narrow', type: 'number', min: 1, value: g.pick, 'aria-label': 'How many to pick', oninput: (e) => { g.pick = Math.max(1, Number(e.target.value) || 1); touch(); renderSummary(); } });
		const pts = h('input', { class: 'qb-input narrow', type: 'number', min: 0, step: 0.5, value: g.points, 'aria-label': 'Points each', oninput: (e) => { g.points = Number(e.target.value) || 0; touch(); renderSummary(); } });
		const itemsBox = h('div', { class: 'qz-gitems' }, g.items.map((it) => itemEl(it, 0, g)));
		dropTarget(itemsBox, { into: g.id });
		const el = h('div', { class: 'qz-entry qz-group', draggable: 'true', dataset: { id: g.id } },
			h('div', { class: 'qz-ehead' },
				h('span', { class: 'qb-grip', title: 'Drag to move' }, U.icon('grip')),
				h('span', { class: 'qz-num', text: k ? (k > 1 ? `${startNum + 1}–${startNum + k}.` : `${startNum + 1}.`) : '–' }),
				U.icon('group'), title,
				h('span', { class: 'qz-ctrl' }, 'pick', pick, `of ${g.items.length},`, pts, 'pt each'),
				g.pick > g.items.length && g.items.length ? h('span', { class: 'qb-badge warn', text: 'more than it has' }) : null,
				h('span', { class: 'grow' }),
				U.btn('Ungroup', () => { const i = S.quiz.entries.indexOf(g); S.quiz.entries.splice(i, 1, ...g.items.map((it) => ({ ...it, kind: 'q', points: it.points != null ? it.points : g.points }))); touch(); renderQuiz(); }, 'sm'),
				U.btn('', () => removeIds([g.id]), 'icon xs', 'x', 'Remove the group')
			),
			itemsBox
		);
		el.addEventListener('dragstart', (e) => { if (e.target !== el) return; e.dataTransfer.setData('text/x-entry', g.id); el.classList.add('dragging'); });
		el.addEventListener('dragend', () => el.classList.remove('dragging'));
		dropTarget(el.firstChild, { before: g.id, group: null });
		return el;
	}
	/* where: { before: id, group: id|null } | { into: groupId } | { end: true } */
	function dropTarget(el, where) {
		const accepts = (e) => [...e.dataTransfer.types].some((t) => t === 'text/x-entry' || t === 'text/x-src');
		el.addEventListener('dragover', (e) => { if (!accepts(e)) return; e.preventDefault(); e.stopPropagation(); el.classList.add(where.into ? 'dropinto' : where.end ? 'over' : 'dropbefore'); });
		el.addEventListener('dragleave', () => el.classList.remove('dropinto', 'over', 'dropbefore'));
		el.addEventListener('drop', async (e) => {
			if (!accepts(e)) return;
			e.preventDefault(); e.stopPropagation();
			el.classList.remove('dropinto', 'over', 'dropbefore');
			const src = e.dataTransfer.getData('text/x-src');
			const groupId = where.into || where.group || null;
			if (src) {
				const keys = JSON.parse(src);
				const found = await resolveKeys(keys);
				const items = found.map(({ q, ref }) => makeItem(q, ref));
				if (groupId) {
					const g = S.quiz.entries.find((x) => x.id === groupId);
					const at = where.before ? g.items.findIndex((x) => x.id === where.before) : -1;
					if (at >= 0) g.items.splice(at, 0, ...items); else g.items.push(...items);
				} else insertItems(items, null, where.before);
				S.picked.clear();
			} else moveEntry(e.dataTransfer.getData('text/x-entry'), where);
			touch(); renderQuiz(); drawSourceList();
		});
	}
	function takeEntry(id) {
		const i = S.quiz.entries.findIndex((e) => e.id === id);
		if (i >= 0) return S.quiz.entries.splice(i, 1)[0];
		for (const g of S.quiz.entries) if (g.kind === 'group') { const j = g.items.findIndex((x) => x.id === id); if (j >= 0) return { ...g.items.splice(j, 1)[0], kind: 'q', points: null, _from: g }; }
		return null;
	}
	function moveEntry(id, where) {
		if (!id || id === where.before || id === where.into) return;
		const e = takeEntry(id);
		if (!e) return;
		const groupId = where.into || where.group;
		if (groupId && e.kind === 'group') { // a group dropped into a group: merge its items
			const g = S.quiz.entries.find((x) => x.id === groupId);
			if (g) { g.items.push(...e.items); return; }
		}
		if (groupId) {
			const g = S.quiz.entries.find((x) => x.id === groupId);
			const item = { id: e.id, q: e.q, ref: e.ref, mode: e.mode, variants: e.variants, points: null };
			const at = where.before ? g.items.findIndex((x) => x.id === where.before) : -1;
			if (at >= 0) g.items.splice(at, 0, item); else g.items.push(item);
			return;
		}
		const entry = e.kind === 'group' ? e : { id: e.id, kind: 'q', q: e.q, ref: e.ref, mode: e.mode, variants: e.variants, points: e._from ? e._from.points : e.points };
		const at = where.before ? S.quiz.entries.findIndex((x) => x.id === where.before) : -1;
		if (at >= 0) S.quiz.entries.splice(at, 0, entry); else S.quiz.entries.push(entry);
	}
	function removeIds(ids) {
		const before = JSON.stringify(S.quiz.entries);
		S.quiz.entries = S.quiz.entries.filter((e) => !ids.includes(e.id));
		for (const g of S.quiz.entries) if (g.kind === 'group') g.items = g.items.filter((x) => !ids.includes(x.id));
		ids.forEach((id) => S.sel.delete(id));
		touch(); renderQuiz(); drawSourceList();
		U.toast(`Removed ${ids.length}.`, { undo: () => { S.quiz.entries = normalizeQuiz({ entries: JSON.parse(before) }).entries; touch(); renderQuiz(); drawSourceList(); } });
	}
	function groupChecked() {
		const ids = [...S.sel];
		const items = [];
		let firstAt = -1;
		for (const id of ids) {
			const at = S.quiz.entries.findIndex((e) => e.id === id);
			if (firstAt < 0 || (at >= 0 && at < firstAt)) firstAt = at;
		}
		for (const id of ids) { const e = takeEntry(id); if (e && e.kind !== 'group') items.push({ id: e.id, q: e.q, ref: e.ref, mode: e.mode, variants: e.variants, points: null }); else if (e) items.push(...e.items); }
		const g = { id: eid(), kind: 'group', title: 'Question group ' + (S.quiz.entries.filter((e) => e.kind === 'group').length + 1), pick: 1, points: items[0] ? items[0].q.points : 1, items };
		S.quiz.entries.splice(firstAt >= 0 ? Math.min(firstAt, S.quiz.entries.length) : S.quiz.entries.length, 0, g);
		S.sel.clear();
		touch(); renderQuiz();
	}

	/* ======================== export ======================== */
	async function exportQTI() {
		saveNow();
		if (!S.quiz.entries.length) return U.toast('Add some questions first.', { error: true });
		const items = allItems();
		const bad = items.filter((it) => QB.errors(it.q).length);
		if (bad.length && !(await U.confirm('Some questions need fixing', `${bad.length} question${bad.length === 1 ? ' has' : 's have'} problems (marked “fix”) and may not import or grade correctly. Export anyway?`, 'Export anyway'))) return;
		let out;
		try { out = QF.toQTI(quizForExport()); } catch (e) { return U.toast('Export failed: ' + e.message, { error: true }); }
		const name = QF.slug(S.env.meta.title) + '.qti.zip';
		U.download(name, new Blob([out.zip], { type: 'application/zip' }));
		U.modal('Downloaded ' + name, h('div', { class: 'qb-col' },
			h('p', null, `${out.count} question${out.count === 1 ? '' : 's'} per student, ${Math.round(out.total * 100) / 100} points.`),
			out.warnings.length ? h('div', null, h('b', { text: 'Notes' }), h('ul', { class: 'qb-notes' }, out.warnings.map((w) => h('li', { text: w })))) : null,
			h('b', { text: 'Bring it into Canvas' }),
			h('ol', { class: 'qb-notes', style: { listStyle: 'decimal' } },
				h('li', null, 'In your Canvas course: Settings › Import Course Content.'),
				h('li', null, 'Content Type: “QTI .zip file”. Choose the downloaded file.'),
				h('li', null, 'Optionally pick a question bank for the questions, then Import. It shows as Completed after a moment.'),
				h('li', null, 'Open Quizzes: the quiz is there, unpublished. Check it, set the dates, publish.')
			),
			h('p', { class: 'qb-hint', text: 'New Quizzes: Canvas can also import QTI into New Quizzes (Quizzes › ⋮ › Import, or migrate the classic quiz). Formula questions become “Formula” items.' })
		), [{ label: 'Done', cls: 'primary' }], { wide: true });
	}
	async function openQuizFile() {
		const [f] = await U.pickFiles({ accept: '.json' });
		if (!f) return;
		try {
			const env = HT.files.parse(await f.text(), TOOL);
			if (quizzes().some((x) => x.id === env.id)) env.id = HT.files.newId('s');
			env.data = normalizeQuiz(env.data);
			HT.files.write(env);
			openQuiz(env);
		} catch (e) { U.toast(e.message, { error: true }); }
	}

	/* ======================== start ======================== */
	function handoff() {
		let h0 = null;
		try { h0 = JSON.parse(sessionStorage.getItem('qb:handoff') || 'null'); sessionStorage.removeItem('qb:handoff'); } catch {}
		if (!h0 || !h0.bank) return null;
		const qs = bankQs(h0.bank);
		const items = h0.ids.map((id) => qs.find((q) => q.id === id)).filter(Boolean).map((q) => ({ ...makeItem(q, { bank: h0.bank, qid: q.id, sig: QB.sig(q) }), kind: 'q' }));
		const env = newQuiz((h0.title || 'New') + ' quiz', items);
		S.src = 'bank:' + h0.bank;
		return env;
	}
	function start() {
		build();
		const fromBank = /from=bank/.test(location.search) ? handoff() : null;
		if (fromBank) history.replaceState(null, '', location.pathname);
		let all = quizzes();
		if (!all.length) all = [newQuiz('New quiz')];
		const last = ls.get(LAST);
		openQuiz(fromBank || all.find((q) => q.id === last) || all[0]);
		setStatus('Saved');
		if (fromBank) U.toast(`Started a quiz with ${S.quiz.entries.length} question${S.quiz.entries.length === 1 ? '' : 's'} from the bank.`);
	}
	start();
})();
