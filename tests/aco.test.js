import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, alms, wec, buildIcs, attachVenues;
before(async () => {
	server = await createServer({ configFile: false, logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
	({ alms, wec } = await server.ssrLoadModule('/src/lib/server/sources/aco.ts'));
	({ buildIcs } = await server.ssrLoadModule('/src/lib/server/ics.ts'));
	({ attachVenues } = await server.ssrLoadModule('/src/lib/server/venues.ts'));
});
after(async () => { await server?.close(); });

function racePage({ name = '4 Hours of Jerez by ALMS 2026 - 2027', start = '2027-01-15', end = '2027-01-17', sessions = '' } = {}) {
	return `<meta property="og:title" content="${name}: Schedule, News &amp; Start List | FIA WEC"/>
	<script type="application/ld+json">${JSON.stringify({
		'@type': 'SportsEvent', startDate: `${start}T12:00:00+01:00`, endDate: `${end}T12:00:00+01:00`,
		location: { name: 'Jerez-Ángel Nieto' },
		// Embedded timestamps must not turn a visibly TBC session into an official timed session.
		subEvent: [{ name: 'Race 1', startDate: `${start}T15:00:00+01:00` }]
	})}</script>${sessions}`;
}

function session(name, timestamp) {
	return `<div class="fw-bold lh-sm ">${name}</div><div class="text-primary fw-bold"><span data-timestamp="${timestamp}"></span></div>`;
}

function mockPages(t, pages) {
	const requested = [];
	t.mock.method(globalThis, 'fetch', async (url) => {
		const path = new URL(url).pathname;
		requested.push(path);
		return new Response(pages[path] ?? '', { status: path in pages ? 200 : 404 });
	});
	return requested;
}

test('winter seasons include both calendar years, deduplicate meetings and export TBC dates', async (t) => {
	const link = (slug) => `<a href="/en/race/${slug} ">Race</a>`;
	const requested = mockPages(t, {
		'/en/season/2025': link('4-hours-of-dubai-2026') + link('4-hours-of-sepang-2025'),
		'/en/season/2026': link('4-hours-of-le-castellet-by-alms-2026') + link('4-hours-of-jerez-by-alms-2027') + link('4-hours-of-jerez-by-alms-2027'),
		'/en/race/4-hours-of-dubai-2026': racePage({ name: '4 Hours of Dubai 2025 - 2026', start: '2026-01-30', end: '2026-02-01' }),
		'/en/race/4-hours-of-le-castellet-by-alms-2026': racePage({ name: '4 Hours of Le Castellet by ALMS 2026 - 2027', start: '2026-11-13', end: '2026-11-15' }),
		'/en/race/4-hours-of-jerez-by-alms-2027': racePage({ sessions: '<div class="fw-bold lh-sm ">Race 1</div><div class="text-primary fst-italic"><em>TBC</em></div>' })
	});
	const events = await alms.load([2026, 2027]);
	assert.equal(events.length, 3);
	assert.ok(events.every((e) => e.series === 'alms' && e.allDay && e.sessions.length === 0));
	assert.ok(requested.includes('/en/season/2025'));
	assert.ok(!requested.some((url) => url.includes('sepang-2025')));
	assert.equal(requested.filter((url) => url === '/en/race/4-hours-of-jerez-by-alms-2027').length, 1);
	const jerez = events[2];
	assert.equal(jerez.name, '4 Hours of Jerez 2026 - 2027');
	assert.equal(jerez.start, '2027-01-15');
	assert.equal(jerez.end, '2027-01-17');
	attachVenues([jerez]);
	assert.equal(jerez.track, 'jerez');
	const ics = buildIcs([jerez], { name: 'ALMS', sessions: 'races' });
	assert.match(ics, /DTSTART;VALUE=DATE:20270115/);
	assert.match(ics, /DTEND;VALUE=DATE:20270118/);
	assert.match(ics, /CATEGORIES:Asian Le Mans Series/);
});

test('published practice, qualifying and both races replace the all-day meeting', async (t) => {
	const start = Date.parse('2027-01-16T14:00:00Z') / 1000;
	mockPages(t, {
		'/en/season/2026': '<a href="/en/race/4-hours-of-jerez-by-alms-2027">Race</a>',
		'/en/race/4-hours-of-jerez-by-alms-2027': racePage({ sessions:
			session('Free Practice 1', start - 86400) + session('Qualifications 1 - LMP2', start - 3600) +
			session('Race 1', start) + session('Race 2', start + 86400) + session('Race 1', start)
		})
	});
	const [event] = await alms.load([2027]);
	assert.equal(event.allDay, false);
	assert.deepEqual(event.sessions.map((s) => s.kind), ['practice', 'qualifying', 'race', 'race']);
	assert.equal(event.sessions[2].start, '2027-01-16T14:00:00.000Z');
	assert.equal(event.sessions[2].end, '2027-01-16T18:00:00.000Z');
	assert.equal(event.sessions[3].end, '2027-01-17T18:00:00.000Z');
	const ics = buildIcs([event], { name: 'ALMS', sessions: 'races' });
	assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
	assert.match(ics, /-race-1@outlap/);
	assert.match(ics, /-race-2@outlap/);
});

test('unusable ALMS pages fail so the snapshot can retain its last good data', async (t) => {
	mockPages(t, {
		'/en/season/2026': '<a href="/en/race/4-hours-of-jerez-by-alms-2027">Race</a>',
		'/en/race/4-hours-of-jerez-by-alms-2027': '<meta property="og:title" content="Jerez"/>'
	});
	await assert.rejects(alms.load([2027]), /no dated meetings/);
});

test('single-year ACO sources keep their existing season and session behavior', async (t) => {
	const requested = mockPages(t, {
		'/en/season/2026': '<a href="/en/race/6-hours-of-spa-2026">Race</a>',
		'/en/race/6-hours-of-spa-2026': racePage({ name: '6 Hours of Spa 2026', sessions: session('Race', 1778335200) })
	});
	const [event] = await wec.load([2026]);
	assert.ok(!requested.includes('/en/season/2025'));
	assert.equal(event.series, 'wec');
	assert.equal(event.allDay, false);
	assert.equal(Date.parse(event.sessions[0].end) - Date.parse(event.sessions[0].start), 6 * 60 * 60 * 1000);
});
