export type Status = 'active' | 'imported' | 'monitoring' | 'ended' | 'none';

export const STATUS_LABEL: Record<string, string> = {
	active: 'Active outbreak',
	imported: 'Imported case',
	monitoring: 'Borders an affected country',
	ended: 'Outbreak ended',
	none: 'No cases reported',
};

export const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US'));

export const cfr = (deaths: number, cases: number) => (cases ? `${((deaths / cases) * 100).toFixed(1)}%` : '—');

export const fmtDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC',
	});
