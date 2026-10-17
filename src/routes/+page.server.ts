import { getSchedule } from '#lib/server/schedule.ts';
import { PREFS_COOKIE, PREFS_COOKIE_MAX_AGE, parsePrefsJson } from '#lib/prefs.ts';
import type { PageServerLoad } from './$types';

// Cloudflare geolocates each request; the page is not cached, so this is per viewer.
export const load: PageServerLoad = async ({ request, cookies }) => {
	const raw = cookies.get(PREFS_COOKIE);
	const prefs = parsePrefsJson(raw);
	// Re-issue from the server: Safari caps cookies set by scripts at seven days.
	if (prefs && raw) cookies.set(PREFS_COOKIE, raw, { path: '/', maxAge: PREFS_COOKIE_MAX_AGE, sameSite: 'lax', httpOnly: false });
	return {
		...(await getSchedule()),
		country: request.headers.get('cf-ipcountry') ?? '',
		prefs
	};
};
