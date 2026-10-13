/* Landing page for the "Confirm my email" link. */
'use strict';
(async function () {
	const $ = (id) => document.getElementById(id);
	const token = HT.takeLinkToken();
	if (!token) {
		$('title').textContent = 'Link missing';
		$('msg').textContent = "This page needs the full link from your email. Try clicking it again, or copy the whole link into your browser.";
		return;
	}
	try {
		const { user } = await HT.api('verify', { method: 'POST', body: { token } });
		$('title').textContent = 'Email confirmed';
		$('msg').textContent = `Thanks! ${user.email} is confirmed and you're signed in.`;
		$('actions').hidden = false;
		$('continue').focus();
	} catch (err) {
		$('title').textContent = "That link didn't work";
		$('msg').textContent = err.message;
		$('continue').textContent = 'Go to sign in';
		$('continue').href = 'login.html';
		$('actions').hidden = false;
	}
})();
