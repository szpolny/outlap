import type { MotorEvent, Schedule, SourceStatus } from '#lib/series.ts';
import { elms, wec } from './sources/aco';
import { f1 } from './sources/f1';
import { indycar, indynxt } from './sources/indycar';
import { motogp } from './sources/motogp';
import { f2, f3 } from './sources/sportstimes';
import type { Source } from './sources/types';
import { wrc } from './sources/wrc';

const SOURCES: Source[] = [f1, f2, f3, motogp, wec, elms, indycar, indynxt, wrc];

/** Schedules change (session moves, cancellations), so refetch hourly. */
const TTL_MS = 60 * 60 * 1000;
/** After a failure, retry sooner than the normal TTL. */
const RETRY_MS = 5 * 60 * 1000;

interface Entry {
	events: MotorEvent[];
	/** time of last successful fetch */
	fetchedAt?: number;
	/** time of last attempt */
	attemptedAt: number;
	error?: string;
	inflight?: Promise<void>;
}

const cache = new Map<Source, Entry>();

function seasons(): number[] {
	const year = new Date().getUTCFullYear();
	return [year, year + 1];
}

function refresh(source: Source): Promise<void> {
	const entry = cache.get(source) ?? { events: [], attemptedAt: 0 };
	cache.set(source, entry);
	entry.inflight ??= source
		.load(seasons())
		.then((events) => {
			entry.events = events;
			entry.fetchedAt = Date.now();
			entry.error = undefined;
		})
		.catch((e: unknown) => {
			// Keep serving the last good data; just record what went wrong.
			entry.error = e instanceof Error ? e.message : String(e);
			console.error(`[schedule] ${source.label} failed:`, entry.error);
		})
		.finally(() => {
			entry.attemptedAt = Date.now();
			entry.inflight = undefined;
		});
	return entry.inflight;
}

function isStale(entry: Entry | undefined): boolean {
	if (!entry) return true;
	const age = Date.now() - entry.attemptedAt;
	return entry.error ? age > RETRY_MS : age > TTL_MS;
}

export async function getSchedule(): Promise<Schedule> {
	const pending: Promise<void>[] = [];
	for (const source of SOURCES) {
		const entry = cache.get(source);
		if (!isStale(entry)) continue;
		const p = refresh(source);
		// Only block on sources we have nothing for yet; otherwise revalidate in the background.
		if (!entry?.fetchedAt) pending.push(p);
	}
	await Promise.all(pending);

	const events: MotorEvent[] = [];
	const sources: SourceStatus[] = [];
	for (const source of SOURCES) {
		const entry = cache.get(source)!;
		events.push(...entry.events);
		sources.push({
			series: source.series,
			source: source.label,
			ok: !entry.error,
			error: entry.error,
			fetchedAt: entry.fetchedAt ? new Date(entry.fetchedAt).toISOString() : undefined
		});
	}
	events.sort((a, b) => a.start.localeCompare(b.start));
	return { events, sources, generatedAt: new Date().toISOString() };
}
