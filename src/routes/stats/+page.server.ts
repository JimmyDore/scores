import { getStore } from '$lib/server/db';
import { matchView, playerMap } from '$lib/server/view';
import { allGameStats, overallStats } from '$lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const store = getStore();
	const players = playerMap(store.listPlayers());
	const matches = store.listMatches();
	const games = allGameStats(matches, players).map((s) => ({
		slug: s.game.slug,
		name: s.game.name,
		emoji: s.game.emoji,
		win: s.game.win,
		team: s.game.sides === 'team',
		played: s.played,
		players: s.players,
		records: s.records,
		duos: s.duos
	}));
	const history = matches
		.map((m) => matchView(m, players))
		.filter((v) => v.done)
		.reverse();
	return { games, overall: overallStats(matches, players), history };
};
