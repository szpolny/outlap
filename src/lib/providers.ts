import type { SeriesId } from './series';
import abema from '#lib/assets/providers/abema.svg?no-inline';
import appletv from '#lib/assets/providers/appletv.svg?no-inline';
import automoto from '#lib/assets/providers/automoto.png?no-inline';
import canalplus from '#lib/assets/providers/canalplus.png?no-inline';
import channel4 from '#lib/assets/providers/channel4.svg?no-inline';
import dazn from '#lib/assets/providers/dazn.svg?no-inline';
import eleven from '#lib/assets/providers/eleven.webp?no-inline';
import eurosport from '#lib/assets/providers/eurosport.svg?no-inline';
import f1tv from '#lib/assets/providers/f1tv.webp?no-inline';
import fiawecplus from '#lib/assets/providers/fiawecplus.webp?no-inline';
import fim from '#lib/assets/providers/fim.svg?no-inline';
import foxau from '#lib/assets/providers/foxau.svg?no-inline';
import foxsports from '#lib/assets/providers/foxsports.svg?no-inline';
import fox from '#lib/assets/providers/fox.svg?no-inline';
import fs1 from '#lib/assets/providers/fs1.svg?no-inline';
import hbomax from '#lib/assets/providers/hbomax.svg?no-inline';
import joyn from '#lib/assets/providers/joyn.svg?no-inline';
import jsports from '#lib/assets/providers/jsports.svg?no-inline';
import kayo from '#lib/assets/providers/kayo.png?no-inline';
import motorvision from '#lib/assets/providers/motorvision.svg?no-inline';
import motowizja from '#lib/assets/providers/motowizja.png?no-inline';
import nbc from '#lib/assets/providers/nbc.svg?no-inline';
import orf from '#lib/assets/providers/orf.svg?no-inline';
import peacock from '#lib/assets/providers/peacock.svg?no-inline';
import polsatboxgo from '#lib/assets/providers/polsatboxgo.svg?no-inline';
import premiersports from '#lib/assets/providers/premiersports.png?no-inline';
import primevideo from '#lib/assets/providers/primevideo.svg?no-inline';
import sfgo from '#lib/assets/providers/sfgo.webp?no-inline';
import racer from '#lib/assets/providers/racer.svg?no-inline';
import servustv from '#lib/assets/providers/servustv.svg?no-inline';
import skysportit from '#lib/assets/providers/skysportit.svg?no-inline';
import skysports from '#lib/assets/providers/skysports.svg?no-inline';
import sportdigital from '#lib/assets/providers/sportdigital.svg?no-inline';
import stan from '#lib/assets/providers/stan.png?no-inline';
import tntsports from '#lib/assets/providers/tntsports.svg?no-inline';
import tnt from '#lib/assets/providers/tnt.svg?no-inline';
import tsn from '#lib/assets/providers/tsn.svg?no-inline';
import usanetwork from '#lib/assets/providers/usanetwork.svg?no-inline';
import viaplay from '#lib/assets/providers/viaplay.svg?no-inline';
import youtube from '#lib/assets/providers/youtube.webp?no-inline';
import ziggosport from '#lib/assets/providers/ziggosport.svg?no-inline';

/** A broadcaster's own logo, or the series' wordmark for a series-run service. */
export type ProviderLogo = { src: string; dark?: boolean } | { series: SeriesId };

// Shown in colour on a light tile. Keyed by watch option name.
const BRANDS: Record<string, string> = {
	'ABEMA': abema,
	'Apple TV': appletv,
	'Automoto La Chaîne': automoto,
	'CANAL+': canalplus,
	'Channel 4': channel4,
	'DAZN': dazn,
	'Eleven Sports': eleven,
	'Eurosport': eurosport,
	'Eurosport 3 / Player': eurosport,
	'F1 TV Pro / Premium': f1tv,
	'FIM-MOTO.TV': fim,
	'FOX': fox,
	'FOX Sports': foxsports,
	'Fox Sports': foxau,
	'FS1': fs1,
	'HBO Max': hbomax,
	'HBO Max / TNT Sports': hbomax,
	'J SPORTS': jsports,
	'Kayo Sports': kayo,
	'Motorvision TV': motorvision,
	'Motowizja': motowizja,
	'NBC': nbc,
	'NBC / USA Network': nbc,
	'ORF / ServusTV': orf,
	'Peacock Premium': peacock,
	'Polsat Sport / Polsat Box Go': polsatboxgo,
	'Premier Sports': premiersports,
	'Prime Video': primevideo,
	'RACER Network': racer,
	'RACER+': racer,
	'ran.de / Joyn': joyn,
	'ServusTV': servustv,
	'ServusTV On': servustv,
	'Sky Sport': skysportit,
	'Sky Sport Italia': skysportit,
	'Sky Sports': skysports,
	'Sportdigital': sportdigital,
	'Stan Sport': stan,
	'TNT': tnt,
	'TNT Sports': tntsports,
	'TSN': tsn,
	'TSN / RDS': tsn,
	'USA Network': usanetwork,
	'Viaplay': viaplay,
	'Ziggo Sport': ziggosport
};
// White-on-transparent marks that need a dark tile.
const DARK_BRANDS: Record<string, string> = {
	'FIAWEC+': fiawecplus,
	SFgo: sfgo
};
const SERIES_SERVICES: Record<string, SeriesId> = {
	'INDYCAR LIVE': 'indycar',
	'MotoGP VideoPass': 'motogp',
	'WorldSBK VideoPass': 'worldsbk',
	'IMSA.TV': 'imsa',
	'Rally.TV': 'wrc'
};

export function providerLogo(name: string): ProviderLogo | undefined {
	if (name in BRANDS) return { src: BRANDS[name] };
	if (name in DARK_BRANDS) return { src: DARK_BRANDS[name], dark: true };
	if (name in SERIES_SERVICES) return { series: SERIES_SERVICES[name] };
	if (/youtube/i.test(name)) return { src: youtube };
}
