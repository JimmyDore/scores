import { fail, redirect } from '@sveltejs/kit';
import { checkCode, rememberFamily } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

const safeNext = (raw: string | null) => (raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/');

export const load: PageServerLoad = ({ url, locals }) => {
	if (locals.canWrite) redirect(303, safeNext(url.searchParams.get('next')));
	return { next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const code = String(form.get('code') ?? '');
		if (!checkCode(code)) return fail(400, { wrong: true });
		rememberFamily(cookies, url.protocol === 'https:');
		redirect(303, safeNext(String(form.get('next') ?? '/')));
	}
};
