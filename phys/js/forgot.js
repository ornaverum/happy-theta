/* Ask for a password-reset email. */
'use strict';
(function () {
	const $ = (id) => document.getElementById(id);
	const prefill = new URLSearchParams(location.search).get('email');
	if (prefill) $('email').value = prefill;
	$('email').focus();

	$('forgot-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const email = $('email').value.trim();
		if (!email) return HT.setStatus($('status'), 'Enter your email address.', 'error');
		$('send').disabled = true;
		HT.setStatus($('status'), 'Sending…');
		try {
			const { message } = await HT.api('password/forgot', { method: 'POST', body: { email } });
			$('forgot-form').hidden = true;
			$('intro').textContent = message;
			HT.setStatus($('status'), '');
		} catch (err) {
			HT.setStatus($('status'), err.message, 'error');
			$('send').disabled = false;
		}
	});
})();
