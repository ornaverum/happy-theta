# Happy Theta server

Accounts and messages API for the `phys/` site. Node.js + Express + SQLite (one database file).
nginx keeps serving the static pages in `phys/`; it forwards only `/phys/api/` to this app.

```
server.js     the API (routes below)
auth.js       password hashing (scrypt), cookie sessions, one-time email links
mail.js       sends the confirmation and password-reset emails
db.js         SQLite tables: users, sessions, email_tokens, messages
teacher.js    command-line account tool (teachers, confirm by hand, reset links)
dev.js        local testing: serves ../phys and the API together
deploy/       nginx snippet, systemd service, api.env.example (settings)
```

Pages (in `phys/`): `account/login.html` (sign in / create account), `account/verify.html`
(the emailed "confirm" link), `account/forgot.html` and `account/reset.html` (password reset),
`message.html` (sample signed-in page), `dashboard.html` (teachers see every message).
They share `js/account.js` and `css/account.css`.

## How accounts work

- **Sign up** with an email and password. We email a confirmation link (good for 48 hours); the
  account can't sign in until it's clicked. Clicking it confirms the email and signs you in.
- The password chosen at sign-up only takes effect when *that sign-up's* link is clicked, so if
  someone else signs up with your email first, they can't pick your password.
- **Forgot password** emails a reset link (1 hour, single use). Setting a new password signs out
  every other device and also confirms the email.
- "Forgot password" gives the same answer whether or not an account exists.
- Limits: 10 failed sign-ins per email per 15 min; 5 emails to one address per hour; 300 account
  requests per network address per 15 min (high on purpose: a whole school shares one address).

## API (all under `/phys/api/`)

| Method | Path               | Who       | Does |
|--------|--------------------|-----------|------|
| POST   | `/register`        | anyone    | `{email, password}` → emails a confirmation link (also how "send a new link" works) |
| POST   | `/verify`          | anyone    | `{token}` from the link → confirms the email and signs in |
| POST   | `/login`           | anyone    | `{email, password}` → signs in (403 `{unverified: true}` if not confirmed yet) |
| POST   | `/password/forgot` | anyone    | `{email}` → emails a reset link if the account exists |
| POST   | `/password/check`  | anyone    | `{token}` → `{email}` if the reset link is still good |
| POST   | `/password/reset`  | anyone    | `{token, password}` → sets the password and signs in |
| POST   | `/logout`          | anyone    | ends the session |
| GET    | `/me`              | anyone    | `{user: {email, role}}`, or `{user: null}` when signed out |
| POST   | `/messages`        | signed in | `{body}` (max 2000 chars) → saves a message |
| GET    | `/messages`        | teacher   | every message with the sender's email, newest first |

Security: passwords are hashed with scrypt; sessions are random tokens in an HttpOnly, SameSite=Lax,
Secure cookie scoped to `/phys`; only SHA-256 hashes of session and email-link tokens are stored;
email links put the token after `#` so it never reaches server logs; POSTs must be same-origin JSON.

## Activity library (Theta Scheduler)

`library.js` adds a shared library of activities, mounted at `/phys/api/library` (teachers only — students
get 403). It creates its own table, `library_items` (owner, JSON item, version, forked_from, pulls), on start.

- `GET /library` — search: `q`, `type`, `assessment`, `interaction`, `inClass` (1/0), `min`/`max` (minutes),
  `codes` (comma list; matches items linked to the same, a more specific, or a broader objective code),
  `mine=1`, `sort` (new|popular|title|minutes), `limit`, `offset`.
- `GET /library/versions?ids=a,b` — current versions, so courses can show "update available".
- `GET /library/:id`, `POST /library/:id/pull` (counts a pull, returns the item).
- `POST /library` and `POST /library/batch` (`{entries:[{item, id?, baseVersion?}]}`, up to 500): with an id
  you own, updates it (409/`conflict` if `baseVersion` is stale); otherwise creates a new item of yours (an
  edited copy of someone else's becomes your own version, with `forked_from` set).
- `PUT /library/:id`, `DELETE /library/:id` — owner only. DELETE needs a JSON body (`{}`) like every non-GET.

Items keep only: title, type/interaction tags (id, label, color), assessment, expected minutes, in class,
meetings spanned, objective codes (AP-style, e.g. `1.2.A`, `2.4.A.3`; science practices as `SP-1.A`), a
topic hint, http(s) links and notes. Course dates are never sent.

## Email setup

DigitalOcean blocks the usual email ports (25, 465, 587) on every droplet, so the server sends
through **Brevo's web API** instead, which uses ordinary HTTPS. Brevo's free plan sends 300
emails a day and doesn't ask for a credit card.

1. Sign up at brevo.com (free plan).
2. Tell Brevo who the email comes from. Either:
   - **Your own domain (best):** Senders, Domains & Dedicated IPs → Domains → add the website's
     domain and add the DNS records it shows (SPF, DKIM, etc.) at your domain registrar. Then use
     an address like `noreply@your-domain` as the sender.
   - **Quick test:** add a single sender address (e.g. your own email) and click the confirmation
     link Brevo sends. Emails from a school or Gmail address sent through Brevo are more likely
     to land in spam, so switch to your domain before students use it.
3. SMTP & API → API Keys → generate a key.
4. In `/etc/happytheta/api.env` (made from `deploy/api.env.example`) set `MAIL_TRANSPORT=brevo`,
   `BREVO_API_KEY=...`, `MAIL_FROM=Happy Theta <noreply@your-domain>` and
   `PUBLIC_URL=https://your-domain` (the start of the emailed links), then
   `sudo systemctl restart happytheta-api`.
5. Test: sign up with your own address. If nothing arrives, check spam, then `journalctl -u happytheta-api -e`.

`MAIL_TRANSPORT=log` (the default) only prints emails to the server log. Plain SMTP isn't
supported: DigitalOcean blocks it, and dropping it kept the server free of the nodemailer package.

If email isn't working yet, you can still let people in from the droplet: `teacher.js verify`
confirms an account by hand, and `teacher.js reset-link` prints a reset link to pass on yourself.

## Try it on your PC

```
cd server
npm install
npm run dev          # then open http://localhost:3000/phys/message.html
```
Emails aren't sent in dev: they're printed in the terminal running `npm run dev`. Copy the link
from there into the browser. To make yourself a teacher afterwards:
`npm run teacher:dev -- add you@example.com`.
The dev server uses its own database, `server/data/dev.db`. Delete `server/data/` to start over.

## Install on the droplet (once)

Needs Node 20 or newer (`node -v`). If `npm install` complains about building
better-sqlite3: `sudo apt install build-essential python3`.

```
sudo useradd --system --no-create-home happytheta
sudo mkdir -p /opt/happytheta-server
# copy server/ there, WITHOUT node_modules or data/, then:
cd /opt/happytheta-server && sudo npm ci --omit=dev
sudo mkdir -p /etc/happytheta && sudo cp deploy/api.env.example /etc/happytheta/api.env
sudo chmod 600 /etc/happytheta/api.env && sudo nano /etc/happytheta/api.env   # site address + email settings
sudo cp deploy/happytheta-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now happytheta-api
curl -s localhost:3000/phys/api/me           # → {"user":null}
```
Add `deploy/nginx-phys-api.conf` to the site's nginx `server` block, then
`sudo nginx -t && sudo systemctl reload nginx`.

**HTTPS is required** for sign-in to work, because the session cookie is `Secure`. If the site
isn't on HTTPS yet, `sudo certbot --nginx` sets it up; for a temporary http-only test, uncomment
`COOKIE_SECURE=0` in `/etc/happytheta/api.env`.

## Managing accounts (teacher.js)

Run on the droplet as the service user, pointing at the live database:

```
cd /opt/happytheta-server
alias ht='sudo -u happytheta DB_PATH=/var/lib/happytheta/happytheta.db PUBLIC_URL=https://your-domain node teacher.js'
ht add jack@asmsa.org          # make a teacher (they sign up on the site first)
ht remove someone@asmsa.org    # back to student
ht list                        # teachers
ht users                       # every account, and whether it's confirmed
ht verify someone@asmsa.org    # confirm an email by hand (their sign-up password then works)
ht reset-link someone@asmsa.org   # print a 1-hour reset link to send them yourself
```

## Updating and backups

- Static pages: zip and deploy `phys/` as usual. Server code: copy the changed files to
  `/opt/happytheta-server`, run `sudo npm ci --omit=dev` if `package.json` changed, then
  `sudo systemctl restart happytheta-api`. Database changes are applied automatically on start.
- The whole database is `/var/lib/happytheta/happytheta.db`. Safe live backup:
  `sudo sqlite3 /var/lib/happytheta/happytheta.db ".backup '/root/happytheta-$(date +%F).db'"`
- Logs: `journalctl -u happytheta-api -e`
