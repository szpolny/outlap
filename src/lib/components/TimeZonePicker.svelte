<script lang="ts">
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

	// Grouped by region, e.g. Europe → [Europe/Amsterdam, …]
	const groups = (() => {
		const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
		const map = new Map<string, { tz: string; label: string }[]>();
		for (const tz of zones) {
			const region = tz.split('/')[0];
			if (!tz.includes('/') || region === 'Etc') continue;
			map.set(region, [...(map.get(region) ?? []), { tz, label: `${city(tz)} (${offset(tz)})` }]);
		}
		return [...map].sort(([a], [b]) => a.localeCompare(b));
	})();

	const shown = $derived(value === 'auto' ? detected : value);
</script>

<label
	class="relative ml-0.5 inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-subtle py-0.5 pr-2 pl-[9px] font-[550] text-fg focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent hover:bg-[color-mix(in_srgb,var(--color-fg)_12%,var(--color-subtle))]"
	title="Change time zone"
>
	<span class="truncate">
		{pretty(shown)}
		<span class="ml-1 font-normal text-muted">{offset(shown)}</span>
		{#if value !== 'auto'}<span class="ml-1.5 text-[10.5px] font-bold tracking-[0.05em] text-accent uppercase">manual</span>{/if}
	</span>
	<svg class="shrink-0 text-muted" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"
		><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg
	>
	<!-- Native select stretched invisibly over the pill: keeps keyboard, screen-reader and mobile pickers. -->
	<select class="absolute inset-0 w-full cursor-pointer text-base opacity-0" bind:value aria-label="Time zone">
		<option value="auto">Auto: this device ({pretty(detected)})</option>
		<option value="UTC">UTC</option>
		{#each groups as [region, zones] (region)}
			<optgroup label={region}>
				{#each zones as z (z.tz)}
					<option value={z.tz}>{z.label}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
</label>
