<script lang="ts">
	import { SERIES, SERIES_IDS, SERIES_GROUPS, type SeriesId } from '#lib/series.ts';
	import SeriesLogo from '#lib/components/SeriesLogo.svelte';

	interface Props {
		selected: SeriesId[];
		/** 'grid' for the mobile sheet, 'list' for the narrow desktop sidebar */
		layout?: 'grid' | 'list';
	}

	let { selected = $bindable(), layout = 'grid' }: Props = $props();

	function toggle(id: SeriesId) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}

	function toggleGroup(ids: SeriesId[]) {
		selected = ids.every((id) => selected.includes(id))
			? selected.filter((id) => !ids.includes(id))
			: SERIES_IDS.filter((id) => selected.includes(id) || ids.includes(id));
	}
</script>

{#each SERIES_GROUPS as { name, ids } (name)}
	{@const count = ids.filter((id) => selected.includes(id)).length}
	<section class={['flex flex-col', layout === 'grid' ? 'gap-2' : 'gap-1']}>
		<!-- The heading doubles as the group toggle, so there is no separate "select all" per group. -->
		<button
			class="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-0.5 text-xs font-semibold tracking-[0.06em] text-muted uppercase hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			title="{count === ids.length ? 'Hide' : 'Show'} all {name}"
			aria-pressed={count === ids.length}
			onclick={() => toggleGroup(ids)}
		>
			<span>{name}</span>
			<span class="font-medium tracking-normal tabular-nums normal-case opacity-75">{count}/{ids.length}</span>
		</button>
		<div class={layout === 'grid' ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'flex flex-col gap-0.5'}>
			{#each ids as id (id)}
				{@const on = selected.includes(id)}
				<button
					class={[
						'flex cursor-pointer items-center transition-[color,opacity,background-color] duration-[120ms]',
						layout === 'grid'
							? [
									'h-11 gap-2.5 rounded-xl border px-3',
									on
										? 'border-[color-mix(in_srgb,var(--c)_45%,var(--color-line))] bg-[color-mix(in_srgb,var(--c)_12%,var(--color-panel))] text-fg'
										: 'border-line bg-bg text-muted'
								]
							: // In the sidebar the logo is the toggle: series colour when on, faded grey when off.
								[
									'h-8 rounded-lg px-2 hover:bg-subtle',
									on ? 'text-(--c)' : 'text-muted opacity-35 hover:opacity-80'
								]
					]}
					style:--c={SERIES[id].color}
					aria-pressed={on}
					title={SERIES[id].name}
					onclick={() => toggle(id)}
					ondblclick={() => (selected = [id])}
				>
					{#if layout === 'grid'}
						<span class={['box-border size-2.5 shrink-0 rounded-full border-[1.5px] border-(--c)', on && 'bg-(--c)']}></span>
					{/if}
					<span class="flex min-w-0 flex-1"><SeriesLogo series={id} class="h-3.5 max-w-full" /></span>
				</button>
			{/each}
		</div>
	</section>
{/each}
