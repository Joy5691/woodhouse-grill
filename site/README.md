# Woodhouse Grill — website

Static site (HTML/CSS/JS). There's no build step, so you can upload the `site/` folder to any static host (Netlify, Vercel, cPanel, GitHub Pages). It must be served over http(s), because the 3D studio uses ES modules. Don't open it by double-clicking the file.

## Run locally
```bash
node dev-server.js site 5180
```
Then open http://localhost:5180. Run it from the project folder.

## Sections
1. **Loader**: the Woodhouse logo builds itself from separate layers (ring, disc, flame, fork & knife, wordmark, line, GRILL).
2. **Hero**: shows a live "Open now / Closed" status in Dhaka time.
3. **Story** with animated stats.
4. **Signature Cuts**: an interactive **3D steak studio** built with three.js. There are 7 procedurally modelled cuts with painted sear, grill marks, marbling and fat cap. Visitors can drag to rotate, pick a doneness, and slice boneless cuts open to see the inside.
5. **Smokehouse**: a one-screen grid of the smoked dishes.
6. **Menu & Prices**: the **only place prices appear**. It has search (press `/`), category filters, and sides & sauces. Every "View price" / "Price & sides" button jumps here, highlights the dish, and shows a "Back to where you were" pill.
7. **Contact**: large call/WhatsApp card, live opening hours, map with directions and copy-address, and a WhatsApp reservation form.

## Files
- `js/data.js`: **all content and prices**. Edit this file to update the menu.
- `js/steak3d.js`: the 3D engine (geometry, procedural textures, lighting, slicing with stencil caps).
- `js/studio.js`: connects the cut list, doneness and slice buttons to the 3D engine. The engine loads lazily near the section.
- `js/main.js`: loader, smooth scroll (Lenis), GSAP animations, menu board, price jumps, contact and live hours.
- `js/fx.js`: canvas embers and smoke.
- `css/style.css`: theme and layout.
- `tools/build-logo-layers.html`: rebuilds the logo layers. `tools/studio-test.html` previews single 3D cuts (add `?cut=tomahawk` etc.). Both need the dev server.

## Before going live
- The smokehouse, hero and gallery photos are hotlinked from Unsplash (free licence). Swap in Woodhouse's own photography when you have it.
- Confirm the hours, phone, email and address. They came from public listings.
- Libraries load from CDNs: three.js 0.160 (jsDelivr) and GSAP 3.12.5 + ScrollTrigger (cdnjs). Scrolling is native; no smooth-scroll library, for speed.
- Fonts: Zilla Slab (headlines), Barlow and Barlow Condensed (text, labels, prices) and Rye (western accents), all from Google Fonts.
- Press section: the screenshots in `assets/press/` link to the original Dhaka Tribune and The Business Standard articles.
