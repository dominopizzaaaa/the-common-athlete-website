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

`tryon.html`. **Everything runs in the browser** — measurements and any photo
stay on the device, never uploaded or stored. No generative AI is involved; the
real product cut-outs are placed geometrically.

### Avatar mode (default)

A figure is generated from the visitor's height, bust, waist and hip
(`js/avatar.js`), so every anatomical station — shoulder, underbust, waist,
crotch — is known exactly rather than estimated. Garments are then placed
against those stations:

- **Widths** come from the body, because these fabrics stretch to fit.
- **Lengths** come from the graded spec pack, in real centimetres. This is why
  the same size reads shorter on a taller body — the inseam only grades 0.5cm
  per size while a torso can be far longer.
- **Size** is recommended from the spec pack's body chart: tops follow the bust,
  bottoms follow whichever of waist/hip needs more room, so a split
  recommendation (`S top · XL bottom`) is a normal result, not a bug.

Body proportions use standard female anthropometry as fractions of height, with
the head sized sub-linearly so it stays believable at 145cm and 185cm alike.
Front-view width is derived from a circumference by modelling the torso as an
ellipse of depth ≈0.72 × width, giving perimeter ≈ 2.72 × width.

### Photo mode

The same collection fitted to an uploaded photo. A pose model returns 33
landmarks, and each cut-out is anchored to a **pair** of them — shoulders for
tops, hips for shorts, ears for the headband — so position, rotation and scale
follow the body. Garments fit on both axes: width from the anchor pair, height
from torso length, because flat product renders are proportionally taller than
the span a garment covers on a body.

Those constants are calibrated against a reference figure with known
anthropometry; every anchor lands within ~3px (0.4cm) of its anatomical target.
Re-run that calibration if the garment artwork is re-cut.

Graceful degradation: shorts lock when the hips aren't visible, side-on photos
are flagged, and the GPU delegate falls back to CPU. The pose runtime and model
are vendored in `vendor/` and `assets/models/` rather than loaded from a CDN, so
no third party is contacted while a photo is on screen.

## Tech

Hand-built static site — no frameworks, no build step.

- `index.html` — the main single-page site
- `tryon.html` — the virtual try-on
- `css/style.css` — design system (quiet-luxury palette from the colourways)
- `css/tryon.css` — fitting-room styles
- `js/main.js` — scroll reveals, colourway swapping, waitlist form
- `js/nav.js` — shared navigation
- `js/tryon.js` — fitting-room orchestration, both modes
- `js/avatar.js` — parametric body, size chart, garment placement
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
