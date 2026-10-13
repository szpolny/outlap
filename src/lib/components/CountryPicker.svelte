<script module lang="ts">
	import { isCountry } from '#lib/countries.ts';

	// Bundled as URLs, so a flag is only downloaded when its row is rendered.
	const FLAGS = Object.fromEntries(
		Object.entries(import.meta.glob<string>('../../../node_modules/flag-icons/flags/4x3/*.svg', { eager: true, query: '?url&no-inline', import: 'default' }))
			.map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4).toUpperCase(), url])
			// Drops subdivision and group flags (gb-eng, es-ga, eu) so they cannot shadow a country.
			.filter(([code]) => isCountry(code))
	);
</script>

<script lang="ts">
	import Locate from '~icons/lucide/locate-fixed';
	import SearchPicker from '@szpolny/calendar-kit/SearchPicker.svelte';
	import { COUNTRIES, countryName } from '#lib/countries.ts';
	import { LOCAL_COUNTRIES } from '#lib/watch.ts';

	interface Props {
		/** 'auto' or an ISO country code */
		value: string;
		/** the request's country, used for 'auto'; empty when unknown */
		detected: string;
	}

	let { value = $bindable(), detected }: Props = $props();

	interface Option {
		value: string;
		label: string;
		/** flag shown for the row; empty for an undetected 'auto' */
		code: string;
		group: string;
		search: string;
	}

	const normalize = (text: string) => text.normalize('NFD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
	// Common names that differ from the English display names.
	const ALIASES: Record<string, string> = {
		GB: 'uk britain england scotland wales',
		US: 'usa america',
		NL: 'holland',
		CZ: 'czech republic',
		KR: 'korea',
		AE: 'uae emirates',
		TR: 'turkey',
		DE: 'deutschland',
		PL: 'polska'
	};

	const option = (value: string, label: string, code: string, group: string): Option => ({
		value,
		label,
		code,
		group,
		// Space-led words so 'king' matches United Kingdom but 'ingdom' does not
		search: ` ${normalize(`${label} ${ALIASES[value] ?? ''}`)}`
	});

	// Countries with local broadcasters first; the rest still get worldwide series streams.
	const countries = [
		...COUNTRIES.filter((c) => LOCAL_COUNTRIES.has(c.code)).map((c) => option(c.code, c.name, c.code, 'Local listings')),
		...COUNTRIES.filter((c) => !LOCAL_COUNTRIES.has(c.code)).map((c) => option(c.code, c.name, c.code, 'Other countries · worldwide streams only'))
	];
	const shown = $derived(value === 'auto' ? detected : value);

	let query = $state('');

	const options = $derived.by(() => {
		const q = normalize(query);
		const auto = option('auto', detected ? `Auto: ${countryName(detected)}` : 'Auto: location not detected', detected, '');
		if (!q) return [auto, ...countries];
		// Exact code or alias first, then names starting with the query, then any word starting with it.
		const exact = (c: Option) => c.value.toLowerCase() === q || ALIASES[c.value]?.split(' ').includes(q);
		const rank = (c: Option) => (exact(c) ? 0 : c.search.startsWith(` ${q}`) ? 1 : c.search.includes(` ${q}`) ? 2 : 3);
		return countries
			.filter((c) => rank(c) < 3)
			.sort((a, b) => rank(a) - rank(b))
			.map((c) => ({ ...c, group: '' }));
	});
</script>

{#snippet flag(code: string)}
	{#if FLAGS[code]}
		<img src={FLAGS[code]} alt="" class="h-3 w-4 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10" loading="lazy" decoding="async" />
	{:else}
		<Locate class="shrink-0 text-muted" width="14" height="14" aria-hidden="true" />
	{/if}
{/snippet}

<SearchPicker
	bind:value
	bind:query
	{options}
	title="Viewing country"
	subtitle="Broadcast rights and geoblocking follow where you watch from."
	placeholder="Search country or code"
	noun="countries"
	buttonTitle="Change viewing country"
	buttonLabel="Viewing country: {shown ? countryName(shown) : 'not set'}"
	buttonClass="text-[13px]"
>
	{#snippet trigger()}
		{@render flag(shown)}
		<span class="truncate">
			{shown ? countryName(shown) : 'Choose country'}
			{#if value === 'auto' && shown}<span class="ml-1 text-[10.5px] font-bold tracking-[0.05em] text-muted uppercase">detected</span>{/if}
		</span>
	{/snippet}
	{#snippet row(o: Option)}
		{@render flag(o.code)}
		<span class="min-w-0 flex-1 truncate">{o.label}</span>
		{#if o.value !== 'auto'}<span class="shrink-0 text-[12px] font-normal text-muted">{o.value}</span>{/if}
	{/snippet}
</SearchPicker>
