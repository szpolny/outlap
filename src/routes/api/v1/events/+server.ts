import { apiResponse, queryEvents } from '#lib/server/api.ts';
import { getSchedule } from '#lib/server/schedule.ts';
import type { RequestHandler } from './$types';

// GET /api/v1/events?series=f1,motogp&from=2026-03-01&to=2026-03-31&sessions=main&limit=100[&cursor=…]
export const GET: RequestHandler = ({ url }) =>
	apiResponse(async () => {
		const { events, generatedAt } = await getSchedule();
		return { generatedAt, ...queryEvents(events, url.searchParams, url.origin) };
	});
