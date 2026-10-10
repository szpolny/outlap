import type { MotorEvent, Session, SessionKind } from '#lib/series.ts';

const USER_AGENT = 'Mozilla/5.0 (compatible)';

const ATTEMPTS = 3;

/** Fetch with a per-attempt timeout, retrying timeouts, network errors and 5xx/429. */
export async function fetchText(url: string, timeoutMs = 20_000): Promise<string> {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url, {
				headers: { 'user-agent': USER_AGENT, accept: '*/*' },
				signal: AbortSignal.timeout(timeoutMs)
			});
			if (!res.ok) throw new HttpError(url, res.status);
			return await res.text();
		} catch (e) {
			const retryable = !(e instanceof HttpError) || e.status >= 500 || e.status === 429;
			if (!retryable || attempt >= ATTEMPTS) throw e;
			await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
		}
	}
}

export class HttpError extends Error {
	constructor(
		readonly url: string,
		readonly status: number
	) {
		super(`HTTP ${status} for ${url}`);
	}
}

/** Like fetchText, but resolves to null on 404 (e.g. next season not published yet). */
export async function fetchOptional(url: string): Promise<string | null> {
	try {
		return await fetchText(url);
	} catch (e) {
		if (e instanceof HttpError && e.status === 404) return null;
		throw e;
	}
}

/** Run `fn` over `items` with bounded concurrency, preserving order. */
export async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return out;
}

export function addMinutes(iso: string, minutes: number): string {
	return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

/** Convert a wall-clock time in an IANA zone to a UTC ISO string (DST-aware). */
export function zonedToUtc(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	timeZone: string
): string {
	const guess = Date.UTC(year, month - 1, day, hour, minute);
	// Offset of the zone at (approximately) that instant; iterate once to settle DST edges.
	let utc = guess - tzOffsetMs(guess, timeZone);
	utc = guess - tzOffsetMs(utc, timeZone);
	return new Date(utc).toISOString();
}

function tzOffsetMs(instant: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	}).formatToParts(new Date(instant));
	const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
	const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
	return asUtc - Math.floor(instant / 1000) * 1000;
}

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
