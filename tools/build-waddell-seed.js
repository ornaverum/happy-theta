/* Builds phys/js/scheduler-seed-waddell.js: the AP Physics 1 learning objectives and essential knowledge
   reorganized into the Waddell sequence (Unit 0, 1D uniform motion, accelerating motion, 1D non-equilibrium,
   2D motion, rotation).
   Run from the repo root:  node tools/build-waddell-seed.js
   Edit SEQUENCE below to move things. Each `claim` is an AP code: a whole LO ("2.4.A"), one EK ("1.2.B.3")
   or one detail ("1.3.A.4.ii"). A node belongs to the most specific claim above it, so claiming an LO takes
   all its EKs except ones claimed elsewhere. Unclaimed AP objectives land in the last unit, "Not yet placed". */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = global;
global.HT = {};
eval(fs.readFileSync(path.join(__dirname, '../phys/js/scheduler-seed-ap1.js'), 'utf8'));
const AP = HT.schedulerSeeds['ap-physics-1'].data;
const apTree = AP.objectiveTrees[0];

/* key, title, claims, children (subtopics); unit keys start with "U" */
const SEQUENCE = [
	{
		key: 'U0', title: 'Unit 0: Basics', ap: '0',
		topics: ['0.1', '0.2', '0.3', '0.4', '0.5'].map((c) => ({ key: c, copyAp: c }))
	},
	{
		key: 'U1', title: 'Unit 1: 1D Uniform Motion',
		topics: [
			{ key: 'U1.1', title: 'Velocity, position, and time', claims: ['1.1.A', '1.1.B', '1.2.A', '1.2.B.1', '1.2.B.2', '1.3.A.1', '1.3.A.4.i'] },
			{ key: 'U1.2', title: 'Relative motion', claims: ['1.4.A', '1.4.B'] },
			{
				key: 'U1.3', title: 'Forces and equilibrium', claims: ['2.2.A'],
				subs: [
					{ key: 'U1.3.1', title: 'Newton’s 1st Law', claims: ['2.1.A', '2.4.A', '2.2.B.1', '2.2.B.2', '2.2.B.3', '2.6.D.1'] },
					{ key: 'U1.3.2', title: 'Specific types of forces (tension, weight, friction, springs…)', claims: ['2.3.A.3', '2.6.A.3', '2.6.B', '2.7.A.1', '2.7.B', '2.8.A'] }
				]
			},
			{ key: 'U1.4', title: 'Momentum and kinetic energy', claims: ['4.1.A.1', '4.1.A.2', '3.1.A'] },
			{ key: 'U1.5', title: 'Newton’s 3rd Law', claims: ['2.3.A.1'] }
		]
	},
	{
		key: 'U2a', title: 'Unit 2a: Accelerating Motion',
		topics: [
			{ key: 'U2a.1', title: 'Acceleration and velocity', claims: ['1.2.B.3', '1.2.B.4', '1.2.B.5'] },
			{ key: 'U2a.2', title: 'Basic Newton’s 2nd Law', claims: ['2.5.A', '2.6.D.2', '2.6.D.3'] },
			{
				key: 'U2a.3', title: 'Kinematic graphs', claims: ['1.3.A.4', '1.3.A.4.iv'],
				subs: [
					{ key: 'U2a.3.1', title: 'Slope of velocity = acceleration', claims: ['1.3.A.4.ii'] },
					{ key: 'U2a.3.2', title: 'Area under velocity = displacement', claims: ['1.3.A.4.iii'] }
				]
			},
			{ key: 'U2a.4', title: 'Big 3 kinematic equations', claims: ['1.3.A.2', '1.3.A.3'] }
		]
	},
	{
		key: 'U2b', title: 'Unit 2b: Forces in 1D Non-equilibrium',
		topics: [
			{
				key: 'U2b.1', title: 'Force problems',
				subs: [
					{ key: 'U2b.1.1', title: 'Free-body diagrams', claims: ['2.2.B.4'] },
					{ key: 'U2b.1.2', title: 'Vertical-only problems', claims: ['2.6.C'] },
					{
						key: 'U2b.1.3', title: 'Horizontal-only problems',
						subs: [{ key: 'U2b.1.3.1', title: 'With normal force = weight', claims: ['2.7.A.2'] }]
					}
				]
			},
			{
				key: 'U2b.2', title: 'Momentum',
				subs: [
					{ key: 'U2b.2.1', title: 'Impulse and change in momentum', claims: ['4.2.A', '4.2.B'] },
					{
						key: 'U2b.2.2', title: 'Conservation of momentum', claims: ['4.3.A', '4.3.B'],
						subs: [
							{ key: 'U2b.2.2.1', title: 'Newton’s 3rd Law', claims: ['4.3.A.3', '2.3.A.2'] },
							{ key: 'U2b.2.2.2', title: 'Collisions', claims: ['4.1.A.3', '4.3.A.4', '4.4.A'] }
						]
					}
				]
			},
			{
				key: 'U2b.3', title: 'Kinetic energy',
				subs: [
					{ key: 'U2b.3.1', title: 'Work (and power)', claims: ['3.2.A', '3.5.A'] },
					{ key: 'U2b.3.2', title: 'Conservation of energy', claims: ['3.3.A', '3.4.A', '3.4.B', '3.4.C'] },
					{ key: 'U2b.3.3', title: 'Apply conservation to 2D problems', claims: [] }
				]
			}
		]
	},
	{
		key: 'U3', title: 'Unit 3: 2D Motion',
		topics: [
			{ key: 'U3.1', title: 'Vector addition and subtraction', claims: ['1.5.A'] },
			{
				key: 'U3.2', title: 'Kinematics',
				subs: [
					{ key: 'U3.2.1', title: 'Projectile motion', claims: ['1.5.B.2'] },
					{ key: 'U3.2.2', title: 'General cases', claims: ['1.5.B.1'] }
				]
			},
			{ key: 'U3.3', title: 'Dynamics (incl. circular motion and gravitation)', claims: ['2.9.A', '2.9.B', '2.6.A.1', '2.6.A.2'] },
			{ key: 'U3.4', title: '2D collisions?', claims: [] }
		]
	},
	{
		key: 'U4', title: 'Unit 4: Rotation',
		topics: [
			{ key: 'U4.1', title: 'Statics and torque', claims: ['5.3.A', '5.3.B', '5.5.A', '2.1.B'] },
			{ key: 'U4.2', title: 'Kinematics', claims: ['5.1.A', '5.2.A'] },
			{ key: 'U4.3', title: 'Rotational dynamics and torque', claims: ['5.4.A', '5.4.B', '5.6.A'] },
			{
				key: 'U4.4', title: 'Angular momentum', claims: ['6.3.A', '6.3.B', '6.3.C', '6.6.A'],
				subs: [{ key: 'U4.4.1', title: 'Collisions', claims: ['6.4.A', '6.4.B'] }]
			},
			{ key: 'U4.5', title: 'Rotational kinetic energy', claims: ['6.1.A', '6.2.A', '6.5.A', '6.5.B', '6.5.C'] }
		]
	}
];

/* Where each of Jack's quizzes goes in this sequence (topic key); missing = not-yet-placed unit */
const QUIZ_TOPIC = {
	Q00: '0.5', Q01P1: 'U1.1', Q01P2: 'U1.1', Q02MC: 'U2a.1', Q02P1: 'U2a.3', Q02P2: 'U2a.4', Q03: 'U3.1',
	Q04P1: 'U1.2', Q04P2: 'U3.2', Q04P3: 'U3.3', Q04MC: 'U3.2', Q05P1: 'U2b.1', Q05P2: 'U2b.1', Q05C1: 'U1.3',
	Q05C2: 'U1.3', Q05MC2: 'U1.3', Q06P1: 'U2b.1', Q06P2: 'U3.3', Q06P3: 'U2b.1', Q06P4: 'U3.3', Q07P1: 'U1.5',
	Q07P2: 'U2b.1', Q08P1: 'U2b.3', Q08P2: 'U2b.3', Q08P3: 'U2b.3', Q09P1: 'U2b.2', Q09P2: 'U2b.2', Q09P3: 'U2b.2',
	Q10P1: 'U4.2', Q10P2: 'U4.3', Q10P3: 'U4.1', Q10P4: 'U4.3', Q10MC1: 'U4.3', Q11P1: 'U4.5', Q11P2: 'U4.5',
	Q12P1: 'U4.4', Q12P2: 'U4.4', Q13P1: 'U4.5', Q13P2: 'U4.4'
};

/* ------------------------------------------------------------------ */
const byCode = new Map(apTree.nodes.map((n) => [n.code, n]));
const byId = new Map(apTree.nodes.map((n) => [n.id, n]));
const kidsOf = (id) => apTree.nodes.filter((n) => n.parentId === id).sort((a, b) => a.order - b.order);
const apDepth = (n) => n.code.split('.').length - 1; // 0 unit, 1 topic, 2 LO, 3 EK, 4 detail
const KIND = ['unit', 'topic', 'lo', 'ek', 'detail'];

// claims
const claim = new Map(); // ap code -> structural key
const walk = (list) =>
	list.forEach((s) => {
		for (const c of s.claims || []) {
			if (!byCode.has(c)) throw new Error('Unknown AP code ' + c + ' in ' + s.key);
			if (claim.has(c)) throw new Error(`${c} claimed twice (${claim.get(c)}, ${s.key})`);
			claim.set(c, s.key);
		}
		walk(s.subs || []);
	});
SEQUENCE.forEach((u) => walk(u.topics));
// owner of every LO/EK/detail = nearest claimed self-or-ancestor
const owner = (n) => {
	for (let x = n; x; x = byId.get(x.parentId)) if (claim.has(x.code)) return claim.get(x.code);
	return null;
};

const nodes = [];
const order = new Map();
const add = (n) => {
	const k = n.parentId || '';
	order.set(k, (order.get(k) || 0) + 1);
	nodes.push({ order: order.get(k), origin: 'template', hidden: false, ...n });
	return n.id;
};

// EK weight for meeting estimates: each AP unit's meetings spread over its EKs
const unitMeet = new Map(apTree.nodes.filter((n) => !n.parentId).map((u) => [u.code, (u.meta && u.meta.durationMeetings) || 1]));
const ekCount = new Map();
for (const n of apTree.nodes) if (apDepth(n) === 3) ekCount.set(n.code.split('.')[0], (ekCount.get(n.code.split('.')[0]) || 0) + 1);
// Default topic lengths: half from AP's suggested pacing for the EK's unit, half from a flat share per EK
// (AP gives kinematics little time per EK and energy a lot; this sequence spreads them differently).
const totalMeet = [...unitMeet.entries()].filter(([u]) => u !== '0').reduce((s, [, m]) => s + m, 0);
const totalEk = [...ekCount.entries()].filter(([u]) => u !== '0').reduce((s, [, n]) => s + n, 0);
const ekWeight = (code) => 0.5 * (unitMeet.get(code.split('.')[0]) / ekCount.get(code.split('.')[0])) + 0.5 * (totalMeet / totalEk);

const placed = new Set();
const weightOf = new Map(); // structural key -> meetings
const apTopicsOf = new Map(); // structural topic key -> Set(AP topic codes) for suggested skills

/* Copy the AP LO/EK/detail nodes owned by structural node `skey` under `parentId` */
function copyOwned(skey, parentId, topicKey) {
	const mine = apTree.nodes.filter((n) => apDepth(n) >= 2 && owner(n) === skey);
	const mineSet = new Set(mine.map((n) => n.id));
	// LOs to show: owned LOs + LOs that have any owned descendant
	const los = apTree.nodes.filter((n) => apDepth(n) === 2 && (mineSet.has(n.id) || mine.some((m) => m.code.startsWith(n.code + '.'))));
	for (const lo of los) {
		const loId = add({ id: `w-${skey}:${lo.code}`, parentId, code: lo.code, text: lo.text, kind: 'lo', meta: { ap: lo.code, ...(lo.meta || {}), ...(mineSet.has(lo.id) ? {} : { partial: true }) } });
		placed.add(lo.code);
		const t = lo.code.split('.').slice(0, 2).join('.');
		if (!apTopicsOf.has(topicKey)) apTopicsOf.set(topicKey, new Set());
		apTopicsOf.get(topicKey).add(t);
		for (const ek of kidsOf(lo.id)) {
			const ekMine = mineSet.has(ek.id) || kidsOf(ek.id).some((d) => mineSet.has(d.id));
			if (!ekMine) continue;
			const ekId = add({ id: `w-${skey}:${ek.code}`, parentId: loId, code: ek.code, text: ek.text, kind: 'ek', meta: { ap: ek.code, ...(mineSet.has(ek.id) ? {} : { partial: true }) } });
			placed.add(ek.code);
			const share = kidsOf(ek.id).length ? kidsOf(ek.id).filter((d) => mineSet.has(d.id)).length / kidsOf(ek.id).length || (mineSet.has(ek.id) ? 0.5 : 0) : 1;
			weightOf.set(topicKey, (weightOf.get(topicKey) || 0) + ekWeight(ek.code) * Math.max(share, mineSet.has(ek.id) ? 0.5 : share));
			for (const d of kidsOf(ek.id)) {
				if (!mineSet.has(d.id)) continue;
				add({ id: `w-${skey}:${d.code}`, parentId: ekId, code: d.code, text: d.text, kind: 'detail', meta: { ap: d.code } });
				placed.add(d.code);
			}
		}
	}
}

function addStruct(s, parentId, kind, topicKey) {
	const id = add({ id: 'w-' + s.key, parentId, code: s.key, text: s.title, kind });
	copyOwned(s.key, id, topicKey);
	for (const sub of s.subs || []) addStruct(sub, id, 'subtopic', topicKey);
	return id;
}

const units = [];
for (const u of SEQUENCE) {
	const uid = add({ id: 'w-' + u.key, parentId: null, code: u.key, text: u.title.replace(/^Unit \w+: /, ''), kind: 'unit', meta: {} });
	units.push(uid);
	for (const t of u.topics) {
		if (t.copyAp) {
			// Unit 0: same topics (and codes) as the AP tree
			const ap = byCode.get(t.copyAp);
			add({ id: 'w-' + ap.code, parentId: uid, code: ap.code, text: ap.text, kind: 'topic', origin: 'custom', meta: { durationMeetings: 2 / 5 } });
			placed.add(ap.code);
			continue;
		}
		const tid = addStruct(t, uid, 'topic', t.key);
		const n = nodes.find((x) => x.id === tid);
		n.meta = { durationMeetings: Math.max(1, Math.round((weightOf.get(t.key) || 1) * 2) / 2) };
	}
}

// Not yet placed: whole AP topics/LOs/EKs nobody claimed
const leftovers = apTree.nodes.filter((n) => apDepth(n) >= 2 && !owner(n) && !placed.has(n.code) && !(apDepth(n) > 2 && !owner(byId.get(n.parentId)) && false));
const leftTopics = [...new Set(leftovers.filter((n) => apDepth(n) === 2 || apDepth(n) === 3).map((n) => n.code.split('.').slice(0, 2).join('.')))];
if (leftTopics.length) {
	const uid = add({ id: 'w-UX', parentId: null, code: 'UX', text: 'Not yet placed (in AP Physics 1, not in this sequence yet)', kind: 'unit', meta: {} });
	units.push(uid);
	for (const tc of leftTopics) {
		const apT = byCode.get(tc);
		const key = 'UX.' + tc;
		const tid = add({ id: 'w-' + key, parentId: uid, code: key, text: apT.text, kind: 'topic', meta: {} });
		// claim every unowned descendant for this leftover topic
		for (const n of apTree.nodes) if (n.code.startsWith(tc + '.') && !owner(n)) claim.set(n.code, key);
		copyOwned(key, tid, key);
		const t = nodes.find((x) => x.id === tid);
		t.meta.durationMeetings = Math.max(1, Math.round((weightOf.get(key) || 1) * 2) / 2);
	}
}

// unit lengths = sum of their topics
for (const uid of units) {
	const u = nodes.find((n) => n.id === uid);
	const ts = nodes.filter((n) => n.parentId === uid);
	u.meta.durationMeetings = Math.round(ts.reduce((s, t) => s + (t.meta.durationMeetings || 0), 0));
	u.text = u.text;
}

// sanity: every AP LO/EK/detail is placed exactly once (LO headers may repeat)
// (an EK whose details are split appears as a "partial" header in each place; that's expected)
const missing = apTree.nodes.filter((n) => apDepth(n) >= 3 && !nodes.some((x) => x.kind !== 'lo' && x.code === n.code));
const dup = apTree.nodes.filter((n) => apDepth(n) >= 3 && nodes.filter((x) => x.kind !== 'lo' && x.code === n.code && !(x.meta && x.meta.partial)).length > 1);
if (missing.length || dup.length) throw new Error('missing ' + missing.map((n) => n.code) + ' dup ' + dup.map((n) => n.code));

const tree = {
	id: 'content-waddell',
	name: 'Waddell sequence (AP Physics 1 reorganized)',
	levels: ['Unit', 'Topic', 'Subtopic', 'Learning objective', 'Essential knowledge', 'Detail'],
	kindLevels: { unit: 0, topic: 1, subtopic: 2, lo: 3, ek: 4, detail: 5 },
	nodes
};

// suggested skills: union over the AP topics a new topic draws from
const suggested = {};
for (const [tk, apTopics] of apTopicsOf) {
	const set = new Set();
	for (const t of apTopics) for (const s of AP.suggestedSkills['c-' + t] || []) set.add(s);
	if (set.size) suggested['w-' + tk] = [...set].sort();
}

// quiz bank: placed by QUIZ_TOPIC, linked to the LO copies of their AP topics inside that unit
const topicNodeIds = new Set(nodes.filter((n) => n.kind === 'topic').map((n) => n.id));
const unitOfNode = (id) => {
	let n = nodes.find((x) => x.id === id);
	while (n && n.parentId) n = nodes.find((x) => x.id === n.parentId);
	return n && n.id;
};
const bank = AP.activityBank.map((q) => {
	const apCodes = q.objectiveIds.map((id) => byId.get(id).code);
	let topicKey = QUIZ_TOPIC[q.code];
	if (!topicKey) {
		const lo = nodes.find((n) => n.kind === 'lo' && apCodes.some((c) => n.code.startsWith(c + '.')) && unitOfNode(n.id) === 'w-UX');
		topicKey = lo ? nodes.find((n) => n.id === unitOfNode(lo.id) && false) : null;
		// leftover quizzes: the leftover topic holding their first AP topic
		const lt = apCodes.map((c) => 'UX.' + c).find((k) => topicNodeIds.has('w-' + k));
		topicKey = lt || null;
	}
	const unitId = topicKey ? unitOfNode('w-' + topicKey) : null;
	let ids = nodes.filter((n) => n.kind === 'lo' && apCodes.some((c) => n.code.startsWith(c + '.') || n.code === c) && (!unitId || unitOfNode(n.id) === unitId)).map((n) => n.id);
	if (!ids.length) ids = nodes.filter((n) => n.kind === 'lo' && apCodes.some((c) => n.code.startsWith(c + '.'))).map((n) => n.id);
	if (apCodes.every((c) => c.startsWith('0.'))) ids = apCodes.map((c) => 'w-' + c);
	return { ...q, objectiveIds: ids, apCodes, placeTopic: topicKey ? 'w-' + topicKey : null };
});

const seed = {
	id: 'waddell-sequence',
	title: 'Waddell sequence (AP Physics 1 reorganized)',
	data: { objectiveTrees: [tree, AP.objectiveTrees[1]], suggestedSkills: suggested, activityBank: bank }
};
const out = path.join(__dirname, '../phys/js/scheduler-seed-waddell.js');
fs.writeFileSync(
	out,
	`/* Theta Scheduler seed: the Waddell sequence — AP Physics 1 LOs and EKs reorganized into
   Unit 0, 1 (1D uniform motion), 2a (accelerating motion), 2b (1D non-equilibrium), 3 (2D motion), 4 (rotation),
   plus "Not yet placed" for AP content outside the sequence. Generated by tools/build-waddell-seed.js — edit that, not this. */
'use strict';
window.HT = window.HT || {};
(HT.schedulerSeeds = HT.schedulerSeeds || {})['waddell-sequence'] = ${JSON.stringify(seed)};
`
);

// report
const report = [];
for (const u of nodes.filter((n) => !n.parentId)) {
	report.push(`${u.code} ${u.text}  [${u.meta.durationMeetings} meetings]`);
	for (const t of nodes.filter((n) => n.parentId === u.id)) {
		const los = (id) => nodes.filter((n) => n.parentId === id && n.kind === 'lo').map((n) => n.code + (n.meta.partial ? '*' : ''));
		report.push(`   ${t.code} ${t.text} (${t.meta.durationMeetings})  ${los(t.id).join(' ')}`);
		for (const s of nodes.filter((n) => n.parentId === t.id && n.kind === 'subtopic')) {
			report.push(`      ${s.code} ${s.text}  ${los(s.id).join(' ')}`);
			for (const s2 of nodes.filter((n) => n.parentId === s.id && n.kind === 'subtopic')) report.push(`         ${s2.code} ${s2.text}  ${los(s2.id).join(' ')}`);
		}
	}
}
console.log(report.join('\n'));
console.log(`\n${nodes.length} nodes · ${Object.keys(suggested).length} topics with suggested skills · ${bank.filter((b) => b.placeTopic).length}/${bank.length} quizzes placed · wrote ${path.relative(process.cwd(), out)}`);
