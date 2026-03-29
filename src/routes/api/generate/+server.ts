import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { worksheetSchema } from '$lib/ai/schema';
import { systemPrompt, buildUserPrompt } from '$lib/ai/prompt';
import { checkRateLimit } from '$lib/ai/rate-limit';
import { postprocessGeneratedQuestions } from '$lib/ai/question-postprocess';
import { logQuestions } from '$lib/db/turso';
import type { BuilderConfig, AIProvider, Worksheet } from '$lib/data/types';

const BATCH_SIZE = 10;

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
	if (!apiKey) return json({ error: 'API key is required' }, { status: 400 });
	if (!config.grade && config.grade !== 0) return json({ error: 'Grade level is required' }, { status: 400 });
	if (!config.selectedSkills?.length && !config.customTopic?.trim()) return json({ error: 'Select skills or enter a custom topic' }, { status: 400 });

	try {
		const model =
			provider === 'anthropic'
				? createAnthropic({ apiKey })(modelId)
				: createGoogleGenerativeAI({ apiKey })(modelId);
		const maxRetries = provider === 'google' ? 0 : undefined;

		const target = config.questionCount;
		const numBatches = Math.ceil(target / BATCH_SIZE);
		const results = [];

		for (let i = 0; i < numBatches; i += 1) {
			const batchCount = Math.min(BATCH_SIZE, target - i * BATCH_SIZE);
			const batchConfig = { ...config, questionCount: batchCount };
			const result = await generateObject({
				model,
				schema: worksheetSchema,
				system: systemPrompt,
				prompt: buildUserPrompt(batchConfig),
				maxRetries
			});
			results.push(result);
		}

		const title = results[0]?.object.title || 'Math Worksheet';
		const rawQuestions = results.flatMap((r) => r.object.questions);
		const allQuestions = await postprocessGeneratedQuestions(rawQuestions, config, model, { maxRetries });
		const questions = allQuestions.slice(0, target);

		if (questions.length === 0) {
			return json({ error: 'No questions generated — try a different model' }, { status: 500 });
		}

		const worksheet: Worksheet = {
			id: crypto.randomUUID(),
			title,
			created_at: new Date().toISOString(),
			config,
			questions
		};

		// Log to Turso (fire and forget — don't block response)
		logQuestions({
			worksheetId: worksheet.id,
			worksheetTitle: worksheet.title,
			grade: config.grade,
			skillIds: config.selectedSkills?.map((s) => s.skill_id) || [],
			customTopic: config.customTopic,
			difficulty: config.difficulty,
			questionType: config.questionType,
			provider,
			model: modelId,
			questions
		});

		return json({ worksheet });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Generation failed';
		console.error('Generation error:', e);
		return json({ error: message }, { status: 500 });
	}
};
