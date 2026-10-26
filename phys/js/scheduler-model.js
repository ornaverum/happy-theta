/* Theta Scheduler — data model and pure logic (no DOM).
   Dates are 'YYYY-MM-DD' strings everywhere; arithmetic is done in UTC so daylight saving never shifts a day.
   Works in the browser (HT.sched) and in Node (module.exports) so it can be unit-tested. */
'use strict';

(function (root) {
	const S = {};

	/* ------------------------------------------------------------------ */
	/* Dates                                                               */
	/* ------------------------------------------------------------------ */

	const toUTC = (s) => new Date(s + 'T00:00:00Z');
	const fromUTC = (d) => d.toISOString().slice(0, 10);
	S.addDays = (s, n) => {
		const d = toUTC(s);
		d.setUTCDate(d.getUTCDate() + n);
		return fromUTC(d);
	};
	S.dow = (s) => toUTC(s).getUTCDay(); // 0 = Sunday
	S.isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(toUTC(s));
	S.today = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	};
	S.DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	S.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	S.fmtShort = (s) => `${S.MONTHS[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`;

	S.newId = (p = 'x') => p + '_' + Math.random().toString(36).slice(2, 10);

	/* ------------------------------------------------------------------ */
	/* Defaults                                                            */
	/* ------------------------------------------------------------------ */

	S.COUNTS_AS = [
		['presentation', 'Presentation'],
		['practice', 'Practice'],
		['none', 'Not counted']
	];
	S.ASSESSMENT = [
		['none', 'Not an assessment'],
		['formative', 'Formative'],
		['summative', 'Summative']
	];

	S.defaultTagSets = () => [
		{
			id: 'type',
			name: 'Activity type',
			tags: [
				['lecture', 'Lecture', '#2563eb', 'presentation'],
				['demo', 'Demo', '#0891b2', 'presentation'],
				['reading', 'Reading', '#7c3aed', 'presentation'],
				['video', 'Video', '#9333ea', 'presentation'],
				['lab', 'Lab', '#16a34a', 'practice'],
				['homework', 'Homework', '#ca8a04', 'practice'],
				['practice', 'Practice', '#65a30d', 'practice'],
				['review', 'Review', '#0d9488', 'practice'],
				['project', 'Project', '#c2410c', 'practice'],
				['quiz', 'Quiz', '#db2777', 'none'],
				['exam', 'Exam', '#b91c1c', 'none']
			].map(([id, label, color, countsAs]) => ({ id, label, color, countsAs }))
		},
		{
			id: 'interaction',
			name: 'Student interaction',
			tags: [
				['individual', 'Individual'],
				['pairs', 'Pairs'],
				['small-group', 'Small group'],
				['whole-class', 'Whole class']
			].map(([id, label]) => ({ id, label, color: '#6b7280' }))
		}
	];

	/* Choosing one of these types pre-fills the assessment field (the teacher can change it). */
	S.ASSESSMENT_HINT = { quiz: 'formative', exam: 'summative' };

	S.defaultColumns = () => [
		{ id: 'col-hw', title: 'Homework', types: ['homework', 'reading', 'video', 'practice'], assessment: [] },
		{ id: 'col-assess', title: 'Assessments', types: ['quiz', 'exam'], assessment: ['formative', 'summative'] },
		{ id: 'col-proj', title: 'Projects & labs', types: ['project', 'lab'], assessment: [] }
	];

	S.newCourse = function ({ title = 'New course', termStart, termEnd, semester2Start = null, meetsOn = 'A', firstType = 'A', classMinutes = 50, rules, seed } = {}) {
		const y = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
		const ts = termStart || `${y}-08-13`;
		const data = {
			course: {
				title,
				termStart: ts,
				termEnd: termEnd || `${y + 1}-05-21`,
				semester2Start, // optional; splits the year into two semesters
				meetsOn,
				classMinutes,
				rules: rules || [S.rotationRule(null, firstType)] // how each weekday becomes A, B or no class
			},
			breaks: [], // [{id, start, end, note}] — no class on these dates
			overrides: {}, // { 'YYYY-MM-DD': { type: 'A'|'B'|'none', note, minutes } }
			units: [],
			topics: [],
			activities: [], // start === null → in the activity bank
			columns: S.defaultColumns(),
			tagSets: S.defaultTagSets(),
			objectiveTrees: [],
			suggestedSkills: {},
			targets: { presentation: 2, formative: 2, summative: 1 }
		};
		if (seed) S.applySeed(data, seed);
		return data;
	};

	/* Copy an objectives seed (trees, suggested skills, activity bank) into a course. */
	S.applySeed = function (data, seed) {
		const d = seed.data || seed;
		data.objectiveTrees = JSON.parse(JSON.stringify(d.objectiveTrees || []));
		for (const t of data.objectiveTrees) for (const n of t.nodes) n.hidden = !!n.hidden;
		data.suggestedSkills = JSON.parse(JSON.stringify(d.suggestedSkills || {}));
		for (const a of d.activityBank || []) {
			data.activities.push(
				S.newActivity({
					title: a.code ? `${a.code} ${a.title}` : a.title,
					tags: a.tags || {},
					assessment: a.assessment || 'none',
					objectiveIds: a.objectiveIds || [],
					start: null
				})
			);
		}
		return data;
	};

	S.newActivity = (o = {}) => ({
		id: S.newId('a'),
		title: 'New activity',
		start: null,
		end: null,
		time: '',
		expectedMin: null,
		inClass: false,
		tags: {},
		assessment: 'none',
		objectiveIds: [],
		links: [],
		notes: '',
		pinned: false, // keep on its date when catching up or applying a template
		...o
	});

	/* ------------------------------------------------------------------ */
	/* Days: A / B / No class                                              */
	/* ------------------------------------------------------------------ */

	/* Schedule rules, Google-Calendar style. Each rule:
	     { id, type: 'A'|'B'|'none'|'AB', days: [1..5], every: N (weeks), from, until, first: 'A'|'B', by: 'meeting'|'week', minutes }
	   - A / B / none: applies on those weekdays every N weeks, counting weeks from the week of `from`.
	   - AB alternates, starting with `first`: by 'meeting' it switches every time the rule applies to a
	     school day (a day off doesn't count, so the alternation just continues); by 'week' it switches
	     every calendar week, so all its weekdays in one week share a letter.
	   Later rules win where rules overlap. `minutes` (optional) is the class length on those days. */
	S.DOW_LETTER = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
	S.RULE_TYPES = [
		['A', 'A day'],
		['B', 'B day'],
		['AB', 'Alternating A / B'],
		['none', 'No class']
	];

	S.newRule = (o = {}) => ({ id: S.newId('r'), type: 'A', days: [], every: 1, from: null, until: null, first: 'A', by: 'meeting', minutes: null, ...o });

	/* The old behavior: every school day alternates A, B, A, B… */
	S.rotationRule = (from, first = 'A') => S.newRule({ type: 'AB', days: [1, 2, 3, 4, 5], from, first, by: 'meeting' });

	/* Monday of the week a date is in */
	const weekStart = (s) => S.addDays(s, -((S.dow(s) + 6) % 7));
	const weeksBetween = (a, b) => Math.round((toUTC(weekStart(b)) - toUTC(weekStart(a))) / (7 * 864e5));
	S.firstOnOrAfter = (from, dow) => S.addDays(from, (dow - S.dow(from) + 7) % 7);

	/* Quick weekly pattern → rules.  pattern = { 1: 'A'|'B'|'none'|'AB-A'|'AB-B', 2: …, … 5: … } */
	S.QUICK = [
		['A', 'A day'],
		['B', 'B day'],
		['AB-A', 'Alternates A, B, A…'],
		['AB-B', 'Alternates B, A, B…'],
		['none', 'No class']
	];
	S.rulesFromPattern = function (pattern, from, { by = 'meeting', minutes = {} } = {}) {
		const groups = new Map();
		for (let d = 1; d <= 5; d++) {
			const v = pattern[d] || 'none';
			const key = v + '|' + (minutes[d] || '');
			if (!groups.has(key)) groups.set(key, { v, days: [], minutes: minutes[d] || null });
			groups.get(key).days.push(d);
		}
		const rules = [];
		for (const g of groups.values()) {
			if (g.v.startsWith('AB')) {
				// alternating weekdays each get their own rule so each keeps its own A/B sequence
				for (const d of g.days) rules.push(S.newRule({ type: 'AB', first: g.v.slice(3), days: [d], from, by, minutes: g.minutes }));
			} else rules.push(S.newRule({ type: g.v, days: g.days, from, minutes: g.minutes }));
		}
		return rules;
	};

	/* Best guess at a simple weekly pattern from rules (for pre-filling the quick picker) */
	S.patternFromRules = function (rules) {
		const p = {};
		for (let dw = 1; dw <= 5; dw++) {
			const r = [...(rules || [])].reverse().find((x) => x.days.includes(dw) && !x.until && (x.every || 1) === 1);
			p[dw] = !r ? 'none' : r.type === 'AB' ? (r.days.length > 1 ? 'AB-' + (r.first || 'A') : 'AB-' + (r.first || 'A')) : r.type;
		}
		return p;
	};
	/* True when the rules are the old "every school day alternates" rotation */
	S.isRotation = (rules) => rules.length === 1 && rules[0].type === 'AB' && rules[0].days.length === 5 && rules[0].by !== 'week' && !rules[0].until;

	/* Plain-language summary, e.g. "A day · every week on Tu, Th" */
	S.describeRule = function (r) {
		const days = [...r.days].sort().map((d) => S.DOW_LETTER[d]).join(', ') || 'no days';
		const range = (r.from ? ` from ${S.fmtShort(r.from)}` : '') + (r.until ? ` until ${S.fmtShort(r.until)}` : '');
		const len = r.minutes ? ` · ${r.minutes} min` : '';
		if (r.type === 'AB') {
			const how = r.by === 'week' ? 'switching every week' : 'switching each time it meets';
			return `Alternating A/B on ${days}, starting with ${r.first || 'A'}, ${how}${range}${len}`;
		}
		const label = { A: 'A day', B: 'B day', none: 'No class' }[r.type] || r.type;
		const every = (r.every || 1) > 1 ? `every ${r.every} weeks` : 'every week';
		return `${label} · ${every} on ${days}${range}${len}`;
	};

	/* Week counting starts at the first week the rule actually applies in (so "every 2 weeks" and
	   "alternating by week, A first" both start on the rule's first real day). */
	const firstHit = (r, termStart) => {
		const from = r.from || termStart;
		return r.days.map((dw) => S.firstOnOrAfter(from, dw)).sort()[0] || from;
	};

	/* Does the rule apply on this date (ignoring days off)? */
	function ruleHits(r, d, dw, termStart) {
		if (!r.days || !r.days.includes(dw)) return false;
		const from = r.from || termStart;
		if (d < from || (r.until && d > r.until)) return false;
		if (r.type !== 'AB' && (r.every || 1) > 1 && weeksBetween(firstHit(r, termStart), d) % r.every !== 0) return false;
		return true;
	}

	/* Every weekday of the term, in order:
	   { date, dow, type: 'A'|'B'|'none', note, meet, school, minutes, why }
	   Per-date overrides win, then days off, then the last matching rule. Weekdays no rule covers have no class. */
	S.genDays = function (data) {
		const c = data.course;
		const out = [];
		if (!S.isDate(c.termStart) || !S.isDate(c.termEnd) || c.termEnd < c.termStart) return out;
		const rules = (c.rules || []).filter((r) => r && r.days && r.days.length);
		const count = new Map(rules.map((r) => [r.id, 0])); // AB-by-meeting position
		const breaks = (data.breaks || []).filter((b) => S.isDate(b.start));
		for (let d = c.termStart, guard = 0; d <= c.termEnd && guard < 800; d = S.addDays(d, 1), guard++) {
			const dw = S.dow(d);
			if (dw === 0 || dw === 6) continue;
			const ov = (data.overrides || {})[d];
			const br = breaks.find((b) => d >= b.start && d <= (b.end || b.start));
			let rule = null;
			for (let i = rules.length - 1; i >= 0; i--)
				if (ruleHits(rules[i], d, dw, c.termStart)) {
					rule = rules[i];
					break;
				}
			let type,
				why;
			const flip = (t) => (t === 'A' ? 'B' : 'A');
			if (ov && ov.type) {
				type = ov.type;
				why = 'changed for this day';
				// an alternating rule carries on from a forced A/B
				if (rule && rule.type === 'AB' && rule.by !== 'week' && type !== 'none') {
					const first = rule.first || 'A';
					count.set(rule.id, type === first ? 1 : 0);
				}
			} else if (br) {
				type = 'none';
				why = 'day off';
			} else if (!rule) {
				type = 'none';
				why = 'no rule covers this day';
			} else if (rule.type === 'AB') {
				const first = rule.first || 'A';
				if (rule.by === 'week') type = weeksBetween(firstHit(rule, c.termStart), d) % 2 === 0 ? first : flip(first);
				else {
					const k = count.get(rule.id);
					type = k % 2 === 0 ? first : flip(first);
					count.set(rule.id, k + 1);
				}
				why = S.describeRule(rule);
			} else {
				type = rule.type;
				why = S.describeRule(rule);
			}
			const minutes = (ov && ov.minutes) || (rule && rule.minutes) || c.classMinutes || null;
			out.push({
				date: d,
				dow: dw,
				type,
				note: (ov && ov.note) || (br && br.note) || '',
				school: type !== 'none',
				meet: type === c.meetsOn,
				minutes: type === c.meetsOn ? minutes : null,
				why
			});
		}
		return out;
	};

	/* Planned in-class minutes per meeting date. An in-class activity's expected time is spread evenly
	   over the meetings it spans. Returns Map date -> minutes. */
	S.plannedMinutes = function (data, days) {
		const meets = days.filter((d) => d.meet).map((d) => d.date);
		const m = new Map();
		for (const a of data.activities) {
			if (!a.inClass || !a.start || !a.expectedMin) continue;
			const end = a.end && a.end >= a.start ? a.end : a.start;
			const span = meets.filter((d) => d >= a.start && d <= end);
			for (const d of span) m.set(d, (m.get(d) || 0) + a.expectedMin / span.length);
		}
		return m;
	};

	/* Meetings and class minutes between two dates (for unit/topic summaries) */
	S.meetingsBetween = function (days, start, end) {
		const list = days.filter((d) => d.meet && d.date >= start && d.date <= (end || start));
		return { meetings: list.length, minutes: list.reduce((s, d) => s + (d.minutes || 0), 0) };
	};

	/* ------------------------------------------------------------------ */
	/* Row lookup                                                          */
	/* ------------------------------------------------------------------ */

	/* First index with rows[i].date >= d (rows.length if none). */
	S.lowerBound = function (rows, d) {
		let lo = 0,
			hi = rows.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (rows[mid].date < d) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	};

	/* Visible row span for an item, or null if it falls outside the rows. */
	S.rowSpan = function (rows, start, end) {
		if (!start || !rows.length) return null;
		const e = end && end >= start ? end : start;
		const a = S.lowerBound(rows, start);
		if (a >= rows.length) return null;
		let b = S.lowerBound(rows, e);
		if (b >= rows.length || rows[b].date > e) b -= 1;
		if (b < a) b = a; // the whole item sits on hidden days: show it on the next visible row
		return { a, b };
	};

	/* ------------------------------------------------------------------ */
	/* Lane packing for overlapping blocks in one column                   */
	/* items: [{ a, b, ... }] (row span). Sets item.lane and item.width;   */
	/* returns the number of lanes the column needs.                        */
	/* ------------------------------------------------------------------ */

	S.pack = function (items) {
		items.sort((p, q) => p.a - q.a || q.b - q.a - (p.b - p.a));
		const laneEnd = [];
		for (const it of items) {
			let l = laneEnd.findIndex((end) => end < it.a);
			if (l < 0) l = laneEnd.length;
			laneEnd[l] = it.b;
			it.lane = l;
		}
		const lanes = Math.max(1, laneEnd.length);
		for (const it of items) {
			let w = 1;
			while (it.lane + w < lanes && !items.some((o) => o !== it && o.lane === it.lane + w && o.a <= it.b && o.b >= it.a)) w++;
			it.width = w;
		}
		return lanes;
	};

	/* ------------------------------------------------------------------ */
	/* Which calendar column an activity goes in                           */
	/* ------------------------------------------------------------------ */

	S.columnFor = function (data, act) {
		if (act.inClass) return 'inclass';
		const type = act.tags && act.tags.type;
		for (const col of data.columns) {
			if ((type && col.types.includes(type)) || (act.assessment !== 'none' && col.assessment.includes(act.assessment))) return col.id;
		}
		return 'other';
	};

	/* ------------------------------------------------------------------ */
	/* Shift: move everything on/after a date by N class meetings          */
	/* ------------------------------------------------------------------ */

	S.shift = function (data, fromDate, n) {
		const days = S.genDays(data);
		const school = days.filter((d) => d.school).map((d) => d.date);
		const meets = days.filter((d) => d.meet).map((d) => d.date);
		if (!school.length || !meets.length || !n) return 0;
		const idx = (list, d) => S.lowerBound(list.map((x) => ({ date: x })), d);
		const i = Math.min(idx(meets, fromDate), meets.length - 1);
		const j = Math.max(0, Math.min(meets.length - 1, i + n));
		const delta = idx(school, meets[j]) - idx(school, meets[i]); // in school days
		const move = (d) => {
			if (!d || d < fromDate) return d;
			const k = idx(school, d);
			const t = Math.max(0, Math.min(school.length - 1, k + delta));
			return school[t];
		};
		let count = 0;
		for (const it of [...data.units, ...data.topics, ...data.activities]) {
			if (!it.start) continue;
			const s = move(it.start),
				e = move(it.end);
			if (s !== it.start || e !== it.end) count++;
			it.start = s;
			it.end = e && e < s ? s : e;
		}
		return count;
	};

	/* ------------------------------------------------------------------ */
	/* Draft plan: lay framework units end to end on meeting days          */
	/* ------------------------------------------------------------------ */

	S.UNIT_COLORS = ['#dbeafe', '#dcfce7', '#fef9c3', '#fce7f3', '#ede9fe', '#ffedd5', '#cffafe', '#e0e7ff', '#f1f5f9'];

	S.draftPlan = function (data, tree, fromDate) {
		const meets = S.genDays(data)
			.filter((d) => d.meet && d.date >= fromDate)
			.map((d) => d.date);
		const roots = tree.nodes.filter((n) => !n.parentId && !n.hidden).sort((a, b) => a.order - b.order);
		const kids = (id) => tree.nodes.filter((n) => n.parentId === id && !n.hidden).sort((a, b) => a.order - b.order);
		let k = 0;
		const units = [],
			topics = [];
		roots.forEach((u, ui) => {
			const m = Math.max(1, (u.meta && u.meta.durationMeetings) || kids(u.id).length || 1);
			if (k >= meets.length) return;
			const slice = meets.slice(k, k + m);
			k += m;
			const unit = {
				id: S.newId('u'),
				title: `Unit ${u.code}: ${u.text}`,
				start: slice[0],
				end: slice[slice.length - 1],
				color: S.UNIT_COLORS[ui % S.UNIT_COLORS.length],
				objectiveId: u.id
			};
			units.push(unit);
			const ts = kids(u.id);
			ts.forEach((t, ti) => {
				const a = Math.floor((ti * slice.length) / ts.length);
				const b = Math.max(a, Math.floor(((ti + 1) * slice.length) / ts.length) - 1);
				topics.push({ id: S.newId('t'), unitId: unit.id, title: `${t.code} ${t.text}`, start: slice[a], end: slice[b], objectiveId: t.id });
			});
		});
		data.units = units;
		data.topics = topics;
		return { units: units.length, topics: topics.length, overflow: k > meets.length };
	};

	/* ------------------------------------------------------------------ */
	/* Objective trees                                                     */
	/* ------------------------------------------------------------------ */

	S.treeIndex = function (tree) {
		const byId = new Map(tree.nodes.map((n) => [n.id, n]));
		const children = new Map();
		for (const n of tree.nodes) {
			const k = n.parentId || null;
			if (!children.has(k)) children.set(k, []);
			children.get(k).push(n);
		}
		for (const list of children.values()) list.sort((a, b) => a.order - b.order);
		const depth = (n) => {
			let d = 0;
			for (let p = n; p.parentId && byId.has(p.parentId); p = byId.get(p.parentId)) d++;
			return d;
		};
		const kids = (id) => children.get(id || null) || [];
		const ancestors = (id) => {
			const out = [];
			for (let n = byId.get(id); n && n.parentId; n = byId.get(n.parentId)) out.push(n.parentId);
			return out;
		};
		const descendants = (id) => {
			const out = [];
			const walk = (i) => kids(i).forEach((c) => (out.push(c.id), walk(c.id)));
			walk(id);
			return out;
		};
		/* Depth-first order, for outlines */
		const flat = () => {
			const out = [];
			const walk = (pid) => kids(pid).forEach((n) => (out.push(n), walk(n.id)));
			walk(null);
			return out;
		};
		return { byId, kids, depth, ancestors, descendants, flat };
	};

	/* Level of a node for labels and the dashboard. Trees whose nodes have a `kind` (unit, topic, subtopic,
	   lo, ek, detail) use tree.kindLevels, so a topic's objectives line up whether or not it has subtopics;
	   other trees just use depth. */
	S.rankOf = function (tree, n, ix) {
		if (n.kind && tree.kindLevels && tree.kindLevels[n.kind] !== undefined) return tree.kindLevels[n.kind];
		return ix.depth(n);
	};

	S.findNode = function (data, id) {
		for (const t of data.objectiveTrees) {
			const n = t.nodes.find((x) => x.id === id);
			if (n) return { tree: t, node: n };
		}
		return null;
	};

	/* The objective (topic node) a date falls under, via the calendar's topic blocks */
	S.topicAt = function (data, date) {
		return data.topics.find((t) => t.start && t.start <= date && (t.end || t.start) >= date) || null;
	};

	/* ------------------------------------------------------------------ */
	/* Coverage for the content-map dashboard                              */
	/* ------------------------------------------------------------------ */

	S.categories = function (data, act) {
		const typeSet = data.tagSets.find((s) => s.id === 'type');
		const tag = typeSet && act.tags && typeSet.tags.find((t) => t.id === act.tags.type);
		return {
			presentation: !!(tag && tag.countsAs === 'presentation'),
			formative: act.assessment === 'formative',
			summative: act.assessment === 'summative'
		};
	};

	/* Returns Map nodeId -> { direct: {cat: Set(actId)}, via: {cat: Set(actId)} }
	   direct = activities linked to the node or anything under it.
	   via    = activities linked only to an ancestor (shown lighter). */
	S.coverage = function (data, tree, { asOf } = {}) {
		const ix = S.treeIndex(tree);
		const cats = ['presentation', 'formative', 'summative'];
		const blank = () => ({ presentation: new Set(), formative: new Set(), summative: new Set() });
		const cov = new Map(tree.nodes.map((n) => [n.id, { direct: blank(), via: blank() }]));
		for (const a of data.activities) {
			if (!a.start) continue; // still in the bank
			if (asOf && a.start > asOf) continue;
			const c = S.categories(data, a);
			for (const id of a.objectiveIds || []) {
				if (!cov.has(id)) continue;
				for (const k of cats) {
					if (!c[k]) continue;
					cov.get(id).direct[k].add(a.id);
					for (const anc of ix.ancestors(id)) cov.get(anc).direct[k].add(a.id);
					for (const d of ix.descendants(id)) cov.get(d).via[k].add(a.id);
				}
			}
		}
		for (const v of cov.values()) for (const k of cats) for (const id of v.direct[k]) v.via[k].delete(id);
		return cov;
	};

	/* ------------------------------------------------------------------ */
	/* Loading: fill in anything an older or hand-made file lacks          */
	/* ------------------------------------------------------------------ */

	S.normalize = function (data) {
		const base = S.newCourse();
		const out = Object.assign(S.newCourse(), data || {});
		out.course = Object.assign(base.course, (data && data.course) || {});
		if (!Array.isArray(out.course.rules) || !(data && data.course && data.course.rules)) {
			// courses saved before schedule rules: every school day alternated, starting with firstType
			if (!(data && data.course && Array.isArray(data.course.rules))) out.course.rules = [S.rotationRule(null, (data && data.course && data.course.firstType) || 'A')];
		}
		delete out.course.firstType;
		out.course.rules = out.course.rules.map((r) => S.newRule(r));
		if (!out.overrides || typeof out.overrides !== 'object') out.overrides = {};
		if (!out.suggestedSkills || typeof out.suggestedSkills !== 'object') out.suggestedSkills = {};
		out.targets = Object.assign({}, base.targets, out.targets || {});
		for (const k of ['breaks', 'units', 'topics', 'activities', 'columns', 'tagSets', 'objectiveTrees']) if (!Array.isArray(out[k])) out[k] = base[k];
		out.activities = out.activities.map((a) => Object.assign(S.newActivity(), a));
		for (const col of out.columns) {
			col.types = col.types || [];
			col.assessment = col.assessment || [];
		}
		return out;
	};

	if (typeof module !== 'undefined' && module.exports) module.exports = S;
	else root.HT.sched = S;
})(typeof window !== 'undefined' ? window : globalThis);
