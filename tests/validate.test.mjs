import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateUpdate } from '../scripts/validate-data.mjs';

const data = JSON.parse(readFileSync(new URL('../src/data/ebola.json', import.meta.url), 'utf8'));
const opts = { allowedUrls: ['https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON620'], today: '2026-10-20' };
const clone = () => structuredClone(data);
const cd = (d) => d.countries.find((c) => c.code === 'CD');

test('the published data passes its own checks', () => {
	assert.deepEqual(validateUpdate(data, data, opts), []);
});

test('a normal increase passes', () => {
	const next = clone();
	Object.assign(cd(next), { confirmed: 9100, deaths: 4400, recovered: 2400, asOf: '2026-10-18', sourceUrl: opts.allowedUrls[0] });
	next.who = { ...next.who, confirmed: 9122, deaths: 4403, asOf: '2026-10-18', url: opts.allowedUrls[0] };
	assert.deepEqual(validateUpdate(data, next, opts), []);
});

test('rejects falling cumulative counts', () => {
	const next = clone();
	cd(next).confirmed = 8000;
	assert.match(validateUpdate(data, next, opts).join('\n'), /confirmed fell/);
});

test('rejects deaths above cases, future dates, unknown URLs and huge jumps', () => {
	const next = clone();
	const ke = next.countries.find((c) => c.code === 'KE');
	ke.deaths = 5;
	ke.asOf = '2026-12-01';
	ke.sourceUrl = 'https://example.com/fake';
	cd(next).confirmed = 30000;
	const errors = validateUpdate(data, next, opts).join('\n');
	assert.match(errors, /deaths exceed/);
	assert.match(errors, /in the future/);
	assert.match(errors, /not one of the reports/);
	assert.match(errors, /needs human review/);
});

test('rejects removed countries, missing translations and HTML in text', () => {
	const next = clone();
	next.countries = next.countries.filter((c) => c.code !== 'FR');
	cd(next).note = { en: 'ok', sw: '', fr: '<script>x</script>' };
	const errors = validateUpdate(data, next, opts).join('\n');
	assert.match(errors, /FR was removed/);
	assert.match(errors, /missing sw/);
	assert.match(errors, /contains HTML/);
});

test('rejects provinces that add up to more than the country', () => {
	const next = clone();
	next.regions[0].confirmed = 9000;
	assert.match(validateUpdate(data, next, opts).join('\n'), /provinces add up/);
});
