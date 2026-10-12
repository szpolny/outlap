<script lang="ts">
	import Tv from '~icons/lucide/tv';
	import { SERIES, type MotorEvent } from '#lib/series.ts';
	import { countryName } from '#lib/countries.ts';
	import { LOCAL_COUNTRIES, getWatchInfo, watchIssueUrl } from '#lib/watch.ts';
	import CountryPicker from '#lib/components/CountryPicker.svelte';
	import ProviderLogo from '#lib/components/ProviderLogo.svelte';
	interface Props {
		events: MotorEvent[];
		/** 'auto' or an ISO country code */
		countryPref: string;
		detectedCountry: string;
		/** countryPref resolved against the detected country; empty when unknown */
		country: string;
	}
	let { events, countryPref = $bindable(), detectedCountry, country }: Props = $props();
	// One guide per distinct result, so same-series events (e.g. NASCAR races on different channels) each get their own.
	const guides = $derived.by(() => {
		const unique = new Map<string, { event: MotorEvent; info: ReturnType<typeof getWatchInfo> }>();
		for (const event of events) {
			const info = getWatchInfo(event, country);
			const key = `${event.series}:${JSON.stringify(info)}`;
			if (!unique.has(key)) unique.set(key, { event, info });
		}
		return [...unique.values()];
	});
	const issueUrl = $derived(watchIssueUrl(country, [...new Set(events.map((event) => SERIES[event.series].name))]));
	const repeated = (series: string) => guides.filter((guide) => guide.event.series === series).length > 1;
</script>

<section class="mt-5 border-t border-line pt-4" aria-label="Where to watch">
	<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
		<h4 class="flex items-center gap-2 text-sm font-semibold">
			<Tv width="15" height="15" aria-hidden="true" />
			Where to watch in
		</h4>
		<CountryPicker bind:value={countryPref} detected={detectedCountry} />
	</div>
	{#if !country}
		<p class="mt-2 text-[13px] text-muted">Choose your country to see local TV, subscriptions and free streams.</p>
	{:else if !LOCAL_COUNTRIES.has(country)}
		<p class="mt-2 text-[13px] text-muted">
			We have no local broadcaster data for {countryName(country)} yet, so only worldwide streams are shown.
			<a class="underline decoration-current/40 underline-offset-2 hover:text-fg" href={issueUrl} target="_blank" rel="noopener noreferrer">Know one? Tell us ↗</a>
		</p>
	{/if}
	<div class="mt-3 space-y-4">
		{#each guides as { event, info } (event.id)}
			<div>
				{#if guides.length > 1}<h5 class="mb-2 text-[13px] font-semibold">{repeated(event.series) ? event.name : SERIES[event.series].name}</h5>{/if}
				{#if info.selectedCountry && !info.currentSeason}
					<p class="mb-2 text-[13px] text-muted">
						Local broadcasters for {event.start.slice(0, 4)} are not confirmed yet.
						{info.options.length ? 'Series streams below may still carry it.' : 'Check the official guide.'}
					</p>
				{:else if info.selectedCountry && !info.options.some((option) => option.availability !== 'blocked')}
					<p class="mb-2 text-[13px] text-muted">Local coverage is not confirmed here. Check the official guide for this race.</p>
				{/if}
				<ul class="space-y-2">
					{#each info.options.filter((option) => option.availability !== 'blocked') as option (option.name)}
						<li class="flex gap-3 rounded-xl bg-subtle px-3 py-2.5">
							<ProviderLogo name={option.name} />
							<div class="min-w-0">
								<a class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-accent" href={option.url} target="_blank" rel="noopener noreferrer">
									<span>{option.name} ↗</span>
									<span class="rounded-md bg-panel px-1.5 py-0.5 text-[11px] font-medium text-muted">{option.medium}</span>
									<span class={['text-[11px] font-medium', option.access.startsWith('Free') ? 'text-accent' : 'text-muted']}>{option.access}</span>
								</a>
								{#if option.availability === 'check'}<p class="mt-1 text-[11px] font-semibold text-muted">Check availability in {countryName(country)}</p>{/if}
								<p class="mt-1 text-[12px] leading-relaxed text-muted">{option.note}</p>
							</div>
						</li>
					{/each}
				</ul>
				{#each info.options.filter((option) => option.availability === 'blocked') as option (option.name)}
					<p class="mt-2 text-[12px] leading-relaxed text-muted"><span class="font-semibold">{option.name} · No live race access.</span> {option.note}</p>
				{/each}
				<p class="mt-2 text-[12px] text-muted">
					<a class="underline decoration-current/40 underline-offset-2 hover:text-fg" href={info.url} target="_blank" rel="noopener noreferrer">Official viewing guide ↗</a>
					{#if info.options.length}<span class="ml-1">· Checked {info.checked}</span>{/if}
				</p>
			</div>
		{/each}
	</div>
	<p class="mt-3 text-[11px] leading-relaxed text-muted">
		Race coverage shown. Practice, qualifying, highlights and replays can have different rights. Check the broadcaster’s listing for this round.
		Missing or wrong provider?
		<a class="underline decoration-current/40 underline-offset-2 hover:text-fg" href={issueUrl} target="_blank" rel="noopener noreferrer">Open an issue on GitHub ↗</a>
	</p>
</section>
