/**
 * Alert channels are shown only when Netlify has the settings needed to send them.
 * Netlify passes environment variables to the build, so adding them and redeploying
 * makes the sign-up options appear.
 */
export const alertsEnabled = Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM && process.env.SUB_SECRET);

/** The Telegram bot's username, looked up from TELEGRAM_BOT_TOKEN at build time; null when Telegram is off. */
export const telegramBot: string | null = await (async () => {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	if (!token) return null;
	try {
		const res = await fetch(`${process.env.TELEGRAM_API_URL || 'https://api.telegram.org'}/bot${token}/getMe`);
		const data = (await res.json()) as { ok: boolean; result?: { username?: string } };
		if (data.ok && data.result?.username) return data.result.username;
		console.warn('TELEGRAM_BOT_TOKEN was rejected by Telegram; hiding the Telegram button.');
	} catch (err) {
		console.warn('Could not reach Telegram; hiding the Telegram button.', err);
	}
	return null;
})();

export const anyAlerts = alertsEnabled || telegramBot !== null;
