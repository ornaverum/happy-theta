'use strict';
/* Sending email (verification and password-reset links).
   MAIL_TRANSPORT picks how:
     log   (default) print the email to the server console. For local testing.
     brevo Brevo's HTTPS API (free plan, no card). Works on DigitalOcean, which blocks the
           usual SMTP ports 25/465/587 on droplets. Needs BREVO_API_KEY.
     smtp  any SMTP server, via nodemailer. Needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
   MAIL_FROM is the sender, e.g. "Happy Theta <noreply@your-domain>"; the provider must have
   that address or domain verified. */

const TRANSPORT = (process.env.MAIL_TRANSPORT || 'log').trim().toLowerCase();
const FROM = (process.env.MAIL_FROM || 'Happy Theta <noreply@example.com>').trim();
const PORT = Number(process.env.PORT || 3000);
// Base address used in emailed links. Never taken from the request (a forged Host header
// could otherwise point reset links at someone else's site).
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');

function parseFrom(from) {
	const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
	return m ? { name: m[1].replace(/^"|"$/g, '') || undefined, email: m[2] } : { email: from };
}

async function sendBrevo({ to, subject, text, html }) {
	if (!process.env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is not set');
	const res = await fetch('https://api.brevo.com/v3/smtp/email', {
		method: 'POST',
		headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify({ sender: parseFrom(FROM), to: [{ email: to }], subject, textContent: text, htmlContent: html }),
		signal: AbortSignal.timeout(15000)
	});
	if (!res.ok) throw new Error(`Brevo API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

let smtpTransport;
async function sendSmtp({ to, subject, text, html }) {
	if (!smtpTransport) {
		const nodemailer = require('nodemailer');
		const port = Number(process.env.SMTP_PORT || 587);
		smtpTransport = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port,
			secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === '1' : port === 465,
			auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
			connectionTimeout: 15000
		});
	}
	await smtpTransport.sendMail({ from: FROM, to, subject, text, html });
}

function sendLog({ to, subject, text }) {
	console.log(`\n----- email (MAIL_TRANSPORT=log, not actually sent) -----\nTo: ${to}\nSubject: ${subject}\n\n${text}\n----------------------------------------------------------\n`);
}

async function send(msg) {
	if (TRANSPORT === 'brevo') return sendBrevo(msg);
	if (TRANSPORT === 'smtp') return sendSmtp(msg);
	return sendLog(msg);
}

/* ---------- the two emails ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function layout(heading, para, link, button, footer) {
	return `<!doctype html><html><body style="margin:0;background:#eff6ff;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #dbeafe;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 28px 8px"><div style="font-size:20px;font-weight:bold;color:#172554">Happy Theta</div></td></tr>
<tr><td style="padding:8px 28px"><h1 style="font-size:20px;margin:8px 0 12px">${esc(heading)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 20px">${esc(para)}</p>
<a href="${esc(link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${esc(button)}</a>
<p style="font-size:13px;line-height:1.5;color:#4b5563;margin:20px 0 0">If the button doesn't work, copy this link into your browser:<br><a href="${esc(link)}" style="color:#1d4ed8;word-break:break-all">${esc(link)}</a></p>
<p style="font-size:13px;line-height:1.5;color:#6b7280;margin:16px 0 24px">${esc(footer)}</p></td></tr>
</table></td></tr></table></body></html>`;
}

function verifyEmail(to, token, basePath) {
	const link = `${PUBLIC_URL}${basePath}/account/verify.html#t=${token}`;
	const footer = "This link works for 48 hours. If you didn't create a Happy Theta account, you can ignore this email.";
	return {
		to,
		subject: 'Confirm your email for Happy Theta',
		text: `Confirm your email address to finish setting up your Happy Theta account:\n\n${link}\n\n${footer}\n`,
		html: layout('Confirm your email', 'Click the button to confirm your email address and finish setting up your Happy Theta account.', link, 'Confirm my email', footer)
	};
}

function resetEmail(to, token, basePath) {
	const link = `${PUBLIC_URL}${basePath}/account/reset.html#t=${token}`;
	const footer = "This link works for 1 hour and can be used once. If you didn't ask to reset your password, you can ignore this email; your password won't change.";
	return {
		to,
		subject: 'Reset your Happy Theta password',
		text: `Someone (hopefully you) asked to reset the password for this Happy Theta account. Choose a new password here:\n\n${link}\n\n${footer}\n`,
		html: layout('Reset your password', 'Someone (hopefully you) asked to reset the password for this Happy Theta account. Click the button to choose a new one.', link, 'Choose a new password', footer)
	};
}

function describe() {
	return `mail: ${TRANSPORT} from ${FROM}; links use ${PUBLIC_URL}`;
}

module.exports = { send, verifyEmail, resetEmail, describe, TRANSPORT, PUBLIC_URL };
