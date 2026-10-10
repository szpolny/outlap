<script lang="ts">
	import { SERIES, type MotorEvent, type Session } from '#lib/series.ts';
	import SeriesLogo from '#lib/components/SeriesLogo.svelte';
	import {
		anchorDate,
		countdown,
		eventEndMs,
		eventRange,
		fmtDate,
		fmtDay,
		fmtTime,
		localDate,
		mainSession,
		sessionState,
		type SessionFilter,
		FILTER_KINDS
	} from '#lib/format.ts';

	interface Props {
		event: MotorEvent;
		timeZone: string;
		now: number;
		filter: SessionFilter;
		today: string;
		expanded: boolean;
		ontoggle: () => void;
	}

	let { event, timeZone, now, filter, today, expanded, ontoggle }: Props = $props();

	const series = $derived(SERIES[event.series]);
	const anchor = $derived(anchorDate(event, timeZone));
	const sessions = $derived(event.sessions.filter((s) => FILTER_KINDS[filter].includes(s.kind)));
	const main = $derived(mainSession(event));
	const live = $derived(event.sessions.filter((s) => sessionState(s, now) === 'live'));
	const next = $derived(sessions.find((s) => sessionState(s, now) === 'upcoming'));
	const finished = $derived(eventEndMs(event) <= now);
	const raceDay = $derived(anchor === today);

	const days = $derived.by(() => {
		const groups = new Map<string, Session[]>();
		for (const s of sessions) {
			const key = localDate(s.start, timeZone);
			groups.set(key, [...(groups.get(key) ?? []), s]);
		}
		return [...groups];
	});

	const detailsId = $derived(`details-${event.id}`);

	const pill = 'inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[12.5px] whitespace-nowrap';
	const tag = 'rounded-[4px] px-1.5 py-px text-[10.5px] font-bold tracking-[0.04em] uppercase';
	const btn = 'inline-flex items-center gap-[7px] rounded-[9px] px-3 py-[7px] text-[13.5px] font-[550]';
	const sep = "before:mr-2 before:opacity-60 before:content-['·']";
</script>

<article
	class={[
		"relative overflow-hidden rounded-[14px] border bg-panel transition-[border-color,box-shadow] duration-150 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-(--c) before:content-['']",
		expanded
			? 'border-[color-mix(in_srgb,var(--c)_35%,var(--color-line))] shadow-card'
			: 'border-line hover:border-[color-mix(in_srgb,var(--c)_35%,var(--color-line))]'
	]}
	style:--c={series.color}
>
	<button
		class={[
			'relative box-border grid w-full cursor-pointer items-center gap-3 py-3 pr-3 pl-4 text-left focus-visible:rounded-[14px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--c) sm:gap-4 sm:py-3.5 sm:pr-4 sm:pl-5',
			event.track
				? 'grid-cols-[44px_minmax(0,1fr)_40px] sm:grid-cols-[52px_minmax(0,1fr)_auto_48px]'
				: 'grid-cols-[44px_minmax(0,1fr)_16px] sm:grid-cols-[52px_minmax(0,1fr)_auto_16px]',
			finished && 'opacity-55'
		]}
		aria-expanded={expanded}
		aria-controls={detailsId}
		onclick={ontoggle}
	>
		{#if event.photo}
			<!-- The photo shows on the right and fades into the card, so the text stays readable. -->
			<span
				class="pointer-events-none absolute inset-y-0 right-0 w-[75%] bg-cover bg-center sm:w-[60%]"
				style:background-image="url(&quot;{event.photo.src}&quot;)"
				aria-hidden="true"
			></span>
			<span
				class="pointer-events-none absolute inset-0 bg-linear-to-r from-panel from-25% via-panel/85 via-60% to-panel/65 sm:from-40%"
				aria-hidden="true"
			></span>
		{/if}

		<span
			class={[
				'relative flex h-12 flex-col items-center justify-center rounded-[10px] leading-none sm:h-[52px]',
				raceDay ? 'bg-fg text-bg' : 'bg-subtle'
			]}
			title={raceDay ? 'Race day' : undefined}
		>
			<span class="text-[11px] tracking-[0.06em] uppercase opacity-70">{fmtDate(anchor, { weekday: 'short' })}</span>
			<span class="mt-[3px] text-lg font-[650] tabular-nums sm:text-[21px]">{fmtDate(anchor, { day: 'numeric' })}</span>
		</span>

		<span class="relative flex min-w-0 flex-col gap-0.5">
			<span class="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
				<SeriesLogo series={event.series} class="h-[11px] text-(--c)" />
				{#if event.round}<span class={sep}>Round {event.round}</span>{/if}
				<span class={sep}>{eventRange(event, timeZone)}</span>
			</span>
			<span class="overflow-hidden text-[16.5px] font-[620] text-ellipsis tracking-[-0.01em] sm:whitespace-nowrap">{event.name}</span>
			{#if event.location}<span class="truncate text-[13px] text-muted">{event.location}</span>{/if}
		</span>

		<span
			class="relative col-start-2 row-start-2 flex flex-wrap items-center gap-2 text-left sm:col-auto sm:row-auto sm:flex-col sm:flex-nowrap sm:items-end sm:gap-1.5 sm:text-right"
		>
			{#if live.length}
				<span class={[pill, 'bg-live font-semibold text-white']}
					><span class="size-[7px] animate-blink rounded-full bg-white"></span>Live · {live[0].name}</span
				>
			{:else if finished}
				<span class={[pill, 'bg-subtle text-muted']}>Finished</span>
			{:else if event.allDay}
				<span class={[pill, 'bg-subtle text-fg']}
					>{fmtDate(event.start, { weekday: 'short' })}{#if event.end !== event.start}
						– {fmtDate(event.end, { weekday: 'short' })}{/if}</span
				>
			{:else if next}
				<span
					class={[
						pill,
						Date.parse(next.start) - now < 86_400_000
							? 'bg-(--c)/14 font-semibold text-[color-mix(in_srgb,var(--c)_70%,var(--color-fg))]'
							: 'bg-subtle text-fg'
					]}
				>
					{next === main ? 'Starts' : next.name} in {countdown(next.start, now)}
				</span>
			{/if}
			{#if main && !event.allDay}
				<span class="text-[13px] whitespace-nowrap text-muted">
					{main.name}
					<strong class="ml-1 font-semibold text-fg tabular-nums">{fmtDay(main.start, timeZone)} {fmtTime(main.start, timeZone)}</strong>
				</span>
			{/if}
		</span>

		<span
			class={[
				'relative col-start-3 row-span-2 row-start-1 flex flex-col items-end self-stretch sm:col-auto sm:row-span-1 sm:row-auto',
				event.track ? 'justify-between' : 'justify-center'
			]}
		>
			{#if event.track}
				<span
					class="h-8 w-10 bg-current text-fg/75 sm:h-9 sm:w-12"
					style:mask="url(&quot;/tracks/{event.track}.svg&quot;) right top / contain no-repeat"
					aria-hidden="true"
				></span>
			{/if}
			<svg
				class={['text-muted transition-transform duration-200', expanded && 'rotate-180']}
				viewBox="0 0 16 16"
				width="16"
				height="16"
				aria-hidden="true"
			>
				<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
	</button>

	{#if expanded}
		<div class="border-t border-dashed border-line px-4 pt-3 pb-4 sm:pt-3.5 sm:pr-5 sm:pb-[18px] sm:pl-[88px]" id={detailsId}>
			{#if event.allDay}
				{@const long = { weekday: 'long', day: 'numeric', month: 'long' } as const}
				<p class="mt-3 text-[13px] text-muted">
					{#if event.series === 'wrc'}
						Rally runs {fmtDate(event.start, long)} to {fmtDate(event.end, long)}. Stage times aren't available from a reliable feed.
					{:else}
						{event.end === event.start ? `Race day: ${fmtDate(event.start, long)}` : `Runs ${fmtDate(event.start, long)} to ${fmtDate(event.end, long)}`}.
						Session times aren't available from a reliable feed.
					{/if}
				</p>
			{:else}
				<div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-7 gap-y-3.5">
					{#each days as [day, list] (day)}
						<div>
							<h4 class={['mb-1.5 text-xs font-semibold tracking-[0.06em] uppercase', day === today ? 'text-fg' : 'text-muted']}>
								{fmtDate(day, { weekday: 'long' })}
								<span class="ml-1 font-normal">{fmtDate(day, { day: 'numeric', month: 'short' })}</span>
							</h4>
							<ul>
								{#each list as s (s.name + s.start)}
									{@const st = sessionState(s, now)}
									<li class={['flex items-baseline gap-3 py-1 text-sm', st === 'done' && 'opacity-45']}>
										<time class="min-w-[3em] text-muted tabular-nums" datetime={s.start}>{fmtTime(s.start, timeZone)}</time>
										<span
											class={[
												(s.kind === 'race' || s.kind === 'sprint') && 'font-[620]',
												st === 'done' && 'line-through decoration-current/40'
											]}>{s.name}</span
										>
										{#if st === 'live'}<span class={[tag, 'bg-live text-white']}>Live</span>{/if}
										{#if s === next}<span class={[tag, 'bg-subtle text-muted']}>Next</span>{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
				{#if sessions.length < event.sessions.length}
					<p class="mt-2.5 text-[13px] text-muted">{event.sessions.length - sessions.length} more sessions hidden by the session filter.</p>
				{/if}
			{/if}
			<div class="mt-4 flex flex-wrap gap-2">
				<a class={[btn, 'bg-fg text-bg']} href="/calendar.ics?event={encodeURIComponent(event.id)}&download=1" download>
					<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
					Add to calendar
				</a>
				{#if event.url}
					<a class={[btn, 'border border-line text-fg']} href={event.url} target="_blank" rel="noopener">Event page ↗</a>
				{/if}
			</div>
			{#if event.photo}
				<p class="mt-3 truncate text-[11px] text-muted">
					Photo: <a class="underline decoration-current/40 underline-offset-2" href={event.photo.page} target="_blank" rel="noopener"
						>{event.photo.credit || 'Wikimedia Commons'}</a
					>
				</p>
			{/if}
		</div>
	{/if}
</article>
