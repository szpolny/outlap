<script lang="ts">
	import outlapMark from '#lib/assets/favicon.svg';
	import { FILTER_KINDS } from '#lib/format.ts';
	import { SERIES, SERIES_IDS } from '#lib/series.ts';
	import { DEFAULT_LIMIT, MAX_LIMIT } from '#lib/api.ts';
	import ThemeToggle from '@szpolny/calendar-kit/ThemeToggle.svelte';

	const base = 'https://outlap.lol/api/v1';

	const eventExample = `{
  "generatedAt": "2026-11-22T06:58:31.087Z",
  "events": [
    {
      "id": "f1-2026-1",
      "series": "f1",
      "name": "Australian Grand Prix",
      "round": 1,
      "location": "Albert Park Grand Prix Circuit, Melbourne, Australia",
      "start": "2026-03-06T01:30:00.000Z",
      "end": "2026-03-08T06:00:00.000Z",
      "allDay": false,
      "url": "https://en.wikipedia.org/wiki/2026_Australian_Grand_Prix",
      "calendarUrl": "https://outlap.lol/calendar.ics?event=f1-2026-1",
      "sessions": [
        {
          "name": "Qualifying",
          "kind": "qualifying",
          "start": "2026-03-07T05:00:00.000Z",
          "end": "2026-03-07T06:00:00.000Z",
          "estimatedEnd": true
        },
        {
          "name": "Race",
          "kind": "race",
          "start": "2026-03-08T04:00:00.000Z",
          "end": "2026-03-08T06:00:00.000Z",
          "estimatedEnd": true
        }
      ]
    }
  ],
  "nextCursor": null
}`;

	const allDayExample = `{
  "id": "dakar-2026",
  "series": "dakar",
  "name": "Dakar Rally 2026",
  "location": "Saudi Arabia",
  "start": "2026-01-03",
  "end": "2026-01-17",
  "allDay": true,
  "url": "https://en.wikipedia.org/wiki/2026_Dakar_Rally",
  "calendarUrl": "https://outlap.lol/calendar.ics?event=dakar-2026",
  "sessions": []
}`;

	const errorExample = `{ "error": { "status": 400, "message": "Unknown series: f9" } }`;

	const fetchExample = `const url = new URL('${base}/events?series=f1&sessions=races&from=2026-03-01');
const events = [];
for (let cursor = null; ; ) {
  if (cursor) url.searchParams.set('cursor', cursor);
  const page = await (await fetch(url)).json();
  events.push(...page.events);
  cursor = page.nextCursor;
  if (!cursor) break;
}
for (const e of events) console.log(e.name, e.sessions.at(-1)?.start);`;
</script>

<svelte:head>
	<title>API · Outlap</title>
	<meta name="description" content="A free, read-only JSON API and iCalendar feeds for motorsport schedules from Outlap." />
	<link rel="canonical" href="https://outlap.lol/api" />
	<meta name="theme-color" content="#0f1012" media="(prefers-color-scheme: dark)" />
	<meta name="theme-color" content="#f5f5f3" media="(prefers-color-scheme: light)" />
</svelte:head>

{#snippet code(text: string)}
	<pre class="my-3 overflow-x-auto rounded-md border border-line bg-panel p-3 text-[13px] leading-relaxed"><code>{text}</code></pre>
{/snippet}

{#snippet endpoint(path: string)}
	<p class="mt-6 font-mono text-[14px]"><span class="font-semibold text-accent">GET</span> {path}</p>
{/snippet}

<div class="mx-auto max-w-[680px] px-4 pt-[18px] pb-20 sm:pt-7">
	<header class="mb-8 flex items-center justify-between gap-3">
		<a href="/" class="flex items-center gap-2 font-display text-[28px] leading-none font-black uppercase italic tracking-[0.02em] [font-stretch:112%]">
			Outlap
			<span class="size-[1em] bg-accent mask-(--mark) mask-contain mask-center mask-no-repeat" style:--mark={`url("${outlapMark}")`} aria-hidden="true"></span>
		</a>
		<ThemeToggle storageKey="outlap:theme" colors={{ light: '#f5f5f3', dark: '#0f1012' }} />
	</header>

	<main
		class="[&_a]:underline [&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-fg [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-subtle [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:text-[0.9em] [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:font-semibold [&_tr]:border-b [&_tr]:border-line"
	>
		<h1 class="text-[22px] font-semibold">API</h1>
		<p>
			Outlap's schedule is available as a free, read-only JSON API and as iCalendar feeds. No key or sign-up is needed, and requests are
			allowed from any origin. Base URL:
		</p>
		{@render code(base)}
		<p>
			The full description is available as <a href="/api/v1/openapi.json">OpenAPI 3.1</a>, which you can load into most API clients and
			code generators.
		</p>

		<h2>Fair use</h2>
		<ul>
			<li>
				The schedule is rebuilt about once an hour and responses are cached for five minutes, so there is no point polling more often than
				that. If you serve many users, fetch once on your server rather than from every client.
			</li>
			<li>
				More than 30 requests to <code>/api/</code> within 10 seconds from one IP address are blocked for 10 seconds with status 429, whose
				body is not JSON. Wait and retry; paging through the whole schedule takes only a few requests.
			</li>
			<li>Send a descriptive <code>User-Agent</code> if you can, so heavy traffic can be traced to you rather than blocked.</li>
			<li>
				Schedules come from series sites and Wikipedia, and change without notice. Treat them as a guide and check the series' own site for anything that matters. Mentioning Outlap is appreciated but not required.
			</li>
		</ul>

		<h2>Times and events</h2>
		<p>
			All times are UTC, in ISO 8601. An event is a race weekend or a rally; its <code>sessions</code> are the practice, qualifying and
			race sessions in order. Most organisers publish only start times, so <code>estimatedEnd</code> marks an end time Outlap has estimated.
		</p>
		<p>
			Until a timetable is published, an event is <code>allDay</code>: <code>start</code> and <code>end</code> are then dates
			(<code>end</code> inclusive) and <code>sessions</code> is empty. Previous years' times are never used as a guess. Event ids are
			stable across refreshes, so you can store them.
		</p>
		{@render code(allDayExample)}

		<h2>Endpoints</h2>

		{@render endpoint('/events')}
		<p>
			Events overlapping a time window, ordered by start, in pages of up to {DEFAULT_LIMIT}. With no filters, it covers every event in the
			current and next season.
		</p>
		<table class="my-3 w-full text-[14px]">
			<thead><tr><th>Parameter</th><th>Description</th></tr></thead>
			<tbody>
				<tr><td><code>series</code></td><td>Comma-separated <a href="#series">series ids</a>, such as <code>f1,motogp</code>. Defaults to all series.</td></tr>
				<tr><td><code>from</code></td><td>Only events ending after this point. A date (<code>2026-03-01</code>) means midnight UTC; a date-time needs an offset (<code>2026-03-01T12:00:00+02:00</code>).</td></tr>
				<tr><td><code>to</code></td><td>Only events starting before this point. A date includes the whole UTC day.</td></tr>
				<tr>
					<td><code>sessions</code></td>
					<td>
						<code>all</code> (default), <code>main</code> ({FILTER_KINDS.main.join(', ')}) or <code>races</code> ({FILTER_KINDS.races.join(', ')}).
						Timed events left with no sessions are dropped.
					</td>
				</tr>
				<tr><td><code>limit</code></td><td>Events per page, from 1 to {MAX_LIMIT}. Defaults to {DEFAULT_LIMIT}.</td></tr>
				<tr><td><code>cursor</code></td><td>The <code>nextCursor</code> from the previous page.</td></tr>
			</tbody>
		</table>
		{@render code(`curl '${base}/events?series=f1&from=2026-03-01&to=2026-03-08&sessions=main'`)}
		{@render code(eventExample)}

		<p>
			<code>nextCursor</code> is <code>null</code> on the last page. Otherwise, request the same URL with <code>cursor</code> set to it to
			get the next page, keeping the other parameters unchanged. Cursors stay valid when the schedule refreshes between pages: you get the
			events after the last one you received. Don't build or edit cursors yourself; their format may change.
		</p>

		{@render endpoint('/events/{id}')}
		<p>One event with all its sessions, as <code>{'{ "generatedAt", "event" }'}</code>. Unknown ids return 404.</p>

		{@render endpoint('/series')}
		<p>Every series with its <code>id</code>, full <code>name</code>, <code>short</code> name, brand <code>color</code> and <code>group</code>.</p>

		{@render endpoint('/status')}
		<p>
			When the schedule was built (<code>generatedAt</code>) and, for each data source, whether its last refresh worked and when the data
			now served was fetched. A failed source keeps serving its last good data.
		</p>

		<h2>Errors</h2>
		<p>Invalid parameters return 400 and unknown events 404, with a JSON body:</p>
		{@render code(errorExample)}

		<h2>Example</h2>
		{@render code(fetchExample)}

		<h2>Calendar feeds</h2>
		<p>
			To put races in a calendar app rather than your own code, subscribe to <code>https://outlap.lol/calendar.ics</code>. It takes
			<code>series</code> and <code>sessions</code> as above, plus <code>alarm</code> (minutes of warning before each session). Each event's
			<code>calendarUrl</code> is a feed of that event alone. Add <code>download=1</code> to download a file instead of opening it.
		</p>

		<h2>Versioning</h2>
		<p>
			Within <code>/v1</code>, fields and series may be added but none will be removed or change meaning; ignore fields you don't know.
			Breaking changes get a new version, with the old one kept running for a while. <code>/api/events</code>, which predates this API,
			is deprecated: switch to <code>/api/v1/events</code>. Questions and requests go to
			<a href="https://github.com/szpolny/outlap/issues">GitHub</a>.
		</p>

		<h2 id="series">Series ids</h2>
		<table class="my-3 w-full text-[14px]">
			<thead><tr><th>Id</th><th>Series</th></tr></thead>
			<tbody>
				{#each SERIES_IDS as id (id)}
					<tr><td><code>{id}</code></td><td>{SERIES[id].name}</td></tr>
				{/each}
			</tbody>
		</table>

		<p class="mt-10"><a href="/">Back to the calendar</a></p>
	</main>
</div>
