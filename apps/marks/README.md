# Theta Marks (graphical bookmarks + notes)

`index.html` (+ `js/theta-marks.js`, `css/theta-marks.css`), at `/apps/marks/` (was `phys/marks/theta-marks.html`). Part of My Apps: signed in, collections sync to the account; as a guest (or opened from `file://`) they stay in this browser. Images added to nodes live in IndexedDB and are not synced. Uses `../../phys/js/core.js` and `style.css` with `data-nav="apps"`.

- A node holds a link, a video link (YouTube/Vimeo play in the details panel; video files play inline), an image (upload, paste, drop or address) and/or rich-text notes, plus tags, the date added and the dates visited. Opening a link or playing a video from the app logs a visit.
- Thumbnail: automatic, the image, the video frame, the site icon, a custom upload, or the type icon. Site icons come from Google's favicon service (only the domain is sent); video titles and Vimeo thumbnails from noembed.com.
- **Web** view: nodes placed by tag similarity (IDF-weighted tag overlap + same website), using stress majorization on shortest-path distances (the Kamada–Kawai energy). Changes re-run the layout from the current positions; **Re-arrange** starts fresh. Dragging a node pins it.
- **Timeline** view: x = date added or last visit; y = similarity. Never-visited nodes sit in a block on the left.
- Zoomed out, nearby nodes that are very alike collapse into a pile labelled with their shared tags (the further out, the looser). Click a pile to zoom into it.
- Tag suggestions when adding/editing: words in the title/link/notes that match existing tags, tags on other nodes from the same site, nodes with similar text, tags that usually go together, nodes near where you double-clicked, the active tag filter, recent tags, and new keywords.
- Search (`/`) plus filters: tags (include/exclude, any/all), type (link/video/image/note), date added, last visited (incl. never / not in 30+ days). Non-matching nodes fade or hide.
- Storage: HappyTheta envelope, tool `marks`, key `happytheta:save:marks:<id>`; images in IndexedDB `happytheta-marks`. Export: `.marks.json` (images embedded), browser bookmarks `.html`, Markdown. Import: `.marks.json`, bookmarks `.html` from any browser (folders become tags), or a pasted list of links.
