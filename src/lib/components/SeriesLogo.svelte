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
	import lemanscup from '#lib/assets/series/lemanscup.png';
	import imsa from '#lib/assets/series/imsa.svg';
	import dtm from '#lib/assets/series/dtm.svg';
	import supergt from '#lib/assets/series/supergt.svg';
	import wrc from '#lib/assets/series/wrc.svg';

	// Single-colour marks applied as a CSS mask, so they take the surrounding text colour.
	// The ratio is width / height of each trimmed asset. Very wide wordmarks take an
	// optional scale so they don't dwarf the others at the same height.
	const LOGOS: Record<SeriesId, [src: string, ratio: number, scale?: number]> = {
		f1: [f1, 4],
		f2: [f2, 3.0185],
		f3: [f3, 3.0185],
		indycar: [indycar, 6.531],
		indynxt: [indynxt, 473 / 72],
		superformula: [superformula, 3.3828],
		nascar: [nascar, 5.9935],
		motogp: [motogp, 6.255],
		moto2: [moto2, 5.4786],
		moto3: [moto3, 5.5028],
		worldsbk: [worldsbk, 4.5585],
		sgp: [sgp, 215 / 55],
		wec: [wec, 4.1914],
		elms: [elms, 375 / 72],
		lemanscup: [lemanscup, 746 / 72, 0.7],
		imsa: [imsa, 4.5574],
		dtm: [dtm, 3.6728],
		supergt: [supergt, 8.0011],
		wrc: [wrc, 5.0879]
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
</script>

<span
	role="img"
	aria-label={SERIES[series].name}
	class={['inline-block shrink-0 bg-current', className]}
	style:aspect-ratio={logo[1]}
	style:zoom={logo[2]}
	style:mask="url(&quot;{logo[0]}&quot;) center / contain no-repeat"
></span>
