export { fetchText, HttpError, mapLimit, fetchOptional } from '@szpolny/calendar-kit/fetch';
import { addMinutes } from '@szpolny/calendar-kit/dates';
import { HttpError } from '@szpolny/calendar-kit/fetch';
export { zonedToUtc, addMinutes } from '@szpolny/calendar-kit/dates';
export { slugify, decodeEntities } from '@szpolny/calendar-kit/text';
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

/** Text of each page of a PDF; unpdf is loaded only by sources that read PDFs. */
export async function fetchPdfText(url: string): Promise<string[]> {
	const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible)' }, signal: AbortSignal.timeout(30_000) });
	if (!res.ok) throw new HttpError(url, res.status);
	const { extractText, getDocumentProxy } = await import('unpdf');
	// Verbosity 0 silences pdf.js warnings about fonts it doesn't need for text.
	const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()), { verbosity: 0 });
	return (await extractText(pdf, { mergePages: false })).text;
}

/**
 * Lines of each page of a PDF, top to bottom, as their text cells left to right. Table-like
 * timetables keep their columns apart, and headings stay where they are on the page, which
 * plain text extraction can move.
 */
export async function fetchPdfLines(url: string): Promise<string[][]> {
	const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible)' }, signal: AbortSignal.timeout(30_000) });
	if (!res.ok) throw new HttpError(url, res.status);
	const { getDocumentProxy } = await import('unpdf');
	const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()), { verbosity: 0 });
	const lines: string[][] = [];
	for (let n = 1; n <= pdf.numPages; n++) {
		const { items } = await (await pdf.getPage(n)).getTextContent();
		const rows: { y: number; cells: { x: number; text: string }[] }[] = [];
		for (const item of items) {
			if (!('str' in item) || !item.str.trim()) continue;
			const [x, y] = [item.transform[4], item.transform[5]];
			let row = rows.find((r) => Math.abs(r.y - y) < 3);
			if (!row) rows.push((row = { y, cells: [] }));
			row.cells.push({ x, text: item.str.trim() });
		}
		rows.sort((a, b) => b.y - a.y);
		lines.push(...rows.map((r) => r.cells.sort((a, b) => a.x - b.x).map((c) => c.text)));
	}
	return lines;
}
