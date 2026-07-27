# The Common Athlete — Website

Official website for **The Common Athlete**, a Singapore-based activewear brand.

> Premium feel. Common price.

Studio-grade activewear for everyday Singaporean athletes — buttery fabrics,
obsessive construction, honest prices. Nothing in the debut collection costs
more than S$48.

## The debut collection

| Piece | Price | Sizes |
|---|---|---|
| Featherweight Cross-Back Bralette | S$34 | XS–XL |
| Sculpt V-Waist Short | S$40 | XS–XL |
| Studio Halter Longline Crop | S$42 | XS–XL |
| Tempo 2-in-1 Running Short | S$48 | XS–XL |
| Studio Headband | S$14 | One size |

Colourways: **Black · Sand · Espresso** — colour-matched across every style.
Graded for Asian fit.

## The Fitting Room (virtual try-on)

`tryon.html` lets a visitor upload a photo and see every piece on themselves.

**It runs entirely in the browser.** The photo is decoded, fitted and discarded
on the device — never uploaded, never stored, nothing sent to a server. The pose
model and its runtime are vendored in `vendor/` and `assets/models/` rather than
loaded from a CDN, so no third party is contacted while a photo is on screen.

How it works — no generative AI, the same approach as an eyewear try-on:

1. A pose model returns 33 body landmarks for the photo.
2. Each garment cut-out is placed with a transform anchored to a **pair** of
   landmarks — shoulders for tops, hips for shorts, ears for the headband — so
   position, rotation and scale all follow the body automatically.
3. Garments are fitted on **both axes**: width from the anchor pair, height from
   torso length. Flat product renders are proportionally taller than the span a
   garment actually covers on a body (straps and waistbands are laid out at full
   length rather than curving over the shoulder or hip), so a uniform scale
   leaves bands and hems sitting low.

Placement constants in `js/tryon.js` are calibrated against a reference figure
with known anthropometry; every anchor point lands within ~3px (0.4cm) of its
anatomical target. If you re-cut the garment artwork, re-run that calibration.

Graceful degradation: shorts are locked when the hips aren't visible, side-on
photos are flagged, and the GPU delegate falls back to CPU.

## Tech

Hand-built static site — no frameworks, no build step.

- `index.html` — the main single-page site
- `tryon.html` — the virtual try-on
- `css/style.css` — design system (quiet-luxury palette from the colourways)
- `css/tryon.css` — fitting-room styles
- `js/main.js` — scroll reveals, colourway swapping, waitlist form
- `js/nav.js` — shared navigation
- `js/tryon.js` — try-on engine
- `assets/garments/` — garment cut-outs, 5 styles × 3 colourways
- `vendor/`, `assets/models/` — vendored pose runtime and model (~15 MB, loaded
  lazily only when someone opens the fitting room)

## Deployment

Every push runs a GitHub Actions workflow (`.github/workflows/deploy.yml`)
that publishes the site to the `gh-pages` branch.

**One-time setup** (repo admin, ~10 seconds): go to
**Settings → Pages → Build and deployment**, set **Source** to
*Deploy from a branch*, pick **`gh-pages`** / **`/ (root)`**, and save.
After that, every push deploys automatically.

Live site: https://dominopizzaaaa.github.io/the-common-athlete-website/

To run locally, just open `index.html` in a browser, or:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```
