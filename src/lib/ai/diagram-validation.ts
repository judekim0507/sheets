import type { DiagramElement, DiagramGraph, GeneratedQuestion } from '$lib/data/types';
import { inferGeometryFamily, validateGeometryDiagram } from '$lib/geometry/compiler';
import {
	compileGraph,
	compileGraphExpression,
	createGraphRenderPlan,
	validateGraphRenderPlan
} from '$lib/graph/compiler';

export interface DiagramIssue {
	code: string;
	message: string;
}

const VISUAL_KEYWORDS = /\b(graph|plot|coordinate plane|coordinate grid|number line|diagram|figure|shown below|triangle|quadrilateral|rectangle|square|circle|sector|angle|polygon|prism|cylinder|cone|sphere|pyramid|shaded region|surface area|volume|perimeter|area)\b/i;
const GRAPH_KEYWORDS = /\b(graph|plot|coordinate plane|coordinate grid|function|parabola|line|linear|quadratic|vertex|intercept|slope|inequality|system of equations|circle|on the axes)\b/i;

export function findDiagramIssues(question: Pick<GeneratedQuestion, 'question' | 'has_diagram' | 'diagram'>): DiagramIssue[] {
	const issues: DiagramIssue[] = [];
	const text = question.question ?? '';

	if (!question.has_diagram || !question.diagram) {
		if (VISUAL_KEYWORDS.test(text) || extractExpectedGraphTargets(text).length > 0) {
			issues.push({
				code: 'missing-diagram',
				message: 'The question text requires a diagram, but no usable diagram payload is present.'
			});
		}
		return issues;
	}

	const { diagram } = question;
	if (diagram.graph) {
		issues.push(...findGraphIssues(text, diagram.graph));
	}

	issues.push(...findShapeIssues(text, question.diagram.elements, Boolean(diagram.graph), question.diagram));
	return issues;
}

function findGraphIssues(text: string, graph: DiagramGraph): DiagramIssue[] {
	const issues: DiagramIssue[] = [];
	const compilation = compileGraph(graph);
	const plan = createGraphRenderPlan(graph, compilation);
	const validation = validateGraphRenderPlan(graph, compilation, plan);
	const { left, right, bottom, top } = graph.viewport;
	if (!(left < right && bottom < top)) {
		issues.push({
			code: 'graph-viewport',
			message: 'The graph viewport bounds are invalid.'
		});
	}

	if (!graph.expressions.length) {
		issues.push({
			code: 'graph-empty',
			message: 'The graph has no expressions to plot.'
		});
		return issues;
	}

	for (const diagnostic of validation.diagnostics) {
		if (diagnostic.code === 'unsupported-expression') continue;
		issues.push({
			code: diagnostic.code,
			message: diagnostic.message
		});
	}

	const expectedTargets = extractExpectedGraphTargets(text);
	if (expectedTargets.length > 0) {
		const missingTargets = expectedTargets.filter((target) => !graph.expressions.some((expr) => graphExpressionMatchesTarget(expr.latex, target.raw)));
		if (missingTargets.length > 0) {
			issues.push({
				code: 'graph-mismatch',
				message: `The graph does not plot the relation(s) referenced in the question: ${missingTargets.map((target) => target.raw).join(', ')}.`
			});
		}
	}

	const expectedPoints = extractExpectedPoints(text);
	if (expectedPoints.length > 0) {
		const actualPoints = new Set(
			graph.expressions
				.map((expr) => normalizePoint(expr.latex))
				.filter((point): point is string => Boolean(point))
		);
		const missingPoints = expectedPoints.filter((point) => !actualPoints.has(point));
		if (missingPoints.length > 0) {
			issues.push({
				code: 'graph-point-mismatch',
				message: `The graph is missing referenced coordinate point(s): ${missingPoints.join(', ')}.`
			});
		}
	}

	return issues;
}

function findShapeIssues(
	text: string,
	elements: DiagramElement[],
	hasGraph: boolean,
	diagram: Pick<GeneratedQuestion, 'diagram'>['diagram']
): DiagramIssue[] {
	const issues: DiagramIssue[] = [];
	const lower = text.toLowerCase();
	const shapeTypes = new Set(elements.map((element) => element.type));

	if (!hasGraph && diagram) {
		const geometryValidation = validateGeometryDiagram(text, diagram);
		for (const diagnostic of geometryValidation.diagnostics) {
			issues.push({
				code: diagnostic.code,
				message: diagnostic.message
			});
		}
	}

	if (!hasGraph && /\bcircle\b/i.test(text) && !hasAny(elements, ['circle', 'sector', 'arc'])) {
		issues.push({
			code: 'missing-circle',
			message: 'The question references a circle, but the diagram has no circle or circle sector.'
		});
	}

	if (/\b(rectangular prism|prism|box|cuboid)\b/i.test(text) && !shapeTypes.has('rectangular_prism')) {
		issues.push({
			code: 'missing-rectangular-prism',
			message: 'The question references a rectangular prism/box, but the matching 3D shape is missing.'
		});
	}

	if (/\bcylinder\b/i.test(text) && !shapeTypes.has('cylinder')) {
		issues.push({
			code: 'missing-cylinder',
			message: 'The question references a cylinder, but the diagram has no cylinder.'
		});
	}

	if (/\bcone\b/i.test(text) && !shapeTypes.has('cone')) {
		issues.push({
			code: 'missing-cone',
			message: 'The question references a cone, but the diagram has no cone.'
		});
	}

	if (/\bsphere\b/i.test(text) && !shapeTypes.has('sphere')) {
		issues.push({
			code: 'missing-sphere',
			message: 'The question references a sphere, but the diagram has no sphere.'
		});
	}

	if (/\bpyramid\b/i.test(text) && !shapeTypes.has('pyramid')) {
		issues.push({
			code: 'missing-pyramid',
			message: 'The question references a pyramid, but the diagram has no pyramid.'
		});
	}

	if (/\b(shaded|colored|colour(ed)?|highlighted)\b/i.test(text) && !hasFilledRegion(elements)) {
		issues.push({
			code: 'missing-shading',
			message: 'The question describes a shaded or colored region, but the diagram has no filled region.'
		});
	}

	for (const color of ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'gray', 'grey', 'black']) {
		if (new RegExp(`\\b${color}\\b`, 'i').test(lower) && !hasColor(elements, color)) {
			issues.push({
				code: `missing-${color}-fill`,
				message: `The question references a ${color} diagram region, but that color is not encoded in the diagram.`
			});
		}
	}

	if (!hasGraph && inferGeometryFamily(text) && !diagramSupportsReasoning(text, elements)) {
		issues.push({
			code: 'render-readability-failure',
			message: 'The diagram exists, but it does not provide enough instructional structure to support the question.'
		});
	}

	return issues;
}

function diagramSupportsReasoning(text: string, elements: DiagramElement[]): boolean {
	if (/terminal arm|standard position/i.test(text)) {
		return elements.some((element) => element.type === 'axes')
			&& elements.some((element) => element.type === 'right_angle')
			&& elements.some((element) => element.type === 'ray');
	}
	if (/cast rule|interval\s*\[\s*0/i.test(text)) {
		return elements.some((element) => element.type === 'circle')
			&& elements.some((element) => element.type === 'line')
			&& elements.some((element) => element.type === 'label' && /qii|qiv|qi|qiii/i.test(element.text ?? ''));
	}
	return true;
}

function hasAny(elements: DiagramElement[], types: string[]): boolean {
	return elements.some((element) => types.includes(element.type));
}

function hasFilledRegion(elements: DiagramElement[]): boolean {
	return elements.some((element) => {
		if (!element.fill || /^(none|transparent)$/i.test(element.fill)) return false;
		if (element.fill_opacity != null && element.fill_opacity <= 0) return false;
		return ['polygon', 'circle', 'sector'].includes(element.type);
	});
}

function hasColor(elements: DiagramElement[], color: string): boolean {
	return elements.some((element) => {
		const values = [element.fill, element.stroke].filter((value): value is string => typeof value === 'string');
		return values.some((value) => colorMatches(value, color));
	});
}

interface ExpectedTarget {
	raw: string;
	normalized: string;
}

function extractExpectedGraphTargets(text: string): ExpectedTarget[] {
	const targets = new Map<string, ExpectedTarget>();
	const snippets = [...extractInlineMath(text), ...extractPlainGraphRelations(text)];

	for (const snippet of snippets) {
		if (!GRAPH_KEYWORDS.test(text) && !/[xy]/i.test(snippet)) continue;
		if (!isGraphTargetSnippet(snippet)) continue;
		const normalized = normalizeMath(snippet);
		if (!normalized || !/[xy]/i.test(normalized) || !/[=<>]/.test(normalized)) continue;
		targets.set(normalized, { raw: snippet.trim(), normalized });
	}

	return [...targets.values()];
}

function extractInlineMath(text: string): string[] {
	return [...text.matchAll(/\$([^$]+)\$/g)].map((match) => match[1]);
}

function extractPlainGraphRelations(text: string): string[] {
	return [...text.matchAll(/\b(?:y|x|[A-Za-z][A-Za-z0-9_]*\(x\))\s*(?:=|<=|>=|<|>|≤|≥)\s*[^,.;:\n$]+/g)].map((match) => match[0]);
}

function extractExpectedPoints(text: string): string[] {
	const points = new Set<string>();
	for (const match of text.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
		points.add(`(${trimNumber(match[1])},${trimNumber(match[2])})`);
	}
	return [...points];
}

function normalizePoint(latex: string): string | undefined {
	const match = latex.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
	if (!match) return undefined;
	return `(${trimNumber(match[1])},${trimNumber(match[2])})`;
}

function normalizeMath(value: string): string {
	return value
		.replace(/\$/g, '')
		.replace(/\\left|\\right/g, '')
		.replace(/\\dfrac/g, '\\frac')
		.replace(/[A-Za-z][A-Za-z0-9_]*\(x\)/g, 'y')
		.replace(/\\leq|\\le/g, '<=')
		.replace(/\\geq|\\ge/g, '>=')
		.replace(/≤/g, '<=')
		.replace(/≥/g, '>=')
		.replace(/\s+/g, '')
		.replace(/[{}]/g, '')
		.trim()
		.toLowerCase();
}

function trimNumber(value: string): string {
	return String(Number(value));
}

function isGraphTargetSnippet(snippet: string): boolean {
	const trimmed = snippet.trim();
	if (!/[=<>]/.test(trimmed)) return false;
	if (/^[A-Z]\s*x\s*[+-]\s*[A-Z]\s*y\s*=\s*[A-Z]$/i.test(trimmed)) return false;
	if (/^y\s*=\s*m\s*x\s*[+-]\s*b$/i.test(trimmed)) return false;
	if (/^y\s*-\s*y_?1\s*=\s*m\s*\(x\s*-\s*x_?1\)$/i.test(trimmed)) return false;
	if (/^ax\^?2\s*\+\s*bx\s*\+\s*c\s*=\s*0$/i.test(trimmed)) return false;
	if (/^[A-Z]+\s*[+-]?\s*[A-Z]*[xy]/.test(trimmed) && !/^[A-Za-z][A-Za-z0-9_]*\(x\)/.test(trimmed)) {
		const uppercasePlaceholders = (trimmed.match(/[A-Z]/g) ?? []).filter((char) => char !== 'X' && char !== 'Y');
		if (uppercasePlaceholders.length >= 2) return false;
	}
	return true;
}

function graphExpressionMatchesTarget(actualLatex: string, targetLatex: string): boolean {
	const actualPlot = compileGraphExpression(actualLatex);
	const targetPlot = compileGraphExpression(targetLatex);

	if (actualPlot && targetPlot) {
		return plotsMatch(actualPlot, targetPlot);
	}

	const normalizedActual = normalizeMath(actualLatex);
	const normalizedTarget = normalizeMath(targetLatex);
	return normalizedActual === normalizedTarget || normalizedActual.includes(normalizedTarget);
}

function plotsMatch(
	actual: ReturnType<typeof compileGraphExpression>,
	target: ReturnType<typeof compileGraphExpression>
): boolean {
	if (!actual || !target || actual.kind !== target.kind) return false;

	if (actual.kind === 'point' && target.kind === 'point') {
		return approximatelyEqual(actual.x, target.x) && approximatelyEqual(actual.y, target.y);
	}

	if (actual.kind === 'vertical-line' && target.kind === 'vertical-line') {
		return actual.relation === target.relation && approximatelyEqual(actual.x, target.x);
	}

	if (actual.kind === 'circle' && target.kind === 'circle') {
		return actual.relation === target.relation
			&& approximatelyEqual(actual.h, target.h)
			&& approximatelyEqual(actual.k, target.k)
			&& approximatelyEqual(actual.r, target.r);
	}

	if (actual.kind === 'function' && target.kind === 'function') {
		if (actual.relation !== target.relation) return false;
		let compared = 0;
		for (const x of [-4, -2, -1, 0, 1, 2, 4]) {
			const actualAllowed = actual.restriction ? actual.restriction(x) : true;
			const targetAllowed = target.restriction ? target.restriction(x) : true;
			if (actualAllowed !== targetAllowed) return false;
			if (!actualAllowed || !targetAllowed) continue;
			const actualY = actual.evaluate(x);
			const targetY = target.evaluate(x);
			if (actualY == null || targetY == null) return false;
			if (!approximatelyEqual(actualY, targetY, 1e-4)) return false;
			compared += 1;
		}
		return compared > 0;
	}

	return false;
}

function approximatelyEqual(a: number, b: number, epsilon: number = 1e-6): boolean {
	return Math.abs(a - b) <= epsilon;
}

function colorMatches(value: string, target: string): boolean {
	const normalized = value.toLowerCase();
	if (normalized.includes(target)) return true;
	const rgb = parseColor(normalized);
	if (!rgb) return false;
	const [r, g, b] = rgb;

	switch (target) {
		case 'red':
			return r > 150 && r > g + 30 && r > b + 30;
		case 'green':
			return g > 110 && g >= r && g >= b;
		case 'blue':
			return b > 110 && b >= r && b >= g;
		case 'yellow':
			return r > 150 && g > 150 && b < 120;
		case 'orange':
			return r > 180 && g > 90 && g < r && b < 120;
		case 'purple':
			return r > 100 && b > 100 && g < Math.min(r, b);
		case 'gray':
		case 'grey':
			return Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
		case 'black':
			return r < 40 && g < 40 && b < 40;
		default:
			return false;
	}
}

function parseColor(value: string): [number, number, number] | null {
	const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		const raw = hex[1];
		const expanded = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
		return [
			parseInt(expanded.slice(0, 2), 16),
			parseInt(expanded.slice(2, 4), 16),
			parseInt(expanded.slice(4, 6), 16)
		];
	}

	const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
	if (rgb) {
		return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
	}

	return null;
}
