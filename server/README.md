# Happy Theta server

Accounts, saved work and messages API for the whole Happy Theta site (`phys/`, `teacher/`, `apps/`), plus the
WishIMay wish list (`/apps/wish/`). Node.js + Express + SQLite (one database file).
nginx serves the static site; it forwards only `/api/` (and the old `/phys/api/`, which still works) and
`/apps/wish/api/` to this app.

```
server.js     the API (routes below)
auth.js       pass phrase hashing (scrypt), cookie sessions, one-time email links
passphrase.js makes up pass phrases (4–6 word camelCase sentences) and checks a phrase is one of ours
docs.js       signed-in users' saved work (/api/docs), synced from the browser by shared/gate.js
bundle.js     the backup-file format ("Export all my work"), used by teacher.js export / import
mail.js       sends the confirmation and pass-phrase-reset emails
db.js         SQLite tables: users, sessions, email_tokens, messages
teacher.js    command-line account tool (teachers, confirm by hand, reset links)
dev.js        local testing: serves the whole site (repo root) and the API together
deploy/       nginx snippet, systemd service, api.env.example (settings)
```

Signing in happens on each section's dashboard (`phys/index.html`, `teacher/index.html`, `apps/index.html`),
drawn by `shared/gate.js`. The emailed links land on `phys/account/verify.html` and `phys/account/reset.html`;
`phys/account/forgot.html` asks for a reset link; `phys/account/login.html` now just forwards to the right
dashboard. `phys/dashboard.html` is the full table of student messages for teachers.

## How accounts work

- **Pass phrases, not passwords.** The site makes up a short silly sentence in camelCase
  (`theSleepyOtterJugglesTheSilverLantern`, 4–6 words not counting the/a/an); "Another one" asks for a new one.
  People can't type their own — `/register` and `/password/reset` only accept phrases `passphrase.js` could have
  made. Signing in ignores spaces and capitals. Accounts made before this keep their old password until they
  reset it. Strength: 32–50 bits depending on the sentence pattern (`node -e "console.log(require('./passphrase').bits())"`).
- **Sign up** with an email and a pass phrase. We email a confirmation link (good for 48 hours); the
  account can't sign in until it's clicked. Clicking it confirms the email and signs you in.
- The password chosen at sign-up only takes effect when *that sign-up's* link is clicked, so if
  someone else signs up with your email first, they can't pick your password.
- **Forgot password** emails a reset link (1 hour, single use). Setting a new password signs out
  every other device and also confirms the email.
- "Forgot password" gives the same answer whether or not an account exists.
- Limits: 10 failed sign-ins per email per 15 min; 5 emails to one address per hour; 300 account
  requests per network address per 15 min (high on purpose: a whole school shares one address).

## API (all under `/api/`; `/phys/api/` is the same thing)

| Method | Path               | Who       | Does |
|--------|--------------------|-----------|------|
| GET    | `/passphrase`      | anyone    | `{passphrase}` — a new made-up phrase for the sign-up and reset forms |
| POST   | `/register`        | anyone    | `{email, password}` (a site-made phrase) → emails a confirmation link (also how "send a new link" works) |
| POST   | `/verify`          | anyone    | `{token}` from the link → confirms the email and signs in |
| POST   | `/login`           | anyone    | `{email, password}` → signs in (403 `{unverified: true}` if not confirmed yet) |
| POST   | `/password/forgot` | anyone    | `{email}` → emails a reset link if the account exists |
| POST   | `/password/check`  | anyone    | `{token}` → `{email}` if the reset link is still good |
| POST   | `/password/reset`  | anyone    | `{token, password}` → sets the password and signs in |
| POST   | `/logout`          | anyone    | ends the session |
| GET    | `/me`              | anyone    | `{user: {id, email, role}}`, or `{user: null}` when signed out |
| POST   | `/messages`        | signed in | `{body}` (max 2000 chars) → saves a message |
| GET    | `/messages`        | teacher   | every message with the sender's email, newest first |
| GET    | `/docs`            | signed in | `{docs: [{tool, id, rev, title, modified, deleted}], tools}` — the account's saved work (no data) |
| GET    | `/docs/:tool/:id`  | signed in | `{doc, rev}` |
| PUT    | `/docs/:tool/:id`  | signed in | `{doc, baseRev}` → `{rev}`; 409 `{conflict, rev}` if another computer saved since `baseRev` |
| DELETE | `/docs/:tool/:id`  | signed in | `{baseRev}` → leaves a tombstone so other computers delete it too |

Saved work (`docs.js`, table `user_docs`): one row per save, the usual Happy Theta envelope. Students can store
`fbd`, `energy`, `motion`, `graph`, `marks`; teachers also `scheduler`, `schedtemplate`, `mindmap`. Limits: 3 MB per
save, 60 MB and 3000 saves per account (`DOC_MAX_BYTES`, `DOC_QUOTA_BYTES`). Pictures and files attached inside
Theta Marks / Theta Maps live in the browser's IndexedDB and are not synced.

Security: passwords are hashed with scrypt; sessions are random tokens in an HttpOnly, SameSite=Lax,
Secure cookie for the whole site (`Path=/`); only SHA-256 hashes of session and email-link tokens are stored;
email links put the token after `#` so it never reaches server logs; POSTs must be same-origin JSON.

## Activity library (Theta Scheduler)

`library.js` adds a shared library of activities, mounted at `/api/library` (teachers only — students
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
npm run dev          # then open http://localhost:3000/
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
curl -s localhost:3000/api/me           # → {"user":null}
```
Add `deploy/nginx-phys-api.conf` (the `/api/` and `/phys/api/` blocks) to the site's nginx `server` block, then
`sudo nginx -t && sudo systemctl reload nginx`.

**HTTPS is required** for sign-in to work, because the session cookie is `Secure`. If the site
isn't on HTTPS yet, `sudo certbot --nginx` sets it up; for a temporary http-only test, uncomment
`COOKIE_SECURE=0` in `/etc/happytheta/api.env`.

## WishIMay (family wish list)

`wishlist.js` adds a separate app at `/apps/wish/api` (pages in `apps/wish/`, served at `/apps/wish/`). It has its
own logins, cookie (`wish_session`, Path=/apps/wish, 60 days) and tables (`wish_accounts`, `wish_sessions`,
`wish_people`, `wish_items`, `wish_purchases`, plus `wish_offers`, `wish_offer_checks`, `wish_api_usage` for
price comparison), all in the same database file. School accounts and
wish-list logins never mix.

- **Owner**: one shared login for the family. Switches between people ("personas") to manage each
  person's items, and creates shopper logins. Owner responses never include purchase information.
- **Shopper**: email + passphrase made by an owner. Sees every unbought item plus their own purchases.
  Marking an item bought hides it from every other shopper (first one wins; a second gets 409).

| Method | Path | Who | Does |
|--------|------|-----|------|
| POST | `/login` | anyone | `{email, passphrase}` → signs in |
| POST | `/logout` | anyone | ends the session |
| GET | `/me` | anyone | `{account: {role, email, name}}` or `{account: null}` |
| GET | `/list` | signed in | `{people, items, compare}`; each item has `offers` + `offersCheckedAt`; shoppers also get `purchasedAt` on their own purchases |
| POST/PUT/DELETE | `/people`, `/people/:id` | owner | add / rename+recolor / remove a person (removes their items) |
| POST/PUT/DELETE | `/items`, `/items/:id` | owner | add / edit / delete a wish |
| POST | `/preview` | owner | `{url}` → reads the shop page: `{title, image, description, price, currency}` |
| POST/DELETE | `/items/:id/purchase` | shopper | mark bought / undo (own purchase only) |
| POST | `/items/:id/offers` | signed in | look the item up at other stores → `{offers, checkedAt, error}` (saved results if recent) |
| GET | `/compare-status` | owner | `{enabled, used, limit}` SerpApi searches this month |
| GET/POST | `/shoppers` | owner | list / add shopper logins `{email, name, passphrase}` |
| PUT/DELETE | `/shoppers/:id` | owner | rename or new passphrase (signs them out) / remove |
| POST | `/passphrase` | signed in | `{current, next}` change your own passphrase |

**Reading shop pages safely** (`wish-preview.js`): http/https only, ports 80/443/8080/8443, at most 5
redirects, 12 s and 2 MB for the whole fetch. Every connection (redirects too) must go to a public
address: private, loopback, link-local/metadata (169.254.x.x), CGNAT, IPv6 local/mapped forms and the
droplet's own addresses are refused, checked at connect time so DNS tricks don't get around it.
Tests: `node tests/wish-preview-test.js`.

Limits: 200 sign-in requests per IP and 10 wrong passphrases per email per 15 min (then even the right
one waits); 60 page reads per owner per 15 min.

**Logins from the shell** (`wish.js`, same DB_PATH as the server):
```
cd /opt/happytheta-server
alias wish='sudo -u happytheta DB_PATH=/var/lib/happytheta/happytheta.db node wish.js'
wish owner family@example.com --name "The Waddells"   # create the shared owner login (asks for a passphrase)
wish shopper aunt@example.com --name "Aunt Sue"       # owners can also do this on the site
wish passphrase someone@example.com                   # new passphrase, signs them out
wish list                                             # every login
wish remove aunt@example.com                          # remove a shopper (their purchases stay hidden)
```
Locally: `npm run wish:dev -- owner you@example.com`, then `npm run dev` → http://localhost:3000/apps/wish/.
Without signing in, `apps/wish/?demo=1` (the My Apps guest preview) runs a made-up list in the browser only
(`apps/wish/js/wish-demo.js`), with an Owner / Shopper switch.

nginx: add `deploy/nginx-wish-api.conf` next to the `/api/` block.

**Other stores' prices** (`wish-compare.js`, optional): with `SERPAPI_KEY` in api.env, each item can be
looked up on Google Shopping (`engine=google_shopping`) and eBay (`engine=ebay`, Buy It Now only)
through [SerpApi](https://serpapi.com). One key covers both; eBay's own API (which needs eBay developer
keys) isn't used. A check costs 2 SerpApi searches and runs:
- in the background when an owner adds a wish, or changes its name or "words to search other stores with";
- when someone presses **Compare other stores / Check again**. Owners get fresh results after 15 minutes,
  shoppers after 24 hours (before that they see the saved ones). 20 checks per login per hour.

Results are filtered so they're really the same item: most of the search words must be in the
result's title, prices under 35% or over 4× the wish's own price are dropped (cases, accessories,
bundles), one offer per store, up to 6 from Google and 4 from eBay, cheapest first. The card's
headline is the cheapest *new* offer; used ones are listed and labeled. `SERPAPI_MONTHLY_LIMIT`
(default 240) stops checks before the plan runs out; the count resets on the 1st (UTC). The key stays on
the server; the browser only ever gets store names, prices and links. Without a key, nothing about this
shows on the site. Tests (fake SerpApi, no searches used): `node tests/wish-compare-test.js`.

Known limit: owners make the shoppers' passphrases, so an owner could sign in as a shopper and see
what that shopper bought. Shoppers can change their own passphrase (the Passphrase button) to keep it private.

## Managing accounts (teacher.js)

Run on the droplet as the service user, pointing at the live database:

```
cd /opt/happytheta-server
alias ht='sudo -u happytheta DB_PATH=/var/lib/happytheta/happytheta.db PUBLIC_URL=https://your-domain node teacher.js'
ht add jack@asmsa.org          # make a teacher (they sign up on the site first)
ht remove someone@asmsa.org    # back to student
ht list                        # teachers
ht users                       # every account, and whether it's confirmed
ht verify someone@asmsa.org    # confirm an email by hand (their sign-up pass phrase then works)
ht reset-link someone@asmsa.org   # print a 1-hour reset link to send them yourself
ht export someone@asmsa.org > /root/their-work.json   # all their saved work as one backup file
ht import someone@asmsa.org /tmp/their-work.json      # add a backup (or tool file) to their account
```

## Updating and backups

- Static pages: the web root now holds `index.html`, `apps/`, `teacher/`, `phys/`, `shared/` and `branding/`
  (zip those from the repo root and unzip them into the web root). Server code: copy the changed files to
  `/opt/happytheta-server`, run `sudo npm ci --omit=dev` if `package.json` changed, then
  `sudo systemctl restart happytheta-api`. Database changes are applied automatically on start.
- **Code and data are separate.** `git pull` + the deploy script only write `/var/www/…/public` and
  `/opt/happytheta-server`; the database (`/var/lib/happytheta/`) and settings (`/etc/happytheta/api.env`) are never
  in git and never touched by a deploy. Keep `DB_PATH` outside the repo, the web root and `/opt`.
- Nightly backups: `deploy/happytheta-backup` (install steps at its top) keeps 30 days of compressed copies plus
  `api.env` in `/var/backups/happytheta/`. Restore: stop the service, `gunzip -c` a copy over `happytheta.db`, delete
  `happytheta.db-wal` / `-shm`, `chown happytheta:`, start the service.
- One user's work: `ht export someone@… > file.json` / `ht import someone@… file.json` (same backup format as the
  dashboards' "Export all my work", minus pictures/attachments, which only live in their browser).
- The whole database is `/var/lib/happytheta/happytheta.db`. Safe live backup:
  `sudo sqlite3 /var/lib/happytheta/happytheta.db ".backup '/root/happytheta-$(date +%F).db'"`
- Logs: `journalctl -u happytheta-api -e`
