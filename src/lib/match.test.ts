import { describe, expect, it } from 'vitest';
import { skullKingScore } from './games';
import { matchState, type Match } from './match';

const belote = (rounds: [number, number][]): Match => ({
	id: 1,
	game: 'belote',
	endValue: 12,
	sides: [[1, 2], [3, 4]],
	createdAt: '2026-11-14T20:00:00Z',
	rounds: rounds.map(([a, b], i) => ({ n: i + 1, entries: [{ points: a }, { points: b }] }))
});

describe('matchState', () => {
	it('additionne les manches et désigne le gagnant après 12 manches', () => {
		// 1re partie de la feuille de papa
		const eux = [66, 147, 162, 98, 119, 0, 46, 141, 100, 28, 33, 133];
		const nous = [116, 15, 20, 64, 43, 272, 116, 21, 82, 134, 129, 49];
		const s = matchState(belote(eux.map((e, i) => [e, nous[i]])));
		expect(s.totals).toEqual([1073, 1061]);
		expect(s.done).toBe(true);
		expect(s.winners).toEqual([0]);
		expect(s.nextRound).toBeNull();
	});

	it('reste en cours avant la 12e manche', () => {
		const s = matchState(belote([[100, 62]]));
		expect(s.done).toBe(false);
		expect(s.nextRound).toBe(2);
		expect(s.leaders).toEqual([0]);
		expect(s.winners).toEqual([]);
	});

	it('déclare une égalité', () => {
		const s = matchState(belote(Array.from({ length: 12 }, () => [81, 81] as [number, number])));
		expect(s.tie).toBe(true);
		expect(s.winners).toEqual([0, 1]);
	});

	it('6 qui prend : finit dès 66, le plus bas gagne', () => {
		const m: Match = {
			id: 2,
			game: 'six-qui-prend',
			endValue: 66,
			sides: [[1], [2], [3]],
			createdAt: '',
			rounds: [
				{ n: 1, entries: [{ points: 30 }, { points: 10 }, { points: 5 }] },
				{ n: 2, entries: [{ points: 40 }, { points: 3 }, { points: 9 }] }
			]
		};
		const s = matchState(m);
		expect(s.done).toBe(true);
		expect(s.winners).toEqual([1]);
	});

	it('Skull King : une manche avec annonces seules est en attente', () => {
		const m: Match = {
			id: 3,
			game: 'skull-king',
			endValue: 10,
			sides: [[1], [2]],
			createdAt: '',
			rounds: [{ n: 1, entries: [{ points: null, bid: 1 }, { points: null, bid: 0 }] }]
		};
		const s = matchState(m);
		expect(s.played).toBe(0);
		expect(s.pending?.n).toBe(1);
		expect(s.nextRound).toBe(1);
	});
});

describe('skullKingScore', () => {
	it('suit le barème classique', () => {
		expect(skullKingScore(5, 2, 2)).toBe(40);
		expect(skullKingScore(5, 2, 2, 30)).toBe(70);
		expect(skullKingScore(5, 2, 4, 30)).toBe(-20);
		expect(skullKingScore(5, 0, 0)).toBe(50);
		expect(skullKingScore(5, 0, 1)).toBe(-50);
	});
});
