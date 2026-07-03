# The Common Athlete — Website

Official website for **The Common Athlete**, a Singapore-based activewear brand.

> Premium feel. Common price.

Studio-grade activewear for everyday Singaporean athletes — buttery fabrics,
obsessive construction, honest prices. Nothing in the debut collection costs
more than S$48.

## The debut collection

| Style | Piece | Price |
|---|---|---|
| TCA-BR01 | Featherweight Cross-Back Bralette | S$34 |
| TCA-SH02 | Sculpt V-Waist Short | S$40 |
| TCA-TP01 | Studio Square-Neck Longline Crop | S$42 |
| TCA-SH01 | Tempo 2-in-1 Running Short | S$48 |

Colourways: **Black · Sand · Espresso** — colour-matched across every style.
Sizes XS–XL, graded for Asian fit.

## Tech

Hand-built static site — no frameworks, no build step.

- `index.html` — single-page site
- `css/style.css` — design system (quiet-luxury palette drawn from the collection colourways)
- `js/main.js` — scroll reveals, colourway swapping, mobile nav, waitlist form

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
