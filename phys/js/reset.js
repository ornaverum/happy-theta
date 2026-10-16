/* Landing page for the "Choose a new password" link. */
'use strict';
(async function () {
	const $ = (id) => document.getElementById(id);
	const token = HT.takeLinkToken();
	const dead = (text) => {
		$('intro').textContent = text;
		$('reset-form').hidden = true;
		$('links').hidden = false;
	};
	if (!token) return dead('This page needs the full link from your email. Try clicking it again, or ask for a new one.');
	try {
		const { email } = await HT.api('password/check', { method: 'POST', body: { token } });
		$('intro').textContent = `For ${email}. The link works once, so finish here.`;
		$('username').value = email; // lets password managers save the new password under the right account
		$('reset-form').hidden = false;
		$('password').focus();
	} catch (err) {
		return dead(err.message);
	}

	$('reset-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const password = $('password').value;
		if (password.length < 8) return HT.setStatus($('status'), 'Password must be at least 8 characters.', 'error');
		if (password !== $('confirm').value) return HT.setStatus($('status'), "Passwords don't match.", 'error');
		$('save').disabled = true;
		HT.setStatus($('status'), 'Saving…');
		try {
			await HT.api('password/reset', { method: 'POST', body: { token, password } });
			$('reset-form').hidden = true;
			$('intro').textContent = "Your password is changed and you're signed in. Any other devices signed in to this account have been signed out.";
			HT.setStatus($('status'), '');
			const go = HT.el('a', { class: 'btn btn-blue', href: '../message.html', text: 'Continue' });
			$('intro').after(HT.el('div', { class: 'btn-row' }, go));
			go.focus();
		} catch (err) {
			if (err.status === 400 && /link/.test(err.message)) return dead(err.message);
			HT.setStatus($('status'), err.message, 'error');
			$('save').disabled = false;
		}
	});
})();
