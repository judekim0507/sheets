import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { worksheetSchema } from '$lib/ai/schema';
import { systemPrompt, buildUserPrompt } from '$lib/ai/prompt';
import { fixDiagram } from '$lib/ai/fix-diagram';
import { checkRateLimit } from '$lib/ai/rate-limit';
import type { BuilderConfig, AIProvider, Worksheet } from '$lib/data/types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!checkRateLimit(getClientAddress())) {
		return json({ error: 'Too many requests — wait a minute' }, { status: 429 });
	}
	let body: { config: BuilderConfig; provider: AIProvider; apiKey: string; model: string };

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { config, provider, apiKey, model: modelId } = body;

	if (!apiKey) {
		return json({ error: 'API key is required' }, { status: 400 });
	}

	if (!config.grade && config.grade !== 0) {
		return json({ error: 'Grade level is required' }, { status: 400 });
	}

	if (!config.selectedSkills?.length && !config.customTopic?.trim()) {
		return json({ error: 'Select skills or enter a custom topic' }, { status: 400 });
	}

	try {
		const model =
			provider === 'anthropic'
				? createAnthropic({ apiKey })(modelId)
				: createGoogleGenerativeAI({ apiKey })(modelId);

		const userPrompt = buildUserPrompt(config);

		// For large question counts, batch into multiple calls
		const batchSize = 15;
		const totalQuestions = config.questionCount;

		if (totalQuestions <= batchSize) {
			const result = await generateObject({
				model,
				schema: worksheetSchema,
				system: systemPrompt,
				prompt: userPrompt
			});

			const worksheet: Worksheet = {
				id: crypto.randomUUID(),
				title: result.object.title,
				created_at: new Date().toISOString(),
				config,
				questions: result.object.questions.map((q) => fixDiagram(q))
			};

			return json({ worksheet });
		}

		// Batch generation for >15 questions
		const batch1Count = Math.ceil(totalQuestions / 2);
		const batch2Count = totalQuestions - batch1Count;

		const batch1Config = { ...config, questionCount: batch1Count };
		const batch2Config = { ...config, questionCount: batch2Count };

		const [result1, result2] = await Promise.all([
			generateObject({
				model,
				schema: worksheetSchema,
				system: systemPrompt,
				prompt: buildUserPrompt(batch1Config)
			}),
			generateObject({
				model,
				schema: worksheetSchema,
				system: systemPrompt,
				prompt: buildUserPrompt(batch2Config)
			})
		]);

		const worksheet: Worksheet = {
			id: crypto.randomUUID(),
			title: result1.object.title,
			created_at: new Date().toISOString(),
			config,
			questions: [...result1.object.questions, ...result2.object.questions].map((q) => fixDiagram(q))
		};

		return json({ worksheet });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Generation failed';
		console.error('Generation error:', e);
		return json({ error: message }, { status: 500 });
	}
};
