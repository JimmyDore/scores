<script lang="ts">
	import type { Snippet } from 'svelte';

	let { onkey, ok }: { onkey: (k: string) => void; ok: Snippet } = $props();
</script>

<div class="pad">
	{#each ['1', '2', '3'] as k}<button type="button" onclick={() => onkey(k)}>{k}</button>{/each}
	<button type="button" aria-label="Effacer" onclick={() => onkey('del')}>⌫</button>
	{#each ['4', '5', '6'] as k}<button type="button" onclick={() => onkey(k)}>{k}</button>{/each}
	<div class="ok">{@render ok()}</div>
	{#each ['7', '8', '9'] as k}<button type="button" onclick={() => onkey(k)}>{k}</button>{/each}
	<button type="button" class="zero" onclick={() => onkey('0')}>0</button>
</div>

<style>
	.pad {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-auto-rows: 52px;
		gap: 6px;
	}
	.pad button {
		border-radius: 10px;
		background: #fff;
		border: 2px solid var(--cream-edge);
		color: var(--felt);
		font-size: 26px;
		font-weight: 700;
	}
	.pad button:active {
		background: var(--gold-soft);
	}
	.ok :global(button[disabled]) {
		opacity: 0.45;
	}
	.zero {
		grid-column: 1 / 4;
	}
	.ok {
		grid-row: span 3;
		display: flex;
	}
	.ok :global(button) {
		flex: 1;
		border-radius: 10px;
		border: 2px solid;
		background: var(--gold);
		border-color: var(--gold-edge);
		color: var(--gold-ink);
		font-size: 19px;
		line-height: 1.2;
		padding: 4px;
	}
</style>
