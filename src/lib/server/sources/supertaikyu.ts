import type { MotorEvent, Session, SessionKind } from '#lib/series.ts';
import { addMinutes, decodeEntities, fetchOptional, finalizeEvent, mapLimit, zonedToUtc } from '../util';
import { JAPAN_TZ } from './japan';
import { readSeason, round, text, type Season } from './seasons';
import type { Source } from './types';
import { column, dateRange } from './wikipedia';

// The Super Taikyu calendar comes from the Wikipedia season article. supertaikyu.com has a page
// per round of the current season (race/round_01.html …) with a timetable per day: a date
// ("2026.10.24") and rows of "09:40 - 10:10" and a Japanese label, with published end times.
// Free practice, qualifying and races are kept, with the class group and race length.
const SITE = 'https://supertaikyu.com';

const season: Season = {
	// Rounds over two days list one race per day.
	series: 'supertaikyu',
	article: (y) => `${y}_Super_Taikyu_Series`,
	heading: /==\s*Calendar\s*==/i,
	row: (cells, year) => {
		const name = text(column(cells, /^event/i));
		const r = round(column(cells, /^round/i));
		if (!name || !r) return null;
		return { name, location: text(column(cells, /^circuit/i)), round: r, dates: dateRange(column(cells, /^date/i) ?? '', year) };
	}
};

/** A timetable label in English with its length in hours for races, or null for anything that isn't a session. */
export function sessionName(label: string): [string, SessionKind, number?] | null {
	// The S耐チャレンジ (Challenge) support class has its own qualifying and race.
	if (/チャレンジ/.test(label)) return null;
	const group = label.match(/Gr[.-]?\s*(\d)/i)?.[1];
	const prefix = group ? `Gr.${group} ` : '';
	if (/決勝|耐久レース$/.test(label)) {
		// "［3h］", "4時間耐久レース", "富士 24時間耐久レース"
		const hours = Number(label.match(/[［\[](\d+)\s*h[］\]]|(\d+)\s*(?:時間|hours)/i)?.slice(1).find(Boolean)) || undefined;
		const n = label.match(/Race\s*(\d)/i)?.[1];
		return [`${prefix}Race${n ? ` ${n}` : ''}${hours ? ` (${hours}h)` : ''}`, 'race', hours];
	}
	if (/予選/.test(label)) {
		// "Aドライバー", "C・Dドライバー", "CDドライバー"
		const drivers = label.match(/([A-D](?:・?[A-D])*)\s*ドライバー/)?.[1].replace(/・/g, '').split('').join('/');
		return [`${prefix}Qualifying${drivers ? ` (Driver ${drivers})` : ''}`, 'qualifying'];
	}
	if (/フリー走行|専有走行/.test(label)) return [`${prefix}Free Practice`, 'practice'];
	if (/ウォームアップ/.test(label)) return [`${prefix}Warm Up`, 'practice'];
	return null;
}

export function parseRound(html: string): Session[] {
	const sessions: Session[] = [];
	// Superseded rows are left in HTML comments.
	const page = html.replace(/<!--[\s\S]*?-->/g, '');
	for (const day of page.split('class="RaceSchedule_Date"').slice(1)) {
		const date = day.match(/^>\s*(\d{4})\.(\d{1,2})\.(\d{1,2})/);
		if (!date) continue;
		const [y, m, d] = date.slice(1).map(Number);
		const rows = day.matchAll(/RaceSchedule_Time">\s*(\d{1,2}:\d{2})\s*-\s*(翌)?\s*(\d{1,2}:\d{2})?\s*<\/div>\s*<div class="RaceSchedule_TXT">([\s\S]*?)<\/div>/g);
		for (const [, from, nextDay, to, label] of rows) {
			const known = sessionName(decodeEntities(label.replace(/<br\s*\/?>[\s\S]*$/i, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim());
			if (!known) continue;
			const at = (t: string, days = 0) =>
				new Date(Date.parse(zonedToUtc(y, m, d, Number(t.split(':')[0]), Number(t.split(':')[1]), JAPAN_TZ)) + days * 86_400_000).toISOString();
			const start = at(from);
			// Races list only their start; their length is in the name.
			const end = to ? at(to, nextDay ? 1 : 0) : known[2] ? addMinutes(start, known[2] * 60) : null;
			if (!end) continue;
			sessions.push({ name: known[0], kind: known[1], start, end, estimatedEnd: !to });
		}
	}
	return sessions;
}

export const supertaikyu: Source = {
	label: 'supertaikyu.com + Wikipedia',
	series: ['supertaikyu'],
	async load(years) {
		const [calendar, pages] = await Promise.all([
			readSeason(season, years),
			mapLimit([1, 2, 3, 4, 5, 6, 7, 8], 3, (n) => fetchOptional(`${SITE}/race/round_${String(n).padStart(2, '0')}.html`))
		]);
		const rounds = pages.map((html, i) => ({ url: `${SITE}/race/round_${String(i + 1).padStart(2, '0')}.html`, sessions: html ? parseRound(html) : [] }));
		return calendar.map((event): MotorEvent => {
			// The round page whose timetable falls on the article's race days.
			const page = rounds.find((r) => r.sessions.some((s) => s.start.slice(0, 10) >= event.start && s.start.slice(0, 10) <= event.end));
			return (page && finalizeEvent({ ...event, sessions: page.sessions, url: page.url })) || event;
		});
	}
};
