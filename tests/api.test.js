import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, api, openapi, SERIES_IDS;
before(async () => {
	server = await createServer({
		configFile: false, logLevel: 'error',
		optimizeDeps: { noDiscovery: true },
		server: { middlewareMode: true, hmr: false, ws: false, watch: null }
	});
	api = await server.ssrLoadModule('/src/lib/server/api.ts');
	({ openapi } = await server.ssrLoadModule('/src/lib/server/openapi.ts'));
	({ SERIES_IDS } = await server.ssrLoadModule('/src/lib/series.ts'));
});
after(async () => { await server?.close(); });

const origin = 'https://outlap.lol';
const session = (name, kind, start) => ({
	name, kind, start, end: new Date(Date.parse(start) + 3600_000).toISOString(), estimatedEnd: true
});
const events = [
	{
		id: 'f1-2026-1', series: 'f1', name: 'Australian Grand Prix', round: 1, start: '2026-03-06T01:30:00.000Z',
		end: '2026-03-08T05:00:00.000Z', allDay: false, track: 'albert-park', photo: { src: '/x.jpg' },
		sessions: [session('Practice 1', 'practice', '2026-03-06T01:30:00.000Z'), session('Race', 'race', '2026-03-08T04:00:00.000Z')]
	},
	{ id: 'dakar-2026', series: 'dakar', name: 'Dakar Rally', start: '2026-01-03', end: '2026-01-17', allDay: true, sessions: [] },
	{
		id: 'motogp-2026-1', series: 'motogp', name: 'Thailand', start: '2026-02-27T03:00:00.000Z', end: '2026-02-27T04:00:00.000Z',
		allDay: false, sessions: [session('FP1', 'practice', '2026-02-27T03:00:00.000Z')]
	}
];
const page = (params, list = events) => api.queryEvents(list, new URLSearchParams(params), origin);
const query = (params) => page(params).events;
const ids = (list) => list.map((e) => e.id);

test('events are ordered by start and keep internal fields private', () => {
	const result = query('');
	assert.deepEqual(ids(result), ['dakar-2026', 'motogp-2026-1', 'f1-2026-1']);
	const f1 = result.at(-1);
	assert.equal(f1.track, undefined);
	assert.equal(f1.photo, undefined);
	assert.equal(f1.calendarUrl, 'https://outlap.lol/calendar.ics?event=f1-2026-1');
	assert.equal('round' in result[0], false);
});

test('series, window and session filters', () => {
	assert.deepEqual(ids(query('series=f1,dakar')), ['dakar-2026', 'f1-2026-1']);
	// A bare `to` date covers the whole day; all-day ends are inclusive.
	assert.deepEqual(ids(query('from=2026-01-17&to=2026-02-27')), ['dakar-2026', 'motogp-2026-1']);
	assert.deepEqual(ids(query('from=2026-01-18&to=2026-02-26')), []);
	assert.deepEqual(ids(query('from=2026-03-08T04:30:00Z')), ['f1-2026-1']);
	assert.deepEqual(ids(query('to=2026-03-06T10:30:00%2B09:00')), ['dakar-2026', 'motogp-2026-1']);

	const races = query('sessions=races');
	assert.deepEqual(ids(races), ['dakar-2026', 'f1-2026-1'], 'timed events with no matching sessions are dropped');
	assert.deepEqual(races[1].sessions.map((s) => s.name), ['Race']);
});

test('invalid parameters are rejected with 400', () => {
	for (const params of ['series=f9', 'series=', 'series=constructor', 'sessions=toString', 'from=yesterday',
		'to=2026-03-01T10:00', 'from=2026-03-02&to=2026-03-01', 'limit=0', 'limit=501', 'limit=1.5', 'limit=ten',
		'cursor=nope', 'cursor=bnVsbA', 'cursor=%25%25']) {
		assert.throws(() => query(params), (e) => e instanceof api.ApiError && e.status === 400, params);
	}
});

test('cursor pages cover every event once, in order', () => {
	const many = Array.from({ length: 7 }, (_, i) => ({
		id: `nls-2026-${i}`, series: 'nls', name: `NLS ${i}`, start: '2026-04-11', end: '2026-04-11', allDay: true, sessions: []
	}));
	const seen = [];
	let cursor = null, pages = 0;
	do {
		const result = page(`limit=3${cursor ? `&cursor=${cursor}` : ''}`, many);
		seen.push(...ids(result.events));
		cursor = result.nextCursor;
		pages++;
	} while (cursor);
	assert.equal(pages, 3);
	assert.deepEqual(seen, ids(many), 'same-start events are split across pages by id');
	assert.equal(page('', many).nextCursor, null);
});

test('a cursor survives a snapshot refresh between pages', () => {
	const first = page('limit=1');
	assert.deepEqual(ids(first.events), ['dakar-2026']);
	const refreshed = events.filter((e) => e.id !== 'dakar-2026');
	assert.deepEqual(ids(page(`cursor=${first.nextCursor}`, refreshed).events), ['motogp-2026-1', 'f1-2026-1']);
});

test('error responses are JSON with CORS', async () => {
	const res = await api.apiResponse(() => api.findEvent(events, 'nope', origin));
	assert.equal(res.status, 404);
	assert.equal(res.headers.get('access-control-allow-origin'), '*');
	assert.deepEqual(await res.json(), { error: { status: 404, message: 'Event not found' } });
});

test('status omits upstream error messages', () => {
	const status = api.scheduleStatus({
		generatedAt: 'now', events: [],
		sources: [{ source: 'F1', series: ['f1'], ok: false, error: 'GET https://internal failed' }]
	});
	assert.deepEqual(status.sources, [{ source: 'F1', series: ['f1'], ok: false }]);
});

test('OpenAPI lists every series and resolves its schema references', () => {
	const spec = openapi(origin);
	assert.deepEqual(spec.components.schemas.SeriesId.enum, SERIES_IDS);
	assert.deepEqual(api.listSeries().map((s) => s.id), SERIES_IDS);
	const refs = JSON.stringify(spec).match(/#\/components\/schemas\/\w+/g);
	for (const ref of new Set(refs)) assert.ok(spec.components.schemas[ref.split('/').at(-1)], ref);
});
