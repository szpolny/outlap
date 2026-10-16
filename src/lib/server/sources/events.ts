import type { MotorEvent, SeriesId } from '#lib/series.ts';
import { decodeEntities, fetchText } from '../util';
import type { Source } from './types';
import { MONTHS, dateRange, fetchWikitext, stripWiki } from './wikipedia';

// Annual one-off events. Each edition's dates come from its Wikipedia article. Where the
// organiser's home page announces the next edition before Wikipedia has an article, that page
// adds it. The events have no published session times here, so they are all-day events.

interface Annual {
	series: SeriesId;
	name: (year: number) => string;
	location: string;
	/** article title for an edition */
	article: (year: number) => string;
	/** home page announcing the next edition */
	page?: string;
	/** the next edition's year and inclusive dates from the home page */
	parsePage?: (html: string) => { year: number; dates: [string, string] } | null;
}

const iso = (year: number | string, month: string, day: string) => {
	const m = MONTHS.findIndex((name) => name.startsWith(month.toLowerCase().slice(0, 3))) + 1;
	return m === 0 ? null : `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/** Page text without markup. */
const plain = (html: string) => decodeEntities(html.replace(/<script[\s\S]*?<\/script>|<[^>]*>/g, ' ')).replace(/\s+/g, ' ');

/**
 * An edition's dates from its article: the infobox's "| date = 14–17 May", its
 * "{{Start date|2026|11|22}}", or else the first "6–9 May 2026" in the text.
 */
export function articleDates(wikitext: string, year: number): [string, string] | null {
	const infobox = wikitext.match(/^\s*\|\s*date\s*=\s*([^\n]+)/im)?.[1];
	const fromInfobox = infobox && dateRange(stripWiki(infobox), year);
	if (fromInfobox) return fromInfobox;
	const start = wikitext.match(/\{\{start date\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i);
	if (start) {
		const day = `${start[1]}-${start[2].padStart(2, '0')}-${start[3].padStart(2, '0')}`;
		return [day, day];
	}
	// The edition's own year, which skips a stale infobox copied from the previous one.
	const prose = wikitext.match(new RegExp(`\\d{1,2}\\s*[–-]\\s*\\d{1,2}\\s+[A-Z][a-z]+\\s+${year}`))?.[0];
	return prose ? dateRange(prose, year) : null;
}

/** "2027 Race Week: 10th - 15th May" */
export function parseNw200(html: string) {
	const m = plain(html).match(/(\d{4}) Race Week:\s*(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/i);
	if (!m) return null;
	const [, year, first, last, month] = m;
	const from = iso(year, month, first);
	const to = iso(year, month, last);
	return from && to ? { year: Number(year), dates: [from, to] as [string, string] } : null;
}

/** "Gear Up for the 105TH Running June 27, 2027": race day only. */
export function parsePikesPeak(html: string) {
	const m = plain(html).match(/Running\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
	if (!m) return null;
	const day = iso(m[3], m[1], m[2]);
	return day ? { year: Number(m[3]), dates: [day, day] as [string, string] } : null;
}

const EVENTS: Annual[] = [
	{
		series: 'n24',
		name: (y) => `Nürburgring 24 Hours ${y}`,
		location: 'Nürburgring Nordschleife',
		article: (y) => `${y}_24_Hours_of_Nürburgring`
	},
	{
		// The article gives the main race's day; support races start earlier in the week.
		series: 'macau',
		name: (y) => `Macau Grand Prix ${y}`,
		location: 'Guia Circuit, Macau',
		article: (y) => `${y}_Macau_Grand_Prix`
	},
	{
		series: 'nw200',
		name: (y) => `North West 200 ${y}`,
		location: 'The Triangle, Portstewart, Northern Ireland',
		article: (y) => `${y}_North_West_200_Races`,
		page: 'https://www.northwest200.org/',
		parsePage: parseNw200
	},
	{
		series: 'pikespeak',
		name: (y) => `Pikes Peak International Hill Climb ${y}`,
		location: 'Pikes Peak Highway, Colorado',
		article: (y) => `${y}_Pikes_Peak_International_Hill_Climb`,
		page: 'https://www.ppihc.org/',
		parsePage: parsePikesPeak
	}
];

function annualSource(e: Annual): Source {
	const event = (year: number, dates: [string, string], url: string): MotorEvent => ({
		id: `${e.series}-${year}`,
		series: e.series,
		name: e.name(year),
		location: e.location,
		start: dates[0],
		end: dates[1],
		allDay: true,
		sessions: [],
		url
	});
	return {
		label: e.page ? `${new URL(e.page).hostname.replace(/^www\./, '')} + Wikipedia` : 'Wikipedia (event article)',
		series: [e.series],
		async load(years) {
			const [articles, next] = await Promise.all([
				Promise.all(years.map((year) => fetchWikitext(e.article(year)))),
				e.page && e.parsePage
					? fetchText(e.page).then(e.parsePage, (error: unknown) => {
						console.warn(`[${e.series}] home page unavailable:`, error instanceof Error ? error.message : error);
						return null;
					})
					: null
			]);
			const events = new Map<number, MotorEvent>();
			years.forEach((year, i) => {
				const dates = articles[i] && articleDates(articles[i], year);
				if (dates) events.set(year, event(year, dates, `https://en.wikipedia.org/wiki/${e.article(year)}`));
			});
			// The organiser's dates win over the article's.
			if (next && years.includes(next.year)) events.set(next.year, event(next.year, next.dates, e.page!));
			return [...events.values()];
		}
	};
}

export const annualSources = EVENTS.map(annualSource);

/**
 * The TrialGP home page lists the season's calendar: "#1", a flag, "16-18 April 2027" and the
 * country. Unnumbered entries, such as the Trial des Nations, are not championship rounds.
 */
export function parseTrialCalendar(html: string): MotorEvent[] {
	const events: MotorEvent[] = [];
	for (const block of html.split('id="calvenue">').slice(1)) {
		const round = block.match(/^#(\d+)</)?.[1];
		const dateText = block.match(/id="caldate">([^<]*)</)?.[1] ?? '';
		// Some rows nest a second country cell inside the first; the inner one has the text.
		const country = [...block.slice(0, block.indexOf('calendar-list')).matchAll(/id="calbled">([^<]+)</g)].at(-1)?.[1];
		const year = Number(dateText.match(/\d{4}/)?.[0]);
		const dates = year ? dateRange(dateText.replace(/(\d)-(\d)/, '$1–$2'), year) : null;
		// The page misspells Italy.
		const name = decodeEntities(country ?? '').trim().replace(/^Itlay$/, 'Italy').replace(/^U\.S\.A$/, 'USA');
		if (!round || !dates || !name) continue;
		events.push({
			id: `trialgp-${year}-${round}`,
			series: 'trialgp',
			name: `TrialGP of ${name}`,
			round: Number(round),
			location: name,
			start: dates[0],
			end: dates[1],
			allDay: true,
			sessions: [],
			url: 'https://www.trialgp.com/calendar/'
		});
	}
	return events;
}

export const trialgp: Source = {
	label: 'trialgp.com',
	series: ['trialgp'],
	async load(years) {
		const events = parseTrialCalendar(await fetchText('https://www.trialgp.com/'));
		if (events.length === 0) throw new Error('no rounds on calendar');
		return events.filter((e) => years.includes(Number(e.start.slice(0, 4))));
	}
};

/**
 * The FIA rallycross site lists the season in sections ("2026 CALENDAR", "2026 FIA Rallycross
 * World Cup"), each event with a name, the venue and "09 - 10 May".
 */
export function parseRallycross(html: string): MotorEvent[] {
	const events: MotorEvent[] = [];
	for (const section of html.split(/<section\b/).slice(1)) {
		const year = Number(section.match(/widget-title">\s*(\d{4})/)?.[1]);
		if (!year) continue;
		const items = section.matchAll(/event-name">([\s\S]*?)<\/span><\/span>[\s\S]*?more-items-text">([^<]*)<\/p>\s*<div class="more-items-long-text">([^<]*)<\/div>/g);
		for (const [, title, venue, dateText] of items) {
			const [series, country] = title.split(/<br\s*\/?>/).map((part) => plain(part).trim());
			const dates = dateRange(dateText.replace(/(\d)\s*-\s*(\d)/, '$1–$2'), year);
			if (!series || !country || !dates) continue;
			// "Euro RX Of LATVIA" -> "Euro RX of Latvia"
			const place = country.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
			// Title sponsors go: "Kárai Trans Euro RX Of" -> "Euro RX of".
			const event = series.replace(/^.*?(?=Euro RX)/i, '').replace(/\bOf$/i, 'of');
			const name = /world cup/i.test(series) ? `FIA Rallycross World Cup ${place}` : `${event} ${place}`;
			events.push({
				id: `rallycross-${year}-${place.toLowerCase().replace(/\W+/g, '-')}`,
				series: 'rallycross',
				name,
				location: `${decodeEntities(venue).trim()}, ${place}`,
				start: dates[0],
				end: dates[1],
				allDay: true,
				sessions: [],
				url: 'https://www.fia-rallycross.com/calendar'
			});
		}
	}
	return events;
}

export const rallycross: Source = {
	label: 'fia-rallycross.com',
	series: ['rallycross'],
	async load(years) {
		const events = parseRallycross(await fetchText('https://www.fia-rallycross.com/calendar'));
		if (events.length === 0) throw new Error('no events on calendar');
		return events.filter((e) => years.includes(Number(e.start.slice(0, 4))));
	}
};
