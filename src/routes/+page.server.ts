import { getStore } from '$lib/server/db';
import { matchView, playerMap } from '$lib/server/view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const store = getStore();
	const players = playerMap(store.listPlayers());
	const views = store.listMatches().map((m) => matchView(m, players));
	const live = views.filter((v) => !v.done).reverse();
	const recent = views.filter((v) => v.done).reverse().slice(0, 5);
	return { live, recent };
};
