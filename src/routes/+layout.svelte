<script lang="ts">
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16 32x32 48x48 96x96" />
	<link rel="icon" href="/favicon.png" type="image/png" sizes="96x96" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
</svelte:head>

{@render children()}
