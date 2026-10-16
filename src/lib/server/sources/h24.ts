import type { MotorEvent, Session } from '#lib/series.ts';
import { addMinutes, decodeEntities, fetchText, finalizeEvent, guessKind, makeSession, mapLimit, titleCase, zonedToUtc } from '../util';
import { timeZoneFor } from '../zones';
import { readSeason, round, text, unsponsored, type Season } from './seasons';
import type { Source } from './types';
import { MONTHS, column, dateRange } from './wikipedia';

// The 24H Series calendar comes from the Wikipedia season article. Each race page on
// 24hseries.com lists the weekend's sessions per series, "Fri-12:00" and the session in local
// time, as soon as the timetable is set (the same list later links the results). Only the
// Michelin 24H SERIES block is read; support series and the Middle East Trophy have their own.
const SITE = 'https://www.24hseries.com';

const season: Season = {
	series: 'h24',
	article: (y) => `${y}_24H_Series`,
	heading: /==\s*Calendar\s*==/i,
	row: (cells, year) => {
		const name = unsponsored(text(column(cells, /^event/i)));
		const r = round(column(cells, /^round/i));
		if (!name || !r) return null;
		return { name, location: text(column(cells, /^circuit/i)), round: r, dates: dateRange(column(cells, /^date/i) ?? '', year) };
	}
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "18-19-20 September 2026" -> first and last day */
function pageDates(html: string): [string, string] | null {
	const m = html.match(/class="date">\s*([\d-]+)\s+([A-Za-z]+)\s+(\d{4})/);
	if (!m) return null;
	const days = m[1].split('-').filter(Boolean);
	const month = MONTHS.findIndex((name) => name.startsWith(m[2].toLowerCase().slice(0, 3))) + 1;
	if (!month) return null;
	const iso = (d: string) => `${m[3]}-${String(month).padStart(2, '0')}-${d.padStart(2, '0')}`;
	return [iso(days[0]), iso(days.at(-1)!)];
}

/** Sessions of the 24H SERIES block, dated by weekday within the week before the race ends. */
export function parseRacePage(html: string, timeZone: string, raceHours: number): { dates: [string, string] | null; sessions: Session[] } {
	const dates = pageDates(html);
	const block = html.split('class="raceResultsContainer"').find((b) => /data-series="michelin-24h-series"/.test(b));
	if (!dates || !block) return { dates, sessions: [] };
	const sessions: Session[] = [];
	for (const [, day, hh, mm, label] of block.matchAll(/class="col">(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(\d{2}):(\d{2})<\/div><div class="col">([^<]*)</g)) {
		// "RACE PART 1 - MICHELIN 12H MUGELLO 2026" -> "Race Part 1"
		const name = titleCase(decodeEntities(label).trim().replace(/\s+-\s+michelin.*$/i, '').toLowerCase());
		// The race also lists its half-way and hourly classifications.
		if (/half way|per hour|combined/i.test(name)) continue;
		// The latest date with that weekday on or before the last day.
		let date = new Date(`${dates[1]}T00:00:00Z`);
		while (WEEKDAYS[date.getUTCDay()] !== day) date = new Date(date.getTime() - 86_400_000);
		const start = zonedToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), Number(hh), Number(mm), timeZone);
		const kind = /^race/i.test(name) ? 'race' : guessKind(name);
		sessions.push(makeSession(name, start, kind === 'qualifying' ? 20 : 90, kind));
	}
	// A race split over two days shares its length between the parts.
	const races = sessions.filter((s) => s.kind === 'race');
	for (const race of races) race.end = addMinutes(race.start, (raceHours * 60) / races.length);
	return { dates, sessions };
}

export const h24: Source = {
	label: '24hseries.com + Wikipedia',
	series: ['h24'],
	async load(years) {
		const [calendar, list] = await Promise.all([readSeason(season, years), fetchText(`${SITE}/calendar`)]);
		const paths = [...new Set([...list.matchAll(/href="(\/races\/[a-z0-9-]+-(\d{4}))"/g)]
			.filter((m) => years.includes(Number(m[2]))).map((m) => m[1]))];
		const pages = await mapLimit(paths, 3, async (path) => ({ path, html: await fetchText(`${SITE}${path}`) }));
		return calendar.map((event): MotorEvent => {
			const timeZone = timeZoneFor(event.location ?? '');
			const hours = Number(event.name.match(/(\d+)\s*Hours?/i)?.[1] ?? 12);
			for (const { path, html } of pages) {
				if (!timeZone) break;
				const page = parseRacePage(html, timeZone, hours);
				// The page whose race days overlap the article's.
				if (!page.dates || page.dates[0] > event.end || page.dates[1] < event.start || page.sessions.length === 0) continue;
				const timed = finalizeEvent({ ...event, sessions: page.sessions, url: `${SITE}${path}` });
				if (timed) return timed;
			}
			return event;
		});
	}
};
