// Returns the visitor's country from Netlify's edge geolocation. Nothing is logged or stored.
export default (_req: Request, context: { geo?: { country?: { code?: string; name?: string } } }) =>
	Response.json(
		{ country: context.geo?.country?.code ?? null },
		{ headers: { 'Cache-Control': 'private, no-store' } },
	);

export const config = { path: '/api/geo' };
