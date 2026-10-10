<script lang="ts">
	import { SERIES, SERIES_IDS, type SeriesId } from '#lib/series.ts';
	import SeriesLogo from '#lib/components/SeriesLogo.svelte';

	interface Props {
		open: boolean;
		selected: SeriesId[];
	}

	let { open = $bindable(), selected = $bindable() }: Props = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	// Series in metadata order, bucketed by group (first appearance sets the group order).
	const groups = new Map<string, SeriesId[]>();
	for (const id of SERIES_IDS) groups.set(SERIES[id].group, [...(groups.get(SERIES[id].group) ?? []), id]);

	const allSelected = $derived(selected.length === SERIES_IDS.length);

	function toggle(id: SeriesId) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}
</script>

<dialog
	class="m-auto mb-0 max-h-[85dvh] w-screen max-w-screen rounded-t-[18px] bg-panel p-0 text-fg shadow-[0_30px_80px_rgb(0_0_0/0.35)] backdrop:bg-[rgb(10_10_12/0.45)] backdrop:backdrop-blur-[3px]"
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && dialog.close()}
	aria-labelledby="series-title"
>
	<div class="flex flex-col gap-4 p-[22px] pb-[max(22px,env(safe-area-inset-bottom))]">
		<header class="flex items-center justify-between gap-3">
			<h2 id="series-title" class="text-[19px] font-bold tracking-[-0.01em]">Series</h2>
			<div class="flex items-center gap-2">
				<button
					class="cursor-pointer rounded-lg bg-subtle px-3 py-1.5 text-[13px] font-[550]"
					onclick={() => (selected = allSelected ? [] : [...SERIES_IDS])}
				>
					{allSelected ? 'Clear' : 'Select all'}
				</button>
				<button class="cursor-pointer rounded-lg bg-fg px-3 py-1.5 text-[13px] font-semibold text-bg" onclick={() => dialog.close()}>
					Done
				</button>
			</div>
		</header>

		{#each groups as [group, ids] (group)}
			<section class="flex flex-col gap-2">
				<h3 class="text-xs font-semibold tracking-[0.06em] text-muted uppercase">{group}</h3>
				<div class="grid grid-cols-2 gap-2">
					{#each ids as id (id)}
						{@const on = selected.includes(id)}
						<button
							class={[
								'flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 transition-colors duration-[120ms]',
								on
									? 'border-[color-mix(in_srgb,var(--c)_45%,var(--color-line))] bg-[color-mix(in_srgb,var(--c)_12%,var(--color-panel))] text-fg'
									: 'border-line bg-bg text-muted'
							]}
							style:--c={SERIES[id].color}
							aria-pressed={on}
							title={SERIES[id].name}
							onclick={() => toggle(id)}
						>
							<span class={['box-border size-2.5 shrink-0 rounded-full border-[1.5px] border-(--c)', on && 'bg-(--c)']}></span>
							<span class="flex min-w-0 flex-1"><SeriesLogo series={id} class="h-3.5 max-w-full" /></span>
						</button>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</dialog>
