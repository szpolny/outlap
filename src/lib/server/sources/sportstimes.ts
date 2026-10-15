import type { MotorEvent, SeriesId } from '#lib/series.ts';
import { fetchOptional, finalizeEvent, makeSession } from '../util';
import type { Source } from './types';

// Community-maintained dataset behind f1calendar.com / f2calendar.com / f3calendar.com and its
// Formula E and F1 Academy siblings. Formula E files are named after the year a season ends.
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
	practice1: ['Free Practice 1', 50],
	practice2: ['Free Practice 2', 30],
	practice3: ['Free Practice 3', 30],
	fp1: ['Practice', 40],
	qualifying1: ['Qualifying 1', 30],
	qualifying2: ['Qualifying 2', 30],
	race: ['Race', 50],
	race1: ['Race 1', 30],
	race2: ['Race 2', 30],
	qualifying: ['Qualifying', 30],
	sprint: ['Sprint Race', 45],
	sprint1: ['Sprint Race 1', 45],
	sprint2: ['Sprint Race 2', 45],
	feature: ['Feature Race', 60]
};

type DatasetSeries = Extract<SeriesId, 'f2' | 'f3' | 'f1academy' | 'formulae'>;

/** Folder name in the dataset, where it differs from the series id. */
const FOLDERS: Partial<Record<DatasetSeries, string>> = { f1academy: 'f1-academy', formulae: 'fe' };

function feederSource(series: DatasetSeries, title: (race: Race) => string): Source {
	return {
		label: 'sportstimes/f1 dataset',
		series: [series],
		async load(years) {
			const events: MotorEvent[] = [];
			for (const year of years) {
				const body = await fetchOptional(`${RAW}/${FOLDERS[series] ?? series}/${year}.json`);
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
						name: title(race),
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

export const f2 = feederSource('f2', (race) => `F2 ${race.location}`);
export const f3 = feederSource('f3', (race) => `F3 ${race.location}`);
export const f1academy = feederSource('f1academy', (race) => `F1 Academy ${race.location}`);
// Formula E names its rounds already ("Monaco ePrix"); double-headers share the name.
export const formulae = feederSource('formulae', (race) => race.name);
