import { escapeText, fold, utcStamp, dateStamp, nextDay } from '@szpolny/calendar-kit/ics';
import { SERIES, type MotorEvent, type SessionKind } from '#lib/series.ts';

export type SessionFilter = 'all' | 'main' | 'races';

export const SESSION_FILTERS: Record<SessionFilter, SessionKind[]> = {
	all: ['practice', 'qualifying', 'sprint', 'race', 'other'],
	main: ['qualifying', 'sprint', 'race'],
	races: ['sprint', 'race']
};

export interface IcsOptions {
	name: string;
	sessions: SessionFilter;
	/** minutes before start; omitted = no alarm */
	alarm?: number;
}

export function buildIcs(events: MotorEvent[], opts: IcsOptions): string {
	const now = utcStamp(new Date().toISOString());
	const kinds = SESSION_FILTERS[opts.sessions];
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Outlap//Motorsport Calendar//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(opts.name)}`,
		'X-WR-CALDESC:Motorsport sessions\\, refreshed from official sources',
		'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
		'X-PUBLISHED-TTL:PT1H'
	];

	const alarm =
		opts.alarm && opts.alarm > 0
			? ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', `TRIGGER:-PT${Math.round(opts.alarm)}M`, 'END:VALARM']
			: [];

	for (const event of events) {
		const series = SERIES[event.series];
		const location = event.location ? [`LOCATION:${escapeText(event.location)}`] : [];
		const url = event.url ? [`URL:${event.url}`] : [];

		if (event.allDay) {
			lines.push(
				'BEGIN:VEVENT',
				`UID:${event.id}@outlap`,
				`DTSTAMP:${now}`,
				`DTSTART;VALUE=DATE:${dateStamp(event.start)}`,
				`DTEND;VALUE=DATE:${dateStamp(nextDay(event.end))}`,
				`SUMMARY:${escapeText(`${series.short}: ${event.name}`)}`,
				...location,
				...url,
				'TRANSP:TRANSPARENT',
				`CATEGORIES:${escapeText(series.name)}`,
				'END:VEVENT'
			);
			continue;
		}

		// UIDs derive from the session name (not its time) so a rescheduled session updates in place.
		const used = new Map<string, number>();
		for (const session of event.sessions) {
			const slug = session.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			const n = (used.get(slug) ?? 0) + 1;
			used.set(slug, n);
			if (!kinds.includes(session.kind)) continue;
			const description = [
				`${series.name}${event.round ? `, round ${event.round}` : ''}`,
				session.estimatedEnd ? 'End time is an estimate; the start time is official.' : '',
				event.url ?? ''
			]
				.filter(Boolean)
				.join('\n');
			lines.push(
				'BEGIN:VEVENT',
				`UID:${event.id}-${slug}${n > 1 ? `-${n}` : ''}@outlap`,
				`DTSTAMP:${now}`,
				`DTSTART:${utcStamp(session.start)}`,
				`DTEND:${utcStamp(session.end)}`,
				`SUMMARY:${escapeText(`${series.short}: ${event.name} – ${session.name}`)}`,
				`DESCRIPTION:${escapeText(description)}`,
				...location,
				...url,
				`CATEGORIES:${escapeText(series.name)}`,
				...alarm,
				'END:VEVENT'
			);
		}
	}

	lines.push('END:VCALENDAR');
	return lines.map(fold).join('\r\n') + '\r\n';
}
