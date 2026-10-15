import type { MotorEvent, Session, SessionKind } from '#lib/series.ts';
import { decodeEntities, fetchOptional, fetchText, finalizeEvent, guessKind, makeSession, mapLimit, zonedToUtc } from '../util';
import type { Source } from './types';
import { MONTHS } from './wikipedia';

// The official BSB site: a season's calendar page lists the rounds with their dates, and each
// round page has a timetable of BSB sessions only, in local time with a weekday and no date.
// End times are not published. Rounds without a timetable yet become all-day events. Seasons
// the site has no calendar for yet are read from Wikipedia by provisional.ts.
const SITE = 'https://www.britishsuperbike.com';

export interface Round {
	path: string;
	round: number;
	circuit: string;
	layout: string;
	start: string;
	end: string;
}

const text = (s: string) => decodeEntities(s).trim();

/** "16 - 18 Oct" or "31 Jul - 02 Aug" in the given season. */
export function roundDates(text: string, year: number): [string, string] | null {
	const m = text.match(/^(\d{1,2})(?:\s+([A-Za-z]{3}))?\s*-\s*(\d{1,2})\s+([A-Za-z]{3})$/);
	if (!m) return null;
	const month = (abbr: string) => MONTHS.findIndex((name) => name.startsWith(abbr.toLowerCase())) + 1;
	const iso = (day: string, abbr: string) => {
		const n = month(abbr);
		return n > 0 ? `${year}-${String(n).padStart(2, '0')}-${day.padStart(2, '0')}` : null;
	};
	const [start, end] = [iso(m[1], m[2] ?? m[4]), iso(m[3], m[4])];
	return start && end ? [start, end] : null;
}

/** Championship rounds on a season's calendar page; official tests are left out. */
export function parseCalendar(html: string, year: number): Round[] {
	const rounds: Round[] = [];
	// Each card also has an "Event Details" button to its round, so only the card's own link counts.
	const card = /class="card round-info[^"]*"><a href="(\/calendar\/\d{4}\/r\d+-[^"]+)"[^>]*>\s*(?:<div class="overlay[^"]*"><\/div>)?\s*<div class="card-divider"><div class="header">\s*Round\s+(\d+)\s*<\/div>[\s\S]*?<h3>([^<]*)<\/h3>\s*<h3>([^<]*)<\/h3>\s*<p>([^<]*)<\/p>/g;
	for (const [, path, round, dates, circuit, layout] of html.matchAll(card)) {
		const range = roundDates(text(dates), year);
		if (!range) continue;
		rounds.push({ path, round: Number(round), circuit: text(circuit), layout: text(layout), start: range[0], end: range[1] });
	}
	return rounds;
}

const SESSIONS: [RegExp, string, SessionKind, number][] = [
	[/pre.?qualifying/i, 'Pre Qualifying', 'qualifying', 20],
	[/qualifying\s*(\d)/i, 'Qualifying $1', 'qualifying', 15],
	[/free practice\s*1/i, 'Free Practice 1', 'practice', 60],
	[/free practice\s*(\d)/i, 'Free Practice $1', 'practice', 30],
	[/warm.?up/i, 'Warm Up', 'practice', 10],
	[/race\s*(\d)/i, 'Race $1', 'race', 30]
];

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Assen is the only round abroad. Labels such as "CET" in September are not exact offsets. */
const timeZone = (circuit: string) => (/assen/i.test(circuit) ? 'Europe/Amsterdam' : 'Europe/London');

/** Timed sessions on a round page; gate openings and times still "TBC" are skipped. */
export function parseTimetable(html: string, round: Round): Session[] {
	const sessions: Session[] = [];
	const row = /<strong>\s*([A-Za-z]{3})\w*\s*<\/strong>[\s\S]*?<span>([^<]*)<\/span>[\s\S]*?class="time">\s*(\d{1,2}):(\d{2})/g;
	for (const [, weekday, title, hour, minute] of html.matchAll(row)) {
		const name = text(title);
		if (/gates? open/i.test(name)) continue;
		const day = dayOf(round, WEEKDAYS.indexOf(weekday.toLowerCase()));
		if (!day) continue;
		const [y, m, d] = day.split('-').map(Number);
		const start = zonedToUtc(y, m, d, Number(hour), Number(minute), timeZone(round.circuit));
		// Sponsor names are dropped: "ROKiT Oxygen Performance Qualifying 1" -> "Qualifying 1".
		const known = SESSIONS.map(([pattern, label, kind, minutes]) => [name.match(pattern), label, kind, minutes] as const)
			.find(([match]) => match);
		sessions.push(
			known
				? makeSession(known[1].replace('$1', known[0]![1] ?? ''), start, known[3], known[2])
				: makeSession(name, start, 30, guessKind(name))
		);
	}
	return sessions;
}

/** The date within a round's days that falls on the weekday. */
function dayOf(round: Round, weekday: number): string | null {
	if (weekday < 0) return null;
	for (let t = Date.parse(round.start); t <= Date.parse(round.end); t += 86_400_000) {
		if (new Date(t).getUTCDay() === weekday) return new Date(t).toISOString().slice(0, 10);
	}
	return null;
}

/** "Brands Hatch (GP Circuit)", which venues.ts uses to pick the layout's outline. */
const location = (r: Round) => (r.layout ? `${r.circuit} (${r.layout.replace(/\s*circuit$/i, '')} Circuit)` : r.circuit);

export const bsb: Source = {
	label: 'British Superbikes official site',
	series: ['bsb'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const html = await fetchOptional(`${SITE}/calendar/${year}`);
			if (!html) continue;
			const rounds = parseCalendar(html, year);
			if (rounds.length === 0) throw new Error(`no rounds on the ${year} calendar`);
			events.push(
				...(await mapLimit(rounds, 4, async (r) => {
					const url = `${SITE}${r.path}`;
					const event = {
						id: `bsb-${year}-${r.round}`,
						series: 'bsb' as const,
						name: `BSB ${r.circuit}`,
						round: r.round,
						location: location(r),
						sessions: parseTimetable(await fetchText(url), r),
						url
					};
					return finalizeEvent(event) ?? { ...event, start: r.start, end: r.end, allDay: true };
				}))
			);
		}
		return events;
	}
};
