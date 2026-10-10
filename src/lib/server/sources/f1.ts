import type { MotorEvent } from '#lib/series.ts';
import { fetchOptional, finalizeEvent, makeSession } from '../util';
import type { Source } from './types';

// Jolpica (successor of the Ergast API) provides names, circuits and rounds. Session
// times are cross-checked against the sportstimes dataset (behind f1calendar.com),
// which has proven quicker to pick up late changes such as moved race start times.
const API = 'https://api.jolpi.ca/ergast/f1';
const OVERRIDES = 'https://raw.githubusercontent.com/sportstimes/f1/main/_db/f1';

interface DateTime {
	date: string;
	time?: string;
}

interface Race extends DateTime {
	season: string;
	round: string;
	raceName: string;
	url: string;
	Circuit: { circuitName: string; Location: { locality: string; country: string } };
	FirstPractice?: DateTime;
	SecondPractice?: DateTime;
	ThirdPractice?: DateTime;
	SprintQualifying?: DateTime;
	SprintShootout?: DateTime;
	Sprint?: DateTime;
	Qualifying?: DateTime;
}

/** [Jolpica key, sportstimes key, label, minutes] */
const SESSIONS: [keyof Race, string, string, number][] = [
	['FirstPractice', 'fp1', 'Practice 1', 60],
	['SecondPractice', 'fp2', 'Practice 2', 60],
	['ThirdPractice', 'fp3', 'Practice 3', 60],
	['SprintQualifying', 'sprintQualifying', 'Sprint Qualifying', 45],
	['SprintShootout', 'sprintQualifying', 'Sprint Qualifying', 45],
	['Sprint', 'sprint', 'Sprint', 60],
	['Qualifying', 'qualifying', 'Qualifying', 60]
];

async function loadOverrides(year: number): Promise<Map<number, Record<string, string>>> {
	try {
		const body = await fetchOptional(`${OVERRIDES}/${year}.json`);
		const races: { round: number; sessions: Record<string, string> }[] = body ? JSON.parse(body).races : [];
		return new Map(races.map((r) => [r.round, r.sessions]));
	} catch (e) {
		// Optional cross-check only; Jolpica alone is still usable.
		console.warn(`[f1] sportstimes cross-check unavailable for ${year}:`, e);
		return new Map();
	}
}

function iso(dt: DateTime): string | null {
	// Times are omitted while a session is still unscheduled.
	return dt.time ? new Date(`${dt.date}T${dt.time}`).toISOString() : null;
}

export const f1: Source = {
	label: 'Jolpica F1 API + sportstimes cross-check',
	series: ['f1'],
	async load(years) {
		const events: MotorEvent[] = [];
		for (const year of years) {
			const body = await fetchOptional(`${API}/${year}.json?limit=100`);
			if (!body) continue;
			const races: Race[] = JSON.parse(body).MRData.RaceTable.Races;
			const overrides = await loadOverrides(year);
			for (const race of races) {
				// Only trust the cross-check if both agree it is the same weekend (rounds can shift).
				const candidate = overrides.get(Number(race.round));
				const sameWeekend =
					candidate?.gp && Math.abs(Date.parse(candidate.gp) - Date.parse(race.date)) < 3 * 86_400_000;
				const override = sameWeekend ? candidate : {};
				const sessions = [];
				for (const [key, overrideKey, name, minutes] of SESSIONS) {
					if (!race[key]) continue;
					const start = override[overrideKey] ?? iso(race[key] as DateTime);
					if (start) sessions.push(makeSession(name, start, minutes));
				}
				const raceStart = override.gp ?? iso(race);
				if (raceStart) sessions.push(makeSession('Race', raceStart, 120, 'race'));
				const event = finalizeEvent({
					id: `f1-${race.season}-${race.round}`,
					series: 'f1',
					name: race.raceName,
					round: Number(race.round),
					location: `${race.Circuit.circuitName}, ${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`,
					sessions,
					url: race.url
				});
				if (event) events.push(event);
			}
		}
		return events;
	}
};
