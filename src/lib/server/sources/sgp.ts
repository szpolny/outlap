import type { MotorEvent, Session } from '#lib/series.ts';
import { fetchText, finalizeEvent, makeSession, zonedToUtc } from '../util';
import type { Source } from './types';

// fimspeedway.com is a Next.js site. The calendar page embeds the list of seasons,
// and its JSON endpoint returns each season's rounds with a local-time timetable.
const BASE = 'https://fimspeedway.com';

interface Round {
	title: string;
	slug: string;
	state: string;
	seasonOffset: number | null;
	/** local wall-clock time at the venue: "2026-05-02 19:00:00" */
	startsAt: string;
	timetable: { title: string; startTime: string; category: string }[];
	venue: { city: string; timezone: string; country: { name: string } } | null;
}

const SESSIONS: Record<string, [string, number]> = {
	QUALIFYING: ['Qualifying', 60],
	'RACING STARTS': ['Grand Prix', 180]
};

function parseRound(round: Round): MotorEvent | null {
	if (!round.venue || /cancel/i.test(round.state)) return null;
	const [date, time] = round.startsAt.split(' ');
	const [y, m, d] = date.split('-').map(Number);
	const at = (hhmm: string) => {
		const [h, min] = hhmm.split(':').map(Number);
		return zonedToUtc(y, m, d, h, min, round.venue!.timezone);
	};

	const sessions: Session[] = [];
	for (const item of round.timetable) {
		const known = item.category === 'competition' ? SESSIONS[item.title.trim().toUpperCase()] : undefined;
		if (known && /^\d{1,2}:\d{2}$/.test(item.startTime)) sessions.push(makeSession(known[0], at(item.startTime), known[1]));
	}
	// Rounds without a published timetable still have the meeting's start time.
	if (!sessions.some((s) => s.kind === 'race')) sessions.push(makeSession('Grand Prix', at(time), 180, 'race'));

	return finalizeEvent({
		id: `sgp-${round.slug}`,
		series: 'sgp',
		// "2026 DEWALT FIM Speedway GP of Poland - Wroclaw" -> "Speedway GP of Poland - Wroclaw"
		name: round.title.replace(/^.*?(?=Speedway GP)/, '').trim(),
		round: round.seasonOffset ?? undefined,
		location: `${round.venue.city}, ${round.venue.country.name}`,
		sessions,
		url: `${BASE}/rounds/${round.slug}`
	});
}

export const sgp: Source = {
	label: 'fimspeedway.com',
	series: ['sgp'],
	async load(years) {
		const html = await fetchText(`${BASE}/sgp/calendar`);
		const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
		if (!json) throw new Error('no page data on calendar page');
		const { championship, seasons } = JSON.parse(json).props.pageProps as {
			championship: { id: number };
			seasons: { id: number; title: string }[];
		};

		const events: MotorEvent[] = [];
		for (const year of years) {
			const season = seasons.find((s) => s.title === String(year));
			if (!season) continue;
			const body = await fetchText(`${BASE}/api/rounds?seasonId=${season.id}&championshipId=${championship.id}`);
			for (const round of JSON.parse(body).rounds as Round[]) {
				const event = parseRound(round);
				if (event) events.push(event);
			}
		}
		if (events.length === 0) throw new Error('no rounds found');
		return events;
	}
};
