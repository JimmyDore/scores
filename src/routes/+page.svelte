<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { shortDate } from '$lib/format';
	import MatchLine from '$lib/components/MatchLine.svelte';

	let { data } = $props();

	// Une partie lancée sur un autre téléphone apparaît toute seule.
	$effect(() => {
		const t = setInterval(() => {
			if (document.visibilityState === 'visible') invalidateAll();
		}, 15000);
		return () => clearInterval(t);
	});
</script>

<div class="page">
	<h1 class="title">♠ Les scores ♥</h1>
	<p class="subtitle">de la famille</p>

	{#each data.live as m (m.id)}
		<a class="card card-link live" href="/partie/{m.id}">
			<div class="kicker">
				● En cours · {m.gameName}{#if m.nextRound}&nbsp;· manche {m.nextRound}{#if m.game !== 'six-qui-prend'}/{m.endValue}{/if}{/if}
			</div>
			{#each m.sideNames as name, i}
				<div class="row" class:lead={m.leaders.includes(i)}>
					<span>{name}</span><span class="ink">{m.totals[i]}</span>
				</div>
			{/each}
		</a>
	{/each}

	{#if data.live.length === 1}
		<a class="btn btn-gold" href="/partie/{data.live[0].id}">▶ Reprendre la partie</a>
		<a class="btn btn-cream" href="/nouvelle">＋ Nouvelle partie</a>
	{:else}
		<a class="btn btn-gold" href="/nouvelle">＋ Nouvelle partie</a>
	{/if}
	<a class="btn btn-cream" href="/stats">🏆 Les stats</a>

	{#if data.recent.length}
		<div class="card">
			<div class="kicker green">Dernières parties</div>
			{#each data.recent as m (m.id)}
				<MatchLine match={m} />
			{/each}
			<a class="more" href="/stats#historique">Tout l’historique →</a>
		</div>
	{/if}
	<p class="today">{shortDate(new Date().toISOString())}</p>
</div>

<style>
	.live .row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
		font-weight: 700;
		font-size: 18px;
	}
	.live .row .ink {
		font-size: 34px;
		line-height: 1.1;
	}
	.live .row.lead span:first-child::after {
		content: ' 👑';
		font-size: 15px;
	}
	.more {
		display: block;
		text-align: right;
		margin-top: 8px;
		color: var(--felt);
		font-weight: 700;
		padding: 8px 0;
	}
	.today {
		text-align: center;
		opacity: 0.6;
		font-size: 15px;
	}
</style>
