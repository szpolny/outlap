import { apiResponse, findEvent } from '#lib/server/api.ts';
import { getSchedule } from '#lib/server/schedule.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) =>
	apiResponse(async () => {
		const { events, generatedAt } = await getSchedule();
		return { generatedAt, event: findEvent(events, params.id, url.origin) };
	});
