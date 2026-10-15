import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, wiki, sro, seasons, bsb;
before(async () => {
	server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
	wiki = await server.ssrLoadModule('/src/lib/server/sources/wikipedia.ts');
	sro = await server.ssrLoadModule('/src/lib/server/sources/sro.ts');
	seasons = await server.ssrLoadModule('/src/lib/server/sources/seasons.ts');
	bsb = await server.ssrLoadModule('/src/lib/server/sources/bsb.ts');
});
after(async () => { await server?.close(); });

test('date ranges read the formats used in season articles', () => {
	assert.deepEqual(wiki.dateRange('10–11 April', 2027), ['2027-04-10', '2027-04-11']);
	assert.deepEqual(wiki.dateRange('30 July – 2 August', 2026), ['2026-07-30', '2026-08-02']);
	assert.deepEqual(wiki.dateRange('September 30 – October 1', 2026), ['2026-09-30', '2026-10-01']);
	assert.deepEqual(wiki.dateRange('January 10', 2026), ['2026-01-10', '2026-01-10']);
	assert.deepEqual(wiki.dateRange('{{nowrap|3–5 July}}', 2026), ['2026-07-03', '2026-07-05']);
	assert.equal(wiki.dateRange('TBA', 2026), null);
	assert.deepEqual(wiki.dateRange('8/9 March', 2027), ['2027-03-08', '2027-03-09']);
	// Seasons spanning two years write the year out.
	assert.deepEqual(wiki.dateRange('18 December 2026', 2027), ['2026-12-18', '2026-12-18']);
	assert.deepEqual(wiki.dateRange('December 31, 2026 – January 2, 2027', 2027), ['2026-12-31', '2027-01-02']);
});

test('heading patterns can skip a table that precedes the calendar', () => {
	const wikitext = `==Schedule==
{|
! Icon
! Legend
|-
| O
| Oval
|}
{|
!Rd.
!Date
|-
!1
|March 7
|}`;
	const rows = wiki.tableGrid(wikitext, /==\s*Schedule\s*==[\s\S]*?\n\|\}/);
	assert.deepEqual(rows, [{ 'Rd.': '1', Date: 'March 7' }]);
});

test('the Dakar site header gives the next edition before Wikipedia does', () => {
	const html = `<a href="/en/discover-saudi-arabia">x</a><span class="header__date">
		01/01
		>
		01/15/2027
	</span>`;
	const event = seasons.parseDakarHome(html);
	assert.deepEqual([event.id, event.start, event.end, event.location], ['dakar-2027', '2027-01-01', '2027-01-15', 'Saudi Arabia']);
	const december = seasons.parseDakarHome('<span class="header__date">12/31 &gt; 01/14/2028</span>');
	assert.deepEqual([december.id, december.start, december.end], ['dakar-2028', '2027-12-31', '2028-01-14']);
	assert.equal(seasons.parseDakarHome('<span class="header__date"></span>'), null);
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

test('circuit rows keep the layout named in the circuit note', () => {
	const row = seasons.circuitRow('BTCC');
	const cells = (circuit) => ({ Round: '2', Circuit: circuit, Date: '25 April' });
	assert.equal(row(cells('[[Brands Hatch]]<br /><small>(Indy Circuit, [[Kent]])</small>'), 2027).location, 'Brands Hatch (Indy Circuit)');
	assert.equal(row(cells('[[Brands Hatch]]\n<small>(Grand Prix Circuit, [[Kent]])</small>'), 2027).location, 'Brands Hatch (Grand Prix Circuit)');
	const thruxton = row(cells('[[Thruxton Circuit]]<br /><small>([[Hampshire]])</small>'), 2027);
	assert.deepEqual([thruxton.name, thruxton.location], ['BTCC Thruxton Circuit', 'Thruxton Circuit']);
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

test('BSB calendars skip tests and timetables place weekdays within the round', () => {
	const card = (path, header, dates, circuit, layout) => `<div class="card round-info is-round"><a href="${path}" rel="noopener"><div class="card-divider"><div class="header">${header}</div>
		<div class="grid-x "><div class="cell small-8 details"><h3>${dates}</h3>
		<h3>${circuit}</h3>
		<p>${layout}</p></div></div></div></a>
		<div class="card-section"><a class="button expanded secondary-col" href="${path}"><span>Event Details</span></a></div></div>`;
	const rounds = bsb.parseCalendar(card('/calendar/2026/t1-donington-park', 'R&amp;G Official Test', '03 - 04 Apr', 'Donington Park', 'GP') +
		card('/calendar/2026/r6-oulton-park', 'Round 6', '31 Jul - 02 Aug', 'Oulton Park', 'International') +
		card('/calendar/2026/r9-assen', 'Round 9', '18 - 20 Sep', 'Assen', 'GP'), 2026);
	assert.deepEqual(rounds.map((r) => [r.path, r.round, r.circuit, r.start, r.end]), [
		['/calendar/2026/r6-oulton-park', 6, 'Oulton Park', '2026-07-31', '2026-08-02'],
		['/calendar/2026/r9-assen', 9, 'Assen', '2026-09-18', '2026-09-20']
	]);

	const row = (day, name, time) => `<li><div class="grid-x"><div class="cell small-3 medium-2"><strong>${day}</strong></div>
		<div class="cell auto"><span>${name}</span></div>
		<div class="cell small-3 medium-3 text-left medium-text-right"><span class="time">${time}</span></div></div></li>`;
	const html = `<div class="schedule"><ul>${row('Fri', 'Gates Open', '08:30 BST') + row('Fri', 'Free Practice 1', '11:15 CET') +
		row('Sat', 'ROKiT Oxygen Performance Qualifying 2', '13:42 CET') + row('Sun', 'Race 3', '16:00 CET') + row('Sun', 'Gates Open', 'TBC')}</ul></div>`;
	const sessions = bsb.parseTimetable(html, rounds[1]);
	// Assen keeps Dutch summer time whatever the label says.
	assert.deepEqual(sessions.map((s) => [s.name, s.kind, s.start]), [
		['Free Practice 1', 'practice', '2026-09-18T09:15:00.000Z'],
		['Qualifying 2', 'qualifying', '2026-09-19T11:42:00.000Z'],
		['Race 3', 'race', '2026-09-20T14:00:00.000Z']
	]);
	assert.equal(bsb.parseTimetable(row('Mon', 'Race 1', '13:00 BST'), rounds[0]).length, 0);
});
