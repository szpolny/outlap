import type { MotorEvent } from '#lib/series.ts';
import { fetchOptional, slugify } from '../util';
import type { Source } from './types';

// wrc.com blocks automated clients, so the calendar table of the Wikipedia season
// article is used instead. Rallies run Thursday–Sunday, so they are all-day events.

const MONTHS = [
	'january', 'february', 'march', 'april', 'may', 'june',
	'july', 'august', 'september', 'october', 'november', 'december'
];

function stripWiki(s: string): string {
	return s
		.replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '')
		.replace(/\{\{flagicon\|[^}]*\}\}/gi, '')
		.replace(/\{\{[^}]*\}\}/g, '')
		.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
		.replace(/'''?/g, '')
		// leading cell attributes such as `align=center|` or `nowrap|`
		.replace(/^[^[\]{}|]*\|/, '')
		.replace(/&nbsp;/g, ' ')
		.trim();
}

function parseDate(cell: string, year: number): string | null {
	const m = stripWiki(cell).match(/^(\d{1,2})\s+([A-Za-z]+)/);
	const month = m ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0;
	if (!m || month === 0) return null;
	return `${year}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function parseCalendar(wikitext: string, year: number): MotorEvent[] {
	const start = wikitext.search(/==\s*Calendar\s*==/);
	if (start < 0) return [];
	const table = wikitext.slice(start, wikitext.indexOf('|}', start));
	const events: MotorEvent[] = [];
	for (const row of table.split(/\n\|-/).slice(1)) {
		const cells = row
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.startsWith('|') || l.startsWith('!'))
			.map((l) => l.slice(1));
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
			const body = await fetchOptional(
				`https://en.wikipedia.org/w/api.php?action=parse&page=${year}_World_Rally_Championship&prop=wikitext&format=json&formatversion=2&redirects=1`
			);
			const wikitext = body && JSON.parse(body).parse?.wikitext;
			if (wikitext) events.push(...parseCalendar(wikitext, year));
		}
		return events;
	}
};
