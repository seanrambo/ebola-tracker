import data from '../data/ebola.json';
import { t, tr, fmt, fmtDate, cfr, countryName, listJoin, isLang, type Lang } from '../i18n';
import { affectedNeighbours, statusOf, type CountryRecord, type RegionRecord, type Status } from '../lib/outbreak';

type Past = (typeof data.history)[number];

const lang: Lang = isLang(document.documentElement.lang) ? document.documentElement.lang : 'en';
const d = t(lang);
const countries = data.countries as CountryRecord[];
const regions = data.regions as RegionRecord[];
const byCode = new Map(countries.map((c) => [c.code, c]));

const STATUS_FILL: Record<Status, string> = {
	active: 'rgba(229, 72, 77, 0.8)',
	imported: 'rgba(247, 107, 21, 0.8)',
	monitoring: 'rgba(255, 178, 36, 0.4)',
	ended: 'rgba(62, 155, 143, 0.65)',
	none: 'rgba(120, 132, 155, 0.22)',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const name = (code: string) => esc(countryName(code, lang));
const n = (v: number | null | undefined) => fmt(v, lang);
const date = (iso: string) => fmtDate(iso, lang);

function advice(code: string): string {
	const near = listJoin(affectedNeighbours(code, countries).map((c) => name(c.code)), lang);
	const status = statusOf(code, countries);
	switch (status) {
		case 'active':
			return d.advice.active(name(code));
		case 'imported':
			return d.advice.imported(name(code));
		case 'ended':
			return d.advice.ended(name(code)) + (near ? d.advice.endedNear(near) : '');
		case 'monitoring':
			return d.advice.monitoring(name(code), near);
		default:
			return d.advice.none(name(code));
	}
}

function statGrid(c: CountryRecord) {
	const cells: [string, number | null][] = [
		[d.stats.confirmed, c.confirmed],
		[d.stats.probable, c.probable],
		[d.stats.suspected, c.suspected],
		[d.stats.deaths, c.deaths],
		[d.stats.recovered, c.recovered],
	];
	return `<dl class="stats">${cells
		.map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${n(v)}</dd></div>`)
		.join('')}<div><dt>${d.stats.cfr}</dt><dd class="num">${cfr(c.deaths, c.confirmed, lang)}</dd></div></dl>`;
}

function countryHtml(code: string, opts: { compact?: boolean } = {}) {
	const c = byCode.get(code);
	const status = statusOf(code, countries);
	let html = `<div class="ph"><h3>${name(code)}</h3><span class="badge" data-status="${status}">${d.status[status]}</span></div>`;
	html += `<p>${advice(code)}</p>`;
	if (c) {
		const dates = [d.virus[c.virus], d.panel.firstCase(date(c.declared))];
		if (c.ended) dates.push(d.panel.ended(date(c.ended)));
		html += `<p class="muted small">${dates.map(esc).join(' · ')}</p>`;
		html += statGrid(c);
		const note = tr(c.note, lang);
		if (note) html += `<p class="small">${esc(note)}</p>`;
		const regs = regions
			.map((r, i) => ({ r, i }))
			.filter(({ r }) => r.country === code)
			.sort((a, b) => b.r.confirmed - a.r.confirmed);
		if (regs.length && !opts.compact) {
			html += `<h4>${d.panel.byProvince}</h4><ul class="plist">${regs
				.map(
					({ r, i }) =>
						`<li><button data-region="${i}"><span>${esc(tr(r.name, lang))}</span><span class="num">${esc(d.panel.provinceRow(n(r.confirmed), n(r.deaths)))}</span></button></li>`,
				)
				.join('')}</ul>`;
		}
		html += `<p class="muted small">${d.panel.source}: <a href="${esc(c.sourceUrl)}">${esc(c.source)}</a>, ${esc(d.panel.asOf(date(c.asOf)))}.</p>`;
	}
	const past = data.history.filter((h) => h.country === code).sort((a, b) => b.year - a.year);
	if (past.length) {
		html += `<h4>${d.panel.pastHere}</h4><ul class="past">${past
			.map(
				(h) =>
					`<li><span class="num">${h.year}</span> ${esc(tr(h.place, lang))}: ${esc(d.panel.pastRow(n(h.cases), n(h.deaths)))} <span class="muted">(${esc(d.virus[h.virus])})</span></li>`,
			)
			.join('')}</ul>`;
	}
	return html;
}

function regionHtml(r: RegionRecord) {
	const total = byCode.get(r.country)?.confirmed || 1;
	const share = ((r.confirmed / total) * 100).toLocaleString(lang, { maximumFractionDigits: 1 });
	return `<p class="muted small"><button class="link" data-back="${r.country}">← ${name(r.country)}</button></p>
	<div class="ph"><h3>${esc(tr(r.name, lang))}</h3><span class="badge" data-status="active">${d.status.active}</span></div>
	<p class="muted small">${esc(d.panel.province(countryName(r.country, lang)))}</p>
	<dl class="stats">
		<div><dt>${d.stats.confirmed}</dt><dd class="num">${n(r.confirmed)}</dd></div>
		<div><dt>${d.stats.deaths}</dt><dd class="num">${n(r.deaths)}</dd></div>
		<div><dt>${d.stats.cfr}</dt><dd class="num">${cfr(r.deaths, r.confirmed, lang)}</dd></div>
		<div><dt>${d.stats.share}</dt><dd class="num">${share}%</dd></div>
	</dl>
	<p class="muted small">${esc(d.panel.provinceSource(date(byCode.get(r.country)?.asOf ?? data.updated)))}</p>`;
}

function pastHtml(h: Past) {
	return `<div class="ph"><h3>${esc(tr(h.place, lang))}</h3><span class="badge">${h.year}</span></div>
	<p class="muted small">${name(h.country)} · ${esc(d.virus[h.virus])}</p>
	<dl class="stats">
		<div><dt>${d.stats.cases}</dt><dd class="num">${n(h.cases)}</dd></div>
		<div><dt>${d.stats.deaths}</dt><dd class="num">${n(h.deaths)}</dd></div>
		<div><dt>${d.stats.cfr}</dt><dd class="num">${cfr(h.deaths, h.cases, lang)}</dd></div>
	</dl>
	<p class="muted small"><button class="link" data-back="${h.country}">${esc(d.panel.seeToday(countryName(h.country, lang)))}</button></p>`;
}

/* ---------------- Globe ---------------- */

type Marker =
	| { kind: 'region'; lat: number; lng: number; size: number; color: string; r: RegionRecord }
	| { kind: 'country'; lat: number; lng: number; size: number; color: string; c: CountryRecord }
	| { kind: 'past'; lat: number; lng: number; size: number; color: string; h: Past };

const markerAlt = (v: number) => 0.01 + Math.log10(v + 1) * 0.045;

const currentMarkers: Marker[] = [
	...regions.map((r) => ({ kind: 'region' as const, lat: r.lat, lng: r.lng, size: r.confirmed, color: '#ff6b70', r })),
	...countries
		.filter((c) => !regions.some((r) => r.country === c.code))
		.map((c) => ({
			kind: 'country' as const,
			lat: c.lat,
			lng: c.lng,
			size: c.confirmed,
			color: c.status === 'imported' ? '#ff8b3d' : c.status === 'active' ? '#ff6b70' : '#4fc3b3',
			c,
		})),
];
const pulsing = currentMarkers.filter((m) => m.kind === 'region' || (m.kind === 'country' && m.c.status !== 'ended'));
const pastMarkers: Marker[] = data.history.map((h) => ({ kind: 'past' as const, lat: h.lat, lng: h.lng, size: h.cases, color: '#ffd166', h }));

let focusCountry: ((code: string) => void) | null = null;
let pendingFocus: string | null = null;

async function initGlobe(panel: HTMLElement) {
	const el = document.getElementById('globe-canvas')!;
	const [{ default: Globe }, topojson, topo, iso, { geoCentroid }] = await Promise.all([
		import('globe.gl'),
		import('topojson-client'),
		import('world-atlas/countries-110m.json'),
		import('i18n-iso-countries'),
		import('d3-geo'),
	]);
	const numericToAlpha2 = ((iso as any).default ?? iso).numericToAlpha2 as (id: string) => string | undefined;

	const world = topojson.feature(topo as any, (topo as any).objects.countries) as any;
	const features = world.features
		.map((f: any) => ({ ...f, code: f.id ? numericToAlpha2(f.id) : undefined }))
		.filter((f: any) => f.code && f.code !== 'AQ');
	const featureByCode = new Map<string, any>(features.map((f: any) => [f.code, f]));

	let selected: string | null = null;
	let hovered: any = null;
	let showPast = false;

	const tip = (title: string, line?: string) => `<div class="gl-tip"><b>${title}</b>${line ? `<br>${line}` : ''}</div>`;

	const globe = new Globe(el, { animateIn: true })
		.backgroundColor('rgba(0,0,0,0)')
		.showAtmosphere(true)
		.atmosphereColor('#4ea8de')
		.atmosphereAltitude(0.16)
		.polygonsData(features)
		.polygonCapColor((f: any) => {
			const base = STATUS_FILL[statusOf(f.code, countries)];
			if (f.code === selected) return 'rgba(78, 168, 222, 0.85)';
			if (f === hovered) return base.replace(/[\d.]+\)$/, (a) => `${Math.min(1, parseFloat(a) + 0.25)})`);
			return base;
		})
		.polygonSideColor(() => 'rgba(0, 0, 0, 0.25)')
		.polygonStrokeColor((f: any) => (f.code === selected ? '#ffffff' : 'rgba(255, 255, 255, 0.18)'))
		.polygonAltitude((f: any) => (f.code === selected ? 0.03 : f === hovered ? 0.015 : 0.006))
		.polygonsTransitionDuration(250)
		.polygonLabel((f: any) => {
			const c = byCode.get(f.code);
			const s = d.status[statusOf(f.code, countries)];
			return tip(name(f.code), c ? `${s}<br>${n(c.confirmed)} ${d.now.confirmed} · ${n(c.deaths)} ${d.now.deaths}` : s);
		})
		.onPolygonHover((f: any) => {
			hovered = f;
			el.style.cursor = f ? 'pointer' : 'grab';
			globe.polygonsData(globe.polygonsData());
		})
		.onPolygonClick((f: any) => selectCountry(f.code))
		.pointsData(currentMarkers)
		.pointLat('lat')
		.pointLng('lng')
		.pointColor('color')
		.pointAltitude((m: any) => markerAlt(m.size))
		.pointRadius((m: any) => (m.kind === 'past' ? 0.35 : 0.45))
		.pointsMerge(false)
		.pointLabel((m: any) => {
			if (m.kind === 'region') return tip(esc(tr(m.r.name, lang)), esc(d.panel.provinceRow(n(m.r.confirmed), n(m.r.deaths))));
			if (m.kind === 'country') return tip(name(m.c.code), esc(d.panel.provinceRow(n(m.c.confirmed), n(m.c.deaths))));
			return tip(`${esc(tr(m.h.place, lang))} (${m.h.year})`, esc(d.panel.pastRow(n(m.h.cases), n(m.h.deaths))));
		})
		.onPointClick((m: any) => {
			if (m.kind === 'region') showRegion(m.r);
			else if (m.kind === 'country') selectCountry(m.c.code);
			else showPastOutbreak(m.h);
		})
		.ringsData(pulsing)
		.ringLat('lat')
		.ringLng('lng')
		.ringColor(() => (x: number) => `rgba(255, 90, 95, ${1 - x})`)
		.ringMaxRadius((m: any) => 1.5 + Math.log10(m.size + 1) * 1.2)
		.ringPropagationSpeed(1.5)
		.ringRepeatPeriod(1400);

	globe.globeMaterial().color.set('#0d1b2e');
	globe.pointOfView({ lat: 2, lng: 24, altitude: 2.1 });
	const controls = globe.controls();
	controls.autoRotate = true;
	controls.autoRotateSpeed = 0.35;
	el.addEventListener('pointerdown', () => (controls.autoRotate = false), { once: true });

	const resize = () => globe.width(el.clientWidth).height(el.clientHeight);
	new ResizeObserver(resize).observe(el);
	resize();
	document.getElementById('globe-loading')?.remove();

	const redraw = () => globe.polygonsData(globe.polygonsData());

	function flyTo(lat: number, lng: number, altitude = 1.5) {
		controls.autoRotate = false;
		globe.pointOfView({ lat, lng, altitude }, 1000);
	}

	function selectCountry(code: string) {
		selected = code;
		redraw();
		panel.innerHTML = countryHtml(code);
		const tracked = byCode.get(code);
		if (tracked) flyTo(tracked.lat, tracked.lng);
		else {
			const f = featureByCode.get(code);
			if (f) {
				const [lng, lat] = geoCentroid(f);
				flyTo(lat, lng);
			}
		}
	}

	function showRegion(r: RegionRecord) {
		selected = r.country;
		redraw();
		panel.innerHTML = regionHtml(r);
		flyTo(r.lat, r.lng, 1.1);
	}

	function showPastOutbreak(h: Past) {
		selected = null;
		redraw();
		panel.innerHTML = pastHtml(h);
		flyTo(h.lat, h.lng, 1.4);
	}

	panel.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest('button');
		if (!b) return;
		if (b.dataset.region) {
			const r = regions[Number(b.dataset.region)];
			if (r) showRegion(r);
		} else if (b.dataset.back) selectCountry(b.dataset.back);
	});

	const btnCur = document.getElementById('layer-current')!;
	const btnPast = document.getElementById('layer-history')!;
	const setLayer = (past: boolean) => {
		showPast = past;
		btnCur.setAttribute('aria-pressed', String(!past));
		btnPast.setAttribute('aria-pressed', String(past));
		globe.pointsData(past ? pastMarkers : currentMarkers);
		globe.ringsData(past ? [] : pulsing);
		if (past) flyTo(5, 5, 2.4);
	};
	btnCur.addEventListener('click', () => showPast && setLayer(false));
	btnPast.addEventListener('click', () => !showPast && setLayer(true));

	focusCountry = selectCountry;
	if (pendingFocus) selectCountry(pendingFocus);
}

function focusOnGlobe(code: string) {
	if (focusCountry) focusCountry(code);
	else pendingFocus = code;
}

/* ---------------- Location ---------------- */

const STORAGE_KEY = 'ebola-tracker:country';

function safeGet(key: string) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function safeSet(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* storage unavailable */
	}
}

type How = keyof typeof d.where.how;

async function detectCountry(): Promise<{ code: string | null; how: How }> {
	const saved = safeGet(STORAGE_KEY);
	if (saved) return { code: saved, how: 'saved' };
	try {
		const res = await fetch('/api/geo', { signal: AbortSignal.timeout(3000) });
		if (res.ok) {
			const geo = await res.json();
			if (typeof geo.country === 'string' && /^[A-Z]{2}$/.test(geo.country)) return { code: geo.country, how: 'network' };
		}
	} catch {
		/* fall through to the browser locale */
	}
	for (const l of navigator.languages ?? [navigator.language]) {
		const region = l.split('-')[1];
		if (region && /^[A-Z]{2}$/.test(region)) return { code: region, how: 'browser' };
	}
	return { code: null, how: 'none' };
}

let currentCountry: string | null = null;

function renderLocal(code: string | null, how: How) {
	const body = document.getElementById('local-body')!;
	const select = document.getElementById('country-select') as HTMLSelectElement;
	document.getElementById('local-detect')!.textContent = `${d.where.how[how]} ${d.where.changeHint}`;
	currentCountry = code && [...select.options].some((o) => o.value === code) ? code : null;
	const intro = document.getElementById('alerts-intro')!;
	if (!currentCountry) {
		body.innerHTML = `<p class="muted">${d.where.prompt}</p>`;
		intro.textContent = d.alerts.introNoCountry;
		return;
	}
	select.value = currentCountry;
	body.innerHTML = `${countryHtml(currentCountry, { compact: true })}<p><button class="link" data-show-globe="${currentCountry}">${d.where.showOnGlobe}</button></p>`;
	intro.textContent = d.alerts.intro(countryName(currentCountry, lang));
}

/* ---------------- Alerts sign-up ---------------- */

function initAlertsForm() {
	const form = document.getElementById('alerts') as HTMLFormElement;
	const msg = document.getElementById('alerts-msg')!;
	const button = form.querySelector('button')!;
	const show = (text: string, kind: 'ok' | 'error') => {
		msg.textContent = text;
		msg.dataset.kind = kind;
	};
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
		const website = (form.elements.namedItem('website') as HTMLInputElement).value;
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show(d.alerts.invalidEmail, 'error');
		if (!currentCountry) return show(d.alerts.needCountry, 'error');
		button.disabled = true;
		button.textContent = d.alerts.sending;
		try {
			const res = await fetch('/api/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, country: currentCountry, lang, website }),
			});
			if (res.ok) {
				show(d.alerts.ok, 'ok');
				form.reset();
			} else show(res.status === 400 ? d.alerts.invalidEmail : d.alerts.error, 'error');
		} catch {
			show(d.alerts.error, 'error');
		} finally {
			button.disabled = false;
			button.textContent = d.alerts.submit;
		}
	});
}

export async function initApp() {
	const panel = document.getElementById('panel')!;
	const select = document.getElementById('country-select') as HTMLSelectElement;
	const local = document.getElementById('local')!;

	select.addEventListener('change', () => {
		if (!select.value) return;
		safeSet(STORAGE_KEY, select.value);
		renderLocal(select.value, 'chosen');
		focusOnGlobe(select.value);
	});
	local.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-show-globe]');
		if (!b) return;
		focusOnGlobe(b.dataset.showGlobe!);
		document.getElementById('globe')?.scrollIntoView();
	});
	document.querySelectorAll<HTMLElement>('[data-country]').forEach((card) =>
		card.addEventListener('click', () => {
			focusOnGlobe(card.dataset.country!);
			document.getElementById('globe')?.scrollIntoView();
		}),
	);
	initAlertsForm();
	detectCountry().then(({ code, how }) => renderLocal(code, how));

	try {
		await initGlobe(panel);
	} catch (err) {
		console.error(err);
		const loading = document.getElementById('globe-loading');
		if (loading) loading.textContent = d.globe.failed;
	}
}
