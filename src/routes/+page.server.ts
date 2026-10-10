import { getSchedule } from '#lib/server/schedule.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => getSchedule();
