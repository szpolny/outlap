// Client-side date helpers. Everything takes an explicit time zone so the server
// can render in UTC and the browser can re-render in the viewer's zone.

import type { MotorEvent, Session, SessionKind } from '#lib/series.ts';

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

const DAY_MS = 86_400_000;

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(iso: string, timeZone: string): string {
	// en-CA formats as YYYY-MM-DD
	return new Date(iso).toLocaleDateString('en-CA', { timeZone });
}

export function addDays(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week containing `date`. */
export function weekStart(date: string): string {
	const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
	return addDays(date, -((dow + 6) % 7));
}

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

export function eventEndMs(e: MotorEvent): number {
	return e.allDay ? Date.parse(`${e.end}T00:00:00Z`) + DAY_MS : Date.parse(e.end);
}

/** Format a plain YYYY-MM-DD date (no time zone shifting). */
export function fmtDate(date: string, opts: Intl.DateTimeFormatOptions): string {
	return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}

export function fmtTime(iso: string, timeZone: string): string {
	return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
}

export function fmtDay(iso: string, timeZone: string): string {
	return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', timeZone });
}

/** "9 – 11 Oct", "30 Oct – 1 Nov" */
export function fmtRange(from: string, to: string): string {
	if (from === to) return fmtDate(from, { day: 'numeric', month: 'short' });
	const sameMonth = from.slice(0, 7) === to.slice(0, 7);
	const a = fmtDate(from, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
	return `${a} – ${fmtDate(to, { day: 'numeric', month: 'short' })}`;
}

export function eventRange(e: MotorEvent, timeZone: string): string {
	return e.allDay ? fmtRange(e.start, e.end) : fmtRange(localDate(e.start, timeZone), localDate(e.end, timeZone));
}

export function countdown(iso: string, now: number): string {
	const mins = Math.max(1, Math.round((Date.parse(iso) - now) / 60_000));
	const d = Math.floor(mins / 1440);
	const h = Math.floor((mins % 1440) / 60);
	const m = mins % 60;
	if (d >= 2) return `${d} days`;
	if (d === 1) return `1d ${h}h`;
	return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export type SessionState = 'done' | 'live' | 'upcoming';

export function sessionState(s: Session, now: number): SessionState {
	if (now >= Date.parse(s.end)) return 'done';
	return now >= Date.parse(s.start) ? 'live' : 'upcoming';
}
