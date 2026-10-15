import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, scrapeSchedule, SERIES_IDS, motogp;
before(async () => {
	server = await createServer({
		configFile: false, logLevel: 'error',
		// These SSR tests need neither client dependency optimization nor file watching.
		optimizeDeps: { noDiscovery: true },
		server: { middlewareMode: true, hmr: false, ws: false, watch: null },
		plugins: [{
			name: 'test-app-env',
			resolveId(id) { if (id === '$app/env') return '\0test-app-env'; },
			load(id) { if (id === '\0test-app-env') return 'export const dev = true;'; }
		}]
	});
	({ scrapeSchedule } = await server.ssrLoadModule('/src/lib/server/scrape.ts'));
	({ SERIES_IDS } = await server.ssrLoadModule('/src/lib/series.ts'));
	({ motogp } = await server.ssrLoadModule('/src/lib/server/sources/motogp.ts'));
});
after(async () => { await server?.close(); });

function snapshot(exclude = []) {
	return {
		events: [], generatedAt: '2026-10-13T00:00:00Z',
		sources: SERIES_IDS.filter((series) => !exclude.includes(series)).map((series) => ({
			series: [series], source: series, ok: true, fetchedAt: '2026-10-13T00:00:00Z'
		}))
	};
}
const event = (series) => ({
	id: `${series}-test`, series, name: 'Test', start: '2026-10-18', end: '2026-10-18',
	allDay: true, sessions: []
});

test('published empty and failed series do not trigger provider requests', async (t) => {
	const previous = snapshot();
	previous.sources[0].ok = false;
	const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected provider request'); });
	assert.equal(await scrapeSchedule(previous, { onlyMissing: true }), previous);
	assert.equal(fetch.mock.callCount(), 0);
});

test('a shared adapter adds only missing series and preserves published events and statuses', async (t) => {
	const previous = snapshot(['moto2']);
	previous.events = [event('motogp')];
	// Both scraped seasons are covered, so no provisional Wikipedia calendar is requested.
	const next = `${new Date().getUTCFullYear() + 1}-03-07`;
	const nextMoto2 = { ...event('moto2'), id: 'moto2-next', start: next, end: next };
	const load = t.mock.method(motogp, 'load', async () => [event('motogp'), event('moto2'), nextMoto2, event('moto3')]);
	const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected provider request'); });
	const result = await scrapeSchedule(previous, { onlyMissing: true });
	assert.equal(load.mock.callCount(), 1);
	assert.equal(fetch.mock.callCount(), 0);
	assert.deepEqual(result.events.map((e) => e.series), ['motogp', 'moto2', 'moto2']);
	assert.equal(result.events[0], previous.events[0]);
	assert.deepEqual(result.sources.slice(0, -1), previous.sources);
	assert.deepEqual(result.sources.at(-1).series, ['moto2']);
});

test('existing events establish coverage even without a source status', async (t) => {
	const previous = snapshot(['moto2']);
	previous.events = [event('moto2')];
	const load = t.mock.method(motogp, 'load', async () => { throw new Error('must not load'); });
	assert.equal(await scrapeSchedule(previous, { onlyMissing: true }), previous);
	assert.equal(load.mock.callCount(), 0);
});

test('a missing series failure preserves the published schedule', async (t) => {
	const previous = snapshot(['moto2']);
	previous.events = [event('motogp')];
	t.mock.method(motogp, 'load', async () => { throw new Error('provider offline'); });
	t.mock.method(console, 'error', () => {});
	const result = await scrapeSchedule(previous, { onlyMissing: true });
	assert.deepEqual(result.events, previous.events);
	assert.deepEqual(result.sources.at(-1), {
		series: ['moto2'], source: motogp.label, ok: false, error: 'provider offline', fetchedAt: undefined
	});
});

test('dev loads GitHub once for concurrent requests and reuses the snapshot', async (t) => {
	const previous = snapshot();
	const response = Response.json(previous);
	const requested = [];
	let release;
	const pending = new Promise((resolve) => { release = resolve; });
	t.after(() => release());
	const { getSchedule } = await server.ssrLoadModule('/src/lib/server/schedule.ts');
	t.mock.method(globalThis, 'fetch', async (url) => {
		requested.push(url);
		assert.equal(url, 'https://raw.githubusercontent.com/szpolny/outlap/data/schedule.json');
		await pending;
		return response;
	});
	// Keep the response pending so both readers overlap regardless of host timing.
	const concurrent = Promise.all([getSchedule(), getSchedule()]);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(requested.length, 1, 'concurrent readers share the pending fetch');
	release();
	const results = await concurrent;
	assert.deepEqual(results[0], previous);
	assert.equal(results[0], results[1]);
	assert.equal(await getSchedule(), results[0]);
	assert.equal(requested.length, 1, 'a later reader reuses the cached snapshot');
});
