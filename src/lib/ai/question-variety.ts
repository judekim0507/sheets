import type { GeneratedQuestion } from '$lib/data/types';
import { inferGeometryFamily } from '$lib/geometry/compiler';
import type { QuestionBriefOutput } from './schema';

export interface DuplicateQuestionMatch {
	reason: 'exact-text' | 'template-match' | 'semantic-match';
	existing: GeneratedQuestion;
	fingerprint: string;
}

export function findDuplicateQuestion(
	candidate: GeneratedQuestion,
	existingQuestions: GeneratedQuestion[]
): DuplicateQuestionMatch | undefined {
	const candidateText = normalizeExactQuestionText(candidate.question);
	const candidateFingerprint = questionTemplateFingerprint(candidate);
	const candidateSemanticFingerprints = questionSemanticFingerprints(candidate);

	for (const existing of existingQuestions) {
		if (normalizeExactQuestionText(existing.question) === candidateText) {
			return { reason: 'exact-text', existing, fingerprint: candidateFingerprint };
		}
		if (questionTemplateFingerprint(existing) === candidateFingerprint) {
			return { reason: 'template-match', existing, fingerprint: candidateFingerprint };
		}
		const existingSemanticFingerprints = questionSemanticFingerprints(existing);
		const sharedSemanticFingerprint = candidateSemanticFingerprints
			.find((fingerprint) => existingSemanticFingerprints.includes(fingerprint));
		if (sharedSemanticFingerprint) {
			return { reason: 'semantic-match', existing, fingerprint: sharedSemanticFingerprint };
		}
	}

	return undefined;
}

export function questionTemplateFingerprint(question: Pick<GeneratedQuestion, 'question' | 'diagram'>): string {
	const family = question.diagram?.graph
		? 'graph'
		: inferGeometryFamily(question.question, question.diagram)
			?? 'none';

	return `${family}|${normalizeQuestionTemplate(question.question)}`;
}

export function questionSemanticFingerprints(question: Pick<GeneratedQuestion, 'question' | 'diagram'>): string[] {
	const family = question.diagram?.graph
		? 'graph'
		: inferGeometryFamily(question.question, question.diagram)
			?? 'none';
	const normalizedQuestion = normalizeExactQuestionText(question.question);
	const fingerprints = new Set<string>();

	if (family === 'standard-position-trig') {
		const points = extractCoordinatePoints(question.question);
		for (const point of points.slice(0, 1)) {
			fingerprints.add(`standard-position-trig|point:${trimValue(point.x)},${trimValue(point.y)}`);
		}
	}

	if (family === 'coordinate-segment') {
		const points = extractCoordinatePoints(question.question)
			.map((point) => `${trimValue(point.x)},${trimValue(point.y)}`)
			.sort();
		if (points.length >= 2) {
			fingerprints.add(`coordinate-segment|points:${points.join(';')}`);
		}
	}

	const strippedFollowUps = normalizedQuestion
		.replace(/\bthen\b.*$/, '')
		.replace(/\balso\b.*$/, '')
		.replace(/\bstate the reference angle\b.*$/, '')
		.trim();
	if (strippedFollowUps !== normalizedQuestion) {
		fingerprints.add(`${family}|primary:${normalizeQuestionTemplate(strippedFollowUps)}`);
	}

	return [...fingerprints];
}

export function questionBriefFingerprint(brief: QuestionBriefOutput): string {
	const base = [
		brief.concept_family,
		brief.skill_focus,
		brief.problem_type,
		brief.diagram_mode,
		brief.diagram_family ?? '',
		brief.task,
		...brief.givens,
		...(brief.constraints ?? []),
		brief.uniqueness_key
	].join(' | ');

	return normalizeQuestionTemplate(base);
}

export function uniqueQuestionBriefs(briefs: QuestionBriefOutput[]): QuestionBriefOutput[] {
	const seen = new Set<string>();
	const unique: QuestionBriefOutput[] = [];
	for (const brief of briefs) {
		const fingerprint = questionBriefFingerprint(brief);
		if (seen.has(fingerprint)) continue;
		seen.add(fingerprint);
		unique.push(brief);
	}
	return unique;
}

export function normalizeQuestionTemplate(text: string): string {
	return text
		.toLowerCase()
		.replace(/\$([^$]+)\$/g, (_match, math) => normalizeMathTemplate(math))
		.replace(/\\left|\\right/g, '')
		.replace(/\\dfrac/g, '\\frac')
		.replace(/\\frac\{[^{}]+\}\{[^{}]+\}/g, 'frac')
		.replace(/\\sqrt\{[^{}]+\}/g, 'sqrt')
		.replace(/\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/g, '(coord)')
		.replace(/\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*[\])]/g, '[range]')
		.replace(/\b\d+(?:\.\d+)?\s*(?:cm|mm|m|in|ft|units?)\b/g, '# measure')
		.replace(/\b-?\d+(?:\.\d+)?°/g, '# deg')
		.replace(/\b-?\d+(?:\.\d+)?\b/g, '#')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeExactQuestionText(text: string): string {
	return text
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeMathTemplate(math: string): string {
	return math
		.toLowerCase()
		.replace(/\\left|\\right/g, '')
		.replace(/\\dfrac/g, '\\frac')
		.replace(/\\frac\{[^{}]+\}\{[^{}]+\}/g, 'frac')
		.replace(/\\sqrt\{[^{}]+\}/g, 'sqrt')
		.replace(/\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/g, '(coord)')
		.replace(/\[\s*-?\d+(?:\.\d+)?(?:\^\\circ|°)?\s*,\s*-?\d+(?:\.\d+)?(?:\^\\circ|°)?\s*[\])]/g, '[range]')
		.replace(/(^|[=+\-(])(?:\d+(?:\.\d+)?)?(?=(?:\\(?:sin|cos|tan)\b|[a-z]))/g, '$1coef')
		.replace(/\b-?\d+(?:\.\d+)?°/g, '# deg')
		.replace(/\b-?\d+(?:\.\d+)?\b/g, '#')
		.replace(/\s+/g, ' ')
		.trim();
}

function extractCoordinatePoints(questionText: string): Array<{ x: number; y: number }> {
	return [...questionText.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)].map((match) => ({
		x: Number(match[1]),
		y: Number(match[2])
	}));
}

function trimValue(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}
