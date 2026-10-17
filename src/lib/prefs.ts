import { isTimeZone } from '@szpolny/calendar-kit/dates';
import { isCountry } from './countries.ts';
import { isSessionFilter, type SessionFilter } from './format.ts';
import { DEFAULT_SERIES_IDS, NEW_SERIES, SERIES, type SeriesId } from './series.ts';

export const PREFS_STORAGE_KEY = 'outlap:prefs';
/** Mirrors the saved preferences so the server can render them and the page doesn't flash defaults. */
export const PREFS_COOKIE = 'outlap_prefs';
/** Browsers cap cookie lifetimes at 400 days. */
export const PREFS_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export interface Prefs {
	selected: SeriesId[];
	filter: SessionFilter;
	alarm: number;
	/** 'auto' follows the device; otherwise an IANA zone picked by the viewer */
	timeZone: string;
	/** 'auto' follows the request's country; otherwise an ISO code picked by the viewer */
	country: string;
	/** id of the last NEW_SERIES batch this visitor has seen or dismissed */
	news: string;
	/** the device's zone at the last visit, so the server can render local times */
	zone?: string;
}

/** Defaults for visitors without saved preferences; they start with every new series, so the notice is already seen. */
export const DEFAULT_PREFS: Prefs = {
	selected: [...DEFAULT_SERIES_IDS],
	filter: 'all',
	alarm: 0,
	timeZone: 'auto',
	country: 'auto',
	news: NEW_SERIES.id
};

/** Validates saved preferences field by field, falling back to defaults; null when nothing was saved. */
export function parsePrefs(raw: Record<string, unknown> | null): Prefs | null {
	if (!raw) return null;
	const zone = typeof raw.timeZone === 'string' && (raw.timeZone === 'auto' || isTimeZone(raw.timeZone)) ? raw.timeZone : 'auto';
	return {
		selected: Array.isArray(raw.selected) ? raw.selected.filter((s): s is SeriesId => typeof s === 'string' && s in SERIES) : [...DEFAULT_SERIES_IDS],
		filter: isSessionFilter(raw.filter) ? raw.filter : 'all',
		alarm: Number(raw.alarm) || 0,
		timeZone: zone,
		country: isCountry(raw.country) ? raw.country : 'auto',
		news: typeof raw.news === 'string' ? raw.news : '',
		zone: typeof raw.zone === 'string' && isTimeZone(raw.zone) ? raw.zone : undefined
	};
}

/** Parses the JSON a cookie or storage entry holds; null when it is missing or malformed. */
export function parsePrefsJson(json: string | null | undefined): Prefs | null {
	try {
		const raw: unknown = JSON.parse(json ?? 'null');
		return parsePrefs(raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null);
	} catch {
		return null;
	}
}

export function writePrefsCookie(prefs: Prefs): void {
	const secure = location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; Path=/; Max-Age=${PREFS_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
