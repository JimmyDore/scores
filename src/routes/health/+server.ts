import { json } from '@sveltejs/kit';
import { getStore } from '$lib/server/db';
import type { RequestHandler } from './$types';

// Un GET sert aussi les HEAD.
export const GET: RequestHandler = () => {
	getStore().db.prepare('SELECT 1').get();
	return json({ ok: true });
};
