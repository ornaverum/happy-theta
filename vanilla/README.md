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
