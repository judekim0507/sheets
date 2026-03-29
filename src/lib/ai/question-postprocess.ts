import { generateObject, type LanguageModel } from 'ai';
import type { BuilderConfig, GeneratedQuestion } from '$lib/data/types';
import { worksheetSchema } from './schema';
import { systemPrompt } from './prompt';
import { buildQuestionEditPrompt, buildQuestionRegenPrompt } from './question-prompt';
import { findDiagramIssues } from './diagram-validation';
import { fixDiagram } from './fix-diagram';

export async function postprocessGeneratedQuestions(
	questions: unknown[],
	config: BuilderConfig,
	model: LanguageModel,
	options: { maxRetries?: number } = {}
): Promise<GeneratedQuestion[]> {
	const processed: GeneratedQuestion[] = [];
	for (const question of questions) {
		processed.push(await ensureDiagramQuality(question, config, model, options));
	}
	return processed;
}

export async function ensureDiagramQuality(
	question: unknown,
	config: BuilderConfig,
	model: LanguageModel,
	options: { maxRetries?: number } = {}
): Promise<GeneratedQuestion> {
	const fixed = fixDiagram(question);
	const initialIssues = findDiagramIssues(fixed);
	if (initialIssues.length === 0) return fixed;

	logGraphQuality('initial-failure', fixed, initialIssues);
	const repaired = await attemptDiagramRepair(
		fixed,
		initialIssues.map((issue) => issue.message),
		config,
		model,
		options
	);
	const repairedIssues = findDiagramIssues(repaired);
	if (repairedIssues.length === 0) {
		logGraphQuality('repair-success', repaired, []);
		return repaired;
	}

	logGraphQuality('repair-failure', repaired, repairedIssues);
	const regenerated = await attemptQuestionRegen(fixed, config, model, options);
	const regeneratedIssues = findDiagramIssues(regenerated);
	logGraphQuality(regeneratedIssues.length === 0 ? 'regen-success' : 'regen-failure', regenerated, regeneratedIssues);

	if (regeneratedIssues.length === 0) return regenerated;

	throw new Error(
		`Graph repair exhausted: ${regeneratedIssues.map((issue) => issue.message).join(' | ')}`
	);
}

async function attemptDiagramRepair(
	question: GeneratedQuestion,
	issues: string[],
	config: BuilderConfig,
	model: LanguageModel,
	options: { maxRetries?: number } = {}
): Promise<GeneratedQuestion> {
	const result = await generateObject({
		model,
		schema: worksheetSchema,
		system: systemPrompt,
		prompt: buildQuestionEditPrompt(
			question,
			`Fix only the diagram so it exactly matches the question. Keep the question text, answer, and solution steps aligned with the current version. Specific issues:\n- ${issues.join('\n- ')}`,
			config
		),
		maxRetries: options.maxRetries
	});

	return fixDiagram(result.object.questions[0]);
}

async function attemptQuestionRegen(
	question: GeneratedQuestion,
	config: BuilderConfig,
	model: LanguageModel,
	options: { maxRetries?: number } = {}
): Promise<GeneratedQuestion> {
	const result = await generateObject({
		model,
		schema: worksheetSchema,
		system: systemPrompt,
		prompt: buildQuestionRegenPrompt(question, config),
		maxRetries: options.maxRetries
	});

	return fixDiagram(result.object.questions[0]);
}

function logGraphQuality(
	stage: 'initial-failure' | 'repair-success' | 'repair-failure' | 'regen-success' | 'regen-failure',
	question: GeneratedQuestion,
	issues: Array<{ code: string; message: string }>
) {
	if (!question.diagram?.graph) return;
	console.info(
		'[graph-quality]',
		JSON.stringify({
			stage,
			question: question.question,
			expressions: question.diagram.graph.expressions.map((expression) => expression.latex),
			viewport: question.diagram.graph.viewport,
			issues
		})
	);
}
