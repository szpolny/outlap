<script lang="ts" generics="T extends { value: string; group: string }">
	import type { Snippet } from 'svelte';
	import ChevronDown from '~icons/lucide/chevron-down';
	import Check from '~icons/lucide/check';
	import Search from '~icons/lucide/search';
	import X from '~icons/lucide/x';
	import { tick } from 'svelte';

	interface Props {
		value: string;
		/** filtered for the current query; empty groups render no header */
		options: T[];
		query: string;
		title: string;
		subtitle?: string;
		placeholder: string;
		/** plural noun for labels, e.g. 'time zones' */
		noun: string;
		buttonTitle: string;
		buttonLabel?: string;
		buttonClass?: string;
		trigger: Snippet;
		row: Snippet<[T]>;
	}

	let {
		value = $bindable(),
		options,
		query = $bindable(),
		title,
		subtitle,
		placeholder,
		noun,
		buttonTitle,
		buttonLabel,
		buttonClass = '',
		trigger,
		row
	}: Props = $props();
	const uid = $props.id();

	let dialog: HTMLDialogElement;
	let input = $state<HTMLInputElement>();
	let listEl = $state<HTMLElement>();
	let active = $state(0);

	async function open() {
		query = '';
		dialog.showModal();
		await tick();
		active = Math.max(0, options.findIndex((o) => o.value === value));
		await tick();
		scrollToActive('center');
		// Skip on touch: the on-screen keyboard would cover most of the list.
		if (matchMedia('(pointer: fine)').matches) input?.focus();
	}

	function choose(o: T) {
		value = o.value;
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
	class={[
		'inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-subtle py-0.5 pr-2 pl-[9px] font-[550] text-fg hover:bg-[color-mix(in_srgb,var(--color-fg)_12%,var(--color-subtle))] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
		buttonClass
	]}
	title={buttonTitle}
	aria-haspopup="dialog"
	aria-label={buttonLabel}
	onclick={open}
>
	{@render trigger()}
	<ChevronDown class="shrink-0 text-muted" width="12" height="12" aria-hidden="true" />
</button>

<dialog
	class="m-auto mb-0 h-[85dvh] w-screen max-w-screen rounded-t-[18px] bg-panel p-0 text-fg shadow-[0_30px_80px_rgb(0_0_0/0.35)] backdrop:bg-[rgb(10_10_12/0.45)] backdrop:backdrop-blur-[3px] sm:mb-auto sm:h-[min(620px,80dvh)] sm:w-[440px] sm:rounded-[18px]"
	bind:this={dialog}
	onclick={(e) => e.target === dialog && dialog.close()}
	aria-labelledby="{uid}-title"
>
	<div class="flex h-full flex-col">
		<div class="flex flex-col gap-3.5 border-b border-line p-[22px] pb-4">
			<header class="flex items-start justify-between gap-3">
				<div>
					<h2 id="{uid}-title" class="text-[19px] font-bold tracking-[-0.01em]">{title}</h2>
					{#if subtitle}<p class="mt-1 text-[13px] text-muted">{subtitle}</p>{/if}
				</div>
				<button class="grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-full bg-subtle text-muted" aria-label="Close" onclick={() => dialog.close()}>
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
					{placeholder}
					autocomplete="off"
					spellcheck="false"
					role="combobox"
					aria-expanded="true"
					aria-controls="{uid}-list"
					aria-activedescendant={options[active] ? `${uid}-opt-${active}` : undefined}
					aria-label="Search {noun}"
				/>
			</div>
		</div>

		<ul
			id="{uid}-list"
			bind:this={listEl}
			class="flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] [scrollbar-width:thin]"
			role="listbox"
			aria-label={noun[0].toUpperCase() + noun.slice(1)}
		>
			{#each options as o, i (o.value)}
				{#if o.group && o.group !== options[i - 1]?.group}
					<li class="sticky top-0 z-10 bg-panel px-3 pt-3 pb-1 text-xs font-semibold tracking-[0.06em] text-muted uppercase" role="presentation">
						{o.group}
					</li>
				{/if}
				<!-- Keyboard selection goes through the search field (aria-activedescendant). -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					id="{uid}-opt-{i}"
					data-index={i}
					role="option"
					aria-selected={o.value === value}
					class={[
						'flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 text-[14px]',
						i === active && 'bg-subtle',
						o.value === value && 'font-semibold'
					]}
					onmousemove={() => (active = i)}
					onclick={() => choose(o)}
				>
					{@render row(o)}
					<Check class={['shrink-0 text-accent', o.value !== value && 'invisible']} width="15" height="15" aria-hidden="true" />
				</li>
			{:else}
				<li class="px-3 py-8 text-center text-sm text-muted">No {noun} match “{query}”.</li>
			{/each}
		</ul>
	</div>
</dialog>
