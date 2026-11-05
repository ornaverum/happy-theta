/* Theta Scheduler — School calendar wizard (year, days off, class schedule, plan), templates, catch-up.
   Load after scheduler.js and scheduler-plan.js. */
'use strict';

(function () {
	const S = HT.sched;
	const P = S.plan;
	const app = HT.schedApp;
	const el = HT.el;
	const TPL = 'schedtemplate';

	/* ------------------------------------------------------------------ */
	/* Templates: built-in (from objective seeds) + saved in this browser  */
	/* ------------------------------------------------------------------ */

	const builtIn = new Map();
	function templates() {
		const out = [];
		for (const seed of Object.values(HT.schedulerSeeds || {})) {
			if (!builtIn.has(seed.id)) builtIn.set(seed.id, P.templateFromSeed(seed));
			out.push({ id: 'seed:' + seed.id, name: builtIn.get(seed.id).name, tpl: builtIn.get(seed.id), builtIn: true });
		}
		let saved = [];
		try {
			saved = HT.files.list(TPL);
		} catch {}
		for (const f of saved) out.push({ id: f.id, name: f.meta.title, tpl: f.data, file: f });
		return out;
	}
	const tplSummary = (t) => `${t.units.length} units · ${t.topics.length} topics · ${t.activities.filter((a) => a.anchor).length} dated activities`;

	/* The "where and how" form for applying a template. `getData()` returns course data whose dates/semesters
	   decide the ranges (the wizard passes its draft). Returns { node, opts() }. */
	function planForm(getData, { tplId, isNew } = {}) {
		const list = templates();
		const tplSel = app.select(list.map((t) => [t.id, t.name + (t.builtIn ? ' (built in)' : '')]), tplId || (list[0] && list[0].id));
		const range = app.select([], 'year');
		const from = app.input({ type: 'date' });
		const to = app.input({ type: 'date' });
		const custom = el('div', { class: 'sched-row2' }, app.field('From', from), app.field('Through', to));
		const units = el('div', { class: 'unit-checks' });
		const replace = el('input', { type: 'checkbox', checked: true });
		const fit = el('input', { type: 'checkbox', checked: true });
		const info = el('p', { class: 'sched-hint' });

		const cur = () => list.find((t) => t.id === tplSel.value);
		const drawRanges = () => {
			const rs = P.ranges(getData());
			const keep = range.value || 'year';
			range.replaceChildren(
				...rs.map((r) => el('option', { value: r.id, text: `${r.name} (${S.fmtShort(r.start)} – ${S.fmtShort(r.end)})` })),
				el('option', { value: 'custom', text: 'Custom dates' })
			);
			range.value = [...rs.map((r) => r.id), 'custom'].includes(keep) ? keep : 'year';
			const r = rs.find((x) => x.id === range.value) || rs[0];
			if (range.value !== 'custom') {
				from.value = r.start;
				to.value = r.end;
			}
			custom.hidden = range.value !== 'custom';
		};
		const drawUnits = () => {
			const t = cur();
			units.replaceChildren();
			if (!t) return;
			// Pre-check units for a semester: skip units the course already has outside that time;
			// if it has none, split the template in half by length.
			const rid = range.value;
			const data = getData();
			// a unit counts as already placed if any of its topics fall outside this time
			const outside = data.units.filter((u) =>
				data.topics.some((t) => t.unitId === u.id && t.start && (t.start < from.value || t.start > to.value)) || (u.start && (u.end || u.start) < from.value) || (u.start && u.start > to.value)
			);
			const has = (u) => outside.some((x) => (u.objectiveId && x.objectiveId === u.objectiveId) || x.title === u.title);
			const total = t.tpl.units.reduce((s, u) => s + (u.meetings || 1), 0);
			let acc = 0;
			t.tpl.units.forEach((u) => {
				const mid = acc + (u.meetings || 1) / 2;
				acc += u.meetings || 1;
				let on = true;
				if (rid === 's1' || rid === 's2') on = outside.length ? !has(u) : (mid < total / 2 ? 's1' : 's2') === rid;
				const cb = el('input', { type: 'checkbox', checked: on, value: u.key });
				units.append(el('label', { class: 'sched-check' }, cb, ' ' + u.title));
			});
			info.textContent = tplSummary(t.tpl) + (t.tpl.fromCourse ? ` · saved from “${t.tpl.fromCourse}”` : '');
		};
		range.addEventListener('change', () => {
			drawRanges();
			drawUnits();
		});
		tplSel.addEventListener('change', drawUnits);
		drawRanges();
		drawUnits();

		const node = el(
			'div',
			{ class: 'sched-form' },
			app.field('Template', tplSel),
			info,
			app.field('Lay it out over', range),
			custom,
			el('div', { class: 'ht-field' }, el('span', { text: 'Units to include' }), units),
			el('label', { class: 'sched-check' }, fit, ' Stretch or shrink topics so they fill exactly that time'),
			isNew ? null : el('label', { class: 'sched-check' }, replace, ' Replace the units, topics and activities already in that time (fixed-date activities stay)')
		);
		return {
			node,
			refresh: () => (drawRanges(), drawUnits()),
			opts: () => {
				const t = cur();
				const keys = [...units.querySelectorAll('input:checked')].map((x) => x.value);
				return {
					tpl: t && t.tpl,
					from: from.value,
					to: to.value,
					unitKeys: t && keys.length === t.tpl.units.length ? null : keys,
					replace: isNew ? true : replace.checked,
					fit: fit.checked
				};
			}
		};
	}

	function describeApply(r) {
		if (r.error) return r.error;
		return (
			`Placed ${r.units} units, ${r.topics} topics and ${r.activities} activities over ${r.meetings} class meetings` +
			(r.banked ? `; ${r.banked} undated activities went to the bank` : '') +
			(r.kept ? ` (starting ${S.fmtShort(r.startedOn)}, after ${r.kept} topic${r.kept === 1 ? '' : 's'} already there)` : '') +
			(r.overflow ? `. ${r.overflow} meetings’ worth didn’t fit and piled up at the end` : '') +
			'.'
		);
	}

	/* ------------------------------------------------------------------ */
	/* School calendar wizard                                              */
	/* ------------------------------------------------------------------ */

	app.setupWizard = function ({ isNew }) {
		const seeds = HT.schedulerSeeds || {};
		const base = isNew ? S.newCourse() : HT.clone(app.data);
		const c = base.course;
		if (isNew) c.title = 'AP Physics 1';
		const draft = () => {
			// course data reflecting the wizard so far (for ranges and previews)
			const d = HT.clone(base);
			Object.assign(d.course, {
				title: f.title.value.trim() || 'Course',
				termStart: f.start.value,
				termEnd: f.end.value,
				semester2Start: f.sem2.value || null,
				meetsOn: f.meets.value,
				classMinutes: Math.max(1, parseInt(f.mins.value, 10) || 50)
			});
			d.breaks = breaks.map((b) => ({ ...b }));
			if (!keepRules || !keepRules.checked) d.course.rules = qp.rules();
			return d;
		};

		const f = {
			title: app.input({ type: 'text', value: c.title }),
			start: app.input({ type: 'date', value: c.termStart }),
			end: app.input({ type: 'date', value: c.termEnd }),
			sem2: app.input({ type: 'date', value: c.semester2Start || P.suggestSemester2(c.termStart, c.termEnd) || '' }),
			meets: app.select([['A', 'A days'], ['B', 'B days']], c.meetsOn),
			mins: app.input({ type: 'number', min: '1', step: '5', value: c.classMinutes || 50 }),
			seed: app.select([...Object.values(seeds).map((s) => [s.id, s.title]), ['', 'None (start empty)']], Object.keys(seeds)[0] || '')
		};
		let breaks = (base.breaks || []).map((b) => ({ ...b }));
		const qp = app.quickPattern(isNew ? null : c.rules);
		const simple = isNew || S.isRotation(c.rules) || JSON.stringify(S.rulesFromPattern(S.patternFromRules(c.rules), null).map((r) => [r.type, r.days, r.first])) === JSON.stringify(c.rules.map((r) => [r.type, r.days, r.first]));
		const keepRules = !isNew && !simple ? el('input', { type: 'checkbox', checked: true }) : null;

		/* ---- step bodies ---- */
		const stepYear = () =>
			el(
				'div',
				{ class: 'sched-form' },
				isNew ? app.field('Course name', f.title) : null,
				el('div', { class: 'sched-row2' }, app.field('First day of school', f.start), app.field('Last day of school', f.end)),
				el(
					'div',
					{ class: 'sched-row2' },
					app.field('Second semester starts (blank = no semesters)', f.sem2),
					el('div', { class: 'ht-field' }, el('span', { text: ' ' }), app.btn('Suggest', () => (f.sem2.value = P.suggestSemester2(f.start.value, f.end.value) || '')))
				),
				isNew ? app.field('Objectives', f.seed) : null,
				el('p', { class: 'sched-hint', text: 'Semesters let you lay out a template or catch up within one half of the year.' })
			);

		const holidayBox = el('div', { class: 'set-list' });
		const drawHolidays = () => {
			holidayBox.replaceChildren(
				...breaks
					.slice()
					.sort((a, b) => a.start.localeCompare(b.start))
					.map((b) => {
						const s = app.input({ type: 'date', value: b.start, 'aria-label': 'From' });
						const e = app.input({ type: 'date', value: b.end || b.start, 'aria-label': 'Through' });
						const n = app.input({ type: 'text', value: b.note || '', placeholder: 'Name', 'aria-label': 'Name' });
						s.addEventListener('change', () => ((b.start = s.value), b.end < b.start && (b.end = b.start), drawHolidays()));
						e.addEventListener('change', () => (b.end = e.value < b.start ? b.start : e.value));
						n.addEventListener('change', () => (b.note = n.value.trim()));
						return el(
							'div',
							{ class: 'hol-row' + (b.suggested ? ' suggested' : '') },
							n,
							s,
							e,
							el('button', { type: 'button', class: 'link-del', 'aria-label': 'Remove', text: '×', onclick: () => ((breaks = breaks.filter((x) => x !== b)), drawHolidays()) })
						);
					})
			);
			if (!breaks.length) holidayBox.append(el('p', { class: 'sched-hint', text: 'No days off yet.' }));
		};
		const stepHolidays = () => {
			drawHolidays();
			return el(
				'div',
				{ class: 'sched-form' },
				el('div', { class: 'hol-row head' }, el('span', { text: 'Name' }), el('span', { text: 'From' }), el('span', { text: 'Through' }), el('span')),
				holidayBox,
				el(
					'div',
					{ class: 'set-line' },
					app.btn('+ Add a day off', () => {
						breaks.push({ id: S.newId('b'), start: f.start.value, end: f.start.value, note: '' });
						drawHolidays();
					}),
					app.btn('Suggest common US holidays', () => {
						const have = (h) => breaks.some((b) => b.start <= h.end && (b.end || b.start) >= h.start);
						const add = P.suggestHolidays(f.start.value, f.end.value).filter((h) => !have(h));
						breaks.push(...add);
						drawHolidays();
					})
				),
				el('p', { class: 'sched-hint', text: 'Suggested dates (yellow) are typical guesses — check them against your district calendar. Single days can also be changed later by clicking a day on the calendar.' })
			);
		};

		const preview = el('div');
		const drawPreview = () => {
			try {
				const d = draft();
				const days = S.genDays(d);
				const meets = days.filter((x) => x.meet).length;
				const s = P.ranges(d);
				preview.replaceChildren(
					el(
						'p',
						{ class: 'sched-summary' },
						`${meets} class meetings this year` +
							(s.length > 1 ? ` (${s.slice(1).map((r) => `${r.name}: ${days.filter((x) => x.meet && x.date >= r.start && x.date <= r.end).length}`).join(', ')})` : '') +
							` · ${Math.round((meets * (d.course.classMinutes || 0)) / 60)} hours of class`
					),
					weekStrip(days, d)
				);
			} catch (err) {
				console.error(err);
			}
		};
		const stepSchedule = () => {
			const wrap = el(
				'div',
				{ class: 'sched-form' },
				el('div', { class: 'sched-row2' }, app.field('This course meets on', f.meets), app.field('Class length (minutes)', f.mins)),
				keepRules
					? el('label', { class: 'sched-check' }, keepRules, ` Keep my current repeat rules (${c.rules.length}) — uncheck to replace them with the pattern below`)
					: null,
				el('div', { class: 'ht-field' }, el('span', { text: 'A / B days' }), qp.node),
				preview,
				el('p', { class: 'sched-hint', text: 'Every-other-week rules, mid-year changes and per-rule class lengths are in Settings → Schedule.' })
			);
			wrap.addEventListener('change', drawPreview);
			drawPreview();
			return wrap;
		};

		let pf = null;
		const planMode = app.select(
			isNew
				? [
						['template', 'Lay out a template'],
						['none', 'Start with an empty calendar']
				  ]
				: [
						['none', 'Leave my plan as it is'],
						['template', 'Lay out a template']
				  ],
			isNew ? 'template' : 'none'
		);
		const bankBox = el('input', { type: 'checkbox', checked: true });
		const stepPlan = () => {
			// for a new course, start with the built-in template that matches the chosen objectives
			pf = planForm(draft, { isNew, tplId: isNew && f.seed.value ? 'seed:' + f.seed.value : undefined });
			const tplWrap = el('div', null, pf.node);
			const bankWrap = isNew ? el('label', { class: 'sched-check' }, bankBox, ' Put the framework’s quizzes in the activity bank') : null;
			const sync = () => {
				tplWrap.hidden = planMode.value !== 'template';
				if (bankWrap) bankWrap.hidden = planMode.value === 'template';
			};
			planMode.addEventListener('change', sync);
			sync();
			return el('div', { class: 'sched-form' }, app.field('Units, topics and activities', planMode), tplWrap, bankWrap);
		};

		const steps = [
			['School year', stepYear],
			['Days off', stepHolidays],
			['Class schedule', stepSchedule],
			['Plan', stepPlan]
		];
		let step = 0;
		const head = el('ol', { class: 'wiz-steps' });
		const body = el('div', { class: 'wiz-body' });
		const back = app.btn('Back', () => go(step - 1));
		const next = app.btn('Next', () => go(step + 1), 'btn-blue');
		const finish = app.btn(isNew ? 'Create course' : 'Save', () => done(), 'btn-blue');

		const validate = (i) => {
			if (i === 0) {
				if (!S.isDate(f.start.value) || !S.isDate(f.end.value) || f.end.value <= f.start.value) return 'Check the first and last day of school.';
				if (f.sem2.value && (f.sem2.value <= f.start.value || f.sem2.value > f.end.value)) return 'The second semester has to start inside the school year.';
			}
			if (i === 2 && !(parseInt(f.mins.value, 10) > 0)) return 'Enter a class length in minutes.';
			return null;
		};
		const bodies = new Map();
		const go = (i) => {
			if (i > step) {
				const err = validate(step);
				if (err) return m.error(err);
			}
			m.error('');
			step = Math.max(0, Math.min(steps.length - 1, i));
			head.replaceChildren(...steps.map(([t], k) => el('li', { class: k === step ? 'on' : k < step ? 'done' : '' }, el('button', { type: 'button', text: `${k + 1}. ${t}`, onclick: () => go(k) }))));
			// rebuild steps that depend on earlier answers; keep the others (so their state survives)
			if (!bodies.has(step) || step >= 2) bodies.set(step, steps[step][1]());
			else if (step === 1) drawHolidays();
			body.replaceChildren(bodies.get(step));
			back.disabled = step === 0;
			next.hidden = step === steps.length - 1;
			finish.hidden = isNew && step !== steps.length - 1; // an existing course can be saved from any step
		};

		const done = () => {
			for (let k = 0; k < steps.length; k++) {
				const err = validate(k);
				if (err) {
					go(k);
					return m.error(err);
				}
			}
			const d = draft();
			let summary = '';
			if (isNew) {
				const seed = seeds[f.seed.value];
				const fresh = S.newCourse({ seed: seed && planMode.value !== 'template' && bankBox.checked ? seed : seed ? { data: { ...seed.data, activityBank: [] } } : null });
				fresh.course = d.course;
				fresh.breaks = d.breaks;
				Object.assign(d, { objectiveTrees: fresh.objectiveTrees, suggestedSkills: fresh.suggestedSkills, activities: fresh.activities });
			}
			if (planMode.value === 'template' && pf) {
				const o = pf.opts();
				if (!o.tpl) return m.error('Pick a template.');
				const r = P.applyTemplate(d, o.tpl, o);
				if (r.error) return m.error(r.error);
				summary = describeApply(r);
			}
			m.close();
			if (isNew) app.openData(d);
			else app.commit((dd) => Object.assign(dd, d));
			app.flash(summary || 'School calendar saved');
		};

		const m = app.dialog(isNew ? 'New course' : 'School calendar', el('div', { class: 'wiz' }, head, body), [back, el('span', { class: 'ht-spacer' }), app.btn('Cancel', () => m.close()), next, finish], { wide: true });
		go(0);
	};

	/* Compact strip of the next few weeks for previews */
	function weekStrip(days, d) {
		const byDate = new Map(days.map((x) => [x.date, x]));
		const t = S.today();
		let start = t >= d.course.termStart && t <= d.course.termEnd ? t : d.course.termStart;
		start = S.addDays(start, -((S.dow(start) + 6) % 7));
		return el(
			'table',
			{ class: 'pv-table' },
			el('thead', null, el('tr', null, el('th', { text: 'Week of' }), [1, 2, 3, 4, 5].map((dw) => el('th', { text: S.DOW_SHORT[dw] })))),
			el(
				'tbody',
				null,
				[0, 1, 2].map((w) => {
					const mon = S.addDays(start, w * 7);
					return el(
						'tr',
						null,
						el('td', { class: 'pv-week', text: S.fmtShort(mon) }),
						[0, 1, 2, 3, 4].map((k) => {
							const x = byDate.get(S.addDays(mon, k));
							return el('td', { title: x ? x.why : '' }, x ? el('span', { class: 'type-badge t-' + x.type + (x.meet ? ' meet' : ''), text: x.type === 'none' ? '—' : x.type }) : null);
						})
					);
				})
			)
		);
	}

	/* ------------------------------------------------------------------ */
	/* Templates dialog                                                    */
	/* ------------------------------------------------------------------ */

	app.templatesDialog = function () {
		const list = el('ul', { class: 'ht-save-list' });
		const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
		const render = () => {
			list.replaceChildren(
				...templates().map((t) =>
					el(
						'li',
						null,
						el('div', { class: 'ht-save-info' }, el('strong', { text: t.name }), el('small', { text: (t.builtIn ? 'Built in · ' : '') + tplSummary(t.tpl) })),
						t.builtIn ? null : app.btn('Download', () => HT.files.download(t.file)),
						t.builtIn
							? null
							: (() => {
									const del = app.btn('Delete', () => {
										if (!del.dataset.armed) {
											del.dataset.armed = '1';
											del.textContent = 'Confirm';
											del.classList.add('btn-red');
											return;
										}
										try {
											HT.files.remove(TPL, t.id);
										} catch {}
										render();
									});
									return del;
							  })(),
						app.btn('Apply…', () => (m.close(), applyDialog(t.id)), 'btn-blue')
					)
				)
			);
		};
		fileInput.addEventListener('change', () => {
			const blob = fileInput.files[0];
			if (!blob) return;
			HT.files
				.readUpload(blob, TPL)
				.then((f) => {
					HT.files.write(f);
					render();
				})
				.catch((err) => m.error(err.message));
		});
		const name = app.input({ type: 'text', value: app.data.course.title + ' plan', 'aria-label': 'Template name' });
		const save = el(
			'div',
			{ class: 'set-card' },
			el('strong', { text: 'Save this course as a template' }),
			el('span', {
				class: 'sched-hint',
				text: 'Keeps the units, topics (with their length in class meetings) and activities placed relative to their topics, so next year’s calendar can be laid out from it.'
			}),
			el(
				'div',
				{ class: 'set-line' },
				name,
				app.btn('Save template', () => {
					try {
						const tpl = P.makeTemplate(app.data, name.value.trim());
						HT.files.write(HT.files.wrap(TPL, { title: tpl.name, data: tpl }));
						render();
						m.error('');
					} catch (err) {
						console.error(err);
						m.error('This browser blocked saving. Try Download instead.');
					}
				}, 'btn-blue')
			)
		);
		const m = app.dialog('Templates', el('div', { class: 'sched-form' }, list, save, fileInput), [
			app.btn('Open template file…', () => fileInput.click()),
			el('span', { class: 'ht-spacer' }),
			app.btn('Close', () => m.close())
		], { wide: true });
		render();
	};

	function applyDialog(tplId) {
		const pf = planForm(() => app.data, { tplId });
		const m = app.dialog('Apply a template', pf.node, [
			el('span', { class: 'ht-spacer' }),
			app.btn('Cancel', () => m.close()),
			app.btn(
				'Apply',
				() => {
					const o = pf.opts();
					if (!S.isDate(o.from) || !S.isDate(o.to) || o.to < o.from) return m.error('Check the dates.');
					// dry run first, so an error doesn't leave a half-applied plan
					const test = P.applyTemplate(HT.clone(app.data), o.tpl, o);
					if (test.error) return m.error(test.error);
					m.close();
					let r;
					app.commit((d) => (r = P.applyTemplate(d, o.tpl, o)));
					app.flash(describeApply(r));
				},
				'btn-blue'
			)
		], { wide: true });
	}

	/* ------------------------------------------------------------------ */
	/* Catch up                                                            */
	/* ------------------------------------------------------------------ */

	app.catchUpDialog = function () {
		const d = app.data;
		const topics = P.orderedTopics(d.topics);
		if (!topics.length) {
			const m0 = app.dialog('Catch up', el('p', { text: 'There are no topics on the calendar yet. Lay out a template first (Templates…).' }), [el('span', { class: 'ht-spacer' }), app.btn('Close', () => m0.close())]);
			return;
		}
		const today = S.today();
		const guess = P.topicOn(d, S.addDays(today, -1)) || topics[0];
		const topicSel = app.select(
			topics.map((t) => [t.id, `${t.title}  (planned ${S.fmtShort(t.start)}${t.end && t.end !== t.start ? ' – ' + S.fmtShort(t.end) : ''})`]),
			guess.id
		);
		const asOf = app.input({ type: 'date', value: today });
		const ranges = P.ranges(d);
		const scope = app.select([], 'sem');
		const until = app.input({ type: 'date' });
		const untilField = app.field('Through', until);
		const drawScope = () => {
			const r = P.rangeAt(d, asOf.value || today);
			const keep = scope.value;
			const opts = [];
			if (ranges.length > 1 && r.id !== 'year') opts.push(['sem', `Squeeze into the rest of ${r.name} (through ${S.fmtShort(r.end)})`]);
			opts.push(['year', `Spread over the rest of the year (through ${S.fmtShort(d.course.termEnd)})`]);
			opts.push(['date', 'Spread over the time until a date…']);
			opts.push(['keep', 'Keep each topic’s length and push everything later']);
			scope.replaceChildren(...opts.map(([v, t]) => el('option', { value: v, text: t })));
			scope.value = opts.some(([v]) => v === keep) ? keep : opts[0][0];
			untilField.hidden = scope.value !== 'date';
			if (!until.value) until.value = r.end;
		};
		const opts = () => {
			const r = P.rangeAt(d, asOf.value || today);
			const v = scope.value;
			return {
				topicId: topicSel.value,
				asOf: asOf.value,
				until: v === 'sem' ? r.end : v === 'date' ? until.value : d.course.termEnd,
				fit: v !== 'keep'
			};
		};
		const summary = el('p', { class: 'sched-summary' });
		const table = el('table', { class: 'cu-table' });
		const drawPreview = () => {
			untilField.hidden = scope.value !== 'date';
			const o = opts();
			if (!S.isDate(o.asOf)) return;
			const res = P.catchUp(HT.clone(d), o);
			if (res.error) {
				summary.textContent = res.error;
				summary.classList.add('error');
				table.replaceChildren();
				return;
			}
			summary.classList.remove('error');
			const ratio = res.oldMeetings ? res.meetings / res.oldMeetings : 1;
			const n = res.rows.filter((x) => !x.finished).length;
			summary.textContent =
				(o.fit
					? `${n} topics planned for ${res.oldMeetings} class meetings get ${res.meetings} (${Math.round(ratio * 100)}%).`
					: `${n} topics keep their lengths and start after ${S.fmtShort(o.asOf)}.` + (res.overflow ? ` ${res.overflow} meetings’ worth runs past the end of the year.` : '')) +
				` ${res.moved} activities move with them; fixed-date activities stay.` +
				(o.fit && ratio < 0.6 ? ' That is a lot of squeezing — consider spreading over the rest of the year.' : '');
			const fmt = (a, b) => S.fmtShort(a) + (b && b !== a ? ' – ' + S.fmtShort(b) : '');
			table.replaceChildren(
				el('thead', null, el('tr', null, el('th', { text: 'Topic' }), el('th', { text: 'Planned' }), el('th', { text: 'New' }), el('th', { class: 'num', text: 'Classes' }))),
				el(
					'tbody',
					null,
					res.rows.map((x) =>
						el(
							'tr',
							{ class: x.finished ? 'fin' : x.newN < x.oldN ? 'shorter' : x.newN > x.oldN ? 'longer' : '' },
							el('td', { text: x.title }),
							el('td', { text: fmt(x.oldStart, x.oldEnd) }),
							el('td', { text: x.finished ? `finished ${S.fmtShort(x.newEnd)}` : fmt(x.newStart, x.newEnd) }),
							el('td', { class: 'num', text: x.finished ? '' : `${x.oldN} → ${x.newN}` })
						)
					)
				)
			);
		};
		[topicSel, scope, until].forEach((x) => x.addEventListener('change', drawPreview));
		asOf.addEventListener('change', () => (drawScope(), drawPreview()));
		drawScope();
		const body = el(
			'div',
			{ class: 'sched-form' },
			el('div', { class: 'sched-row2 wide-first' }, app.field('Most recently finished topic', topicSel), app.field('Finished as of', asOf)),
			app.field('Fit the remaining topics', scope),
			untilField,
			summary,
			el('div', { class: 'cu-wrap' }, table)
		);
		const m = app.dialog('Catch up', body, [
			el('span', { class: 'ht-spacer' }),
			app.btn('Cancel', () => m.close()),
			app.btn(
				'Reschedule',
				() => {
					const o = opts();
					const test = P.catchUp(HT.clone(d), o);
					if (test.error) return m.error(test.error);
					m.close();
					let r;
					app.commit((dd) => (r = P.catchUp(dd, o)));
					app.flash(`Rescheduled ${r.rows.filter((x) => !x.finished).length} topics and moved ${r.moved} activities`);
				},
				'btn-blue'
			)
		], { wide: true });
		drawPreview();
	};
})();
