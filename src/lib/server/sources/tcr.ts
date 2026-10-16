import type { MotorEvent, Session } from '#lib/series.ts';
import { fetchPdfText, fetchText, finalizeEvent, guessKind, makeSession, mapLimit, zonedToUtc } from '../util';
import { timeZoneFor } from '../zones';
import { circuitRow, readSeason, type Season } from './seasons';
import type { Source } from './types';
import { MONTHS } from './wikipedia';

// The TCR World Tour calendar comes from the Wikipedia season article. The series site links a
// timetable PDF per event ("/images/2026/03_Le_Castellet/2026_Timetable_03_TCR_World_Tour_France_V8.pdf"),
// numbered like the rounds. Its text has a heading per day ("Saturday, 4th July") and rows of
// start, end and duration times, the activity and the series; the Kumho FIA TCR World Tour's
// practice, qualifying and races are kept, in the venue's local time.
const SITE = 'https://www.fiatcrworldtour.com';

const season: Season = {
	series: 'tcr',
	article: (y) => `${y}_TCR_World_Tour`,
	heading: /==\s*Calendar\s*==/i,
	row: circuitRow('TCR')
};

interface Timetable {
	round: number;
	country: string;
	url: string;
}

/** The latest version of each event's timetable linked from the events page. */
export function timetables(html: string, year: number): Timetable[] {
	const latest = new Map<number, { version: number; t: Timetable }>();
	const links = html.matchAll(new RegExp(`href="(/images/${year}/[^"]*?_Timetable_(\\d+)_TCR_World_Tour_([A-Za-z]+)[^"]*?_V(\\d+)\\.pdf)"`, 'g'));
	for (const [, path, round, country, version] of links) {
		const r = Number(round);
		if ((latest.get(r)?.version ?? -1) < Number(version)) latest.set(r, { version: Number(version), t: { round: r, country, url: `${SITE}${path}` } });
	}
	return [...latest.values()].map((v) => v.t);
}

/** Series sessions from the timetable text. */
export function parseTimetable(text: string, year: number, timeZone: string): Session[] {
	const sessions: Session[] = [];
	let date: [number, number] | null = null;
	for (const line of text.split('\n')) {
		const day = line.match(/^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/);
		if (day) {
			const month = MONTHS.indexOf(day[2].toLowerCase()) + 1;
			date = month ? [month, Number(day[1])] : null;
			continue;
		}
		const row = line.match(/^((?:\d{2}:\d{2}\s+){1,3})(.+?)\s+Kumho FIA TCR World Tour\b/i);
		if (!row || !date) continue;
		const activity = row[2].trim();
		if (!/^(free practice|qualifying|race)\b/i.test(activity)) continue;
		const times = row[1].trim().split(/\s+/);
		const at = (t: string) => zonedToUtc(year, date![0], date![1], Number(t.slice(0, 2)), Number(t.slice(3)), timeZone);
		// "Race 1 (min 16 - max 18 laps)" -> "Race 1"; "Qualifying - Q1" -> "Qualifying 1"
		const name = activity.replace(/\s*\(.*\)$/, '').replace(/^Qualifying\s*-\s*Q(\d)/i, 'Qualifying $1');
		const session = makeSession(name, at(times[0]), 30, guessKind(name));
		// With three times the second is the end; with two it may be the end or the duration.
		const end = times.length === 3 ? times[1] : times.length === 2 && times[1] > times[0] ? times[1] : null;
		if (end) {
			session.end = at(end);
			session.estimatedEnd = false;
		}
		sessions.push(session);
	}
	return sessions;
}

export const tcr: Source = {
	label: 'fiatcrworldtour.com + Wikipedia',
	series: ['tcr'],
	async load(years) {
		const [calendar, page] = await Promise.all([readSeason(season, years), fetchText(`${SITE}/events`)]);
		const timed = await mapLimit(calendar, 2, async (event): Promise<MotorEvent> => {
			const year = Number(event.start.slice(0, 4));
			const t = timetables(page, year).find((t) => t.round === event.round);
			const timeZone = t && timeZoneFor(`${event.location}, ${t.country}`);
			if (!t || !timeZone) return event;
			const sessions = await fetchPdfText(t.url).then((pages) => parseTimetable(pages.join('\n'), year, timeZone), () => []);
			return finalizeEvent({ ...event, sessions, url: t.url }) ?? event;
		});
		return timed;
	}
};
