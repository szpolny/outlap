import type { MotorEvent, Session } from '#lib/series.ts';
import { decodeEntities, fetchText, finalizeEvent, makeSession, mapLimit, zonedToUtc } from '../util';
import { JAPAN_TZ, findCircuit, isoDay } from './japan';
import type { Source } from './types';

// supergt.net lists the current season's rounds in its menu, and each race page has a
// per-day timetable. Only the Japanese pages carry the timetable (the English ones are also
// out of date), so session names are translated here. A round whose timetable isn't
// published yet becomes an all-day event.
const BASE = 'https://supergt.net';

interface Round {
	slug: string;
	round: number;
	/** inclusive YYYY-MM-DD */
	from: string;
	to: string;
}

/** Menu links: "Round7 オートポリス 10/17-18" */
function parseRounds(html: string, year: number): Round[] {
	const rounds = new Map<string, Round>();
	const link = /href="https:\/\/supergt\.net\/races\/([\w-]+)">Round\s*(\d+)[^<]*?(\d{1,2})\/(\d{1,2})-(?:(\d{1,2})\/)?(\d{1,2})<\/a>/g;
	for (const m of html.matchAll(link)) {
		const [, slug, round, fromMonth, fromDay, toMonth, toDay] = m;
		rounds.set(slug, {
			slug,
			round: Number(round),
			from: isoDay(year, Number(fromMonth), Number(fromDay)),
			to: isoDay(year, Number(toMonth ?? fromMonth), Number(toDay))
		});
	}
	return [...rounds.values()];
}

/** Japanese session name -> English name and default length in minutes; null for non-racing items. */
function translate(name: string, raceName: string): [string, number] | null {
	const q = name.match(/予選.*?Q(\d)/);
	if (q) return [`Qualifying ${q[1]}`, 30];
	if (/予選/.test(name)) return ['Qualifying', 60];
	if (/決勝/.test(name)) {
		const hours = (name + raceName).match(/(\d+)\s*(時間|hours?)/i);
		return ['Race', hours ? Number(hours[1]) * 60 : 120];
	}
	if (/ウォームアップ/.test(name)) return ['Warm Up', 20];
	if (/練習|専有走行/.test(name)) return ['Practice', 90];
	return null;
}

/** "2026 AUTOBACS SUPER GT Round7 AUTOPOLIS GT 3Hours RACE" -> "Autopolis GT 3 Hours Race" */
function eventName(official: string): string {
	return official
		.replace(/^.*?Round\s*\d+\s*/i, '')
		.replace(/(\d)(hours?)\b/i, '$1 $2')
		.split(/\s+/)
		.map((w) => (/^[A-Z]{3,}$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w))
		.join(' ');
}

function parseRacePage(html: string, round: Round, year: number): MotorEvent | null {
	const official = decodeEntities(html.match(/<th>大会名称<\/th>\s*<td>([^<]+)/)?.[1] ?? '');
	const place = html.match(/<title>\s*Round\s*\d+\s+([^|<]+)/)?.[1].trim() ?? '';
	const circuit = findCircuit(`${official} ${place}`);
	const name = eventName(official) || circuit?.name || `Round ${round.round}`;

	// One tab per day, then one table per day in the same order.
	const days = [...new Set([...html.matchAll(/data-target="(\d{4})-(\d{2})-(\d{2})"/g)].map((m) => m.slice(1, 4).join('-')))];
	const sessions: Session[] = [];
	html
		.split('class="table_box')
		.slice(1)
		.forEach((box, i) => {
			if (!days[i]) return;
			const [y, mo, d] = days[i].split('-').map(Number);
			// The desktop list comes first; the mobile timeline after it repeats the same items.
			const list = box.split('class="timeline')[0];
			const item = /data-from="(\d{1,2}):(\d{2})" data-to="(?:(\d{1,2}):(\d{2}))?">\s*<h6>[^<]*?SUPER GT\s*:\s*([^<]+)<\/h6>/g;
			for (const m of list.matchAll(item)) {
				const translated = translate(m[5], official);
				if (!translated) continue;
				const start = zonedToUtc(y, mo, d, Number(m[1]), Number(m[2]), JAPAN_TZ);
				const session = makeSession(translated[0], start, translated[1]);
				if (m[3]) {
					session.end = zonedToUtc(y, mo, d, Number(m[3]), Number(m[4]), JAPAN_TZ);
					session.estimatedEnd = false;
				}
				sessions.push(session);
			}
		});

	const event = {
		id: `supergt-${year}-round${round.round}`,
		series: 'supergt' as const,
		name,
		round: round.round,
		location: circuit ? `${circuit.name}, ${circuit.place}` : place || undefined,
		sessions,
		url: `${BASE}/races/${round.slug}`
	};
	if (sessions.length > 0) return finalizeEvent(event);
	return { ...event, start: round.from, end: round.to, allDay: true };
}

export const supergt: Source = {
	label: 'supergt.net',
	series: ['supergt'],
	async load(years) {
		const html = await fetchText(`${BASE}/races`);
		const year = Number(html.match(/(\d{4})\s*カレンダー/)?.[1]);
		if (!year) throw new Error('no season calendar in menu');
		if (!years.includes(year)) return [];

		const rounds = parseRounds(html, year);
		if (rounds.length === 0) throw new Error('no rounds in season calendar');
		const events = await mapLimit(rounds, 4, async (round) =>
			parseRacePage(await fetchText(`${BASE}/races/${round.slug}`), round, year)
		);
		return events.filter((e): e is MotorEvent => e !== null);
	}
};
