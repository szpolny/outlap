<script lang="ts">
	import SeriesLogo from '#lib/components/SeriesLogo.svelte';
	import { providerLogo } from '#lib/providers.ts';
	let { name }: { name: string } = $props();
	const logo = $derived(providerLogo(name));
	const monogram = $derived(name.split(/[\s/]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase());
</script>

<!-- Brand colours suit light backgrounds, so tiles stay white in dark mode; white marks get a dark tile. -->
<span
	class={[
		'flex h-9 w-[76px] shrink-0 items-center justify-center rounded-lg px-1 py-1 ring-1',
		logo && 'dark' in logo && logo.dark ? 'bg-[#15151a] ring-white/10' : 'bg-white text-[#15151a] ring-black/5'
	]}
	aria-hidden="true"
>
	{#if logo && 'src' in logo}
		<img src={logo.src} alt="" class="h-full w-full min-w-0 object-contain" loading="lazy" decoding="async" />
	{:else if logo && 'series' in logo}
		<SeriesLogo series={logo.series} class="max-h-full w-full" />
	{:else}
		<span class="font-display text-[12px] font-bold italic tracking-[0.02em]">{monogram}</span>
	{/if}
</span>
