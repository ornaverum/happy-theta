# Happy Theta — plain HTML/CSS/JS

A framework-free rewrite of the SvelteKit app. No build step, no dependencies.

The physics part of the Happy Theta site. Open `index.html` (the physics dashboard) through the site, or
any tool page directly in a browser (double-click works; it runs as a guest preview).

```
index.html                  physics dashboard: sign in or guest preview; teacher and student views (js/phys-dashboard.js)
figures/*.html              Free Body, Motion, Energy diagrams, Graph Maker, Advanced Graph Maker
cv-apps/gif-maker.html      GIF Maker
css/style.css               all styles (replaces Tailwind + Flowbite)
js/core.js                  navbar, toolbar, editable labels, canvas stage, grid logic, PNG export, saves (HT.files)
                            — also used by ../teacher/ and ../apps/marks/ (their navbar comes from data-nav)
js/account.js               HT.api (the site's /api/), user bar; account/ pages: confirm, forgot, reset
js/<tool>.js                one file per tool
js/gif-encoder.js           GIF encoder (replaces gifshot)
js/math-expr.js             math expression parser used by the Advanced Graph Maker
assets/                     logo and favicon
```


The sign-in screen, guest preview and syncing of saves are in `../shared/gate.js` (see the root README). Tool
pages load it right after `core.js` with `data-gate="tool" data-section="phys"`, and their own scripts are written
`<script type="text/x-ht-deferred" data-src="…">` so they run only once the right saves are in place.

## Deploying

This folder is `/phys/` on the website, next to `index.html`, `apps/`, `teacher/`, `shared/` and `branding/` in the
web root (see the root README). Every link is relative, but the site must be reached with a trailing slash
(`/phys/`, not `/phys`), which nginx and Apache do by default for directories.

## Accounts (needs the server)

Sign-in happens on `index.html`. `account/verify.html` and `account/reset.html` are where the emailed links land;
`account/forgot.html` asks for a reset link; `account/login.html` just forwards to the right dashboard;
`dashboard.html` is the full table of student messages for teachers. The API is the Node app in `../server/`
(`/api/` on the website; `/phys/api/` still works). Without the server, everything runs as a guest preview.

Theta Scheduler and Theta Maps moved to `../teacher/`; Theta Marks moved to `../apps/marks/`. The old addresses
(`teacher/scheduler.html`, `maps/theta-maps.html`, `marks/theta-marks.html` here) are now redirect pages.
