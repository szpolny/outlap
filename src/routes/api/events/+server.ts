import { json } from '@sveltejs/kit';
import { getSchedule } from '#lib/server/schedule.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(await getSchedule(), { headers: { 'cache-control': 'public, max-age=300' } });
};
