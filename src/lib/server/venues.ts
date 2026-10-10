import type { EventImage, MotorEvent, SeriesId } from '#lib/series.ts';
import { decodeEntities, fetchText } from './util';

// Track outlines and venue photos, matched to events by venue. Outlines are plain SVGs in
// static/tracks/ (see static/tracks/README.md for where they come from). Photos are Wikimedia
// Commons files; the snapshot looks up their thumbnails, authors and licences.

interface Venue {
	/** tested against the event's location, name and URL */
	match: RegExp;
	/** only these series; required for series that don't race on a circuit */
	series?: SeriesId[];
	/** static/tracks/<track>.svg */
	track?: string;
	/** Commons file name */
	photo?: string;
}

const MOTO: SeriesId[] = ['motogp', 'moto2', 'moto3'];
/** Rallies and speedway meetings only match venues that name their series. */
const OFF_CIRCUIT = new Set<SeriesId>(['wrc', 'sgp']);

// First match wins, so series-specific entries come before the venue's general entry.
const VENUES: Venue[] = [
	// WRC: no single track, so just a photo of the rally.
	{ series: ['wrc'], match: /monte.?carlo/i, photo: 'Ogier_Ingrassia_2009.jpg' },
	{ series: ['wrc'], match: /sweden/i, photo: 'Jari-Matti_Latvala_2015-02-14_001.jpg' },
	{ series: ['wrc'], match: /safari|kenya/i, photo: 'Kenya_KCB_Rally_Naivasha_3.jpg' },
	{ series: ['wrc'], match: /croatia/i, photo: 'Cro-7460.jpg' },
	{ series: ['wrc'], match: /canarias|canary/i, photo: 'Rally_Islas_Canarias_2019_-_2.jpg' },
	{ series: ['wrc'], match: /portugal/i, photo: 'Sebastien_Ogier_Baiao_Rally_de_portugal_2016.jpg' },
	{ series: ['wrc'], match: /rally japan/i, photo: 'Sébastien_Loeb_-_2008_Rally_Japan_2.jpg' },
	{ series: ['wrc'], match: /acropolis/i, photo: 'Rally_Acropolis_2011-SS3.jpg' },
	{ series: ['wrc'], match: /estonia/i, photo: 'Ott_Tänak_Rally_Estonia_2021.jpg' },
	{ series: ['wrc'], match: /finland/i, photo: 'Esapekka_Lappi_Rally_Finland_2022_Rannankylä.jpg' },
	{ series: ['wrc'], match: /sardegna|sardinia/i, photo: "Chris_Atkinson_-_2008_Rally_d'Italia_Sardegna.jpg" },
	// After Sardegna, which also has "Italia" in its name.
	{ series: ['wrc'], match: /rally d.italia|\brome\b/i, photo: '2015_Rally_Italia_Sardinia_20_Paddon-Kennard.jpg' },
	{ series: ['wrc'], match: /paraguay/i, photo: 'JimHug2006.JPG' },
	{ series: ['wrc'], match: /chile/i, photo: 'Rally_Mobil_Chille_Bio_Bio_-_WRC_Concepcion_Chile.jpg' },
	{ series: ['wrc'], match: /scotland/i, photo: 'Kris_meeke_drummond_hill_2010_rally_scotland.jpg' },

	// Speedway GP: stadium photos.
	{ series: ['sgp'], match: /prague/i, photo: 'Na_Markétě_speedway,_Zvoníčkova_street,_Praha.jpg' },
	{ series: ['sgp'], match: /wroc[lł]aw/i, photo: 'Stadion_Olimpijski04.jpg' },
	{ series: ['sgp'], match: /[lł][oó]d[zź]/i, photo: 'Lodz_Moto_Arena.jpg' },
	{ series: ['sgp'], match: /riga/i, photo: 'Stadion_żużlowy_w_Rydze.jpg' },
	{ series: ['sgp'], match: /vojens/i, photo: 'VojensSpeedway.jpg' },
	{ series: ['sgp'], match: /toru[nń]/i, photo: 'Stadion_unibax2.jpg' },
	{ series: ['sgp'], match: /warsaw|warszawa/i, photo: 'National_Stadium_Warsaw_aerial_view_2.jpg' },
	{ series: ['sgp'], match: /ipswich/i, photo: 'Foxhall_stadium.jpg' },
	{ series: ['sgp'], match: /adelaide/i, photo: 'Gillman_Speedway.jpg' },

	// Road and street circuits.
	{
		match: /albert park|melbourne/i,
		track: 'albertpark',
		photo: "Albert_Park_circuit_main_straight,_pictured_from_above_teams'_garages_in_2022.jpg"
	},
	{ match: /shanghai/i, track: 'shanghai', photo: 'Shanghai_Circuit_Main_Grandstand_o.jpg' },
	{ match: /suzuka/i, track: 'suzuka', photo: 'Suzuka_Circuit_2006.jpg' },
	{ match: /homestead/i, track: 'homestead', photo: 'Race_start_(38904049411).jpg' },
	{ match: /miami/i, track: 'miami', photo: 'Miami_Grand_Prix_startfinish.jpg' },
	{
		match: /gilles villeneuve|montr[eé]al/i,
		track: 'montreal',
		photo: 'Circuit_Gilles_Villeneuve_Hairpin.jpg'
	},
	{ match: /monaco|monte carlo/i, track: 'monaco', photo: 'Epingle_Monaco.jpg' },
	{ match: /catalunya|barcelona/i, track: 'catalunya', photo: 'F1_Circuit_de_Catalunya_-_Tribuna.jpg' },
	{
		match: /red bull ring|spielberg/i,
		track: 'redbullring',
		photo: 'Luftaufnahme_(c)Red_Bull_Ring.jpg'
	},
	{
		match: /silverstone/i,
		track: 'silverstone',
		photo: 'Silverstone_Circuit_with_Brackley_Hatch_behind,_aerial_2017,_geograph_5436763_by_Chris.jpg'
	},
	{ match: /\bspa\b|francorchamps/i, track: 'spa', photo: '©J.Breuer.jpg' },
	{ match: /hungaroring|budapest/i, track: 'hungaroring', photo: 'Hungaroring_Exit.JPG' },
	{ match: /zandvoort/i, track: 'zandvoort', photo: 'Circuit_Park_Zandvoort_from_air_2016-08-24.jpg' },
	{ match: /monza/i, track: 'monza', photo: 'Autodromo_Nazionale_di_Monza,_Italy_(Ank_Kumar)_06.jpg' },
	{ match: /madring|madrid/i, track: 'madring' },
	{ match: /baku/i, track: 'baku', photo: 'Baku_City_Circuit,_April_9,_2018_SkySat.jpg' },
	// Before Bahrain: the 2026 "Bahrain Grand Prix in Malaysia" runs at Sepang.
	{ match: /sepang/i, track: 'sepang', photo: 'Sepang_International_Circuit.JPG' },
	{ match: /marina bay|singapore/i, track: 'marinabay', photo: '1_singapore_f1_night_race_2012_city_skyline.jpg' },
	{
		match: /circuit of the americas|austin|lone star/i,
		track: 'cota',
		photo: 'Main_straight_and_turn_1_hill,_Circuit_of_the_Americas.jpg'
	},
	{ match: /hermanos rodr[ií]guez|mexico city/i, track: 'mexico', photo: '2021_Mexico_City_Grand_Prix_(51349315666).jpg' },
	{
		match: /interlagos|carlos pace|s[aã]o paulo/i,
		track: 'interlagos',
		photo: 'Grande_Prêmio_São_Paulo_de_Fórmula_1_(52497080967).jpg'
	},
	{ match: /las vegas motor speedway/i, photo: 'Las_Vegas_Motor_Speedway_in_March_2011.jpg' },
	{ match: /las vegas/i, track: 'lasvegas', photo: 'Bellagio_Fountain_Club_(2023).jpg' },
	{ match: /lusail|losail|qatar|doha/i, track: 'lusail', photo: 'Grand_Stand.JPG' },
	{ match: /yas marina|abu dhabi/i, track: 'yasmarina', photo: 'Yas_Marina_Circuit_at_Sunset.jpg' },
	{
		match: /bahrain|sakhir/i,
		track: 'bahrain',
		photo: 'Sakhir_tower_at_Bahrain_International_Circuit.jpg'
	},
	{ match: /jeddah/i, track: 'jeddah', photo: 'Jeddah_Corniche_Circuit_viewed_from_above.png' },
	{ match: /imola/i, track: 'imola', photo: 'Autodromo_aerea_poster.jpg' },
	{ match: /buriram|chang international|thailand/i, photo: 'Marc_Márquez_wins_the_race_2018_Buriram.jpg' },
	{ match: /goi[aâ]nia/i, track: 'goiania' },
	{ match: /jerez/i, track: 'jerez', photo: 'Circuito_de_Jerez.jpg' },
	// Before Le Mans: Petit Le Mans runs at Road Atlanta.
	{ match: /road atlanta|petit le mans/i, track: 'roadatlanta', photo: 'Road_atlanta_esses.JPG' },
	{ series: MOTO, match: /le mans/i, photo: 'Dunlop_curves_2006_run_off_modifications.JPG' },
	{ match: /le mans/i, photo: 'Mulsanne_Le_Mans.jpg' },
	{ match: /mugello/i, track: 'mugello', photo: "Partenza_del_Gran_Premio_d'Italia_TIM_2011.jpg" },
	{ match: /balaton/i, photo: 'Balaton_Park_Circuit_-_Pitlane.jpg' },
	{ match: /brno/i, track: 'brno', photo: 'Automotodrom_Brno_Omega.JPG' },
	{ match: /assen/i, track: 'assen', photo: 'Moto3_riders_racing_at_2025_Dutch_TT.jpg' },
	{ match: /sachsenring/i, track: 'sachsenring', photo: 'Aerial_image_of_Sachsenring_(view_from_the_southwest).jpg' },
	{ match: /arag[oó]n/i, photo: "Formul'Academy_Euroseries_2009._Motorland_Aragón.jpg" },
	{ match: /misano/i, photo: 'Misano_World_Circuit_Marco_Simoncelli.jpg' },
	{
		match: /motegi/i,
		photo: 'View_of_the_Oval_at_Twin_Ring_Motegi_from_the_South.jpg'
	},
	{
		match: /mandalika/i,
		track: 'mandalika',
		photo: 'Mandalika_Circuit,_Gili_Angkus,_Gili_Lawang,_and_Gili_Batu_Ayok,_Viewed_from_Merese_Hill.jpg'
	},
	{ match: /phillip island/i, track: 'phillipisland', photo: 'Phillip_Island_Aerial_View.jpg' },
	{
		match: /portim[aã]o|algarve/i,
		track: 'portimao',
		photo: 'Autódromo_Internacional_do_Algarve_-_Portimão_-_Portugal_🇵🇹_(53656876708).jpg'
	},
	{ match: /ricardo tormo|valencia/i, track: 'valencia', photo: 'Circuit_de_la_Comunitat_Valenciana_Ricardo_Tormo_2011_013.jpg' },
	{ match: /fuji/i, track: 'fuji', photo: 'Fuji_Speedway_with_Mount_Fuji.jpg' },
	{
		match: /paul ricard|le castellet/i,
		track: 'paulricard',
		photo: 'Circuit_Paul_Ricard,_April_22,_2018_SkySat_(cropped).jpg'
	},

	// North America.
	{ series: ['nascar'], match: /daytona/i, photo: '2024_Daytona_500.jpg' },
	{ match: /daytona/i, track: 'daytona', photo: '2024_Daytona_500.jpg' },
	{ match: /sebring/i, track: 'sebring', photo: '2018_12_Hours_of_Sebring_Sunset_Bend.jpg' },
	{ match: /long beach/i, photo: 'LBGP05.jpg' },
	{ match: /detroit/i, photo: 'Will_Power_(7333133580).jpg' },
	{ match: /laguna seca|monterey/i, track: 'lagunaseca', photo: 'Corkscrew_Turn,_Mazda_Raceway_Laguna_Seca.jpg' },
	{
		match: /watkins glen|the glen/i,
		track: 'watkinsglen',
		photo: "Cars_drive_through_the_Esses_during_the_2014_Sahlen's_Six_Hours_of_The_Glen.jpg"
	},
	{
		match: /canadian tire|mosport/i,
		track: 'mosport',
		photo: 'Turn_8_heading_into_The_Esses_at_Canadian_Tire_Motorsport_Park.jpg'
	},
	{ match: /road america/i, track: 'roadamerica', photo: 'Indy_cars_at_Turn_Eight_at_Road_America.JPG' },
	{
		match: /virginia international|\bvir\b/i,
		photo: 'VirginiaInternationalRacewayPit_Road.jpg'
	},
	{ match: /indianapolis 500|brickyard/i, photo: 'Indianapolis-motor-speedway-1848561.jpg' },
	{ match: /indianapolis/i, track: 'indianapolis', photo: 'Indianapolis-motor-speedway-1848561.jpg' },
	{
		match: /st\.? petersburg/i,
		photo: '2012_Honda_Grand_Prix_of_St._Petersburg_Progress_Energy_Corners.jpg'
	},
	{ match: /barber|alabama/i, photo: 'Barber_Motorsports_Park_Aerial_(34804699780).jpg' },
	{ match: /world wide technology|wwtr|gateway/i, track: 'gateway' },
	{ match: /mid-ohio/i, photo: 'Gtp_sports_cars.jpg' },
	{ match: /nashville|music city/i, track: 'nashville', photo: 'Nationwide_2008.jpg' },
	{ match: /portland/i, photo: 'Portland_International_Raceway_USGS.jpeg' },
	{ match: /milwaukee/i, track: 'milwaukee', photo: 'MilwaukeeMilePanorama.jpg' },

	// NASCAR ovals.
	{ match: /bowman gray/i, track: 'bowmangray', photo: 'Bowman_Gray_Stadium.jpg' },
	{ match: /atlanta motor speedway/i, track: 'atlanta' },
	{ match: /phoenix/i, track: 'phoenix', photo: 'PhoenixInternationalRacewayGrandstands.jpg' },
	{ match: /darlington/i, track: 'darlington' },
	{
		match: /martinsville/i,
		track: 'martinsville',
		photo: 'Martinsville_Speedway,_September_2011_overview.JPG'
	},
	{ match: /bristol/i, photo: 'Bristol_Motor_Speedway_(9608386615).jpg' },
	{ match: /kansas/i, track: 'kansas', photo: 'The_Kansas_Speedway_(cropped).jpg' },
	{ match: /talladega/i, track: 'talladega', photo: 'TalladegaSuperspeedway2-2.jpg' },
	{ match: /texas motor speedway/i, track: 'texas', photo: 'TexasMotorSpeedway23.jpg' },
	{ match: /dover/i, track: 'dover', photo: '2017_Apache_Warrior_400_from_turn_1.jpg' },
	{ match: /roval/i, photo: '2024_Coca-Cola_600_third_stage_from_frontstretch.jpeg' },
	{ match: /charlotte/i, track: 'charlotte', photo: '2024_Coca-Cola_600_third_stage_from_frontstretch.jpeg' },
	{
		match: /michigan/i,
		track: 'michigan',
		photo: 'Pure_Michigan_400_Nascar_race_8-16-15_(20731306712).jpg'
	},
	{ match: /pocono/i, photo: 'Aerial_view_of_Pocono_Raceway.JPG' },
	{
		match: /san diego|coronado/i,
		photo: 'NASCAR_Cup_Series_Anduril_250_Race_the_Base_at_NASCAR_San_Diego_Weekend_(4)_9764231.jpg'
	},
	{ match: /sonoma/i, photo: 'Sonoma_Raceway_Turn_7A.jpg' },
	{ match: /chicagoland/i, track: 'chicagoland', photo: 'Chicagolandspeedway.jpg' },
	{ match: /north wilkesboro/i, track: 'northwilkesboro', photo: 'North_Willesboro_Speedway_2025-20.jpg' },
	{ match: /iowa speedway/i, track: 'iowa', photo: 'IowaSpeedwayJune2007.jpg' },
	{ match: /richmond/i, track: 'richmond', photo: 'Richmond_Raceway_aerial_2024.png' },
	{
		match: /new hampshire/i,
		track: 'newhampshire',
		photo: 'New_Hampshire_International_Speedway_(2007).jpg'
	}
];

export function findVenue(event: MotorEvent): Venue | undefined {
	const text = [event.location, event.name, event.url].filter(Boolean).join(' | ');
	return VENUES.find(
		(v) => (v.series ? v.series.includes(event.series) : !OFF_CIRCUIT.has(event.series)) && v.match.test(text)
	);
}

const API = 'https://en.wikipedia.org/w/api.php';
/** Thumbnail width; about twice the size the photos are shown at. */
const THUMB_WIDTH = 960;

interface ImageInfo {
	thumburl: string;
	thumbwidth: number;
	thumbheight: number;
	descriptionurl: string;
	extmetadata?: Record<string, { value: string } | undefined>;
}

function stripHtml(s: string): string {
	return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Look up thumbnails and attribution for Commons files, keyed by the given file name. */
async function lookup(files: string[]): Promise<Map<string, EventImage>> {
	const out = new Map<string, EventImage>();
	// The API takes 50 titles per request.
	for (let i = 0; i < files.length; i += 50) {
		const chunk = files.slice(i, i + 50);
		const params = new URLSearchParams({
			action: 'query',
			titles: chunk.map((f) => `File:${f}`).join('|'),
			prop: 'imageinfo',
			iiprop: 'url|extmetadata',
			iiurlwidth: String(THUMB_WIDTH),
			iiextmetadatafilter: 'Artist|LicenseShortName',
			format: 'json',
			formatversion: '2'
		});
		const data = JSON.parse(await fetchText(`${API}?${params}`));
		// Titles come back normalized ("File:A b.svg"); map them back to the names asked for.
		const asked = new Map<string, string>(
			(data.query?.normalized ?? []).map((n: { from: string; to: string }) => [n.to, n.from.slice(5)])
		);
		for (const page of data.query?.pages ?? []) {
			const info: ImageInfo | undefined = page.imageinfo?.[0];
			if (!info?.thumburl) continue;
			const meta = info.extmetadata ?? {};
			const author = stripHtml(meta.Artist?.value ?? '');
			const license = stripHtml(meta.LicenseShortName?.value ?? '');
			out.set(asked.get(page.title) ?? page.title.slice(5), {
				// Drop the utm_* tracking parameters the API appends.
				src: info.thumburl.replace(/\?.*$/, ''),
				width: info.thumbwidth,
				height: info.thumbheight,
				page: info.descriptionurl,
				credit: [author.length > 80 ? `${author.slice(0, 79)}…` : author, license].filter(Boolean).join(', ')
			});
		}
	}
	return out;
}

/** Add the track outline and photo to every event whose venue is known. */
export async function attachVenues(events: MotorEvent[]): Promise<void> {
	const venues = new Map(events.map((e) => [e, findVenue(e)]));
	for (const [event, venue] of venues) if (venue?.track) event.track = venue.track;
	const files = new Set([...venues.values()].map((v) => v?.photo).filter((f): f is string => !!f));
	const photos = await lookup([...files]);
	for (const [event, venue] of venues) if (venue?.photo) event.photo = photos.get(venue.photo);
}
