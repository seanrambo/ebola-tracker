import isoCountries from 'i18n-iso-countries';
import { LANGS, t, fmt, fmtDate, countryName, localePath, isLang, type Lang } from '../i18n';
import { adviceFor } from './advice';
import { describeChange, type Change } from './alerts';
import { statusOf, type CountryRecord } from './outbreak';

export interface TelegramSubscriber {
	chatId: number;
	lang: Lang;
	country?: string;
	createdAt: number;
}

export const escHtml = (s: string) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!);

/** "/start@EbolaBot CD_sw" -> { command: 'start', arg: 'CD_sw' }. Plain text has no command. */
export function parseMessage(text: string): { command: string | null; arg: string } {
	const m = text.trim().match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
	if (!m) return { command: null, arg: text.trim() };
	return { command: m[1].toLowerCase(), arg: (m[2] ?? '').trim() };
}

/** The ?start= value the website adds to the bot link: "CD_sw", or just "sw" when no country is known. */
export function parseStartParam(param: string): { country?: string; lang?: Lang } {
	const m = param.match(/^(?:([A-Z]{2})_)?([a-z]{2})$/);
	if (!m) return {};
	const lang = isLang(m[2]) ? m[2] : undefined;
	const country = m[1] && isoCountries.isValid(m[1]) ? m[1] : undefined;
	return { country, lang };
}

const norm = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\b(the|la|le|les|l|de|du|des|ya|jamhuri)\b/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const ALIASES: Record<string, string> = {
	drc: 'CD',
	rdc: 'CD',
	'dr congo': 'CD',
	'rd congo': 'CD',
	'congo kinshasa': 'CD',
	'congo brazzaville': 'CG',
	usa: 'US',
	us: 'US',
	uk: 'GB',
	'south sudan': 'SS',
};

let index: Map<string, Set<string>> | null = null;

function nameIndex() {
	if (index) return index;
	index = new Map();
	const add = (key: string, code: string) => {
		if (!key) return;
		if (!index!.has(key)) index!.set(key, new Set());
		index!.get(key)!.add(code);
	};
	for (const code of Object.keys(isoCountries.getAlpha2Codes())) {
		add(code.toLowerCase(), code);
		for (const lang of LANGS) {
			add(norm(countryName(code, lang)), code);
			try {
				add(norm(new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? ''), code);
			} catch {}
		}
	}
	for (const [alias, code] of Object.entries(ALIASES)) index.set(alias, new Set([code]));
	return index;
}

/** Finds a country from what someone typed, in English, Kiswahili or French. Null if none or several match. */
export function findCountry(text: string): string | null {
	const q = norm(text);
	if (!q || q.length > 60) return null;
	const idx = nameIndex();
	const exact = idx.get(q);
	if (exact?.size === 1) return [...exact][0];
	if (q.length < 3) return null;
	const partial = new Set<string>();
	for (const [key, codes] of idx) if (key.length > 2 && (key.startsWith(q) || key.includes(` ${q}`))) codes.forEach((c) => partial.add(c));
	return partial.size === 1 ? [...partial][0] : null;
}

/** The current situation for a country, as Telegram HTML. */
export function statusMessage(code: string, countries: CountryRecord[], lang: Lang, siteUrl: string): string {
	const d = t(lang);
	const status = statusOf(code, countries);
	const lines = [`<b>${escHtml(countryName(code, lang))}</b> · ${escHtml(d.status[status])}`, adviceFor(code, countries, lang)];
	const c = countries.find((x) => x.code === code);
	if (c) lines.push(escHtml(d.telegram.figures(fmt(c.confirmed, lang), fmt(c.deaths, lang), fmtDate(c.asOf, lang))));
	lines.push(`<a href="${escHtml(siteUrl + localePath(lang, '/'))}">${escHtml(d.email.seeSite)}</a>`);
	return lines.join('\n\n');
}

/** An alert about changes affecting a subscriber's country, as Telegram HTML. */
export function alertMessage(lang: Lang, country: string, changes: Change[], siteUrl: string): string {
	const d = t(lang);
	return [
		`<b>${escHtml(d.email.alertSubject(countryName(country, lang)))}</b>`,
		escHtml(d.email.alertIntro(countryName(country, lang))),
		changes.map((ch) => `• ${escHtml(describeChange(ch, lang))}`).join('\n'),
		escHtml(d.email.advice),
		`<a href="${escHtml(siteUrl + localePath(lang, '/'))}">${escHtml(d.email.seeSite)}</a>`,
		`<i>${escHtml(d.telegram.alertFooter)}</i>`,
	].join('\n\n');
}

export interface Reply {
	text: string;
	/** The subscriber record to save, null to delete it, or undefined to leave it unchanged. */
	save?: TelegramSubscriber | null;
}

/**
 * Decides how the bot answers one message. Pure, so it can be tested without Telegram.
 * `sub` is the stored record for this chat, if any; `userLang` is the language Telegram reports for the user.
 */
export function handleMessage(
	text: string,
	chatId: number,
	sub: TelegramSubscriber | null,
	userLang: string | undefined,
	countries: CountryRecord[],
	siteUrl: string,
	now = Date.now(),
): Reply {
	const { command, arg } = parseMessage(text);
	const base: TelegramSubscriber = sub ?? { chatId, lang: isLang(userLang?.slice(0, 2)) ? (userLang!.slice(0, 2) as Lang) : 'en', createdAt: now };
	const d = () => t(base.lang);

	const subscribe = (country: string, lang = base.lang): Reply => {
		const next = { ...base, lang, country };
		return { text: t(lang).telegram.subscribed(escHtml(countryName(country, lang))), save: next };
	};
	const tryCountry = (input: string): Reply => {
		if (!input) return { text: d().telegram.askCountry };
		const code = findCountry(input);
		return code ? subscribe(code) : { text: d().telegram.notFound(escHtml(input.slice(0, 60))) };
	};

	switch (command) {
		case 'start': {
			const p = parseStartParam(arg);
			const lang = p.lang ?? base.lang;
			if (p.country) return subscribe(p.country, lang);
			if (base.country) return subscribe(base.country, lang);
			return { text: t(lang).telegram.welcome, save: { ...base, lang } };
		}
		case 'stop':
			return { text: d().telegram.stopped, save: sub ? null : undefined };
		case 'status':
			if (!base.country) return { text: d().telegram.notSubscribed };
			return { text: statusMessage(base.country, countries, base.lang, siteUrl) };
		case 'country':
			return tryCountry(arg);
		case 'en':
		case 'sw':
		case 'fr':
			return { text: t(command).telegram.languageSet, save: { ...base, lang: command } };
		case 'help':
			return { text: d().telegram.help };
		case null:
			return tryCountry(arg);
		default:
			return { text: d().telegram.help };
	}
}
