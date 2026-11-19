import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ canWrite: locals.canWrite });
