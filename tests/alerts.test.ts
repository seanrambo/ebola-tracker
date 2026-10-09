import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlertEmail, buildConfirmEmail, changesFor, diffSnapshots } from '../src/lib/alerts';
import { statusOf, type CountryRecord } from '../src/lib/outbreak';
import data from '../src/data/ebola.json' with { type: 'json' };

const countries = data.countries as CountryRecord[];
const prev = [
	{ code: 'CD', status: 'active' as const, confirmed: 8728, deaths: 4205 },
	{ code: 'KE', status: 'imported' as const, confirmed: 1, deaths: 1 },
];

test('status: own outbreak, neighbour, and far away', () => {
	assert.equal(statusOf('CD', countries), 'active');
	assert.equal(statusOf('KE', countries), 'imported');
	assert.equal(statusOf('RW', countries), 'monitoring');
	assert.equal(statusOf('TZ', countries), 'monitoring');
	assert.equal(statusOf('UG', countries), 'ended');
	assert.equal(statusOf('JP', countries), 'none');
});

test('diff finds increases, status changes and new countries', () => {
	const next = [
		{ code: 'CD', status: 'active' as const, confirmed: 9000, deaths: 4300 },
		{ code: 'KE', status: 'ended' as const, confirmed: 1, deaths: 1 },
		{ code: 'RW', status: 'imported' as const, confirmed: 1, deaths: 0 },
	];
	const changes = diffSnapshots(prev, next);
	assert.deepEqual(
		changes.map((c) => `${c.code}:${c.kind}`),
		['CD:increase', 'KE:status', 'RW:new'],
	);
	assert.equal(diffSnapshots(prev, prev).length, 0);
});

test('subscribers only hear about their country and its neighbours', () => {
	const changes = diffSnapshots(prev, [
		{ code: 'CD', status: 'active', confirmed: 9000, deaths: 4300 },
		{ code: 'KE', status: 'imported', confirmed: 2, deaths: 1 },
	]);
	assert.deepEqual(changesFor('KE', changes).map((c) => c.code), ['KE']); // Kenya doesn't border the DRC
	assert.deepEqual(changesFor('UG', changes).map((c) => c.code), ['CD', 'KE']); // Uganda borders both
	assert.deepEqual(changesFor('RW', changes).map((c) => c.code), ['CD']);
	assert.deepEqual(changesFor('JP', changes), []);
	assert.equal(changesFor('CD', changes)[0].code, 'CD'); // own country first
});

test('alert emails are translated and escape nothing unexpected', () => {
	const changes = diffSnapshots(prev, [{ code: 'CD', status: 'active', confirmed: 9000, deaths: 4300 }, prev[1]]);
	const sw = buildAlertEmail('sw', 'RW', changes, 'https://x.test/sw/', 'https://x.test/sw/alerts/?s=unsubscribe');
	assert.match(sw.subject, /Taarifa mpya ya Ebola kwa Rwanda/);
	assert.match(sw.text, /wagonjwa wapya 272/);
	const fr = buildAlertEmail('fr', 'RW', changes, 'https://x.test/fr/', 'https://x.test/u');
	assert.match(fr.text, /272 nouveaux cas confirmés/);
	assert.match(fr.html, /lang="fr"/);
	const confirm = buildConfirmEmail('en', 'KE', 'https://x.test/alerts/?s=confirm&id=a&t=b');
	assert.match(confirm.html, /s=confirm&#38;id=a&#38;t=b/);
	assert.match(confirm.text, /Kenya/);
});
