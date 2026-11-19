import { fail, redirect } from '@sveltejs/kit';
import { GAMES } from '$lib/games';
import { getStore, InputError } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.canWrite) redirect(303, `/code?next=${encodeURIComponent(url.pathname + url.search)}`);
	const games = GAMES.map(({ slug, name, emoji, blurb, sides, teamCount, teamSize, minPlayers, maxPlayers, endValue, endEditable }) => ({
		slug,
		name,
		emoji,
		blurb,
		sides,
		teamCount,
		teamSize,
		minPlayers,
		maxPlayers,
		endValue,
		endEditable
	}));
	return { games, players: getStore().listPlayers() };
};

export const actions: Actions = {
	addPlayer: async ({ request, locals }) => {
		if (!locals.canWrite) return fail(403, { error: 'Il faut le code famille.' });
		const form = await request.formData();
		try {
			const player = getStore().addPlayer(String(form.get('name') ?? ''));
			return { added: player.id };
		} catch (e) {
			if (e instanceof InputError) return fail(400, { error: e.message });
			throw e;
		}
	},
	create: async ({ request, locals }) => {
		if (!locals.canWrite) return fail(403, { error: 'Il faut le code famille.' });
		const form = await request.formData();
		let id: number;
		try {
			const sides = JSON.parse(String(form.get('sides') ?? '[]'));
			const end = form.get('endValue');
			id = getStore().createMatch(String(form.get('game') ?? ''), sides, end ? Number(end) : undefined);
		} catch (e) {
			if (e instanceof InputError || e instanceof SyntaxError) return fail(400, { error: e.message });
			throw e;
		}
		redirect(303, `/partie/${id}`);
	}
};
