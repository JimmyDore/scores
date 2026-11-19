/**
 * Code famille : lecture libre, écriture après saisie du code (cookie d'un an, valeur hachée).
 */
import type { Cookies } from '@sveltejs/kit';
import { createHash, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'famille';

export function familyCode(): string {
	const code = process.env.FAMILY_CODE?.trim();
	if (code) return code;
	if (process.env.NODE_ENV === 'production') throw new Error('FAMILY_CODE manquant');
	return 'dev';
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const token = () => createHash('sha256').update(`scores:${normalize(familyCode())}`).digest('hex');

function same(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export function isFamily(cookies: Cookies): boolean {
	const value = cookies.get(COOKIE);
	return !!value && same(value, token());
}

export function checkCode(input: string): boolean {
	return same(normalize(input), normalize(familyCode()));
}

export function rememberFamily(cookies: Cookies, secure: boolean): void {
	cookies.set(COOKIE, token(), { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 60 * 60 * 24 * 365 });
}
