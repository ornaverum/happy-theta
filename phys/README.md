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
