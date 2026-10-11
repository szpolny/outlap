import type { MotorEvent, Session } from '#lib/series.ts';
import { fetchText, finalizeEvent, guessKind, mapLimit } from '../util';
import type { Source } from './types';

// The JSON API behind dtm.com. The event list covers every season; each event's details carry
// the full weekend timetable, support races included, with published end times. Events whose
// timetable isn't out yet become all-day events.
const API = 'https://api.dtm.com/data';

interface ApiEvent {
	name: string;
	slug: string;
	startTime: string;
	endTime: string;
	eventNumber: number;
	raceSeries: string[] | null;
}

interface EventDetails extends ApiEvent {
	city: string | null;
	country: { name: string } | null;
	timetable: { start: string; end: string; label: string; raceSeries: string | null }[] | null;
}

/** Calendar date at the venues, which are all in Central European time. */
function localDate(iso: string): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(iso));
}

function toEvent(e: EventDetails): MotorEvent | null {
	const sessions: Session[] = (e.timetable ?? [])
		.filter((t) => t.raceSeries === 'DTM')
		.map((t) => {
			// Labels mix "Free practice 1" and "Free Practice 1".
			const name = t.label.trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());
			const start = new Date(t.start).toISOString();
			return { name, kind: guessKind(name), start, end: new Date(t.end).toISOString(), estimatedEnd: false };
		});
	const event = {
		id: `dtm-${e.slug}`,
		series: 'dtm' as const,
		name: e.name,
		round: e.eventNumber,
		location: [e.city, e.country?.name].filter(Boolean).join(', ') || undefined,
		sessions,
		url: `https://www.dtm.com/en/events/${e.slug}`
	};
	if (sessions.length > 0) return finalizeEvent(event);
	return { ...event, start: localDate(e.startTime), end: localDate(e.endTime), allDay: true };
}

export const dtm: Source = {
	label: 'dtm.com',
	series: ['dtm'],
	async load(years) {
		const list: ApiEvent[] = JSON.parse(await fetchText(`${API}?query=events`)).events;
		const wanted = list.filter(
			(e) => e.raceSeries?.includes('DTM') && years.includes(Number(localDate(e.startTime).slice(0, 4)))
		);
		if (wanted.length === 0) throw new Error('no DTM events in event list');

		const events = await mapLimit(wanted, 4, async (e) => {
			const details: EventDetails | undefined = JSON.parse(
				await fetchText(`${API}?query=eventDetails&slug=${encodeURIComponent(e.slug)}`)
			).events[0];
			return toEvent({ ...e, city: null, country: null, timetable: null, ...details });
		});
		return events.filter((e): e is MotorEvent => e !== null);
	}
};
