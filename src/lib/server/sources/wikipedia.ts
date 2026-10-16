import { fetchText } from '../util';

// Helpers for sources that read calendar tables from Wikipedia season articles.

export const MONTHS = [
	'january', 'february', 'march', 'april', 'may', 'june',
	'july', 'august', 'september', 'october', 'november', 'december'
];

// Many sources read Wikipedia, which rate-limits bursts. Articles requested together are
// fetched in one query of up to 50 titles, and queries go one at a time.
const BATCH = 50;
let queue: Promise<unknown> = Promise.resolve();
const waiting = new Map<string, ((wikitext: string | null) => void)[]>();
const failures = new Map<string, (error: unknown) => void>();
let scheduled = false;

interface QueryResponse {
	query?: {
		normalized?: { from: string; to: string }[];
		redirects?: { from: string; to: string }[];
		pages: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[];
	};
}

async function fetchBatch(titles: string[]): Promise<Map<string, string | null>> {
	const params = new URLSearchParams({
		action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1',
		format: 'json', formatversion: '2', titles: titles.join('|')
	});
	const body = await fetchText(`https://en.wikipedia.org/w/api.php?${params}`);
	const { query }: QueryResponse = JSON.parse(body);
	const renamed = new Map([...(query?.normalized ?? []), ...(query?.redirects ?? [])].map((r) => [r.from, r.to]));
	const pages = new Map((query?.pages ?? []).map((page) => [page.title, page.revisions?.[0]?.slots.main.content ?? null]));
	return new Map(titles.map((title) => {
		let resolved = title;
		for (let hops = 0; renamed.has(resolved) && hops < 3; hops++) resolved = renamed.get(resolved)!;
		return [title, pages.get(resolved) ?? null];
	}));
}

function flush() {
	scheduled = false;
	const batch = [...waiting.keys()].slice(0, BATCH);
	const resolvers = new Map(batch.map((title) => [title, waiting.get(title)!]));
	const rejecters = new Map(batch.map((title) => [title, failures.get(title)!]));
	for (const title of batch) {
		waiting.delete(title);
		failures.delete(title);
	}
	if (waiting.size > 0) schedule();
	const result = queue.then(() => fetchBatch(batch));
	queue = result.catch(() => {});
	result.then(
		(texts) => resolvers.forEach((callbacks, title) => callbacks.forEach((cb) => cb(texts.get(title) ?? null))),
		(error) => rejecters.forEach((reject) => reject(error))
	);
}

function schedule() {
	if (scheduled) return;
	scheduled = true;
	// Sources start together, so their first requests share a query.
	setTimeout(flush, 10);
}

/** Wikitext of an article, or null if it doesn't exist yet. */
export function fetchWikitext(page: string): Promise<string | null> {
	const title = page.replace(/_/g, ' ');
	return new Promise((resolve, reject) => {
		waiting.set(title, [...(waiting.get(title) ?? []), resolve]);
		const previous = failures.get(title);
		failures.set(title, (error) => {
			previous?.(error);
			reject(error);
		});
		schedule();
	});
}

/** Plain text of a table cell. */
export function stripWiki(s: string): string {
	return s
		.replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '')
		.replace(/\{\{flag(?:icon|g)\|[^}]*\}\}/gi, '')
		.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
		// Keep the text of wrapping templates: {{nowrap|…}}, {{Tooltip|Rnd.|Round}}.
		.replace(/\{\{nowrap\|([^{}]*)\}\}/gi, '$1')
		.replace(/\{\{(?:tooltip|abbr)\|([^{}|]*)[^{}]*\}\}/gi, '$1')
		.replace(/\{\{[^}]*\}\}/g, '')
		.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
		.replace(/'''?/g, '')
		// leading cell attributes such as `align=center|` or `nowrap|`
		.replace(/^[^[\]{}|]*\|/, '')
		.replace(/&nbsp;/g, ' ')
		.trim();
}

/** Cells of each row of the first table after the `== heading ==` matching `heading`. */
export function tableRows(wikitext: string, heading: RegExp): string[][] {
	const start = wikitext.search(heading);
	if (start < 0) return [];
	const table = wikitext.slice(start, wikitext.indexOf('|}', start));
	return table
		.split(/\n\|-/)
		.slice(1)
		.map((row) =>
			row
				.split('\n')
				.map((l) => l.trim())
				.filter((l) => l.startsWith('|') || l.startsWith('!'))
				.map((l) => l.slice(1))
		);
}

/** Split a table cell's `attributes | content`, ignoring pipes inside links and templates. */
function splitCell(raw: string): { content: string; rowspan: number; colspan: number } {
	let depth = 0;
	for (let i = 0; i < raw.length; i++) {
		const pair = raw.slice(i, i + 2);
		if (pair === '[[' || pair === '{{') { depth++; i++; continue; }
		if (pair === ']]' || pair === '}}') { depth--; i++; continue; }
		if (raw[i] === '|' && depth === 0) {
			const attrs = raw.slice(0, i);
			// Only treat the prefix as attributes when it looks like them.
			if (!/=|^\s*nowrap\s*$/.test(attrs)) break;
			const span = (name: string) => Number(attrs.match(new RegExp(`${name}\\s*=\\s*"?(\\d+)`))?.[1] ?? 1);
			return { content: raw.slice(i + 1).trim(), rowspan: span('rowspan'), colspan: span('colspan') };
		}
	}
	return { content: raw.trim(), rowspan: 1, colspan: 1 };
}

/**
 * The first table after the text matching `heading`, as rows keyed by column header, with row and column spans
 * filled in. Cells keep their wikitext; use stripWiki for plain text.
 */
export function tableGrid(wikitext: string, heading: RegExp): Record<string, string>[] {
	// After the whole match, so a heading pattern can also skip a table that precedes the calendar.
	const match = heading.exec(wikitext);
	if (!match) return [];
	const open = wikitext.indexOf('{|', match.index + match[0].length);
	if (open < 0) return [];
	const table = wikitext.slice(open, wikitext.indexOf('\n|}', open));
	const rows = table.split(/\n\|-[^\n]*/).map((row) => {
		const cells: { header: boolean; raw: string }[] = [];
		for (const line of row.split('\n').slice(row.startsWith('{|') ? 1 : 0)) {
			const t = line.trim();
			if (t.startsWith('|+')) continue;
			if (t.startsWith('!') || t.startsWith('|')) {
				const header = t.startsWith('!');
				for (const raw of t.slice(1).split(header ? /!!|\|\|/ : /\|\|/)) cells.push({ header, raw });
			} else if (cells.length > 0 && t) {
				// A cell's content can continue on the following lines.
				cells.at(-1)!.raw += `\n${t}`;
			}
		}
		return cells;
	}).filter((cells) => cells.length > 0);

	// A caption written as a single header cell spanning the table is not the header row.
	const headerRow = rows.findIndex((cells) => cells.every((c) => c.header) && (cells.length > 1 || splitCell(cells[0].raw).colspan === 1));
	if (headerRow < 0) return [];
	const headers = rows[headerRow].flatMap((c) => {
		const { content, colspan } = splitCell(c.raw);
		return Array<string>(colspan).fill(stripWiki(content));
	});

	const grid: Record<string, string>[] = [];
	let pending: { content: string; left: number }[] = [];
	for (const cells of rows.slice(headerRow + 1)) {
		const values: string[] = [];
		const take = () => {
			while (pending[values.length]?.left > 0) {
				pending[values.length].left--;
				values.push(pending[values.length].content);
			}
		};
		for (const cell of cells) {
			take();
			const { content, rowspan, colspan } = splitCell(cell.raw);
			for (let i = 0; i < colspan; i++) {
				if (rowspan > 1) pending[values.length] = { content, left: rowspan - 1 };
				values.push(content);
			}
		}
		take();
		pending = pending.map((p) => (p?.left > 0 ? p : { content: '', left: 0 }));
		const row: Record<string, string> = {};
		// Repeated headers (a colspan) get numbered keys after the first: "Round", "Round 2".
		headers.forEach((h, i) => {
			const key = headers.indexOf(h) === i ? h : `${h} ${headers.slice(0, i + 1).filter((x) => x === h).length}`;
			row[key] = values[i] ?? '';
		});
		grid.push(row);
	}
	return grid;
}

/** First cell whose header matches `header`. */
export function column(row: Record<string, string>, header: RegExp): string | undefined {
	const key = Object.keys(row).find((k) => header.test(k));
	return key === undefined ? undefined : row[key];
}

function monthNumber(name: string): number {
	const n = name.toLowerCase();
	return n.length >= 3 ? MONTHS.findIndex((m) => m.startsWith(n)) + 1 : 0;
}

/**
 * First and last day named in a date cell: "10–11 April", "30 July – 2 August",
 * "January 10", "September 30 – October 1", "18 December 2026". A year written in the cell
 * overrides `year`, for seasons that span two. Null for "TBA" and the like.
 */
export function dateRange(cell: string, year: number): [string, string] | null {
	const text = stripWiki(cell)
		.replace(/&ndash;|—/g, '–')
		// "8/9 March"
		.replace(/(\d{1,2})\s*\/\s*(\d{1,2})(?=\s+[A-Za-z])/g, '$1–$2');
	const days: string[] = [];
	const add = (day: string, month: string, y: string | undefined) => {
		const m = monthNumber(month);
		if (m > 0) days.push(`${y ?? year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`);
	};
	const pattern =
		/(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+([A-Za-z]{3,})(?:,?\s+(\d{4}))?|([A-Za-z]{3,})\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?(?:,?\s+(\d{4}))?/g;
	for (const m of text.matchAll(pattern)) {
		if (m[3]) {
			add(m[1], m[3], m[4]);
			if (m[2]) add(m[2], m[3], m[4]);
		} else {
			add(m[6], m[5], m[8]);
			if (m[7]) add(m[7], m[5], m[8]);
		}
	}
	if (days.length === 0) return null;
	days.sort();
	return [days[0], days.at(-1)!];
}
