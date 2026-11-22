import { json } from '@sveltejs/kit';
import { getSchedule } from '#lib/server/schedule.ts';
import type { RequestHandler } from './$types';

// Deprecated: the internal schedule shape, kept for existing callers. Use /api/v1/events.
export const GET: RequestHandler = async () => {
	return json(await getSchedule(), {
		headers: {
			'cache-control': 'public, max-age=300',
			deprecation: 'true',
			link: '</api>; rel="deprecation", </api/v1/events>; rel="successor-version"'
		}
	});
};
