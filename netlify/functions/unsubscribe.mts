import type { Config } from '@netlify/functions';
import { getSubscriber, json, subscribers, tokensMatch } from '../lib/server.mts';

// POST only: the /alerts/?s=unsubscribe button, and RFC 8058 one-click
// unsubscribe from mail clients (id and t in the query string).
export default async (req: Request) => {
	if (req.method !== 'POST') return json({ error: 'method' }, 405);
	const url = new URL(req.url);
	let id = url.searchParams.get('id');
	let t = url.searchParams.get('t');
	if (!id || !t) {
		const body = (await req.json().catch(() => ({}))) as { id?: string; t?: string };
		id = body.id ?? null;
		t = body.t ?? null;
	}
	const sub = id ? await getSubscriber(id) : null;
	if (!sub || !tokensMatch(sub.unsubToken, t)) return json({ ok: false }, 400);
	await subscribers().delete(id!);
	return json({ ok: true });
};

export const config: Config = { path: '/api/unsubscribe' };
