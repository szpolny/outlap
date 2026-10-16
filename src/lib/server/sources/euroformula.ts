import type { MotorEvent, Session } from '#lib/series.ts';
import { fetchPdfText, fetchText, finalizeEvent, guessKind, makeSession, mapLimit, zonedToUtc } from '../util';
import { timeZoneFor } from '../zones';
import { circuitRow, readSeason, type Season } from './seasons';
import type { Source } from './types';
import { MONTHS } from './wikipedia';

// The Euroformula Open calendar comes from the Wikipedia season article. GT Sport, which runs
// it with the International GT Open, posts a schedule PDF per meeting for every series on the
// bill; the series site links the current season's PDFs. Each starts with the meeting's dates
// ("23 - 25 October 2026"), then per day ("Friday/Viernes, 23 October / Octubre 2026") rows of
// "09.00/09.40 40´ Euroformula Open Free practice 1" in local time.
const SITE = 'https://euroformula.gtsport.es';

const season: Season = {
	series: 'euroformula',
	article: (y) => `${y}_Euroformula_Open_Championship`,
	heading: /==\s*Race calendar\s*==/i,
	row: circuitRow('Euroformula')
};

const month = (name: string) => MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3))) + 1;

/** The meeting's days and the series' sessions from a schedule PDF's text. */
export function parseSchedule(text: string): { dates: [string, string] | null; sessions: (timeZone: string) => Session[] } {
	const head = text.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
	const iso = (y: string | number, m: number, d: string | number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	const dates: [string, string] | null = head && month(head[3])
		? [iso(head[4], month(head[3]), head[1]), iso(head[4], month(head[3]), head[2])]
		: null;
	return {
		dates,
		sessions(timeZone) {
			const sessions: Session[] = [];
			let day: [number, number, number] | null = null;
			for (const line of text.split('\n')) {
				const heading = line.match(/^[A-Za-z]+day\/[A-Za-zé]+,\s+(\d{1,2})\s+([A-Za-z]+)\s*\/\s*[A-Za-z]+\s+(\d{4})/);
				if (heading) {
					day = month(heading[2]) ? [Number(heading[3]), month(heading[2]), Number(heading[1])] : null;
					continue;
				}
				if (!day) continue;
				// "09.00/09.40 40´ Euroformula Open Free practice 1", "10.05/10.25 20´ (TV Live) Euroformula Open
				// Qualifying"; races give their number before the series: "14.10 Race – 1 Euroformula Open Standing start".
				const race = line.match(/^(\d{1,2})\.(\d{2})\s+Race\s*[–-]\s*(\d)\s+Euroformula Open\b/);
				const row = race
					? [race[0], race[1], race[2], undefined, undefined, `Race ${race[3]}`]
					: line.match(/^(\d{1,2})\.(\d{2})(?:\s*\/\s*(\d{1,2})\.(\d{2}))?\s+(?:\d+´\s+)?(?:\(TV Live\)\s+)?Euroformula Open\s+(.+)$/);
				if (!row) continue;
				const name = row[5]!.trim().replace(/^free practice/i, 'Free Practice');
				if (!/^(free practice|qualifying|race)\b/i.test(name)) continue;
				const at = (h: string, m: string) => zonedToUtc(day![0], day![1], day![2], Number(h), Number(m), timeZone);
				const session = makeSession(name.charAt(0).toUpperCase() + name.slice(1), at(row[1]!, row[2]!), race ? 30 : 40, guessKind(name));
				if (row[3] && row[4]) {
					session.end = at(row[3], row[4]);
					session.estimatedEnd = false;
				}
				sessions.push(session);
			}
			return sessions;
		}
	};
}

export const euroformula: Source = {
	label: 'euroformula.gtsport.es + Wikipedia',
	series: ['euroformula'],
	async load(years) {
		const [calendar, home] = await Promise.all([readSeason(season, years), fetchText(SITE)]);
		const urls = [...new Set(home.match(/https:\/\/gtsports-media\.s3\.[^"\\]*?schedule[^"\\]*?\.pdf/gi) ?? [])];
		const schedules = (await mapLimit(urls, 2, (url) =>
			fetchPdfText(encodeURI(url)).then((pages) => ({ url: encodeURI(url), ...parseSchedule(pages.join('\n')) }), () => null)
		)).filter((s) => s !== null);
		return calendar.map((event): MotorEvent => {
			const schedule = schedules.find((s) => s.dates && s.dates[0] <= event.end && s.dates[1] >= event.start);
			const timeZone = timeZoneFor(event.location ?? '');
			if (!schedule || !timeZone) return event;
			return finalizeEvent({ ...event, sessions: schedule.sessions(timeZone), url: schedule.url }) ?? event;
		});
	}
};
