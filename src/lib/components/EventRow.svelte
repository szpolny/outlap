<script module lang="ts">
	import type { Picture } from '@sveltejs/enhanced-img';

	const PHOTOS = import.meta.glob<Picture>('/src/lib/assets/photos/*.{jpg,png}', {
		eager: true,
		query: {
			enhanced: true,
			imgSizes: '(min-width: 980px) 571px, (min-width: 640px) 60vw, 75vw',
			format: 'avif;webp'
		},
		import: 'default'
	});
</script>

<script lang="ts">
	import Calendar from '~icons/lucide/calendar';
	import ChevronDown from '~icons/lucide/chevron-down';
	import { SERIES, type MotorEvent, type Session } from '#lib/series.ts';
	import SeriesLogo from '#lib/components/SeriesLogo.svelte';
	import WatchPanel from '#lib/components/WatchPanel.svelte';
	import {
		anchorDate,
		countdown,
		eventEndMs,
		eventRange,
		isLongEvent,
		fmtDate,
		fmtDay,
		fmtTime,
		localDate,
		mainSession,
		sessionState,
		type SessionFilter,
		type Weekend,
		FILTER_KINDS
	} from '#lib/format.ts';

	interface Props {
		weekend: Weekend;
		timeZone: string;
		/** 'auto' or an ISO country code, shared by every row */
		countryPref: string;
		detectedCountry: string;
		country: string;
		now: number;
		filter: SessionFilter;
		today: string;
		expanded: boolean;
		ontoggle: () => void;
	}

	let { weekend, timeZone, countryPref = $bindable(), detectedCountry, country, now, filter, today, expanded, ontoggle }: Props = $props();

	type Entry = { event: MotorEvent; session: Session };

	/** The headline event names the card; the others share its track and week. */
	const event = $derived(weekend.events[0]);
	const shared = $derived(weekend.events.length > 1);
	const series = $derived(SERIES[event.series]);
	const anchor = $derived(anchorDate(event, timeZone));
	const all = $derived(
		weekend.events
			.flatMap((e) => e.sessions.map((session) => ({ event: e, session })))
			.sort((a, b) => a.session.start.localeCompare(b.session.start))
	);
	const entries = $derived(all.filter((x) => FILTER_KINDS[filter].includes(x.session.kind)));
	const main = $derived(mainSession(event));
	const live = $derived(all.filter((x) => sessionState(x.session, now) === 'live'));
	const next = $derived(entries.find((x) => sessionState(x.session, now) === 'upcoming'));
	const finished = $derived(weekend.events.every((e) => eventEndMs(e) <= now));
	const raceDay = $derived(anchor === today);
	const pictured = $derived(weekend.events.find((e) => e.photo));
	const photo = $derived(pictured?.photo && PHOTOS[`/src/lib/assets${pictured.photo.src}`]);
	const location = $derived(weekend.events.find((e) => e.location)?.location);

	const days = $derived.by(() => {
		const groups = new Map<string, Entry[]>();
		for (const x of entries) {
			const key = localDate(x.session.start, timeZone);
			groups.set(key, [...(groups.get(key) ?? []), x]);
		}
		return [...groups];
	});

	/** Session names repeat across series ("Race"), so shared weekends prefix the series. */
	const label = (x: Entry) => (shared ? `${SERIES[x.event.series].short} ${x.session.name}` : x.session.name);

	const detailsId = $derived(`details-${weekend.id}`);

	const pill = 'inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[12.5px] whitespace-nowrap';
	const tag = 'rounded-[4px] px-1.5 py-px text-[10.5px] font-bold tracking-[0.04em] uppercase';
	const btn = 'inline-flex items-center gap-[7px] rounded-[9px] px-3 py-[7px] text-[13.5px] font-[550]';
	const sep = "before:mr-2 before:opacity-60 before:content-['·']";
</script>

<article
	class={[
		'relative overflow-hidden rounded-2xl border bg-panel transition-[border-color,box-shadow] duration-150',
		expanded
			? 'border-[color-mix(in_srgb,var(--c)_35%,var(--color-line))] shadow-card'
			: 'border-line hover:border-[color-mix(in_srgb,var(--c)_35%,var(--color-line))]'
	]}
	style:--c={series.color}
>
	<button
		class={[
			'relative box-border grid w-full cursor-pointer items-center gap-x-4 gap-y-3 p-4 text-left focus-visible:rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--c) sm:gap-x-5 sm:px-5 sm:py-[18px]',
			event.track
				? 'grid-cols-[44px_minmax(0,1fr)_40px] sm:grid-cols-[52px_minmax(0,1fr)_auto_48px]'
				: 'grid-cols-[44px_minmax(0,1fr)_16px] sm:grid-cols-[52px_minmax(0,1fr)_auto_16px]',
			finished && 'opacity-55'
		]}
		aria-expanded={expanded}
		aria-controls={detailsId}
		title="Session schedule and where to watch"
		onclick={ontoggle}
	>
		{#if pictured?.photo && photo}
			<!-- The photo shows on the right and fades into the card, so the text stays readable. -->
			<span class="pointer-events-none absolute inset-y-0 right-0 block w-[75%] sm:w-[60%]" aria-hidden="true">
				<enhanced:img
					src={photo}
					alt=""
					loading="lazy"
					decoding="async"
					sizes="(min-width: 980px) 571px, (min-width: 640px) 60vw, 75vw"
					class="absolute inset-0 h-full w-full object-cover"
					style:object-position={pictured.photo.focus}
				/>
			</span>
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

		<span class="relative flex min-w-0 flex-col gap-1">
			<span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
				<span class="flex items-center gap-2.5">
					{#each weekend.events as e (e.id)}
						<span class="flex" style:color={SERIES[e.series].color}><SeriesLogo series={e.series} class="h-[11px]" /></span>
					{/each}
				</span>
				{#if event.round && !shared}<span class={sep}>Round {event.round}</span>{/if}
				<span class={[sep, 'hidden sm:inline']}>{eventRange(event, timeZone)}</span>
			</span>
			<span class="overflow-hidden text-[16.5px] font-[620] text-ellipsis tracking-[-0.01em] sm:whitespace-nowrap">{event.name}</span>
			{#if location}<span class="truncate text-[13px] text-muted">{location}</span>{/if}
		</span>

		<span
			class="relative col-start-2 row-start-2 flex flex-wrap items-center gap-2 text-left sm:col-auto sm:row-auto sm:flex-col sm:flex-nowrap sm:items-end sm:gap-1.5 sm:text-right"
		>
			{#if live.length}
				<span class={[pill, 'bg-live font-semibold text-white']}
					><span class="size-[7px] animate-blink rounded-full bg-white"></span>Live · {label(live[0])}</span
				>
			{:else if finished}
				<span class={[pill, 'bg-subtle text-muted']}>Finished</span>
			{:else if isLongEvent(event)}
				<span class={[pill, 'bg-subtle text-fg']}>{eventRange(event, timeZone)}</span>
			{:else if event.allDay}
				<span class={[pill, 'bg-subtle text-fg']}
					>{fmtDate(event.start, { weekday: 'short' })}{#if event.end !== event.start}
						– {fmtDate(event.end, { weekday: 'short' })}{/if}</span
				>
			{:else if next}
				<span
					class={[
						pill,
						Date.parse(next.session.start) - now < 86_400_000
							? 'bg-(--c)/14 font-semibold text-[color-mix(in_srgb,var(--c)_70%,var(--color-fg))]'
							: 'bg-subtle text-fg'
					]}
				>
					{next.session === main ? 'Starts' : label(next)} in {countdown(next.session.start, now)}
				</span>
			{/if}
			{#if main && !event.allDay}
				<span class="text-[13px] whitespace-nowrap text-muted">
					{shared ? `${series.short} ${main.name}` : main.name}
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
					class={['h-8 w-10 bg-current text-fg/75 transition-opacity duration-200 sm:h-9 sm:w-12', expanded && 'opacity-0']}
					style:mask="url(&quot;/tracks/{event.track}.svg&quot;) right top / contain no-repeat"
					aria-hidden="true"
				></span>
			{/if}
			<ChevronDown
				class={['text-muted transition-transform duration-200', expanded && 'rotate-180']}
				width="16"
				height="16"
				aria-hidden="true"
			/>
		</span>
	</button>

	{#if expanded}
		<div
			class="flex flex-col gap-5 border-t border-dashed border-line px-4 pt-4 pb-5 sm:flex-row sm:gap-8 sm:pt-5 sm:pr-5 sm:pb-6 sm:pl-[92px]"
			id={detailsId}
		>
			{#if event.track}
				<!-- The header shows a small outline; the details repeat it large enough to read the corners. -->
				<span
					class="h-32 w-full shrink-0 bg-current text-fg/80 sm:order-last sm:h-40 sm:w-52"
					style:mask="url(&quot;/tracks/{event.track}.svg&quot;) center / contain no-repeat"
					role="img"
					aria-label="Track layout"
				></span>
			{/if}
			<div class="min-w-0 flex-1">
				{#if event.allDay}
					{@const long = { weekday: 'long', day: 'numeric', month: 'long' } as const}
					<p class="text-[13px] text-muted">
						{#if event.series === 'wrc'}
							Rally runs {fmtDate(event.start, long)} to {fmtDate(event.end, long)}. Stage times aren't available from a reliable feed.
						{:else}
							{event.end === event.start ? `Race day: ${fmtDate(event.start, long)}` : `Runs ${fmtDate(event.start, long)} to ${fmtDate(event.end, long)}`}.
							Session times aren't available from a reliable feed.
						{/if}
					</p>
				{:else}
					<div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-8 gap-y-5">
						{#each days as [day, list] (day)}
							<div>
								<h4 class={['mb-2 text-xs font-semibold tracking-[0.06em] uppercase', day === today ? 'text-fg' : 'text-muted']}>
									{fmtDate(day, { weekday: 'long' })}
									<span class="ml-1 font-normal">{fmtDate(day, { day: 'numeric', month: 'short' })}</span>
								</h4>
								<ul>
									{#each list as x (x.event.id + x.session.name + x.session.start)}
										{@const s = x.session}
										{@const st = sessionState(s, now)}
										<li class={['flex items-center gap-3 py-1 text-sm', st === 'done' && 'opacity-45']}>
											<time class="min-w-[3em] text-muted tabular-nums" datetime={s.start}>{fmtTime(s.start, timeZone)}</time>
											{#if shared}
												<span class="flex w-12 shrink-0" style:color={SERIES[x.event.series].color}>
													<SeriesLogo series={x.event.series} class="h-2.5 max-w-full" />
												</span>
											{/if}
											<span
												class={[
													(s.kind === 'race' || s.kind === 'sprint') && 'font-[620]',
													st === 'done' && 'line-through decoration-current/40'
												]}>{s.name}</span
											>
											{#if st === 'live'}<span class={[tag, 'bg-live text-white']}>Live</span>{/if}
											{#if x === next}<span class={[tag, 'bg-subtle text-muted']}>Next</span>{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
					{#if entries.length < all.length}
						<p class="mt-3 text-[13px] text-muted">{all.length - entries.length} more sessions hidden by the session filter.</p>
					{/if}
				{/if}
				<WatchPanel events={weekend.events} bind:countryPref {detectedCountry} {country} />
				<div class="mt-5 flex flex-wrap gap-2">
					{#each weekend.events as e (e.id)}
						<a
							class={[btn, 'bg-fg text-bg']}
							href="/calendar.ics?event={encodeURIComponent(e.id)}&download=1"
							download
							title="Add {SERIES[e.series].name} · {e.name} to calendar"
						>
							<Calendar width="14" height="14" aria-hidden="true" />
							{#if shared}
								<SeriesLogo series={e.series} class="h-[11px]" />
							{:else}
								Add to calendar
							{/if}
						</a>
					{/each}
					{#if event.url}
						<a class={[btn, 'border border-line text-fg']} href={event.url} target="_blank" rel="noopener">Event page ↗</a>
					{/if}
				</div>
				{#if pictured?.photo}
					<p class="mt-4 truncate text-[11px] text-muted">
						Photo: <a class="underline decoration-current/40 underline-offset-2" href={pictured.photo.page} target="_blank" rel="noopener"
							>{pictured.photo.credit || 'Wikimedia Commons'}</a
						>
					</p>
				{/if}
			</div>
		</div>
	{/if}
</article>
