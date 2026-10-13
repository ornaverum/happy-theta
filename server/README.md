# Happy Theta server

Accounts and messages API for the `phys/` site. Node.js + Express + SQLite (one database file).
nginx keeps serving the static pages in `phys/`; it forwards only `/phys/api/` to this app.

```
server.js     the API (routes below)
auth.js       password hashing (scrypt) and cookie sessions
db.js         SQLite tables: users, sessions, messages
teacher.js    command-line tool to make an account a teacher
dev.js        local testing: serves ../phys and the API together
deploy/       nginx snippet and systemd service
```

Pages that use it (in `phys/`): `account/login.html` (sign in / create account), `message.html`
(sample page: signed-in users send a message), `dashboard.html` (teachers see every message).
They share `js/account.js` and `css/account.css`.

## API (all under `/phys/api/`)

| Method | Path        | Who      | Does |
|--------|-------------|----------|------|
| POST   | `/register` | anyone   | `{email, password}` → creates a student account and signs in |
| POST   | `/login`    | anyone   | `{email, password}` → signs in |
| POST   | `/logout`   | anyone   | ends the session |
| GET    | `/me`       | anyone   | `{user: {email, role}}`, or `{user: null}` when signed out |
| POST   | `/messages` | signed in| `{body}` (max 2000 chars) → saves a message |
| GET    | `/messages` | teacher  | every message with the sender's email, newest first |

Security: passwords are hashed with scrypt; sessions are random tokens in an HttpOnly, SameSite=Lax,
Secure cookie scoped to `/phys` (only a hash of the token is stored); POSTs must be same-origin JSON;
sign-in attempts are rate-limited per IP and per email.

## Try it on your PC

```
cd server
npm install
npm run dev          # then open http://localhost:3000/phys/message.html
npm run teacher:dev -- add you@example.com   # after registering, to see the dashboard
```
The dev server uses its own database, `server/data/dev.db`. Delete `server/data/` to start over.

## Install on the droplet (once)

Needs Node 20 or newer (`node -v`). If `npm install` complains about building
better-sqlite3: `sudo apt install build-essential python3`.

```
sudo useradd --system --no-create-home happytheta
sudo mkdir -p /opt/happytheta-server
# copy server/ there, WITHOUT node_modules or data/, then:
cd /opt/happytheta-server && sudo npm ci --omit=dev
sudo cp deploy/happytheta-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now happytheta-api
curl -s localhost:3000/phys/api/me           # → {"user":null}
```
Add `deploy/nginx-phys-api.conf` to the site's nginx `server` block, then
`sudo nginx -t && sudo systemctl reload nginx`.

**HTTPS is required** for sign-in to work, because the session cookie is `Secure`. If the site
isn't on HTTPS yet, `sudo certbot --nginx` sets it up; for a temporary http-only test, uncomment
`COOKIE_SECURE=0` in the service file.

## Teachers

Everyone who registers is a student. To make someone a teacher, they register on the site, then on
the droplet:

```
cd /opt/happytheta-server
sudo -u happytheta DB_PATH=/var/lib/happytheta/happytheta.db node teacher.js add jack@asmsa.org
sudo -u happytheta DB_PATH=/var/lib/happytheta/happytheta.db node teacher.js list
```

## Updating and backups

- Static pages: zip and deploy `phys/` as usual. Server code: copy the changed files to
  `/opt/happytheta-server`, then `sudo systemctl restart happytheta-api`.
- The whole database is `/var/lib/happytheta/happytheta.db`. Safe live backup:
  `sudo sqlite3 /var/lib/happytheta/happytheta.db ".backup '/root/happytheta-$(date +%F).db'"`
- Logs: `journalctl -u happytheta-api -e`
