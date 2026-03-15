import type { AIProvider } from '$lib/data/types';

const STORAGE_KEY = 'math-worksheet-settings';

export const ANTHROPIC_MODELS: { id: string; label: string }[] = [
	{ id: 'claude-sonnet-4-6-20250415', label: 'Claude Sonnet 4.6' },
	{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }
];

export const GOOGLE_MODELS: { id: string; label: string }[] = [
	{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
	{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
	{ id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
	{ id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' }
];

interface StoredSettings {
	provider: AIProvider;
	anthropicApiKey: string;
	googleApiKey: string;
	anthropicModel: string;
	googleModel: string;
}

function loadSettings(): StoredSettings {
	if (typeof window === 'undefined') {
		return {
			provider: 'anthropic',
			anthropicApiKey: '',
			googleApiKey: '',
			anthropicModel: ANTHROPIC_MODELS[0].id,
			googleModel: GOOGLE_MODELS[0].id
		};
	}
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return {
				provider: parsed.provider ?? 'anthropic',
				anthropicApiKey: parsed.anthropicApiKey ?? '',
				googleApiKey: parsed.googleApiKey ?? '',
				anthropicModel: parsed.anthropicModel ?? ANTHROPIC_MODELS[0].id,
				googleModel: parsed.googleModel ?? GOOGLE_MODELS[0].id
			};
		}
	} catch {
		// ignore
	}
	return {
		provider: 'anthropic',
		anthropicApiKey: '',
		googleApiKey: '',
		anthropicModel: ANTHROPIC_MODELS[0].id,
		googleModel: GOOGLE_MODELS[0].id
	};
}

class SettingsStore {
	provider = $state<AIProvider>('anthropic');
	anthropicApiKey = $state('');
	googleApiKey = $state('');
	anthropicModel = $state(ANTHROPIC_MODELS[0].id);
	googleModel = $state(GOOGLE_MODELS[0].id);

	get activeApiKey(): string {
		return this.provider === 'anthropic' ? this.anthropicApiKey : this.googleApiKey;
	}

	get activeModel(): string {
		return this.provider === 'anthropic' ? this.anthropicModel : this.googleModel;
	}

	get isConfigured(): boolean {
		return this.activeApiKey.length > 0;
	}

	constructor() {
		const saved = loadSettings();
		this.provider = saved.provider;
		this.anthropicApiKey = saved.anthropicApiKey;
		this.googleApiKey = saved.googleApiKey;
		this.anthropicModel = saved.anthropicModel;
		this.googleModel = saved.googleModel;
	}

	save() {
		if (typeof window === 'undefined') return;
		const data: StoredSettings = {
			provider: this.provider,
			anthropicApiKey: this.anthropicApiKey,
			googleApiKey: this.googleApiKey,
			anthropicModel: this.anthropicModel,
			googleModel: this.googleModel
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	}
}

export const settingsStore = new SettingsStore();
