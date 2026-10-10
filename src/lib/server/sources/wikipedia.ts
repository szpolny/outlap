import { fetchOptional } from '../util';

// Helpers for sources that read calendar tables from Wikipedia season articles.

export const MONTHS = [
	'january', 'february', 'march', 'april', 'may', 'june',
	'july', 'august', 'september', 'october', 'november', 'december'
];

// Several sources read Wikipedia, which rate-limits bursts, so requests go one at a time.
let queue: Promise<unknown> = Promise.resolve();

/** Wikitext of an article, or null if it doesn't exist yet. */
export function fetchWikitext(page: string): Promise<string | null> {
	const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=wikitext&format=json&formatversion=2&redirects=1`;
	const result = queue.then(() => fetchOptional(url));
	queue = result.catch(() => {});
	return result.then((body) => (body && JSON.parse(body).parse?.wikitext) || null);
}

/** Plain text of a table cell. */
export function stripWiki(s: string): string {
	return s
		.replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '')
		.replace(/\{\{flagicon\|[^}]*\}\}/gi, '')
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
