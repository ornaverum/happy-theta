'use strict';
/* "Sign in with Google": the browser gets a signed ID token from Google; we check its
   signature, audience (our client ID), issuer and expiry before trusting the email in it.
   Turned on by setting GOOGLE_CLIENT_ID (see README.md). No client secret is needed. */
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const client = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

module.exports = {
	CLIENT_ID,
	enabled: () => !!module.exports.CLIENT_ID,
	/* Resolves to the token's payload ({sub, email, email_verified, name, hd, ...}) or throws. */
	async verify(idToken) {
		const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
		return ticket.getPayload();
	}
};
