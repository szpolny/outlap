import type { MotorEvent, SessionKind } from '#lib/series.ts';
import { HttpError, fetchText, finalizeEvent, makeSession } from '../util';
import type { Source } from './types';

// The feed behind nascar.com's schedule. Each race lists its weekend timetable in UTC;
// run_type marks on-track sessions (0 is garage hours, meetings and the like).
const FEED = 'https://cf.nascar.com/cacher';

interface Race {
	race_id: number;
	race_name: string;
	race_type_id: number;
	track_name: string;
	schedule: { event_name: string; run_type: number; start_time_utc: string }[];
}

const RUN_TYPES: Record<number, [SessionKind, number]> = {
	1: ['practice', 50],
	2: ['qualifying', 60],
	3: ['race', 210]
};

/** Race type 1 is a points race; the Clash, the Duels and the All-Star Race are not. */
const POINTS_RACE = 1;

export const nascar: Source = {
	label: 'nascar.com',
	series: ['nascar'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			let body: string;
			try {
				body = await fetchText(`${FEED}/${year}/race_list_basic.json`);
			} catch (e) {
				// An unpublished season is a missing S3 object, which answers 403.
				if (e instanceof HttpError && (e.status === 403 || e.status === 404)) continue;
				throw e;
			}
			const races: Race[] = JSON.parse(body).series_1 ?? [];
			let round = 0;
			for (const race of races) {
				if (race.race_type_id === POINTS_RACE) round++;
				const sessions = race.schedule
					.filter((s) => s.run_type in RUN_TYPES)
					.map((s) => {
						const [kind, minutes] = RUN_TYPES[s.run_type];
						const name = s.event_name.replace(/\s*\(impound\)/i, '').trim();
						return makeSession(name, `${s.start_time_utc}Z`, minutes, kind);
					});
				const event = finalizeEvent({
					id: `nascar-${race.race_id}`,
					series: 'nascar',
					name: race.race_name,
					round: race.race_type_id === POINTS_RACE ? round : undefined,
					location: race.track_name,
					sessions
				});
				if (event) events.push(event);
			}
		}
		if (events.length === 0) throw new Error('no Cup Series races in feed');
		return events;
	}
};
