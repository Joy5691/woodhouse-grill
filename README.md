# Woodhouse Grill — Texas-Style Steakhouse, Banani

Website for **Woodhouse Grill**, Level 4, BTI Laureate, Road 11, Banani, Dhaka.

It's a static site (HTML, CSS and vanilla JS) with GSAP scroll animations, a three.js 3D steak studio and a searchable menu. There's no build step.

## Run locally
```bash
node dev-server.js site 5180
```
Then open http://localhost:5180.

## Deploy on Vercel
1. Import this repository in Vercel.
2. Keep **Framework Preset: Other**. There's no build command and no install command.
3. `vercel.json` already sets the output directory to `site/`.

`.vercelignore` keeps the dev tools and source images out of the deployment.

## Project layout
```
site/
  index.html          page markup
  css/style.css       theme, layout, responsive rules
  js/data.js          menu, prices & contact details (edit this to update the menu)
  js/main.js          loader, animations, menu, carousels, reservations, hours
  js/steak3d.js       3D steak engine (procedural steaks, slicing, doneness)
  js/studio.js        3D studio UI
  js/fx.js            embers & smoke canvas effects
  assets/logo/        logo + WebP animation layers
  assets/dishes3d/    pre-rendered 3D menu images (~9 KB each)
  assets/press/       press article screenshots
  tools/              dev tools: logo layer builder, 3D dish renderer, studio preview
dev-server.js         tiny local server (also lets the dev tools save files)
```

## Updating the menu images
1. Run the dev server.
2. Open `/tools/render-dishes.html`.
3. Run `renderAll()` in the browser console.

Each dish is re-rendered to `site/assets/dishes3d/<item-id>.webp`.

## Before going live
- Swap the Unsplash photos (hero, smokehouse, gallery, contact background) for the restaurant's own photography.
- Confirm hours, phone, email and address in `site/js/data.js`.
