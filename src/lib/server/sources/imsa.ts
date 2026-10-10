import type { MotorEvent } from '#lib/series.ts';
import { slugify } from '../util';
import type { Source } from './types';
import { MONTHS, fetchWikitext, stripWiki, tableRows } from './wikipedia';

// imsa.com sits behind a bot challenge, so the schedule table of the Wikipedia season
// article is used instead. It lists race days without start times, so races are all-day events.

function isoDate(year: number, month: string, day: string): string | null {
	const m = MONTHS.indexOf(month.toLowerCase()) + 1;
	return m === 0 ? null : `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** "March 21", "January 24–25", "January 30/31", "September 30 – October 1" */
function parseDates(cell: string, year: number): [string, string] | null {
	const m = stripWiki(cell).match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*[–\-/]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}))?/);
	if (!m) return null;
	const from = isoDate(year, m[1], m[2]);
	const to = m[4] ? isoDate(year, m[3] ?? m[1], m[4]) : from;
	return from && to ? [from, to] : null;
}

function parseSchedule(wikitext: string, year: number): MotorEvent[] {
	const events: MotorEvent[] = [];
	for (const cells of tableRows(wikitext, /==\s*(Schedule|Calendar)\s*==/)) {
		// Rnd. | Race | Length | Classes | Circuit | Location | Date
		const round = Number(stripWiki(cells[0] ?? ''));
		if (!Number.isInteger(round) || round <= 0 || cells.length < 7) continue;
		const dates = parseDates(cells[6], year);
		const name = stripWiki(cells[1]);
		if (!dates || !name) continue;
		events.push({
			id: `imsa-${year}-${slugify(name)}`,
			series: 'imsa',
			name,
			round,
			location: stripWiki(cells[4]),
			start: dates[0],
			end: dates[1],
			allDay: true,
			sessions: [],
			url: `https://en.wikipedia.org/wiki/${year}_IMSA_SportsCar_Championship`
		});
	}
	return events;
}

export const imsa: Source = {
	label: 'Wikipedia (IMSA season article)',
	series: ['imsa'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const wikitext = await fetchWikitext(`${year}_IMSA_SportsCar_Championship`);
			if (wikitext) events.push(...parseSchedule(wikitext, year));
		}
		if (events.length === 0) throw new Error('no races found in schedule table');
		return events;
	}
};
