import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { worksheetSchema } from '$lib/ai/schema';
import { systemPrompt } from '$lib/ai/prompt';
import { buildClinicPrompt } from '$lib/ai/clinic-prompt';
import { checkRateLimit } from '$lib/ai/rate-limit';
import { postprocessGeneratedQuestions } from '$lib/ai/question-postprocess';
import { logQuestions } from '$lib/db/turso';
import type { GeneratedQuestion, BuilderConfig, AIProvider, Worksheet } from '$lib/data/types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!checkRateLimit(getClientAddress())) {
		return json({ error: 'Too many requests — wait a minute' }, { status: 429 });
	}

	let body: {
		sourceQuestions: GeneratedQuestion[];
		questionCount: number;
		config: BuilderConfig;
		sourceTitle: string;
		provider: AIProvider;
		apiKey: string;
		model: string;
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { sourceQuestions, questionCount, config, sourceTitle, provider, apiKey, model: modelId } = body;

	if (!apiKey) return json({ error: 'API key is required' }, { status: 400 });
	if (!sourceQuestions?.length) return json({ error: 'Select at least one question' }, { status: 400 });

	try {
		const model =
			provider === 'anthropic'
				? createAnthropic({ apiKey })(modelId)
				: createGoogleGenerativeAI({ apiKey })(modelId);
		const maxRetries = provider === 'google' ? 0 : undefined;

		const prompt = buildClinicPrompt(sourceQuestions, questionCount, config);

		const result = await generateObject({
			model,
			schema: worksheetSchema,
			system: systemPrompt,
			prompt,
			maxRetries
		});

		const questions = await postprocessGeneratedQuestions(result.object.questions, config, model, { maxRetries });

		const worksheet: Worksheet = {
			id: crypto.randomUUID(),
			title: result.object.title || `Clinic: ${sourceTitle}`,
			created_at: new Date().toISOString(),
			config,
			questions
		};

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
			questions: worksheet.questions
		});

		return json({ worksheet });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Generation failed';
		console.error('Clinic generation error:', e);
		return json({ error: message }, { status: 500 });
	}
};
