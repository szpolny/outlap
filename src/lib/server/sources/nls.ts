import type { MotorEvent } from '#lib/series.ts';
import { decodeEntities, fetchOptional, slugify } from '../util';
import type { Source } from './types';

// The NLS site has a calendar page per season, a table of race days and race names such as
// "NLS1: 71. ADAC Westfalenfahrt (4h)". Start times are not published, so races are all-day
// events. The ADAC 24h Qualifiers are two races over one weekend and become one event. Seasons
// without a calendar page yet are read from Wikipedia by provisional.ts.
const SITE = 'https://www.nuerburgring-langstrecken-serie.de';
const page = (year: number) => `${SITE}/language/en/calendar-nurburgring-langstrecken-serie-${year}/`;

/** Rows of a season's calendar table: "14.03.2026" or "18.-19.04.2026" and the race. */
export function parseCalendar(html: string, year: number): MotorEvent[] {
	const events: MotorEvent[] = [];
	const row = /<td>\s*(\d{1,2})\.(?:-(\d{1,2})\.)?(\d{1,2})\.(\d{4})\s*<\/td>\s*<td>([^<]+)<\/td>/g;
	for (const [, day, lastDay, month, y, title] of html.matchAll(row)) {
		if (Number(y) !== year) continue;
		const text = decodeEntities(title).trim();
		const round = Number(text.match(/^NLS\s*(\d+)\s*:/i)?.[1]) || undefined;
		const iso = (d: string) => `${y}-${month.padStart(2, '0')}-${d.padStart(2, '0')}`;
		// "NLS1: 71. ADAC Westfalenfahrt (4h)" -> "71. ADAC Westfalenfahrt"
		const name = text.replace(/^NLS\s*\d+\s*:\s*/i, '').replace(/\s*\((?:\d+x)?\d+h\)$/i, '');
		events.push({
			id: `nls-${year}-${round ?? slugify(name)}`,
			series: 'nls',
			name,
			round,
			location: 'Nürburgring Nordschleife',
			start: iso(day),
			end: iso(lastDay ?? day),
			allDay: true,
			sessions: [],
			url: page(year)
		});
	}
	return events;
}

export const nls: Source = {
	label: 'nuerburgring-langstrecken-serie.de',
	series: ['nls'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const html = await fetchOptional(page(year));
			if (!html) continue;
			const season = parseCalendar(html, year);
			if (season.length === 0) throw new Error(`no races on the ${year} calendar`);
			events.push(...season);
		}
		return events;
	}
};
