export { fetchText, HttpError, mapLimit, fetchOptional } from '@szpolny/calendar-kit/fetch';
import { addMinutes } from '@szpolny/calendar-kit/dates';
export { zonedToUtc, addMinutes } from '@szpolny/calendar-kit/dates';
import type { MotorEvent, Session, SessionKind } from '#lib/series.ts';

export function guessKind(name: string): SessionKind {
	const n = name.toLowerCase();
	if (/sprint\s*(qualifying|shootout)/.test(n)) return 'qualifying';
	if (/qualif|hyperpole|shootout|pole/.test(n)) return 'qualifying';
	if (/sprint/.test(n)) return 'sprint';
	if (/practice|\bfp\d|warm.?up|test|prologue|collective/.test(n)) return 'practice';
	if (/race|grand prix|feature|\d+\s*hours?/.test(n)) return 'race';
	return 'other';
}

export function makeSession(
	name: string,
	start: string,
	durationMin: number,
	kind: SessionKind = guessKind(name)
): Session {
	const iso = new Date(start).toISOString();
	return { name, kind, start: iso, end: addMinutes(iso, durationMin), estimatedEnd: true };
}

/** Fill event start/end from its sessions; drops events without any. */
export function finalizeEvent(e: Omit<MotorEvent, 'start' | 'end' | 'allDay'>): MotorEvent | null {
	if (e.sessions.length === 0) return null;
	const sessions = [...e.sessions].sort((a, b) => a.start.localeCompare(b.start));
	return {
		...e,
		sessions,
		start: sessions[0].start,
		end: sessions.reduce((max, s) => (s.end > max ? s.end : max), sessions[0].end),
		allDay: false
	};
}

export function slugify(s: string): string {
	return s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export function decodeEntities(s: string): string {
	return s
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.trim();
}

/** "GRAND PRIX OF THE NETHERLANDS" -> "Grand Prix of the Netherlands" */
export function titleCase(s: string): string {
	const small = new Set(['of', 'the', 'and', 'de', 'del', 'la', 'di']);
	return s
		.toLowerCase()
		.split(/(\s+)/)
		.map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
		.join('')
		.replace(/\bMotogp\b/g, 'MotoGP')
		.trim();
}
