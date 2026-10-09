/**
 * Email alerts are shown only when Netlify has the settings needed to send them.
 * Netlify passes environment variables to the build, so adding them and redeploying
 * makes the sign-up form appear.
 */
export const alertsEnabled = Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM && process.env.SUB_SECRET);
