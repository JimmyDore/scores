/**
 * État d'une partie, calculé à partir de ses manches (rien de dérivé n'est stocké en base).
 */
import { getGame, type GameDef } from './games';

export interface Player {
	id: number;
	name: string;
}

/** Une valeur de manche pour un camp. `points` est null tant que la manche n'est pas jouée (Skull King : annonces seules). */
export interface Entry {
	points: number | null;
	bid?: number | null;
	tricks?: number | null;
	bonus?: number | null;
}

export interface Round {
	n: number;
	entries: Entry[];
}

export interface Match {
	id: number;
	game: string;
	/** Seuil de fin pour les jeux `target`, nombre de manches sinon. */
	endValue: number;
	/** Un tableau d'ids de joueurs par camp. */
	sides: number[][];
	rounds: Round[];
	createdAt: string;
}

export interface MatchState {
	game: GameDef;
	totals: number[];
	/** Manches complètes (tous les camps ont des points). */
	played: number;
	/** Manche en cours d'annonce (Skull King), sinon null. */
	pending: Round | null;
	done: boolean;
	/** Indices des camps gagnants (plusieurs = égalité). Vide tant que la partie n'est pas finie. */
	winners: number[];
	tie: boolean;
	/** Camp(s) en tête, même en cours de partie. */
	leaders: number[];
	/** Numéro de la prochaine manche à saisir, null si la partie est finie. */
	nextRound: number | null;
}

export function isComplete(r: Round): boolean {
	return r.entries.length > 0 && r.entries.every((e) => e.points !== null && e.points !== undefined);
}

function best(totals: number[], win: 'high' | 'low'): number[] {
	if (totals.length === 0) return [];
	const target = win === 'high' ? Math.max(...totals) : Math.min(...totals);
	return totals.flatMap((t, i) => (t === target ? [i] : []));
}

export function matchState(match: Match): MatchState {
	const game = getGame(match.game);
	if (!game) throw new Error(`Jeu inconnu : ${match.game}`);
	const complete = match.rounds.filter(isComplete);
	const totals = match.sides.map((_, i) => complete.reduce((s, r) => s + (r.entries[i]?.points ?? 0), 0));
	const pending = match.rounds.find((r) => !isComplete(r)) ?? null;
	const done =
		game.end === 'rounds'
			? complete.length >= match.endValue
			: complete.length > 0 && totals.some((t) => t >= match.endValue);
	const leaders = complete.length ? best(totals, game.win) : [];
	const winners = done ? leaders : [];
	return {
		game,
		totals,
		played: complete.length,
		pending: done ? null : pending,
		done,
		winners,
		tie: winners.length > 1,
		leaders,
		nextRound: done ? null : complete.length + 1
	};
}

export function sideName(side: number[], players: Map<number, Player>): string {
	return side.map((id) => players.get(id)?.name ?? '?').join(' & ');
}

/** « Alain & Philippe gagnent », « Thomas gagne », « Égalité ». */
export function resultLine(match: Match, state: MatchState, players: Map<number, Player>): string {
	if (!state.done) return '';
	if (state.tie) return 'Égalité';
	const side = match.sides[state.winners[0]];
	return `${sideName(side, players)} ${side.length > 1 ? 'gagnent' : 'gagne'}`;
}
