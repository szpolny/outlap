import type { EventImage, MotorEvent, SeriesId } from '#lib/series.ts';
import PHOTOS from './photos.json';

// Track outlines and venue photos, matched to events by venue. Outlines are plain SVGs in
// static/tracks/ (see static/tracks/README.md for where they come from). Photos are Wikimedia
// Commons files, or FIMSpeedway.com press photos (free for editorial use with credit) where
// Commons has none. Their thumbnails are kept in src/lib/assets/photos/, with sizes and credits in
// photos.json. A photo missing from photos.json isn't shown.

interface Venue {
	/** tested against the event's location, name and URL */
	match: RegExp;
	/** only these series; required for series that don't race on a circuit */
	series?: SeriesId[];
	/** static/tracks/<track>.svg */
	track?: string;
	/** key in photos.json: the Commons file name, or a FIMSpeedway_* name for press photos */
	photo?: string;
	/** which part of the photo to show on the card, as a CSS background-position */
	focus?: string;
}

/** Rallies, off-road, road racing and speedway only match venues that name their series. */
const OFF_CIRCUIT = new Set<SeriesId>(['wrc', 'erc', 'dakar', 'sgp', 'mxgp', 'supercross', 'iomtt']);

/** Bike series get their own photo where a venue's general one shows cars, and vice versa. */
const BIKES: SeriesId[] = ['motogp', 'moto2', 'moto3', 'worldsbk', 'bsb'];

// First match wins, so series-specific entries come before the venue's general entry.
const VENUES: Venue[] = [
	// WRC: no single track, so just a photo of the rally.
	{ series: ['wrc'], match: /monte.?carlo/i, photo: 'Ogier_Ingrassia_2009.jpg' },
	{ series: ['wrc'], match: /sweden/i, photo: 'Jari-Matti_Latvala_2015-02-14_001.jpg' },
	{ series: ['wrc'], match: /safari|kenya/i, photo: 'Kenya_KCB_Rally_Naivasha_3.jpg' },
	{ series: ['wrc'], match: /croatia/i, photo: 'Croatia_Rally_2021_-_Ott_Tänak_cropped.jpg' },
	{ series: ['wrc'], match: /canarias|canary/i, photo: 'Rally_Islas_Canarias_2019_-_2.jpg' },
	{ series: ['wrc'], match: /portugal/i, photo: 'Sebastien_Ogier_Baiao_Rally_de_portugal_2016.jpg' },
	{ series: ['wrc'], match: /rally japan/i, photo: 'Sébastien_Loeb_-_2008_Rally_Japan_2.jpg' },
	{ series: ['wrc'], match: /acropolis/i, photo: 'Rally_Acropolis_2011-SS3.jpg' },
	{ series: ['wrc'], match: /estonia/i, photo: 'Rally_Estonia_2018_-_Ott_Tänak.jpg' },
	{ series: ['wrc'], match: /finland/i, photo: 'Esapekka_Lappi_Rally_Finland_2022_Rannankylä.jpg' },
	{ series: ['wrc'], match: /sardegna|sardinia/i, photo: "Chris_Atkinson_-_2008_Rally_d'Italia_Sardegna.jpg" },
	// After Sardegna, which also has "Italia" in its name.
	{ series: ['wrc'], match: /rally d.italia|\brome\b/i, photo: '2015_Rally_Italia_Sardinia_20_Paddon-Kennard.jpg' },
	{ series: ['wrc'], match: /paraguay/i, photo: 'JimHug2006.JPG' },
	{ series: ['wrc'], match: /chile/i, photo: 'Rally_Mobil_Chille_Bio_Bio_-_WRC_Concepcion_Chile.jpg' },
	{ series: ['wrc'], match: /scotland/i, photo: 'Kris_meeke_drummond_hill_2010_rally_scotland.jpg' },

	// Speedway GP: stadium photos.
	{ series: ['sgp'], match: /prague/i, photo: 'Na_Markétě_speedway,_Zvoníčkova_street,_Praha.jpg' },
	{ series: ['sgp'], match: /wroc[lł]aw/i, photo: 'Nowy_Olimpijski.jpg', focus: '50% 65%' },
	{ series: ['sgp'], match: /[lł][oó]d[zź]/i, photo: 'Lodz_Moto_Arena.jpg' },
	{ series: ['sgp'], match: /riga/i, photo: 'Stadion_żużlowy_w_Rydze.jpg' },
	{ series: ['sgp'], match: /vojens/i, photo: 'FIMSpeedway_2026_Vojens_SGP.jpg', focus: '50% 25%' },
	{ series: ['sgp'], match: /donji kraljevec/i, photo: 'FIMSpeedway_2024_Donji_Kraljevec_SGP.jpg', focus: '50% 65%' },
	{ series: ['sgp'], match: /landshut/i, photo: 'FIMSpeedway_2026_Landshut_SGP.jpg', focus: '50% 20%' },
	{ series: ['sgp'], match: /manchester/i, photo: 'FIMSpeedway_2026_Manchester_SGP.jpg' },
	{ series: ['sgp'], match: /malilla/i, photo: 'FIMSpeedway_2026_Malilla_SGP.jpg', focus: '50% 80%' },
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
	{ match: /suzuka/i, track: 'suzuka', photo: 'Suzuka_Circuit_2006.jpg', focus: '50% 70%' },
	{ match: /homestead/i, track: 'homestead', photo: 'Race_start_(38904049411).jpg' },
	{ match: /miami/i, track: 'miami', photo: 'Miami_Grand_Prix_startfinish.jpg' },
	{
		match: /gilles villeneuve|montr[eé]al/i,
		track: 'montreal',
		photo: 'Circuit_Gilles_Villeneuve_Hairpin.jpg'
	},
	{ match: /monaco|monte carlo/i, track: 'monaco', photo: 'Epingle_Monaco.jpg' },
	{ series: BIKES, match: /catalunya|barcelona/i, track: 'catalunya', photo: 'Marc_Márquez_(28235169747).jpg' },
	{
		match: /catalunya|barcelona/i,
		track: 'catalunya',
		photo: '2022_4_Hours_of_Barcelona_-_Start_of_the_race.jpg',
		focus: '50% 70%'
	},
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
	{
		match: /\bspa\b|francorchamps/i,
		track: 'spa',
		photo: '2024_6_Hours_of_Spa-Francorchamps_(DSC08757).jpg',
		focus: '50% 60%'
	},
	{ match: /hungaroring|budapest/i, track: 'hungaroring', photo: 'Hungaroring_Exit.JPG' },
	{ match: /zandvoort/i, track: 'zandvoort', photo: 'Circuit_Park_Zandvoort_from_air_2016-08-24.jpg' },
	{ match: /monza/i, track: 'monza', photo: 'Monza_start_line.jpg', focus: '50% 45%' },
	{ match: /madring|madrid/i, track: 'madring' },
	{ match: /baku/i, track: 'baku', photo: 'Baku_City_Circuit,_April_9,_2018_SkySat.jpg' },
	// Before Bahrain: the 2026 "Bahrain Grand Prix in Malaysia" runs at Sepang.
	{
		series: BIKES,
		match: /sepang/i,
		track: 'sepang',
		photo: 'Dani_Pedrosa_leads_the_pack_2014_Sepang.jpeg',
		focus: '50% 95%'
	},
	{ match: /sepang/i, track: 'sepang', photo: '4_Hours_of_Sepang_2019.jpg', focus: '50% 60%' },
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
	{ match: /las vegas/i, track: 'lasvegas', photo: 'Las_Vegas_Grand_Prix_(54942393435).jpg', focus: '50% 65%' },
	{
		series: BIKES,
		match: /lusail|losail|qatar|doha/i,
		track: 'lusail',
		photo: 'Qatar_GP_2021._Pol_Espargaro_y_Stefan_Bradl_en_carrera_-_51079776027.jpg',
		focus: '50% 70%'
	},
	{ match: /lusail|losail|qatar|doha/i, track: 'lusail', photo: 'WTCC_2016,_Qatar.jpg', focus: '50% 80%' },
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
	{ match: /jerez/i, track: 'jerez', photo: 'Jorge_Lorenzo_leads_the_pack_2015_Jerez_2.jpeg', focus: '50% 90%' },
	// Before Le Mans: Petit Le Mans runs at Road Atlanta.
	{ match: /road atlanta|petit le mans/i, track: 'roadatlanta', photo: 'Road_atlanta_esses.JPG' },
	{ series: BIKES, match: /le mans/i, photo: 'Marc_Márquez_leads_the_pack_2015_Le_Mans.jpeg' },
	{ match: /le mans/i, photo: '2023_24_Hours_of_Le_Mans_(53272111149).jpg', focus: '50% 70%' },
	{ match: /mugello/i, track: 'mugello', photo: "Partenza_del_Gran_Premio_d'Italia_TIM_2011.jpg" },
	{ match: /balaton/i, track: 'balaton', photo: 'Balaton_Park_Circuit_-_Pitlane.jpg' },
	{ match: /brno/i, track: 'brno', photo: 'Marc_Márquez_leads_the_pack_2019_Brno.jpeg', focus: '50% 85%' },
	{ match: /assen/i, track: 'assen', photo: 'Moto3_riders_racing_at_2025_Dutch_TT.jpg' },
	{ match: /sachsenring/i, track: 'sachsenring', photo: 'Aerial_image_of_Sachsenring_(view_from_the_southwest).jpg' },
	{ match: /arag[oó]n/i, track: 'aragon', photo: 'Marc_Márquez_and_Jorge_Lorenzo_2013_Aragón_2.jpg' },
	{ match: /misano/i, track: 'misano', photo: 'Misano_World_Circuit_Marco_Simoncelli.jpg' },
	{
		match: /motegi/i,
		track: 'motegi',
		photo: 'View_of_the_Oval_at_Twin_Ring_Motegi_from_the_South.jpg'
	},
	{
		match: /mandalika/i,
		track: 'mandalika',
		photo: 'MotoGP_di_Sirkuit_Balapan_Pertamina_Mandalika,_NTB,_Indonesia.jpg',
		focus: '50% 70%'
	},
	{ match: /phillip island/i, track: 'phillipisland', photo: 'Phillip_Island_Aerial_View.jpg' },
	{
		match: /portim[aã]o|algarve/i,
		track: 'portimao',
		photo: 'Autódromo_Internacional_do_Algarve_-_Portimão_-_Portugal_🇵🇹_(53656876708).jpg',
		focus: '50% 75%'
	},
	{
		match: /ricardo tormo|valencia/i,
		track: 'valencia',
		photo: 'Álex_Márquez_in_the_pack_2020_Europe.jpg',
		focus: '50% 60%'
	},
	{ match: /fuji/i, track: 'fuji', photo: 'Fuji_Speedway_with_Mount_Fuji.jpg' },
	{ match: /okayama/i, track: 'okayama', photo: '2009_1000km_of_Okayama_(Race_1)_opening_lap.jpg' },
	{ match: /\bsugo\b/i, track: 'sugo', photo: 'Sportsland_SUGO_(27169582042).jpg' },
	{ match: /autopolis/i, track: 'autopolis', photo: 'Autopolis_racing_circuit_(Kamitsue,_Oita,_Japan).JPG' },
	{ match: /hockenheim/i, track: 'hockenheim', photo: 'Hockenheimring_start-ziel-gerade_2010.jpg' },
	// DTM races the Sprint layouts of the Lausitzring and the Nürburgring.
	{ match: /lausitzring/i, track: 'lausitzring', photo: 'Lausitzring_Turn_3.jpg' },
	{
		series: ['dtm'],
		match: /n[uü]rburgring/i,
		track: 'nurburgring',
		photo: 'Mattias_Ekström,_Red_Bull_Audi_RS_5_DTM,_DTM_Nürburgring_2017_(36976865252).jpg',
		focus: '50% 90%'
	},
	{
		match: /n[uü]rburgring/i,
		photo: 'Mattias_Ekström,_Red_Bull_Audi_RS_5_DTM,_DTM_Nürburgring_2017_(36976865252).jpg',
		focus: '50% 90%'
	},
	{ match: /norisring/i, track: 'norisring', photo: '2013_Norisring_DTM_35282b.jpg' },
	{
		match: /oschersleben/i,
		track: 'oschersleben',
		photo: 'Aerial_image_of_Motorsport_Arena_Oschersleben_(view_from_the_west).jpg'
	},
	{ match: /autodrom most/i, track: 'most', photo: 'Autodrom_Most_Tschechien_Originalgröße.jpg' },
	{ match: /cremona/i, track: 'cremona', photo: 'Vista_Cremona_Circuit_WSBK_2024.jpg', focus: '50% 65%' },
	{
		match: /estoril/i,
		track: 'estoril',
		photo: 'Andrea_Dovizioso_2011_Estoril_3.jpg',
		focus: '50% 65%'
	},
	{
		match: /magny.?cours/i,
		track: 'magnycours',
		photo: 'Magny-Cours_(morning_before_the_race).JPG',
		focus: '50% 60%'
	},
	{ match: /donington/i, track: 'donington', photo: 'Sbk_2013_-_Donington_Park_-_panoramio_(1).jpg' },
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

const PHOTOS_BY_FILE: Record<string, EventImage | undefined> = PHOTOS;

/** Add the track outline and photo to every event whose venue is known. */
export function attachVenues(events: MotorEvent[]): void {
	for (const event of events) {
		const venue = findVenue(event);
		if (venue?.track) event.track = venue.track;
		const photo = venue?.photo && PHOTOS_BY_FILE[venue.photo];
		if (photo) event.photo = venue.focus ? { ...photo, focus: venue.focus } : photo;
	}
}
