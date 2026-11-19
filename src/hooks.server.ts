import type { Handle, ServerInit } from '@sveltejs/kit';
import { familyCode, isFamily } from '$lib/server/auth';
import { getStore } from '$lib/server/db';

/** Au démarrage : vérifie la config et ouvre/migre la base (échoue tôt si quelque chose cloche). */
export const init: ServerInit = () => {
	familyCode();
	getStore();
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.canWrite = isFamily(event.cookies);
	const response = await resolve(event);
	if (response.headers.get('content-type')?.startsWith('text/html')) {
		// Un téléphone ne doit jamais garder une vieille page après un déploiement.
		response.headers.set('Cache-Control', 'no-cache');
	}
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
