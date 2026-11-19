#!/usr/bin/env node
/**
 * Template: scripts/backup.mjs (from bar-rating scripts/backup.mjs), SQLite with better-sqlite3.
 * Placeholders:
 *   scores      project name (usage text)
 *   scores.db   database file name inside DATA_DIR (e.g. scores.db)
 * App on node:sqlite instead of better-sqlite3: `import { DatabaseSync, backup } from 'node:sqlite'`,
 * then `await backup(new DatabaseSync(source), tmp)` (Node >= 22.16), same checks after.
 *
 * Snapshot cohérent de la base, même pendant que le site tourne (API de backup SQLite).
 *
 *   node scripts/backup.mjs <destination>
 *   docker exec scores-web node scripts/backup.mjs /data/snapshot.db
 *
 * Source : ${DATA_DIR:-./data}/scores.db. Le fichier produit est autonome (journal DELETE,
 * pas de -wal à côté), vérifié (integrity_check) puis renommé atomiquement à la destination.
 * Code de sortie : 0 = OK, 1 = échec, 2 = mauvais usage.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = 'scores.db';

const dest = process.argv[2];
if (!dest) {
	console.error('Usage : node scripts/backup.mjs <fichier de destination>');
	process.exit(2);
}

const dataDir = process.env.DATA_DIR?.trim() || './data';
const source = path.resolve(dataDir, DB_FILE);
const target = path.resolve(dest);

if (!fs.existsSync(source)) {
	console.error(`[backup] Base introuvable : ${source}`);
	process.exit(1);
}
if (target === source) {
	console.error('[backup] La destination doit être différente de la base.');
	process.exit(2);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
const tmp = `${target}.tmp-${process.pid}`;

try {
	const db = new Database(source, { fileMustExist: true });
	try {
		await db.backup(tmp);
	} finally {
		db.close();
	}

	const copy = new Database(tmp);
	let summary;
	try {
		copy.pragma('journal_mode = DELETE');
		const integrity = copy.pragma('integrity_check', { simple: true });
		if (integrity !== 'ok') throw new Error(`integrity_check : ${integrity}`);
		// Nombre de lignes par table : de quoi repérer d'un coup d'œil une sauvegarde vide.
		const tables = copy
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
			.pluck()
			.all();
		summary = tables
			.map((t) => `${t}: ${copy.prepare(`SELECT COUNT(*) FROM "${t.replaceAll('"', '""')}"`).pluck().get()}`)
			.join(', ');
	} finally {
		copy.close();
	}

	fs.renameSync(tmp, target);
	const size = fs.statSync(target).size;
	console.log(`[backup] OK : ${target} (${size} octets${summary ? `, ${summary}` : ''})`);
} catch (err) {
	fs.rmSync(tmp, { force: true });
	console.error(`[backup] Échec : ${err instanceof Error ? err.message : err}`);
	process.exit(1);
}
