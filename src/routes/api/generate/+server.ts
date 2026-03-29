import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, type LanguageModel, type ModelMessage, type SystemModelMessage } from 'ai';
import { singleQuestionSchema, worksheetPlanSchema, type QuestionBriefOutput } from '$lib/ai/schema';
import { systemPrompt, planningSystemPrompt, buildWorksheetPlanPrompt } from '$lib/ai/prompt';
import { buildQuestionFromBriefPrompt, buildQuestionFromBriefPromptParts } from '$lib/ai/question-prompt';
import { checkRateLimit } from '$lib/ai/rate-limit';
import { ensureDiagramQuality, ensureDistinctQuestion } from '$lib/ai/question-postprocess';
import { questionBriefFingerprint, uniqueQuestionBriefs } from '$lib/ai/question-variety';
import { logQuestions } from '$lib/db/turso';
import type { BuilderConfig, AIProvider, GeneratedQuestion } from '$lib/data/types';

const MAX_PLAN_ATTEMPTS = 2;
const MAX_SLOT_ATTEMPTS = 2;
const ANTHROPIC_CACHE_1H = { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' as const } } };

type WorkerResult =
	| { slotIndex: number; question: GeneratedQuestion }
	| { slotIndex: number; error: unknown };

interface SlotState {
	index: number;
	brief: QuestionBriefOutput;
	attempts: number;
	candidate?: GeneratedQuestion;
	error?: unknown;
}

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

	const model =
		provider === 'anthropic'
			? createAnthropic({ apiKey })(modelId)
			: createGoogleGenerativeAI({ apiKey })(modelId);
	const maxRetries = 0;

	const target = config.questionCount;
	const worksheetId = crypto.randomUUID();

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (data: object) => {
				controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
			};

			try {
				const plan = await planWorksheetBriefs(config, model, provider, target, { maxRetries });
				const title = plan.title;
				send({ type: 'title', title });

				const acceptedQuestions: GeneratedQuestion[] = [];
				const acceptedUniquenessKeys: string[] = [];
				const spareBriefs = [...plan.briefs.slice(target)];
				const slots: SlotState[] = plan.briefs.slice(0, target).map((brief, index) => ({
					index,
					brief,
					attempts: 0
				}));

				const maxWorkerConcurrency = Math.min(target, provider === 'google' ? 1 : 3);
				let anthropicWorkerCachePrimed = provider !== 'anthropic';
				const queued: number[] = slots.map((slot) => slot.index);
				const queuedSet = new Set(queued);
				const running = new Map<number, Promise<WorkerResult>>();
				let nextToEmit = 0;

				const queueSlot = (index: number) => {
					if (!queuedSet.has(index) && !running.has(index)) {
						queued.push(index);
						queuedSet.add(index);
					}
				};

				const startWorker = (index: number) => {
					const slot = slots[index];
					slot.attempts += 1;
					slot.candidate = undefined;
					slot.error = undefined;
					const promise = generateQuestionFromBrief(slot.brief, config, model, provider, {
						maxRetries,
						avoidUniquenessKeys: acceptedUniquenessKeys
					})
						.then((question) => ({ slotIndex: index, question }) satisfies WorkerResult)
						.catch((error) => ({ slotIndex: index, error }) satisfies WorkerResult);
					running.set(index, promise);
				};

				const launchAvailableWorkers = () => {
					const workerConcurrency = anthropicWorkerCachePrimed ? maxWorkerConcurrency : 1;
					while (running.size < workerConcurrency && queued.length > 0) {
						const index = queued.shift()!;
						queuedSet.delete(index);
						startWorker(index);
					}
				};

				const reassignSlotFromSpare = (slot: SlotState, reason: unknown): boolean => {
					if (slot.attempts >= MAX_SLOT_ATTEMPTS) return false;
					const nextBrief = spareBriefs.shift();
					if (!nextBrief) return false;
					console.info(
						'[worksheet-generation]',
						JSON.stringify({
							stage: 'slot-retry',
							index: slot.index,
							attempts: slot.attempts,
							reason: reason instanceof Error ? reason.message : String(reason),
							next_brief: nextBrief.uniqueness_key
						})
					);
					slot.brief = nextBrief;
					slot.candidate = undefined;
					slot.error = undefined;
					queueSlot(slot.index);
					return true;
				};

				const promoteReadySlots = async () => {
					while (nextToEmit < target) {
						const slot = slots[nextToEmit];
						if (slot.candidate) {
							try {
								const unique = await ensureDistinctQuestion(slot.candidate, acceptedQuestions, config, model, {
									maxRetries,
									maxDuplicateRetries: 0
								});
								acceptedQuestions.push(unique);
								acceptedUniquenessKeys.push(slot.brief.uniqueness_key);
								send({ type: 'question', question: unique });
								slot.candidate = undefined;
								nextToEmit += 1;
								continue;
							} catch (error) {
								if (reassignSlotFromSpare(slot, error)) return;
								throw error;
							}
						}

						if (slot.error) {
							if (reassignSlotFromSpare(slot, slot.error)) return;
							throw slot.error instanceof Error ? slot.error : new Error(String(slot.error));
						}

						return;
					}
				};

				launchAvailableWorkers();
				while (acceptedQuestions.length < target) {
					if (running.size === 0) {
						throw new Error('Worksheet generation stalled before enough valid questions were produced.');
					}

					const settled = await Promise.race(running.values());
					running.delete(settled.slotIndex);

					const slot = slots[settled.slotIndex];
					if ('question' in settled) {
						slot.candidate = settled.question;
						slot.error = undefined;
					} else {
						slot.error = settled.error;
						slot.candidate = undefined;
					}

					if (!anthropicWorkerCachePrimed) {
						anthropicWorkerCachePrimed = true;
					}

					await promoteReadySlots();
					launchAvailableWorkers();
				}

				send({ type: 'done', id: worksheetId });
				controller.close();

				logQuestions({
					worksheetId,
					worksheetTitle: title,
					grade: config.grade,
					skillIds: config.selectedSkills?.map((s) => s.skill_id) || [],
					customTopic: config.customTopic,
					difficulty: config.difficulty,
					questionType: config.questionType,
					provider,
					model: modelId,
					questions: acceptedQuestions
				});
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Generation failed';
				console.error('Generation error:', e);
				send({ type: 'error', error: message });
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/x-ndjson',
			'Cache-Control': 'no-cache',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};

async function planWorksheetBriefs(
	config: BuilderConfig,
	model: LanguageModel,
	provider: AIProvider,
	target: number,
	options: { maxRetries?: number }
): Promise<{ title: string; briefs: QuestionBriefOutput[] }> {
	const desiredBriefCount = target + spareBriefCount(target);
	const collected: QuestionBriefOutput[] = [];
	const seen = new Set<string>();
	const usedFingerprints: string[] = [];
	let title = '';

	for (let attempt = 0; attempt < MAX_PLAN_ATTEMPTS && collected.length < desiredBriefCount; attempt += 1) {
		const requestedCount = desiredBriefCount - collected.length + Math.min(2, target);
		const prompt = buildWorksheetPlanPrompt(config, requestedCount, {
			avoidBriefFingerprints: usedFingerprints
		});
		const result = provider === 'anthropic'
			? await generateObject({
				model,
				schema: worksheetPlanSchema,
				system: [{
					role: 'system',
					content: planningSystemPrompt,
					providerOptions: ANTHROPIC_CACHE_1H
				}] satisfies SystemModelMessage[],
				messages: [{
					role: 'user',
					content: prompt
				}] satisfies ModelMessage[],
				maxRetries: options.maxRetries
			})
			: await generateObject({
				model,
				schema: worksheetPlanSchema,
				system: planningSystemPrompt,
				prompt,
				maxRetries: options.maxRetries
			});

		if (!title && result.object.title.trim()) {
			title = result.object.title.trim();
		}

		for (const brief of uniqueQuestionBriefs(result.object.briefs)) {
			const fingerprint = questionBriefFingerprint(brief);
			if (seen.has(fingerprint)) continue;
			seen.add(fingerprint);
			usedFingerprints.push(fingerprint);
			collected.push(brief);
			if (collected.length >= desiredBriefCount) break;
		}
	}

	if (collected.length < target) {
		throw new Error('Worksheet planner did not produce enough distinct question briefs.');
	}

	return {
		title: title || 'Generated Worksheet',
		briefs: collected.slice(0, desiredBriefCount)
	};
}

async function generateQuestionFromBrief(
	brief: QuestionBriefOutput,
	config: BuilderConfig,
	model: LanguageModel,
	provider: AIProvider,
	options: { maxRetries?: number; avoidQuestionTexts?: string[]; avoidUniquenessKeys?: string[] } = {}
): Promise<GeneratedQuestion> {
	const result = provider === 'anthropic'
		? await generateObject({
			model,
			schema: singleQuestionSchema,
			system: [{
				role: 'system',
				content: systemPrompt,
				providerOptions: ANTHROPIC_CACHE_1H
			}] satisfies SystemModelMessage[],
			messages: [{
				role: 'user',
				content: (() => {
					const { staticPrompt, dynamicPrompt } = buildQuestionFromBriefPromptParts(brief, config, {
						avoidQuestionTexts: options.avoidQuestionTexts,
						avoidUniquenessKeys: options.avoidUniquenessKeys
					});
					return [
						{
							type: 'text' as const,
							text: staticPrompt,
							providerOptions: ANTHROPIC_CACHE_1H
						},
						{
							type: 'text' as const,
							text: dynamicPrompt
						}
					];
				})()
			}] satisfies ModelMessage[],
			maxRetries: options.maxRetries
		})
		: await generateObject({
			model,
			schema: singleQuestionSchema,
			system: systemPrompt,
			prompt: buildQuestionFromBriefPrompt(brief, config, {
				avoidQuestionTexts: options.avoidQuestionTexts,
				avoidUniquenessKeys: options.avoidUniquenessKeys
			}),
			maxRetries: options.maxRetries
		});

	return ensureDiagramQuality(result.object.question, config, model, {
		maxRetries: options.maxRetries
	});
}

function spareBriefCount(target: number): number {
	if (target <= 4) return 2;
	if (target <= 8) return 3;
	return 4;
}
