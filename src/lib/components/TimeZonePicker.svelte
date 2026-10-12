<script lang="ts">
	import SearchPicker from '#lib/components/SearchPicker.svelte';

	interface Props {
		/** 'auto' or an IANA zone */
		value: string;
		/** the viewer's own zone, used for 'auto' */
		detected: string;
	}

	let { value = $bindable(), detected }: Props = $props();

	function offset(timeZone: string): string {
		try {
			const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
				.formatToParts(new Date())
				.find((p) => p.type === 'timeZoneName')?.value;
			return !name || name === 'GMT' ? 'UTC' : name.replace('GMT', 'UTC');
		} catch {
			return '';
		}
	}

	const pretty = (tz: string) => tz.replace(/_/g, ' ').replace(/\//g, ' / ');
	const city = (tz: string) => tz.split('/').slice(1).join(' / ').replace(/_/g, ' ');

	interface Zone {
		value: string;
		label: string;
		offset: string;
		group: string;
		search: string;
	}

	const zone = (value: string, label: string, offset: string, group: string): Zone => ({
		value,
		label,
		offset,
		group,
		// Space-led words so a query matches from the start of any word: 'york' → New York, not 'tok' → Vostok
		search: ` ${value} ${label} ${offset}`.replace(/[_/:·()]/g, ' ').replace(/\s+/g, ' ').toLowerCase()
	});

	const zones: Zone[] = (() => {
		const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
		const list = all
			.filter((tz) => tz.includes('/') && !tz.startsWith('Etc/'))
			.map((tz) => zone(tz, city(tz), offset(tz), tz.split('/')[0]))
			.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
		return [zone('UTC', 'UTC', 'UTC+0', ''), ...list];
	})();

	const shown = $derived(value === 'auto' ? detected : value);
	let query = $state('');

	const options = $derived.by(() => {
		const q = ` ${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;
		const auto = zone('auto', 'Auto: this device', `${pretty(detected)} · ${offset(detected)}`, '');
		if (q === ' ') return [auto, ...zones];
		return [auto, ...zones].filter((z) => z.search.includes(q));
	});
</script>

<SearchPicker
	bind:value
	bind:query
	{options}
	title="Time zone"
	placeholder="Search city, region or UTC offset"
	noun="time zones"
	buttonTitle="Change time zone"
	buttonClass="ml-0.5"
>
	{#snippet trigger()}
		<span class="truncate">
			{pretty(shown)}
			<span class="ml-1 font-normal text-muted">{offset(shown)}</span>
			{#if value !== 'auto'}<span class="ml-1.5 text-[10.5px] font-bold tracking-[0.05em] text-accent uppercase">manual</span>{/if}
		</span>
	{/snippet}
	{#snippet row(z: Zone)}
		<span class="min-w-0 flex-1 truncate">{z.label}</span>
		<span class="shrink-0 text-[13px] font-normal text-muted tabular-nums">{z.offset}</span>
	{/snippet}
</SearchPicker>
