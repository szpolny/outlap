import type { MotorEvent, SeriesId, Session, SessionKind } from '#lib/series.ts';
import { addMinutes, fetchText, finalizeEvent, mapLimit } from '../util';
import type { Source } from './types';

// The official WorldSBK (Pulselive) API: a season's rounds, then each round's sessions for every
// class. WorldSBK and WorldSSP are kept; WorldSSP shares every WorldSBK round. Races have no
// published end time. Rounds without sessions yet become all-day events.
const API = 'https://api.pulselive.worldsbk.com/wsbk-events/v1';

interface ApiRound {
	id: string;
	attributes: {
		name: string;
		description: string;
		source_id: string;
		start_date: string;
		end_date: string;
		sequence_order: number;
		status: string;
	};
	relationships: { circuit: { data: { id: string } } };
}

interface ApiSession {
	attributes: { short_name: string; start_date_utc: string; end_date_utc: string | null };
	relationships: { category: { data: { id: string } } };
}

interface ApiCircuit {
	type: string;
	id: string;
	attributes: { locality: string | null };
}

type Class = Extract<SeriesId, 'worldsbk' | 'worldssp'>;

/** The API's category for each class. */
const CATEGORIES: Record<Class, string> = { worldsbk: 'SBK', worldssp: 'SSP' };

const SESSIONS: Record<Class, Record<string, [string, SessionKind, number]>> = {
	worldsbk: {
		FP1: ['Free Practice 1', 'practice', 45],
		FP2: ['Free Practice 2', 'practice', 45],
		FP3: ['Free Practice 3', 'practice', 20],
		SP: ['Superpole', 'qualifying', 15],
		WUP: ['Warm Up', 'practice', 10],
		RC1: ['Race 1', 'race', 40],
		SPRC: ['Superpole Race', 'sprint', 20],
		RC2: ['Race 2', 'race', 40]
	},
	worldssp: {
		FP: ['Free Practice', 'practice', 40],
		SP: ['Superpole', 'qualifying', 40],
		WUP1: ['Warm Up 1', 'practice', 10],
		WUP2: ['Warm Up 2', 'practice', 10],
		RC1: ['Race 1', 'race', 35],
		RC2: ['Race 2', 'race', 35]
	}
};

function toSession(s: ApiSession, series: Class): Session | null {
	const known = SESSIONS[series][s.attributes.short_name];
	if (!known) return null;
	const [name, kind, minutes] = known;
	const start = new Date(s.attributes.start_date_utc).toISOString();
	const end = s.attributes.end_date_utc;
	return {
		name,
		kind,
		start,
		end: end ? new Date(end).toISOString() : addMinutes(start, minutes),
		estimatedEnd: !end
	};
}

async function get<T>(path: string): Promise<T> {
	return JSON.parse(await fetchText(`${API}${path}`));
}

export const worldsbk: Source = {
	label: 'WorldSBK official API',
	series: ['worldsbk', 'worldssp'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const { data: rounds, included = [] } = await get<{ data: ApiRound[]; included?: ApiCircuit[] }>(
				`/seasons/${year}/rounds`
			);
			const live = rounds.filter((r) => !/cancel/i.test(r.attributes.status));
			const parsed = await mapLimit(live, 4, async (round) => {
				const a = round.attributes;
				const { data } = await get<{ data: ApiSession[] }>(`/seasons/${year}/rounds/${a.source_id}/sessions`);
				const circuit = included.find((c) => c.type === 'circuits' && c.id === round.relationships.circuit.data.id);
				return (Object.keys(CATEGORIES) as Class[]).map((series) => {
					const sessions = data
						.filter((s) => s.relationships.category.data.id === CATEGORIES[series])
						.map((s) => toSession(s, series))
						.filter((s): s is Session => s !== null);
					const event = {
						// WorldSBK ids predate WorldSSP and keep their form.
						id: series === 'worldsbk' ? `worldsbk-${round.id}` : `${series}-${round.id}`,
						series,
						name: a.description,
						round: a.sequence_order,
						location: [a.name, circuit?.attributes.locality].filter(Boolean).join(', '),
						sessions,
						url: `https://www.worldsbk.com/en/calendar/event/${round.id}`
					};
					if (sessions.length > 0) return finalizeEvent(event);
					return { ...event, start: a.start_date.slice(0, 10), end: a.end_date.slice(0, 10), allDay: true };
				});
			});
			events.push(...parsed.flat().filter((e): e is MotorEvent => e !== null));
		}
		if (events.length === 0) throw new Error('no rounds found');
		return events;
	}
};
