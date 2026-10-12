import { getSchedule } from '#lib/server/schedule.ts';
import type { PageServerLoad } from './$types';

// Cloudflare geolocates each request; the page is not cached, so this is per viewer.
export const load: PageServerLoad = async ({ request }) => ({
	...(await getSchedule()),
	country: request.headers.get('cf-ipcountry') ?? ''
});
