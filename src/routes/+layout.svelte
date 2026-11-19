<script lang="ts">
	import '@fontsource/atkinson-hyperlegible/400.css';
	import '@fontsource/atkinson-hyperlegible/700.css';
	import '@fontsource/caveat/600.css';
	import '@fontsource/fraunces/800.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Les scores de la famille</title>
</svelte:head>

{@render children()}
