/* Landing page for the "Get a new pass phrase" link. The site makes the phrase up; "Another one" asks again. */
'use strict';
(async function () {
	const $ = (id) => document.getElementById(id);
	const token = HT.takeLinkToken();
	let phrase = '';
	const dead = (text) => {
		$('intro').textContent = text;
		$('reset-form').hidden = true;
		$('links').hidden = false;
	};
	if (!token) return dead('This page needs the full link from your email. Try clicking it again, or ask for a new one.');
	try {
		const { email } = await HT.api('password/check', { method: 'POST', body: { token } });
		$('intro').textContent = `For ${email}. The link works once, so finish here.`;
		$('username').value = email; // lets password managers save the new phrase under the right account
		$('reset-form').hidden = false;
	} catch (err) {
		return dead(err.message);
	}

	async function roll() {
		$('another').disabled = true;
		try {
			phrase = (await HT.api('passphrase')).passphrase;
			$('phrase').textContent = phrase;
			$('password').value = phrase;
			$('saved').checked = false;
			$('save').disabled = true;
		} catch (err) {
			HT.setStatus($('status'), err.message, 'error');
		}
		$('another').disabled = false;
	}
	$('another').addEventListener('click', roll);
	$('copy').addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(phrase);
			$('copy').textContent = 'Copied';
			setTimeout(() => ($('copy').textContent = 'Copy'), 1500);
		} catch {
			HT.setStatus($('status'), "Couldn't copy. Select the words and copy them yourself.", 'error');
		}
	});
	$('saved').addEventListener('change', () => ($('save').disabled = !$('saved').checked || !phrase));
	await roll();

	$('reset-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		$('save').disabled = true;
		HT.setStatus($('status'), 'Saving…');
		try {
			await HT.api('password/reset', { method: 'POST', body: { token, password: phrase } });
			$('reset-form').hidden = true;
			$('intro').textContent = "Your new pass phrase is saved and you're signed in. Any other devices signed in to this account have been signed out.";
			HT.setStatus($('status'), '');
			const go = HT.el('a', { class: 'btn btn-blue', href: '../../index.html', text: 'Continue' });
			$('intro').after(HT.el('div', { class: 'btn-row' }, go));
			go.focus();
		} catch (err) {
			if (err.status === 400 && /link/.test(err.message)) return dead(err.message);
			HT.setStatus($('status'), err.message, 'error');
			$('save').disabled = false;
		}
	});
})();
