# ByteNana — Homepage

The ByteNana marketing homepage. Framework-free static site (HTML/CSS/JS, no build step),
built on the **ByteNana design system** (see `titeco-ux/Byte-landingpage` → `design-kit` branch).

## Run locally
```bash
python3 -m http.server 8848
# → http://127.0.0.1:8848/
```

## Structure
```
index.html              14-section homepage
css/  tokens.css         design tokens (the re-skin knob)
      base.css           reset, typography, layout primitives
      components.css     design-system components + animations
      page.css           page-specific layout
js/   animations.js      design-system interactions (nav, tabs, carousels, globes, forms)
      hero-globe.js      spinning Americas globe (section 07)
      page.js            engagement tabs + chooser deep-link
assets/                  geojson + logo
```

## Notes
- Icons load from the Iconify CDN; fonts from Google Fonts.
- Forms POST to Netlify Forms — repoint the endpoint in `js/animations.js` (module F).
- Booking modal calendar URL is set via `data-booking-url` on `#booking-modal`.
- All motion respects `prefers-reduced-motion`.
