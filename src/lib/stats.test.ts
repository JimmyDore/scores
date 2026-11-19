import { describe, expect, it } from 'vitest';
import { getGame } from './games';
import type { Match, Player } from './match';
import { gameStats, overallStats } from './stats';

const players = new Map<number, Player>([
	[1, { id: 1, name: 'Ana' }],
	[2, { id: 2, name: 'Bob' }],
	[3, { id: 3, name: 'Cid' }],
	[4, { id: 4, name: 'Dan' }]
]);

let id = 0;
function belote(a: number, b: number, sides = [[1, 2], [3, 4]]): Match {
	id++;
	return {
		id,
		game: 'belote',
		endValue: 12,
		sides,
		createdAt: `2026-11-${String(10 + id).padStart(2, '0')}T20:00:00Z`,
		rounds: Array.from({ length: 12 }, (_, i) => ({
			n: i + 1,
			entries: [{ points: i === 0 ? a : 0 }, { points: i === 0 ? b : 0 }]
		}))
	};
}

describe('gameStats belote', () => {
	const matches = [belote(100, 62), belote(90, 72), belote(10, 152), belote(272, 0, [[1, 3], [2, 4]])];
	const s = gameStats(getGame('belote')!, matches, players);

	it('compte victoires, % et séries', () => {
		const ana = s.players.find((p) => p.name === 'Ana')!;
		expect(ana).toMatchObject({ played: 4, wins: 3, pct: 75, bestStreak: 2, currentStreak: 1 });
		expect(s.players[0].name).toBe('Ana');
		expect(s.played).toBe(4);
	});

	it('trouve les records', () => {
		expect(s.records.find((r) => r.label === 'Meilleure manche')).toMatchObject({ value: 272, who: 'Ana & Cid' });
	});

	it('classe les duos', () => {
		expect(s.duos.find((d) => d.name === 'Ana & Bob')).toMatchObject({ played: 3, wins: 2 });
	});

	it('ignore les parties en cours', () => {
		const live = { ...belote(5, 5), rounds: [] };
		expect(gameStats(getGame('belote')!, [...matches, live], players).played).toBe(4);
	});
});

describe('overallStats', () => {
	it('additionne les victoires de tous les jeux', () => {
		const o = overallStats([belote(100, 62), belote(100, 62)], players);
		expect(o.players[0]).toMatchObject({ wins: 2, played: 2 });
		expect(o.mostActive?.played).toBe(2);
	});
});
