import { json } from '@sveltejs/kit';
import { DEFAULT_LIMIT, MAX_LIMIT } from '#lib/api.ts';
import { eventEndMs, FILTER_KINDS, isSessionFilter } from '#lib/format.ts';
import { SERIES, SERIES_IDS, isSeriesId, type MotorEvent, type Schedule, type SeriesId, type SessionKind } from '#lib/series.ts';

// The public API's response shapes. They are mapped from the internal schedule rather than
// exposed directly, so internal fields (track outlines, photos) can change without breaking
// API clients. Changing these is a breaking change and needs a new version.

export interface ApiSession {
	name: string;
	kind: SessionKind;
	start: string;
	end: string;
	estimatedEnd: boolean;
}

export interface ApiEvent {
	id: string;
	series: SeriesId;
	name: string;
	round?: number;
	location?: string;
	start: string;
	end: string;
	allDay: boolean;
	url?: string;
	/** iCalendar feed of this event alone */
	calendarUrl: string;
	sessions: ApiSession[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const HEADERS = {
	'access-control-allow-origin': '*',
	'cache-control': 'public, max-age=300'
};

export class ApiError extends Error {
	constructor(readonly status: number, message: string) {
		super(message);
	}
}

export function apiJson(body: unknown): Response {
	return json(body, { headers: HEADERS });
}

/** Runs a handler, turning ApiErrors into JSON error responses that keep the CORS header. */
export async function apiResponse(handler: () => unknown | Promise<unknown>): Promise<Response> {
	try {
		return apiJson(await handler());
	} catch (e) {
		if (!(e instanceof ApiError)) throw e;
		return json(
			{ error: { status: e.status, message: e.message } },
			{ status: e.status, headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' } }
		);
	}
}

export function toApiEvent(e: MotorEvent, origin: string): ApiEvent {
	return {
		id: e.id,
		series: e.series,
		name: e.name,
		...(e.round !== undefined && { round: e.round }),
		...(e.location && { location: e.location }),
		start: e.start,
		end: e.end,
		allDay: e.allDay,
		...(e.url && { url: e.url }),
		calendarUrl: `${origin}/calendar.ics?event=${encodeURIComponent(e.id)}`,
		sessions: e.sessions.map(({ name, kind, start, end, estimatedEnd }) => ({ name, kind, start, end, estimatedEnd }))
	};
}

/** A `from`/`to` bound in ms. A bare date is a whole UTC day, so `to` covers it inclusively. */
function parseBound(name: string, value: string | null, isEnd: boolean): number | undefined {
	if (value === null) return undefined;
	const ms = DATE.test(value) ? Date.parse(`${value}T00:00:00Z`) + (isEnd ? DAY_MS : 0) : DATETIME.test(value) ? Date.parse(value) : NaN;
	if (Number.isNaN(ms)) throw new ApiError(400, `${name} must be a date (YYYY-MM-DD) or an ISO 8601 date-time with an offset`);
	return ms;
}

const startMs = (e: MotorEvent) => Date.parse(e.allDay ? `${e.start}T00:00:00Z` : e.start);

export interface EventPage {
	events: ApiEvent[];
	/** pass as `cursor` for the next page; null on the last page */
	nextCursor: string | null;
}

type SortKey = [start: string, id: string];

// Code-point order, not localeCompare, so the cursor comparison matches the sort exactly.
const compareKeys = ([aStart, aId]: SortKey, [bStart, bId]: SortKey) =>
	aStart < bStart ? -1 : aStart > bStart ? 1 : aId < bId ? -1 : aId > bId ? 1 : 0;

// A cursor is the sort key of the last event returned, so pages stay consistent when the
// hourly snapshot adds or removes events between requests.
function encodeCursor(e: ApiEvent): string {
	return btoa(JSON.stringify([e.start, e.id])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor: string): SortKey {
	try {
		const key: unknown = JSON.parse(atob(cursor.replace(/-/g, '+').replace(/_/g, '/')));
		if (Array.isArray(key) && key.length === 2 && key.every((part) => typeof part === 'string')) return key as SortKey;
	} catch {
		// fall through
	}
	throw new ApiError(400, 'cursor is invalid; pass nextCursor from a previous response unchanged');
}

function parseLimit(value: string | null): number {
	if (value === null) return DEFAULT_LIMIT;
	const limit = Number(value);
	if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new ApiError(400, `limit must be an integer from 1 to ${MAX_LIMIT}`);
	return limit;
}

/** GET /api/v1/events: one page of events filtered by series, time window and session kind, ordered by start. */
export function queryEvents(events: MotorEvent[], params: URLSearchParams, origin: string): EventPage {
	const limit = parseLimit(params.get('limit'));
	const cursorParam = params.get('cursor');
	const after = cursorParam === null ? undefined : decodeCursor(cursorParam);

	const seriesParam = params.get('series');
	const series = seriesParam === null ? undefined : seriesParam.split(',').filter(Boolean);
	const unknown = series?.find((id) => !isSeriesId(id));
	if (series?.length === 0) throw new ApiError(400, 'series must list at least one series id');
	if (unknown !== undefined) throw new ApiError(400, `Unknown series: ${unknown}`);

	const sessions = params.get('sessions') ?? 'all';
	if (!isSessionFilter(sessions)) throw new ApiError(400, 'sessions must be all, main or races');
	const kinds: SessionKind[] = FILTER_KINDS[sessions];

	const from = parseBound('from', params.get('from'), false);
	const to = parseBound('to', params.get('to'), true);
	if (from !== undefined && to !== undefined && from >= to) throw new ApiError(400, 'from must be before to');

	const matching = events
		.filter(
			(e) =>
				(!after || compareKeys([e.start, e.id], after) > 0) &&
				(!series || series.includes(e.series)) &&
				(from === undefined || eventEndMs(e) > from) &&
				(to === undefined || startMs(e) < to)
		)
		.map((e) => toApiEvent(e, origin))
		.map((e) => (sessions === 'all' ? e : { ...e, sessions: e.sessions.filter((s) => kinds.includes(s.kind)) }))
		// Timed events are their sessions, so drop those with none left; all-day events have none.
		.filter((e) => e.allDay || e.sessions.length > 0)
		.sort((a, b) => compareKeys([a.start, a.id], [b.start, b.id]));

	const page = matching.slice(0, limit);
	return { events: page, nextCursor: matching.length > limit ? encodeCursor(page.at(-1)!) : null };
}

export function findEvent(events: MotorEvent[], id: string, origin: string): ApiEvent {
	const event = events.find((e) => e.id === id);
	if (!event) throw new ApiError(404, 'Event not found');
	return toApiEvent(event, origin);
}

export function listSeries() {
	return SERIES_IDS.map((id) => ({ id, ...SERIES[id] }));
}

/** Source freshness, without upstream error messages, which can name internal URLs. */
export function scheduleStatus({ generatedAt, sources }: Schedule) {
	return {
		generatedAt,
		sources: sources.map(({ source, series, ok, fetchedAt }) => ({ source, series, ok, ...(fetchedAt && { fetchedAt }) }))
	};
}
