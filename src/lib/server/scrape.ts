import type { MotorEvent, Schedule, SourceStatus } from '#lib/series.ts';
import { elms, lemanscup, wec } from './sources/aco';
import { f1 } from './sources/f1';
import { imsa } from './sources/imsa';
import { indycar, indynxt } from './sources/indycar';
import { motogp } from './sources/motogp';
import { nascar } from './sources/nascar';
import { sgp } from './sources/sgp';
import { f2, f3 } from './sources/sportstimes';
import type { Source } from './sources/types';
import { wrc } from './sources/wrc';
import { attachVenues } from './venues';

const SOURCES: Source[] = [f1, f2, f3, motogp, sgp, wec, elms, lemanscup, imsa, indycar, indynxt, nascar, wrc];

function seasons(): number[] {
	const year = new Date().getUTCFullYear();
	return [year, year + 1];
}

/**
 * Fetch every source once. A source that fails keeps its events from `previous`
 * (the last good snapshot) and is reported as failing.
 */
export async function scrapeSchedule(previous?: Schedule): Promise<Schedule> {
	const results = await Promise.all(
		SOURCES.map(async (source): Promise<{ events: MotorEvent[]; status: SourceStatus }> => {
			try {
				const events = await source.load(seasons());
				const status = { series: source.series, source: source.label, ok: true, fetchedAt: new Date().toISOString() };
				return { events, status };
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				console.error(`[schedule] ${source.label} failed:`, error);
				// Keep serving the last good data; just record what went wrong.
				const events = previous?.events.filter((ev) => source.series.includes(ev.series)) ?? [];
				const fetchedAt = previous?.sources.find((s) => s.source === source.label)?.fetchedAt;
				return { events, status: { series: source.series, source: source.label, ok: false, error, fetchedAt } };
			}
		})
	);

	const events = results.flatMap((r) => r.events).sort((a, b) => a.start.localeCompare(b.start));
	try {
		await attachVenues(events);
	} catch (e) {
		console.error('[schedule] venue photos failed:', e instanceof Error ? e.message : e);
		// Photos are optional; reuse the previous snapshot's.
		const previousPhotos = new Map(previous?.events.map((ev) => [ev.id, ev.photo]));
		for (const ev of events) ev.photo ??= previousPhotos.get(ev.id);
	}
	return { events, sources: results.map((r) => r.status), generatedAt: new Date().toISOString() };
}
