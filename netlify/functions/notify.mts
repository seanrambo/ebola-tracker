import type { Config } from '@netlify/functions';
import { buildAlertEmail, changesFor, diffSnapshots, type Change, type Subscriber } from '../../src/lib/alerts';
import { localePath } from '../../src/i18n';
import type { CountryRecord } from '../../src/lib/outbreak';
import { alertMessage, type TelegramSubscriber } from '../../src/lib/telegram';
import { sendBatch, siteUrl, state, subscribers, unsubscribeLinks, type OutgoingEmail } from '../lib/server.mts';
import { TelegramError, ensureWebhook, sendMessage, telegramEnabled, telegramSubscribers } from '../lib/telegram.mts';

// Scheduled functions are stopped after 30 seconds; leave room to save progress.
const TIME_BUDGET_MS = 24_000;
// Telegram allows about 30 messages per second across all chats.
const TELEGRAM_PER_SECOND = 25;

interface Queued {
	chatId: number;
	text: string;
}

// Runs hourly. Compares the live /api/stats.json with the last version we
// alerted on, and alerts subscribers (email and Telegram) whose country or a
// neighbour changed. Progress is saved before sending, so a failure part-way
// through can skip some messages but never sends duplicates.
export default async () => {
	const startedAt = Date.now();
	const res = await fetch(`${siteUrl()}/api/stats.json`, { headers: { 'Cache-Control': 'no-cache' } });
	if (!res.ok) throw new Error(`Could not load stats: ${res.status}`);
	const live = (await res.json()) as { updated: string; countries: CountryRecord[] };

	const st = state();
	const prev = (await st.get('snapshot', { type: 'json' })) as { updated: string; countries: CountryRecord[] } | null;
	const snapshot = { updated: live.updated, countries: live.countries.map(({ code, status, confirmed, deaths }) => ({ code, status, confirmed, deaths })) };
	let changes: Change[] = [];
	if (!prev) {
		await st.setJSON('snapshot', snapshot);
		console.log('Saved first snapshot; no alerts sent.');
	} else {
		changes = diffSnapshots(prev.countries, snapshot.countries);
		if (changes.length) await st.setJSON('snapshot', snapshot);
	}

	// An email failure must not stop the Telegram alerts (the snapshot is already saved).
	if (changes.length) await sendEmailAlerts(changes).catch((err) => console.error(err));
	if (telegramEnabled()) {
		// Backup for the deploy-succeeded hook: reconnect the bot if its webhook was lost.
		await ensureWebhook().catch((err) => console.error(err));
		await sendTelegramAlerts(changes, startedAt + TIME_BUDGET_MS);
	}
};

async function sendEmailAlerts(changes: Change[]) {
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
	console.log(`${changes.length} change(s); sent ${messages.length} email alert(s).`);
}

/**
 * Adds Telegram alerts for these changes to a queue in Blobs, then sends as many as
 * fit in the time left. Anything left over is sent on the next hourly run.
 */
async function sendTelegramAlerts(changes: Change[], deadline: number) {
	const st = state();
	const store = telegramSubscribers();
	let queue = ((await st.get('telegram-queue', { type: 'json' })) as Queued[] | null) ?? [];

	if (changes.length) {
		const { blobs } = await store.list();
		for (let i = 0; i < blobs.length; i += 25) {
			const subs = await Promise.all(blobs.slice(i, i + 25).map(({ key }) => store.get(key, { type: 'json' }) as Promise<TelegramSubscriber | null>));
			for (const sub of subs) {
				if (!sub?.country) continue;
				const relevant = changesFor(sub.country, changes);
				if (relevant.length) queue.push({ chatId: sub.chatId, text: alertMessage(sub.lang, sub.country, relevant, siteUrl()) });
			}
		}
	}
	if (!queue.length) return;

	let sent = 0;
	while (queue.length && Date.now() < deadline) {
		const chunk = queue.slice(0, TELEGRAM_PER_SECOND);
		queue = queue.slice(chunk.length);
		await st.setJSON('telegram-queue', queue);
		const chunkStart = Date.now();
		const results = await Promise.allSettled(chunk.map((m) => sendMessage(m.chatId, m.text)));
		let rateLimited = false;
		for (const [i, r] of results.entries()) {
			if (r.status === 'fulfilled') {
				sent++;
				continue;
			}
			const err = r.reason;
			if (err instanceof TelegramError && err.status === 429) {
				rateLimited = true;
				queue.unshift(chunk[i]);
			} else if (err instanceof TelegramError && (err.status === 403 || /chat not found/i.test(err.description))) {
				// The person blocked the bot or deleted their account: forget them.
				await store.delete(String(chunk[i].chatId));
			} else console.error(err);
		}
		if (rateLimited) break;
		const wait = 1000 - (Date.now() - chunkStart);
		if (wait > 0 && queue.length) await new Promise((r) => setTimeout(r, wait));
	}
	if (queue.length) await st.setJSON('telegram-queue', queue);
	else await st.delete('telegram-queue');
	console.log(`Sent ${sent} Telegram alert(s); ${queue.length} queued for the next run.`);
}

export const config: Config = { schedule: '@hourly' };
