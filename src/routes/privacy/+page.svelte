<script lang="ts">
	import outlapMark from '#lib/assets/favicon.svg';
	import ThemeToggle from '@szpolny/calendar-kit/ThemeToggle.svelte';

	const updated = '17 October 2026';
</script>

<svelte:head>
	<title>Privacy · Outlap</title>
	<meta name="description" content="What Outlap stores and processes when you use the motorsport calendar." />
	<link rel="canonical" href="https://outlap.lol/privacy" />
	<meta name="theme-color" content="#0f1012" media="(prefers-color-scheme: dark)" />
	<meta name="theme-color" content="#f5f5f3" media="(prefers-color-scheme: light)" />
</svelte:head>

<div class="mx-auto max-w-[680px] px-4 pt-[18px] pb-20 sm:pt-7">
	<header class="mb-8 flex items-center justify-between gap-3">
		<a href="/" class="flex items-center gap-2 font-display text-[28px] leading-none font-black uppercase italic tracking-[0.02em] [font-stretch:112%]">
			Outlap
			<span class="size-[1em] bg-accent mask-(--mark) mask-contain mask-center mask-no-repeat" style:--mark={`url("${outlapMark}")`} aria-hidden="true"></span>
		</a>
		<ThemeToggle storageKey="outlap:theme" colors={{ light: '#f5f5f3', dark: '#0f1012' }} />
	</header>

	<main class="[&_a]:underline [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-fg [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5">
		<h1 class="text-[22px] font-semibold">Privacy</h1>
		<p class="text-[13px] text-muted">Last updated {updated}</p>

		<p>
			Outlap has no accounts, no analytics, no ads and no tracking cookies. This page lists everything that is stored or processed when
			you use it.
		</p>

		<h2>Stored in your browser</h2>
		<p>
			Your followed series, session filter, reminder setting, time zone, country and theme are saved in your browser's local storage so
			the calendar looks the same next time. All of these except the theme are also kept in a cookie, along with your device's time zone.
			The cookie is sent to Outlap with each page load only so the server can show your calendar straight away. It is not stored or
			logged, and nothing in it identifies you. Clear your site data to remove both.
		</p>

		<h2>Processed by the server</h2>
		<p>
			Outlap runs on <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a>. Like any web server, it receives your IP address
			and browser details with each request. Cloudflare uses the IP address to work out your country, which picks the default viewing
			guide; Outlap does not store the address or the country. Cloudflare keeps short-lived request logs, used only to fix errors, for a
			few days.
		</p>
		<p>
			Calendar subscriptions work the same way: your calendar app fetches a feed whose link contains only the series and options you
			chose, nothing that identifies you.
		</p>

		<h2>Links to other sites</h2>
		<p>
			Logos, photos and fonts are served by Outlap itself. Links to broadcasters, series and GitHub take you to sites with their own
			privacy policies.
		</p>

		<h2>Your rights and contact</h2>
		<p>
			Outlap is run as a personal project. Since nothing about you is stored, there is usually nothing to access or delete, but
			you can ask questions or raise a concern through <a href="https://github.com/szpolny/outlap/issues">GitHub</a>. If you are in the EU
			or UK you may also complain to your data protection authority.
		</p>

		<p class="mt-10"><a href="/">Back to the calendar</a></p>
	</main>
</div>
