import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { worksheetSchema } from '$lib/ai/schema';
import { systemPrompt, buildQuestionEditPrompt, buildQuestionRegenPrompt } from '$lib/ai/question-prompt';
import { fixDiagram } from '$lib/ai/fix-diagram';
import { checkRateLimit } from '$lib/ai/rate-limit';
import type { GeneratedQuestion, BuilderConfig, AIProvider } from '$lib/data/types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!checkRateLimit(getClientAddress())) {
		return json({ error: 'Too many requests — wait a minute' }, { status: 429 });
	}
	let body: {
		original: GeneratedQuestion;
		instruction: string | null; // null = full regen, string = edit with instruction
		config: BuilderConfig;
		provider: AIProvider;
		apiKey: string;
		model: string;
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { original, instruction, config, provider, apiKey, model: modelId } = body;

	if (!apiKey) return json({ error: 'API key is required' }, { status: 400 });

	try {
		const model =
			provider === 'anthropic'
				? createAnthropic({ apiKey })(modelId)
				: createGoogleGenerativeAI({ apiKey })(modelId);

		const prompt = instruction
			? buildQuestionEditPrompt(original, instruction, config)
			: buildQuestionRegenPrompt(original, config);

		const result = await generateObject({
			model,
			schema: worksheetSchema,
			system: systemPrompt,
			prompt
		});

		const raw = result.object.questions[0];
		if (!raw) {
			return json({ error: 'No question generated' }, { status: 500 });
		}

		return json({ question: fixDiagram(raw) });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Generation failed';
		console.error('Question generation error:', e);
		return json({ error: message }, { status: 500 });
	}
};
