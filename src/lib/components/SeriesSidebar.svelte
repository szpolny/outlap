<script lang="ts">
	import ChevronDown from '~icons/lucide/chevron-down';
	import Plus from '~icons/lucide/plus';
	import X from '~icons/lucide/x';
	import { SERIES, SERIES_IDS, type MotorEvent, type SeriesId, type Session, type SessionKind } from '#lib/series.ts';
	import { addDays, countdown, eventEndMs, fmtDate, fmtDay, fmtRange, fmtTime, localDate, weekStart } from '#lib/format.ts';
	import SeriesLogo from '#lib/components/SeriesLogo.svelte';

	interface Props {
		/** followed series */
		selected: SeriesId[];
		/** the one series the calendar is narrowed to, followed or not */
		focus: SeriesId | null;
		events: MotorEvent[];
		kinds: SessionKind[];
		now: number;
		timeZone: string;
		onmanage: () => void;
	}

	let { selected = $bindable(), focus = $bindable(), events, kinds, now, timeZone, onmanage }: Props = $props();

	type Bucket = 'live' | 'week' | 'next' | 'later' | 'none';
	interface Status {
		bucket: Bucket;
		/** sort key within the bucket */
		at: number;
		/** session name, truncated first when space runs out */
		label?: string;
		when: string;
	}

	const SUGGESTIONS = 4;
	const today = $derived(localDate(new Date(now).toISOString(), timeZone));
	const thisWeek = $derived(weekStart(today));

	const bySeries = $derived.by(() => {
		const map = new Map<SeriesId, MotorEvent[]>();
		for (const e of events) map.set(e.series, [...(map.get(e.series) ?? []), e]);
		return map;
	});

	function bucketOf(date: string): Bucket {
		const week = weekStart(date);
		return week <= thisWeek ? 'week' : week === addDays(thisWeek, 7) ? 'next' : 'later';
	}

	function dateText(date: string): string {
		return date.slice(0, 4) === today.slice(0, 4)
			? fmtDate(date, { day: 'numeric', month: 'short' })
			: fmtDate(date, { month: 'short', year: 'numeric' });
	}

	function sessionWhen(session: Session, bucket: Bucket): string {
		const start = session.start;
		return bucket === 'later'
				? dateText(localDate(start, timeZone))
				: Date.parse(start) - now < 12 * 3_600_000
					? `in ${countdown(start, now)}`
					: bucket === 'week'
						? `${fmtDay(start, timeZone)} ${fmtTime(start, timeZone)}`
						: `${fmtDay(start, timeZone)} ${fmtDate(localDate(start, timeZone), { day: 'numeric', month: 'short' })}`;
	}

	/** What the series has next under the current session filter, mirroring the calendar list. */
	function statusOf(id: SeriesId): Status {
		let best: Status = { bucket: 'none', at: Infinity, when: 'Nothing scheduled' };
		for (const e of bySeries.get(id) ?? []) {
			if (eventEndMs(e) <= now) continue;
			const sessions = e.sessions.filter((s) => kinds.includes(s.kind));
			const live = sessions.find((s) => Date.parse(s.start) <= now && now < Date.parse(s.end));
			if (live) return { bucket: 'live', at: Date.parse(live.end), label: live.name, when: `${countdown(live.end, now)} left` };

			const next = sessions.find((s) => Date.parse(s.start) > now);
			if (next) {
				const at = Date.parse(next.start);
				if (at < best.at) {
					const bucket = bucketOf(localDate(next.start, timeZone));
					best = { bucket, at, label: bucket === 'later' ? undefined : next.name, when: sessionWhen(next, bucket) };
				}
			} else if (e.allDay) {
				// Date-only events (rallies, the TT) are listed whatever the session filter.
				const ongoing = e.start <= today;
				const at = ongoing ? now : Date.parse(`${e.start}T00:00:00Z`);
				if (at < best.at) {
					const bucket = ongoing ? 'week' : bucketOf(e.start);
					const when = ongoing
						? `until ${fmtDate(e.end, { day: 'numeric', month: 'short' })}`
						: bucket === 'later'
							? dateText(e.start)
							: fmtRange(e.start, e.end);
					best = { bucket, at, label: ongoing ? 'On now' : undefined, when };
				}
			}
		}
		return best;
	}

	const statuses = $derived(new Map(SERIES_IDS.map((id) => [id, statusOf(id)])));

	const SECTIONS: { bucket: Bucket; title: string }[] = [
		{ bucket: 'live', title: 'Live' },
		{ bucket: 'week', title: 'This week' },
		{ bucket: 'next', title: 'Next week' },
		{ bucket: 'later', title: 'Later' }
	];

	const byTime = (a: SeriesId, b: SeriesId) => statuses.get(a)!.at - statuses.get(b)!.at;
	const sections = $derived(
		SECTIONS.map((s) => ({ ...s, ids: selected.filter((id) => statuses.get(id)!.bucket === s.bucket).sort(byTime) })).filter(
			(s) => s.ids.length > 0
		)
	);
	const idle = $derived(selected.filter((id) => statuses.get(id)!.bucket === 'none'));
	/** Unfollowed series racing this week, as a way to discover more than the picker's long list. */
	const suggested = $derived(
		SERIES_IDS.filter((id) => !selected.includes(id) && ['live', 'week'].includes(statuses.get(id)!.bucket)).sort(byTime)
	);

	let showIdle = $state(false);

	function unfollow(id: SeriesId) {
		selected = selected.filter((s) => s !== id);
		if (focus === id) focus = null;
	}

	function follow(id: SeriesId) {
		// Keep metadata order, which the subscribe link and the picker also use.
		selected = SERIES_IDS.filter((s) => s === id || selected.includes(s));
	}

	const heading = 'px-2 text-xs font-semibold tracking-[0.06em] text-muted uppercase';
</script>

<div class="flex items-center justify-between gap-3 px-2">
	<h2 class="text-[15px] font-bold tracking-[-0.01em]">Series</h2>
	<button class="cursor-pointer text-[13px] text-muted hover:text-fg" onclick={onmanage}>Manage</button>
</div>

{#if selected.length === 0}
	<div class="flex flex-col items-start gap-2 px-2 text-[13px] text-muted">
		<p>You aren’t following any series yet.</p>
		<button class="cursor-pointer rounded-[10px] bg-accent px-3 py-1.5 font-semibold text-white hover:brightness-[1.08]" onclick={onmanage}>
			Choose series
		</button>
	</div>
{/if}

{#each sections as { bucket, title, ids } (bucket)}
	<section class="flex flex-col gap-0.5" aria-label={title}>
		<h3 class={[heading, 'mb-1 flex items-center gap-1.5', bucket === 'live' && 'text-live']}>
			{#if bucket === 'live'}<span class="size-1.5 animate-pulse rounded-full bg-live" aria-hidden="true"></span>{/if}
			{title}
		</h3>
		<ul class="flex flex-col gap-0.5">
			{#each ids as id (id)}
				{@render row(id, true)}
			{/each}
		</ul>
	</section>
{/each}

{#if idle.length}
	<section class="flex flex-col gap-0.5">
		<button
			class={[heading, 'flex cursor-pointer items-center gap-1 py-0.5 hover:text-fg']}
			aria-expanded={showIdle}
			onclick={() => (showIdle = !showIdle)}
		>
			{idle.length} off season
			<ChevronDown class={['transition-transform duration-200', showIdle && 'rotate-180']} width="13" height="13" aria-hidden="true" />
		</button>
		{#if showIdle}
			<ul class="mt-1 flex flex-col gap-0.5">
				{#each idle as id (id)}
					{@render row(id, true)}
				{/each}
			</ul>
		{/if}
	</section>
{/if}

{#if suggested.length}
	<section class="flex flex-col gap-0.5 border-t border-line pt-4" aria-label="Also racing this week">
		<h3 class={[heading, 'mb-1']}>Also this week</h3>
		<ul class="flex flex-col gap-0.5">
			{#each suggested.slice(0, SUGGESTIONS) as id (id)}
				{@render row(id, false)}
			{/each}
		</ul>
		{#if suggested.length > SUGGESTIONS}
			<button class="cursor-pointer self-start rounded-md px-2 py-0.5 text-xs font-[550] text-muted hover:text-fg" onclick={onmanage}>
				+{suggested.length - SUGGESTIONS} more
			</button>
		{/if}
	</section>
{/if}

{#snippet row(id: SeriesId, following: boolean)}
	{@const status = statuses.get(id)!}
	{@const focused = focus === id}
	<li class="group/row relative" style:--c={SERIES[id].color}>
		<!-- Clicking narrows the calendar to this series; following is changed with the side button. -->
		<button
			class={[
				'flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg py-1.5 pr-8 pl-2 text-left transition-colors duration-[120ms]',
				focused ? 'bg-[color-mix(in_srgb,var(--c)_14%,var(--color-subtle))]' : 'hover:bg-subtle'
			]}
			aria-pressed={focused}
			title={focused ? 'Show all your series' : `Show only ${SERIES[id].name}`}
			onclick={() => (focus = focused ? null : id)}
		>
			<SeriesLogo series={id} class={['h-3 max-w-full', following || focused ? 'text-(--c)' : 'text-muted']} />
			<span
				class={[
					'flex w-full min-w-0 gap-1 text-[12px] leading-tight whitespace-nowrap tabular-nums',
					status.bucket === 'live' ? 'font-[550] text-live' : 'text-muted',
					!following && !focused && 'opacity-80'
				]}
			>
				{#if status.label}<span class="min-w-0 truncate">{status.label}</span><span aria-hidden="true">·</span>{/if}
				<span class="shrink-0">{status.when}</span>
			</span>
		</button>
		<button
			class={[
				'absolute top-1/2 right-1 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted hover:bg-[color-mix(in_srgb,var(--color-fg)_10%,transparent)] hover:text-fg focus-visible:opacity-100',
				following && 'opacity-0 group-hover/row:opacity-100'
			]}
			aria-label="{following ? 'Unfollow' : 'Follow'} {SERIES[id].name}"
			title={following ? 'Unfollow' : 'Follow'}
			onclick={() => (following ? unfollow(id) : follow(id))}
		>
			{#if following}<X width="13" height="13" aria-hidden="true" />{:else}<Plus width="14" height="14" aria-hidden="true" />{/if}
		</button>
	</li>
{/snippet}
