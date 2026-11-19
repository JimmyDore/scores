<script lang="ts">
	import { shortDate } from '$lib/format';
	import { getGame } from '$lib/games';
	import type { MatchView } from '$lib/server/view';

	let { match }: { match: MatchView } = $props();

	// Scores dans l'ordre du classement (le gagnant d'abord).
	const order = $derived(
		match.totals
			.map((t, i) => i)
			.sort((a, b) => (getGame(match.game)?.win === 'low' ? match.totals[a] - match.totals[b] : match.totals[b] - match.totals[a]))
	);
	const winner = $derived(match.tie ? 'Égalité' : match.sideNames[match.winners[0]]);
</script>

<a class="line" href="/partie/{match.id}">
	<span class="what">
		{match.emoji} {match.gameName} · {shortDate(match.createdAt)}<br />
		<small>🏆 {winner}</small>
	</span>
	<span class="ink">{order.map((i) => match.totals[i]).join(' – ')}</span>
</a>

<style>
	.line {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid var(--cream-line);
		text-decoration: none;
		color: var(--text);
		min-height: 56px;
	}
	.line:last-of-type {
		border-bottom: 0;
	}
	.what {
		font-size: 17px;
	}
	small {
		font-size: 15px;
		opacity: 0.85;
	}
	.ink {
		font-size: 26px;
		white-space: nowrap;
		text-align: right;
	}
</style>
