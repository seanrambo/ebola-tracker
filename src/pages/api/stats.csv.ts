import data from '../../data/ebola.json';
import { countryName, tr } from '../../i18n';

const cell = (v: unknown) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function GET() {
	const header = ['level', 'country_code', 'name', 'status', 'virus', 'confirmed', 'probable', 'suspected', 'deaths', 'recovered', 'as_of', 'source'];
	const cdAsOf = (code: string) => data.countries.find((c) => c.code === code)?.asOf;
	const rows = [
		...data.countries.map((c) => [
			'country', c.code, countryName(c.code, 'en'), c.status, c.virus,
			c.confirmed, c.probable, c.suspected, c.deaths, c.recovered, c.asOf, c.sourceUrl,
		]),
		...data.regions.map((r) => [
			'province', r.country, tr(r.name, 'en'), 'active', '', r.confirmed, '', '', r.deaths, '', cdAsOf(r.country), '',
		]),
	];
	const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
	return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
}
