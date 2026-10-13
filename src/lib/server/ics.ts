import { buildCalendar, type CalendarEvent } from '@szpolny/calendar-kit/ics';
import { FILTER_KINDS, type SessionFilter } from '#lib/format.ts';
import { SERIES, type MotorEvent } from '#lib/series.ts';

export interface IcsOptions {
	name: string;
	sessions: SessionFilter;
	/** minutes before start; omitted = no alarm */
	alarm?: number;
}

export function buildIcs(events: MotorEvent[], opts: IcsOptions): string {
	const kinds = FILTER_KINDS[opts.sessions];
	const entries: CalendarEvent[] = [];

	for (const event of events) {
		const series = SERIES[event.series];
		const common = { location: event.location, url: event.url, category: series.name };

		if (event.allDay) {
			entries.push({
				...common,
				uid: `${event.id}@outlap`,
				summary: `${series.short}: ${event.name}`,
				start: event.start,
				end: event.end,
				allDay: true
			});
			continue;
		}

		// UIDs derive from the session name (not its time) so a rescheduled session updates in place.
		const used = new Map<string, number>();
		for (const session of event.sessions) {
			const slug = session.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			const n = (used.get(slug) ?? 0) + 1;
			used.set(slug, n);
			if (!kinds.includes(session.kind)) continue;
			entries.push({
				...common,
				uid: `${event.id}-${slug}${n > 1 ? `-${n}` : ''}@outlap`,
				summary: `${series.short}: ${event.name} – ${session.name}`,
				start: session.start,
				end: session.end,
				allDay: false,
				description: [
					`${series.name}${event.round ? `, round ${event.round}` : ''}`,
					session.estimatedEnd ? 'End time is an estimate; the start time is official.' : '',
					event.url ?? ''
				]
					.filter(Boolean)
					.join('\n')
			});
		}
	}

	return buildCalendar(entries, {
		prodId: '-//Outlap//Motorsport Calendar//EN',
		name: opts.name,
		description: 'Motorsport sessions, refreshed from official sources',
		alarm: opts.alarm
	});
}
