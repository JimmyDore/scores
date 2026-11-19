/**
 * Base SQLite (better-sqlite3) : `${DATA_DIR}/scores.db`, mode WAL.
 * Migrations dans `MIGRATIONS`, version dans `PRAGMA user_version` : on ajoute à la fin, on ne modifie jamais.
 * Seules les saisies sont stockées ; l'état d'une partie (totaux, gagnant) est recalculé (`$lib/match`).
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getGame } from '$lib/games';
import type { Entry, Match, Player, Round } from '$lib/match';

export type DB = Database.Database;

export const MIGRATIONS: readonly string[] = [
	`
	CREATE TABLE players (
		id         INTEGER PRIMARY KEY,
		name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);
	CREATE TABLE matches (
		id         INTEGER PRIMARY KEY,
		game       TEXT    NOT NULL,
		end_value  INTEGER NOT NULL,
		sides      TEXT    NOT NULL,
		created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);
	CREATE TABLE rounds (
		match_id INTEGER NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
		n        INTEGER NOT NULL,
		entries  TEXT    NOT NULL,
		PRIMARY KEY (match_id, n)
	);
	`
];

export function openDatabase(file: string): DB {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = new Database(file);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	const version = db.pragma('user_version', { simple: true }) as number;
	for (let v = version; v < MIGRATIONS.length; v++) {
		db.transaction(() => {
			db.exec(MIGRATIONS[v]);
			db.pragma(`user_version = ${v + 1}`);
		})();
	}
	return db;
}

export class InputError extends Error {}

export function cleanName(raw: string): string {
	return raw.replace(/\s+/g, ' ').trim().slice(0, 30);
}

function validEntries(entries: Entry[], sideCount: number): Entry[] {
	if (!Array.isArray(entries) || entries.length !== sideCount) throw new InputError('Il manque des scores.');
	const int = (v: unknown, allowNull: boolean) => {
		if (v === null || v === undefined || v === '') {
			if (allowNull) return null;
			throw new InputError('Il manque des scores.');
		}
		const n = Number(v);
		if (!Number.isInteger(n) || Math.abs(n) > 100000) throw new InputError('Score invalide.');
		return n;
	};
	return entries.map((e) => {
		const out: Entry = { points: int(e?.points, true) };
		if (e && 'bid' in e) out.bid = int(e.bid, true);
		if (e && 'tricks' in e) out.tricks = int(e.tricks, true);
		if (e && 'bonus' in e) out.bonus = int(e.bonus, true);
		return out;
	});
}

export function createStore(db: DB) {
	const rowToMatch = (row: { id: number; game: string; end_value: number; sides: string; created_at: string }, rounds: Round[]): Match => ({
		id: row.id,
		game: row.game,
		endValue: row.end_value,
		sides: JSON.parse(row.sides),
		rounds,
		createdAt: row.created_at
	});

	const store = {
		db,

		listPlayers(): Player[] {
			return db.prepare('SELECT id, name FROM players ORDER BY id').all() as Player[];
		},

		/** Ajoute un joueur, ou renvoie celui qui porte déjà ce prénom. */
		addPlayer(raw: string): Player {
			const name = cleanName(raw);
			if (!name) throw new InputError('Il faut un prénom.');
			const existing = db.prepare('SELECT id, name FROM players WHERE name = ?').get(name) as Player | undefined;
			if (existing) return existing;
			const id = Number(db.prepare('INSERT INTO players (name) VALUES (?)').run(name).lastInsertRowid);
			return { id, name };
		},

		createMatch(gameSlug: string, sides: number[][], endValue?: number, createdAt?: string): number {
			const game = getGame(gameSlug);
			if (!game) throw new InputError('Jeu inconnu.');
			const ids = sides.flat();
			if (!sides.length || ids.some((id) => !Number.isInteger(id))) throw new InputError('Joueurs invalides.');
			if (new Set(ids).size !== ids.length) throw new InputError('Un joueur est choisi deux fois.');
			const known = new Set(store.listPlayers().map((p) => p.id));
			if (ids.some((id) => !known.has(id))) throw new InputError('Joueur inconnu.');
			if (game.sides === 'team') {
				if (sides.length !== game.teamCount || sides.some((s) => s.length !== game.teamSize))
					throw new InputError(`Il faut ${game.teamCount} équipes de ${game.teamSize}.`);
			} else {
				if (sides.some((s) => s.length !== 1)) throw new InputError('Un joueur par camp.');
				if (sides.length < game.minPlayers || sides.length > game.maxPlayers)
					throw new InputError(`De ${game.minPlayers} à ${game.maxPlayers} joueurs.`);
			}
			let end = game.endValue;
			if (game.endEditable && endValue !== undefined) {
				if (!Number.isInteger(endValue) || endValue < 1 || endValue > 10000) throw new InputError('Seuil invalide.');
				end = endValue;
			}
			const info = createdAt
				? db.prepare('INSERT INTO matches (game, end_value, sides, created_at) VALUES (?, ?, ?, ?)').run(game.slug, end, JSON.stringify(sides), createdAt)
				: db.prepare('INSERT INTO matches (game, end_value, sides) VALUES (?, ?, ?)').run(game.slug, end, JSON.stringify(sides));
			return Number(info.lastInsertRowid);
		},

		getMatch(id: number): Match | undefined {
			const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as Parameters<typeof rowToMatch>[0] | undefined;
			if (!row) return undefined;
			const rounds = (db.prepare('SELECT n, entries FROM rounds WHERE match_id = ? ORDER BY n').all(id) as { n: number; entries: string }[]).map(
				(r) => ({ n: r.n, entries: JSON.parse(r.entries) as Entry[] })
			);
			return rowToMatch(row, rounds);
		},

		/** Toutes les parties, de la plus ancienne à la plus récente. Les volumes restent petits (une famille). */
		listMatches(): Match[] {
			const rows = db.prepare('SELECT * FROM matches ORDER BY created_at, id').all() as Parameters<typeof rowToMatch>[0][];
			const byMatch = new Map<number, Round[]>();
			for (const r of db.prepare('SELECT match_id, n, entries FROM rounds ORDER BY match_id, n').all() as {
				match_id: number;
				n: number;
				entries: string;
			}[]) {
				const list = byMatch.get(r.match_id) ?? [];
				list.push({ n: r.n, entries: JSON.parse(r.entries) });
				byMatch.set(r.match_id, list);
			}
			return rows.map((row) => rowToMatch(row, byMatch.get(row.id) ?? []));
		},

		/** Enregistre la manche n (nouvelle ou corrigée). n vaut au plus « nombre de manches + 1 ». */
		saveRound(matchId: number, n: number, entries: Entry[]): void {
			const match = store.getMatch(matchId);
			if (!match) throw new InputError('Partie introuvable.');
			if (!Number.isInteger(n) || n < 1 || n > match.rounds.length + 1) throw new InputError('Manche invalide.');
			const clean = validEntries(entries, match.sides.length);
			db.prepare('INSERT INTO rounds (match_id, n, entries) VALUES (?, ?, ?) ON CONFLICT (match_id, n) DO UPDATE SET entries = excluded.entries').run(
				matchId,
				n,
				JSON.stringify(clean)
			);
		},

		/** Supprime la manche n et renumérote les suivantes. */
		deleteRound(matchId: number, n: number): void {
			db.transaction(() => {
				const info = db.prepare('DELETE FROM rounds WHERE match_id = ? AND n = ?').run(matchId, n);
				if (info.changes === 0) throw new InputError('Manche introuvable.');
				const later = db.prepare('SELECT n FROM rounds WHERE match_id = ? AND n > ? ORDER BY n').all(matchId, n) as { n: number }[];
				const move = db.prepare('UPDATE rounds SET n = ? WHERE match_id = ? AND n = ?');
				for (const r of later) move.run(r.n - 1, matchId, r.n);
			})();
		},

		deleteMatch(id: number): void {
			db.prepare('DELETE FROM matches WHERE id = ?').run(id);
		}
	};
	return store;
}

export type Store = ReturnType<typeof createStore>;

let singleton: Store | undefined;

export function getStore(): Store {
	if (!singleton) {
		const dir = process.env.DATA_DIR?.trim() || './data';
		singleton = createStore(openDatabase(path.resolve(dir, 'scores.db')));
	}
	return singleton;
}
