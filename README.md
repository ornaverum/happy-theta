# Happy Theta

Plain HTML/CSS/JS, no build step. The repo root is the website's root.

```
index.html          main landing page: the three dashboards + Countdown, Maze, Stitch Sculpt
shared/             gate.js + gate.css (sign-in screen, guest preview, save syncing), site.css (landing + dashboards)
branding/           logo, icons, favicons

phys/               physics tools. phys/index.html = Physics dashboard (sign in / guest; teacher and student views)
teacher/            Teacher Tools. teacher/index.html = dashboard (teacher accounts / guest)
                      scheduler.html (Theta Scheduler), maps.html (Theta Maps)
apps/               apps/index.html = My Apps dashboard (any account / guest)
                      marks/  Theta Marks      wish/  Wish I May (its own family logins; ?demo=1 = guest demo)
                      countdown-game/, maze2d/, crochet/ (Stitch Sculpt) — open to everyone, no sign-in

server/             Node API (accounts, saved work, messages, scheduler library, WishIMay) — not part of the web root
tools/              build scripts (tools/build-waddell-seed.js → teacher/js/scheduler-seed-waddell.js)
```

## Signing in

One account works everywhere. Each dashboard starts with a sign-in screen:

- **Sign in** with email + pass phrase, or **Create account**. Pass phrases are made up by the site — a silly but
  grammatical camelCase sentence of 4–6 words not counting the/a/an, like `sevenPurpleOttersJuggleTheSilverMoon`.
  "Another one" makes a new one; you can't type your own. Signing in ignores spaces and capitals.
- **Preview as a guest**: everything works, but saves stay in this browser only (localStorage).
- Teacher Tools need a teacher account (`node server/teacher.js add you@school.org`). On the Physics dashboard
  teachers see student messages and a link to Teacher Tools; students see a box to message their teacher.

Signed in, saves sync to the server (`/api/docs`), so they follow you to any computer. Signing out deletes this
browser's copy of the account's work (school computers are shared). Guest work is kept separately and can be
copied into an account from the dashboards. If the same save was changed on two computers, both versions are kept.
Not synced: pictures and files attached inside Theta Marks / Theta Maps (they stay in IndexedDB on that computer).

How it works: `shared/gate.js` keeps one "space" of `happytheta:*` localStorage keys visible at a time (guest, or
one account) and moves the others aside, so the tools themselves didn't change. Tool pages load it right after
`core.js` with `data-gate="tool"` and write their own scripts as `<script type="text/x-ht-deferred" data-src="…">`;
the gate signs in or redirects to the dashboard, syncs, then runs them. `core.js` tells it about every save
(`HT.files.write` / `remove`).

## Try it locally

```
cd server
npm install        # first time, or after package changes
npm run dev        # http://localhost:3000/  (emails are printed in this terminal)
npm run teacher:dev -- add you@example.com
```

Pages also open straight from disk (double-click); they run as a guest preview then.

## Deploying

Web root = `index.html`, `shared/`, `branding/`, `phys/`, `teacher/`, `apps/` from this repo. nginx serves those as
static files and forwards `/api/` (and the old `/phys/api/`) plus `/apps/wish/api/` to the Node service — see
`server/README.md` and `server/deploy/`. Old addresses: `phys/teacher/scheduler.html`, `phys/maps/theta-maps.html`
and `phys/marks/theta-marks.html` are redirect pages; `/wish/` is redirected in the nginx snippet.
