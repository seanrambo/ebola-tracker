import data from '../../data/ebola.json';
import { countryName } from '../../i18n';

export function GET() {
	const out = {
		...data,
		countries: data.countries.map((c) => ({ ...c, name: countryName(c.code, 'en') })),
		license: 'Figures are compiled from WHO and national health ministries. Free to reuse with attribution to the original sources.',
	};
	return new Response(JSON.stringify(out, null, 2), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
}
