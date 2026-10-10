// Scrape every source and write the schedule snapshot served in production.
// Usage: node scripts/snapshot.js <out.json> [previous.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const [out, previousPath] = process.argv.slice(2);
if (!out) throw new Error('Usage: node scripts/snapshot.js <out.json> [previous.json]');
const previous =
	previousPath && existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, 'utf8')) : undefined;

// Load the TypeScript sources through Vite, without the SvelteKit plugin.
const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false } });
try {
	const { scrapeSchedule } = await server.ssrLoadModule('/src/lib/server/scrape.ts');
	const schedule = await scrapeSchedule(previous);
	writeFileSync(out, JSON.stringify(schedule));
	for (const s of schedule.sources) console.log(`${s.ok ? 'ok  ' : 'FAIL'} ${s.source}${s.error ? `: ${s.error}` : ''}`);
	console.log(`${schedule.events.length} events`);
	if (schedule.sources.every((s) => !s.ok)) process.exitCode = 1;
} finally {
	await server.close();
}
