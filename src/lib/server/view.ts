/** Données d'affichage d'une partie, sérialisables pour les pages. */
import { matchState, resultLine, sideName, type Match, type Player } from '$lib/match';

export function playerMap(players: Player[]): Map<number, Player> {
	return new Map(players.map((p) => [p.id, p]));
}

export function matchView(match: Match, players: Map<number, Player>) {
	const state = matchState(match);
	return {
		id: match.id,
		game: match.game,
		gameName: state.game.name,
		emoji: state.game.emoji,
		endValue: match.endValue,
		createdAt: match.createdAt,
		sides: match.sides,
		sideNames: match.sides.map((s) => sideName(s, players)),
		rounds: match.rounds,
		totals: state.totals,
		played: state.played,
		done: state.done,
		winners: state.winners,
		tie: state.tie,
		leaders: state.leaders,
		nextRound: state.nextRound,
		pendingRound: state.pending?.n ?? null,
		result: resultLine(match, state, players)
	};
}

export type MatchView = ReturnType<typeof matchView>;
