/* Theta Scheduler — Objectives (outline editor), Dashboard (content map) and Settings views.
   Load after scheduler.js. */
'use strict';

(function () {
	const S = HT.sched;
	const app = HT.schedApp;
	const el = HT.el;

	/* ------------------------------------------------------------------ */
	/* Objectives: outline editor                                          */
	/* ------------------------------------------------------------------ */

	const ob = { tree: 0, query: '', collapsed: new Set(), focus: null };

	function linkCounts(d) {
		const m = new Map();
		for (const a of d.activities) for (const id of a.objectiveIds || []) m.set(id, (m.get(id) || 0) + 1);
		for (const x of [...d.units, ...d.topics]) if (x.objectiveId) m.set(x.objectiveId, (m.get(x.objectiveId) || 0) + 1);
		return m;
	}

	function renderObjectives(container) {
		const d = app.data;
		if (!d.objectiveTrees.length) {
			d.objectiveTrees.push({ id: S.newId('tree'), name: 'Objectives', levels: ['Unit', 'Topic', 'Objective'], nodes: [] });
		}
		if (ob.tree >= d.objectiveTrees.length) ob.tree = 0;
		const tree = d.objectiveTrees[ob.tree];
		const ix = S.treeIndex(tree);
		const counts = linkCounts(d);

		const tabs = el(
			'div',
			{ class: 'sched-tabs small' },
			d.objectiveTrees.map((t, i) => el('button', { type: 'button', class: 'sched-tab' + (i === ob.tree ? ' on' : ''), text: t.name, onclick: () => ((ob.tree = i), app.render()) })),
			el('button', {
				type: 'button',
				class: 'sched-tab',
				text: '+ New list',
				onclick: () => {
					app.commit((dd) => dd.objectiveTrees.push({ id: S.newId('tree'), name: 'New list', levels: ['Level 1', 'Level 2'], nodes: [] }));
					ob.tree = app.data.objectiveTrees.length - 1;
					app.render();
				}
			})
		);

		const name = app.input({ type: 'text', value: tree.name, 'aria-label': 'List name' });
		name.addEventListener('change', () => app.commit((dd) => (dd.objectiveTrees[ob.tree].name = name.value.trim() || 'Objectives'), { keep: true }));
		const levels = app.input({ type: 'text', value: tree.levels.join(', '), 'aria-label': 'Level names, comma separated' });
		levels.addEventListener('change', () =>
			app.commit((dd) => (dd.objectiveTrees[ob.tree].levels = levels.value.split(',').map((s) => s.trim()).filter(Boolean)), { keep: true })
		);
		const search = app.input({ type: 'search', value: ob.query, placeholder: 'Search by code or text', 'aria-label': 'Search objectives' });
		search.addEventListener('input', () => {
			ob.query = search.value;
			drawList();
		});

		const list = el('div', { class: 'ol-list', role: 'tree' });

		const mutate = (fn, focusId) => {
			ob.focus = focusId || null;
			app.commit((dd) => fn(dd.objectiveTrees[ob.tree]));
		};
		const reorder = (t, parentId) => {
			t.nodes
				.filter((n) => (n.parentId || null) === (parentId || null))
				.sort((a, b) => a.order - b.order)
				.forEach((n, i) => (n.order = i + 1));
		};
		const addNode = (parentId, afterOrder) => {
			const id = S.newId('o');
			mutate((t) => {
				for (const n of t.nodes) if ((n.parentId || null) === (parentId || null) && n.order > afterOrder) n.order++;
				t.nodes.push({ id, parentId: parentId || null, code: '', text: '', order: afterOrder + 1, origin: 'custom', hidden: false });
			}, id);
		};
		const indent = (n) => {
			const sibs = ix.kids(n.parentId);
			const i = sibs.findIndex((s) => s.id === n.id);
			if (i <= 0) return;
			const newParent = sibs[i - 1].id;
			mutate((t) => {
				const x = t.nodes.find((y) => y.id === n.id);
				const old = x.parentId;
				x.parentId = newParent;
				x.order = ix.kids(newParent).length + 1;
				reorder(t, old);
			}, n.id);
			ob.collapsed.delete(newParent);
		};
		const outdent = (n) => {
			if (!n.parentId) return;
			const parent = ix.byId.get(n.parentId);
			mutate((t) => {
				const x = t.nodes.find((y) => y.id === n.id);
				for (const s of t.nodes) if ((s.parentId || null) === (parent.parentId || null) && s.order > parent.order) s.order++;
				x.parentId = parent.parentId || null;
				x.order = parent.order + 1;
				reorder(t, parent.id);
			}, n.id);
		};
		const move = (n, dir) => {
			const sibs = ix.kids(n.parentId);
			const i = sibs.findIndex((s) => s.id === n.id);
			const j = i + dir;
			if (j < 0 || j >= sibs.length) return;
			mutate((t) => {
				const a = t.nodes.find((y) => y.id === n.id),
					b = t.nodes.find((y) => y.id === sibs[j].id);
				[a.order, b.order] = [b.order, a.order];
			}, n.id);
		};
		const remove = (n) => {
			const ids = [n.id, ...ix.descendants(n.id)];
			const linked = ids.reduce((s, id) => s + (counts.get(id) || 0), 0);
			const go = () =>
				mutate((t) => {
					const gone = new Set(ids);
					t.nodes = t.nodes.filter((x) => !gone.has(x.id));
					reorder(t, n.parentId);
					const dd = app.data;
					for (const a of dd.activities) a.objectiveIds = a.objectiveIds.filter((id) => !gone.has(id));
					for (const x of [...dd.units, ...dd.topics]) if (gone.has(x.objectiveId)) x.objectiveId = null;
				});
			if (!linked && ids.length === 1) return go();
			const m = app.dialog(
				`Delete ${n.code || 'this objective'}?`,
				el('p', {
					text:
						`This deletes ${ids.length} objective${ids.length > 1 ? 's' : ''} (with everything under it)` +
						(linked ? ` and removes ${linked} link${linked > 1 ? 's' : ''} from activities, units or topics.` : '.') +
						' “Hide” keeps the links but leaves it off the dashboard.'
				}),
				[
					el('span', { class: 'ht-spacer' }),
					app.btn('Cancel', () => m.close()),
					app.btn('Hide instead', () => (m.close(), mutate((t) => (t.nodes.find((x) => x.id === n.id).hidden = true)))),
					app.btn('Delete', () => (m.close(), go()), 'btn-red')
				]
			);
		};

		const drawList = () => {
			const q = ob.query.trim().toLowerCase();
			const rows = [];
			const visible = (n) => {
				for (const a of ix.ancestors(n.id)) if (ob.collapsed.has(a)) return false;
				return true;
			};
			let nodes = ix.flat();
			if (q) {
				const hit = new Set();
				for (const n of nodes) if ((n.code + ' ' + n.text).toLowerCase().includes(q)) [n.id, ...ix.ancestors(n.id)].forEach((x) => hit.add(x));
				nodes = nodes.filter((n) => hit.has(n.id));
			} else nodes = nodes.filter(visible);
			for (const n of nodes.slice(0, 1500)) {
				const depth = ix.depth(n);
				const hasKids = ix.kids(n.id).length > 0;
				const code = el('input', { class: 'ol-code', value: n.code, 'aria-label': 'Code', placeholder: 'code' });
				const text = el('textarea', { class: 'ol-text', rows: '1', 'aria-label': 'Objective text', placeholder: 'Objective', text: n.text });
				code.addEventListener('change', () => mutate((t) => (t.nodes.find((x) => x.id === n.id).code = code.value.trim()), n.id));
				text.addEventListener('change', () => mutate((t) => (t.nodes.find((x) => x.id === n.id).text = text.value.trim()), n.id));
				text.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						text.blur();
						addNode(n.parentId, n.order);
					} else if (e.key === 'Tab') {
						e.preventDefault();
						text.blur();
						e.shiftKey ? outdent(n) : indent(n);
					} else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
						e.preventDefault();
						text.blur();
						move(n, e.key === 'ArrowUp' ? -1 : 1);
					}
				});
				const caret = el('button', {
					type: 'button',
					class: 'ol-caret' + (hasKids ? '' : ' leaf'),
					'aria-label': ob.collapsed.has(n.id) ? 'Expand' : 'Collapse',
					text: hasKids ? (ob.collapsed.has(n.id) && !q ? '▸' : '▾') : '',
					onclick: () => {
						if (!hasKids) return;
						ob.collapsed.has(n.id) ? ob.collapsed.delete(n.id) : ob.collapsed.add(n.id);
						drawList();
					}
				});
				const tool = (label, tip, fn) => el('button', { type: 'button', class: 'ol-tool', title: tip, 'aria-label': tip, text: label, onclick: fn });
				const c = counts.get(n.id) || 0;
				rows.push(
					el(
						'div',
						{
							class: 'ol-row' + (n.hidden ? ' hidden-node' : '') + (n.meta && n.meta.inferred ? ' inferred' : ''),
							style: { paddingLeft: depth * 1.25 + 'rem' },
							role: 'treeitem',
							'data-id': n.id
						},
						caret,
						el('span', { class: 'ol-level', text: tree.levels[depth] || '' }),
						code,
						text,
						el('span', { class: 'ol-count', title: 'Linked activities, units and topics', text: c ? String(c) : '' }),
						el(
							'span',
							{ class: 'ol-tools' },
							tool('+', 'Add a sibling below (Enter)', () => addNode(n.parentId, n.order)),
							tool('↳', 'Add a child', () => {
								ob.collapsed.delete(n.id);
								addNode(n.id, ix.kids(n.id).length);
							}),
							tool('↑', 'Move up (Alt+↑)', () => move(n, -1)),
							tool('↓', 'Move down (Alt+↓)', () => move(n, 1)),
							tool('←', 'Outdent (Shift+Tab)', () => outdent(n)),
							tool('→', 'Indent (Tab)', () => indent(n)),
							tool(n.hidden ? '◌' : '●', n.hidden ? 'Show on the dashboard' : 'Hide from the dashboard', () =>
								mutate((t) => {
									const x = t.nodes.find((y) => y.id === n.id);
									x.hidden = !x.hidden;
								}, n.id)
							),
							tool('×', 'Delete', () => remove(n))
						)
					)
				);
			}
			list.replaceChildren(...rows);
			if (!rows.length) list.append(el('p', { class: 'sched-hint', text: q ? 'Nothing matches.' : 'No objectives yet.' }));
			for (const ta of list.querySelectorAll('.ol-text')) autoGrow(ta);
			if (ob.focus) {
				const r = list.querySelector(`[data-id="${ob.focus}"] .ol-text`);
				if (r) {
					r.focus();
					r.selectionStart = r.selectionEnd = r.value.length;
				}
				ob.focus = null;
			}
		};

		const delTree = app.btn('Delete this list', () => {
			if (!delTree.dataset.armed) {
				delTree.dataset.armed = '1';
				delTree.textContent = 'Confirm: delete the whole list';
				delTree.classList.add('btn-red');
				return;
			}
			app.commit((dd) => {
				const gone = new Set(dd.objectiveTrees[ob.tree].nodes.map((n) => n.id));
				dd.objectiveTrees.splice(ob.tree, 1);
				for (const a of dd.activities) a.objectiveIds = a.objectiveIds.filter((id) => !gone.has(id));
			});
			ob.tree = 0;
		});

		container.replaceChildren(
			el(
				'div',
				{ class: 'sched-page' },
				tabs,
				el(
					'div',
					{ class: 'ol-head' },
					app.field('List name', name),
					app.field('Level names (top first, comma separated)', levels),
					app.field('Search', search)
				),
				el(
					'div',
					{ class: 'ol-bar' },
					app.btn('+ Add at top level', () => addNode(null, ix.kids(null).length)),
					app.btn('Collapse all', () => {
						tree.nodes.forEach((n) => ix.kids(n.id).length && ob.collapsed.add(n.id));
						drawList();
					}),
					app.btn('Expand all', () => (ob.collapsed.clear(), drawList())),
					el('span', { class: 'ht-spacer' }),
					el('span', { class: 'sched-hint', text: 'Enter = new line · Tab / Shift+Tab = indent / outdent · Alt+↑↓ = move · italic = inferred text, check it' }),
					delTree
				),
				list
			)
		);
		drawList();
	}

	function autoGrow(ta) {
		ta.style.height = 'auto';
		ta.style.height = ta.scrollHeight + 2 + 'px';
		ta.addEventListener('input', () => {
			ta.style.height = 'auto';
			ta.style.height = ta.scrollHeight + 2 + 'px';
		});
	}

	/* ------------------------------------------------------------------ */
	/* Dashboard: content map                                              */
	/* ------------------------------------------------------------------ */

	const db = { tree: 0, depth: 1, soFar: false, open: new Set() };
	const CATS = [
		['presentation', 'Presented'],
		['formative', 'Formative'],
		['summative', 'Summative']
	];

	function renderDashboard(container) {
		const d = app.data;
		if (!d.objectiveTrees.length) {
			container.replaceChildren(el('div', { class: 'sched-page' }, el('p', { text: 'Add objectives in the Objectives tab first.' })));
			return;
		}
		if (db.tree >= d.objectiveTrees.length) db.tree = 0;
		const tree = d.objectiveTrees[db.tree];
		const ix = S.treeIndex(tree);
		const maxDepth = Math.max(0, ...tree.nodes.map((n) => ix.depth(n)));
		db.depth = Math.min(db.depth, maxDepth);
		const cov = S.coverage(d, tree, { asOf: db.soFar ? S.today() : null });
		const tgt = d.targets;

		const tabs = el(
			'div',
			{ class: 'sched-tabs small' },
			d.objectiveTrees.map((t, i) => el('button', { type: 'button', class: 'sched-tab' + (i === db.tree ? ' on' : ''), text: t.name, onclick: () => ((db.tree = i), app.render()) }))
		);
		const depthSel = app.select(
			Array.from({ length: maxDepth + 1 }, (_, i) => [i, tree.levels[i] || `Level ${i + 1}`]),
			db.depth
		);
		depthSel.addEventListener('change', () => ((db.depth = +depthSel.value), db.open.clear(), app.render()));
		const when = app.select(
			[
				['plan', 'Whole plan'],
				['sofar', `So far (through ${S.fmtShort(S.today())})`]
			],
			db.soFar ? 'sofar' : 'plan'
		);
		when.addEventListener('change', () => ((db.soFar = when.value === 'sofar'), app.render()));

		// Summary: nodes at the chosen depth (or shallower leaves) that meet every target
		const atDepth = tree.nodes.filter((n) => !n.hidden && !hiddenUp(ix, n) && (ix.depth(n) === db.depth || (ix.depth(n) < db.depth && !ix.kids(n.id).filter((k) => !k.hidden).length)));
		const status = (n) => {
			const c = cov.get(n.id).direct;
			return CATS.map(([k]) => (tgt[k] ? Math.min(1, c[k].size / tgt[k]) : 1));
		};
		const full = atDepth.filter((n) => status(n).every((x) => x >= 1)).length;
		const none = atDepth.filter((n) => CATS.every(([k]) => cov.get(n.id).direct[k].size === 0)).length;
		const lvl = tree.levels[db.depth] || 'item';

		const table = el('table', { class: 'cm-table' });
		const thead = el(
			'thead',
			null,
			el(
				'tr',
				null,
				el('th', { text: 'Objective' }),
				CATS.map(([k, t]) => el('th', { class: 'num', text: tgt[k] ? `${t} (goal ${tgt[k]})` : t }))
			)
		);
		const tbody = el('tbody');
		const addRows = (parentId) => {
			for (const n of ix.kids(parentId)) {
				if (n.hidden) continue;
				const depth = ix.depth(n);
				const kids = ix.kids(n.id).filter((k) => !k.hidden);
				const beyond = depth >= db.depth;
				const canOpen = kids.length > 0 && beyond;
				const isOpen = !beyond || db.open.has(n.id);
				const c = cov.get(n.id);
				const tr = el(
					'tr',
					{ class: 'cm-d' + Math.min(depth, 4) + (beyond && depth > db.depth ? ' deeper' : '') },
					el(
						'td',
						{ style: { paddingLeft: 0.5 + depth * 1.1 + 'rem' } },
						canOpen
							? el('button', {
									type: 'button',
									class: 'ol-caret',
									text: isOpen ? '▾' : '▸',
									'aria-label': isOpen ? 'Collapse' : 'Expand',
									onclick: () => (db.open.has(n.id) ? db.open.delete(n.id) : db.open.add(n.id), app.render())
							  })
							: el('span', { class: 'ol-caret leaf' }),
						el('span', { class: 'cm-code', text: n.code }),
						' ',
						el('span', { class: 'cm-text', text: n.text })
					),
					CATS.map(([k]) => {
						const nDirect = c.direct[k].size,
							nVia = c.via[k].size;
						const goal = tgt[k] || 0;
						const cls = goal ? (nDirect >= goal ? 'ok' : nDirect > 0 ? 'part' : nVia ? 'via' : 'zero') : nDirect ? 'ok' : 'zero';
						const td = el('td', { class: 'num cm-' + cls });
						if (nDirect || nVia) {
							td.append(
								el(
									'button',
									{ type: 'button', class: 'cm-count', title: 'Show these activities', onclick: () => showActs(n, k, c) },
									nDirect ? String(nDirect) : '',
									nVia ? el('span', { class: 'cm-via', title: 'Linked to a broader objective above this one', text: (nDirect ? ' ' : '') + '+' + nVia }) : null
								)
							);
						} else td.textContent = '—';
						return td;
					})
				);
				tbody.append(tr);
				if (kids.length && (depth < db.depth || db.open.has(n.id))) addRows(n.id);
			}
		};
		addRows(null);
		table.append(thead, tbody);

		container.replaceChildren(
			el(
				'div',
				{ class: 'sched-page' },
				tabs,
				el(
					'div',
					{ class: 'cm-bar' },
					app.field('Show down to', depthSel),
					app.field('Count', when),
					el(
						'div',
						{ class: 'cm-summary' },
						el('strong', { text: `${full} of ${atDepth.length}` }),
						` ${lvl.toLowerCase()}${atDepth.length === 1 ? '' : 's'} meet every goal · `,
						el('strong', { text: String(none) }),
						' not covered at all'
					)
				),
				el('p', {
					class: 'sched-hint',
					text: '“+n” = activities linked to a broader objective above this one (they may cover it). Presented = activity types that count as presentation (Settings → Tags). Activities still in the bank are not counted.'
				}),
				el('div', { class: 'cm-wrap' }, table)
			)
		);
	}

	function hiddenUp(ix, n) {
		return ix.ancestors(n.id).some((id) => ix.byId.get(id).hidden);
	}

	function showActs(node, cat, c) {
		const d = app.data;
		const ids = [...c.direct[cat], ...c.via[cat]];
		const acts = ids.map((id) => d.activities.find((a) => a.id === id)).filter(Boolean).sort((a, b) => a.start.localeCompare(b.start));
		const list = el(
			'ul',
			{ class: 'ht-save-list' },
			acts.map((a) =>
				el(
					'li',
					null,
					el(
						'div',
						{ class: 'ht-save-info' },
						el('strong', { text: a.title }),
						el('small', { text: S.fmtShort(a.start) + (c.via[cat].has(a.id) ? ' · linked to a broader objective' : '') })
					),
					app.btn('Show', () => (m.close(), app.selectItem('activity', a.id)), 'btn-blue')
				)
			)
		);
		const m = app.dialog(`${node.code} ${CATS.find(([k]) => k === cat)[1]}`, list, [el('span', { class: 'ht-spacer' }), app.btn('Close', () => m.close())]);
	}

	/* ------------------------------------------------------------------ */
	/* Settings: course, days off, goals, columns, tags                    */
	/* ------------------------------------------------------------------ */

	function renderSettings(container) {
		const d = app.data;
		const c = d.course;
		const keep = { keep: true };
		const set = (fn) => app.commit(fn, keep);

		const inp = (label, value, type, onchange, attrs = {}) => {
			const i = app.input({ type, value: value ?? '', ...attrs });
			i.addEventListener('change', () => onchange(i.value, i));
			return app.field(label, i);
		};

		// Course
		const meets = app.select([['A', 'A days'], ['B', 'B days']], c.meetsOn);
		meets.addEventListener('change', () => set((dd) => (dd.course.meetsOn = meets.value)));
		const first = app.select([['A', 'A day'], ['B', 'B day']], c.firstType);
		first.addEventListener('change', () => set((dd) => (dd.course.firstType = first.value)));
		const course = section(
			'Course',
			el(
				'div',
				{ class: 'set-grid' },
				inp('Course name', c.title, 'text', (v) => set((dd) => (dd.course.title = v.trim() || 'Course'))),
				inp('First day of the term', c.termStart, 'date', (v, i) => (S.isDate(v) && v < c.termEnd ? set((dd) => (dd.course.termStart = v)) : (i.value = c.termStart))),
				inp('Last day of the term', c.termEnd, 'date', (v, i) => (S.isDate(v) && v > c.termStart ? set((dd) => (dd.course.termEnd = v)) : (i.value = c.termEnd))),
				app.field('Meets on', meets),
				app.field('First day of the term is', first)
			)
		);

		// Days off
		const breaks = el('div', { class: 'set-list' });
		d.breaks.forEach((b, i) =>
			breaks.append(
				el(
					'div',
					{ class: 'set-line' },
					inp('From', b.start, 'date', (v) => set((dd) => ((dd.breaks[i].start = v), dd.breaks[i].end < v && (dd.breaks[i].end = v)))),
					inp('Through', b.end, 'date', (v) => set((dd) => (dd.breaks[i].end = v < dd.breaks[i].start ? dd.breaks[i].start : v))),
					inp('Note', b.note, 'text', (v) => set((dd) => (dd.breaks[i].note = v.trim())), { placeholder: 'e.g. Thanksgiving break' }),
					el('button', { type: 'button', class: 'link-del', 'aria-label': 'Remove', text: '×', onclick: () => set((dd) => dd.breaks.splice(i, 1)) })
				)
			)
		);
		const daysOff = section(
			'Days off',
			el('p', { class: 'sched-hint', text: 'No class on these dates. The A/B rotation skips them. Single days can also be changed by clicking the Type cell on the calendar.' }),
			breaks,
			app.btn('+ Add days off', () => set((dd) => dd.breaks.push({ id: S.newId('b'), start: dd.course.termStart, end: dd.course.termStart, note: '' })))
		);

		// Goals
		const goals = section(
			'Dashboard goals',
			el('p', { class: 'sched-hint', text: 'How many times each objective should be presented and assessed. 0 = no goal.' }),
			el(
				'div',
				{ class: 'set-grid' },
				CATS.map(([k, t]) => inp(t, d.targets[k], 'number', (v) => set((dd) => (dd.targets[k] = Math.max(0, parseInt(v, 10) || 0))), { min: '0', step: '1' }))
			)
		);

		// Columns
		const typeSet = d.tagSets.find((s) => s.id === 'type') || { tags: [] };
		const cols = el('div', { class: 'set-list' });
		d.columns.forEach((col, i) => {
			const boxes = el(
				'div',
				{ class: 'set-checks' },
				typeSet.tags.map((t) => {
					const cb = el('input', { type: 'checkbox', checked: col.types.includes(t.id) });
					cb.addEventListener('change', () =>
						set((dd) => {
							const cc = dd.columns[i];
							cc.types = cb.checked ? [...cc.types, t.id] : cc.types.filter((x) => x !== t.id);
						})
					);
					return el('label', { class: 'sched-check' }, cb, ' ' + t.label);
				}),
				['formative', 'summative'].map((k) => {
					const cb = el('input', { type: 'checkbox', checked: col.assessment.includes(k) });
					cb.addEventListener('change', () =>
						set((dd) => {
							const cc = dd.columns[i];
							cc.assessment = cb.checked ? [...cc.assessment, k] : cc.assessment.filter((x) => x !== k);
						})
					);
					return el('label', { class: 'sched-check em' }, cb, ` any ${k}`);
				})
			);
			cols.append(
				el(
					'div',
					{ class: 'set-card' },
					el(
						'div',
						{ class: 'set-line' },
						inp('Column title', col.title, 'text', (v) => set((dd) => (dd.columns[i].title = v.trim() || 'Column'))),
						el('span', { class: 'ht-spacer' }),
						app.btn('↑', () => i > 0 && set((dd) => dd.columns.splice(i - 1, 0, dd.columns.splice(i, 1)[0]))),
						app.btn('↓', () => i < d.columns.length - 1 && set((dd) => dd.columns.splice(i + 1, 0, dd.columns.splice(i, 1)[0]))),
						app.btn('Remove', () => set((dd) => dd.columns.splice(i, 1)))
					),
					el('span', { class: 'sched-hint', text: 'Shows activities (not in class) with any of these:' }),
					boxes
				)
			);
		});
		const columns = section(
			'Calendar columns',
			el('p', {
				class: 'sched-hint',
				text: 'After Unit, Topic and In class. An activity goes in the first column that matches it; anything that matches none goes in “Other”.'
			}),
			cols,
			app.btn('+ Add column', () => set((dd) => dd.columns.push({ id: S.newId('col'), title: 'New column', types: [], assessment: [] })))
		);

		// Tags
		const tagsWrap = el('div', { class: 'set-list' });
		d.tagSets.forEach((ts, si) => {
			const rows = el('div', { class: 'set-list' });
			ts.tags.forEach((t, ti) => {
				const color = el('input', { type: 'color', value: t.color || '#6b7280', class: 'ed-color', 'aria-label': 'Color' });
				color.addEventListener('change', () => set((dd) => (dd.tagSets[si].tags[ti].color = color.value)));
				let counts = null;
				if (ts.id === 'type') {
					counts = app.select(S.COUNTS_AS, t.countsAs || 'none', { 'aria-label': 'Counts as' });
					counts.addEventListener('change', () => set((dd) => (dd.tagSets[si].tags[ti].countsAs = counts.value)));
				}
				const used = d.activities.filter((a) => a.tags && a.tags[ts.id] === t.id).length;
				rows.append(
					el(
						'div',
						{ class: 'set-line tag-line' },
						color,
						inp('', t.label, 'text', (v) => set((dd) => (dd.tagSets[si].tags[ti].label = v.trim() || t.label)), { 'aria-label': 'Tag name' }),
						counts ? app.field('', counts) : null,
						el('span', { class: 'sched-hint', text: used ? `${used} use${used > 1 ? 's' : ''}` : '' }),
						el('button', {
							type: 'button',
							class: 'link-del',
							'aria-label': 'Remove tag',
							title: used ? 'Activities using it will lose this tag' : 'Remove',
							text: '×',
							onclick: () =>
								set((dd) => {
									dd.tagSets[si].tags.splice(ti, 1);
									for (const a of dd.activities) if (a.tags && a.tags[ts.id] === t.id) delete a.tags[ts.id];
								})
						})
					)
				);
			});
			tagsWrap.append(
				el(
					'div',
					{ class: 'set-card' },
					el(
						'div',
						{ class: 'set-line' },
						inp('Tag set', ts.name, 'text', (v) => set((dd) => (dd.tagSets[si].name = v.trim() || ts.name))),
						el('span', { class: 'ht-spacer' }),
						ts.id === 'type' ? el('span', { class: 'sched-hint', text: '“Counts as” feeds the dashboard' }) : app.btn('Remove set', () => set((dd) => dd.tagSets.splice(si, 1)))
					),
					rows,
					app.btn('+ Add tag', () =>
						set((dd) => dd.tagSets[si].tags.push({ id: S.newId('tag'), label: 'New tag', color: '#6b7280', countsAs: ts.id === 'type' ? 'practice' : undefined }))
					)
				)
			);
		});
		const tags = section(
			'Tags',
			tagsWrap,
			app.btn('+ Add tag set', () => set((dd) => dd.tagSets.push({ id: S.newId('set'), name: 'New tag set', tags: [] })))
		);

		container.replaceChildren(el('div', { class: 'sched-page settings' }, course, daysOff, goals, columns, tags));
	}

	function section(title, ...kids) {
		return el('section', { class: 'set-section' }, el('h2', { text: title }), ...kids);
	}

	/* Settings and objectives edits shouldn't jump the page to the top: redraw in place. */
	const keepScroll = (fn) => (container, opts) => {
		const y = container.scrollTop;
		fn(container, opts);
		container.scrollTop = y;
	};

	app.views.objectives = { title: 'Objectives', render: keepScroll(renderObjectives) };
	app.views.dashboard = { title: 'Dashboard', render: keepScroll(renderDashboard) };
	app.views.settings = { title: 'Settings', render: keepScroll(renderSettings) };

	app.start();
})();
