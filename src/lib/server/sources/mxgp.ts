import type { MotorEvent } from '#lib/series.ts';
import { decodeEntities, fetchText } from '../util';
import type { Source } from './types';
import { MONTHS } from './wikipedia';

// mxgp.com's calendar switches to the next season as soon as it is announced, months before
// Wikipedia has an article for it. It gives each Grand Prix's race day without a year or start
// times, so the season is read from the year in its ticket links and races are all-day events.
// Seasons the calendar no longer shows are read from Wikipedia by provisional.ts.
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
		/<li class="[^"]*" data-id="(\d+)"><div rel=\d+>[\s\S]*?<div class="date">\s*(\d{1,2})\s+([A-Za-z]{3})\s*<\/div><div class="destination"><a [^>]*><span class="country_prefix">MXGP of\s*<\/span>([^<]*)<\/a><span class="venue_name">([^<]*)<\/span>/g;
	const events: MotorEvent[] = [];
	for (const [, category, day, month, place, venue] of html.matchAll(entry)) {
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
			url: PAGE
		});
	}
	return events;
}

export const mxgp: Source = {
	label: 'mxgp.com',
	series: ['mxgp'],
	async load(years) {
		const events = parseCalendar(await fetchText(PAGE));
		if (events.length === 0) throw new Error('no Grands Prix on calendar');
		return events.filter((e) => years.includes(Number(e.start.slice(0, 4))));
	}
};
