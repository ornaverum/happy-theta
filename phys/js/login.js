/* Sign-in / create-account page. New accounts must confirm their email before signing in. */
'use strict';
(function () {
	const $ = (id) => document.getElementById(id);
	const params = new URLSearchParams(location.search);
	const next = HT.safeNext(params.get('next')) || HT.root + 'message.html';
	let mode = params.get('mode') === 'register' ? 'register' : 'login';
	let lastSignup = null; // {email, password} for "Send it again"

	function setStatus(id, text, kind) {
		$(id).textContent = text;
		$(id).className = 'status' + (kind ? ' ' + kind : '');
	}

	function setMode(m) {
		mode = m;
		const reg = m === 'register';
		$('tab-login').setAttribute('aria-selected', String(!reg));
		$('tab-register').setAttribute('aria-selected', String(reg));
		$('title').textContent = reg ? 'Create an account' : 'Sign in';
		$('subtitle').textContent = reg
			? "Sign up with your email and a password. We'll email you a link to confirm it's yours."
			: 'Use the email and password you signed up with.';
		$('submit').textContent = reg ? 'Create account' : 'Sign in';
		$('confirm-field').hidden = !reg;
		$('pw-hint').hidden = !reg;
		$('forgot-row').hidden = reg;
		$('unconfirmed').hidden = true;
		$('password').autocomplete = reg ? 'new-password' : 'current-password';
		setStatus('status', '');
	}

	function showSent(email) {
		$('form-view').hidden = true;
		$('sent-view').hidden = false;
		$('sent-email').textContent = email;
		setStatus('sent-status', '');
	}

	// Sign-up and "send a new link" are the same request: it emails a fresh confirmation link.
	async function signup(email, password) {
		await HT.api('register', { method: 'POST', body: { email, password } });
		lastSignup = { email, password };
		showSent(email);
	}

	$('tab-login').onclick = () => setMode('login');
	$('tab-register').onclick = () => setMode('register');

	// Carry the typed email over to the forgot-password page.
	$('forgot-link').addEventListener('click', (e) => {
		const email = $('email').value.trim();
		if (email) {
			e.preventDefault();
			location.href = 'forgot.html?email=' + encodeURIComponent(email);
		}
	});

	$('auth-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const email = $('email').value.trim();
		const password = $('password').value;
		$('unconfirmed').hidden = true;
		if (!email || !password) return setStatus('status', 'Enter your email and password.', 'error');
		if (mode === 'register') {
			if (password.length < 8) return setStatus('status', 'Password must be at least 8 characters.', 'error');
			if (password !== $('confirm').value) return setStatus('status', "Passwords don't match.", 'error');
		}
		$('submit').disabled = true;
		setStatus('status', mode === 'register' ? 'Creating your account…' : 'Signing in…');
		try {
			if (mode === 'register') await signup(email, password);
			else {
				await HT.api('login', { method: 'POST', body: { email, password } });
				location.href = next;
			}
		} catch (err) {
			setStatus('status', err.message, 'error');
			if (err.status === 403 && mode === 'login') $('unconfirmed').hidden = false;
		} finally {
			$('submit').disabled = false;
		}
	});

	$('resend-unconfirmed').addEventListener('click', async () => {
		const email = $('email').value.trim();
		const password = $('password').value;
		if (password.length < 8) return setStatus('status', 'Type the password you want (at least 8 characters), then send a new link.', 'error');
		$('resend-unconfirmed').disabled = true;
		try {
			await signup(email, password);
		} catch (err) {
			setStatus('status', err.message, 'error');
		} finally {
			$('resend-unconfirmed').disabled = false;
		}
	});

	$('resend').addEventListener('click', async () => {
		if (!lastSignup) return;
		$('resend').disabled = true;
		setStatus('sent-status', 'Sending…');
		try {
			await HT.api('register', { method: 'POST', body: lastSignup });
			setStatus('sent-status', 'Sent a new link. Use the newest email.', 'ok');
		} catch (err) {
			setStatus('sent-status', err.message, 'error');
		} finally {
			$('resend').disabled = false;
		}
	});

	$('back').addEventListener('click', () => {
		$('sent-view').hidden = true;
		$('form-view').hidden = false;
		setMode('register');
		$('email').focus();
	});

	setMode(mode);
	// Already signed in? Skip the form.
	HT.api('me').then(({ user }) => user && location.replace(next), () => {});
})();
