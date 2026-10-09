import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { localePath, type Lang } from '../../src/i18n';
import type { Subscriber } from '../../src/lib/alerts';

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

export function env(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing environment variable ${name}`);
	return value;
}

/** The public site URL. Netlify sets URL automatically; SITE_URL overrides it (e.g. for a custom domain). */
export function siteUrl(): string {
	return (process.env.SITE_URL || process.env.URL || 'http://localhost:8888').replace(/\/$/, '');
}

export const json = (body: unknown, status = 200) =>
	Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export const subscribers = () => getStore({ name: 'subscribers', consistency: 'strong' });
export const state = () => getStore({ name: 'state', consistency: 'strong' });

/** Store key for an email: a keyed hash, so keys alone don't reveal addresses. */
export function emailId(email: string): string {
	return createHmac('sha256', env('SUB_SECRET')).update(email.trim().toLowerCase()).digest('hex').slice(0, 40);
}

export const randomToken = () => randomBytes(24).toString('base64url');

export function tokensMatch(a: string | undefined | null, b: string | undefined | null): boolean {
	if (!a || !b) return false;
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export async function getSubscriber(id: string): Promise<Subscriber | null> {
	if (!/^[a-f0-9]{40}$/.test(id)) return null;
	return (await subscribers().get(id, { type: 'json' })) as Subscriber | null;
}

export function alertsPageUrl(lang: Lang, params: Record<string, string>): string {
	return `${siteUrl()}${localePath(lang, '/alerts/')}?${new URLSearchParams(params)}`;
}

export function unsubscribeLinks(id: string, sub: Subscriber) {
	return {
		page: alertsPageUrl(sub.lang, { s: 'unsubscribe', id, t: sub.unsubToken }),
		oneClick: `${siteUrl()}/api/unsubscribe?${new URLSearchParams({ id, t: sub.unsubToken })}`,
	};
}

export interface OutgoingEmail {
	to: string;
	subject: string;
	html: string;
	text: string;
	headers?: Record<string, string>;
}

const toResend = (m: OutgoingEmail) => ({ from: env('ALERT_FROM'), to: [m.to], subject: m.subject, html: m.html, text: m.text, headers: m.headers });

async function resend(path: string, body: unknown) {
	// RESEND_API_URL is only for local testing against a fake server.
	const res = await fetch(`${process.env.RESEND_API_URL || 'https://api.resend.com'}${path}`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`Resend ${path} failed: ${res.status} ${await res.text()}`);
	return res.json();
}

export const sendEmail = (m: OutgoingEmail) => resend('/emails', toResend(m));

/** Sends up to 100 emails per Resend batch request. */
export async function sendBatch(messages: OutgoingEmail[]) {
	for (let i = 0; i < messages.length; i += 100) await resend('/emails/batch', messages.slice(i, i + 100).map(toResend));
}
