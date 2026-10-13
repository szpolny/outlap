import { SERIES_IDS, type MotorEvent, type Schedule, type SourceStatus } from '#lib/series.ts';
import { alms, elms, lemanscup, wec } from './sources/aco';
import { dtm } from './sources/dtm';
import { f1 } from './sources/f1';
import { imsa } from './sources/imsa';
import { indycar, indynxt } from './sources/indycar';
import { motogp } from './sources/motogp';
import { nascar } from './sources/nascar';
import { sgp } from './sources/sgp';
import { f2, f3 } from './sources/sportstimes';
import { superformula } from './sources/superformula';
import { supergt } from './sources/supergt';
import type { Source } from './sources/types';
import { worldsbk } from './sources/worldsbk';
import { wrc } from './sources/wrc';
import { attachVenues } from './venues';

const SOURCES: Source[] = [
	f1, f2, f3, motogp, worldsbk, sgp, wec, elms, alms, lemanscup, imsa, dtm, supergt,
	indycar, indynxt, superformula, nascar, wrc
];

function seasons(): number[] {
	const year = new Date().getUTCFullYear();
	return [year, year + 1];
}

/**
 * Fetch every source once. A source that fails keeps its events from `previous`
 * (the last good snapshot) and is reported as failing. In dev, onlyMissing
 * supplements series absent from the snapshot, preserving all existing data.
 */
export async function scrapeSchedule(previous?: Schedule, { onlyMissing = false } = {}): Promise<Schedule> {
	// Status entries also cover valid empty calendars and failed published sources.
	const present = new Set([
		...(previous?.sources.flatMap((source) => source.series) ?? []),
		...(previous?.events.map((event) => event.series) ?? [])
	]);
	const selected = new Set(SERIES_IDS.filter((series) => !onlyMissing || !present.has(series)));
	if (onlyMissing && selected.size === 0 && previous) return previous;
	const sourcesToLoad = SOURCES.filter((source) => source.series.some((series) => selected.has(series)));
	const results = await Promise.all(
		sourcesToLoad.map(async (source): Promise<{ events: MotorEvent[]; status: SourceStatus }> => {
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

	const fetched = results.flatMap((r) => r.events).filter((event) => selected.has(event.series));
	attachVenues(fetched);
	const events = [...(onlyMissing ? previous?.events ?? [] : []), ...fetched]
		.sort((a, b) => a.start.localeCompare(b.start));
	const sources = [
		...(onlyMissing ? previous?.sources ?? [] : []),
		...results.map((r) => ({ ...r.status, series: r.status.series.filter((series) => selected.has(series)) }))
	];
	return { events, sources, generatedAt: new Date().toISOString() };
}
