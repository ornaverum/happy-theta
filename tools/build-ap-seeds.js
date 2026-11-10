/* Builds the Theta Scheduler frameworks for AP Computer Science A, AP Computer Science Principles and
   AP Precalculus from text extracted out of the College Board Course and Exam Descriptions (CEDs):
     teacher/js/scheduler-seed-apcsa.js       CSA CED, effective Fall 2025 (4 units)
     teacher/js/scheduler-seed-apcsp.js       CSP CED, effective Fall 2023 (5 big ideas)
     teacher/js/scheduler-seed-precalc.js     Precalculus CED, 2026 edition (Units 1–3 on the exam, Unit 4 optional)
   Run from the repo root:  node tools/build-ap-seeds.js
   Source data: tools/ced/*.json (topics, learning objectives, essential knowledge, exclusion statements,
   suggested skills per topic, skill wording, CED class periods per topic). Pacing and the course-level
   choices (unit lengths, CSP big-idea order, the Create task block) are set in COURSES below. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, 'ced', f), 'utf8'));

const COURSES = [
	{
		id: 'ap-csa',
		file: 'scheduler-seed-apcsa.js',
		data: 'ap-csa.json',
		title: 'AP Computer Science A (2025 course framework)',
		courseTitle: 'AP Computer Science A',
		short: 'AP CSA',
		ced: 'AP Computer Science A Course and Exam Description, effective Fall 2025',
		levels: ['Unit', 'Topic', 'Learning objective', 'Essential knowledge'],
		// CED unit guides: exam weighting and ~class periods (upper end of the range)
		units: [
			{ code: '1', text: 'Using Objects and Methods', meetings: 34, weighting: '15–25%' },
			{ code: '2', text: 'Selection and Iteration', meetings: 31, weighting: '25–35%' },
			{ code: '3', text: 'Class Creation', meetings: 22, weighting: '10–18%' },
			{ code: '4', text: 'Data Collections', meetings: 52, weighting: '30–40%' }
		],
		practicesName: 'AP CSA computational thinking practices',
		practices: [
			['1', 'Design Code', 'Determine an appropriate program design and develop algorithms.'],
			['2', 'Develop Code', 'Write and implement program code.'],
			['3', 'Analyze Code', 'Determine the output or result of given program code or explain why code may not work as intended.'],
			['4', 'Document Code and Computing Systems', 'Describe the behavior and conditions that produce specified results in a program.'],
			['5', 'Use Computers Responsibly', 'Understand the ethical and social implications of computer use.']
		]
	},
	{
		id: 'ap-csp',
		file: 'scheduler-seed-apcsp.js',
		data: 'ap-csp.json',
		title: 'AP Computer Science Principles (big ideas)',
		courseTitle: 'AP Computer Science Principles',
		short: 'AP CSP',
		ced: 'AP Computer Science Principles Course and Exam Description, effective Fall 2023',
		levels: ['Big idea', 'Topic', 'Learning objective', 'Essential knowledge'],
		// The CED gives no class periods: big-idea lengths follow the exam weighting (~150 periods with the
		// Create task); topics split their big idea by how much essential knowledge they hold.
		units: [
			{ code: '1', text: 'Creative Development', abbr: 'CRD', meetings: 14, weighting: '10–13%' },
			{ code: '2', text: 'Data', abbr: 'DAT', meetings: 22, weighting: '17–22%' },
			{ code: '3', text: 'Algorithms and Programming', abbr: 'AAP', meetings: 46, weighting: '30–35%' },
			{ code: 'CPT', text: 'Create Performance Task (at least 9 class hours)', meetings: 12, custom: true, after: '3' },
			{ code: '4', text: 'Computer Systems and Networks', abbr: 'CSN', meetings: 16, weighting: '11–15%' },
			{ code: '5', text: 'Impact of Computing', abbr: 'IOC', meetings: 26, weighting: '21–26%' }
		],
		practicesName: 'AP CSP computational thinking practices',
		practices: [
			['1', 'Computational Solution Design', 'Design and evaluate computational solutions for a purpose.'],
			['2', 'Algorithms and Program Development', 'Develop and implement algorithms.'],
			['3', 'Abstraction in Program Development', 'Develop programs that incorporate abstractions.'],
			['4', 'Code Analysis', 'Evaluate and test algorithms and programs.'],
			['5', 'Computing Innovations', 'Investigate computing innovations.'],
			['6', 'Responsible Computing', 'Contribute to an inclusive, safe, collaborative, and ethical computing culture.']
		],
		extraSkills: { '6.B': 'Use safe and secure methods when using computing devices.' },
		weightTopicsByContent: true
	},
	{
		id: 'ap-precalculus',
		file: 'scheduler-seed-precalc.js',
		data: 'ap-precalculus.json',
		title: 'AP Precalculus (course framework)',
		courseTitle: 'AP Precalculus',
		short: 'AP Precalc',
		ced: 'AP Precalculus Course and Exam Description (2026 edition)',
		levels: ['Unit', 'Topic', 'Learning objective', 'Essential knowledge'],
		units: [
			{ code: '1', text: 'Polynomial and Rational Functions', meetings: 40, weighting: '30–40%' },
			{ code: '2', text: 'Exponential and Logarithmic Functions', meetings: 45, weighting: '25–40%' },
			{ code: '3', text: 'Trigonometric and Polar Functions', meetings: 50, weighting: '30–35%' },
			{ code: '4', text: 'Functions Involving Parameters, Vectors, and Matrices (optional — not on the AP Exam)', meetings: 35, weighting: '0%', optional: true }
		],
		practicesName: 'AP Precalculus mathematical practices',
		practices: [
			['1', 'Procedural and Symbolic Fluency', 'Algebraically manipulate functions, equations, and expressions.'],
			['2', 'Multiple Representations', 'Translate mathematical information between representations.'],
			['3', 'Communication and Reasoning', 'Communicate with precise language, and provide rationales for conclusions.']
		],
		mathText: true,
		fixes: 'precalc-math-fixes.json'
	}
];

// Topic titles the PDF text cut short (code-font words or a line break); taken from the CED unit-at-a-glance tables.
const TITLE_FIX = { 'ap-csa': { '3.6': 'Methods: Passing and Returning References of an Object' } };

const half = (x) => Math.max(0.5, Math.round(x * 2) / 2);
const upper = (p) => (p == null ? null : +String(p).split(/[–-]/).pop());

// Spacing the PDF text lost around math (precalc): "ofθ" → "of θ", "position(x" → "position (x", ")can" → ") can"
const FN = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'log', 'det', 'arcsin', 'arccos', 'arctan']);
const tidyMath = (s) =>
	s
		.replace(/([A-Za-z])θ/g, '$1 θ')
		.replace(/\b([a-z]{3,})([([])/g, (m, w, b) => (FN.has(w) ? m : `${w} ${b}`))
		.replace(/([)\]])([a-z]{2,})/g, '$1 $2')
		.replace(/([a-z])−/g, '$1 −')
		.replace(/\b([fghpqrxyvL]) \(/g, '$1(')
		.replace(/ {2,}/g, ' ');

function build(cfg) {
	const src = read(cfg.data);
	if (cfg.fixes) {
		const fixes = read(cfg.fixes);
		for (const n of src.nodes) n.t = fixes[n.c] ? fixes[n.c] : cfg.mathText ? tidyMath(n.t) : n.t;
	}
	const nodes = [];
	const node = (id, parentId, code, text, order, meta, origin = 'template') => {
		const n = { id, parentId, code, text, order, origin };
		if (meta && Object.keys(meta).length) n.meta = meta;
		nodes.push(n);
		return n;
	};

	const topicCodes = Object.keys(src.topics).sort((a, b) => {
		const [a1, a2] = a.split('.').map(Number);
		const [b1, b2] = b.split('.').map(Number);
		return a1 - b1 || a2 - b2;
	});
	const unitOfTopic = (t) => t.split('.')[0];

	// essential knowledge count per topic (CSP pacing)
	const ekCount = {};
	for (const n of src.nodes) if (n.k === 'ek') {
		const lo = src.nodes.find((x) => x.c === n.c.replace(/\.\d+$/, ''));
		const t = lo ? lo.tp : n.tp;
		ekCount[t] = (ekCount[t] || 0) + 1;
	}
	const euText = Object.fromEntries(src.nodes.filter((n) => n.k === 'eu').map((n) => [n.c, n.t]));

	cfg.units.forEach((u, ui) => {
		const meta = { durationMeetings: u.meetings };
		if (u.weighting) meta.examWeighting = u.weighting;
		if (u.optional) meta.optional = true;
		if (u.abbr) meta.abbreviation = u.abbr;
		node('c-' + u.code, null, u.code, u.text, ui + 1, meta, u.custom ? 'custom' : 'template');
		if (u.custom) return;
		const tcs = topicCodes.filter((t) => unitOfTopic(t) === u.code);
		// topic lengths: CED class periods (or content share), scaled so the unit keeps its full length
		const raw = tcs.map((t) => {
			if (cfg.weightTopicsByContent) return 1 + Math.sqrt(ekCount[t] || 1); // damped: big topics get more time, not proportionally more
			const g = src.glance && src.glance[t];
			return upper(g && g.periods) || 1;
		});
		const total = raw.reduce((a, b) => a + b, 0) || 1;
		tcs.forEach((t, ti) => {
			const info = src.topics[t];
			const g = src.glance && src.glance[t];
			let title = (TITLE_FIX[cfg.id] && TITLE_FIX[cfg.id][t]) || (g && g.title) || info.title;
			title = title.replace(/\s+/g, ' ').trim();
			const meta = { durationMeetings: half((raw[ti] / total) * u.meetings) };
			if (g && g.periods) meta.cedClassPeriods = String(g.periods);
			if (info.extra || u.optional) meta.optional = true;
			node('c-' + t, 'c-' + u.code, t, title, ti + 1, meta);
		});
	});

	// learning objectives under their topic, essential knowledge under their LO (in code order)
	const byCode = new Map(src.nodes.map((n) => [n.c, n]));
	const los = src.nodes.filter((n) => n.k === 'lo');
	const loOrder = {};
	for (const lo of los) {
		const topicId = 'c-' + lo.tp;
		if (!nodes.some((n) => n.id === topicId)) throw new Error(`${cfg.id}: LO ${lo.c} has unknown topic ${lo.tp}`);
		loOrder[lo.tp] = (loOrder[lo.tp] || 0) + 1;
		const meta = {};
		const eu = lo.c.match(/^([A-Z]{3}-\d+)\./);
		if (eu && euText[eu[1]]) meta.enduringUnderstanding = `${eu[1]}: ${euText[eu[1]]}`;
		if (lo.s) meta.skills = lo.s;
		node('c-' + lo.c, topicId, lo.c, lo.t, loOrder[lo.tp], meta);
		const eks = src.nodes
			.filter((n) => n.k === 'ek' && n.c.replace(/\.\d+$/, '') === lo.c)
			.sort((a, b) => +a.c.split('.').pop() - +b.c.split('.').pop());
		eks.forEach((ek, i) => {
			const m = {};
			let text = ek.t;
			if (ek.x) {
				m.exclusion = ek.x;
				text += ` [Exclusion statement: ${ek.x}]`;
			}
			node('c-' + ek.c, 'c-' + lo.c, ek.c, text, i + 1, m);
		});
	}
	const placed = new Set(nodes.map((n) => n.code));
	const lost = src.nodes.filter((n) => n.k !== 'eu' && !placed.has(n.c)).map((n) => n.c);
	if (lost.length) throw new Error(`${cfg.id}: not placed: ${lost.join(', ')}`);

	// practices tree
	const skillText = { ...src.skillDesc, ...(cfg.extraSkills || {}) };
	const pnodes = [];
	cfg.practices.forEach(([code, name, desc], i) => pnodes.push({ id: 'p-' + code, parentId: null, code, text: name, order: i + 1, origin: 'template', meta: { description: desc } }));
	Object.keys(skillText)
		.sort()
		.forEach((code) => {
			const parent = 'p-' + code.split('.')[0];
			const order = code.charCodeAt(code.length - 1) - 64;
			pnodes.push({ id: 'p-' + code, parentId: parent, code, text: skillText[code], order, origin: 'template' });
		});

	// suggested skills per topic (CED topic pages; CSP adds each LO's skill)
	const suggestedSkills = {};
	for (const t of topicCodes) {
		const set = new Set(src.skillsByTopic[t] || []);
		for (const lo of los) if (lo.tp === t) (lo.s || []).forEach((s) => set.add(s));
		const ids = [...set].sort().filter((s) => skillText[s]).map((s) => 'p-' + s);
		if (ids.length) suggestedSkills['c-' + t] = ids;
	}

	return {
		id: cfg.id,
		title: cfg.title,
		courseTitle: cfg.courseTitle,
		subject: { id: cfg.id, label: cfg.courseTitle }, // the shared library only matches activities within a subject
		source: cfg.ced,
		data: {
			objectiveTrees: [
				{ id: 'content', name: `${cfg.short} content`, levels: cfg.levels, nodes },
				{ id: 'practices', name: cfg.practicesName, levels: ['Practice', 'Skill'], nodes: pnodes }
			],
			suggestedSkills,
			activityBank: []
		}
	};
}

for (const cfg of COURSES) {
	const seed = build(cfg);
	const counts = {};
	const kindOf = (n) => (n.parentId === null ? 'units' : /^\d+\.\d+$/.test(n.code) ? 'topics' : /\.[A-Z]$/.test(n.code) ? 'lo' : 'ek');
	for (const n of seed.data.objectiveTrees[0].nodes) counts[kindOf(n)] = (counts[kindOf(n)] || 0) + 1;
	const header =
		`/* Theta Scheduler seed: ${seed.title}. Units, topics, learning objectives and essential knowledge from the\n` +
		`   ${cfg.ced}, plus the practices/skills and the suggested skills per topic.\n` +
		`   Generated by tools/build-ap-seeds.js — edit that script (or tools/ced/${cfg.data}), not this file. */\n`;
	const body = `'use strict';\nwindow.HT = window.HT || {};\n(HT.schedulerSeeds = HT.schedulerSeeds || {})[${JSON.stringify(seed.id)}] = ${JSON.stringify(seed)};\n`;
	fs.writeFileSync(path.join(ROOT, 'teacher/js', cfg.file), header + body);
	console.log(cfg.file, JSON.stringify(counts), 'skills', seed.data.objectiveTrees[1].nodes.length, 'topics with skills', Object.keys(seed.data.suggestedSkills).length);
}
