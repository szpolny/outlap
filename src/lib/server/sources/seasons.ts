import type { MotorEvent, SeriesId } from '#lib/series.ts';
import { fetchText, slugify, titleCase } from '../util';
import type { Source } from './types';
import { MONTHS, column, dateRange, fetchWikitext, stripWiki, tableGrid } from './wikipedia';

// Series whose official sites have no usable timetable feed, read from the calendar table of
// the Wikipedia season article. The tables give race days without start times, so meetings
// are all-day events. A season's article usually appears a few months before it starts.

export interface Row {
	name: string;
	location?: string;
	round?: number;
	/** groups rows into one meeting; defaults to the round, else the name */
	key?: string;
	dates: [string, string] | null;
}

export interface Season {
	series: SeriesId;
	/** article title for a season */
	article: (year: number) => string;
	heading: RegExp;
	row: (cells: Record<string, string>, year: number) => Row | null;
}

/** Plain text without <small> notes such as "(National Circuit, Leicestershire)". */
export const text = (cell: string | undefined) => stripWiki((cell ?? '').replace(/<small>[\s\S]*?<\/small>|<br\s*\/?>[\s\S]*/gi, ''));

export const round = (cell: string | undefined) => {
	const n = Number(stripWiki(cell ?? '').match(/^\d+/)?.[0]);
	return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** The layout a circuit cell's note names, such as "Indy Circuit" in "<small>(Indy Circuit, Kent)</small>". */
const layout = (cell: string | undefined) =>
	stripWiki(cell?.match(/<small>\(?([^,)<]*)/i)?.[1] ?? '').match(/^.*\bCircuit$/i)?.[0];

/** Championships whose table has a row per race, grouped into meetings by round. */
export function circuitRow(short: string) {
	return (cells: Record<string, string>, year: number): Row | null => {
		const cell = column(cells, /^circuit/i);
		const circuit = text(cell).replace(/,.*$/, '');
		const r = round(column(cells, /^(round|rnd)/i));
		if (!circuit || !r) return null;
		// Keep the layout, which venues.ts uses to pick the outline: BTCC races both at Brands Hatch.
		const variant = layout(cell);
		const location = variant ? `${circuit} (${variant})` : circuit;
		return { name: `${short} ${circuit}`, location, round: r, dates: dateRange(column(cells, /^dates?$/i) ?? '', year) };
	};
}

const SEASONS: Season[] = [
	{
		series: 'btcc',
		article: (y) => `${y}_British_Touring_Car_Championship`,
		heading: /==\s*Race calendar\s*==/i,
		row: circuitRow('BTCC')
	},
	{
		series: 'sfl',
		article: (y) => `${y}_Super_Formula_Lights`,
		heading: /==\s*Race calendar\s*==/i,
		row: circuitRow('SFL')
	},
	{
		series: 'supercars',
		article: (y) => `${y}_Supercars_Championship`,
		heading: /==\s*Calendar\s*==/i,
		row: (cells, year) => {
			const name = text(column(cells, /^event/i));
			if (!name) return null;
			return {
				name,
				location: [text(column(cells, /^circuit/i)), text(column(cells, /^location/i))].filter(Boolean).join(', '),
				dates: dateRange(column(cells, /^dates?$/i) ?? '', year)
			};
		}
	},
	{
		series: 'supercross',
		article: (y) => `${y}_AMA_Supercross_Championship`,
		heading: /==\s*Schedule and results\s*==/i,
		row: (cells, year) => {
			const city = text(column(cells, /^location/i));
			const r = round(column(cells, /^round/i));
			if (!city || !r) return null;
			return {
				name: `Supercross ${city}`,
				location: [text(column(cells, /^stadium/i)), city].filter(Boolean).join(', '),
				round: r,
				dates: dateRange(column(cells, /^date/i) ?? '', year)
			};
		}
	},
	{
		series: 'mxgp',
		article: (y) => `${y}_FIM_Motocross_World_Championship`,
		heading: /===\s*MXGP\s*===/,
		row: (cells, year) => {
			const name = text(column(cells, /^grand prix/i));
			const r = round(column(cells, /^round/i));
			if (!name || !r) return null;
			return { name, location: text(column(cells, /^location/i)), round: r, dates: dateRange(column(cells, /^date/i) ?? '', year) };
		}
	},
	{
		series: 'nls',
		article: (y) => `${y}_Nürburgring_Langstrecken-Serie`,
		heading: /==\s*Calendar\s*==/i,
		row: (cells, year) => {
			const name = text(column(cells, /^race/i));
			const r = round(column(cells, /^(rnd|round)/i));
			if (!name || !r) return null;
			return { name, location: 'Nürburgring Nordschleife', round: r, dates: dateRange(column(cells, /^date/i) ?? '', year) };
		}
	}
];

/** Meetings in the calendar tables of the given seasons' articles; empty where none exist yet. */
export async function readSeason(season: Season, years: number[]): Promise<MotorEvent[]> {
	const articles = await Promise.all(years.map((year) => fetchWikitext(season.article(year))));
	const events = new Map<string, MotorEvent>();
	years.forEach((year, i) => {
		const wikitext = articles[i];
		if (!wikitext) return;
		for (const cells of tableGrid(wikitext, season.heading)) {
			const row = season.row(cells, year);
			if (!row?.dates) continue;
			const id = `${season.series}-${year}-${row.key ?? row.round ?? slugify(row.name)}`;
			const existing = events.get(id);
			// Races of the same round become one meeting spanning all their days.
			if (existing) {
				if (row.dates[0] < existing.start) existing.start = row.dates[0];
				if (row.dates[1] > existing.end) existing.end = row.dates[1];
				continue;
			}
			events.set(id, {
				id,
				series: season.series,
				name: row.name,
				round: row.round,
				location: row.location || undefined,
				start: row.dates[0],
				end: row.dates[1],
				allDay: true,
				sessions: [],
				url: `https://en.wikipedia.org/wiki/${season.article(year)}`
			});
		}
	});
	if (events.size === 0 && articles.some(Boolean)) throw new Error('no meetings in calendar table');
	return [...events.values()];
}

function seasonSource(season: Season): Source {
	return {
		label: 'Wikipedia (season article)',
		series: [season.series],
		load: (years) => readSeason(season, years)
	};
}

export const [btcc, sfl, supercars, supercross, mxgp, nls] = SEASONS.map(seasonSource);

/** "3 January 2026" */
const FULL_DATE = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/g;

/** First and last stage day of past and announced editions, from their Wikipedia articles. */
async function dakarArticles(years: number[]): Promise<MotorEvent[]> {
	const articles = await Promise.all(years.map((year) => fetchWikitext(`${year}_Dakar_Rally`)));
	const events: MotorEvent[] = [];
	years.forEach((year, i) => {
		const wikitext = articles[i];
		const start = wikitext?.search(/==\s*Stages\s*==/) ?? -1;
		if (!wikitext || start < 0) return;
		const table = wikitext.slice(start, wikitext.indexOf('\n|}', start));
		const days = [...table.matchAll(FULL_DATE)]
			.map(([, day, month, y]) => {
				const m = MONTHS.indexOf(month.toLowerCase()) + 1;
				return m === 0 ? null : `${y}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
			})
			.filter((d): d is string => d !== null)
			.sort();
		if (days.length === 0) return;
		events.push({
			id: `dakar-${year}`,
			series: 'dakar',
			name: `Dakar Rally ${year}`,
			location: stripWiki(wikitext.match(/\|\s*country\s*=\s*([^\n]*)/i)?.[1] ?? '') || undefined,
			start: days[0],
			end: days.at(-1)!,
			allDay: true,
			sessions: [],
			url: `https://en.wikipedia.org/wiki/${year}_Dakar_Rally`
		});
	});
	return events;
}

/**
 * The next edition from the official site, whose header shows its dates as "01/01 > 01/15/2027"
 * as soon as they are announced, months before Wikipedia has a stage table.
 */
export function parseDakarHome(html: string): MotorEvent | null {
	const m = html.match(/header__date[^>]*>\s*(\d{2})\/(\d{2})\s*(?:>|&gt;)\s*(\d{2})\/(\d{2})\/(\d{4})/);
	if (!m) return null;
	const [, startMonth, startDay, endMonth, endDay, endYear] = m;
	const year = Number(endYear);
	// An edition starting in late December ends in the following year.
	const startYear = Number(startMonth) > Number(endMonth) ? year - 1 : year;
	const country = html.match(/href="\/en\/discover-([a-z-]+)"/)?.[1];
	return {
		id: `dakar-${year}`,
		series: 'dakar',
		name: `Dakar Rally ${year}`,
		location: country ? titleCase(country.replace(/-/g, ' ')) : undefined,
		start: `${startYear}-${startMonth}-${startDay}`,
		end: `${year}-${endMonth}-${endDay}`,
		allDay: true,
		sessions: [],
		url: 'https://www.dakar.com/en'
	};
}

// The Dakar is one two-week event each January.
export const dakar: Source = {
	label: 'dakar.com + Wikipedia (Dakar Rally article)',
	series: ['dakar'],
	async load(years) {
		const [articles, home] = await Promise.all([
			dakarArticles(years),
			fetchText('https://www.dakar.com/en').then(parseDakarHome, (error) => {
				console.warn('[dakar] official site unavailable:', error instanceof Error ? error.message : error);
				return null;
			})
		]);
		const events = new Map(articles.map((event) => [event.id, event]));
		// The organiser's dates win; the article may still have a better place name.
		if (home && years.includes(Number(home.id.slice(-4)))) {
			events.set(home.id, { ...home, location: events.get(home.id)?.location ?? home.location });
		}
		return [...events.values()];
	}
};
