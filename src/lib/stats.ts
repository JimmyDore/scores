/**
 * Stats calculées à partir des parties terminées. Une égalité ne compte comme victoire pour personne.
 */
import { GAMES, type GameDef } from './games';
import { isComplete, matchState, sideName, type Match, type MatchState, type Player } from './match';

export interface PlayerLine {
	id: number;
	name: string;
	played: number;
	wins: number;
	pct: number;
	bestStreak: number;
	currentStreak: number;
}

export interface RecordLine {
	label: string;
	value: number;
	who: string;
	matchId: number;
	date: string;
}

export interface DuoLine {
	name: string;
	played: number;
	wins: number;
	pct: number;
}

export interface GameStats {
	game: GameDef;
	played: number;
	players: PlayerLine[];
	records: RecordLine[];
	duos: DuoLine[];
}

export interface OverallStats {
	played: number;
	players: { id: number; name: string; played: number; wins: number }[];
	mostActive: { name: string; played: number } | null;
}

interface Finished {
	match: Match;
	state: MatchState;
}

const pct = (wins: number, played: number) => (played ? Math.round((wins / played) * 100) : 0);

function byRank<T extends { wins: number; pct: number; played: number; name: string }>(a: T, b: T) {
	return b.wins - a.wins || b.pct - a.pct || b.played - a.played || a.name.localeCompare(b.name, 'fr');
}

export function finishedMatches(matches: Match[]): Finished[] {
	return matches
		.map((match) => ({ match, state: matchState(match) }))
		.filter((f) => f.state.done)
		.sort((a, b) => a.match.createdAt.localeCompare(b.match.createdAt) || a.match.id - b.match.id);
}

function wonBy(f: Finished, playerId: number): boolean {
	return !f.state.tie && f.state.winners.some((i) => f.match.sides[i].includes(playerId));
}

export function gameStats(game: GameDef, matches: Match[], players: Map<number, Player>): GameStats {
	const done = finishedMatches(matches).filter((f) => f.match.game === game.slug);

	const lines = new Map<number, PlayerLine>();
	for (const f of done) {
		for (const id of f.match.sides.flat()) {
			const line = lines.get(id) ?? { id, name: players.get(id)?.name ?? '?', played: 0, wins: 0, pct: 0, bestStreak: 0, currentStreak: 0 };
			line.played++;
			if (wonBy(f, id)) {
				line.wins++;
				line.currentStreak++;
				line.bestStreak = Math.max(line.bestStreak, line.currentStreak);
			} else {
				line.currentStreak = 0;
			}
			lines.set(id, line);
		}
	}
	for (const l of lines.values()) l.pct = pct(l.wins, l.played);

	const records: RecordLine[] = [];
	const consider = (label: string, value: number, who: string, f: Finished, better: (a: number, b: number) => boolean) => {
		const cur = records.find((r) => r.label === label);
		if (!cur) records.push({ label, value, who, matchId: f.match.id, date: f.match.createdAt });
		else if (better(value, cur.value)) Object.assign(cur, { value, who, matchId: f.match.id, date: f.match.createdAt });
	};
	const higher = (a: number, b: number) => a > b;
	const lower = (a: number, b: number) => a < b;
	for (const f of done) {
		f.match.sides.forEach((side, i) => {
			const who = sideName(side, players);
			const total = f.state.totals[i];
			if (game.win === 'high') consider('Meilleur total', total, who, f, higher);
			else {
				consider('Meilleur total', total, who, f, lower);
				consider('Pire total', total, who, f, higher);
			}
			for (const r of f.match.rounds.filter(isComplete)) {
				const pts = r.entries[i].points ?? 0;
				consider(game.win === 'high' ? 'Meilleure manche' : 'Pire manche', pts, who, f, higher);
			}
		});
	}

	const duoMap = new Map<string, DuoLine>();
	if (game.sides === 'team') {
		for (const f of done) {
			f.match.sides.forEach((side, i) => {
				const key = [...side].sort((a, b) => a - b).join('-');
				const names = [...side].map((id) => players.get(id)?.name ?? '?').sort((a, b) => a.localeCompare(b, 'fr'));
				const d = duoMap.get(key) ?? { name: names.join(' & '), played: 0, wins: 0, pct: 0 };
				d.played++;
				if (!f.state.tie && f.state.winners.includes(i)) d.wins++;
				duoMap.set(key, d);
			});
		}
		for (const d of duoMap.values()) d.pct = pct(d.wins, d.played);
	}

	return {
		game,
		played: done.length,
		players: [...lines.values()].sort(byRank),
		records,
		duos: [...duoMap.values()].sort(byRank)
	};
}

export function overallStats(matches: Match[], players: Map<number, Player>): OverallStats {
	const done = finishedMatches(matches);
	const lines = new Map<number, { id: number; name: string; played: number; wins: number }>();
	for (const f of done) {
		for (const id of f.match.sides.flat()) {
			const l = lines.get(id) ?? { id, name: players.get(id)?.name ?? '?', played: 0, wins: 0 };
			l.played++;
			if (wonBy(f, id)) l.wins++;
			lines.set(id, l);
		}
	}
	const list = [...lines.values()].sort((a, b) => b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name, 'fr'));
	const active = [...list].sort((a, b) => b.played - a.played)[0];
	return { played: done.length, players: list, mostActive: active ? { name: active.name, played: active.played } : null };
}

export function allGameStats(matches: Match[], players: Map<number, Player>): GameStats[] {
	return GAMES.map((g) => gameStats(g, matches, players));
}
