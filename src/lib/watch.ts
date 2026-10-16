import type { MotorEvent, SeriesId } from './series';
import { isCountry } from './countries';

export type WatchAccess = 'Free' | 'Free account' | 'Subscription' | 'TV package';
export type WatchMedium = 'Stream' | 'YouTube' | 'TV';
export interface WatchOption {
	name: string;
	url: string;
	medium: WatchMedium;
	access: WatchAccess;
	/** Coverage describes races, not a promise that every practice is televised. */
	note: string;
	countries?: string[];
	/** A provider whose exact country entitlement must be checked at checkout. */
	check?: boolean;
	/** A series-run service not tied to one season's rights deals; shown as 'check' for later seasons. */
	ongoing?: boolean;
	/** Country exceptions; the first matching rule wins. */
	rules?: WatchRule[];
}
export interface WatchRule {
	countries: string[];
	/** Limits the rule to matching events, e.g. a single round. */
	event?: (event: MotorEvent) => boolean;
	availability: ResolvedWatchOption['availability'];
	note?: string;
	url?: string;
}
export interface WatchGuide {
	url: string;
	checked: string;
	options: WatchOption[];
	/** Country-specific guide links. */
	urls?: Record<string, string>;
}
export interface ResolvedWatchOption extends WatchOption {
	availability: 'available' | 'blocked' | 'check';
}

const CHECKED = '2026-10-12';
/** Guides re-audited for the October 2026 series additions. */
const AUDITED = '2026-10-15';
/** The season the curated rights below describe. */
const SEASON = 2026;
const F1_GUIDE = 'https://www.formula1.com/en/information/f1-broadcast-information.45y3LNsT1D6VoK0ZmX8ciJ';
const F2_GUIDE = 'https://www.fiaformula2.com/en/information/where-to-watch-us-f2.5KKoOKrH2MbJlUgtRMYDQy';
const F3_GUIDE = 'https://www.fiaformula3.com/en/information/where-to-watch-us-f3.49NWzWEKNAOq0g5MI9qbgi';
const INDY_GUIDE = 'https://www.indycar.com/how-to-follow/international';
const INDY_ACCESS = 'https://www.indycar.com/-/media/Files/2026/News/OTT_TERRITORIES_2026.pdf';
const IMSA_GUIDE = 'https://www.imsa.com/internationalcoverage/';
const NASCAR_GUIDE = 'https://www.nascar.com/wp-content/uploads/sites/7/2025/11/13/2026-NationalSeriesSchedules-Times.pdf';

const stream = (name: string, url: string, access: WatchAccess, note: string, extra: Partial<WatchOption> = {}): WatchOption =>
	({ name, url, access, note, medium: 'Stream', ...extra });
const tv = (name: string, url: string, countries: string[], note = 'Live races. Check the channel schedule and your sports package.'): WatchOption =>
	({ name, url, countries, note, access: 'TV package', medium: 'TV' });
const guide = (url: string, options: WatchOption[], urls?: Record<string, string>): WatchGuide => ({ url, checked: CHECKED, options, urls });

const f1tv = stream('F1 TV Pro / Premium', 'https://f1tv.formula1.com/', 'Subscription',
	'Live sessions where Pro or Premium is sold. F1 TV Access does not include live races; check your country and plan.', { check: true, ongoing: true,
		rules: [{ countries: ['US'], availability: 'blocked', note: 'US live access is included through an eligible Apple TV subscription rather than a separate F1 TV live subscription.' }] });
const formulaTv = [
	tv('Eleven Sports', 'https://www.elevensports.pl/', ['PL']),
	tv('Sky Sports', 'https://www.skysports.com/f1', ['GB', 'IE']),
	tv('Sky Sport', 'https://www.sky.de/', ['DE', 'AT']),
	tv('Sky Sport Italia', 'https://sport.sky.it/formula-1', ['IT']),
	tv('CANAL+', 'https://www.canalplus.com/', ['FR']),
	stream('DAZN', 'https://www.dazn.com/', 'Subscription', 'Live races with the local motorsport package.', { countries: ['ES', 'AD', 'PT'] }),
	stream('Viaplay', 'https://viaplay.com/', 'Subscription', 'Live races with the local sports package.', { countries: ['NL', 'DK', 'FI', 'NO', 'SE', 'IS'] }),
	tv('TSN / RDS', 'https://www.tsn.ca/', ['CA']),
	stream('Kayo Sports', 'https://www.kayosports.com.au/', 'Subscription', 'Live races in Australia.', { countries: ['AU'] })
];
// Both support-series guides list these providers; retain only confirmed territories.
const supportTv = formulaTv.map((option) => ({
	...option,
	countries: option.countries?.filter((country) => country !== 'IE' && country !== 'AT'),
	check: true
})).filter((option) => option.countries?.length);
const apple = stream('Apple TV', 'https://www.apple.com/apple-tv/', 'Subscription', 'US live coverage; F1 TV access is included with the eligible Apple TV subscription.', { countries: ['US'] });

// IMSA reserves the international stream for markets without local TV coverage.
// Poland and the Baltics are included in the territory heading on IMSA's guide.
const imsaLocalMarkets = ['US', 'PR', 'VI', 'GU', 'AS', 'MP', 'DK', 'FI', 'SE', 'NO', 'PL', 'IS', 'EE', 'LV', 'LT', 'NL', 'CA', 'CL', 'FR', 'DE'];
const indyDelayed = ['DK', 'FI', 'FR', 'GI', 'HU', 'IE', 'MC', 'NL', 'NO', 'PT', 'ES', 'SE', 'TR', 'GB', 'JP', 'AU', 'GP', 'MQ', 'NC', 'NZ', 'PF', 'WF', 'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'DO', 'EC', 'SV', 'GT', 'HN', 'MX', 'NI', 'PA', 'PY', 'PE', 'PR', 'UY', 'VE'];
const indyBlocked = (countries: string[], note: string): WatchRule => ({ countries, availability: 'blocked', note, url: INDY_ACCESS });
const indyUnavailable = 'Live races unavailable here. Check the official country access list.';
const indyRules: WatchRule[] = [
	indyBlocked(['US'], 'Replays only in the US; use FOX Sports for live races.'),
	indyBlocked(['RU'], indyUnavailable),
	{ countries: ['PL', 'DE', 'AT', 'CH', 'IT'], availability: 'available' }
];
const indyLive = (rules: WatchRule[]) => stream('INDYCAR LIVE', 'https://www.indycarlive.com/', 'Subscription',
	'Live races, practice and qualifying. Country rights differ by session.', { check: true, ongoing: true, rules });
// The 7-day race delay applies to INDYCAR only; INDY NXT is live in those countries.
const indycarLive = indyLive([...indyRules, indyBlocked(['CA'], indyUnavailable),
	indyBlocked(indyDelayed, 'Races are delayed by 7 days here. Practice and qualifying are live; use the local broadcaster for live races.')]);
const indynxtLive = indyLive([...indyRules, { countries: indyDelayed, availability: 'available' }]);
const imsaRules: WatchRule[] = [
	// Chile's local rights cover the Rolex 24 only.
	{ countries: ['CL'], event: (event) => !/daytona|rolex 24/i.test(event.name), availability: 'check' },
	{ countries: imsaLocalMarkets, availability: 'blocked', note: 'Race livestream unavailable in this country because of local broadcast rights. Use the local broadcaster guide.' }
];
const motoPass = stream('MotoGP VideoPass', 'https://www.motogp.com/en/videopass', 'Subscription', 'Live MotoGP, Moto2 and Moto3 sessions and replays. Check your country at checkout.', { check: true, ongoing: true });
const motoOptions = [motoPass,
	tv('Polsat Sport / Polsat Box Go', 'https://polsatboxgo.pl/', ['PL']),
	tv('Sky Sport', 'https://www.sky.de/', ['DE']),
	tv('CANAL+', 'https://www.canalplus.com/', ['FR']),
	tv('FOX Sports', 'https://www.foxsports.com/motor/motogp', ['US'], 'Live Sprints and Grands Prix on FS1 or FS2, and in the FOX Sports app; COTA airs on FOX.'),
	stream('Kayo Sports', 'https://www.kayosports.com.au/', 'Subscription', 'Live coverage in Australia and Papua New Guinea.', { countries: ['AU', 'PG'] }),
	stream('DAZN', 'https://www.dazn.com/', 'Subscription', 'Live coverage in Spain.', { countries: ['ES'] }),
	stream('Viaplay', 'https://viaplay.fi/', 'Subscription', 'Live coverage in Finland.', { countries: ['FI'] }),
	stream('HBO Max / TNT Sports', 'https://www.hbomax.com/', 'Subscription', 'Live coverage with the sports add-on; check Moto2 and Moto3 listings.', { countries: ['GB'] }),
	stream('ServusTV On', 'https://www.servustv.com/', 'Free', 'Austrian race coverage. Check supporting-class listings.', { countries: ['AT'] })
];

// WBD's mainland-Europe rights; UK/Ireland use TNT Sports instead.
// Regional announcements do not establish availability in Russia or Belarus.
const wecEurope = ['AL', 'AD', 'AT', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'TR', 'UA', 'VA'];
const WEC_GUIDE = 'https://www.fiawec.com/en/page/ou-regarder-1/36';
// The official Spa distribution sheet confirms these services for that round.
// Keep other rounds conditional rather than extrapolating a season-long deal.
const wecRoundProvider = (option: WatchOption): WatchOption => ({ ...option, check: true,
	note: `${option.note} Listed for Spa 2026; check this round in the official guide.`,
	rules: [{ countries: option.countries ?? [], event: (event) => /spa/i.test(event.name) && event.start.startsWith('2026-05-'), availability: 'available' }]
});
const wecLocal = [
	{ ...tv('ORF Sport +', WEC_GUIDE, ['AT']), access: 'Free' as const },
	stream('RTBF Auvio', WEC_GUIDE, 'Free', 'Belgian race stream.', { countries: ['BE'] }),
	{ ...tv('Sporty TV', WEC_GUIDE, ['CZ']), access: 'Free' as const },
	stream('TV 2 Play', WEC_GUIDE, 'Subscription', 'Danish race stream.', { countries: ['DK'] }),
	{ ...tv("L’Équipe", WEC_GUIDE, ['FR'], 'Selected live race coverage; TV may show only part of the race.'), access: 'Free' as const },
	stream('RTL+', WEC_GUIDE, 'Subscription', 'German race stream.', { countries: ['DE'] }),
	tv('Sky Sport Italia', 'https://sport.sky.it/', ['IT']),
	tv('BandSports', WEC_GUIDE, ['BR']),
	stream('Stan Sport', 'https://www.stan.com.au/sport', 'Subscription', 'Requires Stan and the Sport add-on.', { countries: ['AU'] }),
	tv('Eurosport', 'https://www.eurosport.com/', ['IN', 'LK', 'BD', 'MV'], 'Selected live race coverage; may not include the entire race.'),
	tv('J SPORTS', 'https://www.jsports.co.jp/motor/', ['JP']),
	tv('SPOTV', WEC_GUIDE, ['KR']),
	tv('beIN SPORTS', WEC_GUIDE, ['HK', 'SG', 'MY', 'BN', 'TH', 'KH', 'LA', 'ID', 'TL', 'PH', 'NZ'])
].map(wecRoundProvider);

// SRO streams every GT World Challenge and IGTC race on its GT World channel; local TV deals
// can geoblock it, so it stays a lead to check.
const sbkPass = stream('WorldSBK VideoPass', 'https://www.worldsbk.com/en/videopass', 'Subscription', 'Live races and replays. Check the round timetable for other televised sessions and country availability.', { check: true, ongoing: true });

const gtWorld = (site: string) => guide(`${site}/live/tv-schedule`, [
	stream('GT World on YouTube', 'https://www.youtube.com/@GTWorld/streams', 'Free', 'Official live race streams. Local broadcast deals can block them; check the round’s TV schedule.', { medium: 'YouTube', check: true, ongoing: true })]);
// The newer series below link to the official site; only long-standing services are listed.
const officialOnly = (url: string) => guide(url, []);

/** Curated 2026 rights. Sources and limits are documented in docs/watching.md. */
export const WATCH_GUIDES: Record<SeriesId, WatchGuide> = {
	f1: guide(F1_GUIDE, [f1tv, ...formulaTv, apple,
		stream('Channel 4', 'https://www.channel4.com/', 'Free', 'Highlights; only the British GP is live. Check local listings.', { countries: ['GB'] }),
		stream('ORF / ServusTV', 'https://www.servustv.com/', 'Free', 'Races split between ORF and ServusTV. Check which carries this round.', { countries: ['AT'] })]),
	f2: guide(F2_GUIDE, [f1tv, ...supportTv, apple]),
	// F2/F3 guides independently confirm this shared subset of local broadcasters.
	f3: guide(F3_GUIDE, [f1tv, ...supportTv, apple]),
	indycar: guide(INDY_GUIDE, [indycarLive,
		tv('FOX', 'https://www.foxsports.com/motor/indycar', ['US'], 'All 2026 races live on FOX; free over the air where received.'),
		tv('TSN', 'https://www.tsn.ca/', ['CA']),
		tv('Sky Sports', 'https://www.skysports.com/', ['GB', 'IE', 'DE', 'AT', 'CH', 'IT']),
		stream('Stan Sport', 'https://www.stan.com.au/sport', 'Subscription', 'Live races; requires Stan and the Sport add-on.', { countries: ['AU'] }),
		stream('Viaplay', 'https://viaplay.com/', 'Subscription', 'Live races with the local sports package.', { countries: ['DK', 'FI', 'NO', 'SE'] }),
		tv('Ziggo Sport', 'https://www.ziggosport.nl/', ['NL']),
		tv('CANAL+', 'https://www.canalplus.com/', ['FR'])]),
	indynxt: guide(INDY_GUIDE, [indynxtLive,
		tv('FOX Sports', 'https://www.foxsports.com/', ['US'], 'Live races; channel varies by round.'),
		tv('Motowizja', 'https://motowizja.pl/', ['PL']),
		tv('REV TV', 'https://www.revtv.ca/', ['CA'])]),
	superformula: guide('https://superformula.net/sf3/race_/19958/', [
		stream('SFgo', 'https://superformula.net/sfgo/en/', 'Subscription', 'Global live coverage of all sessions, with English commentary.', { ongoing: true }),
		stream('ABEMA', 'https://abema.tv/', 'Free', 'Live races in Japan only.', { countries: ['JP'] }),
		tv('J SPORTS', 'https://www.jsports.co.jp/motor/', ['JP'])]),
	nascar: guide('https://www.nascar.com/international/how-to-watch', [
		tv('Motowizja', 'https://motowizja.pl/', ['PL']),
		tv('Premier Sports', 'https://www.premiersports.com/', ['GB', 'IE']),
		tv('TSN', 'https://www.tsn.ca/', ['CA']),
		tv('Sportdigital', 'https://start.sportdigital.de/', ['DE', 'AT', 'CH']),
		tv('Ziggo Sport', 'https://www.ziggosport.nl/', ['NL']),
		tv('Fox Sports', 'https://www.foxsports.com.au/', ['AU'])], { US: NASCAR_GUIDE }),
	motogp: guide('https://www.motogp.com/en/broadcasters', motoOptions),
	moto2: guide('https://www.motogp.com/en/broadcasters', motoOptions),
	moto3: guide('https://www.motogp.com/en/broadcasters', motoOptions),
	worldsbk: guide('https://prod.worldsbk.com/en/news/2026/02/19/donde-ver-worldsbk-durante-toda-la-temporada-2026x/989565', [
		sbkPass,
		tv('Eurosport', 'https://www.eurosport.com/', ['PL', 'FR']),
		tv('TNT Sports', 'https://www.tntsports.co.uk/', ['GB', 'IE']),
		stream('ServusTV', 'https://www.servustv.com/', 'TV package', 'Live coverage on ServusTV and servusmotogp.com. In Germany it needs a MagentaTV package.', { countries: ['DE', 'AT', 'CH'], check: true }),
		tv('Sky Sport Italia', 'https://sport.sky.it/', ['IT', 'MC', 'MT'], 'All WorldSBK, WorldSSP and World Sportbike races live; WorldSBK races also free on TV8 in Italy.'),
		stream('DAZN', 'https://www.dazn.com/', 'Subscription', 'Live coverage in Spain and Portugal.', { countries: ['ES', 'PT'] }),
		stream('Viaplay', 'https://viaplay.com/', 'Subscription', 'Live coverage with the local sports package.', { countries: ['NL', 'FI', 'DK', 'SE', 'NO'] }),
		tv('Fox Sports', 'https://www.foxsports.com.au/', ['AU'], 'Live races; SBS airs a highlights show.'),
		tv('J SPORTS', 'https://www.jsports.co.jp/motor/', ['JP']),
		tv('RACER Network', 'https://racer.com/', ['US']),
		tv('REV TV', 'https://www.revtv.ca/', ['CA'])]),
	sgp: guide('https://fimspeedway.com/news/fim-speedway-where-to-watch-2026', [
		stream('HBO Max', 'https://www.hbomax.com/', 'Subscription', 'Live racing with the sports package.', { countries: ['PL', 'GB', 'IE', 'DE', 'SE', 'DK', 'EE', 'LV', 'LT', 'SK', 'CZ'] }),
		tv('Eurosport 3 / Player', 'https://player.pl/', ['PL']),
		stream('RACER+', 'https://racerplus.com/', 'Subscription', 'Live Speedway GP coverage.', { countries: ['US', 'CA'] }),
		stream('FIM-MOTO.TV', 'https://fim-moto.tv/', 'Subscription', 'For countries without HBO Max or discovery+ coverage. Check your territory before subscribing.', { check: true })]),
	wec: { ...guide(WEC_GUIDE, [
		stream('FIAWEC+', 'https://plus.fiawec.com/', 'Subscription', 'Full live races worldwide, including Le Mans. The 2026 service has no race geoblocking.', { ongoing: true }),
		tv('Eurosport', 'https://www.eurosport.com/', wecEurope, 'Live WEC coverage, including Le Mans. Linear TV may show only part of a race; check the channel schedule.'),
		tv('TNT Sports', 'https://www.tntsports.co.uk/', ['GB', 'IE'], 'Live WEC coverage, including Le Mans. Check the channel schedule.'),
		{ ...tv('Polsat Sport / Polsat Box Go', 'https://polsatboxgo.pl/', ['PL'], 'Seven rounds announced for 2026, with qualifying; excludes the 24 Hours of Le Mans. Check the channel and package for this round.'),
			rules: [{ countries: ['PL'], event: (event) => /24.*(?:le mans|mans)|(?:le mans|mans).*24/i.test(event.name), availability: 'blocked', note: 'The 24 Hours of Le Mans is outside Polsat’s announced coverage. Use Eurosport, HBO Max with Sport, or FIAWEC+.' }] },
		stream('HBO Max', 'https://www.hbomax.com/', 'Subscription', 'Full live races, including Le Mans. In Poland, requires a base subscription plus the Sport add-on.', { countries: ['PL', 'US'],
			rules: [{ countries: ['US'], availability: 'available', note: 'All 2026 races live in the US; Le Mans, São Paulo and Austin also air on truTV. Check the eligible US plan.' }] }),
		...wecLocal]), checked: '2026-10-13' },
	elms: guide('https://plus.fiawec.com/en/european-le-mans-series', [
		stream('FIAWEC+', 'https://plus.fiawec.com/en/european-le-mans-series', 'Free account', 'Full live races and replays worldwide. Create a free account.', { ongoing: true })]),
	alms: guide('https://www.asianlemansseries.com/', [
		stream('Asian Le Mans Series on YouTube', 'https://www.youtube.com/@AsianLeMansSeries/streams', 'Free', 'Official race livestreams. Check the upcoming stream for this round and any local restrictions.', { medium: 'YouTube', check: true, ongoing: true })]),
	lemanscup: guide('https://plus.fiawec.com/en/michelin-le-mans-cup', [
		stream('FIAWEC+', 'https://plus.fiawec.com/en/michelin-le-mans-cup', 'Free account', 'Full live races and replays worldwide. Create a free account.', { ongoing: true })]),
	imsa: guide(IMSA_GUIDE, [
		stream('IMSA on YouTube', 'https://www.youtube.com/IMSAOfficial/streams', 'Free', 'International race stream in countries without local TV rights.', { medium: 'YouTube', rules: imsaRules }),
		stream('IMSA.TV', 'https://www.imsa.com/tvlive/', 'Free', 'International race stream with IMSA Radio commentary.', { rules: imsaRules }),
		stream('Peacock Premium', 'https://www.peacocktv.com/sports/imsa', 'Subscription', 'Full live races in the US.', { countries: ['US'] }),
		tv('NBC / USA Network', 'https://www.imsa.com/domesticcoverage/', ['US'], 'Coverage and channel vary by race; some broadcasts cover only part of an endurance race.'),
		stream('Viaplay', 'https://viaplay.com/', 'Subscription', 'Listed by IMSA for the Nordics, Poland and Baltics; confirm your local sports package.', { countries: ['DK', 'FI', 'SE', 'NO', 'PL', 'IS', 'EE', 'LV', 'LT'], check: true }),
		tv('Ziggo Sport', 'https://www.ziggosport.nl/', ['NL']),
		tv('REV TV', 'https://www.revtv.ca/', ['CA']),
		tv('Automoto La Chaîne', 'https://www.automoto-lachaine.fr/', ['FR']),
		tv('Motorvision TV', 'https://motorvision.tv/', ['DE'])]),
	dtm: guide('https://www.dtm.com/en/where-to-watch', [
		stream('DTM on YouTube', 'https://www.youtube.com/@DTM/streams', 'Free', 'English live coverage. Local broadcast rights can block the stream; check the round’s official guide.', { medium: 'YouTube', check: true, ongoing: true }),
		stream('ran.de / Joyn', 'https://www.ran.de/sport/motorsport/dtm', 'Free', 'German race coverage; check the round timetable.', { countries: ['DE'] })]),
	supergt: guide('https://supergt.net/about-super-gt/media', [
		tv('J SPORTS', 'https://www.jsports.co.jp/motor/supergt/', ['JP'], 'Live qualifying and races in Japan; subscription required.'),
		stream('RACER+', 'https://racerplus.com/', 'Subscription', 'All 2026 races live and on demand with English commentary; RACER Network airs highlights.', { countries: ['US', 'CA'] })]),
	f1academy: { ...guide('https://www.f1academy.com/', [f1tv,
		stream('F1 Academy on YouTube', 'https://www.youtube.com/@F1Academy/streams', 'Free', 'Qualifying and races live with commentary. Check the stream for this round and any local restrictions.', { medium: 'YouTube', check: true, ongoing: true })]), checked: AUDITED },
	// Season 13 (from December 2026) starts a multi-year global streaming deal; local
	// partners for it are still unannounced, so the Season 12 broadcasters are not carried over.
	formulae: { ...guide('https://www.fiaformulae.com/en/ways-to-watch', [
		stream('Disney+', 'https://www.disneyplus.com/', 'Subscription', 'Global streaming home from the 2026–27 season: every practice, qualifying and race in 100+ territories. Check your country and plan.', { check: true, ongoing: true }),
		stream('ESPN+', 'https://www.espn.com/espnplus/', 'Subscription', 'US coverage from the 2026–27 season, alongside Disney+.', { countries: ['US'], ongoing: true })]), checked: AUDITED },
	sfl: officialOnly('https://superformula.net/sf3/en/'),
	oreilly: guide('https://www.nascar.com/international/how-to-watch', [
		tv('The CW', 'https://www.cwtv.com/', ['US'], 'US home of the O’Reilly Series; some races air on other networks. Check the race listing.')]),
	truck: guide('https://www.nascar.com/international/how-to-watch', [
		tv('FS1', 'https://www.foxsports.com/motor/nascar-truck-series', ['US'], 'US home of the Truck Series; some races air on FOX. Check the race listing.')]),
	gtwce: gtWorld('https://www.gt-world-challenge-europe.com'),
	gtwca: gtWorld('https://www.gt-world-challenge-america.com'),
	gtwcasia: gtWorld('https://www.gt-world-challenge-asia.com'),
	igtc: gtWorld('https://www.intercontinentalgtchallenge.com'),
	nls: guide('https://www.nuerburgring-langstrecken-serie.de/', [
		stream('NLS livestream', 'https://www.nuerburgring-langstrecken-serie.de/', 'Free', 'Free live race stream from the series. Check the round page for the link.', { check: true, ongoing: true })]),
	btcc: { ...guide('https://www.btcc.net/', [
		stream('ITVX', 'https://www.itv.com/watch/categories/sport', 'Free', 'Live races on ITV4 and ITVX; qualifying on ITVX.', { countries: ['GB'] }),
		stream('RACER+', 'https://racerplus.com/', 'Subscription', 'Live races and on demand on RACER+ and RACER Network, including support series.', { countries: ['US', 'CA'] }),
		stream('BTCC on YouTube', 'https://www.youtube.com/@OfficialBTCC/streams', 'Free', 'Whole race day live, with support series, outside the UK and North America.', { medium: 'YouTube', ongoing: true,
			rules: [{ countries: ['GB', 'US', 'CA'], availability: 'blocked', note: 'Race-day streams are blocked here because of local rights; qualifying stays open. Use the local broadcaster.' }] })]), checked: AUDITED },
	supercars: { ...guide('https://www.supercars.com/', [
		stream('Kayo Sports', 'https://www.kayosports.com.au/', 'Subscription', 'Every session and race live in Australia.', { countries: ['AU'] }),
		tv('Foxtel', 'https://www.foxtel.com.au/', ['AU'], 'Every session live in Australia.'),
		stream('Seven / 7plus', 'https://7plus.com.au/', 'Free', 'Live free-to-air coverage of this event in Australia.', { countries: ['AU'],
			rules: [{ countries: ['AU'], event: (event) => !/sydney|townsville|bathurst|gold coast|surfers|adelaide/i.test(`${event.name} ${event.location}`), availability: 'blocked', note: 'Seven shows five events live (Sydney, Townsville, Bathurst, Gold Coast and Adelaide); check its listings for highlights of this one.' }] }),
		tv('Sky Sport NZ', 'https://www.sky.co.nz/sports', ['NZ'], 'Live coverage in New Zealand.'),
		stream('SuperView', 'https://www.supercars.com/superview', 'Subscription', 'Supercars’ own international stream of every session. Check that it is sold in your country.', { check: true, ongoing: true,
			rules: [{ countries: ['AU', 'NZ'], availability: 'blocked', note: 'Not offered here; use the local broadcaster.' }] })]), checked: AUDITED },
	// The official 2026 guide also lists a series livestream for other countries, but its
	// page gives no terms, so it is left out until it does.
	bsb: { ...guide('https://www.britishsuperbike.com/news/2026/may/1/how-to-watch-the-zyn-british-superbike-championship-in-2026', [
		tv('TNT Sports', 'https://www.tntsports.co.uk/', ['GB', 'IE'], 'Every round live. In Ireland, through a local TV provider.'),
		stream('HBO Max', 'https://www.hbomax.com/', 'Subscription', 'Every round live with the TNT Sports plan.', { countries: ['GB'] }),
		{ ...tv('Quest', 'https://www.quest.co.uk/', ['GB', 'IE'], 'Monday highlights of every round; live races at Donington Park, Snetterton, Cadwell Park and Assen.'), access: 'Free' as const },
		tv('Fox Sports', 'https://www.foxsports.com.au/', ['AU'], 'Live coverage in Australia.'),
		tv('Eurosport', 'https://www.eurosport.com/', ['IN'], 'Live coverage in India.'),
		tv('RACER Network', 'https://racer.com/', ['US', 'CA'], 'Highlights only.'),
		stream('HBO Max / Eurosport', 'https://www.hbomax.com/', 'Subscription', 'Sub-licensed in several European countries; check this round’s listing.', { countries: ['ES', 'DE', 'FR', 'IT'], check: true })]), checked: AUDITED },
	iomtt: { ...guide('https://www.iomttraces.com/latest/news/how-to-follow-tt-2026/', [
		stream('TT+ Live Pass', 'https://ttplus.iomttraces.com/', 'Subscription', 'Every qualifying session and race live, with 12 months of replays. A free TT+ account includes daily round-ups, not live racing.', { ongoing: true })]), checked: AUDITED },
	mxgp: guide('https://www.mxgp.com/', [
		stream('MXGP-TV', 'https://www.mxgp-tv.com/', 'Subscription', 'The series’ own live and on-demand service. Check your country before subscribing.', { check: true, ongoing: true })]),
	supercross: { ...guide('https://www.supercrosslive.com/', [
		stream('Peacock Premium', 'https://www.peacocktv.com/', 'Subscription', 'Live races in the US.', { countries: ['US'], check: true }),
		stream('SMX Video Pass', 'https://www.smxvideopass.com/', 'Subscription', 'Every round live and on demand outside the US, with English, Spanish and French commentary.', { ongoing: true,
			rules: [{ countries: ['US'], availability: 'blocked', note: 'Not sold in the US; use Peacock.' }] })]), checked: AUDITED },
	erc: { ...guide('https://www.fiaerc.com/', [
		stream('Rally.TV', 'https://www.rally.tv/', 'Subscription', 'The official ERC streaming home, linked from each rally’s page. Check which stages are live in your country.', { check: true, ongoing: true })]), checked: AUDITED },
	// No 2027 broadcaster list yet; coverage is mostly daily highlights because stages run far from networks.
	dakar: { ...guide('https://www.dakar.com/en/', [
		stream('Dakar on YouTube', 'https://www.youtube.com/@OfficialDakar', 'Free', 'Official daily stage highlights, not live coverage. Local TV partners are announced before each edition.', { medium: 'YouTube', ongoing: true })]), checked: AUDITED },
	// Series added in the second October 2026 batch link to their official sites; only WorldSSP
	// (covered by the WorldSBK VideoPass) and the SRO series' GT World channel are listed.
	worldssp: { ...guide('https://www.worldsbk.com/en/videopass', [sbkPass]), checked: AUDITED },
	britishgt: { ...gtWorld('https://www.britishgt.com'), checked: AUDITED },
	gtwcaus: { ...officialOnly('https://www.gt-world-challenge-australia.com/live/tv-schedule'), checked: AUDITED },
	supercup: { ...officialOnly('https://racing.porsche.com/mobil-1-supercup/about'), checked: AUDITED },
	arca: { ...officialOnly('https://www.arcaracing.com/'), checked: AUDITED },
	n24: { ...officialOnly('https://www.24h-rennen.de/en/'), checked: AUDITED },
	promx: { ...officialOnly('https://promotocross.com/'), checked: AUDITED },
	smx: { ...officialOnly('https://www.supermotocross.com/'), checked: AUDITED },
	w2rc: { ...officialOnly('https://www.worldrallyraidchampionship.com/en'), checked: AUDITED },
	rallycross: { ...officialOnly('https://www.fia-rallycross.com/'), checked: AUDITED },
	nhra: { ...officialOnly('https://www.nhra.com/'), checked: AUDITED },
	formuladrift: { ...officialOnly('https://www.formulad.com/'), checked: AUDITED },
	tcr: { ...officialOnly('https://www.fiatcrworldtour.com/'), checked: AUDITED },
	freca: { ...officialOnly('https://formularegionaleubyalpine.com/'), checked: AUDITED },
	euroformula: { ...officialOnly('https://euroformula.gtsport.es/'), checked: AUDITED },
	gb3: { ...officialOnly('https://www.gb3championship.com/'), checked: AUDITED },
	h24: { ...officialOnly('https://www.24hseries.com/'), checked: AUDITED },
	supertaikyu: { ...officialOnly('https://supertaikyu.com/'), checked: AUDITED },
	gtmasters: { ...officialOnly('https://www.adac-motorsport.de/adac-gt-masters/'), checked: AUDITED },
	macau: { ...officialOnly('https://www.macau.grandprix.gov.mo/en/'), checked: AUDITED },
	nw200: { ...officialOnly('https://northwest200.co.uk/'), checked: AUDITED },
	pikespeak: { ...officialOnly('https://ppihc.org/'), checked: AUDITED },
	trialgp: { ...officialOnly('https://www.trialgp.com/'), checked: AUDITED },
	endurogp: { ...officialOnly('https://www.endurogp.com/'), checked: AUDITED },
	wrc: guide('https://www.wrc.com/en/misc/broadcast-guide', [
		stream('Rally.TV', 'https://www.rally.tv/', 'Subscription', 'Every WRC stage live and on demand worldwide.', { ongoing: true }),
		tv('Motowizja', 'https://motowizja.pl/', ['PL'], 'Local WRC coverage. Check the stage listing for this rally.'),
		tv('TNT Sports', 'https://www.tntsports.co.uk/', ['GB', 'IE'], 'Selected stages; check the rally listing.'),
		...[stream('RACER+', 'https://racerplus.com/', 'Subscription', 'Rally coverage on RACER+ and RACER Network.', { countries: ['US', 'CA'] }),
			tv('REV TV', 'https://www.revtv.ca/', ['CA']),
			tv('Sky Sport', 'https://www.sky.de/', ['DE', 'AT', 'CH']),
			tv('Sky Sport Italia', 'https://sport.sky.it/', ['IT']),
			tv('CANAL+', 'https://www.canalplus.com/', ['FR']),
			stream('Stan Sport', 'https://www.stan.com.au/sport', 'Subscription', 'Requires Stan and the Sport add-on.', { countries: ['AU'] })]
			// WRC's broadcast guide is undated; treat these as leads until it confirms 2026.
			.map((option) => ({ ...option, check: true }))])
};

/** Countries named by at least one provider or rule; elsewhere only worldwide services apply. */
export const LOCAL_COUNTRIES: ReadonlySet<string> = new Set(Object.values(WATCH_GUIDES)
	.flatMap((guide) => guide.options.flatMap((option) => [...(option.countries ?? []), ...(option.rules ?? []).flatMap((rule) => rule.countries)])));
/** The viewing-info issue form, pre-filled with what the viewer was looking at. */
export const watchIssueUrl = (country: string, series: string[]) =>
	`https://github.com/szpolny/outlap/issues/new?${new URLSearchParams({ template: 'viewing-info.yml', country, series: series.join(', ') })}`;

// Official US Cup race listings. Use the race's US date, never the viewer's clock.
const NASCAR_CHANNELS: Record<string, { name: string; free: boolean }> = {};
for (const [channel, dates] of Object.entries({
	FOX: '02-01 02-15 02-22 03-01 04-19 04-26',
	FS1: '03-08 03-15 03-22 03-29 04-12 05-03 05-10 05-17',
	Prime: '05-24 05-31 06-07 06-14 06-21',
	TNT: '06-28 07-05 07-12 07-19 07-26',
	'USA Network': '08-09 08-15 08-23 09-06 09-13 09-19 09-27 10-04 10-11 10-18',
	NBC: '08-29 10-25 11-01 11-08'
})) for (const date of dates.split(' ')) NASCAR_CHANNELS[`${SEASON}-${date}`] = { name: channel, free: channel === 'FOX' || channel === 'NBC' };
const usDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

function nascarOptions(event: MotorEvent): WatchOption[] {
	const race = event.sessions.find((session) => session.kind === 'race');
	const channel = NASCAR_CHANNELS[usDate.format(new Date(race?.start ?? event.start))];
	if (!channel) return [];
	if (channel.name === 'Prime') return [stream('Prime Video', 'https://www.amazon.com/gp/video/storefront/', 'Subscription', 'US live coverage of this Cup race. Prime Video subscription required.', { countries: ['US'] })];
	const note = `Scheduled US channel for this race: ${channel.name}. ${channel.free ? 'Free over the air where received.' : 'TV package required.'} Practice and qualifying may use another provider.`;
	return [{ ...tv(channel.name, NASCAR_GUIDE, ['US'], note), access: channel.free ? 'Free' : 'TV package' }];
}

export function getWatchInfo(event: MotorEvent, country: string) {
	const original = WATCH_GUIDES[event.series];
	const currentSeason = Number(event.start.slice(0, 4)) === SEASON;
	const selectedCountry = isCountry(country);
	const url = original.urls?.[country] ?? original.url;
	const rules = event.series === 'nascar' ? [...nascarOptions(event), ...original.options] : original.options;
	// Later seasons keep only series-run services, unconfirmed until their rights are checked.
	const options: ResolvedWatchOption[] = !selectedCountry ? [] : rules
		.filter((option) => (currentSeason || option.ongoing) && (!option.countries || option.countries.includes(country)))
		.map((option): ResolvedWatchOption => {
			if (!currentSeason) return { ...option, availability: 'check' };
			const rule = option.rules?.find((entry) => entry.countries.includes(country) && (!entry.event || entry.event(event)));
			return {
				...option,
				availability: rule?.availability ?? (option.check ? 'check' : 'available'),
				note: rule?.note ?? option.note,
				url: rule?.url ?? option.url
			};
		});
	return { url, checked: original.checked, options, currentSeason, selectedCountry };
}
