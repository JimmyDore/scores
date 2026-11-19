/**
 * Les jeux connus du site. Ajouter un jeu = ajouter une entrée ici.
 *
 * - `sides` : `team` = des équipes de `teamSize` joueurs (`teamCount` équipes), `solo` = un camp par joueur.
 * - `end` : `rounds` = la partie s'arrête après `endValue` manches ; `target` = dès qu'un camp atteint `endValue`.
 * - `win` : `high` = le plus haut total gagne, `low` = le plus bas.
 * - `entry` : la façon de saisir une manche (`belote` = 162 − x et raccourcis, `free` = un nombre par camp,
 *   `skullking` = annonces puis plis + bonus, score calculé).
 */
export type EntryKind = 'belote' | 'free' | 'skullking';

export interface GameDef {
	slug: string;
	name: string;
	emoji: string;
	sides: 'team' | 'solo';
	teamCount?: number;
	teamSize?: number;
	minPlayers: number;
	maxPlayers: number;
	end: 'rounds' | 'target';
	endValue: number;
	/** Le seuil peut-il être changé au lancement (6 qui prend) ? */
	endEditable?: boolean;
	win: 'high' | 'low';
	entry: EntryKind;
	/** Libellé de la manche n (1-based), ex. « 3 » … « R » au 5 rois. */
	roundLabel?: (n: number) => string;
	/** Une phrase pour l'écran Nouvelle partie. */
	blurb: string;
}

const CINQ_ROIS_CARDS = ['3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];

export const GAMES: readonly GameDef[] = [
	{
		slug: 'belote',
		name: 'Belote',
		emoji: '♠️',
		sides: 'team',
		teamCount: 2,
		teamSize: 2,
		minPlayers: 4,
		maxPlayers: 4,
		end: 'rounds',
		endValue: 12,
		win: 'high',
		entry: 'belote',
		blurb: '2 équipes de 2, 12 manches'
	},
	{
		slug: 'cinq-rois',
		name: '5 rois',
		emoji: '👑',
		sides: 'solo',
		minPlayers: 2,
		maxPlayers: 8,
		end: 'rounds',
		endValue: 11,
		win: 'low',
		entry: 'free',
		roundLabel: (n) => CINQ_ROIS_CARDS[n - 1] ?? String(n),
		blurb: '11 manches, le plus petit score gagne'
	},
	{
		slug: 'skull-king',
		name: 'Skull King',
		emoji: '🏴‍☠️',
		sides: 'solo',
		minPlayers: 2,
		maxPlayers: 8,
		end: 'rounds',
		endValue: 10,
		win: 'high',
		entry: 'skullking',
		blurb: '10 manches, avec les annonces'
	},
	{
		slug: 'six-qui-prend',
		name: '6 qui prend',
		emoji: '🐮',
		sides: 'solo',
		minPlayers: 2,
		maxPlayers: 10,
		end: 'target',
		endValue: 66,
		endEditable: true,
		win: 'low',
		entry: 'free',
		blurb: 'Jusqu’à 66 têtes, le plus petit score gagne'
	}
];

export function getGame(slug: string): GameDef | undefined {
	return GAMES.find((g) => g.slug === slug);
}

export function roundLabel(game: GameDef, n: number): string {
	return game.roundLabel ? game.roundLabel(n) : String(n);
}

/** Total d'une manche de belote sans annonce. */
export const BELOTE_ROUND = 162;
export const BELOTE_CAPOT = 252;
export const BELOTE_BONUS = 20;

/**
 * Score Skull King, barème classique, manche n (n cartes en main).
 * - annonce ≥ 1 réussie : 20 × plis + bonus ;
 * - annonce ≥ 1 ratée : −10 × écart ;
 * - annonce 0 réussie : 10 × n (+ bonus) ; ratée : −10 × n.
 * Le bonus ne compte que si l'annonce est réussie.
 */
export function skullKingScore(n: number, bid: number, tricks: number, bonus = 0): number {
	if (bid === 0) return tricks === 0 ? 10 * n + bonus : -10 * n;
	if (bid === tricks) return 20 * bid + bonus;
	return -10 * Math.abs(bid - tricks);
}
