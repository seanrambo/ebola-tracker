import type { Config } from '@netlify/functions';
import { isLang } from '../../src/i18n';
import { buildConfirmEmail, type Subscriber } from '../../src/lib/alerts';
import { EMAIL_RE, alertsPageUrl, emailId, json, randomToken, sendEmail, subscribers } from '../lib/server.mts';

const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

export default async (req: Request) => {
	if (req.method !== 'POST') return json({ error: 'method' }, 405);
	let body: Record<string, unknown>;
	try {
		body = await req.json();
	} catch {
		return json({ error: 'body' }, 400);
	}
	const email = typeof body.email === 'string' ? body.email.trim() : '';
	const country = typeof body.country === 'string' ? body.country : '';
	const lang = isLang(body.lang) ? body.lang : 'en';

	// Honeypot: bots fill the hidden field. Pretend it worked.
	if (body.website) return json({ ok: true });
	if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'email' }, 400);
	if (!/^[A-Z]{2}$/.test(country)) return json({ error: 'country' }, 400);

	const store = subscribers();
	const id = emailId(email);
	const existing = (await store.get(id, { type: 'json' })) as Subscriber | null;
	const now = Date.now();

	// Don't let the form be used to flood someone's inbox with confirmation emails.
	if (existing?.pending && now - existing.pending.requestedAt < RESEND_COOLDOWN_MS) return json({ ok: true });

	const token = randomToken();
	const pending = { country, lang, token, requestedAt: now };
	const record: Subscriber = existing
		? { ...existing, pending }
		: { email, country, lang, confirmed: false, unsubToken: randomToken(), createdAt: now, pending };
	await store.setJSON(id, record);

	const confirmUrl = alertsPageUrl(lang, { s: 'confirm', id, t: token });
	try {
		await sendEmail({ to: email, ...buildConfirmEmail(lang, country, confirmUrl) });
	} catch (err) {
		console.error(err);
		return json({ error: 'send' }, 502);
	}
	return json({ ok: true });
};

export const config: Config = { path: '/api/subscribe' };
