<script module lang="ts">
	import type { SeriesId } from '#lib/series.ts';
	import f1 from '#lib/assets/series/f1.svg';
	import f2 from '#lib/assets/series/f2.svg';
	import f3 from '#lib/assets/series/f3.svg';
	import indycar from '#lib/assets/series/indycar.svg';
	import indynxt from '#lib/assets/series/indynxt.png';
	import superformula from '#lib/assets/series/superformula.svg';
	import nascar from '#lib/assets/series/nascar.svg';
	import motogp from '#lib/assets/series/motogp.svg';
	import moto2 from '#lib/assets/series/moto2.svg';
	import moto3 from '#lib/assets/series/moto3.svg';
	import worldsbk from '#lib/assets/series/worldsbk.svg';
	import sgp from '#lib/assets/series/sgp.png';
	import wec from '#lib/assets/series/wec.svg';
	import elms from '#lib/assets/series/elms.png';
	import alms from '#lib/assets/series/alms.svg';
	import lemanscup from '#lib/assets/series/lemanscup.png';
	import imsa from '#lib/assets/series/imsa.svg';
	import dtm from '#lib/assets/series/dtm.svg';
	import supergt from '#lib/assets/series/supergt.svg';
	import wrc from '#lib/assets/series/wrc.svg';
	import f1academy from '#lib/assets/series/f1academy.png';
	import formulae from '#lib/assets/series/formulae.png';
	import sfl from '#lib/assets/series/sfl.png';
	import oreilly from '#lib/assets/series/oreilly.png';
	import truck from '#lib/assets/series/truck.png';
	import bsb from '#lib/assets/series/bsb.png';
	import iomtt from '#lib/assets/series/iomtt.png';
	import mxgp from '#lib/assets/series/mxgp.png';
	import supercross from '#lib/assets/series/supercross.png';
	import igtc from '#lib/assets/series/igtc.png';
	import nls from '#lib/assets/series/nls.png';
	import gtwce from '#lib/assets/series/gtwce.png';
	import gtwca from '#lib/assets/series/gtwca.png';
	import gtwcasia from '#lib/assets/series/gtwcasia.png';
	import btcc from '#lib/assets/series/btcc.png';
	import supercars from '#lib/assets/series/supercars.png';
	import erc from '#lib/assets/series/erc.png';
	import dakar from '#lib/assets/series/dakar.png';
	import freca from '#lib/assets/series/freca.png';
	import euroformula from '#lib/assets/series/euroformula.png';
	import gb3 from '#lib/assets/series/gb3.png';
	import macau from '#lib/assets/series/macau.png';
	import arca from '#lib/assets/series/arca.png';
	import worldssp from '#lib/assets/series/worldssp.png';
	import nw200 from '#lib/assets/series/nw200.png';
	import promx from '#lib/assets/series/promx.png';
	import smx from '#lib/assets/series/smx.png';
	import trialgp from '#lib/assets/series/trialgp.png';
	import endurogp from '#lib/assets/series/endurogp.png';
	import n24 from '#lib/assets/series/n24.png';
	import h24 from '#lib/assets/series/h24.png';
	import supertaikyu from '#lib/assets/series/supertaikyu.png';
	import gtwcaus from '#lib/assets/series/gtwcaus.png';
	import britishgt from '#lib/assets/series/britishgt.png';
	import supercup from '#lib/assets/series/supercup.png';
	import tcr from '#lib/assets/series/tcr.png';
	import w2rc from '#lib/assets/series/w2rc.png';
	import rallycross from '#lib/assets/series/rallycross.png';
	import nhra from '#lib/assets/series/nhra.png';
	import formuladrift from '#lib/assets/series/formuladrift.png';
	import pikespeak from '#lib/assets/series/pikespeak.png';

	// Single-colour marks applied as a CSS mask, so they take the surrounding text colour.
	// The ratio is width / height of each trimmed asset. The optional scale evens out their
	// optical size: it brings each mark's main letters (not its box, which tails, stars and
	// small taglines enlarge) to about 90% of the line height. Wide marks are limited by area
	// instead (5.5 square line heights, at most 7.2 line heights wide), so they give up some
	// letter height for their width.
	// Formula E is sized by its E, which its FORMULA sits beside.
	// Bleed is how far the artwork reaches above and left of the box, as fractions of its height
	// and width: ERC's star overlaps its letters, which alone set the box so they line up with
	// the other marks.
	// Series without artwork show their short name as a black italic capital wordmark, the way
	// ADAC GT Masters (which publishes no standalone mark) sets its own name.
	const LOGOS: Partial<Record<SeriesId, [src: string, ratio: number, scale?: number, bleed?: [top: number, left: number]]>> = {
		f1: [f1, 4, 0.99],
		f2: [f2, 3.0185, 0.9],
		f3: [f3, 3.0185, 0.9],
		indycar: [indycar, 6.531, 0.9],
		indynxt: [indynxt, 473 / 72, 0.91],
		superformula: [superformula, 3.3828, 1.18],
		nascar: [nascar, 5.9935, 0.9],
		motogp: [motogp, 6.255, 0.94],
		moto2: [moto2, 5.4786],
		moto3: [moto3, 5.5028],
		worldsbk: [worldsbk, 4.5585, 0.9],
		sgp: [sgp, 215 / 55, 0.93],
		wec: [wec, 4.1914, 1.08],
		elms: [elms, 375 / 72, 0.91],
		alms: [alms, 13.8546, 0.52],
		lemanscup: [lemanscup, 746 / 72, 0.69],
		imsa: [imsa, 4.5574, 0.9],
		dtm: [dtm, 3.6728, 0.91],
		supergt: [supergt, 12.6024, 0.57],
		wrc: [wrc, 5.0879, 0.9],
		f1academy: [f1academy, 261 / 72, 0.91],
		formulae: [formulae, 648 / 72, 0.72],
		sfl: [sfl, 292 / 72, 1.13],
		oreilly: [oreilly, 252 / 72, 1.2],
		truck: [truck, 372 / 72, 0.97],
		bsb: [bsb, 284 / 72, 0.92],
		iomtt: [iomtt, 505 / 72, 0.89],
		mxgp: [mxgp, 248 / 72, 1.22],
		supercross: [supercross, 909 / 72, 0.57],
		igtc: [igtc, 635 / 72, 0.79],
		nls: [nls, 297 / 72, 1.1],
		gtwce: [gtwce, 592 / 72, 0.8],
		gtwca: [gtwca, 623 / 72, 0.8],
		gtwcasia: [gtwcasia, 479 / 72, 0.8],
		btcc: [btcc, 209 / 72, 0.95],
		supercars: [supercars, 450 / 72, 0.94],
		erc: [erc, 4.9662, 0.9, [0.7729, 0.107]],
		dakar: [dakar, 243 / 72, 1.2],
		freca: [freca, 249 / 72, 1.25],
		euroformula: [euroformula, 370 / 72, 1.03],
		gb3: [gb3, 158 / 72, 1.2],
		macau: [macau, 122 / 72, 1.6],
		arca: [arca, 186 / 72, 1.45],
		worldssp: [worldssp, 213 / 72, 1.3],
		nw200: [nw200, 479 / 72, 0.9],
		promx: [promx, 376 / 72, 1.03],
		smx: [smx, 266 / 72, 1.2],
		trialgp: [trialgp, 126 / 72, 1.75],
		endurogp: [endurogp, 125 / 72, 1.75],
		n24: [n24, 97 / 72, 1.6],
		h24: [h24, 137 / 72, 1.5],
		supertaikyu: [supertaikyu, 176 / 72, 1.5],
		gtwcaus: [gtwcaus, 177 / 72, 1.45],
		britishgt: [britishgt, 225 / 72, 1.3],
		supercup: [supercup, 260 / 72, 1.23],
		tcr: [tcr, 214 / 72, 1.3],
		w2rc: [w2rc, 180 / 72, 1.4],
		rallycross: [rallycross, 130 / 72, 1.25],
		nhra: [nhra, 174 / 72, 1.2],
		formuladrift: [formuladrift, 406 / 72, 0.9],
		pikespeak: [pikespeak, 387 / 72, 1.0]
	};
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { SERIES } from '#lib/series.ts';

	interface Props {
		series: SeriesId;
		/** set the height here; the width follows the logo's aspect ratio */
		class?: ClassValue;
	}

	let { series, class: className }: Props = $props();

	const logo = $derived(LOGOS[series]);
	const textWidth = $derived(SERIES[series].short.length * 7.7);
</script>

{#if !logo}
	<!-- Scales with the height class like the image marks; textLength keeps the estimated width. -->
	<svg
		role="img"
		aria-label={SERIES[series].name}
		class={['inline-block shrink-0', className]}
		viewBox="0 0 {textWidth + 2} 10"
		style:aspect-ratio={(textWidth + 2) / 10}
	>
		<!-- Skewed rather than font-style italic, which not every system font has in black. -->
		<text x="2" y="9.1" font-size="11.5" font-weight="800" transform="skewX(-12)" fill="currentColor" textLength={textWidth} lengthAdjust="spacingAndGlyphs">{SERIES[series].short.toUpperCase()}</text>
	</svg>
{:else if logo[3]}
	<span
		role="img"
		aria-label={SERIES[series].name}
		class={['relative inline-block shrink-0', className]}
		style:aspect-ratio={logo[1]}
		style:zoom={logo[2]}
	>
		<span
			class="absolute right-0 bottom-0 bg-current"
			style:top="{-logo[3][0] * 100}%"
			style:left="{-logo[3][1] * 100}%"
			style:mask="url(&quot;{logo[0]}&quot;) center / contain no-repeat"
		></span>
	</span>
{:else}
	<span
		role="img"
		aria-label={SERIES[series].name}
		class={['inline-block shrink-0 bg-current', className]}
		style:aspect-ratio={logo[1]}
		style:zoom={logo[2]}
		style:mask="url(&quot;{logo[0]}&quot;) center / contain no-repeat"
	></span>
{/if}
