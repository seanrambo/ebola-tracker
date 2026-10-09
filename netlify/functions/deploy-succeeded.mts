import { ensureWebhook, telegramEnabled } from '../lib/telegram.mts';

// Netlify runs this after every successful deploy. It connects the Telegram bot
// to this site, so adding TELEGRAM_BOT_TOKEN and redeploying is all the setup needed.
export default async () => {
	if (!telegramEnabled()) return new Response('Telegram not set up');
	try {
		const changed = await ensureWebhook();
		console.log(changed ? 'Telegram webhook set.' : 'Telegram webhook already set.');
	} catch (err) {
		console.error(err);
	}
	return new Response('ok');
};
