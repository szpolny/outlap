import type { MotorEvent } from '#lib/series.ts';
import { slugify } from '../util';
import type { Source } from './types';
import { MONTHS, fetchWikitext, stripWiki, tableRows } from './wikipedia';

// wrc.com blocks automated clients, so the calendar table of the Wikipedia season
// article is used instead. Rallies run Thursday–Sunday, so they are all-day events.

function parseDate(cell: string, year: number): string | null {
	const m = stripWiki(cell).match(/^(\d{1,2})\s+([A-Za-z]+)/);
	const month = m ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0;
	if (!m || month === 0) return null;
	return `${year}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function parseCalendar(wikitext: string, year: number): MotorEvent[] {
	const events: MotorEvent[] = [];
	for (const cells of tableRows(wikitext, /==\s*Calendar\s*==/)) {
		const round = Number(stripWiki(cells[0] ?? ''));
		if (!Number.isInteger(round) || round <= 0 || cells.length < 5) continue;
		const from = parseDate(cells[1], year);
		const to = parseDate(cells[2], year);
		const name = stripWiki(cells[3]);
		if (!from || !to || !name) continue;
		events.push({
			id: `wrc-${year}-${slugify(name)}`,
			series: 'wrc',
			name,
			round,
			location: stripWiki(cells[4]),
			start: from,
			end: to,
			allDay: true,
			sessions: [],
			url: `https://en.wikipedia.org/wiki/${year}_World_Rally_Championship`
		});
	}
	return events;
}

export const wrc: Source = {
	label: 'Wikipedia (WRC season article)',
	series: ['wrc'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const wikitext = await fetchWikitext(`${year}_World_Rally_Championship`);
			if (wikitext) events.push(...parseCalendar(wikitext, year));
		}
		return events;
	}
};
