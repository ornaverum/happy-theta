/* Theta Questions — file formats.
   Export: Canvas QTI 1.2 package (.zip; Classic Quizzes import it, New Quizzes too), CSV.
   Import: Canvas/QTI 1.2 (.zip or .xml), Moodle GIFT, Aiken, CSV, plain-text quick entry,
           Google Forms (JSON from the Apps Script in QF.GOOGLE_SCRIPT), Happy Theta bank/quiz files.
   Needs qb-core.js. Runs in the browser; everything except QTI import (needs DOMParser) also runs in Node. */
(function () {
	'use strict';
	const G = typeof window !== 'undefined' ? window : globalThis;
	const HT = (G.HT = G.HT || {});
	const QB = HT.QB || (typeof require !== 'undefined' ? require('./qb-core.js') : null);
	const QF = {};

	const enc = new TextEncoder();
	const dec = new TextDecoder();
	const bytes = (d) => (typeof d === 'string' ? enc.encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d));

	/* =====================================================================
	   Zip (store-only writer; reader handles stored + deflated entries)
	   ===================================================================== */
	const CRC = (() => {
		const t = new Uint32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			t[n] = c >>> 0;
		}
		return t;
	})();
	const crc32 = (b) => {
		let c = 0xffffffff;
		for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};
	QF.zip = function (files) {
		const parts = [], central = [];
		let off = 0;
		const d = new Date();
		const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
		const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
		for (const f of files) {
			const name = enc.encode(f.name), data = bytes(f.data), crc = crc32(data);
			const h = new DataView(new ArrayBuffer(30));
			h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
			h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
			h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
			parts.push(new Uint8Array(h.buffer), name, data);
			const c = new DataView(new ArrayBuffer(46));
			c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
			c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
			c.setUint16(28, name.length, true); c.setUint32(42, off, true);
			central.push(new Uint8Array(c.buffer), name);
			off += 30 + name.length + data.length;
		}
		const cSize = central.reduce((s, p) => s + p.length, 0);
		const e = new DataView(new ArrayBuffer(22));
		e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
		e.setUint32(12, cSize, true); e.setUint32(16, off, true);
		const all = [...parts, ...central, new Uint8Array(e.buffer)];
		const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
		let p = 0;
		for (const a of all) { out.set(a, p); p += a.length; }
		return out;
	};
	async function inflateRaw(data) {
		if (typeof DecompressionStream === 'undefined') throw new Error('This browser can’t unzip files; unzip it first and choose the .xml file.');
		const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
		return new Uint8Array(await new Response(s).arrayBuffer());
	}
	QF.isZip = (b) => b && b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;
	/* → Map(name → Uint8Array) */
	QF.unzip = async function (buf) {
		const b = bytes(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
		let e = b.length - 22;
		while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
		if (e < 0) throw new Error('That zip file looks damaged.');
		const n = v.getUint16(e + 10, true);
		let p = v.getUint32(e + 16, true);
		const out = new Map();
		for (let i = 0; i < n; i++) {
			if (v.getUint32(p, true) !== 0x02014b50) break;
			const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
			const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
			const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
			const lnl = v.getUint16(lo + 26, true), lxl = v.getUint16(lo + 28, true);
			const raw = b.subarray(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + csize);
			if (!name.endsWith('/')) out.set(name, method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null);
			p += 46 + nl + xl + cl;
		}
		return out;
	};

	/* =====================================================================
	   Small helpers
	   ===================================================================== */
	const x = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	const hex = () => 'g' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
	const fnum = (n) => (Number.isFinite(n) ? String(QB.clean(n)) : '0');
	const b64 = (u8) => {
		if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
		let s = '';
		for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
		return btoa(s);
	};
	const unb64 = (s) => {
		if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
		const bin = atob(s), u = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
		return u;
	};
	const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' };
	const EXT_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
	QF.slug = (s, d = 'quiz') => String(s || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || d;

	/* HTML → the bank's markup. Images: onImg(src, alt) returns replacement text. */
	QF.htmlToText = function (html, onImg) {
		let s = String(html || '');
		s = s.replace(/<img\b[^>]*>/gi, (tag) => {
			const attr = (n) => {
				const m = new RegExp('\\b' + n + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(tag);
				return m ? QF.decodeEntities(m[2] != null ? m[2] : m[3]) : '';
			};
			const eq = attr('data-equation-content') || (/equation_image/.test(tag) ? attr('alt') || attr('title') : '');
			if (eq) return '\\(' + eq + '\\)';
			return onImg ? onImg(attr('src'), attr('alt')) || '' : '';
		});
		s = s
			.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<li\b[^>]*>/gi, '\n• ')
			.replace(/<\/(p|div|h[1-6]|li|tr|table|ul|ol|blockquote)>/gi, '\n\n')
			.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (a, t, inner) => (inner.trim() ? '**' + inner + '**' : inner))
			.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (a, t, inner) => (inner.trim() ? '*' + inner + '*' : inner))
			.replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, (a, inner) => (/\s/.test(inner.trim()) || !inner.trim() ? inner : '^' + inner.trim() + '^'))
			.replace(/<sub\b[^>]*>([\s\S]*?)<\/sub>/gi, (a, inner) => (/\s/.test(inner.trim()) || !inner.trim() ? inner : '~' + inner.trim() + '~'))
			.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
			.replace(/<[^>]+>/g, '');
		s = QF.decodeEntities(s).replace(/\u00a0/g, ' ');
		return s.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
	};
	QF.decodeEntities = (s) =>
		String(s || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|deg|times|minus|plusmn|middot|micro|Omega|theta|Delta|mu|pi|alpha|beta|omega|rarr|le|ge|ne|asymp|sup2|sup3|frac12);/gi, (m, e) => {
			if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
			const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', deg: '°', times: '×', minus: '−', plusmn: '±', middot: '·', micro: 'µ', Omega: 'Ω', theta: 'θ', Delta: 'Δ', mu: 'μ', pi: 'π', alpha: 'α', beta: 'β', omega: 'ω', rarr: '→', le: '≤', ge: '≥', ne: '≠', asymp: '≈', sup2: '²', sup3: '³', frac12: '½' };
			return map[e] != null ? map[e] : map[e.toLowerCase()] != null ? map[e.toLowerCase()] : m;
		});

	/* =====================================================================
	   Canvas QTI 1.2 export
	   quiz = { title, description, settings: { shuffleAnswers, timeLimit, attempts, oneAtATime, cantGoBack,
	            showCorrect }, unitHint,
	            entries: [ { kind: 'q', q, mode, variants, points }
	                     | { kind: 'group', title, pick, points, items: [{ q, mode, variants }] } ] }
	   mode for questions with values: 'formula' (Canvas Formula question, numerical only), 'variants'
	   (N rolls; outside a group they become a "pick 1" group), 'fixed' (one roll). Default: formula when
	   possible, else variants.
	   ===================================================================== */

	/* Can this question be a Canvas Formula question? → '' or the reason it can't. */
	QF.formulaProblem = function (q) {
		if (q.type !== 'num') return 'Only numerical questions can be Canvas formula questions.';
		if (!QB.isRandom(q)) return 'It has no ranges to randomize.';
		const varNames = new Set(q.vars.map((v) => v.name));
		for (const t of [q.stem, q.feedback.correct, q.feedback.incorrect, q.feedback.general, q.solution]) {
			if (QB.hasExprTemplate(t)) return 'Canvas can’t show {=…} worked values in the text.';
			if (/\{[A-Za-z_]\w*:\d+[sf]\}/.test(t || '') && [...QB.templateNames(t)].some((n) => varNames.has(n))) return 'Canvas can’t format variables ({name:3s}).';
			for (const n of QB.templateNames(t)) if (!varNames.has(n) && q.calcs.some((c) => c.name === n)) return `Canvas can’t show the worked value {${n}} in the text.`;
		}
		for (const v of q.vars) if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(v.name)) return `Canvas variable names must start with a letter (${v.name}).`;
		try {
			QB.toCanvas(QF.inlineCalcs(q));
		} catch (e) {
			return e.message;
		}
		return '';
	};
	/* The answer formula with worked values substituted in (Canvas gets a single formula). */
	QF.inlineCalcs = function (q) {
		const defs = {};
		const sub = (n) => {
			if (n.t === 'var' && defs[n.n]) return defs[n.n];
			const c = { ...n };
			if (c.a) c.a = sub(c.a);
			if (c.b) c.b = sub(c.b);
			if (c.args) c.args = c.args.map(sub);
			return c;
		};
		for (const c of q.calcs) defs[c.name] = sub(QB.parse(c.expr));
		return sub(QB.parse(q.answer.expr));
	};
	QF.defaultMode = (q) => (!QB.hasMath(q) || !QB.isRandom(q) ? 'fixed' : QF.formulaProblem(q) ? 'variants' : 'formula');

	function mat(html) {
		return `<material><mattext texttype="text/html">${x(html)}</mattext></material>`;
	}
	function meta(fields) {
		return '<itemmetadata><qtimetadata>' + Object.entries(fields).map(([k, v]) => `<qtimetadatafield><fieldlabel>${k}</fieldlabel><fieldentry>${x(v)}</fieldentry></qtimetadatafield>`).join('') + '</qtimetadata></itemmetadata>';
	}
	const fb = (id, html) => (html ? `<itemfeedback ident="${id}"><flow_mat>${mat(html)}</flow_mat></itemfeedback>` : '');
	const OUTCOMES = '<outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>';

	/* One item from an instance (a question with values filled in). ctx collects image files. */
	function itemXml(inst, q, points, ctx, opts) {
		const ident = hex();
		let stem = QB.toHtml(inst.stem);
		if (q.type === 'num' && opts.unitHint !== false && q.answer.unit) stem += `<p><em>Give your answer in ${QB.toHtml(q.answer.unit, { para: false })}.</em></p>`;
		if (q.image) stem += `<p><img src="${ctx.addImage(q.image)}" alt="${x(q.image.alt || '')}"></p>`;
		const general = [inst.feedback.general, inst.solution ? (inst.feedback.general ? '\n\n' : '') + '**Solution:** ' + inst.solution : ''].join('');
		const gfb = general.trim() ? QB.toHtml(general) : '';
		const cfb = inst.feedback.correct.trim() ? QB.toHtml(inst.feedback.correct) : '';
		const ifb = inst.feedback.incorrect.trim() ? QB.toHtml(inst.feedback.incorrect) : '';
		const pre = gfb ? '<respcondition continue="Yes"><conditionvar><other/></conditionvar><displayfeedback feedbacktype="Response" linkrefid="general_fb"/></respcondition>' : '';
		const correctFb = cfb ? '<displayfeedback feedbacktype="Response" linkrefid="correct_fb"/>' : '';
		const post = ifb ? '<respcondition continue="Yes"><conditionvar><other/></conditionvar><displayfeedback feedbacktype="Response" linkrefid="general_incorrect_fb"/></respcondition>' : '';
		const fbs = fb('general_fb', gfb) + fb('correct_fb', cfb) + fb('general_incorrect_fb', ifb);
		const pts = Number(points != null ? points : q.points) || 0;
		let typeName, pres, proc, extraFb = '';
		if (q.type === 'mc' || q.type === 'ma') {
			const choices = inst.choices.filter((c) => String(c.text).trim()).map((c, i) => ({ ...c, ident: String(1000 + ctx.next++) }));
			const multi = q.type === 'ma';
			typeName = multi ? 'multiple_answers_question' : 'multiple_choice_question';
			pres = `<response_lid ident="response1" rcardinality="${multi ? 'Multiple' : 'Single'}"><render_choice>` + choices.map((c) => `<response_label ident="${c.ident}">${mat(QB.toHtml(c.text, { para: false }))}</response_label>`).join('') + '</render_choice></response_lid>';
			const perAnswer = choices.filter((c) => c.feedback && c.feedback.trim()).map((c) => {
				extraFb += fb(c.ident + '_fb', QB.toHtml(c.feedback));
				return `<respcondition continue="Yes"><conditionvar><varequal respident="response1">${c.ident}</varequal></conditionvar><displayfeedback feedbacktype="Response" linkrefid="${c.ident}_fb"/></respcondition>`;
			}).join('');
			const cond = multi
				? '<and>' + choices.map((c) => (c.correct ? `<varequal respident="response1">${c.ident}</varequal>` : `<not><varequal respident="response1">${c.ident}</varequal></not>`)).join('') + '</and>'
				: `<varequal respident="response1">${(choices.find((c) => c.correct) || choices[0]).ident}</varequal>`;
			proc = pre + perAnswer + `<respcondition continue="No"><conditionvar>${cond}</conditionvar><setvar action="Set" varname="SCORE">100</setvar>${correctFb}</respcondition>` + post;
			ctx.meta = { original_answer_ids: choices.map((c) => c.ident).join(',') };
		} else if (q.type === 'num') {
			typeName = 'numerical_question';
			const v = inst.answer.value, [lo, hi] = inst.range;
			pres = '<response_str ident="response1" rcardinality="Single"><render_fib fibtype="Decimal"><response_label ident="answer1"/></render_fib></response_str>';
			proc = pre + `<respcondition continue="No"><conditionvar><or><varequal respident="response1">${fnum(v)}</varequal><and><vargte respident="response1">${fnum(Math.min(lo, hi))}</vargte><varlte respident="response1">${fnum(Math.max(lo, hi))}</varlte></and></or></conditionvar><setvar action="Set" varname="SCORE">100</setvar>${correctFb}</respcondition>` + post;
			ctx.meta = {};
		} else {
			typeName = 'matching_question';
			const pairs = inst.pairs.filter((p) => String(p.left).trim() && String(p.right).trim());
			const rights = [];
			const rid = new Map();
			for (const r of [...pairs.map((p) => p.right), ...inst.distractors]) {
				const k = r.trim();
				if (!rid.has(k)) { rid.set(k, String(2000 + ctx.next++)); rights.push(k); }
			}
			const plain = (t) => `<material><mattext texttype="text/plain">${x(QB.toPlain(t))}</mattext></material>`;
			const labels = rights.map((r) => `<response_label ident="${rid.get(r)}">${plain(r)}</response_label>`).join('');
			const lefts = pairs.map((p) => ({ ...p, ident: 'response_' + (3000 + ctx.next++) }));
			pres = lefts.map((p) => `<response_lid ident="${p.ident}">${plain(p.left)}<render_choice>${labels}</render_choice></response_lid>`).join('');
			const each = (100 / lefts.length).toFixed(2);
			proc = pre + lefts.map((p) => `<respcondition><conditionvar><varequal respident="${p.ident}">${rid.get(p.right.trim())}</varequal></conditionvar><setvar varname="SCORE" action="Add">${each}</setvar></respcondition>`).join('') + post;
			ctx.meta = {};
		}
		return `<item ident="${ident}" title="${x(q.title || 'Question')}">` + meta({ question_type: typeName, points_possible: pts.toFixed(1), ...ctx.meta, assessment_question_identifierref: hex() }) + `<presentation>${mat(stem)}${pres}</presentation><resprocessing>${OUTCOMES}${proc}</resprocessing>${fbs}${extraFb}</item>`;
	}

	function formulaItemXml(q, points, ctx, opts) {
		const sets = [];
		const seen = new Set();
		const want = Math.max(1, Math.min(200, Number(opts.formulaSets) || 50));
		for (let s = 1; sets.length < want && s < want * 20; s++) {
			const r = QB.roll(q, s * 7919);
			if (!r.ok) continue;
			const key = q.vars.map((v) => r.scope[v.name]).join('|');
			if (seen.has(key)) continue;
			seen.add(key);
			const ans = QB.evaluate(q.answer.expr, r.scope);
			if (Number.isFinite(ans)) sets.push({ scope: r.scope, ans });
		}
		const mags = sets.map((s) => Math.abs(s.ans)).sort((a, b) => a - b);
		const typical = mags[Math.floor(mags.length / 2)] || 1;
		const dp = Math.min(8, QB.decimalsForSig(typical, q.answer.sigfigs || 3));
		const tol = q.answer.tolMode === '%' ? `${QB.clean(q.answer.tol)}%` : fnum(q.answer.tol);
		const toCanvasText = (t) => String(t || '').replace(/\{([A-Za-z_]\w*)\}/g, (a, n) => (q.vars.some((v) => v.name === n) ? `[${n}]` : a));
		const inst = {
			stem: toCanvasText(q.stem),
			feedback: { correct: toCanvasText(q.feedback.correct), incorrect: toCanvasText(q.feedback.incorrect), general: toCanvasText(q.feedback.general) },
			solution: toCanvasText(q.solution)
		};
		let stem = QB.toHtml(inst.stem);
		if (opts.unitHint !== false && q.answer.unit) stem += `<p><em>Give your answer in ${QB.toHtml(q.answer.unit, { para: false })}.</em></p>`;
		if (q.image) stem += `<p><img src="${ctx.addImage(q.image)}" alt="${x(q.image.alt || '')}"></p>`;
		const general = [inst.feedback.general, inst.solution ? (inst.feedback.general ? '\n\n' : '') + '**Solution:** ' + inst.solution : ''].join('');
		const gfb = general.trim() ? QB.toHtml(general) : '';
		const pts = Number(points != null ? points : q.points) || 0;
		const formula = QB.toCanvas(QF.inlineCalcs(q));
		const vars = q.vars.map((v) => `<var name="${x(v.name)}" scale="${QB.varDecimals(v)}"><min>${fnum(v.min)}</min><max>${fnum(v.max)}</max></var>`).join('');
		const vs = sets.map((s, i) => `<var_set ident="${1000 + i}">` + q.vars.map((v) => `<var name="${x(v.name)}">${fnum(s.scope[v.name])}</var>`).join('') + `<answer>${fnum(Number(s.ans.toFixed(dp)))}</answer></var_set>`).join('');
		return (
			`<item ident="${hex()}" title="${x(q.title || 'Question')}">` +
			meta({ question_type: 'calculated_question', points_possible: pts.toFixed(1), assessment_question_identifierref: hex() }) +
			`<presentation>${mat(stem)}<response_str ident="response1" rcardinality="Single"><render_fib fibtype="Decimal"><response_label ident="answer1"/></render_fib></response_str></presentation>` +
			`<resprocessing>${OUTCOMES}${gfb ? '<respcondition continue="Yes"><conditionvar><other/></conditionvar><displayfeedback feedbacktype="Response" linkrefid="general_fb"/></respcondition>' : ''}<respcondition title="correct"><conditionvar><other/></conditionvar><setvar varname="SCORE" action="Set">100</setvar></respcondition><respcondition title="incorrect"><conditionvar><not><other/></not></conditionvar><setvar varname="SCORE" action="Set">0</setvar></respcondition></resprocessing>` +
			`<itemproc_extension><calculated><answer_tolerance>${tol}</answer_tolerance><formulas decimal_places="${dp}"><formula>${x(formula)}</formula></formulas><vars>${vars}</vars><var_sets>${vs}</var_sets></calculated></itemproc_extension>` +
			fb('general_fb', gfb) +
			'</item>'
		);
	}

	/* Rolls for 'variants': distinct texts where possible. */
	QF.variants = function (q, n) {
		const out = [], seen = new Set();
		for (let s = 1; out.length < n && s <= n * 30; s++) {
			const inst = QB.instantiate(q, s * 104729);
			const key = JSON.stringify([inst.stem, inst.choices, inst.pairs, inst.answer && inst.answer.value]);
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(inst);
		}
		return out;
	};

	QF.toQTI = function (quiz, opts = {}) {
		const warnings = [];
		const aid = hex();
		const images = new Map(); // data → file name
		const ctx = {
			next: 1,
			addImage(img) {
				if (!img.data) return ''; // picture missing on this computer (QB.check reports it)
				if (!images.has(img.data)) {
					const ext = MIME_EXT[img.mime] || (img.name.split('.').pop() || 'png').toLowerCase();
					let base = QF.slug(String(img.name).replace(/\.[^.]+$/, ''), 'image');
					let name = `${base}.${ext}`, i = 2;
					while ([...images.values()].includes(name)) name = `${base}-${i++}.${ext}`;
					images.set(img.data, name);
				}
				return '$IMS-CC-FILEBASE$/Uploaded%20Media/' + encodeURIComponent(images.get(img.data));
			}
		};
		const o = { unitHint: quiz.unitHint !== false, formulaSets: quiz.formulaSets || opts.formulaSets || 50 };
		let total = 0, count = 0;
		const label = (q) => '“' + QB.excerpt(q, 50) + '”';
		/* items for one question in a given mode → { xml: [items], group: bool } */
		function render(e, points) {
			const q = QB.normalize(e.q);
			const errs = QB.errors(q);
			if (errs.length) warnings.push(`${label(q)}: ${errs[0].msg}`);
			let mode = e.mode || QF.defaultMode(q);
			if (!QB.hasMath(q)) mode = 'fixed';
			if (mode === 'formula') {
				const why = QF.formulaProblem(q);
				if (why) { warnings.push(`${label(q)}: exported as variants (${why})`); mode = 'variants'; }
			}
			if (mode === 'variants' && !QB.isRandom(q)) mode = 'fixed';
			if (mode === 'formula') return { items: [formulaItemXml(q, points, ctx, o)], many: false };
			if (mode === 'variants') {
				const n = Math.max(2, Math.min(50, Number(e.variants) || 5));
				const vs = QF.variants(q, n);
				if (vs.length < n) warnings.push(`${label(q)}: only ${vs.length} different versions possible.`);
				return { items: vs.map((inst) => itemXml(inst, q, points, ctx, o)), many: vs.length > 1 };
			}
			return { items: [itemXml(QB.instantiate(q, QB.isRandom(q) ? 12345 : 'base'), q, points, ctx, o)], many: false };
		}
		const parts = [];
		for (const e of quiz.entries || []) {
			if (e.kind === 'group') {
				const items = [];
				const pts = Number(e.points) || 1;
				for (const it of e.items || []) items.push(...render(it, pts).items);
				if (!items.length) continue;
				const pick = Math.max(1, Math.min(items.length, Number(e.pick) || 1));
				if ((e.items || []).some((it) => (it.mode || QF.defaultMode(QB.normalize(it.q))) === 'variants' && QB.isRandom(QB.normalize(it.q))))
					warnings.push(`Group “${e.title || 'Group'}”: variants are added to the group's pool, so a randomized question is more likely to be picked.`);
				parts.push(`<section ident="${hex()}" title="${x(e.title || 'Question group')}"><selection_ordering><selection><selection_number>${pick}</selection_number><selection_extension><points_per_item>${pts.toFixed(1)}</points_per_item></selection_extension></selection></selection_ordering>${items.join('')}</section>`);
				total += pick * pts;
				count += pick;
			} else if (e.q) {
				const pts = Number(e.points != null ? e.points : e.q.points) || 0;
				const r = render(e, pts);
				if (r.many) parts.push(`<section ident="${hex()}" title="${x(QB.excerpt(QB.normalize(e.q), 60) || 'Versions')}"><selection_ordering><selection><selection_number>1</selection_number><selection_extension><points_per_item>${pts.toFixed(1)}</points_per_item></selection_extension></selection></selection_ordering>${r.items.join('')}</section>`);
				else parts.push(...r.items);
				total += pts;
				count++;
			}
		}
		const st = quiz.settings || {};
		const title = quiz.title || 'Quiz';
		const qti =
			'<?xml version="1.0" encoding="UTF-8"?>\n<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">' +
			`<assessment ident="${aid}" title="${x(title)}"><qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>${st.attempts > 0 ? st.attempts : 'unlimited'}</fieldentry></qtimetadatafield></qtimetadata>` +
			`<section ident="root_section">${parts.join('')}</section></assessment></questestinterop>\n`;
		const bool = (v) => (v ? 'true' : 'false');
		const metaXml =
			'<?xml version="1.0" encoding="UTF-8"?>\n<quiz identifier="' + aid + '" xmlns="http://canvas.instructure.com/xsd/cccv1p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">' +
			`<title>${x(title)}</title><description>${x(quiz.description ? QB.toHtml(quiz.description) : '')}</description>` +
			`<shuffle_answers>${bool(st.shuffleAnswers !== false)}</shuffle_answers><scoring_policy>keep_highest</scoring_policy><hide_results></hide_results><quiz_type>assignment</quiz_type>` +
			`<points_possible>${total.toFixed(1)}</points_possible><require_lockdown_browser>false</require_lockdown_browser><require_lockdown_browser_for_results>false</require_lockdown_browser_for_results><require_lockdown_browser_monitor>false</require_lockdown_browser_monitor>` +
			`<show_correct_answers>${bool(!!st.showCorrect)}</show_correct_answers><anonymous_submissions>false</anonymous_submissions><could_be_locked>false</could_be_locked>` +
			(st.timeLimit > 0 ? `<time_limit>${Math.round(st.timeLimit)}</time_limit>` : '') +
			`<allowed_attempts>${st.attempts > 0 ? Math.round(st.attempts) : -1}</allowed_attempts><one_question_at_a_time>${bool(!!st.oneAtATime)}</one_question_at_a_time><cant_go_back>${bool(!!st.oneAtATime && !!st.cantGoBack)}</cant_go_back>` +
			`<available>false</available><one_time_results>false</one_time_results><show_correct_answers_last_attempt>false</show_correct_answers_last_attempt><only_visible_to_overrides>false</only_visible_to_overrides><module_locked>false</module_locked></quiz>\n`;
		const imgList = [...images.entries()];
		const manifest =
			'<?xml version="1.0" encoding="UTF-8"?>\n<manifest identifier="' + hex() + '" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" xmlns:lom="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource" xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lomresource_v1p0.xsd http://www.imsglobal.org/xsd/imsmd_v1p2 http://www.imsglobal.org/xsd/imsmd_v1p2p2.xsd">' +
			`<metadata><schema>IMS Content</schema><schemaversion>1.1.3</schemaversion><imsmd:lom><imsmd:general><imsmd:title><imsmd:string>${x(title)}</imsmd:string></imsmd:title></imsmd:general><imsmd:lifeCycle><imsmd:contribute><imsmd:date><imsmd:dateTime>${new Date().toISOString().slice(0, 10)}</imsmd:dateTime></imsmd:date></imsmd:contribute></imsmd:lifeCycle></imsmd:lom></metadata>` +
			'<organizations/><resources>' +
			`<resource identifier="${aid}" type="imsqti_xmlv1p2"><file href="${aid}/${aid}.xml"/><dependency identifierref="${aid}_meta"/></resource>` +
			`<resource identifier="${aid}_meta" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="${aid}/assessment_meta.xml"><file href="${aid}/assessment_meta.xml"/></resource>` +
			imgList.map(([, name], i) => `<resource identifier="img${i}_${aid}" type="webcontent" href="web_resources/Uploaded Media/${x(name)}"><file href="web_resources/Uploaded Media/${x(name)}"/></resource>`).join('') +
			'</resources></manifest>\n';
		const files = [
			{ name: 'imsmanifest.xml', data: manifest },
			{ name: `${aid}/${aid}.xml`, data: qti },
			{ name: `${aid}/assessment_meta.xml`, data: metaXml },
			...imgList.map(([data, name]) => ({ name: `web_resources/Uploaded Media/${name}`, data: unb64(data.slice(data.indexOf(',') + 1)) }))
		];
		return { files, zip: QF.zip(files), warnings, total, count, qti };
	};

	/* =====================================================================
	   Canvas / QTI 1.2 import (needs a DOMParser)
	   → { title, questions, structure: [{kind:'q', id} | {kind:'group', title, pick, points, ids}], warnings }
	   ===================================================================== */
	QF.DOMParser = null;
	QF.fromQTI = async function (input, name = '') {
		const warnings = [];
		let files = new Map();
		if (QF.isZip(input)) files = await QF.unzip(input);
		else files.set(name || 'quiz.xml', bytes(input));
		const P = QF.DOMParser || G.DOMParser;
		if (!P) throw new Error('No XML parser available.');
		const xmlNames = [...files.keys()].filter((n) => /\.xml$/i.test(n) && !/imsmanifest\.xml$|assessment_meta\.xml$/i.test(n));
		const out = { title: '', questions: [], structure: [], warnings, format: 'Canvas/QTI' };
		const skipped = {};
		const imgCache = new Map();
		const findFile = (src, base) => {
			let path = decodeURIComponent(String(src).replace(/^\$IMS[-_]CC[-_]FILEBASE\$\/?/, 'web_resources/').replace(/\?.*$/, ''));
			if (files.has(path)) return path;
			const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
			if (files.has(dir + path)) return dir + path;
			const tail = path.split('/').pop().toLowerCase();
			return [...files.keys()].find((k) => k.toLowerCase().endsWith('/' + tail) || k.toLowerCase() === tail) || null;
		};
		const toImage = (path) => {
			if (imgCache.has(path)) return imgCache.get(path);
			const ext = path.split('.').pop().toLowerCase();
			const mime = EXT_MIME[ext];
			const img = mime ? { name: path.split('/').pop(), mime, data: `data:${mime};base64,${b64(files.get(path))}` } : null;
			imgCache.set(path, img);
			return img;
		};
		for (const fname of xmlNames) {
			const text = dec.decode(files.get(fname));
			if (!/questestinterop/i.test(text)) {
				if (/assessmentItem|imsqti_v2|qti-assessment-item/i.test(text)) warnings.push(`${fname}: QTI 2.x isn’t supported (export as QTI 1.2 / Canvas format).`);
				continue;
			}
			const doc = new P().parseFromString(text, 'application/xml');
			const kids = (el, tag) => [...el.children].filter((c) => c.localName === tag);
			const all = (el, tag) => [...el.getElementsByTagName('*')].filter((c) => c.localName === tag);
			const first = (el, tag) => all(el, tag)[0] || null;
			const textOf = (el) => (el ? el.textContent : '');
			const asmt = first(doc, 'assessment');
			if (asmt && !out.title) out.title = asmt.getAttribute('title') || '';
			const matText = (el) => {
				const mt = el && first(el, 'mattext');
				if (!mt) return '';
				const raw = mt.textContent;
				let image = null;
				const t = (mt.getAttribute('texttype') || '').includes('html') || /<[a-z][\s\S]*>/i.test(raw)
					? QF.htmlToText(raw, (src, alt) => {
						const path = src && findFile(src, fname);
						const img = path && toImage(path);
						if (img && !image) { image = { ...img, alt: alt || '' }; return ''; }
						return alt ? `[image: ${alt}]` : '[image]';
					})
					: raw.trim();
				return { text: t, image };
			};
			const metaOf = (item) => {
				const m = {};
				for (const f of all(item, 'qtimetadatafield')) m[textOf(first(f, 'fieldlabel')).trim()] = textOf(first(f, 'fieldentry')).trim();
				return m;
			};
			const feedbacks = (item) => {
				const m = {};
				for (const f of kids(item, 'itemfeedback')) m[f.getAttribute('ident')] = (matText(f) || {}).text || '';
				return m;
			};
			const scoring = (item) => all(item, 'respcondition').filter((rc) => all(rc, 'setvar').some((s) => /SCORE/i.test(s.getAttribute('varname') || 'SCORE') && Number(s.textContent) > 0));
			function parseItem(item) {
				const m = metaOf(item);
				let qtype = m.question_type || m.cc_profile || '';
				const pres = first(item, 'presentation');
				if (!pres) return null;
				const stemM = [...pres.children].find((c) => c.localName === 'material' || c.localName === 'flow') || pres;
				const st = matText(stemM.localName === 'flow' ? first(stemM, 'material') : stemM) || { text: '' };
				const fbm = feedbacks(item);
				const lids = all(pres, 'response_lid');
				const strs = all(pres, 'response_str').concat(all(pres, 'response_num'));
				if (!qtype) {
					if (first(item, 'calculated')) qtype = 'calculated_question';
					else if (lids.length > 1) qtype = 'matching_question';
					else if (lids.length === 1) qtype = lids[0].getAttribute('rcardinality') === 'Multiple' ? 'multiple_answers_question' : 'multiple_choice_question';
					else if (strs.length && first(item, 'vargte')) qtype = 'numerical_question';
					else qtype = 'unknown';
				}
				qtype = qtype.replace(/^cc\.|\.v0p1$/g, '').replace(/^multiple_choice$/, 'multiple_choice_question').replace(/^multiple_response$/, 'multiple_answers_question').replace(/^true_false$/, 'true_false_question');
				let unit = '';
				st.text = st.text.replace(/\n*\*Give your answer in (.+?)\.\*\s*$/, (a, u) => { unit = u; return ''; });
				const base = {
					title: (item.getAttribute('title') || '').replace(/^Question$/i, ''),
					stem: st.text, image: st.image, points: Number(m.points_possible) || 1,
					feedback: { correct: fbm.correct_fb || '', incorrect: fbm.general_incorrect_fb || '', general: fbm.general_fb || '' },
					source: { kind: 'qti', name: name || fname }
				};
				if (/^(multiple_choice|true_false|multiple_answers)_question$/.test(qtype)) {
					const lid = lids[0];
					if (!lid) return null;
					const correct = new Set();
					for (const rc of scoring(item)) for (const v of all(rc, 'varequal')) if (!(v.parentElement && v.parentElement.localName === 'not')) correct.add(v.textContent.trim());
					const choices = all(lid, 'response_label').map((l) => ({ text: (matText(l) || { text: '' }).text, correct: correct.has(l.getAttribute('ident')), feedback: fbm[l.getAttribute('ident') + '_fb'] || '' }));
					const multi = qtype === 'multiple_answers_question';
					return { ...base, type: multi ? 'ma' : 'mc', choices, shuffle: (first(lid, 'render_choice') || lid).getAttribute('shuffle') !== 'No' };
				}
				if (qtype === 'matching_question') {
					const pairs = [], used = new Set(), labels = new Map();
					const corr = {};
					for (const rc of all(item, 'respcondition')) for (const v of all(rc, 'varequal')) if (all(rc, 'setvar').some((s) => Number(s.textContent) > 0)) corr[v.getAttribute('respident')] = v.textContent.trim();
					for (const lid of lids) {
						for (const l of all(lid, 'response_label')) labels.set(l.getAttribute('ident'), (matText(l) || { text: '' }).text);
						const left = (matText([...lid.children].find((c) => c.localName === 'material')) || { text: '' }).text;
						const rid = corr[lid.getAttribute('ident')];
						if (rid) used.add(rid);
						pairs.push({ left, right: rid != null ? labels.get(rid) || '' : '' });
					}
					const distractors = [...labels.entries()].filter(([id]) => !used.has(id)).map(([, t]) => t).filter((t) => t && !pairs.some((p) => p.right === t));
					return { ...base, type: 'match', pairs, distractors };
				}
				if (qtype === 'numerical_question') {
					const rc = scoring(item)[0];
					if (!rc) return null;
					const eq = first(rc, 'varequal'), ge = first(rc, 'vargte') || first(rc, 'vargt'), le = first(rc, 'varlte') || first(rc, 'varlt');
					let value, tol = 0, mode = 'abs';
					const lo = ge ? Number(ge.textContent) : NaN, hi = le ? Number(le.textContent) : NaN;
					if (eq) {
						value = Number(eq.textContent);
						if (Number.isFinite(lo) && Number.isFinite(hi)) tol = QB.clean(Math.max(value - lo, hi - value));
					} else if (Number.isFinite(lo) && Number.isFinite(hi)) {
						value = QB.clean((lo + hi) / 2);
						tol = QB.clean((hi - lo) / 2);
					} else return null;
					const pct = value ? (tol / Math.abs(value)) * 100 : 0;
					if (tol && Math.abs(pct - Math.round(pct * 10) / 10) < 1e-6 && pct <= 50) { tol = Math.round(pct * 10) / 10; mode = '%'; }
					return { ...base, type: 'num', answer: { expr: String(QB.clean(value)), unit, tol: Number(tol.toPrecision(6)), tolMode: mode, sigfigs: 3 } };
				}
				if (qtype === 'calculated_question') {
					const calc = first(item, 'calculated');
					if (!calc) return null;
					const vars = all(calc, 'var').filter((v) => v.parentElement && v.parentElement.localName === 'vars').map((v) => {
						const scale = Number(v.getAttribute('scale')) || 0;
						return { name: v.getAttribute('name'), min: Number(textOf(first(v, 'min'))), max: Number(textOf(first(v, 'max'))), step: QB.clean(10 ** -scale) };
					});
					const formulas = all(calc, 'formula').map((f) => f.textContent.trim()).filter(Boolean);
					const calcs = [];
					let answer = formulas[formulas.length - 1] || '';
					for (const f of formulas.slice(0, -1)) {
						const mm = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(f);
						if (mm) calcs.push({ name: mm[1], expr: mm[2] });
					}
					const mm = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(answer);
					if (mm) answer = mm[2];
					const tolText = textOf(first(calc, 'answer_tolerance')).trim();
					const dp = Number((first(calc, 'formulas') || { getAttribute: () => 2 }).getAttribute('decimal_places'));
					const decimal = Number.isFinite(dp) ? dp : 2;
					const ans = { expr: answer, unit, tol: Number(tolText.replace('%', '')) || 0, tolMode: tolText.includes('%') ? '%' : 'abs', sigfigs: 3 };
					const fix = (t) => String(t || '').replace(/\[([A-Za-z_]\w*)\]/g, (a, n) => (vars.some((v) => v.name === n) ? `{${n}}` : a));
					const q = { ...base, type: 'num', stem: fix(base.stem), vars, calcs, answer: ans, feedback: { correct: fix(base.feedback.correct), incorrect: fix(base.feedback.incorrect), general: fix(base.feedback.general) } };
					try { QB.parse(answer); } catch { warnings.push(`A formula question’s formula (${answer}) needs fixing by hand.`); }
					if (ans.tolMode === 'abs' && !ans.tol && decimal >= 0) { ans.tol = QB.clean(0.5 * 10 ** -decimal); }
					return q;
				}
				skipped[qtype] = (skipped[qtype] || 0) + 1;
				return null;
			}
			const root = first(doc, 'assessment') || first(doc, 'objectbank') || doc.documentElement;
			function walk(el, inGroup) {
				for (const c of [...el.children]) {
					if (c.localName === 'item') {
						const raw = parseItem(c);
						if (!raw) continue;
						const q = QB.normalize(raw);
						out.questions.push(q);
						if (inGroup) inGroup.ids.push(q.id);
						else out.structure.push({ kind: 'q', id: q.id, points: q.points });
					} else if (c.localName === 'section') {
						const sel = first(c, 'selection_number');
						if (sel && c.getAttribute('ident') !== 'root_section') {
							const g = { kind: 'group', title: c.getAttribute('title') || 'Question group', pick: Number(sel.textContent) || 1, points: Number(textOf(first(c, 'points_per_item'))) || 1, ids: [] };
							walk(c, g);
							if (!g.ids.length && first(c, 'sourcebank_ref')) warnings.push(`Group “${g.title}” draws from a Canvas question bank, which isn’t in this file.`);
							if (g.ids.length) out.structure.push(g);
						} else walk(c, inGroup);
					} else if (c.localName === 'objectbank' || c.localName === 'assessment') walk(c, inGroup);
				}
			}
			walk(root, null);
		}
		const names = { essay_question: 'essay', short_answer_question: 'fill-in-the-blank', fill_in_multiple_blanks_question: 'fill in multiple blanks', multiple_dropdowns_question: 'multiple dropdowns', file_upload_question: 'file upload', text_only_question: 'text-only', unknown: 'unrecognized' };
		for (const [t, n] of Object.entries(skipped)) warnings.push(`Skipped ${n} ${names[t] || t.replace(/_question$/, '').replace(/_/g, ' ')} question${n > 1 ? 's' : ''} (not a type this bank holds).`);
		if (!xmlNames.length) warnings.push('No QTI .xml file was found in that zip.');
		return out;
	};

	/* =====================================================================
	   GIFT (Moodle)
	   ===================================================================== */
	const GIFT_ESC = /\\([~=#{}:\\n])/g;
	const gUnesc = (s) => String(s).replace(GIFT_ESC, (a, c) => (c === 'n' ? '\n' : c));
	function giftText(s, fmt) {
		const t = String(s).trim();
		if (fmt === 'html') return QF.htmlToText(gUnesc(t));
		return gUnesc(t);
	}
	/* split at unescaped characters in set */
	function splitUnesc(s, chars) {
		const parts = [];
		let cur = '', i = 0;
		while (i < s.length) {
			if (s[i] === '\\' && i + 1 < s.length) { cur += s[i] + s[i + 1]; i += 2; continue; }
			if (chars.includes(s[i])) { parts.push(cur); cur = s[i]; i++; continue; }
			cur += s[i++];
		}
		parts.push(cur);
		return parts;
	}
	const findUnesc = (s, ch, from = 0) => {
		for (let i = from; i < s.length; i++) {
			if (s[i] === '\\') { i++; continue; }
			if (s[i] === ch) return i;
		}
		return -1;
	};
	QF.fromGIFT = function (text, name = '') {
		const warnings = [], questions = [];
		let category = '';
		const lines = String(text).replace(/\r\n?/g, '\n').split('\n').filter((l) => !/^\s*\/\//.test(l));
		const blocks = [];
		let cur = [];
		for (const l of lines) {
			if (/^\s*\$CATEGORY:/i.test(l)) { if (cur.length) blocks.push(cur.join('\n')); cur = []; blocks.push(l.trim()); continue; }
			if (!l.trim()) {
				if (cur.length && findUnesc(cur.join('\n'), '{') >= 0 && findUnesc(cur.join('\n'), '}') < 0) { cur.push(''); continue; }
				if (cur.length) blocks.push(cur.join('\n'));
				cur = [];
			} else cur.push(l);
		}
		if (cur.length) blocks.push(cur.join('\n'));
		let skipped = 0;
		for (let b of blocks) {
			const cat = /^\$CATEGORY:\s*(.*)$/i.exec(b);
			if (cat) { category = cat[1].split('/').filter(Boolean).pop() || ''; category = category.replace(/^\$\w+\$/, '').trim(); continue; }
			let title = '';
			const tm = /^\s*::((?:\\.|[^:\\]|:(?!:))*)::/.exec(b);
			if (tm) { title = gUnesc(tm[1]).trim(); b = b.slice(tm[0].length); }
			let fmt = 'moodle';
			const fm = /^\s*\[(html|markdown|plain|moodle)\]/i.exec(b);
			if (fm) { fmt = fm[1].toLowerCase(); b = b.slice(fm[0].length); }
			const open = findUnesc(b, '{');
			const close = open >= 0 ? findUnesc(b, '}', open) : -1;
			if (open < 0 || close < 0) { if (b.trim()) { skipped++; } continue; }
			const before = b.slice(0, open), after = b.slice(close + 1);
			let ans = b.slice(open + 1, close).trim();
			let stem = giftText(before, fmt) + (after.trim() ? (before.trim() ? ' _____ ' : '') + giftText(after, fmt) : '');
			stem = stem.trim();
			const base = { title, stem, source: { kind: 'gift', name }, tags: { topics: category ? [category] : [] }, feedback: { general: '' } };
			const gfi = ans.indexOf('####');
			if (gfi >= 0) { base.feedback.general = giftText(ans.slice(gfi + 4), fmt); ans = ans.slice(0, gfi).trim(); }
			if (!ans) { skipped++; continue; }
			const tf = /^(T|TRUE|F|FALSE)\b\s*(#[\s\S]*)?$/i.exec(ans);
			if (tf) {
				const isT = /^t/i.test(tf[1]);
				const fbs = splitUnesc(tf[2] || '', '#').map((s) => giftText(s.replace(/^#/, ''), fmt)).filter(Boolean);
				questions.push(QB.normalize({ ...base, type: 'mc', shuffle: false, choices: [{ text: 'True', correct: isT, feedback: isT ? fbs[1] || '' : fbs[0] || '' }, { text: 'False', correct: !isT, feedback: isT ? fbs[0] || '' : fbs[1] || '' }] }));
				continue;
			}
			if (ans[0] === '#') {
				const body = ans.slice(1).trim();
				const alts = /^[=~]/.test(body) ? splitUnesc(body, '=~').filter((s) => s.trim()) : [body];
				let best = null;
				for (const a of alts) {
					if (a[0] === '~') continue;
					let s = a.replace(/^=/, '');
					const w = /^%(-?[\d.]+)%/.exec(s);
					const weight = w ? Number(w[1]) : 100;
					if (w) s = s.slice(w[0].length);
					const [val, fbt] = [s.split('#')[0], s.split('#').slice(1).join('#')];
					let r = null;
					const range = /^\s*(-?[\d.eE+-]+)\s*\.\.\s*(-?[\d.eE+-]+)\s*$/.exec(val);
					const tolm = /^\s*(-?[\d.eE+-]+)\s*(?::\s*([\d.eE+-]+))?\s*$/.exec(val);
					if (range) r = { value: (Number(range[1]) + Number(range[2])) / 2, tol: Math.abs(Number(range[2]) - Number(range[1])) / 2 };
					else if (tolm) r = { value: Number(tolm[1]), tol: Number(tolm[2] || 0) };
					if (r && (!best || weight > best.weight)) best = { ...r, weight, fb: giftText(fbt, fmt) };
				}
				if (!best) { skipped++; continue; }
				questions.push(QB.normalize({ ...base, type: 'num', answer: { expr: String(QB.clean(best.value)), tol: QB.clean(best.tol), tolMode: 'abs' }, feedback: { ...base.feedback, correct: best.fb } }));
				continue;
			}
			const items = splitUnesc(ans, '=~').map((s) => s.trim()).filter(Boolean);
			if (items.length && items.every((s) => s[0] === '=') && items.some((s) => findUnesc(s, '-') >= 0 && /->/.test(s))) {
				const pairs = [], distractors = [];
				for (const s of items) {
					const [l, r] = s.slice(1).split(/\s*->\s*/);
					if (r == null) continue;
					if (l.trim()) pairs.push({ left: giftText(l, fmt), right: giftText(r, fmt) });
					else distractors.push(giftText(r, fmt));
				}
				questions.push(QB.normalize({ ...base, type: 'match', pairs, distractors }));
				continue;
			}
			const choices = items.map((s) => {
				const mark = s[0];
				let body = s.slice(1);
				const w = /^%(-?[\d.]+)%/.exec(body);
				const weight = w ? Number(w[1]) : mark === '=' ? 100 : 0;
				if (w) body = body.slice(w[0].length);
				const hashAt = findUnesc(body, '#');
				const textPart = hashAt >= 0 ? body.slice(0, hashAt) : body;
				return { mark, weight, text: giftText(textPart, fmt), feedback: hashAt >= 0 ? giftText(body.slice(hashAt + 1), fmt) : '' };
			});
			if (choices.length && choices.every((c) => c.mark === '=')) { skipped++; continue; } // short answer
			const positive = choices.filter((c) => c.weight > 0);
			const isMA = positive.length > 1 || (positive.length === 1 && positive[0].weight < 100);
			questions.push(QB.normalize({ ...base, type: isMA ? 'ma' : 'mc', choices: choices.map((c) => ({ text: c.text, correct: c.weight > 0, feedback: c.feedback })) }));
		}
		if (skipped) warnings.push(`Skipped ${skipped} GIFT question${skipped > 1 ? 's' : ''} that weren't multiple choice, multiple answer, numerical or matching (short answer, essay, description…).`);
		return { title: '', questions, warnings, format: 'GIFT' };
	};

	/* =====================================================================
	   Aiken
	   ===================================================================== */
	QF.fromAiken = function (text, name = '') {
		const warnings = [], questions = [];
		const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
		let stem = [], choices = [];
		let bad = 0;
		for (const l of lines) {
			const a = /^\s*ANSWER\s*:\s*([A-Za-z](?:\s*,\s*[A-Za-z])*)\s*$/i.exec(l);
			const c = /^\s*([A-Za-z])\s*[.)]\s+(.*)$/.exec(l);
			if (a) {
				const letters = a[1].toUpperCase().split(/\s*,\s*/);
				if (!stem.length || choices.length < 2) bad++;
				else questions.push(QB.normalize({ type: letters.length > 1 ? 'ma' : 'mc', stem: stem.join('\n').trim(), choices: choices.map((ch) => ({ text: ch.text, correct: letters.includes(ch.letter) })), source: { kind: 'aiken', name } }));
				stem = []; choices = [];
			} else if (c && stem.length) choices.push({ letter: c[1].toUpperCase(), text: c[2].trim() });
			else if (l.trim()) {
				if (choices.length) choices[choices.length - 1].text += ' ' + l.trim();
				else stem.push(l.trim());
			}
		}
		if (stem.length) bad++;
		if (bad) warnings.push(`${bad} Aiken question${bad > 1 ? 's' : ''} had no ANSWER: line or too few choices and were skipped.`);
		return { title: '', questions, warnings, format: 'Aiken' };
	};

	/* =====================================================================
	   Plain-text quick entry
	     1. Question text (more lines OK)
	     a) wrong
	     *b) right            (several * → multiple answer)
	     Answer: 12.5 m/s ± 2%    (numerical; "= 12.5 m/s" works too)
	     force -> newton           (matching pairs; "-> extra" with nothing on the left is a distractor)
	     Topic: …  Unit: …  Objectives: 1.2.A, 2.1  Difficulty: 3  Tags: …  Points: 2  Feedback: …  Solution: …
	   Questions start with "1." / "1)" or are separated by a blank line.
	   ===================================================================== */
	QF.parseAnswerLine = function (s) {
		const m = /^\s*(.+?)\s*(?:(?:±|\+\/-|\+-)\s*([\d.eE+-]+)\s*(%)?)?\s*$/.exec(s);
		if (!m) return null;
		let body = m[1].trim().replace(/^=\s*/, '');
		let expr = body, unit = '';
		const nm = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(.*)$/.exec(body);
		if (nm) { expr = nm[1]; unit = nm[2].trim(); }
		else {
			const um = /^(.*?)\s+\[([^\]]+)\]$/.exec(body); // "= v0*t [m]"
			if (um) { expr = um[1]; unit = um[2]; }
		}
		return { expr, unit, tol: m[2] != null ? Number(m[2]) : 2, tolMode: m[2] != null && !m[3] ? 'abs' : '%' };
	};
	QF.fromPlain = function (text, name = '') {
		const warnings = [], questions = [];
		const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
		const blocks = [];
		let cur = [];
		const flush = () => { if (cur.some((l) => l.trim())) blocks.push(cur); cur = []; };
		for (const l of lines) {
			if (/^\s*\d+\s*[.)]\s+/.test(l) && cur.some((x) => x.trim())) flush();
			if (!l.trim()) {
				const hasAns = cur.some((x) => /^\s*\*?\s*[a-zA-Z]\s*[.)]\s+|^\s*(answer\s*:|=)|->/i.test(x));
				if (hasAns) { flush(); continue; }
			}
			cur.push(l);
		}
		flush();
		let bad = 0;
		for (const blk of blocks) {
			const q = { type: '', stem: '', choices: [], pairs: [], distractors: [], tags: { topics: [], objectives: [], custom: [] }, feedback: {}, source: { kind: 'text', name } };
			const stem = [];
			let ans = null;
			for (let l of blk) {
				const t = l.trim();
				let m;
				if ((m = /^(\*?)\s*([a-zA-Z])\s*[.)]\s+(.*?)\s*(\*)?$/.exec(t)) && (stem.length || q.choices.length) && (m[1] || q.choices.length || /^[aA]$/.test(m[2]))) {
					q.choices.push({ text: m[3], correct: !!(m[1] || m[4]) });
				} else if ((m = /^(?:answer\s*:|=)\s*(.+)$/i.exec(t))) ans = QF.parseAnswerLine(m[1]);
				else if ((m = /^(.*?)\s*->\s*(.+)$/.exec(t)) && !/^(topic|unit|tags)/i.test(t)) {
					if (m[1].trim()) q.pairs.push({ left: m[1].trim(), right: m[2].trim() });
					else q.distractors.push(m[2].trim());
				} else if ((m = /^(title|topics?|unit|objectives?|difficulty|tags|points|feedback|solution|correct feedback|incorrect feedback)\s*:\s*(.*)$/i.exec(t))) {
					const k = m[1].toLowerCase(), v = m[2].trim();
					const list = v.split(/\s*[;,]\s*/).filter(Boolean);
					if (k === 'title') q.title = v;
					else if (k.startsWith('topic')) q.tags.topics.push(...list);
					else if (k === 'unit') q.tags.unit = v;
					else if (k.startsWith('objective')) q.tags.objectives.push(...list.map((code) => ({ fw: '', code })));
					else if (k === 'difficulty') q.tags.difficulty = Number(v) || 0;
					else if (k === 'tags') q.tags.custom.push(...list);
					else if (k === 'points') q.points = Number(v) || 1;
					else if (k === 'feedback') q.feedback.general = v;
					else if (k === 'correct feedback') q.feedback.correct = v;
					else if (k === 'incorrect feedback') q.feedback.incorrect = v;
					else if (k === 'solution') q.solution = v;
				} else if (!q.choices.length && !ans && !q.pairs.length) stem.push(stem.length ? l.replace(/\s+$/, '') : t.replace(/^\d+\s*[.)]\s+/, ''));
				else if (q.choices.length && t) q.choices[q.choices.length - 1].text += ' ' + t;
			}
			q.stem = stem.join('\n').trim();
			if (ans) { q.type = 'num'; q.answer = ans; }
			else if (q.pairs.length) q.type = 'match';
			else if (q.choices.length) q.type = q.choices.filter((c) => c.correct).length > 1 ? 'ma' : 'mc';
			if (!q.type || !q.stem) { bad++; continue; }
			if (q.type === 'mc' && !q.choices.some((c) => c.correct)) warnings.push(`“${QB.toPlain(q.stem).slice(0, 40)}…” has no choice marked with * — fix it in the editor.`);
			questions.push(QB.normalize(q));
		}
		if (bad) warnings.push(`${bad} block${bad > 1 ? 's' : ''} didn't look like a question (no choices, answer or pairs) and ${bad > 1 ? 'were' : 'was'} skipped.`);
		return { title: '', questions, warnings, format: 'Plain text' };
	};

	/* =====================================================================
	   CSV (one question per row; export and import use the same columns)
	   ===================================================================== */
	QF.CSV_COLUMNS = ['type', 'title', 'question', 'choices', 'correct', 'answer', 'answer_unit', 'tolerance', 'sigfigs', 'pairs', 'distractors', 'variables', 'calcs', 'condition', 'points', 'unit', 'topics', 'objectives', 'framework', 'difficulty', 'tags', 'feedback_correct', 'feedback_incorrect', 'general_feedback', 'solution'];
	QF.parseCSV = function (text) {
		const rows = [];
		let row = [], f = '', q = false;
		const s = String(text).replace(/^\uFEFF/, '');
		const delim = (() => {
			const line = s.split('\n')[0];
			const c = (ch) => line.split(ch).length;
			return c('\t') > c(',') && c('\t') > c(';') ? '\t' : c(';') > c(',') ? ';' : ',';
		})();
		for (let i = 0; i < s.length; i++) {
			const ch = s[i];
			if (q) {
				if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
				else f += ch;
			} else if (ch === '"' && !f) q = true;
			else if (ch === delim) { row.push(f); f = ''; }
			else if (ch === '\n' || ch === '\r') {
				if (ch === '\r' && s[i + 1] === '\n') i++;
				row.push(f); f = '';
				if (row.some((c) => c.trim())) rows.push(row);
				row = [];
			} else f += ch;
		}
		row.push(f);
		if (row.some((c) => c.trim())) rows.push(row);
		return rows;
	};
	const csvCell = (v) => {
		const s = String(v == null ? '' : v);
		return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
	};
	const pipeJoin = (a) => a.map((s) => String(s).replace(/\|/g, '\\|')).join(' | ');
	const pipeSplit = (s) => String(s || '').split(/\s*(?<!\\)\|\s*/).map((t) => t.replace(/\\\|/g, '|').trim()).filter(Boolean);
	const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	QF.toCSV = function (questions) {
		const lines = [QF.CSV_COLUMNS.join(',')];
		for (const q of questions) {
			const fill = q.choices.filter((c) => c.text.trim());
			const row = {
				type: q.type, title: q.title, question: q.stem,
				choices: q.type === 'mc' || q.type === 'ma' ? pipeJoin(fill.map((c) => c.text)) : '',
				correct: q.type === 'mc' || q.type === 'ma' ? fill.map((c, i) => (c.correct ? LETTERS[i] : '')).filter(Boolean).join(',') : '',
				answer: q.type === 'num' ? (QB.isNumberText(q.answer.expr) ? q.answer.expr : '=' + q.answer.expr) : '',
				answer_unit: q.type === 'num' ? q.answer.unit : '',
				tolerance: q.type === 'num' ? q.answer.tol + (q.answer.tolMode === '%' ? '%' : '') : '',
				sigfigs: q.type === 'num' ? q.answer.sigfigs : '',
				pairs: q.type === 'match' ? pipeJoin(q.pairs.map((p) => p.left + ' -> ' + p.right)) : '',
				distractors: q.type === 'match' ? pipeJoin(q.distractors) : '',
				variables: q.vars.map((v) => `${v.name}=${v.min}..${v.max}${v.step ? ' step ' + v.step : ''}`).join('; '),
				calcs: q.calcs.map((c) => `${c.name}=${c.expr}`).join('; '),
				condition: q.constraint, points: q.points, unit: q.tags.unit, topics: q.tags.topics.join('; '),
				objectives: q.tags.objectives.map((o) => o.code).join('; '), framework: (q.tags.objectives[0] || {}).fw || '',
				difficulty: q.tags.difficulty || '', tags: q.tags.custom.join('; '),
				feedback_correct: q.feedback.correct, feedback_incorrect: q.feedback.incorrect, general_feedback: q.feedback.general, solution: q.solution
			};
			lines.push(QF.CSV_COLUMNS.map((c) => csvCell(row[c])).join(','));
		}
		return lines.join('\r\n') + '\r\n';
	};
	QF.fromCSV = function (text, name = '') {
		const rows = QF.parseCSV(text);
		const warnings = [], questions = [];
		if (rows.length < 2) return { title: '', questions, warnings: ['That CSV has no question rows.'], format: 'CSV' };
		const key = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
		const head = rows[0].map(key);
		const col = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
		const C = {
			type: col('type', 'questiontype', 'qtype'), title: col('title', 'name'), stem: col('question', 'stem', 'prompt', 'text', 'questiontext'),
			choices: col('choices', 'options', 'answers'), correct: col('correct', 'correctanswer', 'correctanswers', 'key', 'answerkey'),
			answer: col('answer', 'numericanswer', 'value', 'formula'), aunit: col('answerunit', 'units', 'measurementunit'), tol: col('tolerance', 'tol', 'margin'),
			sig: col('sigfigs', 'sigfig', 'significantfigures'), pairs: col('pairs', 'matches', 'matching'), distractors: col('distractors', 'extras'),
			vars: col('variables', 'vars', 'ranges'), calcs: col('calcs', 'workedvalues', 'derived'), cond: col('condition', 'constraint'),
			points: col('points', 'pts', 'score'), unit: col('unit', 'courseunit', 'chapter'), topics: col('topics', 'topic'),
			obj: col('objectives', 'objective', 'standards', 'standard', 'lo', 'los'), fw: col('framework', 'course'), diff: col('difficulty', 'level'),
			tags: col('tags', 'tag', 'keywords'), fc: col('feedbackcorrect', 'correctfeedback'), fi: col('feedbackincorrect', 'incorrectfeedback'),
			fg: col('generalfeedback', 'feedback'), sol: col('solution', 'explanation', 'workedsolution')
		};
		if (C.stem < 0) return { title: '', questions, warnings: ['That CSV needs a "question" column (see the column list in Help).'], format: 'CSV' };
		const letterCols = [];
		head.forEach((h, i) => { const m = /^(?:choice|option|answer)?([a-h]|[1-8])$/.exec(h); if (m && h !== 'answer' && i !== C.answer) letterCols.push(i); });
		const DIFF = { veryeasy: 1, easy: 2, medium: 3, moderate: 3, hard: 4, veryhard: 5, difficult: 4 };
		const list = (s) => String(s || '').split(/\s*[;|]\s*/).map((t) => t.trim()).filter(Boolean);
		rows.slice(1).forEach((r, ri) => {
			const g = (i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : '');
			if (!g(C.stem)) return;
			let choices = C.choices >= 0 && g(C.choices) ? pipeSplit(g(C.choices)) : letterCols.map((i) => g(i)).filter(Boolean);
			const corr = g(C.correct);
			let type = key(g(C.type));
			type = { mc: 'mc', multiplechoice: 'mc', mcq: 'mc', truefalse: 'mc', tf: 'mc', ma: 'ma', multipleanswer: 'ma', multipleanswers: 'ma', checkbox: 'ma', checkboxes: 'ma', multipleresponse: 'ma', num: 'num', numerical: 'num', numeric: 'num', number: 'num', calculated: 'num', formula: 'num', match: 'match', matching: 'match' }[type] || '';
			if (key(g(C.type)) === 'truefalse' || key(g(C.type)) === 'tf') if (!choices.length) choices = ['True', 'False'];
			if (!type) type = g(C.pairs) ? 'match' : choices.length ? (corr.split(/[,;]/).filter((s) => s.trim()).length > 1 ? 'ma' : 'mc') : g(C.answer) ? 'num' : '';
			if (!type) { warnings.push(`Row ${ri + 2}: no choices, answer or pairs; skipped.`); return; }
			const q = { type, title: g(C.title), stem: g(C.stem), source: { kind: 'csv', name }, tags: {}, feedback: {} };
			if (type === 'mc' || type === 'ma') {
				const marks = corr.split(/\s*[,;]\s*/).filter(Boolean);
				const isCorrect = (text, i) => marks.some((m) => m.toUpperCase() === LETTERS[i] || m === String(i + 1) || m.toLowerCase() === text.toLowerCase());
				q.choices = choices.map((t, i) => ({ text: t, correct: isCorrect(t, i) }));
				if (!q.choices.some((c) => c.correct)) warnings.push(`Row ${ri + 2}: no correct choice found in "${corr}".`);
			}
			if (type === 'num') {
				const raw = g(C.answer).replace(/^=/, '');
				const tol = g(C.tol);
				q.answer = { expr: raw, unit: g(C.aunit), tol: tol ? Number(tol.replace('%', '')) : 2, tolMode: tol && !tol.includes('%') ? 'abs' : '%', sigfigs: Number(g(C.sig)) || 3 };
				if (!raw) {
					const p = QF.parseAnswerLine(corr);
					if (p) q.answer = { ...q.answer, ...p };
				}
			}
			if (type === 'match') {
				q.pairs = pipeSplit(g(C.pairs)).map((p) => { const [l, ...rest] = p.split(/\s*(?:->|=>|=)\s*/); return { left: l, right: rest.join(' ') }; });
				q.distractors = pipeSplit(g(C.distractors));
			}
			q.vars = list(g(C.vars)).map((v) => {
				const m = /^([A-Za-z_]\w*)\s*=\s*(-?[\d.eE+-]+)\s*(?:\.\.|to)\s*(-?[\d.eE+-]+)(?:\s*step\s*([\d.eE+-]+))?$/i.exec(v) || /^([A-Za-z_]\w*)\s*=\s*(-?[\d.eE+-]+)$/.exec(v);
				if (!m) { warnings.push(`Row ${ri + 2}: couldn't read the variable "${v}" (use name=min..max step s).`); return null; }
				return { name: m[1], min: Number(m[2]), max: Number(m[3] != null ? m[3] : m[2]), step: m[4] != null ? Number(m[4]) : null };
			}).filter(Boolean);
			q.calcs = list(g(C.calcs)).map((c) => { const i = c.indexOf('='); return i > 0 ? { name: c.slice(0, i).trim(), expr: c.slice(i + 1).trim() } : null; }).filter(Boolean);
			q.constraint = g(C.cond);
			q.points = Number(g(C.points)) || 1;
			const fw = g(C.fw);
			q.tags = { unit: g(C.unit), topics: list(g(C.topics)), objectives: list(g(C.obj).replace(/,/g, ';')).map((code) => ({ fw, code })), difficulty: Number(g(C.diff)) || DIFF[key(g(C.diff))] || 0, custom: list(g(C.tags)) };
			q.feedback = { correct: g(C.fc), incorrect: g(C.fi), general: g(C.fg) };
			q.solution = g(C.sol);
			questions.push(QB.normalize(q));
		});
		return { title: '', questions, warnings, format: 'CSV' };
	};

	/* =====================================================================
	   Google Forms (via Apps Script → JSON)
	   ===================================================================== */
	QF.GOOGLE_SCRIPT = `// Happy Theta: export a Google Forms quiz (e.g. a Google Classroom quiz assignment) as a JSON file.
// 1. Go to script.google.com → New project. Delete what's there and paste this.
// 2. Put your form's edit link (the one ending in /edit) between the quotes below.
// 3. Click Run (allow access the first time). The log shows a Drive link to the .json file:
//    download it and Import it into Theta Questions or the Quiz Builder.
const FORM_URL = 'PASTE_THE_FORM_EDIT_LINK_HERE';

function exportForm() {
  const form = FormApp.openByUrl(FORM_URL);
  const text = (f) => (f ? f.getText() : '');
  const items = form.getItems().map((it) => {
    const type = String(it.getType());
    const out = { type, title: it.getTitle(), help: it.getHelpText() };
    let q = null;
    if (type === 'MULTIPLE_CHOICE') q = it.asMultipleChoiceItem();
    else if (type === 'CHECKBOX') q = it.asCheckboxItem();
    else if (type === 'LIST') q = it.asListItem();
    if (q) {
      out.points = q.getPoints();
      out.choices = q.getChoices().map((c) => ({ value: c.getValue(), correct: c.isCorrectAnswer() }));
      out.feedbackCorrect = text(q.getFeedbackForCorrect());
      out.feedbackIncorrect = text(q.getFeedbackForIncorrect());
    } else if (type === 'TEXT') {
      const t = it.asTextItem();
      out.points = t.getPoints();
      out.generalFeedback = text(t.getGeneralFeedback());
    }
    return out;
  });
  const json = JSON.stringify({ format: 'google-form', title: form.getTitle(), description: form.getDescription(), items: items }, null, 2);
  const file = DriveApp.createFile(form.getTitle().replace(/[^\\w\\- ]+/g, '') + '.gform.json', json, 'application/json');
  Logger.log('Saved to your Drive: ' + file.getUrl());
}
`;
	QF.fromGoogleForm = function (obj, name = '') {
		const warnings = [], questions = [];
		let skippedText = 0, skippedOther = 0;
		for (const it of obj.items || []) {
			const stem = [it.title, it.help].filter((s) => s && String(s).trim()).join('\n\n');
			if (it.type === 'MULTIPLE_CHOICE' || it.type === 'LIST' || it.type === 'CHECKBOX') {
				const choices = (it.choices || []).map((c) => ({ text: String(c.value), correct: !!c.correct }));
				const nc = choices.filter((c) => c.correct).length;
				if (!nc) warnings.push(`“${String(it.title).slice(0, 40)}” has no answer key in the form; mark the right choice here.`);
				questions.push(QB.normalize({ type: it.type === 'CHECKBOX' ? 'ma' : 'mc', stem, choices, points: it.points || 1, feedback: { correct: it.feedbackCorrect || '', incorrect: it.feedbackIncorrect || '' }, source: { kind: 'google', name: obj.title || name } }));
			} else if (it.type === 'TEXT') skippedText++;
			else if (!['PAGE_BREAK', 'SECTION_HEADER', 'IMAGE', 'VIDEO'].includes(it.type)) skippedOther++;
		}
		if (skippedText) warnings.push(`Skipped ${skippedText} short-answer item${skippedText > 1 ? 's' : ''}: Google doesn't share short-answer keys with scripts. Re-enter them as numerical questions.`);
		if (skippedOther) warnings.push(`Skipped ${skippedOther} item${skippedOther > 1 ? 's' : ''} of other kinds (paragraph, grid, scale, date…).`);
		return { title: obj.title || '', questions, warnings, format: 'Google Forms' };
	};

	/* =====================================================================
	   Detect + import any file
	   ===================================================================== */
	QF.detectText = function (text, fname = '') {
		const t = String(text).trim();
		const ext = (fname.split('.').pop() || '').toLowerCase();
		if (/^[{[]/.test(t)) return 'json';
		if (/^<\?xml|<questestinterop/i.test(t)) return 'qti';
		if (ext === 'csv' || ext === 'tsv') return 'csv';
		if (ext === 'gift') return 'gift';
		if (/^\s*ANSWER\s*:\s*[A-Z]/im.test(t) && !/\{[\s\S]*[=~][\s\S]*\}/.test(t)) return 'aiken';
		if (/\{\s*(?:[=~#]|T\b|F\b|TRUE\b|FALSE\b)[\s\S]*?\}/.test(t) || /^\s*::/m.test(t) || /\$CATEGORY:/i.test(t)) return 'gift';
		const first = t.split('\n')[0].toLowerCase();
		if (/(^|[,;\t])\s*"?(question|stem|prompt)"?\s*([,;\t]|$)/.test(first)) return 'csv';
		return 'plain';
	};
	QF.importText = async function (text, fname = '') {
		const kind = QF.detectText(text, fname);
		if (kind === 'json') return QF.fromJSON(JSON.parse(text), fname);
		if (kind === 'qti') return QF.fromQTI(enc.encode(text), fname);
		if (kind === 'csv') return QF.fromCSV(text, fname);
		if (kind === 'gift') return QF.fromGIFT(text, fname);
		if (kind === 'aiken') return QF.fromAiken(text, fname);
		return QF.fromPlain(text, fname);
	};
	QF.fromJSON = function (obj, name = '') {
		if (obj && obj.format === 'google-form') return QF.fromGoogleForm(obj, name);
		if (obj && obj.format === 'happytheta' && obj.tool === 'qbank') {
			const b = QB.normalizeBank(obj.data);
			return { title: (obj.meta && obj.meta.title) || '', questions: b.questions, warnings: [], format: 'Theta Questions bank', framework: b.framework };
		}
		if (obj && obj.format === 'happytheta' && obj.tool === 'qquiz') {
			const qs = [];
			for (const e of (obj.data && obj.data.entries) || []) {
				if (e.kind === 'group') (e.items || []).forEach((it) => qs.push(QB.normalize(it.q)));
				else if (e.q) qs.push(QB.normalize(e.q));
			}
			return { title: (obj.meta && obj.meta.title) || '', questions: qs, warnings: [], format: 'Quiz Builder quiz' };
		}
		if (obj && obj.format === 'happytheta') throw new Error(`That's a ${obj.tool} file, not questions.`);
		const arr = Array.isArray(obj) ? obj : obj && Array.isArray(obj.questions) ? obj.questions : null;
		if (!arr) throw new Error('That JSON file has no questions in it.');
		return { title: (obj && obj.title) || '', questions: arr.map(QB.normalize), warnings: [], format: 'JSON' };
	};
	/* name + bytes (Uint8Array) → { title, questions, structure?, warnings, format } */
	QF.importFile = async function (fname, data) {
		const b = bytes(data);
		if (QF.isZip(b)) return QF.fromQTI(b, fname);
		const text = dec.decode(b);
		return QF.importText(text, fname);
	};

	HT.QF = QF;
	if (typeof module !== 'undefined' && module.exports) module.exports = QF;
})();
