import { apiResponse, scheduleStatus } from '#lib/server/api.ts';
import { getSchedule } from '#lib/server/schedule.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => apiResponse(async () => scheduleStatus(await getSchedule()));
