// Shared between server and client: series metadata and the normalized event shape.

export const SERIES = {
	f1: { name: 'Formula 1', short: 'F1', color: '#e10600', group: 'Single-seater' },
	f2: { name: 'Formula 2', short: 'F2', color: '#0090d0', group: 'Single-seater' },
	f3: { name: 'Formula 3', short: 'F3', color: '#e4002b', group: 'Single-seater' },
	indycar: { name: 'IndyCar', short: 'IndyCar', color: '#1f3a93', group: 'Single-seater' },
	indynxt: { name: 'Indy NXT', short: 'NXT', color: '#5b6b8c', group: 'Single-seater' },
	motogp: { name: 'MotoGP', short: 'MotoGP', color: '#c8102e', group: 'Motorcycle' },
	moto2: { name: 'Moto2', short: 'Moto2', color: '#d4560f', group: 'Motorcycle' },
	moto3: { name: 'Moto3', short: 'Moto3', color: '#8a5cc2', group: 'Motorcycle' },
	wec: { name: 'FIA WEC', short: 'WEC', color: '#0a7d5a', group: 'Endurance' },
	elms: { name: 'European Le Mans Series', short: 'ELMS', color: '#2c9c9c', group: 'Endurance' },
	wrc: { name: 'World Rally Championship', short: 'WRC', color: '#b8860b', group: 'Rally' }
} as const;

export type SeriesId = keyof typeof SERIES;
export const SERIES_IDS = Object.keys(SERIES) as SeriesId[];

export function isSeriesId(value: string): value is SeriesId {
	return value in SERIES;
}

export type SessionKind = 'practice' | 'qualifying' | 'sprint' | 'race' | 'other';

export interface Session {
	name: string;
	kind: SessionKind;
	/** ISO 8601, UTC */
	start: string;
	/** ISO 8601, UTC */
	end: string;
	/** true when the end time is an estimate rather than published by the organiser */
	estimatedEnd: boolean;
}

export interface MotorEvent {
	/** stable across refreshes; used as the iCalendar UID */
	id: string;
	series: SeriesId;
	name: string;
	round?: number;
	location?: string;
	/** Timed events: ISO 8601 UTC. All-day events: YYYY-MM-DD (inclusive). */
	start: string;
	end: string;
	allDay: boolean;
	sessions: Session[];
	url?: string;
}

export interface SourceStatus {
	series: SeriesId[];
	source: string;
	ok: boolean;
	error?: string;
	fetchedAt?: string;
}

export interface Schedule {
	events: MotorEvent[];
	sources: SourceStatus[];
	generatedAt: string;
}
