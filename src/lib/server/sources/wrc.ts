import type { MotorEvent, SeriesId } from '#lib/series.ts';
import { slugify } from '../util';
import type { Source } from './types';
import { MONTHS, fetchWikitext, stripWiki, tableRows } from './wikipedia';

// wrc.com blocks automated clients, so the calendar table of the Wikipedia season
// article is used instead; the ERC article has the same table. Rallies run over several
// days, so they are all-day events.

type RallySeries = Extract<SeriesId, 'wrc' | 'erc'>;

function parseDate(cell: string, year: number): string | null {
	const m = stripWiki(cell).match(/^(\d{1,2})\s+([A-Za-z]+)/);
	const month = m ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0;
	if (!m || month === 0) return null;
	return `${year}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function parseCalendar(wikitext: string, year: number, series: RallySeries, article: string): MotorEvent[] {
	const events: MotorEvent[] = [];
	for (const cells of tableRows(wikitext, /==\s*Calendar\s*==/)) {
		const round = Number(stripWiki(cells[0] ?? ''));
		if (!Number.isInteger(round) || round <= 0 || cells.length < 5) continue;
		const from = parseDate(cells[1], year);
		const to = parseDate(cells[2], year);
		const name = stripWiki(cells[3]);
		if (!from || !to || !name) continue;
		events.push({
			id: `${series}-${year}-${slugify(name)}`,
			series,
			name,
			round,
			location: stripWiki(cells[4]),
			start: from,
			end: to,
			allDay: true,
			sessions: [],
			url: `https://en.wikipedia.org/wiki/${article}`
		});
	}
	return events;
}

function rallySource(series: RallySeries, championship: string): Source {
	return {
		label: `Wikipedia (${series.toUpperCase()} season article)`,
		series: [series],
		async load(years) {
			const articles = years.map((year) => `${year}_${championship}`);
			const texts = await Promise.all(articles.map(fetchWikitext));
			return years.flatMap((year, i) => (texts[i] ? parseCalendar(texts[i], year, series, articles[i]) : []));
		}
	};
}

export const wrc = rallySource('wrc', 'World_Rally_Championship');
export const erc = rallySource('erc', 'European_Rally_Championship');
