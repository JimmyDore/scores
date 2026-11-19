<script lang="ts">
	import CodeForm from '$lib/components/CodeForm.svelte';

	let { data, form } = $props();
</script>

<div class="page">
	<a class="back" href="/">← Accueil</a>
	<h1 class="title">Code famille</h1>
	<p class="subtitle">On ne le demande qu’une fois sur ce téléphone.</p>
	<CodeForm action="" next={data.next} wrong={form?.wrong} />
</div>
