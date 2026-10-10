import type { MotorEvent, SeriesId } from '#lib/series.ts';
import { fetchOptional, finalizeEvent, makeSession } from '../util';
import type { Source } from './types';

// Community-maintained dataset behind f1calendar.com / f2calendar.com / f3calendar.com.
const RAW = 'https://raw.githubusercontent.com/sportstimes/f1/main/_db';

interface Race {
	name: string;
	location: string;
	round: number;
	slug: string;
	tbc?: boolean;
	sessions: Record<string, string>;
}

const LABELS: Record<string, [string, number]> = {
	practice: ['Practice', 45],
	qualifying: ['Qualifying', 30],
	sprint: ['Sprint Race', 45],
	sprint1: ['Sprint Race 1', 45],
	sprint2: ['Sprint Race 2', 45],
	feature: ['Feature Race', 60]
};

function feederSource(series: Extract<SeriesId, 'f2' | 'f3'>, title: string): Source {
	return {
		label: 'sportstimes/f1 dataset',
		series: [series],
		async load(years) {
			const events: MotorEvent[] = [];
			for (const year of years) {
				const body = await fetchOptional(`${RAW}/${series}/${year}.json`);
				if (!body) continue;
				const races: Race[] = JSON.parse(body).races;
				for (const race of races) {
					if (race.tbc) continue;
					const sessions = Object.entries(race.sessions).map(([key, start]) => {
						const [name, minutes] = LABELS[key] ?? [key, 45];
						return makeSession(name, start, minutes);
					});
					const event = finalizeEvent({
						id: `${series}-${year}-${race.round}`,
						series,
						name: `${title} ${race.location}`,
						round: race.round,
						location: race.location,
						sessions
					});
					if (event) events.push(event);
				}
			}
			return events;
		}
	};
}

export const f2 = feederSource('f2', 'F2');
export const f3 = feederSource('f3', 'F3');
