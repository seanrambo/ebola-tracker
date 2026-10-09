# Ebola Tracker

An Astro site that tracks the 2026 Bundibugyo Ebola epidemic in English, Kiswahili and French. It shows the situation in the visitor's country, has an interactive globe (click a country or a province marker to see its cases), sends alerts by email and Telegram, and updates its figures automatically from WHO reports.

## Develop

```sh
npm install
npm run dev      # site only
npm test         # data-validation and alert-logic tests
npm run check    # type check
```

To run the alert functions locally, use `npx netlify-cli dev` with the environment variables below.

## Languages

English is served at `/`, Kiswahili at `/sw/` and French at `/fr/`. Interface text lives in `src/i18n/{en,sw,fr}.ts`. TypeScript requires all three files to have the same keys. Text inside the data (notes, timeline, province names) is stored as `{ "en": …, "sw": …, "fr": … }`.

## Data

All figures live in `src/data/ebola.json`, and every change is listed in `src/data/changelog.json`.

### Automatic updates

`.github/workflows/update-data.yml` runs every 6 hours:

1. `scripts/update-data.mjs` reads the latest Ebola reports from WHO's Disease Outbreak News API. If they haven't changed since the last run, it stops. This costs nothing.
2. When there is a new report, Claude (`claude-opus-5-5`) drafts updated figures and translations as JSON that matches a fixed schema.
3. `scripts/validate-data.mjs` checks the draft against strict rules:
   - cumulative counts never fall, and deaths never exceed cases
   - dates are valid and not in the future, and every source URL is a report that was actually read
   - big jumps are held back, and countries and provinces are never silently removed
4. If the checks pass, the site is rebuilt and the change is committed, and Netlify redeploys. If they fail, nothing is published, and an issue labelled `data-review` is opened instead.

Manual edits: change `src/data/ebola.json`, then run `npm run update-data -- --mark-processed` so the next automatic run doesn't re-read the same report.

`src/data/neighbours.json` holds the land borders used for "Borders an affected country" warnings and alerts. It is generated from the map data with `node scripts/build-neighbours.mjs > src/data/neighbours.json`.

## Email alerts

Subscriptions are stored in Netlify Blobs, and email is sent with [Resend](https://resend.com). The sign-up form and the Alerts menu link appear only when `RESEND_API_KEY`, `ALERT_FROM` and `SUB_SECRET` are all set in Netlify. After adding them, trigger a new deploy.

- `POST /api/subscribe` saves a pending subscription and sends a confirmation email. It is rate-limited to one email per address every 10 minutes and has a honeypot field to stop bots.
- The links in emails open `/alerts/` pages, where a button calls `POST /api/confirm` or `POST /api/unsubscribe`. Email scanners that open links therefore can't confirm or unsubscribe anyone by accident. Mail clients get RFC 8058 one-click unsubscribe headers.
- `notify` runs hourly. It compares the live `/api/stats.json` with the last version it alerted on, and emails each confirmed subscriber about changes in their country or a neighbouring one, in their language.

## Telegram alerts

The "Get alerts on Telegram" button appears only when `TELEGRAM_BOT_TOKEN` is set in Netlify and Telegram accepts it at build time. Create a bot with [@BotFather](https://t.me/BotFather), add its token, and redeploy. Nothing else is needed: the `deploy-succeeded` function points the bot's webhook at `/api/telegram` and sets its command menu in all three languages. `notify` also checks the webhook every hour and restores it if it was lost.

- The button opens the bot with the visitor's country and language (`?start=CD_sw`), so they are subscribed as soon as they press Start.
- People can also type a country name in English, Kiswahili or French, or use `/status`, `/country`, `/stop`, `/help`, `/en`, `/sw` and `/fr`.
- Subscribers are stored in the `telegram` Netlify Blobs store, keyed by chat ID. Webhook calls are checked against a secret token derived from the bot token.
- `notify` sends Telegram alerts about the same changes as the emails. They go through a queue that stays under Telegram's rate limit and the 30-second function limit; whatever doesn't fit is sent on the next hourly run. Chats that blocked the bot are removed.

## Setup

**Netlify** (Site configuration → Environment variables):

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | API key from resend.com |
| `ALERT_FROM` | Sender on a domain verified in Resend, e.g. `Ebola Tracker <alerts@yourdomain.org>` |
| `SUB_SECRET` | Any long random string (e.g. `openssl rand -hex 32`); used to key subscriber records |
| `TELEGRAM_BOT_TOKEN` | Optional. Token from @BotFather; turns on Telegram alerts. |
| `SITE_URL` | Optional. Set it if you use a custom domain; otherwise Netlify's own URL is used. |

**GitHub** (Settings → Secrets and variables → Actions): add `ANTHROPIC_API_KEY`.

## Endpoints

- `/api/stats.json` and `/api/stats.csv`: open data (CORS enabled)
- `/api/geo`: Netlify Edge Function that returns the visitor's country code
- `/api/subscribe`, `/api/confirm`, `/api/unsubscribe`: email alerts
- `/api/telegram`: Telegram bot webhook
