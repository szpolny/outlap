import type { MotorEvent, Session, SessionKind } from '#lib/series.ts';
import { decodeEntities, fetchText, finalizeEvent, makeSession, mapLimit, titleCase, zonedToUtc } from '../util';
import { timeZoneFor } from '../zones';
import { MONTHS, column, dateRange } from './wikipedia';
import { joined, readSeason, round, text, type Season } from './seasons';
import type { Source } from './types';

// formulad.com's schedule page links the current season's events (/schedule/<year>/<city>); each event page has a
// schedule per day ("Friday, October 23, 2026") of "11:00AM - 12:30PM" and an activity, in the
// venue's local time. Only Formula Drift PRO events are kept, not PROAM. Practice, qualifying
// and the competition rounds become sessions; the qualifying and competition windows are
// listed as livestream times with the stage in brackets.
const SITE = 'https://www.formulad.com';

/** The Wikipedia season, for rounds whose page has no schedule and for later seasons. */
export const driftSeason: Season = {
	series: 'formuladrift',
	article: (y) => `${y}_Formula_Drift_season`,
	heading: /==\s*Schedule\s*==/i,
	row: (cells, year) => {
		const name = text(column(cells, /^title/i));
		const r = round(column(cells, /^round/i));
		if (!name || !r) return null;
		return {
			name: `Formula Drift ${name}`,
			location: joined(cells, [/^circuit/i, /^location/i]),
			round: r,
			dates: dateRange(column(cells, /^date/i) ?? '', year)
		};
	}
};

const plain = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function session(activity: string): [string, SessionKind, number] | null {
	// "LIVESTREAM: https://www.formulad.com/live (MAIN EVENT: TOP 32)" -> "MAIN EVENT: TOP 32"
	const stage = activity.match(/\(([^)]+)\)\s*$/)?.[1] ?? activity;
	// "OPENING CEREMONY + MAIN EVENT: TOP 16" is the Top 16.
	if (/top \d+|main event|competition/i.test(stage)) {
		const name = titleCase(stage.replace(/^.*?(?=top \d+)/i, '').replace(/^main event:?\s*/i, '')) || 'Competition';
		return [name, 'race', 180];
	}
	if (/autograph|box office|venue|closure|will call|ceremony|track walk|break/i.test(stage)) return null;
	if (/qualif/i.test(stage)) return ['Qualifying', 'qualifying', 180];
	if (/practice|warm.?up/i.test(stage)) return [titleCase(stage), 'practice', 90];
	return null;
}

/** The event's title, venue, address and timed sessions from its page. */
export function parseEvent(html: string): { title: string; pro: boolean; venue?: string; sessions: Session[] } {
	const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
	const title = titleCase(plain(h1.match(/<span class="mr-7[^"]*">([^<]*)</)?.[1] ?? ''));
	const pro = /role="listitem"[^>]*>\s*pro\s*</i.test(h1);
	const venue = decodeEntities(html.match(/>Track<\/h3>[\s\S]*?<img alt="([^"]*)"/)?.[1] ?? '') || undefined;
	const address = plain(html).match(/[A-Za-z .'-]+,\s*[A-Z]{2},?\s*\d{5}/)?.[0] ?? '';
	const timeZone = timeZoneFor(`${venue ?? ''}, ${address}`);
	const sessions: Session[] = [];
	if (!timeZone) return { title, pro, venue, sessions };
	for (const [, day, body] of html.matchAll(/<article role="listitem" aria-label="[A-Za-z]+, ([A-Za-z]+ \d{1,2}, \d{4})">([\s\S]*?)<\/article>/g)) {
		const [monthName, dayNumber, year] = day.replace(',', '').split(' ');
		const month = MONTHS.indexOf(monthName.toLowerCase()) + 1;
		if (!month) continue;
		for (const [, time, activity] of body.matchAll(/<time>([^<]*)<\/time>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
			const known = session(plain(activity));
			const t = time.match(/^(\d{1,2}):(\d{2})\s*([AP])M/i);
			if (!known || !t) continue;
			const hour = (Number(t[1]) % 12) + (t[3].toUpperCase() === 'P' ? 12 : 0);
			const start = zonedToUtc(Number(year), month, Number(dayNumber), hour, Number(t[2]), timeZone);
			// The published end time, where the row gives one.
			const end = time.match(/-\s*(\d{1,2}):(\d{2})\s*([AP])M/i);
			const s = makeSession(known[0], start, known[2], known[1]);
			if (end) {
				const endHour = (Number(end[1]) % 12) + (end[3].toUpperCase() === 'P' ? 12 : 0);
				s.end = zonedToUtc(Number(year), month, Number(dayNumber), endHour, Number(end[2]), timeZone);
				s.estimatedEnd = false;
			}
			sessions.push(s);
		}
	}
	// Two practice blocks the same day are numbered.
	const practice = sessions.filter((s) => s.kind === 'practice' && s.name === 'Practice');
	if (practice.length > 1) practice.forEach((s, i) => (s.name = `Practice ${i + 1}`));
	return { title, pro, venue, sessions };
}

export const formuladrift: Source = {
	label: 'formulad.com',
	series: ['formuladrift'],
	async load(years) {
		// The schedule page shows the current season only.
		const [list, wiki] = await Promise.all([fetchText(`${SITE}/schedule`), readSeason(driftSeason, years).catch(() => [])]);
		const events: MotorEvent[] = [];
		const key = (name: string) => name.toLowerCase().replace(/^formula drift\s+/, '').replace(/[^a-z0-9]/g, '');
		// "Long Beach Shoreline Showdown" in the article is "Shoreline Showdown" on the site.
		const same = (a: string, b: string) => key(a).includes(key(b)) || key(b).includes(key(a));
		for (const year of years) {
			const paths = [...new Set([...list.matchAll(new RegExp(`href="(/schedule/${year}/[a-z0-9-]+)"`, 'g'))].map((m) => m[1]))];
			const pages = await mapLimit(paths, 3, async (path) => ({ path, ...parseEvent(await fetchText(`${SITE}${path}`)) }));
			const season = wiki.filter((e) => e.start.startsWith(String(year)));
			for (const p of pages.filter((p) => p.pro && p.sessions.length > 0)) {
				const listed = season.find((e) => same(e.name, p.title));
				const event = finalizeEvent({
					id: `formuladrift-${year}-${p.path.split('/').pop()}`,
					series: 'formuladrift',
					name: `Formula Drift ${p.title}`,
					round: listed?.round,
					location: p.venue,
					sessions: p.sessions,
					url: `${SITE}${p.path}`
				});
				if (event) events.push(event);
			}
			// Rounds whose page has no schedule yet come from the season article.
			const official = events.filter((e) => e.start.startsWith(String(year)));
			if (official.length > 0) {
				events.push(...season.filter((e) => !official.some((o) => same(o.name, e.name))));
			}
		}
		return events;
	}
};
