/* Sign-in / create-account page. */
'use strict';
(function () {
	const $ = (id) => document.getElementById(id);
	const params = new URLSearchParams(location.search);
	const next = HT.safeNext(params.get('next')) || HT.root + 'message.html';
	let mode = params.get('mode') === 'register' ? 'register' : 'login';

	function setMode(m) {
		mode = m;
		const reg = m === 'register';
		$('tab-login').setAttribute('aria-selected', String(!reg));
		$('tab-register').setAttribute('aria-selected', String(reg));
		$('title').textContent = reg ? 'Create an account' : 'Sign in';
		$('subtitle').textContent = reg ? 'Register with your email and a password.' : 'Use the email and password you registered with.';
		$('submit').textContent = reg ? 'Create account' : 'Sign in';
		$('confirm-field').hidden = !reg;
		$('pw-hint').hidden = !reg;
		$('password').autocomplete = reg ? 'new-password' : 'current-password';
		setStatus('');
	}

	function setStatus(text, kind) {
		$('status').textContent = text;
		$('status').className = 'status' + (kind ? ' ' + kind : '');
	}

	$('tab-login').onclick = () => setMode('login');
	$('tab-register').onclick = () => setMode('register');

	$('auth-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const email = $('email').value.trim();
		const password = $('password').value;
		if (!email || !password) return setStatus('Enter your email and password.', 'error');
		if (mode === 'register') {
			if (password.length < 8) return setStatus('Password must be at least 8 characters.', 'error');
			if (password !== $('confirm').value) return setStatus("Passwords don't match.", 'error');
		}
		$('submit').disabled = true;
		setStatus(mode === 'register' ? 'Creating your account…' : 'Signing in…');
		try {
			await HT.api(mode === 'register' ? 'register' : 'login', { method: 'POST', body: { email, password } });
			location.href = next;
		} catch (err) {
			setStatus(err.message, 'error');
			$('submit').disabled = false;
		}
	});

	setMode(mode);
	// Already signed in? Skip the form.
	HT.api('me').then(({ user }) => user && location.replace(next), () => {});
})();
