import type { Config } from '@netlify/functions';
import { buildAlertEmail, changesFor, diffSnapshots, type Subscriber } from '../../src/lib/alerts';
import { localePath } from '../../src/i18n';
import type { CountryRecord } from '../../src/lib/outbreak';
import { sendBatch, siteUrl, state, subscribers, unsubscribeLinks, type OutgoingEmail } from '../lib/server.mts';

// Runs hourly. Compares the live /api/stats.json with the last version we
// alerted on, and emails confirmed subscribers whose country (or a neighbour)
// changed. The snapshot is saved before sending, so a failure part-way through
// can skip some emails but never sends duplicates.
export default async () => {
	const res = await fetch(`${siteUrl()}/api/stats.json`, { headers: { 'Cache-Control': 'no-cache' } });
	if (!res.ok) throw new Error(`Could not load stats: ${res.status}`);
	const live = (await res.json()) as { updated: string; countries: CountryRecord[] };

	const st = state();
	const prev = (await st.get('snapshot', { type: 'json' })) as { updated: string; countries: CountryRecord[] } | null;
	const snapshot = { updated: live.updated, countries: live.countries.map(({ code, status, confirmed, deaths }) => ({ code, status, confirmed, deaths })) };
	if (!prev) {
		await st.setJSON('snapshot', snapshot);
		console.log('Saved first snapshot; no alerts sent.');
		return;
	}

	const changes = diffSnapshots(prev.countries, snapshot.countries);
	if (!changes.length) return;
	await st.setJSON('snapshot', snapshot);

	const store = subscribers();
	const { blobs } = await store.list();
	const messages: OutgoingEmail[] = [];
	for (let i = 0; i < blobs.length; i += 25) {
		const batch = await Promise.all(
			blobs.slice(i, i + 25).map(async ({ key }) => ({ key, sub: (await store.get(key, { type: 'json' })) as Subscriber | null })),
		);
		for (const { key, sub } of batch) {
			if (!sub?.confirmed) continue;
			const relevant = changesFor(sub.country, changes);
			if (!relevant.length) continue;
			const links = unsubscribeLinks(key, sub);
			const mail = buildAlertEmail(sub.lang, sub.country, relevant, `${siteUrl()}${localePath(sub.lang, '/')}`, links.page);
			messages.push({
				to: sub.email,
				...mail,
				headers: { 'List-Unsubscribe': `<${links.oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
			});
		}
	}
	await sendBatch(messages);
	console.log(`${changes.length} change(s); sent ${messages.length} alert(s).`);
};

export const config: Config = { schedule: '@hourly' };
