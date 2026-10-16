// Time zones of venues, for sources that publish local times without an offset. Checked in
// order against a venue's name and address: specific venues first, then US states (by
// two-letter code after a comma, "Ennis, TX 75119"), then countries.

const VENUES: [RegExp, string][] = [
	[/phoenix|chandler|firebird|wild horse pass/i, 'America/Phoenix'],
	[/indianapolis|brownsburg|crawfordsville|lucas oil (indianapolis )?raceway/i, 'America/Indiana/Indianapolis'],
	[/bristol/i, 'America/New_York'],
	[/sonoma|laguna seca|monterey|long beach/i, 'America/Los_Angeles'],
	[/circuit of the americas|\bcota\b|austin|road america|elkhart|barber|birmingham/i, 'America/Chicago'],
	[/sebring|road atlanta|braselton|miami|homestead|watkins glen|virginia international|daytona/i, 'America/New_York'],
	[/phillip island|sandown|winton|calder/i, 'Australia/Melbourne'],
	[/the bend|tailem|adelaide/i, 'Australia/Adelaide'],
	[/sydney|eastern creek|bathurst|mount panorama/i, 'Australia/Sydney'],
	[/queensland raceway|ipswich|gold coast|surfers/i, 'Australia/Brisbane'],
	[/hidden valley|darwin/i, 'Australia/Darwin'],
	[/kyalami/i, 'Africa/Johannesburg'],
	[/yas marina|abu dhabi/i, 'Asia/Dubai'],
	[/dubai/i, 'Asia/Dubai'],
	[/lombok|sumbawa|samota|mandalika/i, 'Asia/Makassar'],
	// Regions that name motocross Grands Prix.
	[/andaluc[ií]a|extremadura|galicia|castilla|madrid/i, 'Europe/Madrid'],
	[/sardegna|sardinia|trentino|lombardia|toscana|emilia/i, 'Europe/Rome'],
	[/flanders|lommel/i, 'Europe/Brussels'],
	[/ziyang|shanghai/i, 'Asia/Shanghai'],
	// European circuits, often named without their country.
	[/algarve|portim[aã]o|estoril|vila real|braga/i, 'Europe/Lisbon'],
	[/catalunya|barcelona|montmel[oó]|jerez|valencia|ricardo tormo|arag[oó]n|navarra/i, 'Europe/Madrid'],
	[/paul ricard|castellet|magny.?cours|le mans|n[eé]vers|dijon|nogaro|ledenon/i, 'Europe/Paris'],
	[/spa.?francorchamps|zolder/i, 'Europe/Brussels'],
	[/zandvoort|assen/i, 'Europe/Amsterdam'],
	[/hockenheim|n[uü]rburgring|lausitzring|sachsenring|norisring|oschersleben/i, 'Europe/Berlin'],
	[/red bull ring|spielberg|salzburgring/i, 'Europe/Vienna'],
	[/misano|monza|imola|mugello|vallelunga|\benna\b|pergusa/i, 'Europe/Rome'],
	[/hungaroring|mogyor[oó]d|balaton/i, 'Europe/Budapest'],
	[/brno|most\b/i, 'Europe/Prague'],
	[/silverstone|brands hatch|donington|oulton|snetterton|thruxton|knockhill|croft|cadwell/i, 'Europe/London']
];

const STATES: Record<string, string> = Object.fromEntries([
	...['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'OH', 'MI', 'KY', 'TN']
		.map((s) => [s, 'America/New_York']),
	...['AL', 'IL', 'WI', 'MN', 'IA', 'MO', 'AR', 'LA', 'MS', 'OK', 'KS', 'NE', 'SD', 'ND', 'TX'].map((s) => [s, 'America/Chicago']),
	...['CO', 'UT', 'NM', 'WY', 'MT', 'ID'].map((s) => [s, 'America/Denver']),
	['AZ', 'America/Phoenix'],
	...['CA', 'WA', 'OR', 'NV'].map((s) => [s, 'America/Los_Angeles']),
	['IN', 'America/Indiana/Indianapolis']
]);

const STATE_NAMES: [RegExp, string][] = [
	[/california|washington|oregon|nevada/i, 'America/Los_Angeles'],
	[/colorado|utah/i, 'America/Denver'],
	[/texas|illinois|wisconsin|minnesota|iowa|missouri|oklahoma|kansas|alabama/i, 'America/Chicago'],
	[/florida|georgia|carolina|virginia|maryland|pennsylvania|new york|new jersey|connecticut|ohio|michigan|massachusetts|new hampshire/i, 'America/New_York']
];

const COUNTRIES: [RegExp, string][] = [
	[/\b(united kingdom|great britain|england|scotland|wales|northern ireland|uk|gbr?)\b/i, 'Europe/London'],
	[/\b(ireland|irl)\b/i, 'Europe/Dublin'],
	[/\b(portugal|prt|por)\b/i, 'Europe/Lisbon'],
	[/\b(spain|españa|esp)\b/i, 'Europe/Madrid'],
	[/\b(france|fra)\b/i, 'Europe/Paris'],
	[/\b(belgium|belgique|bel)\b/i, 'Europe/Brussels'],
	[/\b(netherlands|holland|nld|ned)\b/i, 'Europe/Amsterdam'],
	[/\b(germany|deutschland|deu|ger)\b/i, 'Europe/Berlin'],
	[/\b(italy|italia|ita)\b/i, 'Europe/Rome'],
	[/\b(austria|österreich|aut)\b/i, 'Europe/Vienna'],
	[/\b(hungary|hun)\b/i, 'Europe/Budapest'],
	[/\b(czech|cze)\b/i, 'Europe/Prague'],
	[/\b(poland|pol)\b/i, 'Europe/Warsaw'],
	[/\b(sweden|swe)\b/i, 'Europe/Stockholm'],
	[/\b(finland|fin)\b/i, 'Europe/Helsinki'],
	[/\b(latvia|lva)\b/i, 'Europe/Riga'],
	[/\b(turkey|t[uü]rkiye|tur)\b/i, 'Europe/Istanbul'],
	[/\b(switzerland|sui)\b/i, 'Europe/Zurich'],
	[/\b(norway|nor)\b/i, 'Europe/Oslo'],
	[/\b(slovenia|slo)\b/i, 'Europe/Ljubljana'],
	[/\b(lithuania|ltu)\b/i, 'Europe/Vilnius'],
	[/\b(estonia|est)\b/i, 'Europe/Tallinn'],
	[/\b(denmark|den)\b/i, 'Europe/Copenhagen'],
	[/\b(philippines)\b/i, 'Asia/Manila'],
	[/\b(united arab emirates|uae)\b/i, 'Asia/Dubai'],
	[/\b(saudi arabia)\b/i, 'Asia/Riyadh'],
	[/\b(bahrain)\b/i, 'Asia/Bahrain'],
	[/\b(qatar)\b/i, 'Asia/Qatar'],
	[/\b(south africa)\b/i, 'Africa/Johannesburg'],
	[/\b(japan|jpn)\b/i, 'Asia/Tokyo'],
	[/\b(korea|kor)\b/i, 'Asia/Seoul'],
	[/\b(china|chn)\b/i, 'Asia/Shanghai'],
	[/\b(macau|macao)\b/i, 'Asia/Macau'],
	[/\b(malaysia)\b/i, 'Asia/Kuala_Lumpur'],
	[/\b(thailand)\b/i, 'Asia/Bangkok'],
	[/\b(indonesia)\b/i, 'Asia/Jakarta'],
	[/\b(mexico)\b/i, 'America/Mexico_City'],
	[/\b(brazil|brasil)\b/i, 'America/Sao_Paulo'],
	[/\b(argentina)\b/i, 'America/Argentina/Buenos_Aires'],
	[/\b(new zealand)\b/i, 'Pacific/Auckland']
];

/** The IANA time zone of a venue from its name or address, if it can be told. */
export function timeZoneFor(text: string): string | undefined {
	for (const [match, zone] of VENUES) if (match.test(text)) return zone;
	const state = text.match(/,\s*([A-Z]{2})\b(?:,?\s*\d{5})?/)?.[1];
	if (state && STATES[state]) return STATES[state];
	for (const [match, zone] of STATE_NAMES) if (match.test(text)) return zone;
	for (const [match, zone] of COUNTRIES) if (match.test(text)) return zone;
	return undefined;
}
