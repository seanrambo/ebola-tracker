import { t, countryName, listJoin, type Lang } from '../i18n';
import { affectedNeighbours, statusOf, type CountryRecord } from './outbreak';

/** The short "what this means for you" advice for a country. Contains <strong> tags. */
export function adviceFor(code: string, countries: CountryRecord[], lang: Lang): string {
	const d = t(lang);
	const name = countryName(code, lang);
	const near = listJoin(affectedNeighbours(code, countries).map((c) => countryName(c.code, lang)), lang);
	switch (statusOf(code, countries)) {
		case 'active':
			return d.advice.active(name);
		case 'imported':
			return d.advice.imported(name);
		case 'ended':
			return d.advice.ended(name) + (near ? d.advice.endedNear(near) : '');
		case 'monitoring':
			return d.advice.monitoring(name, near);
		default:
			return d.advice.none(name);
	}
}
