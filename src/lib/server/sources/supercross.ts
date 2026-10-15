import type { MotorEvent, Session } from '#lib/series.ts';
import { decodeEntities, fetchText, finalizeEvent, makeSession, mapLimit, zonedToUtc } from '../util';
import type { Source } from './types';
import { MONTHS } from './wikipedia';

// supercrosslive.com lists the next season of SuperMotocross on its tickets page: each round's
// city, date, venue and time zone. Supercross rounds link to a page with an event schedule
// ("4 p.m. PT  Main Event"); practice and qualifying times are not published there, so the
// schedule gives the opening ceremonies and the night show. Rounds without a schedule (or whose
// page redirects to a venue's own site) become all-day events. Earlier seasons, which the site
// no longer lists, are read from Wikipedia by provisional.ts.
const SITE = 'https://www.supercrosslive.com';

export interface Round {
	round: number;
	city: string;
	venue: string;
	date: string;
	timeZone: string;
	url?: string;
}

const text = (s: string) => decodeEntities(s).trim();

/** Supercross rounds on the tickets page; the Pro Motocross rounds listed after them are left out. */
export function parseTickets(html: string): Round[] {
	const rounds: Round[] = [];
	for (const block of html.split('<div class="ticket">').slice(1)) {
		const title = block.match(/ticket-info__title">\s*<div>\s*Round\s+(\d+)\s*<\/div>\s*<div>([^<]*)<\/div>\s*<div>\s*([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})\s*<\/div>/);
		const classes = block.match(/ticket-info__classes"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
		const timeZone = block.match(/[?&](?:amp;|#038;)?timezone=([A-Za-z_%0-9]+)/)?.[1];
		if (!title || !/\d+SX\b/.test(classes) || !timeZone) continue;
		const [, round, city, month, day, year] = title;
		const m = MONTHS.findIndex((name) => name.startsWith(month.toLowerCase())) + 1;
		if (m === 0) continue;
		rounds.push({
			round: Number(round),
			city: text(city).replace(/,\s*[A-Z]{2}$/, ''),
			venue: text(block.match(/ticket-info__venue">\s*<div>([^<]*)<\/div>/)?.[1] ?? ''),
			date: `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`,
			timeZone: decodeURIComponent(timeZone),
			url: block.match(/href="(https:\/\/www\.supercrosslive\.com\/tickets\/[^"]+\/)"/)?.[1]
		});
	}
	return rounds;
}

const LENGTHS: [RegExp, number][] = [
	[/opening ceremon/i, 30],
	[/main event|night show/i, 180]
];

/** The opening ceremonies and night show from a round page; fan activities are left out. */
export function parseSchedule(html: string, round: Round): Session[] {
	const [y, mo, d] = round.date.split('-').map(Number);
	const sessions: Session[] = [];
	const item = /<div class="item-time">\s*([^<]*?)\s*<\/div>\s*<div class="item-title">\s*([^<]*?)\s*<\/div>/g;
	for (const [, time, title] of html.matchAll(item)) {
		const name = text(title);
		const length = LENGTHS.find(([pattern]) => pattern.test(name))?.[1];
		// "4 p.m. PT" or "3:30 p.m. PT"; ranges such as "9 a.m. - 3 p.m. PT" are fan activities.
		const m = time.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\s*[A-Z]{1,3}$/i);
		if (!length || !m) continue;
		const hour = (Number(m[1]) % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
		const start = zonedToUtc(y, mo, d, hour, Number(m[2] ?? 0), round.timeZone);
		sessions.push(makeSession(name, start, length, /main event|night show/i.test(name) ? 'race' : 'other'));
	}
	return sessions;
}

export const supercross: Source = {
	label: 'supercrosslive.com',
	series: ['supercross'],
	async load(years) {
		const rounds = parseTickets(await fetchText(`${SITE}/tickets/`));
		if (rounds.length === 0) throw new Error('no rounds on tickets page');
		return mapLimit(
			rounds.filter((r) => years.includes(Number(r.date.slice(0, 4)))),
			2,
			async (r): Promise<MotorEvent> => {
				const event = {
					id: `supercross-${r.date.slice(0, 4)}-${r.round}`,
					series: 'supercross' as const,
					name: `Supercross ${r.city}`,
					round: r.round,
					location: [r.venue, r.city].filter(Boolean).join(', '),
					sessions: [] as Session[],
					url: r.url ?? `${SITE}/tickets/`
				};
				if (r.url) {
					try {
						event.sessions = parseSchedule(await fetchText(r.url), r);
					} catch (error) {
						console.warn(`[supercross] round ${r.round} page unavailable:`, error instanceof Error ? error.message : error);
					}
				}
				return finalizeEvent(event) ?? { ...event, start: r.date, end: r.date, allDay: true };
			}
		);
	}
};
