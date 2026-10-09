# Ebola Tracker

An Astro site that tracks the 2026 Bundibugyo Ebola epidemic. It shows the situation in the visitor's country and has an interactive globe: click a country or a province marker to see the cases there.

## Develop

```sh
npm install
npm run dev
```

## Updating the figures

All data lives in `src/data/ebola.json`. Edit the numbers, update `asOf` and `updated`, and push. Netlify rebuilds automatically.

- `countries`: per-country status (`active`, `imported`, `ended`), figures and source
- `regions`: province-level figures shown as globe markers
- `neighbours`: border lists used for "Borders an affected country"
- `history`: past outbreaks shown in the "Past outbreaks" layer

## Endpoints

- `/api/stats.json` and `/api/stats.csv`: open data (CORS enabled)
- `/api/geo`: Netlify Edge Function that returns the visitor's country code
