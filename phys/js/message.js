/* Sample signed-in page: send a text message to the server. */
'use strict';
(async function () {
	const $ = (id) => document.getElementById(id);
	const MAX = 2000;
	const setStatus = (text, kind) => {
		$('status').textContent = text;
		$('status').className = 'status' + (kind ? ' ' + kind : '');
	};
	try {
		await HT.requireLogin();
	} catch (e) {
		$('page').hidden = false;
		$('msg-form').hidden = true;
		return setStatus(e.message, 'error');
	}
	$('page').hidden = false;

	const updateCount = () => {
		const n = $('body').value.length;
		$('counter').textContent = `${n} / ${MAX}`;
		$('counter').classList.toggle('over', n > MAX);
	};
	$('body').addEventListener('input', updateCount);

	$('msg-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const body = $('body').value.trim();
		if (!body) return setStatus('Type a message first.', 'error');
		$('send').disabled = true;
		setStatus('Sending…');
		try {
			const { message } = await HT.api('messages', { method: 'POST', body: { body } });
			$('body').value = '';
			updateCount();
			setStatus(`Sent at ${HT.formatTime(message.created_at)}.`, 'ok');
		} catch (err) {
			if (err.status === 401) return location.replace(HT.loginUrl());
			setStatus(err.message, 'error');
		} finally {
			$('send').disabled = false;
		}
	});
	$('body').focus();
})();
