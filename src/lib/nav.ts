import { goto } from '$app/navigation';

/**
 * Navigate with View Transitions API when available.
 * Falls back to regular SvelteKit navigation.
 */
export function navigate(url: string) {
	if (typeof document !== 'undefined' && 'startViewTransition' in document) {
		(document as any).startViewTransition(() => goto(url));
	} else {
		goto(url);
	}
}
