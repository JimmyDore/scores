const TZ = 'Europe/Paris';

/** « sam. 14 nov. » */
export function shortDate(iso: string): string {
	return new Date(iso).toLocaleDateString('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
}

/** « 14/11/2026 » */
export function numericDate(iso: string): string {
	return new Date(iso).toLocaleDateString('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}
