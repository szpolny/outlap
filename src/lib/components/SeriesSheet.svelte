<script lang="ts">
	import { SERIES_IDS, type SeriesId } from '#lib/series.ts';
	import SeriesList from '#lib/components/SeriesList.svelte';

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

	const allSelected = $derived(selected.length === SERIES_IDS.length);
</script>

<dialog
	class="m-auto mb-0 max-h-[85dvh] w-screen max-w-screen rounded-t-[18px] sm:mb-auto sm:w-[560px] sm:rounded-[18px] bg-panel p-0 text-fg shadow-[0_30px_80px_rgb(0_0_0/0.35)] backdrop:bg-[rgb(10_10_12/0.45)] backdrop:backdrop-blur-[3px]"
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

		<SeriesList bind:selected />
	</div>
</dialog>
