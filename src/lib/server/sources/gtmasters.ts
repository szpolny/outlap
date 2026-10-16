import type { MotorEvent, Session, SessionKind } from '#lib/series.ts';
import { fetchWithIntermediate } from '../certs';
import { finalizeEvent, makeSession, mapLimit, slugify } from '../util';
import type { Source } from './types';

// adac-motorsport.de is a Gatsby site; its page-data JSON has a season's events and, per event,
// the sessions with their start times (with offset). Sessions appear once the timetable is set
// and later carry the results. Events without sessions yet become all-day events.
const SITE = 'https://www.adac-motorsport.de';
const pageData = (path: string) => `${SITE}/page-data${path}page-data.json`;

interface ApiEvent {
	name: string;
	startDate: string;
	endDate: string;
	country: string | null;
}

interface ApiSession {
	name?: string;
	className?: string | null;
	date?: string;
}

const COUNTRIES: Record<string, string> = { Deutschland: 'Germany', Österreich: 'Austria', Niederlande: 'Netherlands', Belgien: 'Belgium' };

/** "1. Freies Training" -> Free Practice 1, "2. Qualifying" -> Qualifying 2, "Rennen 1" -> Race 1 */
export function sessionName(name: string): [string, SessionKind, number] | null {
	const n = name.match(/\d+/)?.[0] ?? '';
	if (/freies training/i.test(name)) return [`Free Practice ${n}`.trim(), 'practice', 60];
	if (/qualifying/i.test(name)) return [`Qualifying ${n}`.trim(), 'qualifying', 20];
	if (/rennen/i.test(name)) return [`Race ${n}`.trim(), 'race', 60];
	return null;
}

/** The event's page path: "/adac-gt-masters/race-calendar/2026/race-details/2026-10-9-hockenheimring-baden-wurttemberg/" */
const detailsPath = (e: ApiEvent) => {
	const [y, m, d] = e.startDate.slice(0, 10).split('-').map(Number);
	return `/adac-gt-masters/race-calendar/${y}/race-details/${y}-${m}-${d}-${slugify(e.name)}/`;
};

export const gtmasters: Source = {
	label: 'adac-motorsport.de',
	series: ['gtmasters'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const body = await fetchWithIntermediate(pageData(`/adac-gt-masters/race-calendar/${year}/`)).catch(() => null);
			if (!body) continue;
			const nodes: ApiEvent[] = JSON.parse(body).result.data.allContentfulEvent.group.flatMap((g: { nodes: ApiEvent[] }) => g.nodes)
				.filter((e: ApiEvent) => e.startDate.startsWith(String(year)))
				.sort((a: ApiEvent, b: ApiEvent) => a.startDate.localeCompare(b.startDate));
			const parsed = await mapLimit(nodes, 3, async (e): Promise<MotorEvent | null> => {
				const path = detailsPath(e);
				const details = await fetchWithIntermediate(pageData(path)).then((t) => JSON.parse(t).result.data.contentfulEvent, () => null);
				const sessions = ((details?.sessions ?? []) as ApiSession[])
					.filter((s) => s.date && (!s.className || /gt masters/i.test(s.className)))
					.map((s): Session | null => {
						const known = sessionName(s.name ?? '');
						return known && makeSession(known[0], s.date!, known[2], known[1]);
					})
					.filter((s): s is Session => s !== null);
				const event = {
					id: `gtmasters-${year}-${slugify(e.name)}`,
					series: 'gtmasters' as const,
					name: `GT Masters ${e.name.replace(/\s*\(.*\)$/, '')}`,
					round: nodes.indexOf(e) + 1,
					location: [e.name.replace(/\s*\(.*\)$/, ''), COUNTRIES[e.country ?? ''] ?? e.country].filter(Boolean).join(', '),
					sessions,
					url: `${SITE}${path}`
				};
				if (sessions.length > 0) return finalizeEvent(event);
				return { ...event, start: e.startDate.slice(0, 10), end: e.endDate.slice(0, 10), allDay: true };
			});
			events.push(...parsed.filter((e): e is MotorEvent => e !== null));
		}
		if (events.length === 0) throw new Error('no GT Masters events');
		return events;
	}
};
