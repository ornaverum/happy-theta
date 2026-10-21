# Happy Theta — plain HTML/CSS/JS

A framework-free rewrite of the SvelteKit app. No build step, no dependencies.

Open `index.html` in a browser (double-click works), or serve the folder with any static server.

```
index.html                  home
figures/*.html              Free Body, Motion, Energy diagrams, Graph Maker, Advanced Graph Maker
cv-apps/gif-maker.html      GIF Maker
css/style.css               all styles (replaces Tailwind + Flowbite)
js/core.js                  navbar, toolbar, editable labels, canvas stage, grid logic, PNG export
js/<tool>.js                one file per tool
js/gif-encoder.js           GIF encoder (replaces gifshot)
js/math-expr.js             math expression parser used by the Advanced Graph Maker
assets/                     logo and favicon
```

## Deploying

This folder is served at `/phys/` on the website. Zip the *contents* of this folder and unzip them into the server's `phys/` directory. Every link and asset path is relative (each page sets `data-root`), so it works from any folder name, but the site must be reached with a trailing slash (`/phys/`, not `/phys`), which nginx and Apache do by default for directories.

## Accounts (needs the server)

`account/login.html`, `message.html` and `dashboard.html` sign users in and talk to the API at
`api/` (relative to this folder, so `/phys/api/` on the website). The API is the Node app in
`../server/`; see `server/README.md` for setup. The other tools don't use it and still work
offline. These pages ship in the same zip; without the server running they just show
"Can't reach the server".

## Theta Scheduler (teacher course planner)

`teacher/scheduler.html` — plan a course day by day. Not in the navbar yet; link to it directly.
Works offline: every change autosaves to this browser (localStorage, tool `scheduler`), and
**Download** / **Open…** move a course as a `name.scheduler.json` file in the usual envelope.

```
teacher/scheduler.html      the page
css/scheduler.css           its styles
js/scheduler-model.js       data model + pure logic (A/B days, lane packing, shift, coverage); also runs in Node
js/scheduler.js             app shell, saving, undo, calendar, editor panel, activity bank, dialogs
js/scheduler-views.js       Objectives outline editor, Dashboard (content map), Settings
js/scheduler-seed-ap1.js    AP Physics 1 framework + Unit 0 + science practices + quiz bank (seed for new courses)
```

- Days: weekdays from term start to end. A/B alternate on school days only, so a day off pushes the
  rotation back. Days off come from Settings → Days off, or click a day's Type cell to override it.
- Calendar columns: Date, Day, Type, Unit, Topic, In class, the teacher's columns (Settings → Calendar
  columns: an activity goes in the first column whose types/assessment match), Other.
- Blocks span start row → end row; overlapping blocks get side-by-side lanes. Drag to move, drag the
  bottom edge to change the end date, click an empty cell to add. Ctrl+Z / Ctrl+Y undo and redo.
- Shift dates… moves everything on/after a date by N class meetings (not calendar days).
- Dashboard counts, per objective: Presented (activity types whose tag "counts as" presentation),
  Formative and Summative (the activity's Assessment field). "+n" = linked only to a broader objective.
- The seed text includes College Board course-framework wording; the repo is public.
