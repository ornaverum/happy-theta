/* Theta Canvas — browser side of the Canvas connection (used by canvas.html and Quiz Builder).
   Every call goes to the Happy Theta server (/api/canvas/…), which holds the encrypted access token, only
   passes on course-content requests, and removes student data from what comes back. */
(function () {
	'use strict';
	const COURSE_KEY = 'happytheta:canvas:course';
	const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
	const C = {
		conn: null,
		async connection(force) {
			if (!C.conn || force) C.conn = await HT.api('canvas/connection');
			return C.conn;
		},
		async connect(baseUrl, token) {
			const r = await HT.api('canvas/connection', { method: 'PUT', body: { baseUrl, token } });
			C.conn = null;
			return r;
		},
		async disconnect() { await HT.api('canvas/connection', { method: 'DELETE', body: {} }); C.conn = null; },
		async call(method, path, { query, body } = {}) {
			const r = await HT.api('canvas/call', { method: 'POST', body: { method, path, query: query || {}, body: body == null ? null : body } });
			return r.data;
		},
		get: (path, query) => C.call('GET', path, { query }),
		post: (path, body) => C.call('POST', path, { body }),
		put: (path, body) => C.call('PUT', path, { body }),
		patch: (path, body) => C.call('PATCH', path, { body }),
		del: (path, query) => C.call('DELETE', path, { query, body: {} }),
		courses: () => C.get('/api/v1/courses', { enrollment_type: 'teacher', 'include[]': 'term', 'state[]': ['available', 'unpublished'] }),
		get courseId() { return ls.get(COURSE_KEY) || ''; },
		set courseId(v) { ls.set(COURSE_KEY, String(v || '')); },
		courseUrl: (id, rest = '') => (C.conn && C.conn.baseUrl ? `${C.conn.baseUrl}/courses/${id}${rest}` : '#'),
		/* Upload a QTI .zip into a course and wait for Canvas to finish importing it.
		   onStep(text) reports progress. → { state, issues: [text] } */
		async importQTI(courseId, name, bytes, { newQuizzes = false, bankName = '' } = {}, onStep = () => {}) {
			onStep('Uploading to Canvas…');
			const { migration } = await HT.api('canvas/qti', { method: 'POST', body: { courseId, name, data: C.b64(bytes), newQuizzes, bankName } });
			const t0 = Date.now();
			let m = migration;
			while (!['completed', 'failed'].includes(m.workflow_state)) {
				if (Date.now() - t0 > 5 * 60 * 1000) return { state: 'waiting', issues: ['Canvas is still importing; check the course in a few minutes.'] };
				onStep(m.workflow_state === 'running' ? 'Canvas is importing…' : 'Canvas is getting ready…');
				await new Promise((r) => setTimeout(r, 2000));
				m = await C.get(`/api/v1/courses/${courseId}/content_migrations/${migration.id}`);
			}
			let issues = [];
			try { issues = (await C.get(`/api/v1/courses/${courseId}/content_migrations/${migration.id}/migration_issues`)).map((i) => i.description || i.error_message).filter(Boolean); } catch {}
			return { state: m.workflow_state, issues };
		},
		b64(u8) {
			let s = '';
			for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
			return btoa(s);
		},
		/* ISO (UTC) ↔ <input type="datetime-local"> value in this computer's time zone */
		toLocal(iso) {
			if (!iso) return '';
			const d = new Date(iso);
			if (isNaN(d)) return '';
			const p = (n) => String(n).padStart(2, '0');
			return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
		},
		fromLocal: (v) => (v ? new Date(v).toISOString() : null),
		fmt(iso) {
			if (!iso) return '';
			const d = new Date(iso);
			return isNaN(d) ? '' : d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
		}
	};
	/* Dialog: send a QTI .zip to a Canvas course (Quiz Builder's "Send to Canvas", Theta Canvas "Import a QTI file").
	   opts: { name, bytes, courseId?, title } → resolves when closed. Needs qb-ui.js. */
	function sendDialog(opts) {
		const U = HT.QUI, h = U.h;
		const body = h('div', { class: 'qb-col' }, h('p', { class: 'qb-hint', text: 'Checking your Canvas connection…' }));
		let ready = false;
		const courseSel = h('select', { class: 'qb-select' });
		const eng = h('select', { class: 'qb-select' }, h('option', { value: 'classic', text: 'Classic Quizzes' }), h('option', { value: 'new', text: 'New Quizzes (if the course has them)' }));
		const bank = h('input', { class: 'qb-input', value: opts.title || '', placeholder: 'Question bank name (Classic)' });
		const step = h('p', { class: 'qb-hint' });
		const field = (l, i) => h('label', { class: 'qb-field' }, h('span', { text: l }), i);
		(async () => {
			try {
				const conn = await C.connection(true);
				if (!conn.configured) return U.fill(body, h('p', { text: 'Theta Canvas isn’t switched on on this server yet (CANVAS_TOKEN_KEY).' }));
				if (!conn.connected) return U.fill(body, h('p', null, 'Connect your Canvas account first in ', h('a', { href: 'canvas.html', class: 'qb-link', text: 'Theta Canvas' }), ', then come back here. (Or use Download for Canvas and import the .zip by hand.)'));
				const courses = (await C.courses()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
				const want = String(opts.courseId || C.courseId || '');
				U.fill(courseSel, courses.map((c) => h('option', { value: c.id, text: c.name, selected: String(c.id) === want })));
				U.fill(body, field('Canvas course', courseSel), field('Put it in', eng), field('Question bank in Canvas (Classic Quizzes)', bank), h('p', { class: 'qb-hint', text: `Connected as ${conn.name} (${conn.baseUrl}). The quiz arrives unpublished.` }), step);
				ready = true;
			} catch (e) { U.fill(body, h('p', { class: 'qb-err', text: e.message })); }
		})();
		return U.modal('Send to Canvas', body, [{ label: 'Close' }, { label: 'Send', cls: 'primary', click: async ({ setMessage }) => {
			if (!ready) return false;
			if (!courseSel.value) { setMessage('Choose a course.'); return false; }
			setMessage('');
			C.courseId = courseSel.value;
			const r = await C.importQTI(courseSel.value, opts.name, opts.bytes, { newQuizzes: eng.value === 'new', bankName: bank.value.trim() }, (t) => (step.textContent = t));
			const url = C.courseUrl(courseSel.value, '/quizzes');
			U.fill(step, r.state === 'completed' ? h('span', null, '✓ Imported. ', h('a', { href: url, target: '_blank', rel: 'noopener', class: 'qb-link', text: 'Open the course’s quizzes ↗' })) : r.state === 'failed' ? h('span', { class: 'qb-err', text: 'Canvas couldn’t import it.' }) : h('span', { text: 'Still importing in Canvas…' }), r.issues.length ? h('ul', { class: 'qb-notes' }, r.issues.slice(0, 10).map((i) => h('li', { text: i }))) : null);
			return false; // keep the dialog open to show the result
		} }], { wide: false });
	}
	if (HT.QUI) HT.QUI.sendQTIDialog = sendDialog;
	C.sendDialog = sendDialog;
	HT.Canvas = C;
})();
