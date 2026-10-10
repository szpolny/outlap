import type { MotorEvent, Session, SeriesId } from '#lib/series.ts';
import { fetchOptional, finalizeEvent, guessKind, titleCase } from '../util';
import type { Source } from './types';

// Official MotoGP (Pulselive) API, which also carries Moto2 and Moto3.
const API = 'https://api.motogp.pulselive.com/motogp/v1';

interface Broadcast {
	shortname: string;
	name: string;
	date_start: string;
	date_end: string;
	type: string;
	category: { acronym: string };
}

interface ApiEvent {
	id: string;
	name: string;
	kind: string;
	status: string;
	date_start: string;
	circuit?: { name: string; city?: string; country?: string };
	broadcasts?: Broadcast[];
}

const CATEGORIES: Record<string, SeriesId> = { MGP: 'motogp', MT2: 'moto2', MT3: 'moto3' };

const NAMES: Record<string, string> = {
	FP1: 'Free Practice 1',
	FP2: 'Free Practice 2',
	PR: 'Practice',
	Q1: 'Qualifying 1',
	Q2: 'Qualifying 2',
	SPR: 'Sprint',
	WUP: 'Warm Up',
	RAC: 'Race'
};

/** "2026-10-22T15:30:00+1100" -> ISO UTC */
function toIso(s: string): string {
	return new Date(s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')).toISOString();
}

export const motogp: Source = {
	label: 'MotoGP official API',
	series: ['motogp', 'moto2', 'moto3'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const body = await fetchOptional(`${API}/events?seasonYear=${year}`);
			if (!body) continue;
			const gps = (JSON.parse(body) as ApiEvent[])
				.filter((e) => e.kind === 'GP' && e.status !== 'CANCELLED')
				.sort((a, b) => a.date_start.localeCompare(b.date_start));

			gps.forEach((gp, i) => {
				const bySeries = new Map<SeriesId, Session[]>();
				for (const b of gp.broadcasts ?? []) {
					const series = CATEGORIES[b.category?.acronym];
					if (!series || b.type !== 'SESSION') continue;
					const name = NAMES[b.shortname] ?? b.name.trim();
					const session: Session = {
						name,
						kind: b.shortname === 'SPR' ? 'sprint' : guessKind(name),
						start: toIso(b.date_start),
						end: toIso(b.date_end),
						estimatedEnd: false
					};
					bySeries.set(series, [...(bySeries.get(series) ?? []), session]);
				}
				const circuit = gp.circuit;
				for (const [series, sessions] of bySeries) {
					const event = finalizeEvent({
						id: `${series}-${year}-${gp.id}`,
						series,
						name: titleCase(gp.name),
						round: i + 1,
						location: circuit
							? [circuit.name, circuit.city && titleCase(circuit.city), circuit.country]
									.filter(Boolean)
									.join(', ')
							: undefined,
						sessions
					});
					if (event) events.push(event);
				}
			});
		}
		return events;
	}
};
