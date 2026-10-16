import { loadSources } from '@szpolny/calendar-kit/snapshot';
import { SERIES_IDS, type Schedule } from '#lib/series.ts';
import { alms, elms, lemanscup, wec } from './sources/aco';
import { bsb } from './sources/bsb';
import { dtm } from './sources/dtm';
import { annualSources, rallycross, trialgp } from './sources/events';
import { f1 } from './sources/f1';
import { imsa } from './sources/imsa';
import { indycar, indynxt } from './sources/indycar';
import { iomtt } from './sources/iomtt';
import { motogp } from './sources/motogp';
import { mxgp } from './sources/mxgp';
import { nascar } from './sources/nascar';
import { nls } from './sources/nls';
import { withProvisional } from './sources/provisional';
import { dakar, seasonSources } from './sources/seasons';
import { sgp } from './sources/sgp';
import { f1academy, f2, f3, formulae } from './sources/sportstimes';
import { britishgt, gtwca, gtwcasia, gtwcaus, gtwce, igtc } from './sources/sro';
import { supercars } from './sources/supercars';
import { supercross } from './sources/supercross';
import { superformula } from './sources/superformula';
import { supergt } from './sources/supergt';
import type { Source } from './sources/types';
import { worldsbk } from './sources/worldsbk';
import { erc, wrc } from './sources/wrc';
import { attachVenues } from './venues';

const SOURCES: Source[] = [
	f1, f2, f3, f1academy, formulae, motogp, worldsbk, sgp, wec, elms, alms, lemanscup, imsa, dtm, supergt,
	indycar, indynxt, superformula, nascar, wrc, erc, gtwce, gtwca, gtwcasia, gtwcaus, britishgt, igtc, supercars,
	bsb, iomtt, mxgp, supercross, nls, dakar, trialgp, rallycross, ...seasonSources, ...annualSources
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
	const sourcesToLoad = SOURCES.filter((source) => source.series.some((series) => selected.has(series)))
		.map((source) => withProvisional(source, selected));
	const results = await loadSources(sourcesToLoad, {
		load: (source) => source.load(seasons()),
		fallback: (source) => previous?.events.filter((ev) => source.series.includes(ev.series)) ?? [],
		previous: previous?.sources
	});

	const fetched = results.flatMap((r) => r.items).filter((event) => selected.has(event.series));
	attachVenues(fetched);
	const events = [...(onlyMissing ? previous?.events ?? [] : []), ...fetched]
		.sort((a, b) => a.start.localeCompare(b.start));
	const sources = [
		...(onlyMissing ? previous?.sources ?? [] : []),
		...results.map((r) => ({ ...r.status, series: r.source.series.filter((series) => selected.has(series)) }))
	];
	return { events, sources, generatedAt: new Date().toISOString() };
}
