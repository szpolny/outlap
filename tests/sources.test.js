import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, wiki, sro, seasons, bsb, supercars, supercross, mxgp, iomtt, nls, events;
before(async () => {
	server = await createServer({ configFile: false, logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
	wiki = await server.ssrLoadModule('/src/lib/server/sources/wikipedia.ts');
	sro = await server.ssrLoadModule('/src/lib/server/sources/sro.ts');
	seasons = await server.ssrLoadModule('/src/lib/server/sources/seasons.ts');
	bsb = await server.ssrLoadModule('/src/lib/server/sources/bsb.ts');
	supercars = await server.ssrLoadModule('/src/lib/server/sources/supercars.ts');
	supercross = await server.ssrLoadModule('/src/lib/server/sources/supercross.ts');
	mxgp = await server.ssrLoadModule('/src/lib/server/sources/mxgp.ts');
	iomtt = await server.ssrLoadModule('/src/lib/server/sources/iomtt.ts');
	nls = await server.ssrLoadModule('/src/lib/server/sources/nls.ts');
	events = await server.ssrLoadModule('/src/lib/server/sources/events.ts');
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

test('Supercars schedules keep only the championship, without sponsors or test days', () => {
	const session = (name, type, start, end, series) =>
		({ name, type, startDate: start, endDate: end, series: { natsoftSeriesId: series } });
	const payload = JSON.stringify(['$', 'div', null, { schedules: [
		session('Practice 1', 'Practice', '2026-10-23T11:05:00.000+10:00', '2026-10-23T11:30:00.000+10:00', 'PCC'),
		session('Pre-enduro Cup Test Day - Session 1', 'Practice', '2026-10-22T08:30:00.000+10:00', null, 'SG3'),
		session('Boost Mobile Qualifying (Race 31)', 'Qualifying', '2026-10-23T16:05:00.000+10:00', '2026-10-23T16:40:00.000+10:00', 'SG3'),
		session('Boost Mobile TTSO (Race 32)', 'Qualifying', '2026-10-25T12:05:00.000+10:00', '2026-10-25T12:40:00.000+10:00', 'SG3'),
		session('Race 31', 'Race', '2026-10-24T15:15:00.000+10:00', null, 'SG3')
	] }]);
	// The server component payload is a JS string inside a script tag.
	const html = `<script>self.__next_f.push([1,${JSON.stringify(`26:${payload}\n`)}])</script>`;
	assert.deepEqual(supercars.parseSchedule(html).map((s) => [s.name, s.kind, s.start, s.estimatedEnd]), [
		['Qualifying (Race 31)', 'qualifying', '2026-10-23T06:05:00.000Z', false],
		['Top Ten Shootout (Race 32)', 'qualifying', '2026-10-25T02:05:00.000Z', false],
		['Race 31', 'race', '2026-10-24T05:15:00.000Z', true]
	]);
	assert.equal(supercars.eventName('2026 Penrite Oil Sandown 500', '2026-sandown'), 'Sandown 500');
	assert.equal(supercars.eventName('2026 ITM Taupō Super 440', '2026-taupo'), 'Taupō Super 440');
	assert.equal(supercars.eventName('2026 Melbourne SuperSprint', '2026-melbourne-supersprint'), 'Melbourne SuperSprint');
	assert.equal(supercars.eventName('2026 AirTouch 500 at The Bend', '2026-the-bend'), 'AirTouch 500 at The Bend');
});

test('Supercross tickets list Supercross rounds and their schedules in the venue time zone', () => {
	const ticket = (round, city, date, classes, tz, slug) => `<div class="ticket"><div class="ticket-info__title">
		<div>Round ${round}</div><div>${city}</div><div>${date}</div></div>
		<div class="ticket-info__venue"><div>Stadium</div></div>
		<div class="ticket-info__classes" style="display:flex;">${classes}</div>
		${slug ? `<a href="https://www.supercrosslive.com/tickets/${slug}/">More</a>` : ''}
		<a href="https://www.supercrosslive.com/wp-admin/admin-ajax.php?action=felds_download_ics&#038;timezone=${tz}">ICS</a></div>`;
	const rounds = supercross.parseTickets(ticket(6, 'Glendale, AZ', 'Mar 13, 2027', '450SX / 250SX W', 'America%2FPhoenix', 'glendale-az/mar-13-2027') +
		ticket(18, 'Pala, CA', 'May 29, 2027', '450MX / 250MX', 'America%2FLos_Angeles'));
	assert.deepEqual(rounds.map((r) => [r.round, r.city, r.date, r.timeZone]), [[6, 'Glendale', '2027-03-13', 'America/Phoenix']]);
	const item = (time, title) => `<div class="item"><div class="item-time">${time}</div><div class="item-title">${title}</div></div>`;
	const sessions = supercross.parseSchedule(item('9 a.m. - 3 p.m. MT', 'FanFest') + item('3:30 p.m. MT', 'Opening Ceremonies') +
		item('4 p.m. MT', 'Main Event'), rounds[0]);
	// Arizona stays on standard time after the clocks change elsewhere.
	assert.deepEqual(sessions.map((s) => [s.name, s.kind, s.start]), [
		['Opening Ceremonies', 'other', '2027-03-13T22:30:00.000Z'],
		['Main Event', 'race', '2027-03-13T23:00:00.000Z']
	]);
});

test('MXGP calendars read the season from ticket links and stop where the list repeats', () => {
	const entry = (category, date, place, venue) => `<li class="" data-id="${category}"><div rel=0><div class="flag"></div><div class="date">${date}</div><div class="destination"><a href="/tracks/x">${
		place ? `<span class="country_prefix">MXGP of </span>${place}` : 'FIM Junior Motocross World Championship'}</a><span class="venue_name">${venue}</span></div></div></li>`;
	const html = `<a href="https://my.weezevent.com/mxgp-of-france-vip-2027?x=1">VIP</a>` +
		entry('9', '28 Feb', 'Andalucia', 'Almonte') + entry('9', '04 Apr', 'Sardegna (ITA)', 'Riola Sardo') +
		entry('9', '18 Jul', '', 'Parnu') + entry('9', '03 Oct', 'Switzerland', 'TBA') + entry('7', '28 Feb', 'Andalucia', 'Almonte') +
		entry('9', '28 Feb', 'Andalucia', 'Almonte');
	assert.deepEqual(mxgp.parseCalendar(html).map((e) => [e.id, e.name, e.location, e.start]), [
		['mxgp-2027-1', 'MXGP of Andalucia', 'Almonte', '2027-02-28'],
		['mxgp-2027-2', 'MXGP of Sardegna', 'Riola Sardo', '2027-04-04'],
		['mxgp-2027-3', 'MXGP of Switzerland', undefined, '2027-10-03']
	]);
});

test('past TT editions come from the dates in their article infobox', () => {
	const event = iomtt.parseArticle('{{Infobox Isle of Man TT races\n| year = 2026\n| date     = 25 May – 6 June 2026\n}}', 2026);
	assert.deepEqual([event.id, event.start, event.end, event.allDay], ['iomtt-2026', '2026-05-25', '2026-06-06', true]);
	assert.equal(iomtt.parseArticle('{{Infobox Isle of Man TT races\n| date = TBA\n}}', 2027), null);
});

test('NLS calendars keep race names and join the two-day 24h Qualifiers', () => {
	const row = (date, race) => `<tr>\n<td>${date}</td>\n<td>${race}</td>\n</tr>`;
	const html = row('14.03.2026', 'NLS1: 71. ADAC Westfalenfahrt (4h)') + row('18.-19.04.2026', 'ADAC 24h Qualifiers (2x4h)') +
		row('01.08.2026', 'NLS7: KW 6h ADAC Ruhr-Pokal-Rennen');
	assert.deepEqual(nls.parseCalendar(html, 2026).map((e) => [e.id, e.name, e.round, e.start, e.end]), [
		['nls-2026-1', '71. ADAC Westfalenfahrt', 1, '2026-03-14', '2026-03-14'],
		['nls-2026-adac-24h-qualifiers', 'ADAC 24h Qualifiers', undefined, '2026-04-18', '2026-04-19'],
		['nls-2026-7', 'KW 6h ADAC Ruhr-Pokal-Rennen', 7, '2026-08-01', '2026-08-01']
	]);
});

test('a caption spanning the table is not taken for its header row', () => {
	const wikitext = `==Schedule==
{|class="wikitable"
|-
!colspan="3"|2026 Schedule
|-
!Date
!Race
!Site
|-
|March 5–8
|Gatornationals
|Gainesville Raceway
|}`;
	assert.deepEqual(wiki.tableGrid(wikitext, /==\s*Schedule\s*==/), [{ Date: 'March 5–8', Race: 'Gatornationals', Site: 'Gainesville Raceway' }]);
});

test('one-off events read their dates from the article or the organiser', () => {
	assert.deepEqual(events.articleDates('{{Infobox\n| year = 2026\n| date = 14–17 May\n}}', 2026), ['2026-05-14', '2026-05-17']);
	assert.deepEqual(events.articleDates('| Fulldate = {{Start date|2026|11|22|df=y}}', 2026), ['2026-11-22', '2026-11-22']);
	// A stale infobox copied from the previous edition is passed over for the edition's own year.
	assert.deepEqual(events.articleDates("|''Date''\n|6-9 May 2025\n|}\nIt took place between 6–9 May 2026.", 2026), ['2026-05-06', '2026-05-09']);
	assert.deepEqual(events.parseNw200('<span>2027 Race Week: 10th – 15th May</span>'), { year: 2027, dates: ['2027-05-10', '2027-05-15'] });
	assert.deepEqual(events.parsePikesPeak('<h2>Gear Up for the 105TH Running</h2> <p>June 27, 2027</p>'), { year: 2027, dates: ['2027-06-27', '2027-06-27'] });
	assert.equal(events.parsePikesPeak('<p>Tickets on sale</p>'), null);
});

test('TrialGP calendars keep numbered rounds and read nested country cells', () => {
	const row = (round, date, country, nested) => `<div class="calendar-line"><div id="calvenue">${round}</div>
<div id="calflag"><img src="x.png" /></div>
<div id="caldate">${date}</div>
${nested ? `<div id="calbled">\n<div id="calbled">${country}</div>\n<div id="calfmn">X</div>\n</div>` : `<div id="calbled">${country}</div>\n<div id="calfmn">X</div>`}
</div><div class="fusion-text calendar-list"><p>FIM Trial World Championships</p></div>`;
	const html = row('#1', '16-18 April 2027', 'Spain') + row('#3', '21-23 May 2027', 'U.S.A', true) +
		row('#6', '25-27 June 2027', 'Itlay') + row('', '25-26 September 2027*', 'France', true);
	assert.deepEqual(events.parseTrialCalendar(html).map((e) => [e.id, e.name, e.start, e.end]), [
		['trialgp-2027-1', 'TrialGP of Spain', '2027-04-16', '2027-04-18'],
		['trialgp-2027-3', 'TrialGP of USA', '2027-05-21', '2027-05-23'],
		['trialgp-2027-6', 'TrialGP of Italy', '2027-06-25', '2027-06-27']
	]);
});

test('rallycross calendars name Euro RX events without sponsors and include the World Cup', () => {
	const item = (title, venue, dates) => `<li class="more-items-item"><div class="wrapper"><h2><a href="#" class="more-items-title">
		<span class="flag-icon"></span><span class="event-name">${title}</span></span></a></h2>
		<p class="more-items-text">${venue}</p>
		<div class="more-items-long-text">${dates}</div></div></li>`;
	const section = (title, items) => `<section id="home-calendar" class="widget"><h2 class="widget-title">\n ${title} </h2><ul>${items}</ul></section>`;
	const html = section('2026 CALENDAR', item('Kárai Trans Euro RX Of<br><span class="city"> HUNGARY', 'Nyirád', '30 - 31 May')) +
		section('2026 FIA Rallycross World Cup', item('FIA World Cup<br><span class="city">INDONESIA', 'Jakarta', '05 - 06 Dec'));
	assert.deepEqual(events.parseRallycross(html).map((e) => [e.name, e.location, e.start, e.end]), [
		['Euro RX of Hungary', 'Nyirád, Hungary', '2026-05-30', '2026-05-31'],
		['FIA Rallycross World Cup Indonesia', 'Jakarta, Indonesia', '2026-12-05', '2026-12-06']
	]);
});
