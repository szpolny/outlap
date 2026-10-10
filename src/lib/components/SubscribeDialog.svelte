<script lang="ts">
	import X from '~icons/lucide/x';
	import { SERIES, SERIES_IDS, type SeriesId } from '#lib/series.ts';
	import { FILTER_LABELS, type SessionFilter } from '#lib/format.ts';

	interface Props {
		open: boolean;
		selected: SeriesId[];
		filter: SessionFilter;
		alarm: number;
		origin: string;
	}

	let { open = $bindable(), selected, filter = $bindable(), alarm = $bindable(), origin }: Props = $props();

	let dialog: HTMLDialogElement;
	let copied = $state(false);

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	const query = $derived.by(() => {
		const params = new URLSearchParams();
		if (selected.length !== SERIES_IDS.length) params.set('series', selected.join(','));
		if (filter !== 'all') params.set('sessions', filter);
		if (alarm) params.set('alarm', String(alarm));
		const s = params.toString().replace(/%2C/g, ',');
		return s ? `?${s}` : '';
	});
	const httpUrl = $derived(`${origin}/calendar.ics${query}`);
	const webcalUrl = $derived(httpUrl.replace(/^https?:/, 'webcal:'));
	const downloadUrl = $derived(`${httpUrl}${query ? '&' : '?'}download=1`);
	const isLocal = $derived(/\/\/(localhost|127\.|\[::1\])/.test(origin));
	const empty = $derived(selected.length === 0);

	async function copy() {
		try {
			await navigator.clipboard.writeText(httpUrl);
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			prompt('Copy the calendar link', httpUrl);
		}
	}

	const field = 'flex flex-col gap-1.5';
	const label = 'text-xs font-semibold tracking-[0.06em] text-muted uppercase';
	const control = 'min-w-0 rounded-[10px] border border-line bg-bg px-2.5 py-2';
	const choice = 'flex flex-col gap-1 rounded-xl border p-3.5 transition-[border-color,transform] duration-150 active:scale-98';
</script>

<dialog
	class="m-auto w-[min(520px,calc(100vw-32px))] rounded-[18px] bg-panel p-0 text-fg shadow-[0_30px_80px_rgb(0_0_0/0.35)] backdrop:bg-[rgb(10_10_12/0.45)] backdrop:backdrop-blur-[3px] max-[480px]:mb-0 max-[480px]:w-screen max-[480px]:max-w-screen max-[480px]:rounded-b-none"
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && dialog.close()}
	aria-labelledby="sub-title"
>
	<div class="flex flex-col gap-[18px] p-[22px]">
		<header class="flex items-center justify-between">
			<h2 id="sub-title" class="text-[19px] font-bold tracking-[-0.01em]">Add to Apple Calendar</h2>
			<button class="grid size-[30px] cursor-pointer place-items-center rounded-full bg-subtle text-muted" aria-label="Close" onclick={() => dialog.close()}>
				<X width="16" height="16" aria-hidden="true" />
			</button>
		</header>

		<div class={field}>
			<span class={label}>Series</span>
			{#if empty}
				<p class="text-sm text-live">No series selected. Choose some in the filter bar first.</p>
			{:else}
				<div class="flex flex-wrap gap-1.5">
					{#each selected as id (id)}
						<span
							class="rounded-full bg-(--c)/13 px-[9px] py-[3px] text-[12.5px] font-semibold text-[color-mix(in_srgb,var(--c)_75%,var(--color-fg))]"
							style:--c={SERIES[id].color}>{SERIES[id].short}</span
						>
					{/each}
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
			<label class={field}>
				<span class={label}>Sessions</span>
				<select class={control} bind:value={filter}>
					{#each Object.entries(FILTER_LABELS) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
			</label>
			<label class={field}>
				<span class={label}>Alert</span>
				<select class={control} bind:value={alarm}>
					<option value={0}>None</option>
					<option value={15}>15 minutes before</option>
					<option value={30}>30 minutes before</option>
					<option value={60}>1 hour before</option>
				</select>
			</label>
		</div>

		<div class="grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
			<a class={[choice, 'border-accent bg-accent text-white', empty && 'pointer-events-none opacity-40']} href={webcalUrl}>
				<strong>Subscribe</strong>
				<span class="text-[13px] text-white/85">Stays up to date: session changes sync automatically.</span>
			</a>
			<a class={[choice, 'border-line text-fg hover:border-muted', empty && 'pointer-events-none opacity-40']} href={downloadUrl} download>
				<strong>Download .ics</strong>
				<span class="text-[13px] text-muted">One-time import of the current schedule.</span>
			</a>
		</div>

		<div class="flex gap-2">
			<input
				class={[control, 'flex-1 font-mono text-[13px] text-muted']}
				readonly
				value={httpUrl}
				aria-label="Calendar link"
				onfocus={(e) => e.currentTarget.select()}
			/>
			<button class="cursor-pointer rounded-[10px] border border-line bg-subtle px-3.5 font-[550] text-fg" onclick={copy} disabled={empty}>
				{copied ? 'Copied ✓' : 'Copy'}
			</button>
		</div>

		<details class="text-sm">
			<summary class="cursor-pointer text-muted">How to subscribe on iPhone</summary>
			<ol class="mt-2.5 mb-1.5 list-decimal pl-5 [&>li]:my-1">
				<li>Copy the link above.</li>
				<li>Open <b>Settings → Apps → Calendar → Calendar Accounts → Add Account → Other</b>.</li>
				<li>Tap <b>Add Subscribed Calendar</b>, paste the link, and save.</li>
			</ol>
			<p class="text-[13px] text-muted">On a Mac, <b>Subscribe</b> opens Calendar directly. Choose iCloud as the location to sync it to your other devices.</p>
		</details>

		{#if isLocal}
			<p class="text-[13px] text-muted">
				This server runs on localhost, so subscriptions only work in Calendar on this Mac. Deploy it publicly to use it on
				iPhone or iCloud.
			</p>
		{/if}
	</div>
</dialog>
