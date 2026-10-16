import type { MotorEvent, Session } from '#lib/series.ts';
import { decodeEntities, fetchOptional, fetchText, finalizeEvent, makeSession, mapLimit, slugify, zonedToUtc } from '../util';
import { timeZoneFor } from '../zones';
import { MONTHS } from './wikipedia';
import type { Source } from './types';

// nhra.com's season schedule lists every national event with its pro-class dates, venue and a
// link to the event guide on app.nhra.com. The guide has the weekend's timetable in local time,
// a day heading followed by "5:00 p.m. – Nitro Qualifying Session (Funny Car, Top Fuel)" lines.
// Only the Mission Foods series' professional sessions are kept. Events whose guide isn't out
// yet become all-day events.
const SITE = 'https://www.nhra.com';
const SERIES_PATH = /\/schedule\/\d{4}\/nhra-(?:mission-foods|mello-yello|camping-world)-drag-racing-series\//;

interface Meeting {
	name: string;
	path: string;
	venue: string;
	address: string;
	start: string;
	end: string;
	guide?: string;
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const text = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

export function parseSchedule(html: string): Meeting[] {
	const meetings: Meeting[] = [];
	for (const row of html.split('class="views-row"').slice(1)) {
		const link = row.match(/property="name"><a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
		const start = row.match(/property="startDate" content="(\d{4}-\d{2}-\d{2})/)?.[1];
		const end = row.match(/property="endDate" content="(\d{4}-\d{2}-\d{2})/)?.[1];
		if (!link || !start || !end || !SERIES_PATH.test(link[1])) continue;
		const field = (name: string) => text(row.match(new RegExp(`property="${name}"[^>]*>([^<]*)<`))?.[1] ?? '');
		meetings.push({
			name: decodeEntities(link[2]).trim(),
			path: link[1],
			venue: text(row.match(/schedule__location--name" property="name">([^<]*)</)?.[1] ?? ''),
			address: [field('addressLocality'), field('addressRegion')].filter(Boolean).join(', '),
			start,
			end,
			guide: row.match(/href="(https:\/\/app\.nhra\.com\/[^"]+)"[^>]*>Event Guide</)?.[1]
		});
	}
	return meetings;
}

const PRO = /nitro|top fuel|funny car|pro stock|mission foods/i;
const DAY = /^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s+([A-Za-z]+)\.?\s+(\d{1,2})/;

/** Professional sessions from an event guide, in the venue's time zone. */
export function parseGuide(html: string, meeting: Meeting, timeZone: string): Session[] {
	const sessions: Session[] = [];
	const year = Number(meeting.start.slice(0, 4));
	let date: [number, number] | null = null;
	const counts = new Map<string, number>();
	// Day headings are bold paragraphs; each line of the day is a list item.
	for (const [, tag, body] of html.matchAll(/<(strong|li)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
		const line = text(body);
		const day = line.match(DAY);
		if (tag === 'strong' && day) {
			const month = MONTHS.findIndex((m) => m.startsWith(day[1].toLowerCase().slice(0, 3))) + 1;
			date = month ? [month, Number(day[2])] : null;
			continue;
		}
		const entry = line.match(/^(\d{1,2})(?::(\d{2}))?(?:\s*[-–]\s*\d{1,2}(?::\d{2})?)?\s*([ap])\.m\.\s*[-–]\s*(.+)$/i);
		if (tag !== 'li' || !entry || !date) continue;
		const name = entry[4].replace(/\s+session\b/i, '').trim();
		if (!PRO.test(name) || /top alcohol|factory stock|autograph|introductions|track walk/i.test(name)) continue;
		const kind = /eliminations|final/i.test(name) ? 'race' : /qualifying/i.test(name) ? 'qualifying' : null;
		if (!kind) continue;
		const hour = (Number(entry[1]) % 12) + (entry[3].toLowerCase() === 'p' ? 12 : 0);
		// The guide repeats a class's qualifying session name; number them.
		const base = kind === 'race' ? 'Eliminations' : name.replace(/\s*\(.*\)$/, '');
		const n = (counts.get(base) ?? 0) + 1;
		counts.set(base, n);
		const start = zonedToUtc(year, date[0], date[1], hour, Number(entry[2] ?? 0), timeZone);
		sessions.push(makeSession(kind === 'race' ? base : `${base} ${n}`, start, kind === 'race' ? 240 : 45, kind));
	}
	return sessions;
}

export const nhra: Source = {
	label: 'nhra.com',
	series: ['nhra'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const html = await fetchOptional(`${SITE}/schedule/${year}`);
			if (!html) continue;
			const meetings = parseSchedule(html).filter((m) => m.start.startsWith(String(year)));
			const parsed = await mapLimit(meetings, 3, async (m): Promise<MotorEvent | null> => {
				const timeZone = timeZoneFor(`${m.venue}, ${m.address}`);
				// Some guide links carry no year and still show last season's guide: keep only
				// sessions within the event's days.
				const within = (s: Session) => s.start.slice(0, 10) >= addDays(m.start, -1) && s.start.slice(0, 10) <= addDays(m.end, 1);
				const sessions = m.guide && timeZone
					? await fetchText(m.guide).then((guide) => parseGuide(guide, m, timeZone).filter(within), () => [])
					: [];
				const event = {
					id: `nhra-${year}-${slugify(m.path.split('/').pop() ?? m.name)}`,
					series: 'nhra' as const,
					name: m.name,
					location: m.venue || undefined,
					sessions,
					url: `${SITE}${m.path}`
				};
				if (sessions.length > 0) return finalizeEvent(event);
				return { ...event, start: m.start, end: m.end, allDay: true };
			});
			events.push(...parsed.filter((e): e is MotorEvent => e !== null));
		}
		return events;
	}
};
