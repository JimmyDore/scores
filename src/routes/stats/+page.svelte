<script lang="ts">
	import { page } from '$app/state';
	import { numericDate } from '$lib/format';
	import MatchLine from '$lib/components/MatchLine.svelte';

	let { data } = $props();

	const tab = $derived(page.url.searchParams.get('jeu') ?? 'tous');
	const current = $derived(data.games.find((g) => g.slug === tab));
	const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
</script>

<svelte:head>
	<title>Les stats · Les scores de la famille</title>
</svelte:head>

<div class="page">
	<a class="back" href="/">← Accueil</a>
	<h1 class="title">🏆 Les stats</h1>

	<nav class="tabs" aria-label="Jeux">
		<a href="?jeu=tous" class:on={tab === 'tous'} data-sveltekit-noscroll data-sveltekit-replacestate>Tous jeux</a>
		{#each data.games as g (g.slug)}
			<a href="?jeu={g.slug}" class:on={tab === g.slug} data-sveltekit-noscroll data-sveltekit-replacestate>{g.emoji} {g.name}</a>
		{/each}
	</nav>

	{#if !current}
		<div class="card">
			<div class="kicker green">Victoires, tous jeux confondus</div>
			{#if data.overall.players.length === 0}
				<p>Aucune partie terminée pour l’instant.</p>
			{:else}
				<table class="rank">
					<thead><tr><th></th><th>Joueur</th><th>Victoires</th><th>Parties</th></tr></thead>
					<tbody>
						{#each data.overall.players as p, i (p.id)}
							<tr><td>{medal(i)}</td><td class="name">{p.name}</td><td class="num">{p.wins}</td><td class="num">{p.played}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
		<div class="facts">
			<div class="fact card"><span class="big">{data.overall.played}</span>parties terminées</div>
			{#if data.overall.mostActive}
				<div class="fact card"><span class="big">{data.overall.mostActive.name}</span>le plus actif ({data.overall.mostActive.played} parties)</div>
			{/if}
		</div>
	{:else if current.played === 0}
		<div class="card"><p>Pas encore de partie de {current.name} terminée.</p></div>
	{:else}
		<div class="card">
			<div class="kicker green">Classement · {current.played} partie{current.played > 1 ? 's' : ''}</div>
			<table class="rank">
				<thead><tr><th></th><th>Joueur</th><th>Vict.</th><th>%</th><th title="Série en cours / record">Série</th></tr></thead>
				<tbody>
					{#each current.players as p, i (p.id)}
						<tr>
							<td>{medal(i)}</td>
							<td class="name">{p.name}</td>
							<td class="num">{p.wins}/{p.played}</td>
							<td class="num">{p.pct}%</td>
							<td class="num">{p.currentStreak ? `🔥${p.currentStreak}` : '–'} <small>(max {p.bestStreak})</small></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if current.team && current.duos.length}
			<div class="card">
				<div class="kicker green">Les duos</div>
				<table class="rank">
					<thead><tr><th></th><th>Équipe</th><th>Vict.</th><th>%</th></tr></thead>
					<tbody>
						{#each current.duos as d, i (d.name)}
							<tr><td>{medal(i)}</td><td class="name">{d.name}</td><td class="num">{d.wins}/{d.played}</td><td class="num">{d.pct}%</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="card">
			<div class="kicker green">Records</div>
			{#each current.records as r (r.label)}
				<a class="record" href="/partie/{r.matchId}">
					<span>{r.label}<br /><small>{r.who} · {numericDate(r.date)}</small></span>
					<span class="ink">{r.value}</span>
				</a>
			{/each}
		</div>
	{/if}

	<h2 class="hist" id="historique">Historique</h2>
	<div class="card">
		{#if data.history.length === 0}
			<p>Aucune partie terminée pour l’instant.</p>
		{/if}
		{#each data.history.filter((h) => !current || h.game === current.slug) as m (m.id)}
			<MatchLine match={m} />
		{/each}
	</div>
</div>

<style>
	.tabs {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin: 14px -16px 14px;
		padding: 0 16px 6px;
		scrollbar-width: none;
	}
	.tabs a {
		flex: none;
		min-height: 48px;
		display: flex;
		align-items: center;
		padding: 0 16px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.25);
		color: var(--cream);
		text-decoration: none;
		font-weight: 700;
		font-size: 17px;
		border: 2px solid rgba(253, 246, 227, 0.35);
	}
	.tabs a.on {
		background: var(--gold);
		color: var(--gold-ink);
		border-color: var(--gold);
	}
	.rank {
		width: 100%;
		border-collapse: collapse;
		font-size: 17px;
	}
	.rank th {
		text-align: left;
		font-size: 13px;
		color: #666;
		font-weight: 400;
		padding-bottom: 4px;
	}
	.rank td {
		padding: 9px 2px;
		border-top: 1px solid var(--cream-line);
	}
	.rank .name {
		font-weight: 700;
	}
	.rank .num {
		white-space: nowrap;
	}
	.rank small {
		font-size: 12px;
		color: #777;
	}
	.facts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.fact {
		font-size: 15px;
	}
	.fact .big {
		display: block;
		font-family: var(--title);
		font-weight: 800;
		font-size: 26px;
		color: var(--felt);
		overflow-wrap: anywhere;
	}
	.record {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-top: 1px solid var(--cream-line);
		text-decoration: none;
		color: var(--text);
		font-weight: 700;
	}
	.record small {
		font-weight: 400;
		font-size: 15px;
	}
	.record .ink {
		font-size: 34px;
	}
	.hist {
		font-family: var(--title);
		font-size: 24px;
		margin: 24px 0 10px;
	}
</style>
