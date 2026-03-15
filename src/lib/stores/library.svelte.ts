import type { Worksheet } from '$lib/data/types';

const STORAGE_KEY = 'math-worksheet-library';
const MAX_WORKSHEETS = 50;

function loadLibrary(): Worksheet[] {
	if (typeof window === 'undefined') return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored);
	} catch {
		// corrupt data
	}
	return [];
}

class LibraryStore {
	worksheets = $state<Worksheet[]>([]);
	storageFull = $state(false);

	constructor() {
		this.worksheets = loadLibrary();
	}

	save(worksheet: Worksheet) {
		if (this.worksheets.some((w) => w.id === worksheet.id)) return;
		this.worksheets = [worksheet, ...this.worksheets];
		// Trim to max
		if (this.worksheets.length > MAX_WORKSHEETS) {
			this.worksheets = this.worksheets.slice(0, MAX_WORKSHEETS);
		}
		this.persist();
	}

	update(worksheet: Worksheet) {
		const idx = this.worksheets.findIndex((w) => w.id === worksheet.id);
		if (idx >= 0) {
			this.worksheets = this.worksheets.map((w, i) => (i === idx ? worksheet : w));
		} else {
			this.worksheets = [worksheet, ...this.worksheets];
		}
		this.persist();
	}

	remove(id: string) {
		this.worksheets = this.worksheets.filter((w) => w.id !== id);
		this.persist();
		this.storageFull = false;
	}

	get(id: string): Worksheet | undefined {
		return this.worksheets.find((w) => w.id === id);
	}

	duplicate(id: string): Worksheet | null {
		const ws = this.get(id);
		if (!ws) return null;
		const copy: Worksheet = {
			...ws,
			id: crypto.randomUUID(),
			title: `${ws.title} (copy)`,
			created_at: new Date().toISOString(),
			threads: ws.threads ? ws.threads.map((t) => ({ ...t, versions: [...t.versions], instructions: [...t.instructions] })) : undefined
		};
		this.worksheets = [copy, ...this.worksheets];
		if (this.worksheets.length > MAX_WORKSHEETS) {
			this.worksheets = this.worksheets.slice(0, MAX_WORKSHEETS);
		}
		this.persist();
		return copy;
	}

	private persist() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.worksheets));
			this.storageFull = false;
		} catch {
			this.storageFull = true;
		}
	}
}

export const libraryStore = new LibraryStore();
