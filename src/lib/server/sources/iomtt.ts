import type { MotorEvent } from '#lib/series.ts';
import { decodeEntities, fetchText } from '../util';
import type { Source } from './types';
import { MONTHS, dateRange, fetchWikitext, stripWiki } from './wikipedia';

// The official schedule page covers the next TT: a fortnight of qualifying and race days on
// the Mountain Course, with races but no start times. It becomes one all-day event. Once that
// page moves on to the next TT, earlier editions come from the infobox of their Wikipedia article.
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
			/\b(?:MON|TUES|WEDNES|THURS|FRI|SATUR|SUN)DAY\s+(\d{1,2})\s+([A-Z]+)/g
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
		return [...earlier, event];
	}
};
