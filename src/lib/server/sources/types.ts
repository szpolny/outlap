import type { MotorEvent, SeriesId } from '#lib/series.ts';

export interface Source {
	/** human-readable origin, shown in the UI */
	label: string;
	series: SeriesId[];
	/** Load every event for the given seasons. Throw if the source is unusable. */
	load(years: number[]): Promise<MotorEvent[]>;
}
