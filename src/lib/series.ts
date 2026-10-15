import type { SourceStatus as KitSourceStatus } from '@szpolny/calendar-kit/snapshot';
// Shared between server and client: series metadata and the normalized event shape.

export const SERIES = {
	f1: { name: 'Formula 1', short: 'F1', color: '#e10600', group: 'Single-seater' },
	f2: { name: 'Formula 2', short: 'F2', color: '#0090d0', group: 'Single-seater' },
	f3: { name: 'Formula 3', short: 'F3', color: '#e4002b', group: 'Single-seater' },
	f1academy: { name: 'F1 Academy', short: 'F1A', color: '#d6006f', group: 'Single-seater' },
	formulae: { name: 'Formula E', short: 'FE', color: '#3b5bdb', group: 'Single-seater' },
	indycar: { name: 'IndyCar', short: 'IndyCar', color: '#1f3a93', group: 'Single-seater' },
	indynxt: { name: 'Indy NXT', short: 'NXT', color: '#5b6b8c', group: 'Single-seater' },
	superformula: { name: 'Super Formula', short: 'SF', color: '#0891b2', group: 'Single-seater' },
	sfl: { name: 'Super Formula Lights', short: 'SFL', color: '#4d8fa8', group: 'Single-seater' },
	nascar: { name: 'NASCAR Cup Series', short: 'NASCAR', color: '#007ac2', group: 'Stock car' },
	oreilly: { name: "NASCAR O'Reilly Auto Parts Series", short: "O'Reilly", color: '#1f8a4c', group: 'Stock car' },
	truck: { name: 'NASCAR Craftsman Truck Series', short: 'Truck', color: '#c2410c', group: 'Stock car' },
	motogp: { name: 'MotoGP', short: 'MotoGP', color: '#c8102e', group: 'Motorcycle' },
	moto2: { name: 'Moto2', short: 'Moto2', color: '#d4560f', group: 'Motorcycle' },
	moto3: { name: 'Moto3', short: 'Moto3', color: '#8a5cc2', group: 'Motorcycle' },
	worldsbk: { name: 'Superbike World Championship', short: 'WorldSBK', color: '#db2777', group: 'Motorcycle' },
	bsb: { name: 'British Superbike Championship', short: 'BSB', color: '#2563eb', group: 'Motorcycle' },
	iomtt: { name: 'Isle of Man TT', short: 'TT', color: '#b91c1c', group: 'Motorcycle' },
	sgp: { name: 'FIM Speedway Grand Prix', short: 'SGP', color: '#7a8c00', group: 'Motorcycle' },
	mxgp: { name: 'FIM Motocross World Championship', short: 'MXGP', color: '#ea580c', group: 'Motorcycle' },
	supercross: { name: 'AMA Supercross', short: 'SX', color: '#6d28d9', group: 'Motorcycle' },
	wec: { name: 'FIA WEC', short: 'WEC', color: '#0a7d5a', group: 'Endurance' },
	elms: { name: 'European Le Mans Series', short: 'ELMS', color: '#2c9c9c', group: 'Endurance' },
	alms: { name: 'Asian Le Mans Series', short: 'ALMS', color: '#e8710a', group: 'Endurance' },
	lemanscup: { name: 'Michelin Le Mans Cup', short: 'LMC', color: '#27509b', group: 'Endurance' },
	imsa: { name: 'IMSA SportsCar Championship', short: 'IMSA', color: '#9b1b30', group: 'Endurance' },
	igtc: { name: 'Intercontinental GT Challenge', short: 'IGTC', color: '#a16207', group: 'Endurance' },
	nls: { name: 'Nürburgring Langstrecken-Serie', short: 'NLS', color: '#15803d', group: 'Endurance' },
	dtm: { name: 'DTM', short: 'DTM', color: '#d49a00', group: 'GT' },
	supergt: { name: 'Super GT', short: 'Super GT', color: '#7c3aed', group: 'GT' },
	gtwce: { name: 'GT World Challenge Europe', short: 'GTWC EU', color: '#0e7490', group: 'GT' },
	gtwca: { name: 'GT World Challenge America', short: 'GTWC AM', color: '#be123c', group: 'GT' },
	gtwcasia: { name: 'GT World Challenge Asia', short: 'GTWC AS', color: '#b45309', group: 'GT' },
	btcc: { name: 'British Touring Car Championship', short: 'BTCC', color: '#1d4ed8', group: 'Touring car' },
	supercars: { name: 'Supercars Championship', short: 'Supercars', color: '#dc2626', group: 'Touring car' },
	wrc: { name: 'World Rally Championship', short: 'WRC', color: '#b8860b', group: 'Rally' },
	erc: { name: 'European Rally Championship', short: 'ERC', color: '#0369a1', group: 'Rally' },
	dakar: { name: 'Dakar Rally', short: 'Dakar', color: '#92400e', group: 'Rally' }
} as const;

export type SeriesId = keyof typeof SERIES;
export const SERIES_IDS = Object.keys(SERIES) as SeriesId[];

/** A focused starting selection for visitors without saved preferences. */
export const DEFAULT_SERIES_IDS: SeriesId[] = [
	'f1',
	'indycar',
	'superformula',
	'nascar',
	'motogp',
	'worldsbk',
	'sgp',
	'wec',
	'imsa',
	'dtm',
	'gtwce',
	'wrc'
];

/**
 * Series added in the latest update. Returning visitors keep their saved selection, so a
 * notice shown once offers to add these; bump `id` when announcing another batch.
 */
export const NEW_SERIES: { id: string; ids: SeriesId[] } = {
	id: '2026-10',
	// The first few are named in the notice.
	ids: [
		'gtwce', 'formulae', 'supercars', 'mxgp', 'btcc', 'gtwca', 'gtwcasia', 'igtc', 'f1academy', 'sfl', 'oreilly',
		'truck', 'nls', 'bsb', 'iomtt', 'supercross', 'erc', 'dakar'
	]
};

/** Categories in metadata order, shared by the quick filters and series picker. */
export const SERIES_GROUPS = [...new Set(SERIES_IDS.map((id) => SERIES[id].group))].map((group) => ({
	name: group === 'Single-seater' ? 'Single seaters' : group,
	ids: SERIES_IDS.filter((id) => SERIES[id].group === group)
}));

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
	/** Wikimedia Commons photo of the venue or event */
	photo?: EventImage;
}

export interface EventImage {
	/** public path for the original photo */
	src: string;
	width: number;
	height: number;
	/** file description page, with the full author and licence details */
	page: string;
	/** "Author, CC BY-SA 4.0" */
	credit: string;
	/** object-position for the card photo; centred by default */
	focus?: string;
}

export interface SourceStatus extends KitSourceStatus {
	series: SeriesId[];
}

export interface Schedule {
	events: MotorEvent[];
	sources: SourceStatus[];
	generatedAt: string;
}
