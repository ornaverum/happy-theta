/* Theta Questions — UI pieces shared by questions.html and quiz-builder.html:
   element builder, dialogs, toast, downloads, file picking, image reading, math typesetting,
   course frameworks (objective trees from the scheduler seeds), objective picker, chip inputs,
   question preview, the import dialog, and the shared-library API. Needs qb-core.js + qb-formats.js. */
(function () {
	'use strict';
	const QB = HT.QB, QF = HT.QF;
	const U = {};

	/* ---------- elements ---------- */
	function h(tag, attrs, ...kids) {
		const e = document.createElement(tag);
		if (attrs) {
			for (const [k, v] of Object.entries(attrs)) {
				if (v == null || v === false) continue;
				if (k === 'class') e.className = v;
				else if (k === 'text') e.textContent = v;
				else if (k === 'html') e.innerHTML = v;
				else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
				else if (k === 'dataset') Object.assign(e.dataset, v);
				else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
				else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled' || k === 'indeterminate') e[k] = v;
				else e.setAttribute(k, v === true ? '' : v);
			}
		}
		for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
		return e;
	}
	U.h = h;
	/* replaceChildren that skips null/false/'' */
	U.fill = (el, ...kids) => { el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== '')); return el; };
	U.ICONS = {
		plus: '<path d="M12 5v14M5 12h14"/>',
		up: '<path d="M12 15V3m0 0L8 7m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
		down: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
		trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
		copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
		dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>',
		grip: '<circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/>',
		x: '<path d="M6 6l12 12M18 6 6 18"/>',
		img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
		cloud: '<path d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
		check: '<path d="m5 12 5 5 9-10"/>',
		warn: '<path d="M12 3 2 20h20L12 3zM12 10v4M12 17h.01"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
		chev: '<path d="m6 9 6 6 6-6"/>',
		group: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
		eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
	};
	U.icon = (name, cls = 'qi') => {
		const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('class', cls);
		s.setAttribute('fill', 'none');
		s.setAttribute('stroke', 'currentColor');
		s.setAttribute('stroke-width', '2');
		s.setAttribute('stroke-linecap', 'round');
		s.setAttribute('stroke-linejoin', 'round');
		s.setAttribute('aria-hidden', 'true');
		s.innerHTML = U.ICONS[name] || '';
		return s;
	};
	U.btn = (label, onclick, cls = '', icon, title) => h('button', { type: 'button', class: 'qb-btn ' + cls, onclick, title: title || null }, icon ? U.icon(icon) : null, label ? h('span', { text: label }) : null);

	/* ---------- dialogs ---------- */
	U.modal = function (title, body, buttons = [], { wide = false, onClose } = {}) {
		return new Promise((resolve) => {
			const msg = h('p', { class: 'qb-dlg-msg', role: 'status' });
			const foot = h('div', { class: 'qb-dlg-foot' });
			const dlg = h('dialog', { class: 'qb-dlg' + (wide ? ' wide' : '') }, h('div', { class: 'qb-dlg-head' }, h('h2', { text: title }), h('button', { type: 'button', class: 'qb-iconbtn', 'aria-label': 'Close', onclick: () => done(null) }, U.icon('x'))), h('div', { class: 'qb-dlg-body' }, body), msg, foot);
			let result = null;
			const done = (v) => { result = v; dlg.close(); };
			for (const b of buttons) {
				foot.append(h('button', { type: 'button', class: 'qb-btn ' + (b.cls || ''), onclick: async () => {
					if (!b.click) return done(b.value);
					try {
						const r = await b.click({ setMessage: (t, err = true) => { msg.textContent = t; msg.classList.toggle('error', err); } });
						if (r !== false) done(r === undefined ? b.value : r);
					} catch (e) { msg.textContent = e.message; msg.classList.add('error'); }
				} }, b.label));
			}
			dlg.addEventListener('close', () => { dlg.remove(); if (onClose) onClose(); resolve(result); });
			dlg.addEventListener('cancel', () => (result = null));
			document.body.append(dlg);
			dlg.showModal();
			const f = dlg.querySelector('[autofocus]') || dlg.querySelector('.qb-dlg-body input, .qb-dlg-body textarea, .qb-dlg-body select');
			if (f) f.focus();
		});
	};
	U.confirm = (title, text, ok = 'OK', cls = 'primary') => U.modal(title, h('p', { text }), [{ label: 'Cancel', value: false }, { label: ok, value: true, cls }]);
	U.prompt = async (title, label, value = '') => {
		const inp = h('input', { class: 'qb-input', value, autofocus: true });
		inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.closest('dialog').querySelector('.qb-btn.primary').click(); } });
		return U.modal(title, h('label', { class: 'qb-field' }, h('span', { text: label }), inp), [{ label: 'Cancel', value: null }, { label: 'OK', cls: 'primary', click: () => inp.value.trim() || false }]);
	};

	let toastEl = null;
	U.toast = function (text, { undo, error, ms = 5000 } = {}) {
		if (toastEl) toastEl.remove();
		toastEl = h('div', { class: 'qb-toast' + (error ? ' error' : ''), role: 'status' }, h('span', { text }), undo ? h('button', { type: 'button', onclick: () => { undo(); toastEl.remove(); }, text: 'Undo' }) : null);
		document.body.append(toastEl);
		const me = toastEl;
		setTimeout(() => me.remove(), ms);
	};

	/* ---------- files ---------- */
	U.download = function (name, data, mime = 'application/octet-stream') {
		const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
		const a = h('a', { href: URL.createObjectURL(blob), download: name });
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 2000);
	};
	U.pickFiles = ({ accept = '', multiple = false } = {}) =>
		new Promise((resolve) => {
			const inp = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
			inp.addEventListener('change', () => { resolve([...inp.files]); inp.remove(); });
			document.body.append(inp);
			inp.click();
		});
	U.readBytes = (file) => file.arrayBuffer().then((b) => new Uint8Array(b));
	/* An image file → { name, mime, data } (big rasters are scaled to 1000 px and recompressed) */
	U.readImage = async function (file) {
		const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
		if (!/^image\//.test(file.type)) throw new Error('That isn’t an image.');
		if (file.type === 'image/svg+xml' || file.type === 'image/gif' || file.size < 200 * 1024) return { name: file.name, mime: file.type, data: dataUrl, alt: '' };
		const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
		const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
		const c = h('canvas', { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
		const ctx = c.getContext('2d');
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, c.width, c.height);
		ctx.drawImage(img, 0, 0, c.width, c.height);
		let out = c.toDataURL('image/png');
		let mime = 'image/png';
		if (out.length > 300 * 1024) { out = c.toDataURL('image/jpeg', 0.85); mime = 'image/jpeg'; }
		return { name: file.name.replace(/\.[^.]+$/, '') + (mime === 'image/png' ? '.png' : '.jpg'), mime, data: out, alt: '' };
	};

	/* ---------- math (KaTeX from cdnjs, loaded only when a page shows math) ---------- */
	let katexLoad = null;
	const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/';
	function loadKatex() {
		if (katexLoad) return katexLoad;
		const add = (tag, attrs) => new Promise((res, rej) => document.head.append(h(tag, { ...attrs, onload: res, onerror: rej })));
		katexLoad = add('link', { rel: 'stylesheet', href: KATEX + 'katex.min.css' })
			.then(() => add('script', { src: KATEX + 'katex.min.js' }))
			.then(() => add('script', { src: KATEX + 'contrib/auto-render.min.js' }))
			.catch(() => null);
		return katexLoad;
	}
	U.typeset = function (el) {
		if (!/\\\(|\\\[/.test(el.textContent)) return;
		loadKatex().then(() => {
			if (window.renderMathInElement) try { window.renderMathInElement(el, { delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }], throwOnError: false }); } catch {}
		});
	};
	U.rich = (text, cls = '', para = true) => {
		const d = h('div', { class: 'qb-rich ' + cls, html: QB.toHtml(text, { para }) });
		U.typeset(d);
		return d;
	};

	/* ---------- frameworks (objective trees from the scheduler seeds) ---------- */
	U.FRAMEWORKS = [
		{ id: 'ap-physics-1', label: 'AP Physics 1', file: 'scheduler-seed-ap1.js', seed: 'ap-physics-1' },
		{ id: 'waddell-sequence', label: 'AP Physics 1 — Waddell sequence', file: 'scheduler-seed-waddell.js', seed: 'waddell-sequence' },
		{ id: 'ap-csa', label: 'AP Computer Science A', file: 'scheduler-seed-apcsa.js', seed: 'ap-csa' },
		{ id: 'ap-csp', label: 'AP Computer Science Principles', file: 'scheduler-seed-apcsp.js', seed: 'ap-csp' },
		{ id: 'ap-precalculus', label: 'AP Precalculus', file: 'scheduler-seed-precalc.js', seed: 'ap-precalculus' },
		{ id: 'none', label: 'No framework' }
	];
	U.fwInfo = (id) => U.FRAMEWORKS.find((f) => f.id === id) || { id, label: id || 'No framework' };
	const fwCache = {};
	const scriptBase = (() => {
		const s = document.currentScript && document.currentScript.src;
		return s ? s.slice(0, s.lastIndexOf('/') + 1) : 'js/';
	})();
	U.loadFramework = function (id) {
		if (fwCache[id]) return fwCache[id];
		const info = U.fwInfo(id);
		const ready = () => {
			const seed = HT.schedulerSeeds && HT.schedulerSeeds[info.seed];
			if (!seed) return { id, label: info.label, nodes: [], units: [], topics: [], byCode: new Map() };
			const nodes = [], byCode = new Map(), units = [], topics = [];
			for (const tree of seed.data.objectiveTrees) {
				const practices = tree.id === 'practices';
				const kids = new Map();
				for (const n of tree.nodes) (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
				for (const list of kids.values()) list.sort((a, b) => (a.order || 0) - (b.order || 0));
				const levelName = (depth) => (tree.levels || [])[depth] || '';
				const walk = (pid, depth) => {
					for (const n of kids.get(pid) || []) {
						const code = practices ? 'SP-' + n.code : n.code;
						const node = { code, text: n.text, depth, level: levelName(depth), tree: tree.name, practices, partial: !!(n.meta && n.meta.partial) };
						nodes.push(node);
						if (code && !byCode.has(code)) byCode.set(code, node);
						if (!practices && depth === 0) units.push(`${n.code} ${n.text}`.trim());
						if (!practices && depth === 1) topics.push(`${n.code} ${n.text}`.trim());
						walk(n.id, depth + 1);
					}
				};
				walk(null, 0);
			}
			return { id, label: info.label, nodes, units, topics, byCode };
		};
		if (!info.file) return (fwCache[id] = Promise.resolve(ready()));
		if (HT.schedulerSeeds && HT.schedulerSeeds[info.seed]) return (fwCache[id] = Promise.resolve(ready()));
		fwCache[id] = new Promise((res) => {
			const s = h('script', { src: scriptBase + info.file + '?v=' + (HT.QB_VERSION || '1') });
			s.onload = () => res(ready());
			s.onerror = () => res(ready());
			document.head.append(s);
		});
		return fwCache[id];
	};

	/* Pick objective codes. → Promise<[codes] | null> */
	U.pickObjectives = async function (fwId, selected = []) {
		const fw = await U.loadFramework(fwId);
		if (!fw.nodes.length) {
			const inp = h('input', { class: 'qb-input', value: selected.join(', '), placeholder: 'e.g. 1.2.A, 2.3' });
			const r = await U.modal('Objectives', h('div', null, h('p', { class: 'qb-hint', text: 'This bank has no framework, so type the codes, separated by commas.' }), inp), [{ label: 'Cancel' }, { label: 'Done', cls: 'primary', click: () => inp.value.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean) }]);
			return r;
		}
		const chosen = new Set(selected);
		const search = h('input', { class: 'qb-input', type: 'search', placeholder: 'Search codes and text…', autofocus: true });
		const showPractices = h('input', { type: 'checkbox' });
		const box = h('div', { class: 'qb-obj-tree' });
		const count = h('span', { class: 'qb-hint' });
		const draw = () => {
			const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
			U.fill(box, );
			let shown = 0;
			for (const n of fw.nodes) {
				if (n.practices && !showPractices.checked && !chosen.has(n.code)) continue;
				const hay = (n.code + ' ' + n.text).toLowerCase();
				if (words.length && !words.every((w) => hay.includes(w))) continue;
				if (++shown > 600) break;
				const cb = h('input', { type: 'checkbox', checked: chosen.has(n.code), onchange: () => { cb.checked ? chosen.add(n.code) : chosen.delete(n.code); count.textContent = chosen.size + ' chosen'; } });
				box.append(h('label', { class: 'qb-obj-row d' + Math.min(n.depth, 5) + (n.depth === 0 ? ' top' : '') }, cb, h('b', { text: n.code }), h('span', { text: n.text.length > 220 ? n.text.slice(0, 219) + '…' : n.text }), n.level ? h('em', { text: n.level }) : null));
			}
			if (!shown) box.append(h('p', { class: 'qb-hint', text: 'Nothing matches.' }));
		};
		search.addEventListener('input', draw);
		showPractices.addEventListener('change', draw);
		count.textContent = chosen.size + ' chosen';
		draw();
		return U.modal(
			'Objectives · ' + fw.label,
			h('div', { class: 'qb-obj' }, h('div', { class: 'qb-row' }, search, h('label', { class: 'qb-check' }, showPractices, ' Practices / skills')), box, h('p', { class: 'qb-hint' }, count, ' · Tag the most specific objective that fits; searching by a broader code (like a topic) finds it.')),
			[{ label: 'Clear', click: () => { chosen.clear(); draw(); count.textContent = '0 chosen'; return false; } }, { label: 'Cancel' }, { label: 'Done', cls: 'primary', click: () => [...chosen] }],
			{ wide: true }
		);
	};

	/* ---------- chip input ---------- */
	U.chips = function ({ values = [], suggestions = [], placeholder = 'Add…', onchange, listId }) {
		const wrap = h('div', { class: 'qb-chips' });
		const vals = values.slice();
		const id = listId || 'dl_' + Math.random().toString(36).slice(2);
		const dl = h('datalist', { id }, suggestions.map((s) => h('option', { value: s })));
		const inp = h('input', { class: 'qb-chip-in', placeholder, list: id });
		const draw = () => {
			U.fill(wrap, ...vals.map((v, i) => h('span', { class: 'qb-chip' }, v, h('button', { type: 'button', 'aria-label': 'Remove ' + v, onclick: () => { vals.splice(i, 1); draw(); onchange(vals.slice()); } }, '×'))), inp, dl);
		};
		const add = () => {
			for (const v of inp.value.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) if (!vals.includes(v)) vals.push(v);
			inp.value = '';
			draw();
			onchange(vals.slice());
			inp.focus();
		};
		inp.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); if (inp.value.trim()) add(); }
			else if (e.key === 'Backspace' && !inp.value && vals.length) { vals.pop(); draw(); onchange(vals.slice()); inp.focus(); }
		});
		inp.addEventListener('change', () => { if (inp.value.trim() && suggestions.includes(inp.value.trim())) add(); });
		inp.addEventListener('blur', () => { if (inp.value.trim()) add(); });
		draw();
		return wrap;
	};

	/* ---------- student-view preview of one instance ---------- */
	U.preview = function (q, inst, { key = true } = {}) {
		const out = h('div', { class: 'qb-preview' });
		out.append(U.rich(inst.stem, 'qb-stem'));
		if (q.image) out.append(h('img', { class: 'qb-qimg', src: q.image.data, alt: q.image.alt || '' }));
		if (q.type === 'mc' || q.type === 'ma') {
			out.append(h('ul', { class: 'qb-pv-choices ' + q.type }, inst.choices.filter((c) => String(c.text).trim()).map((c) => h('li', { class: key && c.correct ? 'right' : '' }, h('span', { class: 'mark' }, q.type === 'mc' ? '○' : '☐'), U.rich(c.text, '', false), key && c.feedback ? h('em', { class: 'qb-hint', text: ' — ' + c.feedback }) : null))));
		} else if (q.type === 'num') {
			const a = inst.answer;
			out.append(h('div', { class: 'qb-pv-num' }, h('span', { class: 'qb-fake-input' }, ' '), a.unit ? U.rich(a.unit, 'unit', false) : null));
			if (key) out.append(h('p', { class: 'qb-pv-key' }, 'Answer: ', h('b', { html: QB.toHtml(a.shown, { para: false }) }), a.unit ? h('span', { html: ' ' + QB.toHtml(a.unit, { para: false }) }) : '', h('span', { class: 'qb-hint', text: `  (accepts ${QB.fmtSig(inst.range[0], 4)} to ${QB.fmtSig(inst.range[1], 4)})`.replace(/\^/g, '') })));
		} else if (q.type === 'match') {
			const rights = [...new Set([...inst.pairs.map((p) => p.right), ...inst.distractors].filter((s) => String(s).trim()))];
			out.append(h('table', { class: 'qb-pv-match' }, inst.pairs.filter((p) => p.left.trim()).map((p) => h('tr', null, h('td', null, U.rich(p.left, '', false)), h('td', null, h('select', { disabled: true }, h('option', { text: key ? p.right : '[ Choose ]' }), rights.map((r) => h('option', { text: r }))))))));
		}
		if (key && (inst.feedback.general || inst.solution)) out.append(h('div', { class: 'qb-pv-sol' }, inst.feedback.general ? U.rich(inst.feedback.general) : null, inst.solution ? h('div', null, h('b', { text: 'Solution' }), U.rich(inst.solution)) : null));
		if (!inst.ok) out.append(h('p', { class: 'qb-warn', text: 'The condition never held; these values break it.' }));
		return out;
	};
	U.varTable = function (q, n = 5) {
		const names = [...q.vars.map((v) => v.name), ...q.calcs.map((c) => c.name)].filter(Boolean);
		if (!names.length) return null;
		const rows = [];
		for (let i = 1; i <= n; i++) {
			try {
				const inst = QB.instantiate(q, i * 7919);
				rows.push(h('tr', null, names.map((k) => h('td', { text: QB.fmtSig(inst.scope[k], 4).replace(/\^/g, '') })), q.type === 'num' ? h('td', { class: 'ans', text: inst.answer.shown.replace(/\^/g, '') }) : null));
			} catch (e) { rows.push(h('tr', null, h('td', { colspan: names.length + 1, class: 'qb-warn', text: e.message }))); }
		}
		return h('table', { class: 'qb-vtable' }, h('tr', null, names.map((k) => h('th', { text: k })), q.type === 'num' ? h('th', { text: 'answer' }) : null), rows);
	};

	/* ---------- import dialog: files or pasted text → chosen questions ---------- */
	U.GOOGLE_HELP = () => {
		const pre = h('textarea', { class: 'qb-input mono', rows: 14, readonly: true, value: QF.GOOGLE_SCRIPT });
		return h('div', { class: 'qb-gform' },
			h('p', null, 'Google Classroom quizzes are Google Forms. Google doesn’t offer a quiz download, so a short script copies the form into a file:'),
			h('ol', null, h('li', null, 'Open ', h('a', { href: 'https://script.google.com/home/projects/create', target: '_blank', rel: 'noopener', text: 'script.google.com → New project' }), ', delete what’s there and paste the script below.'), h('li', null, 'Paste your form’s edit link (from the form’s address bar, ending in /edit) where it says PASTE_THE_FORM_EDIT_LINK_HERE.'), h('li', null, 'Click Run and allow access. The log shows a Drive link to a .gform.json file — download it and import it here.')),
			h('p', { class: 'qb-hint', text: 'Multiple choice, checkbox and dropdown questions come across with their answer keys and feedback. Short-answer keys aren’t available to scripts.' }),
			pre,
			h('div', { class: 'qb-row' }, U.btn('Copy script', () => { pre.select(); navigator.clipboard.writeText(QF.GOOGLE_SCRIPT).then(() => U.toast('Script copied.'), () => document.execCommand('copy')); }, 'primary', 'copy'))
		);
	};
	U.FORMAT_HELP = () => h('div', { class: 'qb-help' },
		h('p', null, h('b', { text: 'Files: ' }), 'Canvas quiz exports (.zip QTI — Course › Settings › Export, or a quiz’s export), QTI .xml, Moodle GIFT (.gift/.txt), Aiken (.txt), CSV, Theta Questions banks (.qbank.json), Quiz Builder quizzes (.qquiz.json), Google Forms (.gform.json — see the Google Forms tab).'),
		h('p', null, h('b', { text: 'Pasted text' }), ' can be GIFT, Aiken, CSV, or quick entry:'),
		h('pre', { class: 'qb-code', text: '1. Which is a vector?\na) mass\n*b) velocity        ← * marks the right answer (several * = multiple answer)\nc) speed\nTopic: Vectors   Objectives: 1.1.A   Difficulty: 1\n\n2. A ball falls from {h} m. How long does it take?\nAnswer: = sqrt(2*h/9.8) [s] ± 3%\n\n3. Match each quantity to its unit.\nforce -> newton\nenergy -> joule\n-> watt               ← a distractor\n\n4. What is g on Earth?\nAnswer: 9.8 m/s^2^ ± 0.1' }),
		h('p', null, h('b', { text: 'CSV columns: ' }), QF.CSV_COLUMNS.join(', '), '. Only “question” is required. Choices are separated by |, correct is letters (A or A,C), pairs are “left -> right | …”, variables are “v0=2..10 step 0.5; t=1..5”. Export a bank to CSV to see an example.')
	);
	/* → Promise<{ questions, result } | null> where questions are the chosen ones */
	U.importDialog = async function ({ title = 'Import questions', existing = [], files: preFiles, action = 'Add' } = {}) {
		let results = [];
		const sigs = new Set(existing.map(QB.sig));
		const listBox = h('div', { class: 'qb-imp-list' });
		const warnBox = h('div', { class: 'qb-imp-warn' });
		const ta = h('textarea', { class: 'qb-input mono', rows: 10, placeholder: 'Paste GIFT, Aiken, CSV or quick-entry text here…' });
		const parseBtn = U.btn('Read the text', async () => { if (ta.value.trim()) add(await QF.importText(ta.value, 'pasted text')); }, 'primary');
		const chosen = new Map();
		const add = (r) => {
			r.questions.forEach((q) => chosen.set(q.id, !sigs.has(QB.sig(q))));
			results.push(r);
			draw();
		};
		const draw = () => {
			const all = results.flatMap((r) => r.questions);
			U.fill(warnBox, ...results.flatMap((r) => r.warnings.map((w) => h('p', { class: 'qb-warn', text: w }))));
			U.fill(listBox, 
				all.length ? h('div', { class: 'qb-row' }, h('b', { text: `${all.length} question${all.length === 1 ? '' : 's'} found` }), h('button', { type: 'button', class: 'qb-link', text: 'All', onclick: () => { all.forEach((q) => chosen.set(q.id, true)); draw(); } }), h('button', { type: 'button', class: 'qb-link', text: 'None', onclick: () => { all.forEach((q) => chosen.set(q.id, false)); draw(); } })) : h('p', { class: 'qb-hint', text: 'Choose files or paste text to see the questions here.' }),
				...all.map((q) => {
					const dup = sigs.has(QB.sig(q));
					return h('label', { class: 'qb-imp-row' }, h('input', { type: 'checkbox', checked: chosen.get(q.id), onchange: (e) => chosen.set(q.id, e.target.checked) }), h('span', { class: 'qb-type t-' + q.type, text: QB.TYPE_SHORT[q.type] }), h('span', { class: 'qb-imp-text', text: QB.excerpt(q, 110) }), QB.errors(q).length ? h('span', { class: 'qb-badge warn', text: 'needs fixing', title: QB.errors(q)[0].msg }) : null, dup ? h('span', { class: 'qb-badge', text: 'already here' }) : null);
				})
			);
		};
		const readFiles = async (files) => {
			for (const f of files) {
				try { add(await QF.importFile(f.name, await U.readBytes(f))); }
				catch (e) { results.push({ questions: [], warnings: [`${f.name}: ${e.message}`] }); draw(); }
			}
		};
		const drop = h('div', { class: 'qb-drop' }, h('p', null, 'Drop files here or '), U.btn('Choose files…', async () => readFiles(await U.pickFiles({ multiple: true, accept: '.zip,.xml,.gift,.txt,.csv,.tsv,.json' })), 'primary', 'down'));
		drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
		drop.addEventListener('dragleave', () => drop.classList.remove('over'));
		drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); readFiles([...e.dataTransfer.files]); });
		const panes = { files: drop, paste: h('div', null, ta, h('div', { class: 'qb-row' }, parseBtn)), google: U.GOOGLE_HELP(), help: U.FORMAT_HELP() };
		const paneBox = h('div', { class: 'qb-imp-pane' }, drop);
		const tabs = h('div', { class: 'qb-tabs small' }, [['files', 'Files'], ['paste', 'Paste text'], ['google', 'Google Forms'], ['help', 'Formats']].map(([k, t]) => h('button', { type: 'button', class: 'qb-tab' + (k === 'files' ? ' on' : ''), text: t, onclick: (e) => { tabs.querySelectorAll('.qb-tab').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); U.fill(paneBox, panes[k]); } })));
		draw();
		if (preFiles && preFiles.length) readFiles(preFiles);
		const r = await U.modal(title, h('div', { class: 'qb-imp' }, tabs, paneBox, warnBox, listBox), [
			{ label: 'Cancel' },
			{ label: action + ' chosen', cls: 'primary', click: ({ setMessage }) => {
				const qs = results.flatMap((x) => x.questions).filter((q) => chosen.get(q.id));
				if (!qs.length) { setMessage('Nothing chosen yet.'); return false; }
				return { questions: qs, results };
			} }
		], { wide: true });
		return r;
	};

	/* ---------- shared library ---------- */
	U.account = () => {
		const ctx = window.HTGate && HTGate.ctx;
		return ctx && ctx.kind === 'user' && !ctx.offline ? ctx.user : null;
	};
	U.isTeacher = () => { const u = U.account(); return !!(u && u.role === 'teacher'); };
	U.lib = {
		search: (params) => HT.api('qlibrary?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false)).toString()),
		facets: () => HT.api('qlibrary/facets'),
		get: (id) => HT.api('qlibrary/' + encodeURIComponent(id)),
		pull: (id) => HT.api('qlibrary/' + encodeURIComponent(id) + '/pull', { method: 'POST', body: {} }),
		remove: (id) => HT.api('qlibrary/' + encodeURIComponent(id), { method: 'DELETE', body: {} }),
		batch: (entries) => HT.api('qlibrary/batch', { method: 'POST', body: { entries } }),
		async versions(ids) {
			const out = {};
			for (let i = 0; i < ids.length; i += 150) Object.assign(out, (await HT.api('qlibrary/versions?ids=' + ids.slice(i, i + 150).map(encodeURIComponent).join(','))).versions);
			return out;
		}
	};
	/* A question from the library → a bank copy linked to it */
	U.fromLibrary = (item) => {
		const q = QB.normalize({ ...item.question, lib: null, source: { kind: 'library', name: item.owner } });
		q.id = QB.newId('q');
		q.created = q.modified = new Date().toISOString();
		q.lib = { id: item.id, version: item.version, owner: item.owner, sig: QB.sig(q) };
		return q;
	};
	/* A bank question → what the library stores */
	U.toLibrary = (q) => {
		const c = JSON.parse(JSON.stringify(q));
		delete c.lib; delete c.source; delete c.id; delete c.created; delete c.modified;
		return c;
	};

	/* ---------- dropdown menu ---------- */
	U.menu = function (label, items, { cls = '', icon, align = 'left', title } = {}) {
		const pop = h('div', { class: 'qb-menu-pop ' + align, role: 'menu' });
		const btn = h('button', { type: 'button', class: 'qb-btn ' + cls, 'aria-haspopup': 'true', title: title || null }, icon ? U.icon(icon) : null, label ? h('span', { text: label }) : null, U.icon('chev', 'qi chev'));
		const wrap = h('div', { class: 'qb-menu' }, btn, pop);
		const close = () => { pop.classList.remove('open'); document.removeEventListener('click', outside, true); };
		const outside = (e) => { if (!wrap.contains(e.target)) close(); };
		btn.addEventListener('click', () => {
			if (pop.classList.contains('open')) return close();
			const list = typeof items === 'function' ? items() : items;
			U.fill(pop, ...list.map((it) => (it === '-' ? h('hr') : it.heading ? h('div', { class: 'qb-menu-h', text: it.heading }) : h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : '', disabled: !!it.disabled, title: it.title || null, onclick: () => { close(); it.click(); } }, it.label))));
			pop.classList.add('open');
			document.addEventListener('click', outside, true);
		});
		return wrap;
	};

	HT.QUI = U;
})();
