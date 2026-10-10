import { dev } from '$app/env';
import type { Schedule } from '#lib/series.ts';

/**
 * In production the schedule is scraped hourly by a GitHub Action
 * (.github/workflows/snapshot.yml) and published as JSON; the server only
 * reads that snapshot. Scraping per request doesn't fit the Workers free
 * plan's CPU and subrequest limits.
 */
const SNAPSHOT_URL = 'https://raw.githubusercontent.com/szpolny/outlap/data/schedule.json';

/** How long a fetched snapshot is reused before checking for a newer one. */
const TTL_MS = 5 * 60 * 1000;
/** In dev the sources are scraped directly, so refetch less often. */
const DEV_TTL_MS = 60 * 60 * 1000;

let cached: Schedule | undefined;
let attemptedAt = 0;
let inflight: Promise<void> | undefined;

async function load(): Promise<Schedule> {
	if (dev) {
		const { scrapeSchedule } = await import('./scrape');
		return scrapeSchedule(cached);
	}
	const res = await fetch(SNAPSHOT_URL, { signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${SNAPSHOT_URL}`);
	return res.json();
}

function refresh(): Promise<void> {
	inflight ??= load()
		.then((schedule) => {
			cached = schedule;
		})
		.catch((e: unknown) => {
			// Keep serving the last good snapshot.
			console.error('[schedule] snapshot failed:', e instanceof Error ? e.message : e);
		})
		.finally(() => {
			attemptedAt = Date.now();
			inflight = undefined;
		});
	return inflight;
}

export async function getSchedule(): Promise<Schedule> {
	const stale = Date.now() - attemptedAt > (dev ? DEV_TTL_MS : TTL_MS);
	// Scraping takes seconds, so in dev revalidate in the background once there is data.
	// Workers may cancel work left running after the response, so production waits.
	if (!cached || (stale && !dev)) await refresh();
	else if (stale) void refresh();
	if (!cached) throw new Error('Schedule unavailable');
	return cached;
}
