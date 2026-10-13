<script lang="ts">
	import SubscribeDialog from '@szpolny/calendar-kit/SubscribeDialog.svelte';
	import { SERIES, type SeriesId } from '#lib/series.ts';
	import { FILTER_LABELS, type SessionFilter } from '#lib/format.ts';

	interface Props {
		open: boolean;
		selected: SeriesId[];
		filter: SessionFilter;
		alarm: number;
		origin: string;
	}

	let { open = $bindable(), selected, filter = $bindable(), alarm = $bindable(), origin }: Props = $props();

</script>

<SubscribeDialog bind:open {selected} bind:filter bind:alarm {origin}
	items={SERIES} filterLabels={FILTER_LABELS}
	selectionParam="series" filterParam="sessions" defaultFilter="all"
	selectionLabel="Series" filterLabel="Sessions"
	emptyMessage="No series selected. Choose some in the filter bar first."
	title="Add to Apple Calendar"
	subscriptionDescription="Stays up to date: session changes sync automatically."
/>
