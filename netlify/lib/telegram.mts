import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { LANGS, t } from '../../src/i18n';
import { env, siteUrl } from './server.mts';

export const telegramEnabled = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);
export const telegramSubscribers = () => getStore({ name: 'telegram', consistency: 'strong' });
export const webhookUrl = () => `${siteUrl()}/api/telegram`;

/** Telegram sends this back on every webhook call, so we know the request came from Telegram. Derived from the token. */
export const webhookSecret = () => createHash('sha256').update(`webhook:${env('TELEGRAM_BOT_TOKEN')}`).digest('hex');

export class TelegramError extends Error {
	constructor(
		public method: string,
		public status: number,
		public description: string,
		public retryAfter?: number,
	) {
		super(`Telegram ${method} failed: ${status} ${description}`);
	}
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
	// TELEGRAM_API_URL is only for local testing against a fake server.
	const base = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
	const res = await fetch(`${base}/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
	if (!data.ok) throw new TelegramError(method, res.status, data.description ?? 'unknown error', data.parameters?.retry_after);
	return data.result as T;
}

export const sendMessage = (chatId: number, text: string) =>
	tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });

/** Points the bot at this site and sets its command menu in each language. Safe to call repeatedly. */
export async function ensureWebhook() {
	const info = await tg<{ url: string }>('getWebhookInfo');
	if (info.url === webhookUrl()) return false;
	await tg('setWebhook', { url: webhookUrl(), secret_token: webhookSecret(), allowed_updates: ['message'], drop_pending_updates: false });
	for (const lang of LANGS) {
		const c = t(lang).telegram.commands;
		const commands = [
			{ command: 'status', description: c.status },
			{ command: 'country', description: c.country },
			{ command: 'stop', description: c.stop },
			{ command: 'help', description: c.help },
		];
		await tg('setMyCommands', lang === 'en' ? { commands } : { commands, language_code: lang });
	}
	return true;
}
