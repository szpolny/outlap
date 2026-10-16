import type { MotorEvent, Session } from '#lib/series.ts';
import { decodeEntities, fetchPdfLines, fetchText, finalizeEvent, makeSession, mapLimit, zonedToUtc } from '../util';
import { timeZoneFor } from '../zones';
import type { Source } from './types';
import { MONTHS } from './wikipedia';

// mxgp.com's calendar switches to the next season as soon as it is announced, months before
// Wikipedia has an article for it. It gives each Grand Prix's race day without a year or start
// times, so the season is read from the year in its ticket links and races are all-day events.
// Seasons the calendar no longer shows are read from Wikipedia by provisional.ts. Each Grand
// Prix's track page links the latest timetable PDF held there ("2026_MXGP_of_TheNetherlands_
// Timetable.pdf"); when it is this Grand Prix's, its MXGP sessions are read in local time.
const PAGE = 'https://www.mxgp.com/calendar';
const MXGP_CLASS = '9';

/** The year most ticket links name, such as "mxgp-of-france-vip-2027". */
function season(html: string): number | null {
	const counts = new Map<number, number>();
	for (const [, year] of html.matchAll(/weezevent\.com\/[^"]*?-(20\d{2})\b/g)) {
		counts.set(Number(year), (counts.get(Number(year)) ?? 0) + 1);
	}
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Grands Prix of the MXGP class, numbered in calendar order; other championships are left out. */
export function parseCalendar(html: string): MotorEvent[] {
	const year = season(html);
	if (!year) throw new Error('no season year on calendar');
	const entry =
		/<li class="[^"]*" data-id="(\d+)"><div rel=\d+>[\s\S]*?<div class="date">\s*(\d{1,2})\s+([A-Za-z]{3})\s*<\/div><div class="destination"><a href="([^"]*)"[^>]*><span class="country_prefix">MXGP of\s*<\/span>([^<]*)<\/a><span class="venue_name">([^<]*)<\/span>/g;
	const events: MotorEvent[] = [];
	for (const [, category, day, month, track, place, venue] of html.matchAll(entry)) {
		const m = MONTHS.findIndex((name) => name.startsWith(month.toLowerCase())) + 1;
		if (category !== MXGP_CLASS || m === 0) continue;
		const date = `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
		// The list starts over after the season's last Grand Prix.
		if (events.some((e) => e.start === date)) break;
		const round = events.length + 1;
		// "Sardegna (ITA)" -> "Sardegna"
		const name = `MXGP of ${decodeEntities(place).replace(/\s*\([A-Z]{3}\)$/, '').trim()}`;
		const location = decodeEntities(venue).trim();
		events.push({
			id: `mxgp-${year}-${round}`,
			series: 'mxgp',
			name,
			round,
			location: location && !/^tba$/i.test(location) ? location : undefined,
			start: date,
			end: date,
			allDay: true,
			sessions: [],
			url: new URL(track, PAGE).href
		});
	}
	return events;
}

const MXGP_SESSIONS: [RegExp, string, Session['kind'], number][] = [
	[/^free practice/i, 'Free Practice', 'practice', 25],
	[/^time practice/i, 'Time Practice', 'qualifying', 25],
	[/^qualifying race/i, 'Qualifying Race', 'sprint', 25],
	[/^warm.?up/i, 'Warm-up', 'practice', 15],
	[/^race (\d)/i, 'Race', 'race', 35]
];

/**
 * The class's sessions from a timetable PDF's lines: day headings ("Saturday 22.08.2026"), then
 * rows of a time, often the class and the session. A row without a class belongs to the class
 * named on the row before it ("MXGP | Motorcycles in waiting zone", then "Race 1").
 */
export function parseTimetable(lines: string[][], timeZone: string, cls = 'MXGP'): Session[] {
	const sessions: Session[] = [];
	let day: [number, number, number] | null = null;
	let current = '';
	for (const cells of lines) {
		const heading = cells.join(' ').match(/^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
		if (heading) {
			day = [Number(heading[3]), Number(heading[2]), Number(heading[1])];
			current = '';
			continue;
		}
		const time = cells[0]?.match(/^(\d{1,2}):(\d{2})/);
		if (!time || !day) continue;
		const named = /^(MXGP|MX2|WMX|EMX\w*)/i.test(cells[1] ?? '');
		if (named) current = cells[1];
		if (current.toUpperCase() !== cls) continue;
		const label = named ? cells[2] ?? '' : cells[1] ?? '';
		const known = MXGP_SESSIONS.find(([match]) => match.test(label));
		if (!known) continue;
		const name = known[1] === 'Race' ? `Race ${label.match(/\d/)![0]}` : known[1];
		const start = zonedToUtc(day[0], day[1], day[2], Number(time[1]), Number(time[2]), timeZone);
		sessions.push(makeSession(name, start, known[3], known[2]));
	}
	return sessions;
}

/** Sessions from the track page's timetable PDF, if it is the one for this Grand Prix. */
async function timedEvent(event: MotorEvent): Promise<MotorEvent> {
	const year = event.start.slice(0, 4);
	const page = await fetchText(event.url!).catch(() => '');
	const pdf = page.match(new RegExp(`href="([^"]*/${year}_MXGP_of_[^"]*Timetable[^"]*\\.pdf)"`, 'i'))?.[1];
	const timeZone = timeZoneFor(`${event.name}, ${event.location ?? ''}`);
	if (!pdf || !timeZone) return event;
	const sessions = (await fetchPdfLines(new URL(pdf, PAGE).href).then((lines) => parseTimetable(lines, timeZone), () => []))
		// The race day and the two days before it.
		.filter((s) => s.start.slice(0, 10) <= event.start && Date.parse(event.start) - Date.parse(s.start) < 3 * 86_400_000);
	return finalizeEvent({ ...event, sessions }) ?? event;
}

export const mxgp: Source = {
	label: 'mxgp.com',
	series: ['mxgp'],
	async load(years) {
		const events = parseCalendar(await fetchText(PAGE));
		if (events.length === 0) throw new Error('no Grands Prix on calendar');
		return mapLimit(events.filter((e) => years.includes(Number(e.start.slice(0, 4)))), 3, timedEvent);
	}
};
