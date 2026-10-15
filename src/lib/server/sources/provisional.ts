import type { SeriesId } from '#lib/series.ts';
import { readSeason, round, text, type Row, type Season } from './seasons';
import type { Source } from './types';
import { column, dateRange } from './wikipedia';

// Official timetables usually appear weeks before a season, but calendars are announced months
// earlier and land in the Wikipedia season article first. For a year where a source has no
// events yet, its series read that article's calendar table instead, as all-day race days.
// They are replaced by the official events once the source publishes the season.

interface Columns {
	name: RegExp;
	/** joined with ", " */
	location: RegExp[];
	date: RegExp;
	round?: RegExp;
	/** "Thailand motorcycle Grand Prix" -> "Thailand Grand Prix" */
	rename?: (name: string) => string;
	/** meeting key for double-headers listed as separate rounds on the same days */
	key?: (row: Row) => string;
}

/** Circuit name without the town after its comma, for series that name meetings after the venue. */
const venue = (name: string) => name.replace(/,.*$/, '');

function columns(c: Columns) {
	return (cells: Record<string, string>, year: number): Row | null => {
		const location = c.location.map((header) => text(column(cells, header))).filter(Boolean).join(', ');
		// Races whose title sponsor is still unannounced go by their venue.
		const name = text(column(cells, c.name)).replace(/^(TBA|TBD)$/i, venue(location));
		const dates = dateRange(column(cells, c.date) ?? '', year);
		if (!name || !dates) return null;
		const row: Row = {
			name: c.rename?.(name) ?? name,
			location,
			round: c.round && round(column(cells, c.round)),
			dates
		};
		return c.key ? { ...row, key: c.key(row) } : row;
	};
}

const CALENDAR = /==\s*(Race )?[Cc]alendar\s*==/;
const SCHEDULE = /==\s*Schedule\s*==/;

const PROVISIONAL: Season[] = [
	{
		series: 'f1',
		article: (y) => `${y}_Formula_One_World_Championship`,
		heading: CALENDAR,
		row: columns({ name: /^grand prix/i, location: [/^circuit/i], date: /date/i, round: /^round/i })
	},
	{
		// Seasons run December to August and are filed under the year they end.
		series: 'formulae',
		article: (y) => `${y - 1}–${String(y).slice(2)}_Formula_E_World_Championship`,
		heading: CALENDAR,
		row: columns({ name: /^e-?prix/i, location: [/^circuit/i], date: /^date/i, round: /^round/i })
	},
	{
		series: 'motogp',
		article: (y) => `${y}_MotoGP_World_Championship`,
		heading: CALENDAR,
		row: columns({
			name: /^grand prix/i,
			location: [/^circuit/i],
			date: /^date/i,
			round: /^round/i,
			rename: (name) => name.replace(/ motorcycle /i, ' ')
		})
	},
	{
		series: 'indycar',
		article: (y) => `${y}_IndyCar_Series`,
		// The schedule's first table is the legend for its track-type icons.
		heading: /==\s*Schedule\s*==[\s\S]*?\n\|\}/,
		row: columns({ name: /^race/i, location: [/^track/i, /^location/i], date: /^date/i, round: /^(rd|round)/i })
	},
	{
		series: 'nascar',
		article: (y) => `${y}_NASCAR_Cup_Series`,
		heading: SCHEDULE,
		row: columns({ name: /^race/i, location: [/^track/i, /^location/i], date: /^date/i, round: /^no/i })
	},
	{
		series: 'oreilly',
		article: (y) => `${y}_NASCAR_O'Reilly_Auto_Parts_Series`,
		heading: SCHEDULE,
		row: columns({ name: /^race/i, location: [/^track/i, /^location/i], date: /^date/i, round: /^no/i })
	},
	{
		series: 'truck',
		article: (y) => `${y}_NASCAR_Craftsman_Truck_Series`,
		heading: SCHEDULE,
		row: columns({ name: /^race/i, location: [/^track/i, /^location/i], date: /^date/i, round: /^no/i })
	},
	{
		series: 'supergt',
		article: (y) => `${y}_Super_GT_Series`,
		heading: CALENDAR,
		row: columns({ name: /^race/i, location: [/^circuit/i, /^location/i], date: /^dates?$/i, round: /^round$/i })
	},
	{
		series: 'superformula',
		article: (y) => `${y}_Super_Formula_Championship`,
		heading: CALENDAR,
		row: columns({
			name: /^circuit/i,
			location: [/^circuit/i, /^location/i],
			date: /^date/i,
			key: (row) => row.dates![0]
		})
	},
	{
		series: 'gtwce',
		article: (y) => `${y}_GT_World_Challenge_Europe`,
		heading: CALENDAR,
		row: columns({ name: /^circuit/i, location: [/^circuit/i], date: /^date/i, round: /^round/i, rename: venue })
	},
	{
		series: 'gtwca',
		article: (y) => `${y}_GT_World_Challenge_America`,
		heading: CALENDAR,
		row: columns({ name: /^circuit/i, location: [/^circuit/i], date: /^date/i, round: /^round/i, rename: venue })
	},
	{
		series: 'gtwcasia',
		article: (y) => `${y}_GT_World_Challenge_Asia`,
		heading: CALENDAR,
		row: columns({ name: /^circuit/i, location: [/^circuit/i], date: /^date/i, round: /^round/i, rename: venue })
	},
	{
		series: 'igtc',
		article: (y) => `${y}_Intercontinental_GT_Challenge`,
		heading: CALENDAR,
		row: columns({ name: /^race/i, location: [/^circuit/i], date: /^date/i, round: /^round/i })
	},
	{
		series: 'elms',
		article: (y) => `${y}_European_Le_Mans_Series`,
		heading: CALENDAR,
		row: columns({ name: /^race/i, location: [/^circuit/i, /^location/i], date: /^date/i, round: /^(rnd|round)/i })
	}
];

/** `primary`, plus Wikipedia calendars for the `wanted` series in years it has no events for. */
export function withProvisional(primary: Source, wanted: ReadonlySet<SeriesId>): Source {
	const seasons = PROVISIONAL.filter((season) => primary.series.includes(season.series) && wanted.has(season.series));
	if (seasons.length === 0) return primary;
	return {
		...primary,
		async load(years) {
			// Requested up front so the articles share the Wikipedia query sent as sources start,
			// which rate-limits a burst of single-article queries.
			const articles = seasons.map((season) =>
				years.map((year) => readSeason(season, [year]).catch((error: unknown) => error instanceof Error ? error : new Error(String(error))))
			);
			const events = await primary.load(years);
			for (const [i, season] of seasons.entries()) {
				const covered = new Set(events.filter((e) => e.series === season.series).map((e) => Number(e.start.slice(0, 4))));
				for (const [j, year] of years.entries()) {
					if (covered.has(year)) continue;
					const result = await articles[i][j];
					// The official events are still usable without the provisional calendar.
					if (result instanceof Error) console.warn(`[${season.series}] provisional ${year} calendar unavailable:`, result.message);
					else events.push(...result);
				}
			}
			return events;
		}
	};
}
