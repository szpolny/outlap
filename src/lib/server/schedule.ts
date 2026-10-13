import { createSnapshotCache, fetchSnapshot } from '@szpolny/calendar-kit/snapshot';
import { dev } from '$app/env';
import type { Schedule } from '#lib/series.ts';

/**
 * The schedule is scraped hourly by a GitHub Action
 * (.github/workflows/snapshot.yml) and published as JSON; the server only
 * reads that snapshot. Scraping per request doesn't fit the Workers free
 * plan's CPU and subrequest limits.
 */
const SNAPSHOT_URL = 'https://raw.githubusercontent.com/szpolny/outlap/data/schedule.json';

/** How long a fetched snapshot is reused before checking for a newer one. */
const TTL_MS = 5 * 60 * 1000;
/** Dev may scrape newly added series, so refetch less often. */
const DEV_TTL_MS = 60 * 60 * 1000;

export const getSchedule = createSnapshotCache<Schedule>({
	load: async () => {
		const snapshot = await fetchSnapshot<Schedule>(SNAPSHOT_URL);
		if (dev) {
			const { scrapeSchedule } = await import('./scrape');
			return scrapeSchedule(snapshot, { onlyMissing: true });
		}
		return snapshot;
	},
	ttlMs: dev ? DEV_TTL_MS : TTL_MS,
	// Workers may cancel background work after the response; production waits.
	backgroundRefresh: dev,
	onError: (error) => console.error('[schedule] snapshot failed:', error instanceof Error ? error.message : error)
});
