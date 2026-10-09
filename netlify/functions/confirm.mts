import type { Config } from '@netlify/functions';
import { getSubscriber, json, subscribers, tokensMatch } from '../lib/server.mts';

const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Called by the button on /alerts/?s=confirm, never by a bare link, so email
// scanners that open links can't confirm on someone's behalf.
export default async (req: Request) => {
	if (req.method !== 'POST') return json({ error: 'method' }, 405);
	const { id, t } = (await req.json().catch(() => ({}))) as { id?: string; t?: string };
	const sub = id ? await getSubscriber(id) : null;
	if (!sub?.pending || !tokensMatch(sub.pending.token, t) || Date.now() - sub.pending.requestedAt > PENDING_TTL_MS)
		return json({ ok: false }, 400);

	const { country, lang } = sub.pending;
	await subscribers().setJSON(id!, { ...sub, country, lang, confirmed: true, pending: undefined });
	return json({ ok: true });
};

export const config: Config = { path: '/api/confirm' };
