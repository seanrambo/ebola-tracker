// Derives land borders for every country from the Natural Earth 50m map (shared arcs = shared border).
// Run once: node scripts/build-neighbours.mjs > src/data/neighbours.json
import { neighbors } from 'topojson-client';
import countries from 'i18n-iso-countries';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
const geoms = topo.objects.countries.geometries;
const codes = geoms.map((g) => (g.id ? countries.numericToAlpha2(g.id) : undefined));
const out = {};
neighbors(geoms).forEach((list, i) => {
	const code = codes[i];
	if (!code) return;
	const set = new Set(out[code] ?? []);
	for (const j of list) if (codes[j] && codes[j] !== code) set.add(codes[j]);
	if (set.size) out[code] = [...set].sort();
});
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
console.log(JSON.stringify(sorted));
