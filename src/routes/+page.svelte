<script lang="ts">
	import CalendarPlus from '~icons/lucide/calendar-plus';
	import ArrowUp from '~icons/lucide/arrow-up';
	import ChevronDown from '~icons/lucide/chevron-down';
	import GitHub from '~icons/simple-icons/github';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import outlapMark from '#lib/assets/favicon.svg';
	import { SERIES, SERIES_IDS, DEFAULT_SERIES_IDS, type MotorEvent, type SeriesId, type Session } from '#lib/series.ts';
	import {
		FILTER_KINDS,
		FILTER_LABELS,
		addDays,
		anchorDate,
		countdown,
		eventEndMs,
		fmtDate,
		fmtDay,
		fmtRange,
		fmtTime,
		groupWeekends,
		localDate,
		sessionState,
		weekStart,
		type SessionFilter,
		type Weekend
	} from '#lib/format.ts';
	import EventRow from '#lib/components/EventRow.svelte';
	import SeriesLogo from '#lib/components/SeriesLogo.svelte';
	import SeriesList from '#lib/components/SeriesList.svelte';
	import SeriesSheet from '#lib/components/SeriesSheet.svelte';
	import SubscribeDialog from '#lib/components/SubscribeDialog.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import TimeZonePicker from '#lib/components/TimeZonePicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const siteUrl = 'https://outlap.lol/';
	const siteTitle = 'Outlap · Motorsport Calendar & Race Schedules';
	const siteDescription =
		'Follow F1, MotoGP, WEC, IndyCar and more with race, qualifying and practice times in your local time zone. Subscribe to stay updated in Apple Calendar.';
	const websiteSchema = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'Outlap',
		url: siteUrl,
		description: siteDescription,
		inLanguage: 'en'
	});

	const FILTERS = Object.keys(FILTER_LABELS) as SessionFilter[];
	const STORAGE_KEY = 'outlap:prefs';

	let selected = $state<SeriesId[]>([...DEFAULT_SERIES_IDS]);
	let filter = $state<SessionFilter>('all');
	let alarm = $state(0);
	let subscribeOpen = $state(false);
	let seriesOpen = $state(false);
	let prefsLoaded = $state(false);
	let barHeight = $state(0);
	let scrollY = $state(0);
	let innerHeight = $state(0);
	let showFinished = $state(false);
	const expanded = new SvelteSet<string>();

	// Server renders in UTC; the browser switches to the viewer's zone after hydration.
	let detectedZone = $state('UTC');
	/** 'auto' follows the device; otherwise an IANA zone picked by the viewer */
	let zonePref = $state('auto');
	const timeZone = $derived(zonePref === 'auto' ? detectedZone : zonePref);
	let now = $state(Date.now());

	onMount(() => {
		detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		try {
			const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
			if (prefs) {
				if (Array.isArray(prefs.selected)) selected = prefs.selected.filter((s: string) => s in SERIES);
				if (prefs.filter in FILTER_KINDS) filter = prefs.filter;
				alarm = Number(prefs.alarm) || 0;
				if (typeof prefs.timeZone === 'string' && isValidZone(prefs.timeZone)) zonePref = prefs.timeZone;
			}
		} catch {
			// storage unavailable; defaults are fine
		}
		prefsLoaded = true;
		const timer = setInterval(() => (now = Date.now()), 20_000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (!prefsLoaded) return;
		const prefs = JSON.stringify({ selected, filter, alarm, timeZone: zonePref });
		try {
			localStorage.setItem(STORAGE_KEY, prefs);
		} catch {
			// ignore
		}
	});

	function isValidZone(zone: string): boolean {
		if (zone === 'auto') return true;
		try {
			new Intl.DateTimeFormat('en', { timeZone: zone });
			return true;
		} catch {
			return false;
		}
	}

	const kinds = $derived(FILTER_KINDS[filter]);
	const today = $derived(localDate(new Date(now).toISOString(), timeZone));
	const thisWeek = $derived(weekStart(today));

	const matching = $derived(
		data.events.filter(
			(e) =>
				weekStart(anchorDate(e, timeZone)) >= thisWeek &&
				selected.includes(e.series) &&
				(e.allDay || e.sessions.some((s) => kinds.includes(s.kind)))
		)
	);

	type WeekItem =
		| { type: 'week'; start: string; upcoming: Weekend[]; finished: Weekend[] }
		| { type: 'gap'; start: string; weeks: number };

	const weeks = $derived.by((): WeekItem[] => {
		const byWeek = new Map<string, MotorEvent[]>();
		for (const e of matching) {
			const week = weekStart(anchorDate(e, timeZone));
			byWeek.set(week, [...(byWeek.get(week) ?? []), e]);
		}
		const keys = [...byWeek.keys()].sort();
		if (keys.length === 0) return [];

		// Walk week by week so runs of empty weeks become a single "quiet" divider.
		const items: WeekItem[] = [];
		for (let week = keys[0]; week <= keys.at(-1)!; week = addDays(week, 7)) {
			const events = byWeek.get(week);
			if (events) {
				const weekends = groupWeekends(events, timeZone);
				const isFinished = (w: Weekend) => w.events.every((e) => eventEndMs(e) <= now);
				items.push({
					type: 'week',
					start: week,
					upcoming: weekends.filter((w) => !isFinished(w)),
					finished: weekends.filter(isFinished)
				});
			} else {
				const last = items.at(-1);
				if (last?.type === 'gap') last.weeks++;
				else items.push({ type: 'gap', start: week, weeks: 1 });
			}
		}
		return items;
	});

	/** Event id → id of the weekend card it is shown in, so the live hero can expand it. */
	const weekendOf = $derived(
		new Map(
			weeks.flatMap((item) =>
				item.type === 'week' ? [...item.upcoming, ...item.finished].flatMap((w) => w.events.map((e) => [e.id, w.id] as const)) : []
			)
		)
	);

	const liveNow = $derived(
		matching.flatMap((event) =>
			event.sessions
				.filter((s) => kinds.includes(s.kind) && sessionState(s, now) === 'live')
				.map((session) => ({ event, session }))
		)
	);

	const nextUp = $derived.by(() => {
		let best: { event: MotorEvent; session: Session } | null = null;
		for (const event of matching) {
			for (const session of event.sessions) {
				if (!kinds.includes(session.kind) || Date.parse(session.start) <= now) continue;
				if (!best || session.start < best.session.start) best = { event, session };
			}
		}
		return best;
	});

	const weeksFromNow = (start: string) => Math.round((Date.parse(start) - Date.parse(thisWeek)) / (7 * 86_400_000));

	function weekTitle(start: string): string {
		const diff = weeksFromNow(start);
		if (diff === 0) return 'This week';
		if (diff === 1) return 'Next week';
		return fmtRange(start, addDays(start, 6));
	}

	function weekSubtitle(start: string): string {
		const diff = weeksFromNow(start);
		if (diff <= 1) return fmtRange(start, addDays(start, 6));
		return `in ${diff} weeks`;
	}

	function toggleExpanded(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}

	const allSelected = $derived(selected.length === SERIES_IDS.length);
	const seriesSummary = $derived(
		allSelected
			? 'All series'
			: selected.length === 0
				? 'No series'
				: selected.length === 1
					? SERIES[selected[0]].name
					: `${selected.length} of ${SERIES_IDS.length} series`
	);
	const failing = $derived(data.sources.filter((s) => !s.ok));
	const oldestRefresh = $derived(data.sources.map((s) => s.fetchedAt).filter(Boolean).sort()[0]);

	const hero =
		'mb-5 flex rounded-2xl border border-[color-mix(in_srgb,var(--c,var(--color-accent))_25%,var(--color-line))] bg-panel bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--c,var(--color-accent))_18%,transparent),transparent_60%)] px-4 py-3.5 sm:px-5 sm:py-[18px]';
	const eyebrow = 'inline-flex items-center gap-[7px] text-[11.5px] font-bold tracking-[0.08em] uppercase';
	const heroBadge = 'mb-1 h-3 self-start text-(--c)';
	const heroName = 'text-[15px] font-[650] tracking-[-0.01em] sm:text-[17px]';
	const heroSession = 'text-[13px] text-muted sm:text-sm';

	function scrollToTop() {
		const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' });
	}
</script>

<svelte:window bind:scrollY bind:innerHeight />

<svelte:head>
	<title>{siteTitle}</title>
	<meta name="description" content={siteDescription} />
	<link rel="canonical" href={siteUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Outlap" />
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	<meta property="og:url" content={siteUrl} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={siteTitle} />
	<meta name="twitter:description" content={siteDescription} />
	{@html `<script type="application/ld+json">${websiteSchema}</script>`}
	<meta name="theme-color" content="#0f1012" media="(prefers-color-scheme: dark)" />
	<meta name="theme-color" content="#f5f5f3" media="(prefers-color-scheme: light)" />
</svelte:head>

<div class="mx-auto max-w-[980px] px-4 lg:max-w-[1240px] pt-[18px] pb-20 sm:pt-7" style:--bar-h="{barHeight}px">
	<header class="mb-6 flex items-center justify-between gap-3 sm:mb-8">
		<div class="min-w-0">
			<h1 class="flex items-center gap-2 font-display text-[28px] leading-none font-black uppercase italic tracking-[0.02em] [font-stretch:112%] sm:text-[32px]">
				Outlap
				<span class="size-[1em] bg-accent mask-(--mark) mask-contain mask-center mask-no-repeat" style:--mark={`url("${outlapMark}")`} aria-hidden="true"></span>
			</h1>
			<p class="mt-1 flex min-w-0 items-center gap-1 text-[13px] text-muted">
				<span class="font-display text-[12px] font-semibold uppercase italic tracking-[0.08em]">Motorsport calendar</span>
				<span aria-hidden="true">·</span>
				Times in <TimeZonePicker bind:value={zonePref} detected={detectedZone} />
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<a
				class="grid size-9 place-items-center rounded-full bg-subtle text-muted hover:bg-[color-mix(in_srgb,var(--color-fg)_12%,var(--color-subtle))] hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
				href="https://github.com/szpolny/outlap"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="Source code on GitHub"
				title="Source code on GitHub"
			>
				<GitHub width="17" height="17" aria-hidden="true" />
			</a>
			<ThemeToggle />
		</div>
	</header>

	<div class="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
		<aside class="sticky top-4 hidden max-h-[calc(100dvh-2rem)] flex-col gap-6 self-start overflow-y-auto pr-3 pb-4 [scrollbar-width:thin] lg:flex" aria-label="Series">
			<div class="flex items-center justify-between gap-3 px-1">
				<h2 class="text-[15px] font-bold tracking-[-0.01em]">Series</h2>
				<button
					class="cursor-pointer text-[13px] text-muted hover:text-fg"
					onclick={() => (selected = allSelected ? [] : [...SERIES_IDS])}
				>
					{allSelected ? 'Clear' : 'Select all'}
				</button>
			</div>
			<SeriesList bind:selected layout="list" />
		</aside>

		<div class="min-w-0">
			{#if liveNow.length}
				<section class={[hero, 'flex-col items-stretch gap-2.5 [--c:var(--color-live)]']} aria-live="polite">
					<span class={[eyebrow, 'text-live']}><span class="size-2 animate-throb rounded-full bg-live"></span>Live now</span>
					<div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
						{#each liveNow as { event, session } (event.id + session.name)}
							<button
								class="flex cursor-pointer flex-col rounded-xl border-l-3 border-(--c) bg-subtle px-3 py-2.5 text-left"
								style:--c={SERIES[event.series].color}
								onclick={() => expanded.add(weekendOf.get(event.id) ?? event.id)}
							>
								<SeriesLogo series={event.series} class={heroBadge} />
								<span class={heroName}>{event.name}</span>
								<span class={heroSession}>{session.name} · until {fmtTime(session.end, timeZone)}</span>
							</button>
						{/each}
					</div>
				</section>
			{:else if nextUp}
				{@const s = SERIES[nextUp.event.series]}
				<section class={[hero, 'items-center gap-3.5 sm:gap-6']} style:--c={s.color}>
					<div class="flex shrink-0 flex-col border-r border-line pr-3.5 sm:pr-6">
						<span class={[eyebrow, 'text-muted']}>Next up</span>
						<span class="text-[22px] leading-[1.15] font-bold tracking-[-0.03em] whitespace-nowrap tabular-nums sm:text-[30px]">
							in {countdown(nextUp.session.start, now)}
						</span>
					</div>
					<div class="flex min-w-0 flex-col">
						<SeriesLogo series={nextUp.event.series} class={heroBadge} />
						<span class={heroName}>{nextUp.event.name}</span>
						<span class={heroSession}>
							{nextUp.session.name} · {fmtDay(nextUp.session.start, timeZone)}
							{fmtDate(localDate(nextUp.session.start, timeZone), { day: 'numeric', month: 'short' })},
							{fmtTime(nextUp.session.start, timeZone)}
						</span>
					</div>
				</section>
			{/if}

			<nav
				class="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur-[14px] backdrop-saturate-[1.6]"
				bind:clientHeight={barHeight}
				aria-label="Filters"
			>
				<div class="flex flex-wrap items-center gap-2.5">
					<button
						class="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-panel px-3 text-sm font-[550] hover:bg-subtle sm:min-w-[200px] sm:flex-none lg:hidden"
						onclick={() => (seriesOpen = true)}
					>
						<span class="flex shrink-0 -space-x-[3px]" aria-hidden="true">
							{#each selected.slice(0, 6) as id (id)}
								<span class="size-2.5 rounded-full bg-(--c) ring-2 ring-panel" style:--c={SERIES[id].color}></span>
							{/each}
						</span>
						<span class="truncate">{seriesSummary}</span>
						<ChevronDown class="ml-auto shrink-0 text-muted" width="14" height="14" aria-hidden="true" />
					</button>
					<div
						class="order-last grid w-full grid-cols-3 rounded-[10px] bg-subtle p-[3px] sm:order-none sm:inline-flex sm:w-auto"
						role="radiogroup"
						aria-label="Sessions"
					>
						{#each FILTERS as f (f)}
							<button
								role="radio"
								aria-checked={filter === f}
								class={[
									'cursor-pointer rounded-lg px-[9px] py-[5px] text-[13px] font-[550] whitespace-nowrap sm:px-3 sm:text-[13.5px]',
									filter === f ? 'bg-panel text-fg shadow-[0_1px_3px_rgb(0_0_0/0.12)]' : 'text-muted'
								]}
								onclick={() => (filter = f)}
							>
								{FILTER_LABELS[f]}
							</button>
						{/each}
					</div>
					<button
						class="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] bg-accent px-2.5 py-2 sm:ml-auto text-sm font-semibold whitespace-nowrap text-white hover:brightness-[1.08] sm:px-3.5"
						onclick={() => (subscribeOpen = true)}
						aria-label="Add to Calendar"
					>
						<CalendarPlus width="15" height="15" aria-hidden="true" />
						<span class="hidden sm:inline">Add to Calendar</span>
					</button>
				</div>
			</nav>

			{#if failing.length}
				<div
					class="mt-3 rounded-xl border border-[color-mix(in_srgb,orange_45%,var(--color-line))] bg-[color-mix(in_srgb,orange_10%,var(--color-panel))] px-3.5 py-2.5 text-sm"
					role="status"
				>
					Couldn't refresh {failing.map((f) => f.series.map((s) => SERIES[s].short).join('/')).join(', ')}.
					{failing.some((f) => f.fetchedAt) ? 'Showing the last known schedule.' : ''}
				</div>
			{/if}

			<main class="mt-1.5">
				{#each weeks as item (item.start)}
					{#if item.type === 'gap'}
						<div
							class="mt-10 flex items-center gap-3 text-[13px] text-muted before:flex-1 before:border-t before:border-dashed before:border-line before:content-[''] after:flex-1 after:border-t after:border-dashed after:border-line after:content-['']"
						>
							<span>{item.weeks === 1 ? 'Quiet week' : `${item.weeks} quiet weeks`}</span>
							<span class="opacity-75">{fmtRange(item.start, addDays(item.start, item.weeks * 7 - 1))}</span>
						</div>
					{:else}
						{@const count = item.upcoming.length + item.finished.length}
						<section class="mt-10 first:mt-6" aria-labelledby="w-{item.start}">
							<header class="sticky top-(--bar-h) z-10 flex items-baseline gap-2.5 bg-bg px-0.5 pt-3 pb-3">
								<h2 id="w-{item.start}" class={['text-[17px] font-bold tracking-[-0.01em]', item.start === thisWeek && 'text-accent']}>
									{weekTitle(item.start)}
								</h2>
								<span class="hidden text-[13.5px] text-muted sm:inline">{weekSubtitle(item.start)}</span>
								<span class="ml-auto text-[13px] text-muted tabular-nums">
									{count} event{count === 1 ? '' : 's'}
								</span>
							</header>
							<div class="flex flex-col gap-3">
								{#if item.finished.length}
									<!-- Finished weekends fold into one line so the list opens on what's next. -->
									<button
										class="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-left text-[13.5px] text-muted hover:text-fg sm:px-5"
										aria-expanded={showFinished}
										onclick={() => (showFinished = !showFinished)}
									>
										<span class="font-[550] whitespace-nowrap">{item.finished.length} finished</span>
										<span class="flex min-w-0 items-center gap-2.5 overflow-hidden opacity-70">
											{#each item.finished.flatMap((w) => w.events) as e (e.id)}
												<SeriesLogo series={e.series} class="h-2.5" />
											{/each}
										</span>
										<ChevronDown
											class={['ml-auto shrink-0 transition-transform duration-200', showFinished && 'rotate-180']}
											width="16"
											height="16"
											aria-hidden="true"
										/>
									</button>
									{#if showFinished}
										{#each item.finished as weekend (weekend.id)}
											{@render row(weekend)}
										{/each}
									{/if}
								{/if}
								{#each item.upcoming as weekend (weekend.id)}
									{@render row(weekend)}
								{/each}
							</div>
						</section>
					{/if}
				{:else}
					<div class="py-[60px] text-center text-muted">
						<p class="my-1"><strong class="text-fg">Nothing to show</strong></p>
						<p class="my-1">{selected.length === 0 ? 'Pick at least one series.' : 'No upcoming sessions match these filters.'}</p>
					</div>
				{/each}
			</main>

			<footer class="mt-12 text-[13px] text-muted">
				<details>
					<summary class="cursor-pointer">Data sources{oldestRefresh ? ` · refreshed ${fmtTime(oldestRefresh, timeZone)}` : ''}</summary>
					<ul class="my-3 grid gap-1.5">
						{#each data.sources as src (src.source + src.series.join())}
							<li class="flex flex-wrap items-center gap-2">
								<span class={['size-[7px] rounded-full', src.ok ? 'bg-[#2fa866]' : 'bg-[orange]']}></span>
								<strong class="text-fg">{src.series.map((x) => SERIES[x].short).join(', ')}</strong>
								<span>{src.source}</span>
								{#if src.error}<span class="wrap-anywhere text-[orange]">{src.error}</span>{/if}
							</li>
						{/each}
					</ul>
					<p class="my-[1em]">Schedules refresh hourly. Start times are official; end times are estimated unless the organiser publishes them.</p>
					<p class="my-[1em]">
						Series names and logos are trademarks of their respective owners, used only to identify each championship. Outlap is not
						affiliated with or endorsed by any series.
					</p>
					<p class="my-[1em]">
						Venue photos come from Wikimedia Commons; each event credits its photographer. Track outlines are based on
						<a class="underline" href="https://github.com/bacinger/f1-circuits">f1-circuits</a> (MIT) and
						<a class="underline" href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>.
					</p>
				</details>
			</footer>
		</div>
	</div>
</div>

<button
	class={[
		'fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-panel text-fg shadow-card transition-[opacity,translate] duration-200 hover:bg-subtle sm:right-6 sm:bottom-6',
		scrollY > innerHeight * 1.5 ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
	]}
	onclick={scrollToTop}
	aria-label="Scroll to top"
	title="Scroll to top"
	tabindex={scrollY > innerHeight * 1.5 ? 0 : -1}
>
	<ArrowUp width="20" height="20" aria-hidden="true" />
</button>

{#snippet row(weekend: Weekend)}
	<EventRow
		{weekend}
		{timeZone}
		{now}
		{filter}
		{today}
		expanded={expanded.has(weekend.id)}
		ontoggle={() => toggleExpanded(weekend.id)}
	/>
{/snippet}

<SeriesSheet bind:open={seriesOpen} bind:selected />
<SubscribeDialog bind:open={subscribeOpen} {selected} bind:filter bind:alarm origin={page.url.origin} />
