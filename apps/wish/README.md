# Wish I May

A family wish list. Lives at `/wish/` on the Happy Theta site; its API is part of the Happy Theta
server (`server/wishlist.js`, `server/wish-preview.js`, `server/wish-compare.js`, `server/wish.js`).

## Who does what

- **Owners** share one login. At the top they pick who they're "wishing as" (Mom, Dad, Lily…) and
  add, edit or delete that person's wishes. "People" adds, renames, recolors or removes people.
  "Shopper logins" creates the logins for relatives. Owners never see what's been bought.
- **Shoppers** sign in with the email and passphrase an owner gave them. They search, filter (person,
  priority, price) and sort (newest, oldest, most wanted, price, person, name). **Buy** opens the shop
  page in a new tab and asks "Did you buy it?". Yes takes it off the list for every shopper; it moves
  to that shopper's **My purchases**, where "I didn't buy it" puts it back.
- Priority is three stars: ★★★ Top wish, ★★ Would love, ★ Nice to have.

## Adding a wish

Paste a link and press **Add a wish**: the server reads the page and fills in the name, picture,
description and price (JSON-LD product data, Open Graph tags, Amazon's own page elements). Everything
stays editable. Some shops (Amazon especially) sometimes answer automated requests with a "prove
you're human" page; then the form says so and you fill in the details by hand. A wish doesn't need a
link at all ("Mark as bought" replaces the Buy button).

Pictures are linked, not copied, and loaded with `referrerpolicy="no-referrer"` so shops that block
hotlinking still show them. If a shop moves a picture, paste a new picture link in Edit.

## Other stores' prices

If the server has a SerpApi key, each card gets a line like **From $70.00 at eBay · $19.99 less**.
Open it for the list: up to 6 stores from Google Shopping and up to 4 eBay Buy It Now listings,
cheapest first, with shipping and condition (used items are labeled). Shoppers who buy through one of
these links still get the "Did you buy it?" question.

Prices are looked up when an owner adds a wish (and again if its name changes), and whenever someone
presses **Check again**. If results are off (wrong model, wrong size), owners can fill in **Words to
search other stores with** in Edit, e.g. "Kindle Paperwhite 16GB 2024". Each check uses 2 of the
SerpApi plan's monthly searches (free plan: 250 a month, so about 120 checks).

Turn it on: put `SERPAPI_KEY=…` in `/etc/happytheta/api.env` and restart the API. To try it locally,
set the key in the same PowerShell window before starting: `$env:SERPAPI_KEY="your key"; npm run dev`.

## Try it on your PC

```
cd server
npm install
npm run wish:dev -- owner you@example.com      # asks for a passphrase
npm run dev                                     # then open http://localhost:3000/wish/
```

## Deploy

1. Copy the contents of `apps/wish/` into a `wish/` folder next to `phys/` in the web root.
2. Update the server code on the droplet (`server/`: wishlist.js, wish-preview.js, wish.js, server.js,
   wish-compare.js, package.json) and `sudo systemctl restart happytheta-api`. The tables are created on start.
3. Add `server/deploy/nginx-wish-api.conf` to the site's nginx `server` block and reload nginx.
4. Make the owner login (see server/README.md, "WishIMay").

Needs HTTPS like the rest of the site (the sign-in cookie is `Secure`).

## Files

```
index.html      page shell (twilight band + app area)
css/wish.css    all styles (light + dark)
js/wish.js      the app: sign in, owner view, shopper view, dialogs
star.svg        favicon
```
