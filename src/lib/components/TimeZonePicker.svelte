<script lang="ts">
	import ChevronDown from '~icons/lucide/chevron-down';
	import Check from '~icons/lucide/check';
	import Search from '~icons/lucide/search';
	import X from '~icons/lucide/x';
	import { tick } from 'svelte';

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
		region: string;
		search: string;
	}

	const zone = (value: string, label: string, offset: string, region: string): Zone => ({
		value,
		label,
		offset,
		region,
		// Space-led words so a query matches from the start of any word: 'york' → New York, not 'tok' → Vostok
		search: ` ${value} ${label} ${offset}`.replace(/[_/:·()]/g, ' ').replace(/\s+/g, ' ').toLowerCase()
	});

	const zones: Zone[] = (() => {
		const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
		const list = all
			.filter((tz) => tz.includes('/') && !tz.startsWith('Etc/'))
			.map((tz) => zone(tz, city(tz), offset(tz), tz.split('/')[0]))
			.sort((a, b) => a.region.localeCompare(b.region) || a.label.localeCompare(b.label));
		return [zone('UTC', 'UTC', 'UTC+0', ''), ...list];
	})();

	const shown = $derived(value === 'auto' ? detected : value);

	let dialog: HTMLDialogElement;
	let input = $state<HTMLInputElement>();
	let listEl = $state<HTMLElement>();
	let query = $state('');
	let active = $state(0);

	const options = $derived.by(() => {
		const q = ` ${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;
		const auto = zone('auto', 'Auto: this device', `${pretty(detected)} · ${offset(detected)}`, '');
		if (q === ' ') return [auto, ...zones];
		return [auto, ...zones].filter((z) => z.search.includes(q));
	});

	async function open() {
		query = '';
		dialog.showModal();
		active = Math.max(0, options.findIndex((o) => o.value === value));
		await tick();
		scrollToActive('center');
		// Skip on touch: the on-screen keyboard would cover most of the list.
		if (matchMedia('(pointer: fine)').matches) input?.focus();
	}

	function choose(z: Zone) {
		value = z.value;
		dialog.close();
	}

	function scrollToActive(block: ScrollLogicalPosition = 'nearest') {
		listEl?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block });
	}

	async function move(delta: number) {
		active = Math.min(options.length - 1, Math.max(0, active + delta));
		await tick();
		scrollToActive();
	}

	function onkeydown(e: KeyboardEvent) {
		const keys: Record<string, () => void> = {
			ArrowDown: () => move(1),
			ArrowUp: () => move(-1),
			PageDown: () => move(8),
			PageUp: () => move(-8),
			Enter: () => options[active] && choose(options[active])
		};
		if (keys[e.key]) {
			e.preventDefault();
			keys[e.key]();
		}
	}
</script>

<button
	type="button"
	class="ml-0.5 inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-subtle py-0.5 pr-2 pl-[9px] font-[550] text-fg hover:bg-[color-mix(in_srgb,var(--color-fg)_12%,var(--color-subtle))] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
	title="Change time zone"
	aria-haspopup="dialog"
	onclick={open}
>
	<span class="truncate">
		{pretty(shown)}
		<span class="ml-1 font-normal text-muted">{offset(shown)}</span>
		{#if value !== 'auto'}<span class="ml-1.5 text-[10.5px] font-bold tracking-[0.05em] text-accent uppercase">manual</span>{/if}
	</span>
	<ChevronDown class="shrink-0 text-muted" width="12" height="12" aria-hidden="true" />
</button>

<dialog
	class="m-auto mb-0 h-[85dvh] w-screen max-w-screen rounded-t-[18px] bg-panel p-0 text-fg shadow-[0_30px_80px_rgb(0_0_0/0.35)] backdrop:bg-[rgb(10_10_12/0.45)] backdrop:backdrop-blur-[3px] sm:mb-auto sm:h-[min(620px,80dvh)] sm:w-[440px] sm:rounded-[18px]"
	bind:this={dialog}
	onclick={(e) => e.target === dialog && dialog.close()}
	aria-labelledby="tz-title"
>
	<div class="flex h-full flex-col">
		<div class="flex flex-col gap-3.5 border-b border-line p-[22px] pb-4">
			<header class="flex items-center justify-between">
				<h2 id="tz-title" class="text-[19px] font-bold tracking-[-0.01em]">Time zone</h2>
				<button class="grid size-[30px] cursor-pointer place-items-center rounded-full bg-subtle text-muted" aria-label="Close" onclick={() => dialog.close()}>
					<X width="16" height="16" aria-hidden="true" />
				</button>
			</header>
			<div class="relative">
				<Search class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" width="15" height="15" aria-hidden="true" />
				<input
					bind:this={input}
					bind:value={query}
					oninput={() => (active = 0)}
					{onkeydown}
					class="w-full rounded-[10px] border border-line bg-bg py-2 pr-2.5 pl-9 text-base outline-none placeholder:text-muted focus:border-muted sm:text-sm"
					type="search"
					placeholder="Search city, region or UTC offset"
					autocomplete="off"
					spellcheck="false"
					role="combobox"
					aria-expanded="true"
					aria-controls="tz-list"
					aria-activedescendant={options[active] ? `tz-opt-${active}` : undefined}
					aria-label="Search time zones"
				/>
			</div>
		</div>

		<ul
			id="tz-list"
			bind:this={listEl}
			class="flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] [scrollbar-width:thin]"
			role="listbox"
			aria-label="Time zones"
		>
			{#each options as z, i (z.value)}
				{#if z.region && z.region !== options[i - 1]?.region}
					<li
						class="sticky top-0 z-10 bg-panel px-3 pt-3 pb-1 text-xs font-semibold tracking-[0.06em] text-muted uppercase"
						role="presentation"
					>
						{z.region}
					</li>
				{/if}
				<!-- Keyboard selection goes through the search field (aria-activedescendant). -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					id="tz-opt-{i}"
					data-index={i}
					role="option"
					aria-selected={z.value === value}
					class={[
						'flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 text-[14px]',
						i === active && 'bg-subtle',
						z.value === value && 'font-semibold'
					]}
					onmousemove={() => (active = i)}
					onclick={() => choose(z)}
				>
					<span class="min-w-0 flex-1 truncate">{z.label}</span>
					<span class="shrink-0 text-[13px] font-normal text-muted tabular-nums">{z.offset}</span>
					<Check class={['shrink-0 text-accent', z.value !== value && 'invisible']} width="15" height="15" aria-hidden="true" />
				</li>
			{:else}
				<li class="px-3 py-8 text-center text-sm text-muted">No time zones match “{query}”.</li>
			{/each}
		</ul>
	</div>
</dialog>
