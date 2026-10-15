import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, wiki, sro;
before(async () => {
	server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
	wiki = await server.ssrLoadModule('/src/lib/server/sources/wikipedia.ts');
	sro = await server.ssrLoadModule('/src/lib/server/sources/sro.ts');
});
after(async () => { await server?.close(); });

test('date ranges read the formats used in season articles', () => {
	assert.deepEqual(wiki.dateRange('10–11 April', 2027), ['2027-04-10', '2027-04-11']);
	assert.deepEqual(wiki.dateRange('30 July – 2 August', 2026), ['2026-07-30', '2026-08-02']);
	assert.deepEqual(wiki.dateRange('September 30 – October 1', 2026), ['2026-09-30', '2026-10-01']);
	assert.deepEqual(wiki.dateRange('January 10', 2026), ['2026-01-10', '2026-01-10']);
	assert.deepEqual(wiki.dateRange('{{nowrap|3–5 July}}', 2026), ['2026-07-03', '2026-07-05']);
	assert.equal(wiki.dateRange('TBA', 2026), null);
});

test('table grids fill row spans and number repeated headers', () => {
	const wikitext = `== Race calendar ==
{| class="wikitable"
|+
! colspan="2" |Round
!Circuit
!Date
|-
! rowspan="2" |1
!R1
| rowspan="2" |[[Donington Park]]
<small>(National Circuit)</small>
| 10 April
|-
!R2
| 11 April
|}`;
	const rows = wiki.tableGrid(wikitext, /==\s*Race calendar\s*==/);
	assert.equal(rows.length, 2);
	assert.equal(rows[1].Round, '1');
	assert.equal(rows[1]['Round 2'], 'R2');
	assert.match(rows[1].Circuit, /Donington Park/);
	assert.equal(rows[1].Date, '11 April');
});

test('concurrent article requests share one Wikipedia query', async (t) => {
	const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
		const titles = new URL(url).searchParams.get('titles').split('|');
		assert.deepEqual(titles, ['2026 A', '2027 A']);
		return Response.json({ query: {
			pages: [{ title: '2026 A', revisions: [{ slots: { main: { content: 'text' } } }] }, { title: '2027 A', missing: true }]
		} });
	});
	assert.deepEqual(await Promise.all([wiki.fetchWikitext('2026_A'), wiki.fetchWikitext('2027_A')]), ['text', null]);
	assert.equal(fetch.mock.callCount(), 1);
});

test('SRO calendars skip test days and timetables convert local times to UTC', () => {
	const item = (dates, name, round, href) => `<li class="past-events__list-item"><span class="past-events__piped-list-span">${dates}</span>
		<span class="past-events__piped-list-span"><strong>${name}</strong> Belgium<span class="flag"></span></span>
		<span class="past-events__piped-list-span">${round}</span>
		<a class="link-button icon-align--right" href="${href}">`;
	const meetings = sro.parseCalendar(item('19 - 20 May 2026', 'Spa - Prologue', 'Test Day', '/event/1/test') +
		item('23 - 28 June 2026', 'CrowdStrike 24 Hours of Spa', 'Round 4', '/event/2/spa'));
	assert.deepEqual(meetings.map((m) => [m.name, m.round, m.from, m.to]), [['CrowdStrike 24 Hours of Spa', '4', '2026-06-23', '2026-06-28']]);

	const table = (caption, rows) => `<caption class="timetable__caption"><span>${caption}</span></caption><tbody class="x">${
		rows.map((r) => `<tr><td>${r.join('</td><td>')}</td></tr>`).join('')}</tbody>`;
	const sessions = sro.parseTimetable(table('Thursday, 25 June', [['Free Practice 1', '10:10', '08:10'], ['Qualifying Combined', '20:00', '18:00']]) +
		table('Saturday, 27 June', [['Main Race', '16:30', '14:30']]), meetings[0]);
	assert.deepEqual(sessions.map((s) => [s.name, s.kind, s.start]), [
		['Free Practice 1', 'practice', '2026-06-25T08:10:00.000Z'],
		['Main Race', 'race', '2026-06-27T14:30:00.000Z']
	]);
	assert.equal(sessions[1].end, '2026-06-28T14:30:00.000Z');
});
