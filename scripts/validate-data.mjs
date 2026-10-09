// Guard rails for automatic updates. An update that breaks any rule is not
// published; the GitHub Action opens an issue for a person to review instead.

const LANGS = ['en', 'sw', 'fr'];
const STATUSES = ['active', 'imported', 'ended'];
const VIRUSES = ['bundibugyo', 'zaire', 'sudan'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Largest believable rise in cumulative confirmed cases between two updates. */
export const maxPlausible = (prev) => Math.max(prev * 2, prev + 1000);

/**
 * @param {object} prev  the currently published ebola.json
 * @param {object} next  the proposed ebola.json
 * @param {{ allowedUrls: string[], today: string }} opts
 * @returns {string[]} problems; empty means the update can be published
 */
export function validateUpdate(prev, next, { allowedUrls, today }) {
	const errors = [];
	const err = (msg) => errors.push(msg);
	const urlOk = (u) => allowedUrls.includes(u) || [...prev.countries.map((c) => c.sourceUrl), prev.who.url].includes(u);
	const dateOk = (s, label) => {
		if (typeof s !== 'string' || !ISO_DATE.test(s) || Number.isNaN(Date.parse(s))) err(`${label}: "${s}" is not a YYYY-MM-DD date`);
		else if (s > today) err(`${label}: ${s} is in the future`);
	};
	const count = (v, label, nullable = false) => {
		if (v === null && nullable) return;
		if (!Number.isInteger(v) || v < 0) err(`${label}: ${JSON.stringify(v)} is not a whole number ≥ 0`);
	};
	const localized = (v, label) => {
		for (const l of LANGS) if (typeof v?.[l] !== 'string' || !v[l].trim()) err(`${label}: missing ${l} text`);
		for (const l of LANGS) if (typeof v?.[l] === 'string' && /<[a-z/!]/i.test(v[l])) err(`${label}: ${l} text contains HTML`);
	};

	// Countries
	const seen = new Set();
	for (const c of next.countries ?? []) {
		const at = `country ${c.code}`;
		if (!/^[A-Z]{2}$/.test(c.code ?? '')) err(`${at}: invalid ISO code`);
		if (seen.has(c.code)) err(`${at}: listed twice`);
		seen.add(c.code);
		if (!STATUSES.includes(c.status)) err(`${at}: invalid status ${c.status}`);
		if (!VIRUSES.includes(c.virus)) err(`${at}: invalid virus ${c.virus}`);
		dateOk(c.declared, `${at} declared`);
		dateOk(c.asOf, `${at} asOf`);
		if (c.ended !== null) dateOk(c.ended, `${at} ended`);
		count(c.confirmed, `${at} confirmed`);
		count(c.deaths, `${at} deaths`);
		count(c.probable, `${at} probable`, true);
		count(c.suspected, `${at} suspected`, true);
		count(c.recovered, `${at} recovered`, true);
		if (typeof c.lat !== 'number' || Math.abs(c.lat) > 90 || typeof c.lng !== 'number' || Math.abs(c.lng) > 180) err(`${at}: invalid coordinates`);
		if (!urlOk(c.sourceUrl)) err(`${at}: sourceUrl ${c.sourceUrl} is not one of the reports that were read`);
		localized(c.note, `${at} note`);

		const cases = c.confirmed + (c.probable ?? 0);
		if (c.deaths > cases) err(`${at}: ${c.deaths} deaths exceed ${cases} cases`);
		if ((c.recovered ?? 0) + c.deaths > cases) err(`${at}: deaths + recovered exceed cases`);

		const p = prev.countries.find((x) => x.code === c.code);
		if (p) {
			if (c.confirmed < p.confirmed) err(`${at}: confirmed fell from ${p.confirmed} to ${c.confirmed}`);
			if (c.deaths < p.deaths) err(`${at}: deaths fell from ${p.deaths} to ${c.deaths}`);
			if (p.recovered != null && c.recovered != null && c.recovered < p.recovered) err(`${at}: recovered fell from ${p.recovered} to ${c.recovered}`);
			if (c.asOf < p.asOf) err(`${at}: asOf moved back from ${p.asOf} to ${c.asOf}`);
			if (c.confirmed > maxPlausible(p.confirmed)) err(`${at}: confirmed jumped from ${p.confirmed} to ${c.confirmed}; needs human review`);
		} else if (c.confirmed > 1000) err(`${at}: new country with ${c.confirmed} cases; needs human review`);
	}
	for (const p of prev.countries) if (!seen.has(p.code)) err(`country ${p.code} was removed`);

	// Regions
	const regionNames = new Set();
	for (const r of next.regions ?? []) {
		const at = `region ${r.name?.en}`;
		if (!seen.has(r.country)) err(`${at}: country ${r.country} is not in the country list`);
		if (regionNames.has(`${r.country}/${r.name?.en}`)) err(`${at}: listed twice`);
		regionNames.add(`${r.country}/${r.name?.en}`);
		localized(r.name, `${at} name`);
		count(r.confirmed, `${at} confirmed`);
		count(r.deaths, `${at} deaths`);
		if (r.deaths > r.confirmed) err(`${at}: deaths exceed confirmed`);
		if (typeof r.lat !== 'number' || Math.abs(r.lat) > 90 || typeof r.lng !== 'number' || Math.abs(r.lng) > 180) err(`${at}: invalid coordinates`);
		const p = prev.regions.find((x) => x.country === r.country && x.name.en === r.name?.en);
		if (p && r.confirmed < p.confirmed) err(`${at}: confirmed fell from ${p.confirmed} to ${r.confirmed}`);
	}
	for (const p of prev.regions)
		if (!regionNames.has(`${p.country}/${p.name.en}`)) err(`region ${p.name.en} was removed`);
	for (const c of next.countries ?? []) {
		const sum = (next.regions ?? []).filter((r) => r.country === c.code).reduce((s, r) => s + r.confirmed, 0);
		if (sum > c.confirmed + (c.probable ?? 0)) err(`country ${c.code}: provinces add up to ${sum}, more than the national ${c.confirmed}`);
	}

	// WHO snapshot, summary and timeline
	count(next.who?.confirmed, 'who confirmed');
	count(next.who?.deaths, 'who deaths');
	dateOk(next.who?.asOf, 'who asOf');
	if (!urlOk(next.who?.url)) err(`who url ${next.who?.url} is not one of the reports that were read`);
	if (next.who?.confirmed < prev.who.confirmed) err(`who confirmed fell from ${prev.who.confirmed} to ${next.who.confirmed}`);
	if (next.who?.asOf < prev.who.asOf) err(`who asOf moved back`);
	localized(next.epidemic?.summary, 'summary');
	for (const e of next.timeline ?? []) {
		dateOk(e.date, `timeline ${e.date}`);
		localized(e.text, `timeline ${e.date}`);
	}
	if ((next.timeline?.length ?? 0) < prev.timeline.length) err('timeline events were removed');

	return errors;
}
