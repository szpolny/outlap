import type { MotorEvent, Session } from '#lib/series.ts';
import { fetchOptional, fetchText, finalizeEvent, makeSession, mapLimit, titleCase, zonedToUtc } from '../util';
import { JAPAN_TZ, findCircuit, isoDay } from './japan';
import type { Source } from './types';

// superformula.net (Japanese only) has a calendar page per season linking to a page per
// meeting with its timetable. Most meetings are double-headers, so session names carry the
// round. Meetings without a published timetable become all-day events; tests are skipped.
const BASE = 'https://superformula.net/sf3';

interface Meeting {
	id: string;
	rounds: number[];
	/** "FUJI SPEEDWAY" */
	venue: string;
	/** inclusive YYYY-MM-DD */
	from: string;
	to: string;
}

function parseCalendar(html: string, year: number): Meeting[] {
	const meetings: Meeting[] = [];
	for (const item of html.split('<!-- start -->').slice(1)) {
		const id = item.match(/\/sf3\/race\/(\d+)\//)?.[1];
		const label = item.match(/box_txt01">\s*([^<]*)/)?.[1].trim() ?? '';
		// "10月09日(金) ~ 11日(日)"; a meeting running into the next month names it again.
		const dates = item.match(/inner01_txt01">\s*(\d{1,2})月(\d{1,2})日[^~]*~\s*(?:(\d{1,2})月)?(\d{1,2})日/);
		const venue = item.match(/<span class="en">([^<]*)/)?.[1].trim() ?? '';
		if (!id || !dates || !/^Rd\./.test(label)) continue;
		const [, fromMonth, fromDay, toMonth, toDay] = dates.map(Number);
		meetings.push({
			id,
			rounds: label.replace(/^Rd\./, '').split('-').map(Number),
			venue,
			from: isoDay(year, fromMonth, fromDay),
			to: isoDay(year, toMonth || (toDay < fromDay ? fromMonth + 1 : fromMonth), toDay)
		});
	}
	return meetings;
}

/** "Rd.9 予選Q1 GrA" -> ["Round 9 Qualifying 1 Group A", 10]; null for non-racing items. */
function translate(name: string, prefixRound: boolean): [string, number] | null {
	const fp = name.match(/FP(\d)/);
	if (fp) return [`Free Practice ${fp[1]}`, 60];
	const round = name.match(/Rd\.\s*(\d+)/)?.[1];
	const prefix = round && prefixRound ? `Round ${round} ` : '';
	const q = name.match(/予選\s*Q(\d)(?:\s*Gr\.?\s*([A-Z]))?/);
	if (q) return [`${prefix}Qualifying ${q[1]}${q[2] ? ` Group ${q[2]}` : ''}`, 10];
	if (/決勝/.test(name)) return [`${prefix}Race`, 75];
	return null;
}

function parseMeetingPage(html: string, meeting: Meeting, year: number): MotorEvent | null {
	const sessions: Session[] = [];
	const multi = meeting.rounds.length > 1;
	for (const [, month, day, body] of html.matchAll(/<caption>\s*(\d{1,2})\.(\d{1,2})[\s\S]*?<\/caption>([\s\S]*?)<\/table>/g)) {
		for (const [, time, cell] of body.matchAll(/<th>([^<]*)<\/th>\s*<td>([\s\S]*?)<\/td>/g)) {
			const translated = translate(cell.replace(/<[^>]+>/g, '').trim(), multi);
			// "15:00-[41周/最大75分]" (laps / at most 75 minutes) or "11:00-12:00"
			const t = time.match(/(\d{1,2}):(\d{2})\s*[-~～]\s*(?:(\d{1,2}):(\d{2}))?/);
			if (!translated || !t) continue;
			const at = (h: string, m: string) => zonedToUtc(year, Number(month), Number(day), Number(h), Number(m), JAPAN_TZ);
			const maxMinutes = time.match(/最大(\d+)分/)?.[1];
			const session = makeSession(translated[0], at(t[1], t[2]), maxMinutes ? Number(maxMinutes) : translated[1]);
			if (t[3]) {
				session.end = at(t[3], t[4]);
				session.estimatedEnd = false;
			}
			sessions.push(session);
		}
	}

	const circuit = findCircuit(meeting.venue);
	const rounds = meeting.rounds;
	const roundList = rounds.length > 2 ? `${rounds.slice(0, -1).join(', ')} & ${rounds.at(-1)}` : rounds.join(' & ');
	const venueName = circuit?.name ?? titleCase(meeting.venue);
	const event = {
		id: `superformula-${year}-${meeting.id}`,
		series: 'superformula' as const,
		name: multi ? `${venueName} (Rounds ${roundList})` : venueName,
		round: multi ? undefined : rounds[0],
		location: circuit?.place,
		sessions,
		url: `${BASE}/race/${meeting.id}/`
	};
	if (sessions.length > 0) return finalizeEvent(event);
	return { ...event, start: meeting.from, end: meeting.to, allDay: true };
}

export const superformula: Source = {
	label: 'superformula.net',
	series: ['superformula'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const html = await fetchOptional(`${BASE}/race_taxonomy/${year}`);
			if (!html) continue;
			const meetings = parseCalendar(html, year);
			const parsed = await mapLimit(meetings, 4, async (meeting) =>
				parseMeetingPage(await fetchText(`${BASE}/race/${meeting.id}/`), meeting, year)
			);
			events.push(...parsed.filter((e): e is MotorEvent => e !== null));
		}
		if (events.length === 0) throw new Error('no rounds found on calendar page');
		return events;
	}
};
