import type { Localized } from '../i18n';
import neighbours from '../data/neighbours.json';

export type Status = 'active' | 'imported' | 'monitoring' | 'ended' | 'none';

export interface CountryRecord {
	code: string;
	status: 'active' | 'imported' | 'ended';
	virus: string;
	declared: string;
	ended: string | null;
	confirmed: number;
	probable: number | null;
	suspected: number | null;
	deaths: number;
	recovered: number | null;
	lat: number;
	lng: number;
	asOf: string;
	source: string;
	sourceUrl: string;
	note: Localized;
}

export interface RegionRecord {
	country: string;
	name: Localized;
	lat: number;
	lng: number;
	confirmed: number;
	deaths: number;
}

const NEIGHBOURS = neighbours as Record<string, string[]>;

export function bordersOf(code: string): string[] {
	return NEIGHBOURS[code] ?? [];
}

/** Countries with an active outbreak or an imported case that share a land border with `code`. */
export function affectedNeighbours(code: string, countries: CountryRecord[]): CountryRecord[] {
	const borders = bordersOf(code);
	return countries.filter((c) => (c.status === 'active' || c.status === 'imported') && borders.includes(c.code));
}

export function statusOf(code: string, countries: CountryRecord[]): Status {
	const c = countries.find((x) => x.code === code);
	if (c) return c.status;
	return affectedNeighbours(code, countries).length ? 'monitoring' : 'none';
}
