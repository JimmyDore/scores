#!/usr/bin/env node
/**
 * Import de joueurs et de parties déjà jouées (ex. la feuille de belote de papa).
 * Les données arrivent sur l'entrée standard : elles ne sont pas dans le dépôt (public).
 *
 *   docker exec -i scores-web node scripts/seed.mjs < feuille.json
 *
 * Format :
 *   { "players": ["Alain", ...],
 *     "matches": [{ "game": "belote", "date": "2026-11-14T20:00:00Z",
 *                   "sides": [["Alain","Philippe"],["Lili","Marie-France"]],
 *                   "rounds": [[66,116],[147,15], ...] }] }
 *
 * La base doit exister (l'app la crée au démarrage). Une partie du même jeu à la même date
 * n'est pas réimportée : on peut relancer le script sans doublon.
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));

const file = path.resolve(process.env.DATA_DIR?.trim() || './data', 'scores.db');
const db = new Database(file, { fileMustExist: true });
db.pragma('foreign_keys = ON');

const idOf = (name) => {
	const row = db.prepare('SELECT id FROM players WHERE name = ?').get(name);
	if (row) return row.id;
	return Number(db.prepare('INSERT INTO players (name) VALUES (?)').run(name).lastInsertRowid);
};

const ENDS = { belote: 12, 'cinq-rois': 11, 'skull-king': 10, 'six-qui-prend': 66 };

let players = 0;
let matches = 0;
db.transaction(() => {
	for (const name of input.players ?? []) {
		idOf(name);
		players++;
	}
	for (const m of input.matches ?? []) {
		if (!(m.game in ENDS)) throw new Error(`Jeu inconnu : ${m.game}`);
		const exists = db.prepare('SELECT id FROM matches WHERE game = ? AND created_at = ?').get(m.game, m.date);
		if (exists) continue;
		const sides = m.sides.map((s) => s.map(idOf));
		const id = Number(
			db.prepare('INSERT INTO matches (game, end_value, sides, created_at) VALUES (?, ?, ?, ?)').run(m.game, m.endValue ?? ENDS[m.game], JSON.stringify(sides), m.date)
				.lastInsertRowid
		);
		const ins = db.prepare('INSERT INTO rounds (match_id, n, entries) VALUES (?, ?, ?)');
		m.rounds.forEach((r, i) => {
			if (r.length !== sides.length) throw new Error(`Manche ${i + 1} : ${r.length} scores pour ${sides.length} camps`);
			ins.run(id, i + 1, JSON.stringify(r.map((points) => ({ points }))));
		});
		matches++;
	}
})();
db.close();
console.log(`[seed] ${players} joueurs vérifiés, ${matches} parties importées`);
