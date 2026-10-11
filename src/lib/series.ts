// Shared between server and client: series metadata and the normalized event shape.

export const SERIES = {
	f1: { name: 'Formula 1', short: 'F1', color: '#e10600', group: 'Single-seater' },
	f2: { name: 'Formula 2', short: 'F2', color: '#0090d0', group: 'Single-seater' },
	f3: { name: 'Formula 3', short: 'F3', color: '#e4002b', group: 'Single-seater' },
	indycar: { name: 'IndyCar', short: 'IndyCar', color: '#1f3a93', group: 'Single-seater' },
	indynxt: { name: 'Indy NXT', short: 'NXT', color: '#5b6b8c', group: 'Single-seater' },
	superformula: { name: 'Super Formula', short: 'SF', color: '#0891b2', group: 'Single-seater' },
	nascar: { name: 'NASCAR Cup Series', short: 'NASCAR', color: '#007ac2', group: 'Stock car' },
	motogp: { name: 'MotoGP', short: 'MotoGP', color: '#c8102e', group: 'Motorcycle' },
	moto2: { name: 'Moto2', short: 'Moto2', color: '#d4560f', group: 'Motorcycle' },
	moto3: { name: 'Moto3', short: 'Moto3', color: '#8a5cc2', group: 'Motorcycle' },
	worldsbk: { name: 'Superbike World Championship', short: 'WorldSBK', color: '#db2777', group: 'Motorcycle' },
	sgp: { name: 'FIM Speedway Grand Prix', short: 'SGP', color: '#7a8c00', group: 'Motorcycle' },
	wec: { name: 'FIA WEC', short: 'WEC', color: '#0a7d5a', group: 'Endurance' },
	elms: { name: 'European Le Mans Series', short: 'ELMS', color: '#2c9c9c', group: 'Endurance' },
	lemanscup: { name: 'Michelin Le Mans Cup', short: 'LMC', color: '#27509b', group: 'Endurance' },
	imsa: { name: 'IMSA SportsCar Championship', short: 'IMSA', color: '#9b1b30', group: 'Endurance' },
	dtm: { name: 'DTM', short: 'DTM', color: '#d49a00', group: 'GT' },
	supergt: { name: 'Super GT', short: 'Super GT', color: '#7c3aed', group: 'GT' },
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
	/** outline in static/tracks/<track>.svg */
	track?: string;
	/** Wikimedia Commons photo of the venue or event, served from static/photos/ */
	photo?: EventImage;
}

export interface EventImage {
	/** static/photos/ path */
	src: string;
	width: number;
	height: number;
	/** file description page, with the full author and licence details */
	page: string;
	/** "Author, CC BY-SA 4.0" */
	credit: string;
	/** CSS background-position for the card; centred by default */
	focus?: string;
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
