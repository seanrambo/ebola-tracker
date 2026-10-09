import data from '../data/ebola.json';
import { fmt, fmtDate, cfr, STATUS_LABEL, type Status } from '../lib/format';

type Country = (typeof data.countries)[number];
type Region = (typeof data.regions)[number];
type Past = (typeof data.history)[number];

const STATUS_FILL: Record<Status, string> = {
	active: 'rgba(229, 72, 77, 0.8)',
	imported: 'rgba(247, 107, 21, 0.8)',
	monitoring: 'rgba(255, 178, 36, 0.35)',
	ended: 'rgba(62, 155, 143, 0.65)',
	none: 'rgba(120, 132, 155, 0.22)',
};

const byCode = new Map(data.countries.map((c) => [c.code, c]));
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function countryName(code: string) {
	return byCode.get(code)?.name ?? displayNames.of(code) ?? code;
}

/** Affected countries (active or imported) that share a border with `code`. */
function affectedNeighbours(code: string): Country[] {
	return data.countries.filter(
		(c) =>
			(c.status === 'active' || c.status === 'imported') &&
			(data.neighbours as Record<string, string[]>)[c.code]?.includes(code),
	);
}

function statusOf(code: string): Status {
	const c = byCode.get(code);
	if (c) return c.status as Status;
	return affectedNeighbours(code).length ? 'monitoring' : 'none';
}

function statGrid(c: Country) {
	const cells: [string, number | null][] = [
		['Confirmed', c.confirmed],
		['Probable', c.probable],
		['Suspected', c.suspected],
		['Deaths', c.deaths],
		['Recovered', c.recovered],
	];
	return `<dl class="stats">${cells
		.map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${fmt(v)}</dd></div>`)
		.join('')}<div><dt>Case fatality</dt><dd class="num">${cfr(c.deaths, c.confirmed)}</dd></div></dl>`;
}

function advice(code: string): string {
	const name = esc(countryName(code));
	const status = statusOf(code);
	const near = affectedNeighbours(code).map((c) => esc(c.name));
	switch (status) {
		case 'active':
			return `There is an <strong>active Ebola outbreak</strong> in ${name}. Avoid touching sick people and the bodies of people who died. If you get a fever, <strong>call a health facility before you go</strong>.`;
		case 'imported':
			return `${name} has reported an <strong>imported case</strong>. Health workers are tracing contacts. The risk to the public is low, but know the symptoms.`;
		case 'ended':
			return `${name}'s outbreak has <strong>ended</strong>. Stay alert to symptoms if you travel to affected areas.${near.length ? ` It borders ${near.join(' and ')}, which still has cases.` : ''}`;
		case 'monitoring':
			return `No cases have been reported in ${name}, but it <strong>borders ${near.join(' and ')}</strong>, which has cases. Know the symptoms, and tell a health worker if you get a fever after travelling there.`;
		default:
			return `No Ebola cases have been reported in ${name} during the 2026 epidemic. The risk here is very low.`;
	}
}

function pastIn(code: string) {
	return data.history.filter((h) => h.country === code).sort((a, b) => b.year - a.year);
}

function countryHtml(code: string, opts: { compact?: boolean } = {}) {
	const c = byCode.get(code);
	const status = statusOf(code);
	const name = esc(countryName(code));
	let html = `<div class="ph"><h3>${name}</h3><span class="badge" data-status="${status}">${STATUS_LABEL[status]}</span></div>`;
	html += `<p>${advice(code)}</p>`;
	if (c) {
		html += `<p class="muted small">${esc(c.virus)} · first case ${fmtDate(c.declared)}${'ended' in c && c.ended ? ` · ended ${fmtDate(c.ended as string)}` : ''}</p>`;
		html += statGrid(c);
		if (c.note) html += `<p class="small">${esc(c.note)}</p>`;
		const regions = data.regions.filter((r) => r.country === code).sort((a, b) => b.confirmed - a.confirmed);
		if (regions.length && !opts.compact) {
			html += `<h4>By province</h4><ul class="plist">${regions
				.map(
					(r) =>
						`<li><button data-region="${esc(r.name)}"><span>${esc(r.name)}</span><span class="num">${fmt(r.confirmed)} cases · ${fmt(r.deaths)} deaths</span></button></li>`,
				)
				.join('')}</ul>`;
		}
		html += `<p class="muted small">Source: <a href="${c.sourceUrl}">${esc(c.source)}</a>, as of ${fmtDate(c.asOf)}.</p>`;
	}
	const past = pastIn(code);
	if (past.length) {
		html += `<h4>Past outbreaks here</h4><ul class="past">${past
			.map((h) => `<li><span class="num">${h.year}</span> ${esc(h.place)}: ${fmt(h.cases)} cases, ${fmt(h.deaths)} deaths <span class="muted">(${esc(h.virus)})</span></li>`)
			.join('')}</ul>`;
	}
	return html;
}

function regionHtml(r: Region) {
	return `<p class="muted small"><button class="link" data-back="${r.country}">← ${esc(countryName(r.country))}</button></p>
	<div class="ph"><h3>${esc(r.name)}</h3><span class="badge" data-status="active">Active outbreak</span></div>
	<p class="muted small">Province, ${esc(countryName(r.country))}</p>
	<dl class="stats">
		<div><dt>Confirmed</dt><dd class="num">${fmt(r.confirmed)}</dd></div>
		<div><dt>Deaths</dt><dd class="num">${fmt(r.deaths)}</dd></div>
		<div><dt>Case fatality</dt><dd class="num">${cfr(r.deaths, r.confirmed)}</dd></div>
		<div><dt>Share of country</dt><dd class="num">${((r.confirmed / (byCode.get(r.country)?.confirmed || 1)) * 100).toFixed(1)}%</dd></div>
	</dl>
	<p class="muted small">Source: DRC National Institute of Public Health, as of ${fmtDate(byCode.get(r.country)?.asOf ?? data.updated)}.</p>`;
}

function pastHtml(h: Past) {
	return `<div class="ph"><h3>${esc(h.place)}</h3><span class="badge">${h.year}</span></div>
	<p class="muted small">${esc(countryName(h.country))} · ${esc(h.virus)}</p>
	<dl class="stats">
		<div><dt>Cases</dt><dd class="num">${fmt(h.cases)}</dd></div>
		<div><dt>Deaths</dt><dd class="num">${fmt(h.deaths)}</dd></div>
		<div><dt>Case fatality</dt><dd class="num">${cfr(h.deaths, h.cases)}</dd></div>
	</dl>
	<p class="muted small"><button class="link" data-back="${h.country}">See ${esc(countryName(h.country))} today →</button></p>`;
}

/* ---------------- Globe ---------------- */

type Marker =
	| { kind: 'region'; lat: number; lng: number; size: number; color: string; r: Region }
	| { kind: 'country'; lat: number; lng: number; size: number; color: string; c: Country }
	| { kind: 'past'; lat: number; lng: number; size: number; color: string; h: Past };

const markerAlt = (n: number) => 0.01 + Math.log10(n + 1) * 0.045;

const currentMarkers: Marker[] = [
	...data.regions.map((r) => ({ kind: 'region' as const, lat: r.lat, lng: r.lng, size: r.confirmed, color: '#ff6b70', r })),
	...data.countries
		.filter((c) => !data.regions.some((r) => r.country === c.code))
		.map((c) => ({
			kind: 'country' as const,
			lat: c.lat,
			lng: c.lng,
			size: c.confirmed,
			color: c.status === 'imported' ? '#ff8b3d' : '#4fc3b3',
			c,
		})),
];
const pastMarkers: Marker[] = data.history.map((h) => ({
	kind: 'past' as const,
	lat: h.lat,
	lng: h.lng,
	size: h.cases,
	color: '#ffd166',
	h,
}));

interface GlobeApi {
	focusCountry(code: string): void;
}

let globeApi: GlobeApi | null = null;
const pendingFocus: string[] = [];

async function initGlobe(panel: HTMLElement) {
	const el = document.getElementById('globe-canvas')!;
	const [{ default: Globe }, topojson, topo, iso, { geoCentroid }] = await Promise.all([
		import('globe.gl'),
		import('topojson-client'),
		import('world-atlas/countries-110m.json'),
		import('i18n-iso-countries'),
		import('d3-geo'),
	]);
	const numericToAlpha2 = (iso.default ?? iso).numericToAlpha2;

	const world = topojson.feature(topo as any, (topo as any).objects.countries) as any;
	const features = world.features
		.map((f: any) => ({ ...f, code: f.id ? numericToAlpha2(f.id) : undefined }))
		.filter((f: any) => f.code && f.code !== 'AQ');
	const featureByCode = new Map<string, any>(features.map((f: any) => [f.code, f]));

	let selected: string | null = null;
	let hovered: any = null;
	let showPast = false;

	const globe = new Globe(el, { animateIn: true })
		.backgroundColor('rgba(0,0,0,0)')
		.showAtmosphere(true)
		.atmosphereColor('#4ea8de')
		.atmosphereAltitude(0.16)
		.polygonsData(features)
		.polygonCapColor((f: any) => {
			const base = STATUS_FILL[statusOf(f.code)];
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
			const s = statusOf(f.code);
			return `<div class="gl-tip"><b>${esc(countryName(f.code))}</b><br>${STATUS_LABEL[s]}${c ? `<br>${fmt(c.confirmed)} confirmed · ${fmt(c.deaths)} deaths` : ''}</div>`;
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
		.pointAltitude((d: any) => markerAlt(d.size))
		.pointRadius((d: any) => (d.kind === 'past' ? 0.35 : 0.45))
		.pointsMerge(false)
		.pointLabel((d: any) => {
			if (d.kind === 'region') return `<div class="gl-tip"><b>${esc(d.r.name)}</b><br>${fmt(d.r.confirmed)} confirmed · ${fmt(d.r.deaths)} deaths</div>`;
			if (d.kind === 'country') return `<div class="gl-tip"><b>${esc(d.c.name)}</b><br>${fmt(d.c.confirmed)} confirmed · ${fmt(d.c.deaths)} deaths</div>`;
			return `<div class="gl-tip"><b>${esc(d.h.place)} (${d.h.year})</b><br>${fmt(d.h.cases)} cases · ${fmt(d.h.deaths)} deaths</div>`;
		})
		.onPointClick((d: any) => {
			if (d.kind === 'region') showRegion(d.r);
			else if (d.kind === 'country') selectCountry(d.c.code);
			else showPastOutbreak(d.h);
		})
		.ringsData(currentMarkers.filter((m) => m.kind === 'region' || (m.kind === 'country' && m.c.status === 'imported')))
		.ringLat('lat')
		.ringLng('lng')
		.ringColor(() => (t: number) => `rgba(255, 90, 95, ${1 - t})`)
		.ringMaxRadius((d: any) => 1.5 + Math.log10(d.size + 1) * 1.2)
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

	function redraw() {
		globe.polygonsData(globe.polygonsData());
	}

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

	function showRegion(r: Region) {
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
		const t = (e.target as HTMLElement).closest('button');
		if (!t) return;
		if (t.dataset.region) {
			const r = data.regions.find((x) => x.name === t.dataset.region);
			if (r) showRegion(r);
		} else if (t.dataset.back) selectCountry(t.dataset.back);
	});

	const btnCur = document.getElementById('layer-current')!;
	const btnPast = document.getElementById('layer-history')!;
	const setLayer = (past: boolean) => {
		showPast = past;
		btnCur.setAttribute('aria-pressed', String(!past));
		btnPast.setAttribute('aria-pressed', String(past));
		globe.pointsData(past ? pastMarkers : currentMarkers);
		globe.ringsData(past ? [] : currentMarkers.filter((m) => m.kind === 'region' || (m.kind === 'country' && m.c.status === 'imported')));
		if (past) flyTo(5, 5, 2.4);
	};
	btnCur.addEventListener('click', () => showPast && setLayer(false));
	btnPast.addEventListener('click', () => !showPast && setLayer(true));

	globeApi = { focusCountry: selectCountry };
	pendingFocus.splice(0).forEach(selectCountry);
}

function focusOnGlobe(code: string) {
	if (globeApi) globeApi.focusCountry(code);
	else pendingFocus.splice(0, pendingFocus.length, code);
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

async function detectCountry(): Promise<{ code: string | null; how: string }> {
	const saved = safeGet(STORAGE_KEY);
	if (saved) return { code: saved, how: 'You chose this country earlier.' };
	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 3000);
		const res = await fetch('/api/geo', { signal: ctrl.signal });
		clearTimeout(timer);
		if (res.ok) {
			const geo = await res.json();
			if (geo.country) return { code: geo.country, how: 'Detected from your network location.' };
		}
	} catch {
		/* fall through to the browser locale */
	}
	for (const lang of navigator.languages ?? [navigator.language]) {
		const region = lang.split('-')[1];
		if (region && /^[A-Z]{2}$/.test(region)) return { code: region, how: 'Guessed from your browser language.' };
	}
	return { code: null, how: 'We could not detect your country.' };
}

function renderLocal(code: string | null, how: string) {
	const body = document.getElementById('local-body')!;
	const detect = document.getElementById('local-detect')!;
	const select = document.getElementById('country-select') as HTMLSelectElement;
	detect.textContent = `${how} Change it if this is wrong.`;
	if (!code) {
		body.innerHTML = '<p class="muted">Choose your country to see the situation there.</p>';
		return;
	}
	select.value = code;
	body.innerHTML = `${countryHtml(code, { compact: true })}<p><button class="link" data-show-globe="${code}">Show on the globe →</button></p>`;
}

export async function initApp() {
	const panel = document.getElementById('panel')!;
	const select = document.getElementById('country-select') as HTMLSelectElement;
	const local = document.getElementById('local')!;

	select.addEventListener('change', () => {
		if (!select.value) return;
		safeSet(STORAGE_KEY, select.value);
		renderLocal(select.value, 'You chose this country.');
		focusOnGlobe(select.value);
	});
	local.addEventListener('click', (e) => {
		const t = (e.target as HTMLElement).closest<HTMLElement>('[data-show-globe]');
		if (!t) return;
		focusOnGlobe(t.dataset.showGlobe!);
		document.getElementById('globe')?.scrollIntoView();
	});
	document.querySelectorAll<HTMLElement>('[data-country]').forEach((card) =>
		card.addEventListener('click', () => {
			focusOnGlobe(card.dataset.country!);
			document.getElementById('globe')?.scrollIntoView();
		}),
	);

	detectCountry().then(({ code, how }) => renderLocal(code, how));

	try {
		await initGlobe(panel);
	} catch (err) {
		console.error(err);
		const loading = document.getElementById('globe-loading');
		if (loading) loading.textContent = 'The globe could not load on this device. The figures below still work.';
	}
}
