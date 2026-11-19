import { describe, expect, it } from 'vitest';
import { createStore, InputError, openDatabase } from './db';

const fresh = () => createStore(openDatabase(':memory:'));

describe('store', () => {
	it('ajoute un joueur une seule fois (sans tenir compte de la casse)', () => {
		const s = fresh();
		const a = s.addPlayer('  Lili ');
		expect(s.addPlayer('lili').id).toBe(a.id);
		expect(s.listPlayers()).toHaveLength(1);
	});

	it('refuse une belote sans 2 équipes de 2', () => {
		const s = fresh();
		const ids = ['A', 'B', 'C'].map((n) => s.addPlayer(n).id);
		expect(() => s.createMatch('belote', [[ids[0], ids[1]], [ids[2]]])).toThrow(InputError);
	});

	it('enregistre, corrige et supprime des manches', () => {
		const s = fresh();
		const ids = ['A', 'B', 'C', 'D'].map((n) => s.addPlayer(n).id);
		const m = s.createMatch('belote', [[ids[0], ids[1]], [ids[2], ids[3]]]);
		s.saveRound(m, 1, [{ points: 100 }, { points: 62 }]);
		s.saveRound(m, 2, [{ points: 0 }, { points: 162 }]);
		s.saveRound(m, 3, [{ points: 80 }, { points: 82 }]);
		s.saveRound(m, 1, [{ points: 90 }, { points: 72 }]);
		expect(() => s.saveRound(m, 9, [{ points: 1 }, { points: 1 }])).toThrow(InputError);
		s.deleteRound(m, 2);
		const match = s.getMatch(m)!;
		expect(match.rounds.map((r) => [r.n, r.entries[0].points])).toEqual([
			[1, 90],
			[2, 80]
		]);
		s.deleteMatch(m);
		expect(s.getMatch(m)).toBeUndefined();
	});

	it('6 qui prend : accepte un seuil choisi', () => {
		const s = fresh();
		const ids = ['A', 'B'].map((n) => s.addPlayer(n).id);
		const m = s.createMatch('six-qui-prend', [[ids[0]], [ids[1]]], 100);
		expect(s.getMatch(m)!.endValue).toBe(100);
	});
});
