import type { MotorEvent, SeriesId } from '#lib/series.ts';
import { decodeEntities, fetchOptional, finalizeEvent, guessKind, makeSession, mapLimit } from '../util';
import type { Source } from './types';

// The ACO runs WEC, ELMS and the Le Mans Cup on the same site platform. Each race page lists its
// sessions with a unix timestamp; unscheduled sessions show "TBC" instead.

type AcoSeries = Extract<SeriesId, 'wec' | 'elms' | 'lemanscup'>;

function raceMinutes(series: AcoSeries, eventName: string): number {
	// Le Mans Cup races run two hours; its Road to Le Mans support races run 55 minutes.
	if (series === 'lemanscup') return /road to le mans/i.test(eventName) ? 55 : 120;
	const hours = eventName.match(/(\d+)\s*hours?/i);
	if (hours) return Number(hours[1]) * 60;
	if (/1812\s*km/i.test(eventName)) return 10 * 60;
	return 6 * 60;
}

function sessionMinutes(name: string, series: AcoSeries, eventName: string): number {
	const kind = guessKind(name);
	if (kind === 'race') return raceMinutes(series, eventName);
	if (/hyperpole/i.test(name)) return 15;
	if (kind === 'qualifying') return 20;
	if (/test|prologue/i.test(name)) return 180;
	return 90;
}

function parseRacePage(html: string, series: AcoSeries, slug: string, base: string): MotorEvent | null {
	const title = html.match(/og:title" content="([^"]+)"/)?.[1];
	if (!title) return null;
	// "4 Hours of Portimão 2026: Schedule, News &amp; Start List | FIA WEC"
	const name = decodeEntities(title).replace(/:.*$/, '').trim();

	const sessions = [];
	const seen = new Set<string>();
	for (const block of html.split(/fw-bold lh-sm\s*">/).slice(1)) {
		const sessionName = decodeEntities(block.slice(0, block.indexOf('<')));
		// The time span directly follows the name; "TBC" sessions have no timestamp there.
		const ts = block.match(/^[^<]*<\/div>\s*<div class="text-primary[^"]*">\s*<span[^>]*data-timestamp="(\d+)"/)?.[1];
		if (!sessionName || !ts) continue;
		const start = new Date(Number(ts) * 1000).toISOString();
		const key = `${sessionName}@${start}`;
		if (seen.has(key)) continue;
		seen.add(key);
		sessions.push(
			makeSession(
				sessionName,
				start,
				sessionMinutes(sessionName, series, name),
				/^race$/i.test(sessionName) ? 'race' : undefined
			)
		);
	}

	return finalizeEvent({
		id: `${series}-${slug}`,
		series,
		name,
		sessions,
		url: `${base}/en/race/${slug}`
	});
}

function acoSource(series: AcoSeries, base: string, label: string): Source {
	return {
		label,
		series: [series],
		async load(years) {
			const slugs = new Set<string>();
			for (const year of years) {
				const html = await fetchOptional(`${base}/en/season/${year}`);
				if (!html) continue;
				for (const m of html.matchAll(/href="\/en\/race\/([a-z0-9-]+)\s*"/g)) {
					if (years.some((y) => m[1].endsWith(`-${y}`))) slugs.add(m[1]);
				}
			}
			if (slugs.size === 0) throw new Error('no race pages found on season page');

			const events = await mapLimit([...slugs], 4, async (slug) => {
				const html = await fetchOptional(`${base}/en/race/${slug}`);
				return html ? parseRacePage(html, series, slug, base) : null;
			});
			return events
				.filter((e): e is MotorEvent => e !== null)
				.sort((a, b) => a.start.localeCompare(b.start));
		}
	};
}

export const wec = acoSource('wec', 'https://www.fiawec.com', 'fiawec.com');
export const elms = acoSource('elms', 'https://www.europeanlemansseries.com', 'europeanlemansseries.com');
export const lemanscup = acoSource('lemanscup', 'https://www.lemanscup.com', 'lemanscup.com');
