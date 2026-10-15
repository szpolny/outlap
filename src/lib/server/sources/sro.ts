import type { MotorEvent, SeriesId, Session } from '#lib/series.ts';
import { MONTHS } from './wikipedia';
import { decodeEntities, fetchText, finalizeEvent, guessKind, mapLimit, slugify } from '../util';
import type { Source } from './types';

// SRO runs each championship on its own site with the same layout. The calendar page lists the
// current season's meetings, and each meeting page has a timetable per day giving local and GMT
// times. Only the series' own sessions are listed. Test days are skipped; meetings without a
// timetable on the page (GTWC America only publishes PDFs) become all-day events.

type SroSeries = Extract<SeriesId, 'gtwce' | 'gtwca' | 'gtwcasia' | 'igtc'>;

const SITES: Record<SroSeries, string> = {
	gtwce: 'https://www.gt-world-challenge-europe.com',
	gtwca: 'https://www.gt-world-challenge-america.com',
	gtwcasia: 'https://www.gt-world-challenge-asia.com',
	igtc: 'https://www.intercontinentalgtchallenge.com'
};

const MINUTES: [RegExp, number][] = [
	[/24 hours|24h/i, 24 * 60],
	[/12 hour/i, 12 * 60],
	[/8 hour/i, 8 * 60],
	[/1000\s*km/i, 6 * 60],
	[/6 hour/i, 6 * 60],
	[/3 hour|endurance|main race/i, 3 * 60],
	[/race/i, 60],
	[/qualifying/i, 15],
	[/practice|session/i, 60]
];

interface Meeting {
	path: string;
	name: string;
	round?: string;
	country: string;
	/** inclusive YYYY-MM-DD */
	from: string;
	to: string;
}

function isoDate(day: string, month: string, year: string): string | null {
	const m = MONTHS.indexOf(month.toLowerCase()) + 1;
	return m === 0 ? null : `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

const MARKS: Record<string, string> = { uml: '\u0308', acute: '\u0301', grave: '\u0300', circ: '\u0302', tilde: '\u0303', cedil: '\u0327', ring: '\u030a' };

/** decodeEntities plus the accented letters in venue names ("N&uuml;rburgring"). */
function decode(s: string): string {
	return decodeEntities(
		s.replace(/&([a-z])(uml|acute|grave|circ|tilde|cedil|ring);/gi, (_, letter, mark) => letter + MARKS[mark]).replace(/&szlig;/g, 'ß')
	).normalize('NFC');
}

const plain = (html: string) => decode(html.replace(/<[^>]*>/g, ' '));

/**
 * Past meetings read "28 - 31 May 2026" or "30 July 2026 - 2 August 2026"; the next meeting is
 * a banner with separate day, month and year fields.
 */
function parseDates(chunk: string): [string, string] | null {
	const piped = plain(chunk).match(/(\d{1,2})(?:\s+([A-Za-z]+))?(?:\s+(\d{4}))?\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
	if (piped) {
		const [, d1, m1, y1, d2, m2, y2] = piped;
		const from = isoDate(d1, m1 ?? m2, y1 ?? y2);
		const to = isoDate(d2, m2, y2);
		if (from && to) return [from, to];
	}
	const banner = [...chunk.matchAll(/date-number">(\d+)<\/span>\s*<span class="calendar__date-month">(\w+)<\/span>\s*<span class="calendar__date-year">(\d{4})/g)]
		.map(([, day, month, year]) => {
			const m = MONTHS.findIndex((name) => name.startsWith(month.toLowerCase())) + 1;
			return m === 0 ? null : `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
		});
	if (banner[0] && banner.at(-1)) return [banner[0], banner.at(-1)!];
	return null;
}

export function parseCalendar(html: string): Meeting[] {
	const meetings: Meeting[] = [];
	// Each meeting's details come before its "Event Info" link.
	const links = [...html.matchAll(/<a class="link-button[^"]*" href="(\/event\/\d+\/[^"]+)">/g)];
	let from = 0;
	for (const link of links) {
		let chunk = html.slice(from, link.index);
		from = link.index + link[0].length;
		chunk = chunk.slice(Math.max(0, chunk.lastIndexOf('past-events__list-item"'), chunk.lastIndexOf('calendar__list-item ')));
		const name = chunk.match(/calendar__race-header">([^<]*)</)?.[1] ?? chunk.match(/<strong>([^<]*)<\/strong>/)?.[1];
		const country = chunk.match(/<\/strong>\s*([^<]*)</)?.[1] ?? chunk.match(/calendar__race-subheading-text">([^<]*)</)?.[1];
		const text = plain(chunk);
		const dates = parseDates(chunk);
		// Test days and off-track events such as the season gala have no round.
		if (!name || !dates || !/Round \d/.test(text) || /prologue/i.test(name)) continue;
		meetings.push({
			path: link[1],
			name: decode(name),
			round: text.match(/Round (\d+)/)?.[1],
			country: decode(country ?? ''),
			from: dates[0],
			to: dates[1]
		});
	}
	return meetings;
}

/**
 * Sessions from the meeting page. Captions read "Saturday, 30 May"; rows give the session, the
 * local time and GMT. The local date and the offset between the two times give the UTC instant.
 */
export function parseTimetable(html: string, meeting: Meeting): Session[] {
	const sessions: Session[] = [];
	const year = Number(meeting.from.slice(0, 4));
	const tables = html.matchAll(/timetable__caption">\s*<span>([^<]*)<\/span>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/g);
	for (const [, caption, body] of tables) {
		const day = caption.match(/(\d{1,2})\s+([A-Za-z]+)/);
		if (!day) continue;
		// A meeting over New Year runs into the next year.
		const newYear = meeting.from.slice(5, 7) === '12' && /^jan/i.test(day[2]);
		const date = isoDate(day[1], day[2], String(newYear ? year + 1 : year));
		if (!date) continue;
		for (const [, row] of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
			const [name, local, gmt] = [...row.matchAll(/<td>([^<]*)<\/td>/g)].map((m) => decode(m[1]));
			if (!name || !/^\d{1,2}:\d{2}$/.test(local ?? '') || !/^\d{1,2}:\d{2}$/.test(gmt ?? '')) continue;
			// "Qualifying Combined" is the aggregate of the separate qualifying sessions, not a session.
			// Paid and bronze test sessions are optional private running.
			if (/combined|parade|autograph|pit walk|\btest\b|\bafter\b/i.test(name)) continue;
			const minutes = (t: string) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
			// Local time minus GMT, wrapped into -12h..+14h.
			let offset = minutes(local) - minutes(gmt);
			if (offset > 14 * 60) offset -= 24 * 60;
			if (offset < -12 * 60) offset += 24 * 60;
			const start = new Date(Date.parse(`${date}T${local.padStart(5, '0')}:00Z`) - offset * 60_000).toISOString();
			// Endurance races take their length from the meeting ("24 Hours of Spa", "Main Race").
			const kind = guessKind(name);
			const label = kind === 'race' ? `${meeting.name} ${name}` : name;
			const duration = MINUTES.find(([match]) => match.test(label))?.[1] ?? 60;
			sessions.push({
				name,
				kind,
				start,
				end: new Date(Date.parse(start) + duration * 60_000).toISOString(),
				estimatedEnd: true
			});
		}
	}
	return sessions;
}

function sroSource(series: SroSeries): Source {
	const site = SITES[series];
	return {
		label: new URL(site).hostname.replace(/^www\./, ''),
		series: [series],
		async load(years) {
			const meetings = parseCalendar(await fetchText(`${site}/calendar`)).filter((m) =>
				years.includes(Number(m.from.slice(0, 4)))
			);
			if (meetings.length === 0) throw new Error('no meetings in calendar');
			const events = await mapLimit(meetings, 3, async (m): Promise<MotorEvent | null> => {
				const url = `${site}${encodeURI(decodeURI(m.path))}`;
				const sessions = parseTimetable(await fetchText(url), m);
				const round = Number(m.round?.match(/\d+/)?.[0]);
				const event = {
					id: `${series}-${m.from.slice(0, 4)}-${slugify(m.name)}`,
					series,
					name: m.name.replace(/\s*\(SRO GT PowerTour\)/i, ''),
					round: Number.isInteger(round) ? round : undefined,
					location: m.country || undefined,
					sessions,
					url
				};
				if (sessions.length > 0) return finalizeEvent(event);
				return { ...event, start: m.from, end: m.to, allDay: true };
			});
			return events.filter((e): e is MotorEvent => e !== null);
		}
	};
}

export const gtwce = sroSource('gtwce');
export const gtwca = sroSource('gtwca');
export const gtwcasia = sroSource('gtwcasia');
export const igtc = sroSource('igtc');
