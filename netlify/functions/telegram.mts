import type { Config } from '@netlify/functions';
import data from '../../src/data/ebola.json' with { type: 'json' };
import type { CountryRecord } from '../../src/lib/outbreak';
import { handleMessage, type TelegramSubscriber } from '../../src/lib/telegram';
import { siteUrl, tokensMatch } from '../lib/server.mts';
import { sendMessage, telegramEnabled, telegramSubscribers, webhookSecret } from '../lib/telegram.mts';

interface Update {
	message?: { chat: { id: number }; from?: { language_code?: string; is_bot?: boolean }; text?: string };
}

// Telegram calls this for every message sent to the bot.
export default async (req: Request) => {
	if (!telegramEnabled()) return new Response('Telegram is not set up', { status: 404 });
	if (req.method !== 'POST' || !tokensMatch(req.headers.get('x-telegram-bot-api-secret-token'), webhookSecret()))
		return new Response('Forbidden', { status: 403 });

	const update = (await req.json().catch(() => ({}))) as Update;
	const msg = update.message;
	if (!msg?.text || msg.from?.is_bot) return new Response('ok');

	const store = telegramSubscribers();
	const key = String(msg.chat.id);
	const sub = (await store.get(key, { type: 'json' })) as TelegramSubscriber | null;
	const reply = handleMessage(msg.text, msg.chat.id, sub, msg.from?.language_code, data.countries as CountryRecord[], siteUrl());

	if (reply.save === null) await store.delete(key);
	else if (reply.save) await store.setJSON(key, reply.save);
	try {
		await sendMessage(msg.chat.id, reply.text);
	} catch (err) {
		console.error(err);
	}
	// Always answer 200, or Telegram keeps retrying the same message.
	return new Response('ok');
};

export const config: Config = { path: '/api/telegram' };
