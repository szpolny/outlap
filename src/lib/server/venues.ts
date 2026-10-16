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

/**
 * Rallies, off-road, road racing, speedway, drag racing, drifting and hill climbs only match venues
 * that name their series: a circuit's outline and photo don't show a dragstrip or drift course.
 */
const OFF_CIRCUIT = new Set<SeriesId>([
	'wrc', 'erc', 'dakar', 'w2rc', 'rallycross', 'sgp', 'mxgp', 'supercross', 'promx', 'smx', 'trialgp', 'endurogp',
	'iomtt', 'nw200', 'nhra', 'formuladrift', 'pikespeak'
]);

/** Bike series get their own photo where a venue's general one shows cars, and vice versa. */
const BIKES: SeriesId[] = ['motogp', 'moto2', 'moto3', 'worldsbk', 'worldssp', 'bsb'];

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
	{ series: ['erc'], match: /fafe|north of portugal/i, photo: 'Rali_Serras_de_Fafe_2018_-_29.jpg' },
	{ series: ['dakar'], match: /dakar/i, photo: 'Dakar_Rally_2021_-_Shakedown_(50779690333).jpg' },
	{ series: ['wrc'], match: /saudi/i, photo: 'Hail_Rally_(2023).jpg' },
	{ series: ['iomtt'], match: /isle of man|snaefell/i, photo: '2013_Isle_of_Man_TT_Races_Photo_11_IMG_00305.jpg' },

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
	// Before Madring: the Madrid ePrix runs at Jarama.
	{ match: /jarama/i, track: 'jarama', photo: 'Tribuna_recta_Circuito_del_Jarama.jpg' },
	{ match: /madring|madrid/i, track: 'madring', photo: 'Circuito_MADRING_Sur.jpg', focus: '50% 80%' },
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
	{ match: /las vegas motor speedway/i, track: 'lvms', photo: 'Las_Vegas_Motor_Speedway_in_March_2011.jpg' },
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
	{ match: /buriram|chang international|thailand/i, track: 'buriram', photo: 'Marc_Márquez_wins_the_race_2018_Buriram.jpg' },
	{ match: /goi[aâ]nia/i, track: 'goiania', photo: 'Moto_GP_2026-_Goiânia.jpg' },
	{ match: /g[aá]lvez|buenos aires/i, photo: 'Autodromo_Buenos_Aires.jpg' },
	{ match: /chengdu|tianfu/i, track: 'chengdu' },
	{ match: /zhejiang|shaoxing/i, track: 'zhejiang' },
	{ match: /\binje\b/i, track: 'inje', photo: '인제스피디움_전경(야경).jpg' },
	{ match: /\bguia\b|macau/i, photo: 'Macau_Grand_Prix_2018_1.jpg' },
	{ match: /istanbul/i, track: 'istanbul', photo: 'Istanbul_Park_aerial.jpg' },
	{ match: /tokyo/i, photo: '2024_Tokyo_e-Prix_race_start_1.jpg' },
	{
		series: ['formulae'],
		match: /tempelhof|berlin/i,
		photo: '2023-04-23_Motorsport,_ABB_FIA_Formula_E_World_Championship,_Berlin_E-Prix_2023_1DX_1445_by_Stepro.jpg'
	},
	{ match: /dubai/i, track: 'dubai', photo: 'Finish_line_Dubai_Autodrome.jpg' },
	{ match: /jerez/i, track: 'jerez', photo: 'Jorge_Lorenzo_leads_the_pack_2015_Jerez_2.jpeg', focus: '50% 90%' },
	// Before Le Mans: Petit Le Mans runs at Road Atlanta.
	{ match: /road atlanta|petit le mans/i, track: 'roadatlanta', photo: 'Road_atlanta_esses.JPG' },
	// Bikes race the Bugatti circuit; cars race the full Circuit de la Sarthe, which has no outline.
	{ series: BIKES, match: /le mans/i, track: 'bugatti', photo: 'Marc_Márquez_leads_the_pack_2015_Le_Mans.jpeg' },
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
		series: ['gtwce', 'gtmasters'],
		match: /n[uü]rburgring/i,
		track: 'nurburgringgp',
		photo: 'Mattias_Ekström,_Red_Bull_Audi_RS_5_DTM,_DTM_Nürburgring_2017_(36976865252).jpg',
		focus: '50% 90%'
	},
	// Endurance races run the Nordschleife together with the Grand Prix circuit.
	{
		series: ['nls', 'n24', 'igtc'],
		match: /n[uü]rburgring/i,
		track: 'nordschleife',
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
	{ match: /salzburgring/i, track: 'salzburgring', photo: 'HeliGraphix_Salzburgring.jpg' },
	{ match: /vila real/i, photo: 'WTCR_2018.jpg' },
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
	// Season articles name the layout: BTCC opens on the Indy circuit and ends on the Grand Prix one.
	{ match: /brands hatch \(indy/i, track: 'brandshatchindy', photo: 'Brands-hatch.jpg' },
	{ match: /brands hatch/i, track: 'brandshatch', photo: 'Brands-hatch.jpg' },
	{ match: /croft/i, track: 'croft', photo: 'Porsche_Carreras_racing_in_the_wet,_Croft_circuit_(geograph_6188957).jpg' },
	{ match: /knockhill/i, track: 'knockhill', photo: 'Knockhill_Racing_Circuit,_Near_Dunfermline,_Fife_-_geograph.org.uk_-_6202246.jpg' },
	{ match: /oulton park \(island/i, track: 'oultonparkisland', photo: 'Michael_Caine_Oulton_Park_(Knickerbrook).JPG' },
	{ match: /oulton park/i, track: 'oultonpark', photo: 'Michael_Caine_Oulton_Park_(Knickerbrook).JPG' },
	{ match: /snetterton/i, track: 'snetterton', photo: 'Ginetta_Race_2_-_02_(9454210700).jpg' },
	{ match: /cadwell/i, track: 'cadwell', photo: 'Cadwell_Mountain_BSB_2.JPG' },
	{ match: /thruxton/i, track: 'thruxton', photo: 'Tony_Ayres_Mini_Miglia_Challenge_Thruxton_2026.jpg' },

	// Australia.
	// MotoGP's Adelaide layout differs from the Supercars one.
	{ series: ['supercars', 'gtwcaus'], match: /adelaide/i, track: 'adelaide', photo: 'Nissan_(8525283411).jpg' },
	{ match: /adelaide/i, photo: 'Nissan_(8525283411).jpg' },
	{ match: /bathurst|mount panorama/i, track: 'bathurst', photo: 'Mount_Panorama_Pit_Straight_and_Pit_Lane_2015.JPG' },
	{ match: /sandown/i, track: 'sandown', photo: 'Whincup_leads_Qualifying_Race_2_2015_Sandown_500.JPG' },
	{ match: /sydney/i, track: 'sydney', photo: '2005_V8_Supercars_Eastern_Creek_race_start.jpg' },
	{ match: /hidden valley|darwin/i, track: 'hiddenvalley', photo: 'Aerial_view_of_Hidden_Valley.jpg' },
	{ match: /symmons|tasmania|launceston/i, track: 'symmons', photo: 'Symmons_Plains,_Tasmania.jpg' },
	{ match: /townsville/i, photo: 'Townsville_Street_Circuit_Nov_2018_-_Main_Straight.jpg' },
	{ match: /wanneroo|perth/i, track: 'wanneroo', photo: 'Wanneroo_Mar_1985_009.jpg' },
	{ series: ['gtwcaus'], match: /queensland/i, track: 'queensland', photo: 'Paul_Dumbrell_at_Queensland_Raceway_2008.JPG' },
	{ match: /queensland raceway|ipswich/i, track: 'queensland', photo: 'Paul_Dumbrell_at_Queensland_Raceway_2008.JPG' },
	{ match: /the bend|tailem bend/i, track: 'thebend', photo: 'Whincup_2018_The_Bend_SuperSprint.jpg' },
	{ match: /taup[oō]/i, photo: 'Enge_a1gp_2007.jpeg' },
	{ match: /christchurch|ruapuna|euromarque/i, track: 'ruapuna', photo: 'Ruapuna_safety_car.jpg' },
	{ match: /surfers paradise|gold coast/i, track: 'surfersparadise', photo: 'Surfers_Paradise_Street_Circuit_aerial_view.jpg' },
	{
		match: /paul ricard|le castellet/i,
		track: 'paulricard',
		photo: 'Circuit_Paul_Ricard,_April_22,_2018_SkySat_(cropped).jpg'
	},

	// North America.
	{ series: ['nascar'], match: /daytona/i, track: 'daytonaoval', photo: '2024_Daytona_500.jpg' },
	{ match: /daytona/i, track: 'daytona', photo: '2024_Daytona_500.jpg' },
	{ match: /sebring/i, track: 'sebring', photo: '2018_12_Hours_of_Sebring_Sunset_Bend.jpg' },
	{ match: /long beach/i, track: 'longbeach', photo: 'LBGP05.jpg' },
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
		track: 'vir',
		photo: 'VirginiaInternationalRacewayPit_Road.jpg'
	},
	{ match: /indianapolis 500|brickyard/i, track: 'indianapolisoval', photo: 'Indianapolis-motor-speedway-1848561.jpg' },
	{ match: /indianapolis/i, track: 'indianapolis', photo: 'Indianapolis-motor-speedway-1848561.jpg' },
	{
		match: /st\.? petersburg/i,
		photo: '2012_Honda_Grand_Prix_of_St._Petersburg_Progress_Energy_Corners.jpg'
	},
	// Not "Alabama": Talladega is there too.
	{ match: /barber/i, track: 'barber', photo: 'Barber_Motorsports_Park_Aerial_(34804699780).jpg' },
	{ match: /world wide technology|wwtr|gateway/i, track: 'gateway', photo: 'Alex_Bowman_Gateway_2024.jpg' },
	{ match: /mid-ohio/i, track: 'midohio', photo: 'Gtp_sports_cars.jpg' },
	{ match: /nashville|music city/i, track: 'nashville', photo: 'Nationwide_2008.jpg' },
	{ match: /portland/i, track: 'portland', photo: 'Portland_International_Raceway_USGS.jpeg' },
	{ match: /lime rock/i, track: 'limerock', photo: 'Lime_Rock_Park_Uphill.jpg' },
	{ match: /washington|freedom 250/i, photo: 'Freedom_250_Grand_Prix_(freedom-250-grand-prix-3).jpg' },
	{ match: /milwaukee/i, track: 'milwaukee', photo: 'MilwaukeeMilePanorama.jpg' },

	// NASCAR ovals.
	{ match: /toledo speedway/i, photo: 'ToledoSpdwy-2003-chd1.jpg' },
	{ match: /elko speedway/i, track: 'elko', photo: 'ElkoSpeedway2019ARCAMenards250.jpg' },
	{ match: /salem speedway/i, track: 'salem', photo: 'Alex_Garcia_ARCA_72_at_Salem.jpg' },
	{
		match: /madison international/i,
		track: 'madison',
		photo: 'MadisonInternationalSpeedwayStartFinishLine2019ShoreLunch200.jpg'
	},
	{ match: /berlin raceway/i, track: 'berlinraceway', photo: 'Hocevar_-_Berlin,_April_22,_207.jpg' },
	{ match: /illinois state fairgrounds|springfield mile/i, photo: 'Butler_Springfield_Mile_88.jpg' },
	{ match: /du ?quoin/i, track: 'duquoin', photo: 'Duquoinsat.JPG' },
	{
		match: /rockingham/i,
		track: 'rockingham',
		photo: 'NASCAR_Camping_World_Truck_Series_at_Rockingham_Speedway_2012.jpg'
	},
	{ match: /bowman gray/i, track: 'bowmangray', photo: 'Bowman_Gray_Stadium.jpg' },
	// Renamed EchoPark Speedway in 2025.
	{
		match: /atlanta motor speedway|echopark/i,
		track: 'atlanta',
		photo: '2008_Atlanta_Motor_Speedway_Oct_26_Pep_Boys_500_(10)_(2978148192).jpg'
	},
	{ match: /phoenix/i, track: 'phoenix', photo: 'PhoenixInternationalRacewayGrandstands.jpg' },
	{ match: /darlington/i, track: 'darlington', photo: 'DarlingtonRacewayDodgeCharger500.JPG' },
	{
		match: /martinsville/i,
		track: 'martinsville',
		photo: 'Martinsville_Speedway,_September_2011_overview.JPG'
	},
	{ match: /bristol/i, track: 'bristol', photo: 'Bristol_Motor_Speedway_(9608386615).jpg' },
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
	{ match: /pocono/i, track: 'pocono', photo: 'Aerial_view_of_Pocono_Raceway.JPG' },
	{
		match: /san diego|coronado/i,
		photo: 'NASCAR_Cup_Series_Anduril_250_Race_the_Base_at_NASCAR_San_Diego_Weekend_(4)_9764231.jpg'
	},
	// NASCAR's short layout; sports cars use the longer course with the Carousel.
	{ series: ['nascar', 'oreilly', 'truck'], match: /sonoma/i, track: 'sonoma', photo: 'Sonoma_Raceway_Turn_7A.jpg' },
	{ match: /sonoma/i, photo: 'Sonoma_Raceway_Turn_7A.jpg' },
	{ match: /chicagoland/i, track: 'chicagoland', photo: 'Chicagolandspeedway.jpg' },
	{ match: /north wilkesboro/i, track: 'northwilkesboro', photo: 'North_Willesboro_Speedway_2025-20.jpg' },
	{ match: /iowa speedway/i, track: 'iowa', photo: 'IowaSpeedwayJune2007.jpg' },
	{ match: /richmond/i, track: 'richmond', photo: 'Richmond_Raceway_aerial_2024.png' },
	{
		match: /new hampshire/i,
		track: 'newhampshire',
		photo: 'New_Hampshire_International_Speedway_(2007).jpg'
	},

	// Events that only name the country.
	{ match: /netherlands/i, track: 'zandvoort', photo: 'Circuit_Park_Zandvoort_from_air_2016-08-24.jpg' }
];

/** Photos for events whose venue has none: off-circuit series, and circuits with no free photo. */
const SERIES_PHOTOS: Partial<Record<SeriesId, string>> = {
	mxgp: 'Kompetisi_Motocross_MXGP_di_Pangkal_Pinang_Indonesia.jpg',
	promx: 'Lucas_Oil_Pro_Motocross_at_High_Point_Raceway.jpg',
	supercross: 'SF_Supercross_2004.jpg',
	smx: 'SF_Supercross_2004.jpg',
	nhra: 'NHRA_Top_Fuel_Dragster_Finals_Sonoma_2023.jpg',
	formuladrift: 'Formula_DRIFT_on_Track_2012.jpg',
	rallycross: 'WRX_Sweden_2015_001_(cropped).jpg',
	endurogp: 'David_Knight_-_2010_WEC_GP_of_Turkey.jpg',
	trialgp: 'FIM_TRIAL_WORLD_CHAMPIONSHIP_Cal_Rosal_2016_(6).jpg',
	erc: 'ERC_Tour_de_Corse_2014.jpg',
	wrc: 'Sebastien_Ogier_Baiao_Rally_de_portugal_2016.jpg',
	w2rc: 'Dakar_Rally_2021_-_Shakedown_(50779690333).jpg',
	nw200: 'North_West_200_York_Corner_2009.jpg',
	pikespeak: 'Pikes_Peak_Hill_Climb_2011_(5878397866).jpg',
	// New street circuits without a photo of their own.
	indycar: 'Indy_cars_at_Turn_Eight_at_Road_America.JPG',
	indynxt: 'Indy_cars_at_Turn_Eight_at_Road_America.JPG',
	formulae: '2024_Tokyo_e-Prix_race_start_1.jpg',
	tcr: 'WTCR_2018.jpg',
	gtwcasia: '2022_4_Hours_of_Barcelona_-_Start_of_the_race.jpg'
};

export function findVenue(event: MotorEvent): Venue | undefined {
	const text = [event.location, event.name, event.url].filter(Boolean).join(' | ');
	return VENUES.find(
		(v) => (v.series ? v.series.includes(event.series) : !OFF_CIRCUIT.has(event.series)) && v.match.test(text)
	);
}

const PHOTOS_BY_FILE: Record<string, EventImage | undefined> = PHOTOS;

/** Add the track outline and photo to every event whose venue is known, or its series' photo. */
export function attachVenues(events: MotorEvent[]): void {
	for (const event of events) {
		const venue = findVenue(event);
		if (venue?.track) event.track = venue.track;
		const file = venue?.photo ?? SERIES_PHOTOS[event.series];
		const photo = file && PHOTOS_BY_FILE[file];
		if (photo) event.photo = venue?.photo && venue.focus ? { ...photo, focus: venue.focus } : photo;
	}
}
