import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertMessage, findCountry, handleMessage, parseMessage, parseStartParam } from '../src/lib/telegram';
import type { CountryRecord } from '../src/lib/outbreak';
import data from '../src/data/ebola.json' with { type: 'json' };

const countries = data.countries as CountryRecord[];
const SITE = 'https://example.org';
const reply = (text: string, sub: Parameters<typeof handleMessage>[2] = null, userLang = 'en') =>
	handleMessage(text, 42, sub, userLang, countries, SITE, 1000);

test('parses commands, bot mentions and plain text', () => {
	assert.deepEqual(parseMessage('/start CD_sw'), { command: 'start', arg: 'CD_sw' });
	assert.deepEqual(parseMessage('/status@EbolaTrackerBot'), { command: 'status', arg: '' });
	assert.deepEqual(parseMessage('  Kenya '), { command: null, arg: 'Kenya' });
	assert.deepEqual(parseStartParam('CD_sw'), { country: 'CD', lang: 'sw' });
	assert.deepEqual(parseStartParam('fr'), { country: undefined, lang: 'fr' });
	assert.deepEqual(parseStartParam('ZZ_en'), { country: undefined, lang: 'en' });
	assert.deepEqual(parseStartParam('<script>'), {});
});

test('finds countries in English, Kiswahili and French', () => {
	assert.equal(findCountry('Kenya'), 'KE');
	assert.equal(findCountry('ouganda'), 'UG');
	assert.equal(findCountry('Côte d’Ivoire'), 'CI');
	assert.equal(findCountry('DRC'), 'CD');
	assert.equal(findCountry('RD Congo'), 'CD');
	assert.equal(findCountry('Republic of the Congo'), 'CG');
	assert.equal(findCountry('tanzania'), 'TZ');
	assert.equal(findCountry('Afrika Kusini'), 'ZA');
	assert.equal(findCountry('rw'), 'RW');
	assert.equal(findCountry('congo'), null, 'ambiguous');
	assert.equal(findCountry('hello'), null);
});

test('start from the website subscribes straight away in the chosen language', () => {
	const r = reply('/start RW_sw');
	assert.equal(r.save?.country, 'RW');
	assert.equal(r.save?.lang, 'sw');
	assert.match(r.text, /Rwanda/);
	assert.match(r.text, /Tayari/);
});

test('start without a country asks for one, then a plain name subscribes', () => {
	const first = reply('/start', null, 'fr-FR');
	assert.equal(first.save?.country, undefined);
	assert.equal(first.save?.lang, 'fr');
	const second = reply('Ouganda', first.save!);
	assert.equal(second.save?.country, 'UG');
	assert.match(second.text, /Ouganda/);
});

test('unknown text gets a helpful answer and saves nothing', () => {
	const r = reply('<b>nowhere</b>');
	assert.equal(r.save, undefined);
	assert.match(r.text, /&lt;b&gt;nowhere/);
});

test('status, language change and stop', () => {
	const sub = { chatId: 42, lang: 'en' as const, country: 'CD', createdAt: 1 };
	assert.match(reply('/status', sub).text, /8,728 confirmed cases/);
	assert.match(reply('/status').text, /haven't chosen/);
	assert.equal(reply('/fr', sub).save?.lang, 'fr');
	assert.equal(reply('/stop', sub).save, null);
	assert.equal(reply('/stop').save, undefined);
});

test('alert message is valid Telegram HTML in the subscriber language', () => {
	const text = alertMessage('fr', 'RW', [{ kind: 'increase', code: 'CD', newCases: 12, total: 8740, deaths: 4210 }], SITE);
	assert.match(text, /RD Congo/);
	assert.match(text, /\/stop/);
	assert.match(text, /href="https:\/\/example.org\/fr\/"/);
	assert.doesNotMatch(text.replace(/<\/?(b|i|a)( href="[^"]*")?>/g, ''), /[<>]/);
});
