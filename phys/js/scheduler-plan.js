/* Theta Scheduler — planning helpers: semesters, holiday suggestions, spreading topics over class
   meetings, templates (save a course's plan, lay it out again in another year), and catch-up.
   Pure logic like scheduler-model.js; works in the browser (HT.sched.plan) and in Node. */
'use strict';

(function (root) {
	const S = typeof module !== 'undefined' && module.exports ? require('./scheduler-model.js') : root.HT.sched;
	const P = {};

	const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
	const toWeekday = (d) => {
		const w = S.dow(d);
		return w === 6 ? S.addDays(d, 2) : w === 0 ? S.addDays(d, 1) : d;
	};

	/* ------------------------------------------------------------------ */
	/* Semesters                                                           */
	/* ------------------------------------------------------------------ */

	/* A sensible second-semester start: the first Monday on or after Jan 4 inside the term */
	P.suggestSemester2 = function (termStart, termEnd) {
		const y = +termStart.slice(0, 4) + (termStart.slice(5, 7) >= '07' ? 1 : 0);
		const d = S.firstOnOrAfter(`${y}-01-04`, 1);
		return d > termStart && d < termEnd ? d : null;
	};

	/* Whole year, plus the two semesters when a second-semester date is set */
	P.ranges = function (data) {
		const c = data.course;
		const out = [{ id: 'year', name: 'Whole year', start: c.termStart, end: c.termEnd }];
		const s2 = c.semester2Start;
		if (S.isDate(s2) && s2 > c.termStart && s2 <= c.termEnd) {
			out.push({ id: 's1', name: 'Semester 1', start: c.termStart, end: S.addDays(s2, -1) });
			out.push({ id: 's2', name: 'Semester 2', start: s2, end: c.termEnd });
		}
		return out;
	};
	P.rangeAt = (data, date) => {
		const r = P.ranges(data);
		return r.slice(1).find((x) => date >= x.start && date <= x.end) || r[0];
	};

	/* ------------------------------------------------------------------ */
	/* Common US school holidays (suggestions only — districts differ)     */
	/* ------------------------------------------------------------------ */

	const nth = (y, m, dow, n) => S.addDays(S.firstOnOrAfter(`${y}-${String(m).padStart(2, '0')}-01`, dow), 7 * (n - 1));
	P.suggestHolidays = function (termStart, termEnd) {
		const y1 = +termStart.slice(0, 4) - (termStart.slice(5, 7) < '07' ? 1 : 0);
		const y2 = y1 + 1;
		const thanks = nth(y1, 11, 4, 4);
		const winterStart = S.addDays(`${y1}-12-22`, -((S.dow(`${y1}-12-22`) + 6) % 7)); // Monday of that week
		const winterEnd = S.firstOnOrAfter(`${y2}-01-01`, 5);
		const spring = nth(y2, 3, 1, 3);
		const list = [
			{ note: 'Labor Day', start: nth(y1, 9, 1, 1) },
			{ note: 'Thanksgiving break', start: S.addDays(thanks, -1), end: S.addDays(thanks, 1) },
			{ note: 'Winter break', start: winterStart, end: winterEnd },
			{ note: 'Martin Luther King Jr. Day', start: nth(y2, 1, 1, 3) },
			{ note: 'Presidents’ Day', start: nth(y2, 2, 1, 3) },
			{ note: 'Spring break', start: spring, end: S.addDays(spring, 4) }
		];
		return list
			.map((h) => ({ id: S.newId('b'), start: h.start, end: h.end || h.start, note: h.note, suggested: true }))
			.filter((h) => h.end >= termStart && h.start <= termEnd);
	};

	/* ------------------------------------------------------------------ */
	/* Spreading items over meetings                                       */
	/* ------------------------------------------------------------------ */

	/* Split M meetings among items in proportion to their weights.
	   Returns [{a, b}] — inclusive meeting indices 0..M-1, in order, covering every meeting.
	   Every item gets at least one meeting when there are enough; otherwise items share meetings. */
	P.allocate = function (weights, M) {
		const n = weights.length;
		if (!n || M <= 0) return [];
		if (M < n) return weights.map((_, i) => ({ a: Math.floor((i * M) / n), b: Math.max(Math.floor((i * M) / n), Math.floor(((i + 1) * M) / n) - 1) }));
		const w = weights.map((x) => (x > 0 ? x : 1));
		const total = w.reduce((s, x) => s + x, 0);
		const ideal = w.map((x) => (x / total) * M);
		const q = ideal.map((x) => Math.max(1, Math.floor(x)));
		let diff = M - q.reduce((s, x) => s + x, 0);
		while (diff > 0) {
			let best = 0;
			for (let i = 1; i < n; i++) if (ideal[i] - q[i] > ideal[best] - q[best]) best = i;
			q[best]++;
			diff--;
		}
		while (diff < 0) {
			let best = -1;
			for (let i = 0; i < n; i++) if (q[i] > 1 && (best < 0 || ideal[i] - q[i] < ideal[best] - q[best])) best = i;
			if (best < 0) break;
			q[best]--;
			diff++;
		}
		let k = 0;
		return q.map((c) => {
			const r = { a: k, b: k + c - 1 };
			k += c;
			return r;
		});
	};

	/* ------------------------------------------------------------------ */
	/* Anchoring activities to topics                                      */
	/*   An activity remembers where it sits relative to a topic, in class */
	/*   meetings, so it can move when the topic moves or stretches.       */
	/* ------------------------------------------------------------------ */

	/* Position of a date in a list of meeting dates: the last meeting on/before it, plus extra calendar days */
	const pos = (meets, d) => {
		let i = S.lowerBound(meets.map((x) => ({ date: x })), d);
		if (i >= meets.length || meets[i] > d) i -= 1;
		if (i < 0) return { i: 0, delta: daysBetween(meets[0], d) };
		return { i, delta: daysBetween(meets[i], d) };
	};

	/* Meeting-index range of an item with start/end in a meeting list */
	P.span = function (meets, start, end) {
		const lb = (d) => S.lowerBound(meets.map((x) => ({ date: x })), d);
		const a = lb(start);
		let b = lb(end || start);
		if (b >= meets.length || meets[b] > (end || start)) b -= 1;
		return { a: Math.min(a, meets.length - 1), b: Math.max(Math.min(a, meets.length - 1), b) };
	};

	/* Which topic an activity belongs to: one whose framework objective covers the activity's objectives
	   (latest such topic on or before the activity), else the topic it falls in, else the one before it. */
	P.pickTopic = function (act, topics, data) {
		if (!topics.length || !act.start) return null;
		const tree = data.objectiveTrees && data.objectiveTrees[0];
		let cand = topics;
		if (tree && (act.objectiveIds || []).length) {
			const ix = S.treeIndex(tree);
			const covered = new Set();
			for (const id of act.objectiveIds) [id, ...ix.ancestors(id)].forEach((x) => covered.add(x));
			const m = topics.filter((t) => t.objectiveId && covered.has(t.objectiveId));
			if (m.length) cand = m;
		}
		const inside = cand.filter((t) => t.start <= act.start && (t.end || t.start) >= act.start);
		if (inside.length) return inside[inside.length - 1];
		const before = cand.filter((t) => t.start <= act.start);
		return before.length ? before[before.length - 1] : cand[0];
	};

	/* anchor = { topic, side: 'in'|'end'|'start', frac|off, delta, spanM, endDelta } */
	P.anchor = function (act, topic, tspan, meets) {
		const p = pos(meets, act.start);
		const pe = pos(meets, act.end && act.end >= act.start ? act.end : act.start);
		const a = { topic, delta: p.delta, spanM: pe.i - p.i, endDelta: pe.delta };
		const len = tspan.b - tspan.a + 1;
		if (p.i > tspan.b) Object.assign(a, { side: 'end', off: p.i - tspan.b });
		else if (p.i < tspan.a) Object.assign(a, { side: 'start', off: p.i - tspan.a });
		else Object.assign(a, { side: 'in', frac: (p.i - tspan.a) / len });
		return a;
	};

	/* Dates for an anchor once its topic occupies meetings ns.a..ns.b of `meets` (old length oldLen) */
	P.place = function (an, ns, meets, oldLen) {
		const last = meets.length - 1;
		const len = ns.b - ns.a + 1;
		let i;
		if (an.side === 'in') i = ns.a + Math.min(len - 1, Math.floor(an.frac * len + 1e-9));
		else if (an.side === 'end') i = ns.b + an.off;
		else i = ns.a + an.off;
		i = Math.max(0, Math.min(last, i));
		const scale = an.side === 'in' && oldLen ? len / oldLen : 1;
		const j = Math.max(i, Math.min(last, i + Math.round(an.spanM * scale)));
		const start = toWeekday(S.addDays(meets[i], an.delta));
		let end = toWeekday(S.addDays(meets[j], an.endDelta));
		if (end < start) end = start;
		return { start, end };
	};

	/* Units with topics stretch to cover them */
	function fitUnits(data) {
		for (const u of data.units) {
			const ts = data.topics.filter((t) => t.unitId === u.id && t.start);
			if (!ts.length) continue;
			u.start = ts.map((t) => t.start).sort()[0];
			u.end = ts.map((t) => t.end || t.start).sort().pop();
		}
	}

	const ordered = (topics) => topics.filter((t) => t.start).sort((a, b) => a.start.localeCompare(b.start) || (a.end || '').localeCompare(b.end || '') || a.title.localeCompare(b.title, undefined, { numeric: true }));
	const meetDates = (data, days = S.genDays(data)) => days.filter((d) => d.meet).map((d) => d.date);

	/* ------------------------------------------------------------------ */
	/* Templates                                                           */
	/* ------------------------------------------------------------------ */

	const ACT_FIELDS = ['title', 'time', 'expectedMin', 'inClass', 'tags', 'assessment', 'objectiveIds', 'links', 'notes', 'pinned'];
	const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, JSON.parse(JSON.stringify(o[k]))]));

	/* Save a course's plan: units, topics (with their length in meetings) and activities placed relative to topics */
	P.makeTemplate = function (data, name) {
		const meets = meetDates(data);
		const topics = ordered(data.topics);
		const unitKey = new Map(data.units.map((u, i) => [u.id, 'u' + i]));
		const spans = new Map(topics.map((t) => [t.id, P.span(meets, t.start, t.end)]));
		const tpl = {
			name: name || data.course.title,
			fromCourse: data.course.title,
			classMinutes: data.course.classMinutes || null,
			units: [...data.units].sort((a, b) => (a.start || '').localeCompare(b.start || '')).map((u) => ({ key: unitKey.get(u.id), title: u.title, color: u.color, objectiveId: u.objectiveId || null, meetings: u.start ? (() => { const s = P.span(meets, u.start, u.end); return s.b - s.a + 1; })() : 1 })),
			topics: topics.map((t, i) => {
				const s = spans.get(t.id);
				return { key: 't' + i, unitKey: unitKey.get(t.unitId) || null, title: t.title, objectiveId: t.objectiveId || null, meetings: s.b - s.a + 1 };
			}),
			activities: []
		};
		const keyOf = new Map(topics.map((t, i) => [t.id, 't' + i]));
		for (const a of data.activities) {
			const base = pick(a, ACT_FIELDS);
			if (!a.start) {
				tpl.activities.push({ ...base, anchor: null });
				continue;
			}
			const t = P.pickTopic(a, topics, data);
			if (!t) {
				tpl.activities.push({ ...base, anchor: null });
				continue;
			}
			const an = P.anchor(a, t, spans.get(t.id), meets);
			delete an.topic;
			tpl.activities.push({ ...base, pinned: undefined, anchor: { ...an, topicKey: keyOf.get(t.id) } });
		}
		return tpl;
	};

	/* Built-in template from an objectives seed: framework units at their usual lengths, topics splitting
	   each unit evenly, and each quiz at the end of the last topic it covers. */
	P.templateFromSeed = function (seed) {
		const d = seed.data || seed;
		const tree = d.objectiveTrees[0];
		const ix = S.treeIndex(tree);
		const tpl = { name: seed.title + ' — framework order', seedId: seed.id, units: [], topics: [], activities: [] };
		const topicKeyByNode = new Map();
		ix.kids(null).forEach((u, ui) => {
			const kids = ix.kids(u.id);
			const m = (u.meta && u.meta.durationMeetings) || kids.length || 1;
			tpl.units.push({ key: 'u' + ui, title: `Unit ${u.code}: ${u.text}`, color: S.UNIT_COLORS[ui % S.UNIT_COLORS.length], objectiveId: u.id, meetings: m });
			kids.forEach((t) => {
				const key = 't' + tpl.topics.length;
				topicKeyByNode.set(t.id, key);
				tpl.topics.push({ key, unitKey: 'u' + ui, title: `${t.code} ${t.text}`, objectiveId: t.id, meetings: m / kids.length });
			});
		});
		const order = ix.flat().map((n) => n.id);
		for (const q of d.activityBank || []) {
			const topicsOf = (q.objectiveIds || []).map((id) => [id, ...ix.ancestors(id)].find((x) => topicKeyByNode.has(x))).filter(Boolean);
			const last = topicsOf.sort((a, b) => order.indexOf(a) - order.indexOf(b)).pop();
			const base = { title: q.code ? `${q.code} ${q.title}` : q.title, tags: q.tags || {}, assessment: q.assessment || 'none', objectiveIds: q.objectiveIds || [], inClass: false };
			tpl.activities.push({ ...base, anchor: last ? { topicKey: topicKeyByNode.get(last), side: 'end', off: 0, delta: 0, spanM: 0, endDelta: 0 } : null });
		}
		return tpl;
	};

	/* Lay a template over [from, to].
	   opts: { from, to, unitKeys (null = all), replace (true: clear units/topics/unpinned activities that
	   start in the range first), fit (true: stretch/shrink to fill the range; false: template lengths, in order) } */
	P.applyTemplate = function (data, tpl, opts) {
		const { from, to, replace = true, fit = true } = opts;
		const meets = meetDates(data);

		const wanted = opts.unitKeys ? new Set(opts.unitKeys) : null;
		const units = tpl.units.filter((u) => !wanted || wanted.has(u.key));
		const unitSet = new Set(units.map((u) => u.key));
		const items = [];
		for (const u of units) {
			const ts = tpl.topics.filter((t) => t.unitKey === u.key);
			if (ts.length) ts.forEach((t) => items.push({ kind: 'topic', t, unit: u }));
			else items.push({ kind: 'unit', unit: u });
		}
		for (const t of tpl.topics) if (!t.unitKey || (!tpl.units.some((u) => u.key === t.unitKey) && !wanted)) items.push({ kind: 'topic', t, unit: null });
		if (!items.length) return { error: 'Nothing to place: pick at least one unit.' };

		// Replacing: clear what's in the range, except topics of units the template isn't laying out here
		// (e.g. the end of a unit that started last semester) — the layout then starts after those.
		let start = from;
		let kept = 0;
		if (replace) {
			const inRange = (x) => x.start && x.start >= from && x.start <= to;
			const id = (x) => x.objectiveId || x.title;
			const tplUnitIds = new Set(units.map(id));
			const tplTopicIds = new Set(items.filter((it) => it.kind === 'topic').map((it) => id(it.t)));
			const unitOf = new Map(data.units.map((u) => [u.id, u]));
			const goes = (t) => {
				const u = unitOf.get(t.unitId);
				return tplTopicIds.has(id(t)) || !u || tplUnitIds.has(id(u)) || (u.start >= from && u.start <= to);
			};
			const before = ordered(data.topics);
			const removed = new Set(data.topics.filter((t) => inRange(t) && goes(t)).map((t) => t.id));
			const stay = data.topics.filter((t) => inRange(t) && !removed.has(t.id));
			kept = stay.length;
			for (const t of stay) if ((t.end || t.start) >= start) start = S.addDays(t.end || t.start, 1);
			data.activities = data.activities.filter((a) => {
				if (!inRange(a) || a.pinned) return true;
				const t = P.pickTopic(a, before, data);
				return !!t && !removed.has(t.id) && !(t.start >= from && t.start <= to && removed.has(t.id));
			});
			data.topics = data.topics.filter((t) => !removed.has(t.id));
			data.units = data.units.filter((u) => !(inRange(u) && !data.topics.some((t) => t.unitId === u.id)));
			const keepUnits = new Set(data.units.map((u) => u.id));
			for (const t of data.topics) if (t.unitId && !keepUnits.has(t.unitId)) t.unitId = null;
			fitUnits(data);
		}
		const first = S.lowerBound(meets.map((x) => ({ date: x })), start);
		let lastIx = S.lowerBound(meets.map((x) => ({ date: x })), to);
		if (lastIx >= meets.length || meets[lastIx] > to) lastIx -= 1;
		const M = lastIx - first + 1;
		if (M <= 0) return { error: 'This course has no class meetings left in that range.' };

		const weights = items.map((it) => (it.kind === 'topic' ? it.t.meetings : it.unit.meetings) || 1);
		let spans;
		let overflow = 0;
		if (fit) spans = P.allocate(weights, M);
		else {
			let k = 0;
			spans = weights.map((w) => {
				const c = Math.max(1, Math.round(w));
				const r = { a: Math.min(k, M - 1), b: Math.min(k + c - 1, M - 1) };
				k += c;
				return r;
			});
			overflow = Math.max(0, k - M);
		}


		if (tpl.seedId && !data.objectiveTrees.length && root.HT && root.HT.schedulerSeeds && root.HT.schedulerSeeds[tpl.seedId]) {
			const seedData = root.HT.schedulerSeeds[tpl.seedId].data;
			S.applySeed(data, { data: { ...seedData, activityBank: [] } });
		}

		const unitIds = new Map();
		const offset = data.units.length;
		units.forEach((u, i) => {
			const nu = { id: S.newId('u'), title: u.title, color: u.color || S.UNIT_COLORS[(offset + i) % S.UNIT_COLORS.length], objectiveId: u.objectiveId || null, start: null, end: null };
			unitIds.set(u.key, nu);
			data.units.push(nu);
		});
		const topicSpan = new Map(); // template topic key -> { ns (global meeting idx), oldLen }
		items.forEach((it, i) => {
			const s = spans[i];
			const ga = first + s.a,
				gb = first + s.b;
			if (it.kind === 'topic') {
				const nu = it.unit && unitIds.get(it.unit.key);
				data.topics.push({ id: S.newId('t'), unitId: nu ? nu.id : null, title: it.t.title, start: meets[ga], end: meets[gb], objectiveId: it.t.objectiveId || null });
				topicSpan.set(it.t.key, { ns: { a: ga, b: gb }, oldLen: Math.max(1, Math.round(it.t.meetings)) });
			} else {
				const nu = unitIds.get(it.unit.key);
				nu.start = meets[ga];
				nu.end = meets[gb];
			}
		});
		fitUnits(data);
		data.units = data.units.filter((u) => u.start);

		let placed = 0,
			banked = 0;
		const bankTitles = new Set(data.activities.filter((a) => !a.start).map((a) => a.title));
		for (const ta of tpl.activities) {
			const { anchor, ...fields } = ta;
			if (!anchor) {
				if (wanted || bankTitles.has(fields.title)) continue; // don't duplicate the bank
				data.activities.push(S.newActivity({ ...JSON.parse(JSON.stringify(fields)), pinned: false }));
				banked++;
				continue;
			}
			const ts = topicSpan.get(anchor.topicKey);
			if (!ts) continue; // its topic wasn't part of this layout
			const d = P.place(anchor, ts.ns, meets, ts.oldLen);
			data.activities.push(S.newActivity({ ...JSON.parse(JSON.stringify(fields)), pinned: false, start: d.start, end: d.end }));
			placed++;
		}
		return { units: units.length, topics: topicSpan.size, activities: placed, banked, meetings: M, overflow, kept, startedOn: meets[first] };
	};

	/* ------------------------------------------------------------------ */
	/* Catch up                                                            */
	/* ------------------------------------------------------------------ */

	/* The most recently completed topic is `topicId`, finished as of `asOf`. Every later topic that was
	   planned to start by `until` is spread over the class meetings after `asOf` through `until`, keeping
	   their relative lengths; activities move with their topics (pinned ones stay put). Units stretch to
	   fit their topics. Returns { rows, moved, meetings } or { error }. */
	/* fit = false: keep every later topic's length and push them all later, in order, from the next class
	   (until is ignored; anything past the end of the term piles up on the last day). */
	P.catchUp = function (data, { topicId, asOf, until, fit = true }) {
		if (!fit) until = data.course.termEnd;
		const days = S.genDays(data);
		const meets = meetDates(data, days);
		const topics = ordered(data.topics);
		const k = topics.findIndex((t) => t.id === topicId);
		if (k < 0) return { error: 'Pick the topic you finished most recently.' };
		const done = topics[k];
		const rest = topics.slice(k + 1).filter((t) => t.start <= until);
		const startIx = S.lowerBound(meets.map((x) => ({ date: x })), S.addDays(asOf, 1));
		let endIx = S.lowerBound(meets.map((x) => ({ date: x })), until);
		if (endIx >= meets.length || meets[endIx] > until) endIx -= 1;
		const M = endIx - startIx + 1;
		if (!rest.length) return { error: 'There are no later topics to schedule before that end date.' };
		if (M <= 0) return { error: 'There are no class meetings left in that range.' };

		const old = new Map(topics.map((t) => [t.id, P.span(meets, t.start, t.end)]));
		// remember where each movable activity sits before anything moves
		const restIds = new Set(rest.map((t) => t.id));
		const anchors = [];
		for (const a of data.activities) {
			if (!a.start || a.pinned) continue;
			const t = P.pickTopic(a, topics, data);
			if (!t || !restIds.has(t.id)) continue;
			anchors.push({ a, an: P.anchor(a, t, old.get(t.id), meets) });
		}

		const rows = [];
		// the finished topic now ends on the last class on/before asOf
		const lastDone = S.lowerBound(meets.map((x) => ({ date: x })), S.addDays(asOf, 1)) - 1;
		if (lastDone >= 0) {
			const newEnd = meets[lastDone] >= done.start ? meets[lastDone] : done.start;
			if (newEnd !== (done.end || done.start)) rows.push({ title: done.title, oldStart: done.start, oldEnd: done.end, newStart: done.start, newEnd, finished: true });
			done.end = newEnd;
		}
		const lens = rest.map((t) => old.get(t.id).b - old.get(t.id).a + 1);
		let spans,
			overflow = 0;
		if (fit) spans = P.allocate(lens, M);
		else {
			let k = 0;
			spans = lens.map((c) => {
				const r = { a: Math.min(k, M - 1), b: Math.min(k + c - 1, M - 1) };
				k += c;
				return r;
			});
			overflow = Math.max(0, k - M);
		}
		const ns = new Map();
		rest.forEach((t, i) => {
			const s = { a: startIx + spans[i].a, b: startIx + spans[i].b };
			ns.set(t.id, s);
			const o = old.get(t.id);
			rows.push({ title: t.title, oldStart: t.start, oldEnd: t.end, newStart: meets[s.a], newEnd: meets[s.b], oldN: o.b - o.a + 1, newN: s.b - s.a + 1 });
			t.start = meets[s.a];
			t.end = meets[s.b];
		});
		let moved = 0;
		for (const { a, an } of anchors) {
			const o = old.get(an.topic.id);
			const d = P.place(an, ns.get(an.topic.id), meets, o.b - o.a + 1);
			if (d.start !== a.start || d.end !== a.end) moved++;
			a.start = d.start;
			a.end = d.end;
		}
		fitUnits(data);
		return { rows, moved, meetings: M, oldMeetings: lens.reduce((x, y) => x + y, 0), overflow };
	};

	/* The topic that was planned for a date (for defaulting the catch-up picker) */
	P.topicOn = function (data, date) {
		const ts = ordered(data.topics).filter((t) => t.start <= date);
		return ts.length ? ts[ts.length - 1] : null;
	};
	P.orderedTopics = ordered;

	if (typeof module !== 'undefined' && module.exports) module.exports = P;
	else S.plan = P;
})(typeof window !== 'undefined' ? window : globalThis);
