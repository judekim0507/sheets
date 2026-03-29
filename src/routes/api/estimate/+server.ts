import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchModels, estimateCost } from 'tokenlens';
import type { ModelCatalog } from 'tokenlens';

// Map our model IDs to their models.dev provider
const MODEL_PROVIDERS: Record<string, string> = {
	'claude-sonnet-4-6': 'anthropic',
	'claude-haiku-4-5': 'anthropic',
	'gemini-2.5-flash': 'google',
	'gemini-2.5-pro': 'google',
	'gemini-3-flash-preview': 'google',
	'gemini-3.1-pro-preview': 'google'
};

// Cache per-provider catalogs
const providerCache = new Map<string, { data: ModelCatalog; at: number }>();
const CACHE_TTL = 60 * 60 * 1000;

async function getProviderCatalog(provider: string): Promise<ModelCatalog | null> {
	const cached = providerCache.get(provider);
	if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;
	try {
		const info = await fetchModels({ provider });
		if (!info) return null;
		const catalog = { [provider]: info } as ModelCatalog;
		providerCache.set(provider, { data: catalog, at: Date.now() });
		return catalog;
	} catch {
		return cached?.data ?? null;
	}
}

const SYSTEM_PROMPT_TOKENS = 1800;
const SCHEMA_TOKENS = 800;
const USER_PROMPT_BASE_TOKENS = 300;
const TOKENS_PER_SKILL = 40;
const OUTPUT_TOKENS_PER_QUESTION = 450;

export const GET: RequestHandler = async ({ url }) => {
	const modelId = url.searchParams.get('model');
	const questions = parseInt(url.searchParams.get('questions') ?? '10');
	const skills = parseInt(url.searchParams.get('skills') ?? '1');

	if (!modelId) return json({ error: 'model param required' }, { status: 400 });

	const inputTokens = SYSTEM_PROMPT_TOKENS + SCHEMA_TOKENS + USER_PROMPT_BASE_TOKENS + skills * TOKENS_PER_SKILL;
	const outputTokens = questions * OUTPUT_TOKENS_PER_QUESTION;

	const provider = MODEL_PROVIDERS[modelId];
	if (!provider) {
		return json({ inputTokens, outputTokens, totalUSD: null, live: false });
	}

	const catalog = await getProviderCatalog(provider);

	try {
		const cost = estimateCost({
			modelId,
			usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
			...(catalog ? { catalog } : {})
		});

		if (cost.totalUSD != null && cost.totalUSD > 0) {
			return json({
				inputTokens,
				outputTokens,
				totalUSD: cost.totalUSD,
				live: !!catalog
			});
		}
	} catch {
		// fall through
	}

	// Hardcoded fallback for models not yet in models.dev
	const fallback: Record<string, { input: number; output: number }> = {
		'claude-sonnet-4-6': { input: 3, output: 15 },
		'claude-haiku-4-5': { input: 0.80, output: 4 }
	};
	const fb = fallback[modelId];
	if (fb) {
		const total = (inputTokens / 1e6) * fb.input + (outputTokens / 1e6) * fb.output;
		return json({ inputTokens, outputTokens, totalUSD: total, live: false });
	}

	return json({ inputTokens, outputTokens, totalUSD: null, live: false });
};
