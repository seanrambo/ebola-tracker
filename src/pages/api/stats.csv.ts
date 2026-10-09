import data from '../../data/ebola.json';

const cell = (v: unknown) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function GET() {
	const header = ['level', 'country_code', 'name', 'status', 'virus', 'confirmed', 'probable', 'suspected', 'deaths', 'recovered', 'as_of', 'source'];
	const rows = [
		...data.countries.map((c) => ['country', c.code, c.name, c.status, c.virus, c.confirmed, c.probable, c.suspected, c.deaths, c.recovered, c.asOf, c.sourceUrl]),
		...data.regions.map((r) => ['province', r.country, r.name, 'active', '', r.confirmed, '', '', r.deaths, '', data.countries.find((c) => c.code === r.country)?.asOf, '']),
	];
	const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
	return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
}
