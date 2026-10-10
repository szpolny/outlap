import type { MotorEvent, SeriesId, Session } from '#lib/series.ts';
import { decodeEntities, fetchText, finalizeEvent, guessKind, makeSession, mapLimit, zonedToUtc } from '../util';
import type { Source } from './types';

// indycar.com and indynxt.com share a CMS. Each event page has a schedule table:
//   <h3>Friday, Aug 7</h3> ... schedule-time">4:30PM ET ... schedule-description">INDY NXT - Practice 1

const ZONES: Record<string, string> = {
	ET: 'America/New_York',
	CT: 'America/Chicago',
	MT: 'America/Denver',
	PT: 'America/Los_Angeles'
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

interface Config {
	series: Extract<SeriesId, 'indycar' | 'indynxt'>;
	base: string;
	prefix: string;
	raceMinutes: number;
	qualifyingMinutes: number;
}

function durationFor(name: string, cfg: Config, eventName: string): number {
	const kind = guessKind(name);
	if (kind === 'race') return /500/.test(eventName) ? 195 : cfg.raceMinutes;
	if (kind === 'qualifying') return cfg.qualifyingMinutes;
	return 60;
}

function parsePage(html: string, year: number, cfg: Config): { name: string; sessions: Session[] } {
	const name = decodeEntities(html.match(/<h1 class="headline">([^<]+)/)?.[1] ?? '');
	const sessions: Session[] = [];
	const table = html.slice(html.indexOf('schedule-table'));
	const tokens = table.matchAll(
		/<h3>([^<]+)<\/h3>|schedule-time">([^<]+)<|schedule-description">([^<]+)</g
	);
	let date: { month: number; day: number } | null = null;
	let time: string | null = null;
	for (const [, h3, t, desc] of tokens) {
		if (h3) {
			const m = h3.match(/^\w+day,\s*([A-Za-z]{3})\w*\s+(\d{1,2})/);
			date = m ? { month: MONTHS.indexOf(m[1].toLowerCase()) + 1, day: Number(m[2]) } : null;
		} else if (t) {
			time = t.trim();
		} else if (desc && date && time) {
			const label = decodeEntities(desc);
			const tm = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*([ECMP]T)$/i);
			time = null;
			if (!label.toUpperCase().startsWith(cfg.prefix) || !tm || date.month === 0) continue;
			let hour = Number(tm[1]) % 12;
			if (tm[3].toUpperCase() === 'PM') hour += 12;
			const start = zonedToUtc(year, date.month, date.day, hour, Number(tm[2]), ZONES[tm[4].toUpperCase()]);
			const sessionName = label.slice(cfg.prefix.length).replace(/^\s*-\s*/, '').trim();
			sessions.push(makeSession(sessionName, start, durationFor(sessionName, cfg, name)));
		}
	}
	return { name, sessions };
}

function indySource(cfg: Config): Source {
	return {
		label: new URL(cfg.base).hostname.replace(/^www\./, ''),
		series: [cfg.series],
		async load(years) {
			const index = await fetchText(`${cfg.base}/Schedule`);
			const paths = new Set<string>();
			for (const m of index.matchAll(/href="(?:https:\/\/www\.[a-z]+\.com)?(\/Schedule\/(\d{4})\/[A-Za-z0-9-]+)"/g)) {
				if (years.includes(Number(m[2]))) paths.add(m[1]);
			}
			if (paths.size === 0) throw new Error('no event pages found on schedule page');

			const pages = await mapLimit([...paths], 4, async (path) => {
				const year = Number(path.split('/')[2]);
				return { path, year, ...parsePage(await fetchText(cfg.base + path), year, cfg) };
			});

			// Doubleheaders get one page per race ("Mid-Ohio-Race1/2") that each list the whole weekend.
			const weekends = new Map<string, (typeof pages)[number][]>();
			for (const p of pages) {
				const key = p.path.replace(/-Race\d+$/i, '');
				weekends.set(key, [...(weekends.get(key) ?? []), p]);
			}

			const events: MotorEvent[] = [];
			for (const [key, group] of weekends) {
				const seen = new Set<string>();
				const sessions = group
					.flatMap((p) => p.sessions)
					.filter((s) => !seen.has(s.name + s.start) && seen.add(s.name + s.start));
				const event = finalizeEvent({
					id: `${cfg.series}-${key.split('/').slice(2).join('-').toLowerCase()}`,
					series: cfg.series,
					name: group[0].name || key.split('/').pop()!.replace(/-/g, ' '),
					sessions,
					url: cfg.base + group[0].path
				});
				if (event) events.push(event);
			}
			return events.sort((a, b) => a.start.localeCompare(b.start));
		}
	};
}

export const indycar = indySource({
	series: 'indycar',
	base: 'https://www.indycar.com',
	prefix: 'NTT INDYCAR SERIES',
	raceMinutes: 120,
	qualifyingMinutes: 75
});

export const indynxt = indySource({
	series: 'indynxt',
	base: 'https://www.indynxt.com',
	prefix: 'INDY NXT',
	raceMinutes: 60,
	qualifyingMinutes: 45
});
