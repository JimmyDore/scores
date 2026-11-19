import { error, fail, redirect } from '@sveltejs/kit';
import { checkCode, rememberFamily } from '$lib/server/auth';
import { getStore, InputError } from '$lib/server/db';
import { matchView, playerMap } from '$lib/server/view';
import type { Actions, PageServerLoad } from './$types';

function matchId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id < 1) error(404, 'Partie introuvable');
	return id;
}

export const load: PageServerLoad = ({ params }) => {
	const store = getStore();
	const match = store.getMatch(matchId(params.id));
	if (!match) error(404, 'Partie introuvable');
	return { match: matchView(match, playerMap(store.listPlayers())) };
};

/** Lance l'action si le téléphone connaît le code famille ; transforme les erreurs de saisie en message. */
async function guarded(locals: App.Locals, run: () => unknown) {
	if (!locals.canWrite) return fail(403, { error: 'Il faut le code famille.' });
	try {
		return await run();
	} catch (e) {
		if (e instanceof InputError || e instanceof SyntaxError) return fail(400, { error: e.message });
		throw e;
	}
}

export const actions: Actions = {
	code: async ({ request, cookies, url }) => {
		const form = await request.formData();
		if (!checkCode(String(form.get('code') ?? ''))) return fail(400, { wrong: true });
		rememberFamily(cookies, url.protocol === 'https:');
		return { unlocked: true };
	},
	round: async ({ request, params, locals }) =>
		guarded(locals, async () => {
			const form = await request.formData();
			getStore().saveRound(matchId(params.id), Number(form.get('n')), JSON.parse(String(form.get('entries') ?? '[]')));
			return { saved: true };
		}),
	deleteRound: async ({ request, params, locals }) =>
		guarded(locals, async () => {
			const form = await request.formData();
			getStore().deleteRound(matchId(params.id), Number(form.get('n')));
			return { deleted: true };
		}),
	deleteMatch: async ({ params, locals }) => {
		const r = await guarded(locals, () => getStore().deleteMatch(matchId(params.id)));
		if (r) return r;
		redirect(303, '/');
	},
	rematch: async ({ params, locals }) => {
		let id = 0;
		const r = await guarded(locals, () => {
			const store = getStore();
			const m = store.getMatch(matchId(params.id));
			if (!m) throw new InputError('Partie introuvable.');
			id = store.createMatch(m.game, m.sides, m.endValue);
		});
		if (r) return r;
		redirect(303, `/partie/${id}`);
	}
};
