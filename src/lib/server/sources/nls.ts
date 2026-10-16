import type { MotorEvent, Session } from '#lib/series.ts';
import { decodeEntities, fetchOptional, finalizeEvent, makeSession, slugify, zonedToUtc } from '../util';
import type { Source } from './types';

// The NLS site has a calendar page per season, a table of race days and race names such as
// "NLS1: 71. ADAC Westfalenfahrt (4h)". Start times are not published, so races are all-day
// events. The ADAC 24h Qualifiers are two races over one weekend and become one event. Seasons
// without a calendar page yet are read from Wikipedia by provisional.ts. Times are only given in
// the German preview published in the week before each race ("Das Zeittraining findet am
// Samstagmorgen von 08:30 bis 10:00 Uhr statt", "Das vierstündige Rennen wird um 12:00 Uhr
// gestartet"), read from the previews' feed. A double-header gets them for both days only when
// the preview says they apply to each day ("jeweils").
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

const FEED = `${SITE}/language/de/category/vorschau/feed/`;

interface Preview {
	published: string;
	text: string;
}

export function parseFeed(xml: string): Preview[] {
	return xml.split('<item>').slice(1).map((item) => ({
		published: new Date(item.match(/<pubDate>([^<]*)</)?.[1] ?? '').toISOString(),
		text: decodeEntities((item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ')
	})).filter((p) => !Number.isNaN(Date.parse(p.published)));
}

/** Qualifying and race times from a preview, on each of the event's days where it says so. */
export function previewSessions(text: string, event: MotorEvent): Session[] {
	const sentences = text.split(/(?<=\.)\s+/);
	const time = (h: string, m?: string) => [Number(h), Number(m ?? 0)] as const;
	let quali: { from: readonly [number, number]; to: readonly [number, number]; each: boolean } | null = null;
	let race: { at: readonly [number, number]; each: boolean } | null = null;
	for (const sentence of sentences) {
		const q = sentence.match(/Zeittraining[^.]*?(?:von|zwischen)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:Uhr\s*)?(?:bis|und)\s*(\d{1,2})(?:[:.](\d{2}))?\s*Uhr/);
		if (q && !quali) quali = { from: time(q[1], q[2]), to: time(q[3], q[4]), each: /jeweils|beiden Tagen/.test(sentence) };
		const r = sentence.match(/(?:[Rr]ennen|Startschuss|Rennstart)[^.]*?um\s*(\d{1,2})(?:[:.](\d{2}))?\s*Uhr|Um\s*(\d{1,2})(?:[:.](\d{2}))?\s*Uhr[^.]*Startschuss/);
		if (r && !race) race = { at: r[1] ? time(r[1], r[2]) : time(r[3], r[4]), each: /jeweils|beiden Tagen/.test(sentence) };
	}
	const hours = /sechsstündig|\b6h\b/i.test(`${event.name} ${text}`) ? 6 : 4;
	const days: string[] = [];
	for (let d = event.start; d <= event.end; d = new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) days.push(d);
	const sessions: Session[] = [];
	const at = (day: string, [h, m]: readonly [number, number]) => {
		const [y, mo, d] = day.split('-').map(Number);
		return zonedToUtc(y, mo, d, h, m, 'Europe/Berlin');
	};
	days.forEach((day, i) => {
		const n = days.length > 1 ? ` ${i + 1}` : '';
		if (quali && (days.length === 1 || quali.each)) {
			const s = makeSession(`Qualifying${n}`, at(day, quali.from), 90, 'qualifying');
			s.end = at(day, quali.to);
			s.estimatedEnd = false;
			sessions.push(s);
		}
		if (race && (days.length === 1 || race.each)) sessions.push(makeSession(`Race${n}`, at(day, race.at), hours * 60, 'race'));
	});
	return sessions;
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
		const previews = await fetchOptional(FEED).then((xml) => (xml ? parseFeed(xml) : []), () => []);
		return events.map((event) => {
			// The preview published in the ten days before the event.
			const preview = previews.find((p) => p.published.slice(0, 10) <= event.start &&
				Date.parse(event.start) - Date.parse(p.published) < 10 * 86_400_000);
			const sessions = preview ? previewSessions(preview.text, event) : [];
			return (sessions.length > 0 && finalizeEvent({ ...event, sessions })) || event;
		});
	}
};
