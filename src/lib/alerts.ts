import { t, fmt, countryName, type Lang } from '../i18n';
import { bordersOf, type CountryRecord } from './outbreak';

export type Change =
	| { kind: 'new'; code: string; status: string }
	| { kind: 'status'; code: string; status: string }
	| { kind: 'increase'; code: string; newCases: number; total: number; deaths: number };

export interface Subscriber {
	email: string;
	country: string;
	lang: Lang;
	confirmed: boolean;
	unsubToken: string;
	createdAt: number;
	pending?: { country: string; lang: Lang; token: string; requestedAt: number };
	lastAlertAt?: number;
}

type Snapshot = Pick<CountryRecord, 'code' | 'status' | 'confirmed' | 'deaths'>;

/** What changed between two published versions of the country list. */
export function diffSnapshots(prev: Snapshot[], next: Snapshot[]): Change[] {
	const changes: Change[] = [];
	for (const c of next) {
		const p = prev.find((x) => x.code === c.code);
		if (!p) {
			changes.push({ kind: 'new', code: c.code, status: c.status });
			continue;
		}
		if (p.status !== c.status) changes.push({ kind: 'status', code: c.code, status: c.status });
		if (c.confirmed > p.confirmed)
			changes.push({ kind: 'increase', code: c.code, newCases: c.confirmed - p.confirmed, total: c.confirmed, deaths: c.deaths });
	}
	return changes;
}

/** Changes in the subscriber's own country or a country it shares a land border with. */
export function changesFor(country: string, changes: Change[]): Change[] {
	const borders = bordersOf(country);
	return changes
		.filter((ch) => ch.code === country || borders.includes(ch.code))
		.sort((a, b) => Number(b.code === country) - Number(a.code === country));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function layout(lang: Lang, body: string, footer: string) {
	return `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f4f6f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td style="font-size:18px;font-weight:700;padding-bottom:12px"><span style="color:#e5484d">●</span> Ebola Tracker</td></tr>
<tr><td style="font-size:16px;line-height:1.55">${body}</td></tr>
<tr><td style="font-size:12px;line-height:1.5;color:#6b7280;padding-top:24px;border-top:1px solid #e5e7eb">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
	`<p style="margin:24px 0"><a href="${esc(href)}" style="background:#1d6fa5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${esc(label)}</a></p>`;

export function buildConfirmEmail(lang: Lang, country: string, confirmUrl: string) {
	const d = t(lang);
	const name = countryName(country, lang);
	const html = layout(
		lang,
		`<p>${esc(d.email.confirmIntro(name))}</p>${button(confirmUrl, d.email.confirmButton)}<p style="color:#6b7280;font-size:14px">${esc(d.email.confirmIgnore)}</p>`,
		esc(d.footer.disclaimer),
	);
	const text = `${d.email.confirmIntro(name)}\n\n${d.email.confirmButton}: ${confirmUrl}\n\n${d.email.confirmIgnore}`;
	return { subject: d.email.confirmSubject, html, text };
}

export function describeChange(ch: Change, lang: Lang): string {
	const d = t(lang);
	const name = countryName(ch.code, lang);
	if (ch.kind === 'new') return d.email.newCountry(name, d.status[ch.status]);
	if (ch.kind === 'status') return d.email.statusChange(name, d.status[ch.status]);
	return d.email.increase(name, fmt(ch.newCases, lang), fmt(ch.total, lang), fmt(ch.deaths, lang));
}

export function buildAlertEmail(lang: Lang, country: string, changes: Change[], siteUrl: string, unsubscribeUrl: string) {
	const d = t(lang);
	const name = countryName(country, lang);
	const lines = changes.map((ch) => describeChange(ch, lang));
	const html = layout(
		lang,
		`<p>${esc(d.email.alertIntro(name))}</p><ul style="padding-left:20px">${lines.map((l) => `<li style="margin-bottom:6px">${esc(l)}</li>`).join('')}</ul>
<p>${esc(d.email.advice)}</p>${button(siteUrl, d.email.seeSite)}`,
		`${esc(d.email.footer)} <a href="${esc(unsubscribeUrl)}" style="color:#6b7280">${esc(d.email.unsubscribe)}</a><br><br>${esc(d.footer.disclaimer)}`,
	);
	const text = `${d.email.alertIntro(name)}\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\n${d.email.advice}\n\n${d.email.seeSite}: ${siteUrl}\n\n${d.email.unsubscribe}: ${unsubscribeUrl}`;
	return { subject: d.email.alertSubject(name), html, text };
}
