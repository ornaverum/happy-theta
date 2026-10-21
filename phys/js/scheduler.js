/* Theta Scheduler — app shell, saving, calendar view and item editor.
   Needs core.js, scheduler-model.js and (optionally) scheduler-seed-*.js. scheduler-views.js adds the
   Objectives, Dashboard and Settings views. */
'use strict';

(function () {
	const S = HT.sched;
	const el = HT.el;
	const TOOL = 'scheduler';
	const LAST_KEY = 'happytheta:scheduler:last';
	const UNDO_MAX = 60;

	const app = (HT.schedApp = {
		file: null, // the saved envelope (id, meta) — data lives in app.data
		data: null,
		view: 'calendar',
		sel: null, // { kind: 'unit'|'topic'|'activity', id }
		hideOff: false,
		showBank: true,
		undo: [],
		redo: [],
		views: {} // name -> { title, render(container) } (scheduler-views.js adds more)
	});

	/* ------------------------------------------------------------------ */
	/* Small helpers                                                        */
	/* ------------------------------------------------------------------ */

	const safeGet = (k) => {
		try {
			return localStorage.getItem(k);
		} catch {
			return null;
		}
	};
	const safeSet = (k, v) => {
		try {
			localStorage.setItem(k, v);
		} catch {}
	};

	/* Dialog built on <dialog>, same look as the save/open dialogs. */
	app.dialog = function (title, body, buttons, { wide = false } = {}) {
		const msg = el('p', { class: 'ht-dialog-msg', role: 'status' });
		const dlg = el(
			'dialog',
			{ class: 'ht-dialog sched-dialog' + (wide ? ' wide' : '') },
			el('h2', { text: title }),
			body,
			msg,
			el('div', { class: 'ht-dialog-footer' }, buttons)
		);
		dlg.addEventListener('close', () => dlg.remove());
		dlg.addEventListener('click', (e) => {
			if (e.target === dlg) dlg.close();
		});
		document.body.appendChild(dlg);
		dlg.showModal();
		return {
			dlg,
			close: () => dlg.close(),
			error: (t) => {
				msg.textContent = t;
				msg.classList.add('error');
			}
		};
	};
	app.btn = (text, onclick, cls = 'btn-light') => el('button', { type: 'button', class: `btn ${cls} btn-xs`, text, onclick });
	app.field = (label, input, extra) => el('label', { class: 'ht-field' + (extra ? ' ' + extra : '') }, el('span', { text: label }), input);
	app.input = (attrs) => el('input', { class: 'ht-input', ...attrs });
	app.select = (options, value, attrs = {}) =>
		el(
			'select',
			{ class: 'ht-input', ...attrs },
			options.map(([v, t]) => el('option', { value: v, text: t, selected: String(v) === String(value) }))
		);

	/* ------------------------------------------------------------------ */
	/* Saving: every change autosaves to this browser                      */
	/* ------------------------------------------------------------------ */

	let saveTimer = 0;
	const statusEl = el('span', { class: 'sched-status', role: 'status' });

	function saveNow() {
		clearTimeout(saveTimer);
		saveTimer = 0;
		if (!app.data) return;
		try {
			app.file = HT.files.wrap(TOOL, { title: app.data.course.title, data: app.data, view: {} }, app.file);
			HT.files.write(app.file);
			safeSet(LAST_KEY, app.file.id);
			statusEl.textContent = 'Saved in this browser';
			statusEl.classList.remove('error');
		} catch (err) {
			console.error(err);
			statusEl.textContent =
				err && err.name === 'QuotaExceededError' ? 'Not saved: browser storage is full. Download a file.' : 'Not saved: this browser blocked storage. Download a file.';
			statusEl.classList.add('error');
		}
	}
	function scheduleSave() {
		statusEl.textContent = 'Saving…';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(saveNow, 400);
	}
	window.addEventListener('beforeunload', () => {
		if (saveTimer) saveNow();
	});

	/* Every edit goes through commit(): it records undo, saves, and redraws.
	   opts.editor = false keeps the editor panel as-is (so typing isn't interrupted). */
	app.commit = function (fn, opts = {}) {
		app.undo.push(JSON.stringify(app.data));
		if (app.undo.length > UNDO_MAX) app.undo.shift();
		app.redo = [];
		fn(app.data);
		scheduleSave();
		app.render(opts);
	};
	function undo() {
		if (!app.undo.length) return;
		app.redo.push(JSON.stringify(app.data));
		app.data = JSON.parse(app.undo.pop());
		if (app.sel && !findItem(app.sel)) app.sel = null;
		scheduleSave();
		app.render();
	}
	function redo() {
		if (!app.redo.length) return;
		app.undo.push(JSON.stringify(app.data));
		app.data = JSON.parse(app.redo.pop());
		scheduleSave();
		app.render();
	}

	function openCourse(file) {
		saveNow();
		app.file = file;
		app.data = S.normalize(HT.clone(file.data));
		app.undo = [];
		app.redo = [];
		app.sel = null;
		safeSet(LAST_KEY, file.id);
		statusEl.textContent = 'Saved in this browser';
		app.render();
		requestAnimationFrame(scrollToToday);
	}

	function listCourses() {
		try {
			return HT.files.list(TOOL);
		} catch {
			return [];
		}
	}

	/* ------------------------------------------------------------------ */
	/* New course / open / download                                        */
	/* ------------------------------------------------------------------ */

	function newCourseDialog() {
		const seeds = HT.schedulerSeeds || {};
		const blank = S.newCourse();
		const title = app.input({ type: 'text', value: 'AP Physics 1' });
		const start = app.input({ type: 'date', value: blank.course.termStart });
		const end = app.input({ type: 'date', value: blank.course.termEnd });
		const meets = app.select([['A', 'A days'], ['B', 'B days']], 'A');
		const first = app.select([['A', 'A day'], ['B', 'B day']], 'A');
		const seedSel = app.select([...Object.values(seeds).map((s) => [s.id, s.title]), ['', 'None (start empty)']], Object.keys(seeds)[0] || '');
		const draft = el('input', { type: 'checkbox', checked: true });
		const bank = el('input', { type: 'checkbox', checked: true });
		const body = el(
			'div',
			{ class: 'sched-form' },
			app.field('Course name', title),
			el('div', { class: 'sched-row2' }, app.field('First day of the term', start), app.field('Last day', end)),
			el('div', { class: 'sched-row2' }, app.field('This course meets on', meets), app.field('The first day of the term is', first)),
			app.field('Objectives', seedSel),
			el('label', { class: 'sched-check' }, draft, ' Draft units and topics on the calendar from the framework'),
			el('label', { class: 'sched-check' }, bank, ' Put the framework’s quizzes in the activity bank'),
			el('p', { class: 'sched-hint', text: 'Days off (breaks, holidays) are added in Settings. Everything can be changed later.' })
		);
		const m = app.dialog('New course', body, [
			el('span', { class: 'ht-spacer' }),
			app.btn('Cancel', () => m.close()),
			app.btn(
				'Create',
				() => {
					if (!S.isDate(start.value) || !S.isDate(end.value) || end.value <= start.value) return m.error('Check the term dates.');
					const seed = seeds[seedSel.value];
					const data = S.newCourse({
						title: title.value.trim() || 'New course',
						termStart: start.value,
						termEnd: end.value,
						meetsOn: meets.value,
						firstType: first.value,
						seed
					});
					if (seed && !bank.checked) data.activities = [];
					if (seed && draft.checked && data.objectiveTrees[0]) S.draftPlan(data, data.objectiveTrees[0], data.course.termStart);
					m.close();
					openCourse(HT.files.wrap(TOOL, { title: data.course.title, data, view: {} }));
					saveNow();
				},
				'btn-blue'
			)
		]);
		title.select();
	}

	function openDialog() {
		const list = el('ul', { class: 'ht-save-list' });
		const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
		const render = () => {
			list.replaceChildren();
			const saves = listCourses();
			if (!saves.length) list.appendChild(el('li', { class: 'ht-save-empty', text: 'No saved courses yet.' }));
			for (const f of saves) {
				const del = app.btn('Delete', () => {
					if (!del.dataset.armed) {
						del.dataset.armed = '1';
						del.textContent = 'Confirm delete';
						del.classList.add('btn-red');
						return;
					}
					try {
						HT.files.remove(TOOL, f.id);
					} catch {}
					if (app.file && app.file.id === f.id) {
						app.file = null;
						app.data = null;
					}
					render();
					app.render();
				});
				list.appendChild(
					el(
						'li',
						null,
						el('div', { class: 'ht-save-info' }, el('strong', { text: f.meta.title }), el('small', { text: new Date(f.meta.modified).toLocaleString() })),
						del,
						app.btn('Open', () => (m.close(), openCourse(f)), 'btn-blue')
					)
				);
			}
		};
		fileInput.addEventListener('change', () => {
			const blob = fileInput.files[0];
			if (!blob)
				return;
			HT.files
				.readUpload(blob, TOOL)
				.then((f) => {
					// A file from disk becomes a new save here unless it is already in this browser.
					m.close();
					openCourse(f);
					saveNow();
				})
				.catch((err) => m.error(err.message));
		});
		const m = app.dialog('Open a course', el('div', null, list, fileInput), [
			app.btn('Open file…', () => fileInput.click()),
			el('span', { class: 'ht-spacer' }),
			app.btn('Close', () => m.close())
		]);
		render();
	}

	/* ------------------------------------------------------------------ */
	/* Layout                                                              */
	/* ------------------------------------------------------------------ */

	const root = el('div', { class: 'sched' });
	const header = el('div', { class: 'sched-head' });
	const main = el('div', { class: 'sched-main' });
	root.append(header, main);
	(document.querySelector('.content') || document.body).appendChild(root);

	app.views.calendar = { title: 'Calendar', render: renderCalendarView };

	function renderHeader() {
		const d = app.data;
		const tabs = el(
			'div',
			{ class: 'sched-tabs', role: 'tablist' },
			Object.entries(app.views).map(([k, v]) =>
				el('button', {
					type: 'button',
					role: 'tab',
					class: 'sched-tab' + (app.view === k ? ' on' : ''),
					'aria-selected': app.view === k ? 'true' : 'false',
					text: v.title,
					onclick: () => {
						app.view = k;
						app.render();
					}
				})
			)
		);
		header.replaceChildren(
			el(
				'div',
				{ class: 'sched-title' },
				el('span', { class: 'sched-app', text: 'Theta Scheduler' }),
				el('strong', { text: d ? d.course.title : '' })
			),
			d ? tabs : el('span'),
			el(
				'div',
				{ class: 'sched-actions' },
				statusEl,
				app.btn('Undo', undo),
				app.btn('Redo', redo),
				app.btn('New course…', newCourseDialog),
				app.btn('Open…', openDialog),
				d ? app.btn('Download', () => (saveNow(), app.file && HT.files.download(app.file))) : null
			)
		);
		header.querySelectorAll('.sched-actions .btn')[0].disabled = !app.undo.length;
		header.querySelectorAll('.sched-actions .btn')[1].disabled = !app.redo.length;
	}

	/* Redrawing removes the focused field, which fires its 'change' (blur) handler, which commits and
	   asks for another redraw while the first is still running. Queue that one instead of nesting it. */
	let rendering = false,
		again = null;
	app.render = function (opts = {}) {
		if (rendering) {
			again = opts;
			return;
		}
		rendering = true;
		try {
			renderNow(opts);
		} finally {
			rendering = false;
		}
		if (again) {
			const o = again;
			again = null;
			app.render(o);
		}
	};
	function renderNow(opts) {
		renderHeader();
		if (!app.data) {
			main.replaceChildren(
				el(
					'div',
					{ class: 'card sched-welcome' },
					el('h1', { text: 'Theta Scheduler' }),
					el('p', { text: 'Plan a course day by day: units, topics, activities and the objectives they cover.' }),
					el('div', { class: 'sched-welcome-btns' }, app.btn('New course…', newCourseDialog, 'btn-blue'), app.btn('Open…', openDialog))
				)
			);
			return;
		}
		const v = app.views[app.view] || app.views.calendar;
		v.render(main, opts);
	}

	/* ------------------------------------------------------------------ */
	/* Calendar view                                                       */
	/* ------------------------------------------------------------------ */

	const cal = {
		wrap: null,
		scroller: null,
		grid: null,
		bank: null,
		editor: null,
		rows: [],
		cols: [],
		rowTops: []
	};

	function buildCalendarShell() {
		cal.toolbar = el('div', { class: 'cal-toolbar' });
		cal.bank = el('aside', { class: 'cal-bank' });
		cal.scroller = el('div', { class: 'cal-scroll' });
		cal.grid = el('div', { class: 'cal-grid' });
		cal.scroller.appendChild(cal.grid);
		cal.editor = el('aside', { class: 'cal-editor' });
		cal.wrap = el('div', { class: 'cal-view' }, cal.toolbar, el('div', { class: 'cal-body' }, cal.bank, cal.scroller, cal.editor));
	}
	buildCalendarShell();

	function renderCalendarView(container, opts = {}) {
		if (cal.wrap.parentNode !== container) container.replaceChildren(cal.wrap);
		renderToolbar();
		renderGrid();
		renderBank();
		if (opts.editor !== false) renderEditor();
	}

	function renderToolbar() {
		const hide = el('input', {
			type: 'checkbox',
			checked: app.hideOff,
			onchange: (e) => {
				app.hideOff = e.target.checked;
				renderGrid();
			}
		});
		const other = app.data.course.meetsOn === 'A' ? 'B' : 'A';
		cal.toolbar.replaceChildren(
			app.btn('Today', scrollToToday),
			app.btn(app.showBank ? 'Hide activity bank' : 'Show activity bank', () => {
				app.showBank = !app.showBank;
				renderCalendarView(main, { editor: false });
			}),
			el('label', { class: 'sched-check' }, hide, ` Hide ${other} days`),
			el('span', { class: 'ht-spacer' }),
			app.btn('Shift dates…', shiftDialog),
			app.btn('Draft from framework…', draftDialog),
			el('span', { class: 'cal-legend', text: 'Click an empty cell to add · drag blocks to move · drag the bottom edge to lengthen' })
		);
	}

	/* Column model: fixed day columns, then Unit, Topic, In class, the user's columns, Other */
	function columnDefs() {
		const d = app.data;
		return [
			{ id: 'unit', title: 'Unit', kind: 'unit', w: 9 },
			{ id: 'topic', title: 'Topic', kind: 'topic', w: 12 },
			{ id: 'inclass', title: 'In class', kind: 'activity', w: 14 },
			...d.columns.map((c) => ({ id: c.id, title: c.title, kind: 'activity', w: 11, def: c })),
			{ id: 'other', title: 'Other', kind: 'activity', w: 10 }
		];
	}

	function itemsFor(col) {
		const d = app.data;
		if (col.kind === 'unit') return d.units.map((u) => ({ kind: 'unit', obj: u }));
		if (col.kind === 'topic') return d.topics.map((t) => ({ kind: 'topic', obj: t }));
		return d.activities.filter((a) => a.start && S.columnFor(d, a) === col.id).map((a) => ({ kind: 'activity', obj: a }));
	}

	function typeTag(a) {
		const set = app.data.tagSets.find((s) => s.id === 'type');
		return set && a.tags && set.tags.find((t) => t.id === a.tags.type);
	}

	function renderGrid() {
		const d = app.data;
		const all = S.genDays(d);
		const rows = (cal.rows = app.hideOff ? all.filter((r) => r.meet || !r.school) : all);
		const cols = columnDefs();
		const today = S.today();

		// Pack each column's blocks into lanes
		let line = 4; // grid lines 1..3 are the date, day and type columns
		for (const c of cols) {
			c.items = itemsFor(c)
				.map((it) => Object.assign(it, S.rowSpan(rows, it.obj.start, it.obj.end)))
				.filter((it) => it.a !== undefined);
			c.lanes = S.pack(c.items);
			c.line = line;
			line += c.lanes;
		}
		cal.cols = cols;
		const tracks = ['5.5rem', '3rem', '3.25rem'];
		for (const c of cols) for (let i = 0; i < c.lanes; i++) {
			const w = Math.max(4, c.w / c.lanes).toFixed(2);
			tracks.push(`minmax(${w}rem, ${w}fr)`);
		}
		const rowH = (r) => (r.meet ? '2.75rem' : '1.5rem');
		cal.grid.style.gridTemplateColumns = tracks.join(' ');
		cal.grid.style.gridTemplateRows = ['auto', ...rows.map(rowH)].join(' ');

		const frag = document.createDocumentFragment();
		// Header
		const head = (text, col, span = 1, cls = '') =>
			el('div', { class: 'cal-h ' + cls, style: { gridRow: '1', gridColumn: `${col} / span ${span}` }, text });
		frag.append(head('Date', 1, 1, 'sticky-l c1'), head('Day', 2, 1, 'sticky-l c2'), head('Type', 3, 1, 'sticky-l c3'));
		for (const c of cols) frag.append(head(c.title, c.line, c.lanes));

		// Day cells
		let month = '';
		rows.forEach((r, i) => {
			const gr = i + 2;
			const cls = ['cal-row', r.meet ? 'meet' : r.school ? 'off' : 'none', r.date === today ? 'today' : ''];
			const m = r.date.slice(0, 7);
			if (m !== month) {
				cls.push('month-start');
				month = m;
			}
			if (r.dow === 1) cls.push('week-start');
			const c = cls.join(' ');
			frag.append(
				el('div', { class: c + ' cal-date sticky-l c1', style: { gridRow: gr, gridColumn: 1 }, 'data-row': i, text: S.fmtShort(r.date) }),
				el('div', { class: c + ' cal-dow sticky-l c2', style: { gridRow: gr, gridColumn: 2 }, text: S.DOW_SHORT[r.dow] }),
				el(
					'button',
					{
						type: 'button',
						class: c + ' cal-type sticky-l c3',
						style: { gridRow: gr, gridColumn: 3 },
						title: 'Change this day',
						onclick: () => dayDialog(r)
					},
					el('span', { class: 'type-badge t-' + r.type, text: r.type === 'none' ? '—' : r.type })
				)
			);
			// A day-off note shows once at the top of a run of days off with the same note
			if (!r.school && r.note && !(i > 0 && !rows[i - 1].school && rows[i - 1].note === r.note))
				frag.append(el('div', { class: 'cal-note', style: { gridRow: gr, gridColumn: `4 / -1` }, text: r.note }));
			for (const col of cols) {
				const cell = el('div', {
					class: c + ' cal-cell',
					style: { gridRow: gr, gridColumn: `${col.line} / span ${col.lanes}` },
					'data-row': i,
					'data-col': col.id
				});
				cell.addEventListener('click', (e) => {
					if (e.target === cell) addAt(col, r);
				});
				cell.addEventListener('dragover', (e) => {
					if (bankDrag) {
						e.preventDefault();
						cell.classList.add('drop');
					}
				});
				cell.addEventListener('dragleave', () => cell.classList.remove('drop'));
				cell.addEventListener('drop', (e) => {
					e.preventDefault();
					cell.classList.remove('drop');
					if (bankDrag) dropFromBank(bankDrag, col, r);
				});
				frag.append(cell);
			}
		});

		// Blocks
		for (const col of cols) {
			for (const it of col.items) {
				frag.append(blockEl(col, it));
			}
		}
		cal.grid.replaceChildren(frag);
		measureRows();
	}

	function blockEl(col, it) {
		const o = it.obj;
		const isSel = app.sel && app.sel.id === o.id;
		const b = el('div', {
			class: `cal-block k-${it.kind}` + (isSel ? ' sel' : ''),
			style: { gridRow: `${it.a + 2} / ${it.b + 3}`, gridColumn: `${col.line + it.lane} / span ${it.width}` },
			tabindex: '0',
			title: o.title,
			'data-id': o.id
		});
		if (it.kind === 'unit') b.style.background = o.color || '#e5e7eb';
		if (it.kind === 'activity') {
			const t = typeTag(o);
			b.style.borderLeftColor = (t && t.color) || '#9ca3af';
			if (o.assessment === 'summative') b.classList.add('summative');
		}
		const sub = [];
		if (it.kind === 'activity') {
			const t = typeTag(o);
			if (t) sub.push(t.label);
			if (o.time) sub.push('due ' + o.time);
			if (o.expectedMin) sub.push(o.expectedMin + ' min');
			if (o.objectiveIds.length) sub.push(o.objectiveIds.length + ' obj');
		}
		b.append(el('div', { class: 'blk-title', text: o.title }));
		if (sub.length) b.append(el('div', { class: 'blk-sub', text: sub.join(' · ') }));
		const handle = el('div', { class: 'blk-handle', title: 'Drag to change the end date' });
		b.append(handle);
		b.addEventListener('pointerdown', (e) => startDrag(e, it, e.target === handle ? 'resize' : 'move', b));
		b.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') select(it.kind, o.id);
			if (e.key === 'Delete' || e.key === 'Backspace') deleteItem({ kind: it.kind, id: o.id });
		});
		return b;
	}

	function measureRows() {
		cal.rowTops = Array.from(cal.grid.querySelectorAll('.cal-date')).map((c) => [c.offsetTop, c.offsetTop + c.offsetHeight]);
	}
	function rowAtY(clientY) {
		const y = clientY - cal.grid.getBoundingClientRect().top;
		const t = cal.rowTops;
		if (!t.length) return 0;
		if (y < t[0][0]) return 0;
		for (let i = 0; i < t.length; i++) if (y < t[i][1]) return i;
		return t.length - 1;
	}

	/* ---- drag to move / resize ---- */
	let drag = null;
	function startDrag(e, it, mode, node) {
		if (e.button !== 0) return;
		e.preventDefault();
		node.focus({ preventScroll: true });
		drag = { it, mode, node, row0: rowAtY(e.clientY), a: it.a, b: it.b, moved: false, na: it.a, nb: it.b };
		node.setPointerCapture(e.pointerId);
		node.addEventListener('pointermove', onDrag);
		node.addEventListener('pointerup', endDrag);
		node.addEventListener('pointercancel', cancelDrag);
	}
	function onDrag(e) {
		if (!drag) return;
		const sr = cal.scroller.getBoundingClientRect();
		if (e.clientY < sr.top + 40) cal.scroller.scrollTop -= 12;
		else if (e.clientY > sr.bottom - 40) cal.scroller.scrollTop += 12;
		const r = rowAtY(e.clientY);
		const dr = r - drag.row0;
		if (dr !== 0) drag.moved = true;
		const last = cal.rows.length - 1;
		if (drag.mode === 'move') {
			const dd = Math.max(-drag.a, Math.min(last - drag.b, dr));
			drag.na = drag.a + dd;
			drag.nb = drag.b + dd;
		} else {
			drag.na = drag.a;
			drag.nb = Math.max(drag.a, Math.min(last, drag.b + dr));
		}
		drag.node.style.gridRow = `${drag.na + 2} / ${drag.nb + 3}`;
		drag.node.classList.add('dragging');
	}
	function endDrag() {
		if (!drag) return;
		const g = drag;
		cleanupDrag();
		if (!g.moved || (g.na === g.a && g.nb === g.b)) {
			select(g.it.kind, g.it.obj.id);
			return;
		}
		const id = g.it.obj.id;
		app.commit((d) => {
			const o = findItem({ kind: g.it.kind, id }, d);
			if (!o) return;
			o.start = cal.rows[g.na].date;
			o.end = cal.rows[g.nb].date;
		});
	}
	function cancelDrag() {
		if (!drag) return;
		drag.node.style.gridRow = `${drag.a + 2} / ${drag.b + 3}`;
		drag.node.classList.remove('dragging');
		cleanupDrag();
	}
	function cleanupDrag() {
		const n = drag.node;
		n.removeEventListener('pointermove', onDrag);
		n.removeEventListener('pointerup', endDrag);
		n.removeEventListener('pointercancel', cancelDrag);
		drag = null;
	}
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && drag) cancelDrag();
	});

	/* ---- adding items ---- */
	function addAt(col, row) {
		const date = row.date;
		if (col.kind === 'unit') {
			const u = { id: S.newId('u'), title: 'New unit', start: date, end: date, color: S.UNIT_COLORS[app.data.units.length % S.UNIT_COLORS.length], objectiveId: null };
			app.commit((d) => d.units.push(u));
			return select('unit', u.id);
		}
		if (col.kind === 'topic') {
			const unit = app.data.units.find((u) => u.start <= date && (u.end || u.start) >= date);
			const t = { id: S.newId('t'), unitId: unit ? unit.id : null, title: 'New topic', start: date, end: date, objectiveId: null };
			app.commit((d) => d.topics.push(t));
			return select('topic', t.id);
		}
		const a = S.newActivity({ start: date, end: date });
		if (col.id === 'inclass') a.inClass = true;
		else if (col.def) {
			if (col.def.types[0]) a.tags.type = col.def.types[0];
			const hint = S.ASSESSMENT_HINT[a.tags.type];
			if (hint) a.assessment = hint;
		}
		const topic = S.topicAt(app.data, date);
		if (topic && topic.objectiveId) a.objectiveIds = [topic.objectiveId];
		app.commit((d) => d.activities.push(a));
		select('activity', a.id, true);
	}

	/* ---- the activity bank (unscheduled activities) ---- */
	let bankDrag = null;
	function renderBank() {
		cal.bank.hidden = !app.showBank;
		if (!app.showBank) return;
		const items = app.data.activities.filter((a) => !a.start);
		const q = (cal.bankQuery || '').toLowerCase();
		const search = app.input({ type: 'search', placeholder: 'Filter', value: cal.bankQuery || '', 'aria-label': 'Filter the activity bank' });
		search.addEventListener('input', () => {
			cal.bankQuery = search.value;
			renderBankList();
		});
		const list = el('ul', { class: 'bank-list' });
		const renderBankList = () => {
			const q2 = (cal.bankQuery || '').toLowerCase();
			list.replaceChildren(
				...items
					.filter((a) => !q2 || a.title.toLowerCase().includes(q2))
					.map((a) => {
						const t = typeTag(a);
						const li = el(
							'li',
							{ class: 'bank-item' + (app.sel && app.sel.id === a.id ? ' sel' : ''), draggable: 'true', title: 'Drag onto the calendar' },
							el('span', { class: 'bank-dot', style: { background: (t && t.color) || '#9ca3af' } }),
							el('span', { class: 'bank-title', text: a.title })
						);
						li.addEventListener('click', () => select('activity', a.id));
						li.addEventListener('dragstart', (e) => {
							bankDrag = a.id;
							e.dataTransfer.setData('text/plain', a.title);
							e.dataTransfer.effectAllowed = 'move';
						});
						li.addEventListener('dragend', () => (bankDrag = null));
						return li;
					})
			);
			if (!list.children.length) list.append(el('li', { class: 'bank-empty', text: q2 ? 'Nothing matches.' : 'Empty. “Move to bank” in an activity puts it here.' }));
		};
		renderBankList();
		void q;
		cal.bank.replaceChildren(
			el('div', { class: 'bank-head' }, el('strong', { text: `Activity bank (${items.length})` }), app.btn('+ New', () => {
				const a = S.newActivity();
				app.commit((d) => d.activities.push(a));
				select('activity', a.id, true);
			})),
			search,
			list
		);
	}
	function dropFromBank(id, col, row) {
		bankDrag = null;
		app.commit((d) => {
			const a = d.activities.find((x) => x.id === id);
			if (!a) return;
			a.start = row.date;
			a.end = row.date;
			a.inClass = col.id === 'inclass';
		});
		select('activity', id);
	}

	/* ------------------------------------------------------------------ */
	/* Selection + editor panel                                            */
	/* ------------------------------------------------------------------ */

	function findItem(sel, d = app.data) {
		if (!sel || !d) return null;
		const list = sel.kind === 'unit' ? d.units : sel.kind === 'topic' ? d.topics : d.activities;
		return list.find((x) => x.id === sel.id) || null;
	}
	app.findItem = findItem;

	function select(kind, id, focusTitle = false) {
		app.sel = { kind, id };
		if (app.view !== 'calendar') app.view = 'calendar';
		app.render();
		const blk = cal.grid.querySelector(`[data-id="${id}"]`);
		if (blk) {
			// vertical only: scrollIntoView would also scroll sideways under the sticky date columns
			const sc = cal.scroller,
				top = blk.offsetTop,
				bottom = top + blk.offsetHeight,
				head = 34;
			if (top - head < sc.scrollTop) sc.scrollTop = top - head - 8;
			else if (bottom > sc.scrollTop + sc.clientHeight) sc.scrollTop = Math.min(top - head - 8, bottom - sc.clientHeight + 8);
		}
		if (focusTitle) {
			const t = cal.editor.querySelector('input[name="title"]');
			if (t) {
				t.focus();
				t.select();
			}
		}
	}
	app.selectItem = select;

	function deleteItem(sel) {
		const o = findItem(sel);
		if (!o) return;
		app.commit((d) => {
			if (sel.kind === 'unit') {
				d.units = d.units.filter((x) => x.id !== sel.id);
				d.topics.forEach((t) => t.unitId === sel.id && (t.unitId = null));
			} else if (sel.kind === 'topic') d.topics = d.topics.filter((x) => x.id !== sel.id);
			else d.activities = d.activities.filter((x) => x.id !== sel.id);
		});
		app.sel = null;
		app.render();
	}

	/* Set one field on the selected item. Text fields don't redraw the editor, so typing isn't interrupted. */
	function setField(key, value, redrawEditor = false) {
		const sel = app.sel;
		app.commit(
			(d) => {
				const o = findItem(sel, d);
				if (!o) return;
				o[key] = value;
				if ((key === 'start' || key === 'end') && o.start && o.end && o.end < o.start) {
					if (key === 'start') o.end = o.start;
					else o.start = o.end;
					redrawEditor = true;
				}
			},
			{ editor: redrawEditor }
		);
	}

	function renderEditor() {
		const ed = cal.editor;
		const o = findItem(app.sel);
		ed.hidden = !o;
		if (!o) return ed.replaceChildren();
		const kind = app.sel.kind;
		const d = app.data;

		const text = (label, key, attrs = {}) => {
			const i = app.input({ type: 'text', value: o[key] || '', name: key, ...attrs });
			i.addEventListener('change', () => setField(key, i.value));
			return app.field(label, i);
		};
		const date = (label, key) => {
			const i = app.input({ type: 'date', value: o[key] || '', name: key });
			i.addEventListener('change', () => setField(key, i.value || null, true));
			return app.field(label, i);
		};

		const parts = [
			el(
				'div',
				{ class: 'ed-head' },
				el('strong', { text: { unit: 'Unit', topic: 'Topic', activity: o.start ? 'Activity' : 'Activity (in the bank)' }[kind] }),
				el('button', { type: 'button', class: 'ed-close', 'aria-label': 'Close', text: '×', onclick: () => ((app.sel = null), app.render()) })
			),
			text('Title', 'title')
		];

		if (kind !== 'activity' || o.start) parts.push(el('div', { class: 'sched-row2' }, date('Start', 'start'), date('End', 'end')));

		if (kind === 'unit') {
			const color = el('input', { type: 'color', value: o.color || '#e5e7eb', class: 'ed-color' });
			color.addEventListener('change', () => setField('color', color.value));
			parts.push(app.field('Color', color));
			parts.push(nodeLink(o, (n, depth) => depth === 0, 'Framework unit'));
		}
		if (kind === 'topic') {
			const us = app.select([['', '(none)'], ...d.units.map((u) => [u.id, u.title])], o.unitId || '');
			us.addEventListener('change', () => setField('unitId', us.value || null));
			parts.push(app.field('Unit', us));
			parts.push(nodeLink(o, (n, depth) => depth === 1, 'Framework topic'));
		}
		if (kind === 'activity') {
			if (o.start) {
				const time = app.input({ type: 'time', value: o.time || '' });
				time.addEventListener('change', () => setField('time', time.value));
				const mins = app.input({ type: 'number', min: '0', step: '5', value: o.expectedMin ?? '' });
				mins.addEventListener('change', () => setField('expectedMin', mins.value === '' ? null : Math.max(0, +mins.value)));
				parts.push(el('div', { class: 'sched-row2' }, app.field('Due time', time), app.field('Expected work (min)', mins)));
				const ic = el('input', { type: 'checkbox', checked: o.inClass });
				ic.addEventListener('change', () => setField('inClass', ic.checked));
				parts.push(el('label', { class: 'sched-check' }, ic, ' In-class activity'));
			} else {
				const mins = app.input({ type: 'number', min: '0', step: '5', value: o.expectedMin ?? '' });
				mins.addEventListener('change', () => setField('expectedMin', mins.value === '' ? null : Math.max(0, +mins.value)));
				parts.push(app.field('Expected work (min)', mins));
			}
			for (const set of d.tagSets) {
				const s = app.select([['', '—'], ...set.tags.map((t) => [t.id, t.label])], (o.tags || {})[set.id] || '');
				s.addEventListener('change', () => {
					const sel = app.sel;
					app.commit(
						(dd) => {
							const a = findItem(sel, dd);
							a.tags = Object.assign({}, a.tags, { [set.id]: s.value || undefined });
							if (set.id === 'type' && S.ASSESSMENT_HINT[s.value] && a.assessment === 'none') a.assessment = S.ASSESSMENT_HINT[s.value];
						},
						{ editor: true }
					);
				});
				parts.push(app.field(set.name, s));
			}
			const as = app.select(S.ASSESSMENT, o.assessment || 'none');
			as.addEventListener('change', () => setField('assessment', as.value));
			parts.push(app.field('Assessment', as));
			parts.push(objectivesBox(o));
			parts.push(linksBox(o));
			const notes = el('textarea', { class: 'ht-input', rows: '3', text: o.notes || '' });
			notes.addEventListener('change', () => setField('notes', notes.value));
			parts.push(app.field('Notes', notes));
		}

		const footer = el('div', { class: 'ed-foot' });
		if (kind === 'activity') {
			footer.append(
				app.btn('Duplicate', () => {
					const copy = Object.assign(HT.clone(o), { id: S.newId('a'), title: o.title + ' (copy)' });
					app.commit((dd) => dd.activities.push(copy));
					select('activity', copy.id, true);
				})
			);
			if (o.start)
				footer.append(
					app.btn('Move to bank', () => {
						const sel = app.sel;
						app.commit(
							(dd) => {
								const a = findItem(sel, dd);
								a.start = null;
								a.end = null;
							},
							{ editor: true }
						);
					})
				);
		}
		footer.append(el('span', { class: 'ht-spacer' }));
		const del = app.btn('Delete', () => {
			if (!del.dataset.armed) {
				del.dataset.armed = '1';
				del.textContent = 'Confirm delete';
				del.classList.add('btn-red');
				return;
			}
			deleteItem(app.sel);
		});
		footer.append(del);
		parts.push(footer);
		ed.replaceChildren(...parts);
	}

	/* Link a unit/topic block to a framework node (fills in the title) */
	function nodeLink(o, ok, label) {
		const tree = app.data.objectiveTrees[0];
		if (!tree) return el('span');
		const ix = S.treeIndex(tree);
		const opts = ix
			.flat()
			.filter((n) => !n.hidden && ok(n, ix.depth(n)))
			.map((n) => [n.id, `${n.code} ${n.text}`.slice(0, 70)]);
		const s = app.select([['', '(not linked)'], ...opts], o.objectiveId || '');
		s.addEventListener('change', () => {
			const sel = app.sel;
			app.commit(
				(d) => {
					const it = findItem(sel, d);
					it.objectiveId = s.value || null;
					const n = s.value && ix.byId.get(s.value);
					if (n && /^New (unit|topic)$/.test(it.title)) it.title = sel.kind === 'unit' ? `Unit ${n.code}: ${n.text}` : `${n.code} ${n.text}`;
				},
				{ editor: true }
			);
		});
		return app.field(label, s);
	}

	function objectivesBox(o) {
		const chips = el('div', { class: 'obj-chips' });
		for (const id of o.objectiveIds) {
			const f = S.findNode(app.data, id);
			const label = f ? `${f.node.code}` : '(deleted)';
			chips.append(
				el(
					'span',
					{ class: 'obj-chip' + (f && f.tree.id !== (app.data.objectiveTrees[0] || {}).id ? ' alt' : ''), title: f ? f.node.text : 'This objective was deleted' },
					label,
					el('button', {
						type: 'button',
						'aria-label': 'Remove ' + label,
						text: '×',
						onclick: () => setField('objectiveIds', o.objectiveIds.filter((x) => x !== id), true)
					})
				)
			);
		}
		if (!o.objectiveIds.length) chips.append(el('span', { class: 'sched-hint', text: 'None yet' }));
		return el(
			'div',
			{ class: 'ht-field' },
			el('span', { text: 'Objectives' }),
			chips,
			el('div', null, app.btn('Choose objectives…', () => objectivePicker(o)))
		);
	}

	function linksBox(o) {
		const box = el('div', { class: 'links-box' });
		o.links.forEach((l, i) => {
			const label = app.input({ type: 'text', value: l.label || '', placeholder: 'Label', 'aria-label': 'Link label' });
			const url = app.input({ type: 'url', value: l.url || '', placeholder: 'https://…', 'aria-label': 'Link address' });
			const upd = () => setField('links', o.links.map((x, j) => (j === i ? { label: label.value, url: url.value.trim() } : x)));
			label.addEventListener('change', upd);
			url.addEventListener('change', upd);
			const open = /^https?:\/\//i.test(l.url || '') ? el('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', class: 'link-open', text: 'Open' }) : null;
			box.append(
				el(
					'div',
					{ class: 'link-row' },
					label,
					url,
					open,
					el('button', {
						type: 'button',
						class: 'link-del',
						'aria-label': 'Remove link',
						text: '×',
						onclick: () => setField('links', o.links.filter((_, j) => j !== i), true)
					})
				)
			);
		});
		return el(
			'div',
			{ class: 'ht-field' },
			el('span', { text: 'Files and links' }),
			box,
			el('div', null, app.btn('+ Add link', () => setField('links', [...o.links, { label: '', url: '' }], true)))
		);
	}

	/* ---- objective picker ---- */
	function objectivePicker(o) {
		const d = app.data;
		if (!d.objectiveTrees.length) return app.dialog('Objectives', el('p', { text: 'This course has no objectives yet. Add them in the Objectives tab.' }), [app.btn('Close', () => m0.close())]);
		const chosen = new Set(o.objectiveIds);
		let treeIdx = 0;
		const topic = o.start ? S.topicAt(d, o.start) : null;
		const topicNode = topic && topic.objectiveId;
		let scoped = !!topicNode;
		const search = app.input({ type: 'search', placeholder: 'Search by code or text', 'aria-label': 'Search objectives' });
		const scopeBox = el('input', { type: 'checkbox', checked: scoped });
		const tabs = el('div', { class: 'sched-tabs small' });
		const list = el('div', { class: 'pick-list' });

		const draw = () => {
			tabs.replaceChildren(
				...d.objectiveTrees.map((t, i) =>
					el('button', { type: 'button', class: 'sched-tab' + (i === treeIdx ? ' on' : ''), text: t.name, onclick: () => ((treeIdx = i), draw()) })
				)
			);
			const tree = d.objectiveTrees[treeIdx];
			const ix = S.treeIndex(tree);
			const q = search.value.trim().toLowerCase();
			const suggested = new Set((topicNode && d.suggestedSkills[topicNode]) || []);
			let nodes = ix.flat().filter((n) => !n.hidden);
			if (scoped && treeIdx === 0 && topicNode) {
				const keep = new Set([topicNode, ...ix.descendants(topicNode)]);
				nodes = nodes.filter((n) => keep.has(n.id));
			}
			if (q) nodes = nodes.filter((n) => (n.code + ' ' + n.text).toLowerCase().includes(q));
			list.replaceChildren(
				...nodes.slice(0, 400).map((n) => {
					const cb = el('input', { type: 'checkbox', checked: chosen.has(n.id) });
					cb.addEventListener('change', () => (cb.checked ? chosen.add(n.id) : chosen.delete(n.id)));
					return el(
						'label',
						{ class: 'pick-row', style: { paddingLeft: 0.25 + ix.depth(n) * 1.1 + 'rem' } },
						cb,
						el('span', { class: 'pick-code', text: n.code }),
						el('span', { class: 'pick-text', text: n.text }),
						suggested.has(n.id) ? el('span', { class: 'pick-badge', text: 'suggested' }) : null
					);
				})
			);
			if (!nodes.length) list.append(el('p', { class: 'sched-hint', text: 'Nothing matches.' }));
		};
		search.addEventListener('input', draw);
		scopeBox.addEventListener('change', () => ((scoped = scopeBox.checked), draw()));
		const body = el(
			'div',
			{ class: 'sched-form' },
			tabs,
			search,
			topicNode ? el('label', { class: 'sched-check' }, scopeBox, ` Only ${topic.title} (the topic on this date)`) : null,
			list
		);
		const sel = app.sel;
		const m = app.dialog(
			'Choose objectives',
			body,
			[
				el('span', { class: 'ht-spacer' }),
				app.btn('Cancel', () => m.close()),
				app.btn(
					'Done',
					() => {
						m.close();
						app.commit(
							(dd) => {
								const a = findItem(sel, dd);
								// keep the order: existing first, then new ones in tree order
								const kept = a.objectiveIds.filter((id) => chosen.has(id));
								const added = [...chosen].filter((id) => !kept.includes(id));
								a.objectiveIds = [...kept, ...added];
							},
							{ editor: true }
						);
					},
					'btn-blue'
				)
			],
			{ wide: true }
		);
		const m0 = m;
		draw();
		search.focus();
	}

	/* ------------------------------------------------------------------ */
	/* Day, shift and draft dialogs                                        */
	/* ------------------------------------------------------------------ */

	function dayDialog(r) {
		const d = app.data;
		const ov = d.overrides[r.date] || {};
		const type = app.select(
			[
				['', `Automatic (${r.type === 'none' && !ov.type ? 'day off' : 'rotation'})`],
				['A', 'A day'],
				['B', 'B day'],
				['none', 'No class']
			],
			ov.type || ''
		);
		const note = app.input({ type: 'text', value: ov.note || '', placeholder: 'e.g. Snow day, Pep rally' });
		const body = el(
			'div',
			{ class: 'sched-form' },
			app.field('Schedule', type),
			app.field('Note', note),
			el('p', {
				class: 'sched-hint',
				text: 'Changing a day changes the A/B rotation for every school day after it. Plans stay on their dates — use Shift dates… to move them.'
			})
		);
		const m = app.dialog(`${S.DOW_SHORT[r.dow]} ${S.fmtShort(r.date)}`, body, [
			el('span', { class: 'ht-spacer' }),
			app.btn('Cancel', () => m.close()),
			app.btn(
				'Save',
				() => {
					m.close();
					app.commit((dd) => {
						const v = { type: type.value || undefined, note: note.value.trim() || undefined };
						if (!v.type && !v.note) delete dd.overrides[r.date];
						else dd.overrides[r.date] = JSON.parse(JSON.stringify(v));
					});
				},
				'btn-blue'
			)
		]);
	}

	function shiftDialog() {
		const from = app.input({ type: 'date', value: S.today() });
		const n = app.input({ type: 'number', value: '1', step: '1' });
		const body = el(
			'div',
			{ class: 'sched-form' },
			el('div', { class: 'sched-row2' }, app.field('Starting on', from), app.field('Class meetings (negative = earlier)', n)),
			el('p', {
				class: 'sched-hint',
				text: `Everything that starts or ends on or after this date moves by that many ${app.data.course.meetsOn}-day meetings. Units and topics that began earlier just get longer or shorter.`
			})
		);
		const m = app.dialog('Shift dates', body, [
			el('span', { class: 'ht-spacer' }),
			app.btn('Cancel', () => m.close()),
			app.btn(
				'Shift',
				() => {
					const k = parseInt(n.value, 10);
					if (!S.isDate(from.value) || !k) return m.error('Pick a date and a non-zero number.');
					let moved = 0;
					m.close();
					app.commit((d) => (moved = S.shift(d, from.value, k)));
					statusEl.textContent = `Moved ${moved} item${moved === 1 ? '' : 's'}`;
				},
				'btn-blue'
			)
		]);
	}

	function draftDialog() {
		const d = app.data;
		const tree = d.objectiveTrees[0];
		if (!tree) {
			const m0 = app.dialog('Draft from framework', el('p', { text: 'This course has no objectives framework.' }), [app.btn('Close', () => m0.close())]);
			return;
		}
		const from = app.input({ type: 'date', value: d.course.termStart });
		const body = el(
			'div',
			{ class: 'sched-form' },
			app.field('Start on', from),
			el('p', {
				class: 'sched-hint',
				text: `Lays the units of “${tree.name}” end to end on ${d.course.meetsOn} days, using each unit’s length in meetings, and splits each unit evenly among its topics. This replaces the current ${d.units.length} units and ${d.topics.length} topics; activities are not changed. Undo works.`
			})
		);
		const m = app.dialog('Draft units and topics', body, [
			el('span', { class: 'ht-spacer' }),
			app.btn('Cancel', () => m.close()),
			app.btn(
				'Draft',
				() => {
					if (!S.isDate(from.value)) return m.error('Pick a start date.');
					m.close();
					app.commit((dd) => S.draftPlan(dd, dd.objectiveTrees[0], from.value));
				},
				'btn-blue'
			)
		]);
	}

	function scrollToToday() {
		if (app.view !== 'calendar' || !cal.rows.length) return;
		const i = Math.max(0, S.lowerBound(cal.rows, S.today()) - 2);
		const t = cal.rowTops[Math.min(i, cal.rowTops.length - 1)];
		if (t) cal.scroller.scrollTop = t[0] - 40;
	}

	/* ------------------------------------------------------------------ */
	/* Keyboard shortcuts                                                  */
	/* ------------------------------------------------------------------ */

	document.addEventListener('keydown', (e) => {
		const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
		if (typing || document.querySelector('dialog[open]')) return;
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			e.shiftKey ? redo() : undo();
		} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			redo();
		}
	});

	/* ------------------------------------------------------------------ */
	/* Start                                                               */
	/* ------------------------------------------------------------------ */

	app.start = function () {
		const saves = listCourses();
		const last = safeGet(LAST_KEY);
		const f = saves.find((s) => s.id === last) || saves[0];
		if (f) openCourse(f);
		else app.render();
	};
	app.saveNow = saveNow;
	app.status = statusEl;
})();
