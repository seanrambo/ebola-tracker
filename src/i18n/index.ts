import en, { type Dict } from './en';
import sw from './sw';
import fr from './fr';

export const LANGS = ['en', 'sw', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

const dicts: Record<Lang, Dict> = { en, sw, fr };

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export function t(lang: Lang): Dict {
	return dicts[lang];
}

/** A data field that is either plain text or a per-language object. */
export type Localized = string | Partial<Record<Lang, string>>;

export function tr(field: Localized | null | undefined, lang: Lang): string {
	if (field == null) return '';
	if (typeof field === 'string') return field;
	return field[lang] ?? field.en ?? '';
}

/** "/sources" -> "/sw/sources" for Swahili; English lives at the root. */
export function localePath(lang: Lang, path = '/'): string {
	const clean = path.startsWith('/') ? path : `/${path}`;
	return lang === 'en' ? clean : `/${lang}${clean === '/' ? '/' : clean}`;
}

/** Strips a leading /sw or /fr so the same page can be linked in another language. */
export function stripLocale(pathname: string): string {
	const m = pathname.match(/^\/(sw|fr)(\/.*)?$/);
	return m ? m[2] || '/' : pathname;
}

// The built-in names for the two Congos ("Congo - Kinshasa") are unclear to most readers.
const NAME_OVERRIDES: Record<string, Record<Lang, string>> = {
	CD: { en: 'DR Congo', sw: 'DR Kongo', fr: 'RD Congo' },
	CG: { en: 'Republic of the Congo', sw: 'Jamhuri ya Kongo', fr: 'République du Congo' },
};

export function countryName(code: string, lang: Lang): string {
	if (NAME_OVERRIDES[code]) return NAME_OVERRIDES[code][lang];
	try {
		return new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(code) ?? code;
	} catch {
		return code;
	}
}

export function fmt(n: number | null | undefined, lang: Lang): string {
	return n == null ? '—' : n.toLocaleString(lang === 'en' ? 'en-US' : lang);
}

export function cfr(deaths: number, cases: number, lang: Lang): string {
	if (!cases) return '—';
	return `${((deaths / cases) * 100).toLocaleString(lang === 'en' ? 'en-US' : lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function fmtDate(iso: string, lang: Lang): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : lang, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC',
	});
}

/** Joins names as "A, B and C" in the given language. */
export function listJoin(items: string[], lang: Lang): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')}${t(lang).advice.and}${items[items.length - 1]}`;
}
