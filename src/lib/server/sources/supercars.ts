import type { MotorEvent, Session, SessionKind } from '#lib/series.ts';
import { fetchText, finalizeEvent, guessKind, mapLimit } from '../util';
import type { Source } from './types';

// supercars.com's calendar page lists the current season's events, and each event's schedule
// page lists every series on track with start and end times and their UTC offset. Both pages are
// Next.js server components, whose data is embedded as JSON in script tags. Events without a
// schedule yet are all-day. Other seasons are read from Wikipedia by provisional.ts.
const SITE = 'https://www.supercars.com';
const SERIES_ID = 'SG3';

interface ApiEvent {
	title: string;
	slug: string;
	location: string;
	startDate: string;
	endDate: string;
}

interface ApiSchedule {
	name: string;
	type: string;
	startDate: string;
	endDate: string | null;
	series: { natsoftSeriesId: string | null } | null;
}

/** The React server component payload pushed by `self.__next_f.push([1, "..."])` scripts. */
export function flightData(html: string): string {
	return [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)]
		.map(([, chunk]) => JSON.parse(`"${chunk}"`) as string)
		.join('');
}

/** Every JSON array under the key in a flight payload. */
function arrays<T>(flight: string, key: string): T[][] {
	const out: T[][] = [];
	for (const m of flight.matchAll(new RegExp(`"${key}":\\[`, 'g'))) {
		const start = m.index! + m[0].length - 1;
		const end = arrayEnd(flight, start);
		if (end > start) out.push(JSON.parse(flight.slice(start, end + 1)));
	}
	return out;
}

/** Index of the "]" closing the array opened at `start`, skipping strings. */
function arrayEnd(s: string, start: number): number {
	let depth = 0;
	for (let i = start; i < s.length; i++) {
		const c = s[i];
		if (c === '"') {
			for (i++; s[i] !== '"'; i++) if (s[i] === '\\') i++;
		} else if (c === '[' || c === '{') depth++;
		else if (c === ']' || c === '}') {
			if (--depth === 0) return i;
		}
	}
	return -1;
}

/** The local date of an ISO timestamp with offset: "2026-10-23T06:00:00.000+10:00" -> "2026-10-23". */
const localDay = (iso: string) => iso.slice(0, 10);

export const parseCalendar = (html: string): ApiEvent[] => arrays<ApiEvent>(flightData(html), 'events').flat();

const KINDS: Record<string, SessionKind> = { Practice: 'practice', Qualifying: 'qualifying', Race: 'race' };

/** Supercars sessions on an event's schedule page, without sponsor prefixes or test days. */
export function parseSchedule(html: string): Session[] {
	const sessions = arrays<ApiSchedule>(flightData(html), 'schedules')
		.flat()
		// Test days the week of a meeting are listed with it.
		.filter((s) => s.series?.natsoftSeriesId === SERIES_ID && !/\btest\b/i.test(s.name));
	return sessions.map((s) => {
		// "Boost Mobile Qualifying (Race 31)" -> "Qualifying (Race 31)"
		const name = s.name
			.replace(/^.*?(?=\b(practice|qualifying|top ten shootout|ttso|race)\b)/i, '')
			.replace(/^TTSO\b/i, 'Top Ten Shootout');
		const start = new Date(s.startDate).toISOString();
		const end = s.endDate ? new Date(s.endDate).toISOString() : start;
		return { name, kind: KINDS[s.type] ?? guessKind(name), start, end, estimatedEnd: !s.endDate };
	});
}

const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * The title without its year and sponsor, starting at the place its slug names:
 * "2026 Penrite Oil Sandown 500" (2026-sandown) -> "Sandown 500". Titles naming the place last,
 * such as "2026 AirTouch 500 at The Bend", keep the sponsor.
 */
export function eventName(title: string, slug: string): string {
	const words = title.replace(/^\d{4}\s+/, '').split(/\s+/);
	const place = slug.replace(/^\d{4}-/, '').split('-')[0];
	const i = words.findIndex((word) => plain(word) === place);
	return i > 0 && plain(words[i - 1]) !== 'at' ? words.slice(i).join(' ') : words.join(' ');
}

export const supercars: Source = {
	label: 'supercars.com',
	series: ['supercars'],
	async load(years) {
		const events = parseCalendar(await fetchText(`${SITE}/calendar`));
		if (events.length === 0) throw new Error('no events on calendar');
		const season = events.filter((e) => years.includes(Number(localDay(e.startDate).slice(0, 4))));
		return mapLimit(season.map((e, i) => ({ ...e, round: i + 1 })), 4, async (e): Promise<MotorEvent> => {
			const url = `${SITE}/events/${e.slug}/schedule`;
			const event = {
				id: `supercars-${e.slug}`,
				series: 'supercars' as const,
				name: eventName(e.title, e.slug),
				round: e.round,
				location: e.location,
				sessions: [] as Session[],
				url
			};
			try {
				event.sessions = parseSchedule(await fetchText(url));
			} catch (error) {
				console.warn(`[supercars] ${e.slug} schedule unavailable:`, error instanceof Error ? error.message : error);
			}
			return finalizeEvent(event) ?? { ...event, start: localDay(e.startDate), end: localDay(e.endDate), allDay: true };
		});
	}
};
