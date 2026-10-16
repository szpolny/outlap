import type { MotorEvent, Session } from '#lib/series.ts';
import { decodeEntities, fetchText, finalizeEvent, makeSession, zonedToUtc } from '../util';
import type { Source } from './types';
import { MONTHS, dateRange, fetchWikitext, stripWiki } from './wikipedia';

// The official schedule page covers the next TT: a fortnight of qualifying and race days on
// the Mountain Course. Months before the TT it lists only the days, and the TT is one all-day
// event; once the timetable is published each day has "11:45 - Monster Energy Supersport TT
// Race 1 (4 laps)" lines in island time, and the qualifying sessions and races become
// sessions. Once that page moves on to the next TT, earlier editions come from the infobox of
// their Wikipedia article.
const PAGE = 'https://www.iomttraces.com/racing/page/schedule/';

/** An edition's dates from "| date = 25 May – 6 June 2026" in its article's infobox. */
export function parseArticle(wikitext: string, year: number): MotorEvent | null {
	const dates = dateRange(stripWiki(wikitext.match(/\|\s*date\s*=\s*([^\n]*)/i)?.[1] ?? ''), year);
	if (!dates) return null;
	return {
		id: `iomtt-${year}`,
		series: 'iomtt',
		name: `Isle of Man TT ${year}`,
		location: 'Snaefell Mountain Course, Isle of Man',
		start: dates[0],
		end: dates[1],
		allDay: true,
		sessions: [],
		url: `https://en.wikipedia.org/wiki/${year}_Isle_of_Man_TT`
	};
}

async function fromArticles(years: number[]): Promise<MotorEvent[]> {
	const articles = await Promise.all(years.map((year) => fetchWikitext(`${year}_Isle_of_Man_TT`)));
	return years.flatMap((year, i) => {
		const event = articles[i] && parseArticle(articles[i], year);
		return event ? [event] : [];
	});
}

const DAY = /\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\s+(\d{1,2})\s+([A-Za-z]+)/i;

/**
 * Qualifying sessions and races from the schedule's table: a row per day with its heading
 * ("Qualifying 2", "Race Day 1") and date in the first cell and its timetable in the second.
 */
export function parseSessions(html: string, year: number): Session[] {
	const sessions: Session[] = [];
	const text = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
	for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
		const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
		if (cells.length < 2) continue;
		const heading = text(cells[0].match(/<strong>([\s\S]*?)<\/strong>/)?.[1] ?? '');
		const day = text(cells[0]).match(DAY);
		const month = day ? MONTHS.indexOf(day[2].toLowerCase()) + 1 : 0;
		if (!day || !month) continue;
		const qualifying = /qualifying/i.test(heading);
		for (const [, line] of cells[1].matchAll(/<p>([\s\S]*?)<\/p>/g)) {
			const m = text(line).match(/^(\d{1,2}):(\d{2})\s*-\s*(.+)$/);
			if (!m) continue;
			const label = m[3];
			const start = zonedToUtc(year, month, Number(day[1]), Number(m[1]), Number(m[2]), 'Europe/Isle_of_Man');
			const laps = Number(label.match(/\((\d+) laps?\)/i)?.[1]);
			if (/\bTT Race\b/i.test(label)) {
				// A lap of the Mountain Course takes about 18 to 20 minutes.
				// "Monster Energy Supersport TT Race 1 (4 laps)" -> "Supersport TT Race 1"
				const name = label.replace(/\s*\(\d+ laps?\)/i, '').replace(/^.*?\b(?=(?:Supersport|Sidecar|Superbike|Superstock|Supertwin|Senior|Lightweight|Zero)\b)/i, '');
				sessions.push(makeSession(name, start, (laps || 4) * 20, 'race'));
			} else if (qualifying && !/roads close|speed control|untimed/i.test(label)) {
				sessions.push(makeSession(`${heading.replace(/^.*?(Qualifying \d+)$/i, '$1')}: ${label}`, start, 45, 'qualifying'));
			}
		}
	}
	return sessions;
}

export const iomtt: Source = {
	label: 'iomttraces.com + Wikipedia (TT article)',
	series: ['iomtt'],
	async load(years) {
		const html = await fetchText(PAGE);
		const year = Number(html.match(/schedule for the (\d{4}) Isle of Man TT/i)?.[1]);
		if (!year) throw new Error('no TT schedule on page');
		const earlier = await fromArticles(years.filter((y) => y !== year));
		if (!years.includes(year)) return earlier;
		// Day headings: "MONDAY 31 MAY (UK Bank Holiday)".
		const days = [...decodeEntities(html.replace(/<[^>]*>/g, ' ')).matchAll(
			/\b(?:MON|TUES|WEDNES|THURS|FRI|SATUR|SUN)DAY\s+(\d{1,2})\s+([A-Z]+)/gi
		)]
			.map(([, day, month]) => {
				const m = MONTHS.indexOf(month.toLowerCase()) + 1;
				return m === 0 ? null : `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
			})
			.filter((d): d is string => d !== null)
			.sort();
		if (days.length === 0) throw new Error('no days in TT schedule');
		const event: MotorEvent = {
			id: `iomtt-${year}`,
			series: 'iomtt',
			name: `Isle of Man TT ${year}`,
			location: 'Snaefell Mountain Course, Isle of Man',
			start: days[0],
			end: days.at(-1)!,
			allDay: true,
			sessions: [],
			url: PAGE
		};
		const sessions = parseSessions(html, year);
		return [...earlier, (sessions.length > 0 && finalizeEvent({ ...event, sessions })) || event];
	}
};
