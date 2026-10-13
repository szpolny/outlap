import { localDate, fmtRange } from '@szpolny/calendar-kit/dates';
export { endMs as eventEndMs, localDate, addDays, weekStart, fmtDate, fmtTime, fmtDay, fmtRange, countdown } from '@szpolny/calendar-kit/dates';
// Client-side date helpers. Everything takes an explicit time zone so the server
// can render in UTC and the browser can re-render in the viewer's zone.

import { SERIES_IDS, type MotorEvent, type Session, type SessionKind } from '#lib/series.ts';

export type SessionFilter = 'all' | 'main' | 'races';

export const FILTER_KINDS: Record<SessionFilter, SessionKind[]> = {
	all: ['practice', 'qualifying', 'sprint', 'race', 'other'],
	main: ['qualifying', 'sprint', 'race'],
	races: ['sprint', 'race']
};

export const FILTER_LABELS: Record<SessionFilter, string> = {
	all: 'All sessions',
	main: 'Quali & races',
	races: 'Races only'
};

/** The main race of the weekend, used to place an event in a week and in order. */
export function mainSession(e: MotorEvent): Session | undefined {
	return e.sessions.findLast((s) => s.kind === 'race') ?? e.sessions.at(-1);
}

/** The local calendar date that represents the event (its race day). */
export function anchorDate(e: MotorEvent, timeZone: string): string {
	if (e.allDay) return e.end;
	const main = mainSession(e);
	return localDate(main?.start ?? e.end, timeZone);
}


export function eventRange(e: MotorEvent, timeZone: string): string {
	return e.allDay ? fmtRange(e.start, e.end) : fmtRange(localDate(e.start, timeZone), localDate(e.end, timeZone));
}

export type SessionState = 'done' | 'live' | 'upcoming';

export function sessionState(s: Session, now: number): SessionState {
	if (now >= Date.parse(s.end)) return 'done';
	return now >= Date.parse(s.start) ? 'live' : 'upcoming';
}

/** Events at the same track in the same week, e.g. MotoGP, Moto2 and Moto3, shown as one card. */
export interface Weekend {
	id: string;
	/** in series order, so the headline series comes first */
	events: MotorEvent[];
}

/** Groups one week's events by track. */
export function groupWeekends(events: MotorEvent[], timeZone: string): Weekend[] {
	const byTrack = new Map<string, MotorEvent[]>();
	for (const e of events) {
		const key = e.track ?? e.id;
		byTrack.set(key, [...(byTrack.get(key) ?? []), e]);
	}
	return [...byTrack.values()]
		.map((list) => {
			list.sort((a, b) => SERIES_IDS.indexOf(a.series) - SERIES_IDS.indexOf(b.series) || a.start.localeCompare(b.start));
			return { id: list[0].id, events: list };
		})
		.sort(
			(a, b) =>
				anchorDate(a.events[0], timeZone).localeCompare(anchorDate(b.events[0], timeZone)) ||
				a.events[0].start.localeCompare(b.events[0].start)
		);
}
