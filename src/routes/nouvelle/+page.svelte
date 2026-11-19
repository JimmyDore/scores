<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { untrack } from 'svelte';

	let { data, form } = $props();

	const slug = $derived(page.url.searchParams.get('jeu'));
	const game = $derived(data.games.find((g) => g.slug === slug));

	// Belote : teams[0] et teams[1] ; autres jeux : un seul tableau, dans l'ordre de la table.
	let teams = $state<number[][]>([[], []]);
	let solo = $state<number[]>([]);
	let endValue = $state<number | null>(null);
	let adding = $state(false);
	let newName = $state('');

	$effect(() => {
		// Nouveau jeu choisi : on repart de zéro.
		const chosen = slug;
		untrack(() => {
			teams = [[], []];
			solo = [];
			endValue = data.games.find((g) => g.slug === chosen)?.endValue ?? null;
		});
	});

	const isTeam = $derived(game?.sides === 'team');
	const teamSize = $derived(game?.teamSize ?? 2);

	function teamOf(id: number) {
		return teams.findIndex((t) => t.includes(id));
	}

	function toggle(id: number) {
		if (!game) return;
		if (isTeam) {
			const t = teamOf(id);
			if (t >= 0) teams[t] = teams[t].filter((x) => x !== id);
			else {
				const free = teams.findIndex((tm) => tm.length < teamSize);
				if (free >= 0) teams[free] = [...teams[free], id];
			}
		} else if (solo.includes(id)) solo = solo.filter((x) => x !== id);
		else if (solo.length < game.maxPlayers) solo = [...solo, id];
	}

	const sides = $derived(isTeam ? teams : solo.map((id) => [id]));
	const ready = $derived(
		!!game && (isTeam ? teams.every((t) => t.length === teamSize) : solo.length >= game.minPlayers && solo.length <= game.maxPlayers)
	);
	const hint = $derived.by(() => {
		if (!game) return '';
		if (isTeam) {
			const t = teams.findIndex((tm) => tm.length < teamSize);
			return t >= 0 ? `Touchez les joueurs de l’équipe ${t + 1}` : 'Les équipes sont prêtes !';
		}
		return solo.length < game.minPlayers ? `Touchez les joueurs (au moins ${game.minPlayers})` : `${solo.length} joueurs`;
	});
	const nameOf = (id: number) => data.players.find((p) => p.id === id)?.name ?? '?';
</script>

<div class="page">
	{#if !game}
		<a class="back" href="/">← Accueil</a>
		<h1 class="title">On joue à quoi ?</h1>
		<div class="games">
			{#each data.games as g (g.slug)}
				<a class="gametile" href="?jeu={g.slug}">
					<span class="emoji">{g.emoji}</span>
					<span class="name">{g.name}</span>
					<small>{g.blurb}</small>
				</a>
			{/each}
		</div>
	{:else}
		<a class="back" href="/nouvelle">← Changer de jeu</a>
		<h1 class="title">{game.emoji} {game.name}</h1>
		<p class="subtitle hint">{hint}</p>

		{#if isTeam}
			<div class="teams">
				{#each teams as t, i}
					<div class="team" class:full={t.length === teamSize}>
						<div class="kicker green">Équipe {i + 1}</div>
						<div class="members">{t.length ? t.map(nameOf).join(' & ') : '…'}</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="players">
			{#each data.players as p (p.id)}
				{@const t = isTeam ? teamOf(p.id) : -1}
				{@const pos = solo.indexOf(p.id)}
				<button
					type="button"
					class="player"
					class:t1={t === 0}
					class:t2={t === 1}
					class:on={pos >= 0}
					aria-pressed={t >= 0 || pos >= 0}
					onclick={() => toggle(p.id)}
				>
					{p.name}
					{#if t >= 0}<small>éq. {t + 1}</small>{/if}
					{#if pos >= 0}<small>{pos + 1}</small>{/if}
				</button>
			{/each}
			<button type="button" class="player add" onclick={() => (adding = !adding)}>＋ Ajouter quelqu’un</button>
		</div>

		{#if adding}
			<form
				method="POST"
				action="?/addPlayer"
				class="card addform"
				use:enhance={() =>
					async ({ result, update }) => {
						await update({ reset: true });
						if (result.type === 'success' && typeof result.data?.added === 'number') {
							toggle(result.data.added);
							adding = false;
							newName = '';
						}
					}}
			>
				<label for="name">Prénom</label>
				<input id="name" name="name" class="field" bind:value={newName} maxlength="30" autocomplete="off" required />
				<button class="btn btn-gold" type="submit">Ajouter</button>
			</form>
		{/if}

		{#if game.endEditable}
			<label class="card endfield">
				<span>La partie s’arrête à</span>
				<input class="field" type="number" inputmode="numeric" min="1" bind:value={endValue} />
			</label>
		{/if}

		{#if form?.error}<p class="error">{form.error}</p>{/if}

		<form method="POST" action="?/create" use:enhance>
			<input type="hidden" name="game" value={game.slug} />
			<input type="hidden" name="sides" value={JSON.stringify(sides)} />
			{#if game.endEditable}<input type="hidden" name="endValue" value={endValue ?? ''} />{/if}
			<button class="btn btn-gold go" type="submit" disabled={!ready}>C’est parti ▶</button>
		</form>
	{/if}
</div>

<style>
	.games {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: 16px;
	}
	.gametile {
		background: var(--cream);
		color: var(--felt);
		border-radius: 16px;
		box-shadow: 0 5px 0 var(--cream-edge);
		padding: 16px 12px;
		min-height: 150px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-decoration: none;
	}
	.gametile .emoji {
		font-size: 38px;
	}
	.gametile .name {
		font-family: var(--title);
		font-size: 24px;
		font-weight: 800;
	}
	.gametile small {
		color: var(--text);
		font-size: 15px;
	}
	.hint {
		font-weight: 700;
		opacity: 1;
		color: var(--gold);
	}
	.teams {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 14px;
	}
	.team {
		background: rgba(0, 0, 0, 0.25);
		border: 2px dashed rgba(253, 246, 227, 0.4);
		border-radius: 14px;
		padding: 10px;
		min-height: 80px;
	}
	.team .kicker {
		color: var(--gold);
	}
	.team.full {
		border-style: solid;
		border-color: var(--gold);
	}
	.members {
		font-weight: 700;
	}
	.players {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 16px;
	}
	.player {
		min-height: 60px;
		border-radius: 14px;
		background: var(--cream);
		color: var(--felt);
		font-size: 20px;
		font-weight: 700;
		box-shadow: 0 4px 0 var(--cream-edge);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 6px;
	}
	.player small {
		font-size: 13px;
		background: var(--felt);
		color: var(--cream);
		border-radius: 999px;
		padding: 2px 8px;
	}
	.player.on,
	.player.t1 {
		background: var(--gold);
		color: var(--gold-ink);
		box-shadow: 0 4px 0 var(--gold-edge);
	}
	.player.t2 {
		background: #9fd3ff;
		color: #08324f;
		box-shadow: 0 4px 0 #4a8fc4;
	}
	.player.add {
		background: transparent;
		color: var(--cream);
		border: 2px dashed rgba(253, 246, 227, 0.6);
		box-shadow: none;
		font-size: 17px;
	}
	.addform label,
	.endfield span {
		display: block;
		font-weight: 700;
		margin-bottom: 8px;
	}
	.addform .btn {
		margin: 12px 0 0;
	}
	.endfield {
		display: block;
	}
	.go {
		position: sticky;
		bottom: 12px;
	}
</style>
