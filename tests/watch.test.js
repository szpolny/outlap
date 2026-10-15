import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, getWatchInfo, COUNTRIES, isCountry;
before(async () => {
	server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
	({ getWatchInfo } = await server.ssrLoadModule('/src/lib/watch.ts'));
	({ COUNTRIES, isCountry } = await server.ssrLoadModule('/src/lib/countries.ts'));
});
after(async () => { await server?.close(); });
const event = (series, start = '2026-10-18T19:00:00Z', name = 'Race weekend') => ({
	id: `${series}-test`, series, name, start, end: start, allDay: false,
	sessions: [{ name: 'Race', kind: 'race', start, end: start, estimatedEnd: true }]
});
const option = (info, name) => info.options.find((entry) => entry.name === name);

test('IMSA international streams respect local rights, including the US and Nordics', () => {
	const race = event('imsa');
	for (const country of ['US', 'CA', 'DK', 'PL', 'NL', 'FR', 'DE']) {
		assert.equal(option(getWatchInfo(race, country), 'IMSA on YouTube').availability, 'blocked');
	}
	const us = getWatchInfo(race, 'US');
	assert.equal(option(us, 'Peacock Premium').availability, 'available');
	const uk = getWatchInfo(race, 'GB');
	assert.equal(option(uk, 'IMSA on YouTube').availability, 'available');
	assert.equal(option(uk, 'Peacock Premium'), undefined);
	assert.equal(option(getWatchInfo(event('imsa', undefined, 'Rolex 24 at Daytona'), 'CL'), 'IMSA on YouTube').availability, 'blocked');
	assert.equal(option(getWatchInfo(event('imsa', undefined, 'Petit Le Mans'), 'CL'), 'IMSA on YouTube').availability, 'check');
});

test('INDYCAR race delays do not incorrectly block INDY NXT', () => {
	const uk = option(getWatchInfo(event('indycar'), 'GB'), 'INDYCAR LIVE');
	assert.equal(uk.availability, 'blocked');
	assert.match(uk.note, /7 days/);
	assert.equal(option(getWatchInfo(event('indynxt'), 'GB'), 'INDYCAR LIVE').availability, 'available');
	assert.equal(option(getWatchInfo(event('indycar'), 'PL'), 'INDYCAR LIVE').availability, 'available');
	assert.equal(option(getWatchInfo(event('indycar'), 'CA'), 'INDYCAR LIVE').availability, 'blocked');
	assert.equal(option(getWatchInfo(event('indynxt'), 'CA'), 'INDYCAR LIVE').availability, 'check');
	assert.equal(option(getWatchInfo(event('indynxt'), 'US'), 'INDYCAR LIVE').availability, 'blocked');
});

test('NASCAR selects the race channel, not the channel for the weekend start or another country', () => {
	const race = event('nascar', '2026-05-25T00:00:00Z'); // May 24 in the US
	race.start = '2026-05-22T16:00:00Z'; // practice
	assert.equal(getWatchInfo(race, 'US').options[0].name, 'Prime Video');
	assert.equal(getWatchInfo(event('nascar'), 'US').options[0].name, 'USA Network');
	assert.equal(getWatchInfo(event('nascar', '2026-10-25T18:00:00Z'), 'US').options[0].name, 'NBC');
	assert.equal(getWatchInfo(event('nascar', '2026-10-25T18:00:00Z'), 'US').options[0].access, 'Free');
	assert.equal(getWatchInfo(race, 'PL').options[0].name, 'Motowizja');
	assert.equal(getWatchInfo(event('nascar', '2026-12-01T00:00:00Z'), 'US').options.length, 0);
});

test('unselected, invalid and future-season countries never receive assumed live rights', () => {
	for (const country of ['', 'not-a-country', 'EU', 'pl']) assert.equal(getWatchInfo(event('imsa'), country).options.length, 0);
	const future = getWatchInfo(event('imsa', '2027-01-30T18:00:00Z'), 'US');
	assert.equal(future.currentSeason, false);
	assert.equal(future.options.length, 0);
	assert.ok(future.url.startsWith('https://'));
	assert.equal(COUNTRIES.length, 249);
	assert.equal(isCountry('PL'), true);
});

test('free account streams and conditional subscriptions are distinguished', () => {
	for (const series of ['elms', 'lemanscup']) {
		assert.equal(getWatchInfo(event(series), 'US').options[0].access, 'Free account');
		assert.equal(getWatchInfo(event(series), 'US').options[0].availability, 'available');
	}
	assert.equal(getWatchInfo(event('wec'), 'US').options[0].access, 'Subscription');
	assert.equal(option(getWatchInfo(event('f1'), 'PL'), 'F1 TV Pro / Premium').availability, 'check');
	assert.equal(option(getWatchInfo(event('f1'), 'US'), 'Apple TV').availability, 'available');
});

test('providers without logo assets retain the supported monogram fallback', async () => {
	const { WATCH_GUIDES } = await server.ssrLoadModule('/src/lib/watch.ts');
	const { providerLogo } = await server.ssrLoadModule('/src/lib/providers.ts');
	const names = new Set(Object.values(WATCH_GUIDES).flatMap((guide) => guide.options.map((entry) => entry.name)));
	for (const channel of ['FOX', 'FS1', 'TNT', 'USA Network', 'NBC', 'Prime Video']) names.add(channel);
	assert.deepEqual([...names].filter((name) => !providerLogo(name)).sort(),
		['REV TV', 'RTBF Auvio', 'Sporty TV', 'TV 2 Play', 'L’Équipe', 'RTL+', 'BandSports', 'SPOTV', 'beIN SPORTS', 'The CW', 'ITVX',
			'Disney+', 'ESPN+', 'Foxtel', 'Seven / 7plus', 'Sky Sport NZ', 'Quest'].sort());
});

test('later seasons keep series-run streams as unconfirmed, without local broadcasters', () => {
	const alms = getWatchInfo(event('alms', '2027-01-17T06:00:00Z'), 'GB');
	assert.equal(alms.currentSeason, false);
	assert.equal(alms.options[0].availability, 'check');
	const f1 = getWatchInfo(event('f1', '2027-03-14T05:00:00Z'), 'GB');
	assert.deepEqual(f1.options.map((entry) => entry.name), ['F1 TV Pro / Premium']);
	assert.equal(f1.options[0].availability, 'check');
});

test('NASCAR events without a race session use the US date of the event start', () => {
	const late = { ...event('nascar', '2026-08-16T00:30:00Z'), sessions: [] }; // Aug 15 in the US
	assert.equal(getWatchInfo(late, 'US').options[0].name, 'USA Network');
	assert.equal(getWatchInfo(late, 'US').url, getWatchInfo(late, 'US').options[0].url);
	assert.notEqual(getWatchInfo(late, 'PL').url, getWatchInfo(late, 'US').url);
});

test('country rules replace the note and link only where they apply', () => {
	const us = option(getWatchInfo(event('f1'), 'US'), 'F1 TV Pro / Premium');
	assert.equal(us.availability, 'blocked');
	assert.match(us.note, /Apple TV/);
	assert.match(option(getWatchInfo(event('indycar'), 'US'), 'INDYCAR LIVE').url, /OTT_TERRITORIES/);
	assert.equal(option(getWatchInfo(event('indynxt'), 'PL'), 'INDYCAR LIVE').url, 'https://www.indycarlive.com/');
});

test('local countries come from provider data, and worldwide streams still reach the rest', async () => {
	const { LOCAL_COUNTRIES } = await server.ssrLoadModule('/src/lib/watch.ts');
	for (const country of ['US', 'CA', 'PL', 'GB', 'JP']) assert.ok(LOCAL_COUNTRIES.has(country));
	assert.equal(LOCAL_COUNTRIES.has('IN'), true);
	assert.equal(LOCAL_COUNTRIES.has('AQ'), false);
	assert.equal(getWatchInfo(event('wec'), 'IN').options[0].name, 'FIAWEC+');
	assert.equal(option(getWatchInfo(event('supergt'), 'US'), 'RACER+').availability, 'available');
});


test('WEC includes Polish TV and HBO Sport, with a Le Mans exception only for Polsat', () => {
	const pl = getWatchInfo(event('wec'), 'PL');
	for (const name of ['Eurosport', 'Polsat Sport / Polsat Box Go', 'HBO Max', 'FIAWEC+']) {
		assert.equal(option(pl, name).availability, 'available');
	}
	assert.match(option(pl, 'HBO Max').note, /Sport add-on/);
	const leMans = getWatchInfo(event('wec', '2026-06-13T14:00:00Z', '24 Hours of Le Mans'), 'PL');
	assert.equal(option(leMans, 'Polsat Sport / Polsat Box Go').availability, 'blocked');
	assert.equal(option(leMans, 'Eurosport').availability, 'available');
	const cota = getWatchInfo(event('wec', '2026-09-06T18:00:00Z', 'Lone Star Le Mans'), 'PL');
	assert.equal(option(cota, 'Polsat Sport / Polsat Box Go').availability, 'available');
	assert.doesNotMatch(option(getWatchInfo(event('wec'), 'US'), 'HBO Max').note, /Sport add-on/);
});

test('WEC local rights stay within their territories, round evidence and season', () => {
	assert.equal(option(getWatchInfo(event('wec'), 'GB'), 'TNT Sports').availability, 'available');
	assert.equal(option(getWatchInfo(event('wec'), 'GB'), 'Eurosport'), undefined);
	assert.equal(option(getWatchInfo(event('wec'), 'DE'), 'Eurosport').availability, 'available');
	assert.equal(option(getWatchInfo(event('wec'), 'CA'), 'Eurosport'), undefined);
	assert.equal(option(getWatchInfo(event('wec'), 'JP'), 'J SPORTS').availability, 'check');
	const spa = event('wec', '2026-05-09T12:00:00Z', '6 Hours of Spa-Francorchamps');
	assert.equal(option(getWatchInfo(spa, 'JP'), 'J SPORTS').availability, 'available');
	assert.deepEqual(getWatchInfo(event('wec', '2027-06-12T14:00:00Z'), 'PL').options.map(({ name }) => name), ['FIAWEC+']);
});

test('newer series list their confirmed services and keep regional limits', () => {
	// The next Dakar falls outside the curated season, so only its own channel remains.
	const dakar = getWatchInfo(event('dakar', '2027-01-01', 'Dakar Rally 2027'), 'PL');
	assert.deepEqual(dakar.options.map((entry) => [entry.name, entry.availability]), [['Dakar on YouTube', 'check']]);

	assert.equal(option(getWatchInfo(event('btcc'), 'DE'), 'BTCC on YouTube').availability, 'available');
	assert.equal(option(getWatchInfo(event('btcc'), 'GB'), 'BTCC on YouTube').availability, 'blocked');

	const goldCoast = { ...event('supercars', '2026-10-23', 'Gold Coast 500'), location: 'Surfers Paradise Street Circuit' };
	const sandown = { ...event('supercars', '2026-11-06', 'Sandown 500'), location: 'Sandown Raceway' };
	assert.equal(option(getWatchInfo(goldCoast, 'AU'), 'Seven / 7plus').availability, 'available');
	assert.equal(option(getWatchInfo(sandown, 'AU'), 'Seven / 7plus').availability, 'blocked');
	assert.equal(option(getWatchInfo(sandown, 'AU'), 'SuperView').availability, 'blocked');

	const fe = getWatchInfo(event('formulae', '2026-12-18', 'Jeddah ePrix'), 'US');
	assert.deepEqual(fe.options.map((entry) => entry.name), ['Disney+', 'ESPN+']);
});
