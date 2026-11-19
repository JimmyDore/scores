<script lang="ts">
	let { action, next = '', wrong = false }: { action: string; next?: string; wrong?: boolean } = $props();
</script>

<form method="POST" {action} class="card codeform">
	<label for="code">Pour noter les scores, tapez le code famille :</label>
	<input
		id="code"
		name="code"
		class="field"
		autocomplete="off"
		autocapitalize="none"
		autocorrect="off"
		spellcheck="false"
		enterkeyhint="go"
		required
	/>
	{#if next}<input type="hidden" name="next" value={next} />{/if}
	{#if wrong}<p class="error">Ce n’est pas le bon code.</p>{/if}
	<button class="btn btn-gold" type="submit">Valider</button>
</form>

<style>
	.codeform label {
		display: block;
		font-weight: 700;
		margin-bottom: 10px;
	}
	.codeform .btn {
		margin: 12px 0 0;
	}
</style>
