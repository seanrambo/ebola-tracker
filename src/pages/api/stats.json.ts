import data from '../../data/ebola.json';

export function GET() {
	const { neighbours, ...open } = data;
	return new Response(JSON.stringify(open, null, 2), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
}
