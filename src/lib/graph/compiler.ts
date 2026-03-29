import type { DiagramGraph, GraphExpression, GraphViewport } from '$lib/data/types';

export type GraphFailureCode =
	| 'no-visible-targets'
	| 'question-mismatch'
	| 'useless-viewport'
	| 'unsupported-expression'
	| 'desmos-timeout'
	| 'desmos-empty-render'
	| 'repair-exhausted';

export type GraphRenderStatus = 'ready-svg' | 'ready-desmos' | 'repairing' | 'failed';
export type GraphRelation = '=' | '<=' | '>=' | '<' | '>';
export type GraphEngine = 'svg' | 'desmos';

export interface GraphDiagnostic {
	code: GraphFailureCode;
	message: string;
	expressionId?: string;
}

export interface GraphCompilation {
	plots: CompiledGraphPlot[];
	unsupportedExpressions: GraphExpression[];
	diagnostics: GraphDiagnostic[];
}

export type CompiledGraphPlot =
	| CompiledPointPlot
	| CompiledFunctionPlot
	| CompiledVerticalLinePlot
	| CompiledCirclePlot;

export interface CompiledPointPlot {
	kind: 'point';
	expressionId: string;
	sourceLatex: string;
	color: string;
	x: number;
	y: number;
	open: boolean;
	label?: string;
}

export interface CompiledFunctionPlot {
	kind: 'function';
	expressionId: string;
	sourceLatex: string;
	color: string;
	lineStyle: 'solid' | 'dashed' | 'dotted';
	shape: 'linear' | 'nonlinear';
	relation: GraphRelation;
	label?: string;
	showLabel?: boolean;
	evaluate: (x: number) => number | undefined;
	restriction?: (x: number) => boolean;
	keyPoints: Array<{ x: number; y: number }>;
}

export interface CompiledVerticalLinePlot {
	kind: 'vertical-line';
	expressionId: string;
	sourceLatex: string;
	color: string;
	lineStyle: 'solid' | 'dashed' | 'dotted';
	relation: GraphRelation;
	x: number;
}

export interface CompiledCirclePlot {
	kind: 'circle';
	expressionId: string;
	sourceLatex: string;
	color: string;
	lineStyle: 'solid' | 'dashed' | 'dotted';
	relation: GraphRelation;
	h: number;
	k: number;
	r: number;
}

export interface GraphRenderPlan {
	engine: GraphEngine;
	viewport: GraphViewport;
	viewportSource: 'autofit' | 'advisory' | 'default';
	plots: RenderGraphPlot[];
	visibleTargets: string[];
	diagnostics: GraphDiagnostic[];
}

export type RenderGraphPlot =
	| RenderPointPlot
	| RenderFunctionPlot
	| RenderVerticalLinePlot
	| RenderCirclePlot;

export interface RenderPointPlot {
	kind: 'point';
	expressionId: string;
	color: string;
	x: number;
	y: number;
	open: boolean;
	label?: string;
}

export interface RenderFunctionPlot {
	kind: 'function';
	expressionId: string;
	color: string;
	lineStyle: 'solid' | 'dashed' | 'dotted';
	segments: Array<Array<{ x: number; y: number }>>;
	fillPolygons: Array<Array<{ x: number; y: number }>>;
	label?: string;
	showLabel?: boolean;
	labelPoint?: { x: number; y: number };
}

export interface RenderVerticalLinePlot {
	kind: 'vertical-line';
	expressionId: string;
	color: string;
	lineStyle: 'solid' | 'dashed' | 'dotted';
	x: number;
	fillPolygon?: Array<{ x: number; y: number }>;
}

export interface RenderCirclePlot {
	kind: 'circle';
	expressionId: string;
	color: string;
	lineStyle: 'solid' | 'dashed' | 'dotted';
	h: number;
	k: number;
	r: number;
	fill: 'inside' | 'outside' | 'none';
}

export interface GraphValidationResult {
	ok: boolean;
	engine: GraphEngine;
	diagnostics: GraphDiagnostic[];
}

const DEFAULT_COLOR = '#2563eb';
const DEFAULT_VIEWPORT: GraphViewport = { left: -10, right: 10, bottom: -10, top: 10 };
const DEFAULT_SAMPLE_DOMAIN = { left: -10, right: 10 };

export function compileGraph(graph: DiagramGraph): GraphCompilation {
	const plots: CompiledGraphPlot[] = [];
	const unsupportedExpressions: GraphExpression[] = [];
	const diagnostics: GraphDiagnostic[] = [];

	for (const [index, expression] of graph.expressions.entries()) {
		const parsed = parseExpression(expression, index + 1);
		if (parsed) {
			plots.push(parsed);
		} else {
			unsupportedExpressions.push(expression);
			diagnostics.push({
				code: 'unsupported-expression',
				message: `Unsupported graph expression: ${expression.latex}`,
				expressionId: expression.id ?? `expr-${index + 1}`
			});
		}
	}

	return { plots, unsupportedExpressions, diagnostics };
}

export function compileGraphExpression(latex: string): CompiledGraphPlot | null {
	return parseExpression({ latex }, 1);
}

export function getSafeGraphLabel(label: string | undefined): string | undefined {
	if (!label) return undefined;
	const trimmed = label.trim();
	if (!trimmed) return undefined;
	if (trimmed.length > 24) return undefined;
	if (/[\\{}$]/.test(trimmed)) return undefined;
	if (/[=<>]/.test(trimmed)) return undefined;
	if (trimmed.split(/\s+/).length > 3) return undefined;
	if (/^[A-Za-z]$/.test(trimmed)) return trimmed;
	if (/^\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)$/.test(trimmed)) return trimmed;
	if (/^(x|y)-intercept$/i.test(trimmed)) return trimmed;
	return undefined;
}

export function createGraphRenderPlan(graph: DiagramGraph, compilation: GraphCompilation): GraphRenderPlan {
	const advisory = sanitizeViewport(graph.viewport);
	const viewportDecision = chooseViewport(compilation.plots, advisory);
	const viewport = viewportDecision.viewport;
	const plots = compilation.plots.flatMap((plot) => renderPlot(plot, viewport));
	const visibleTargets = [...new Set(plots.map((plot) => plot.expressionId))];
	const diagnostics = [...compilation.diagnostics];

	if (visibleTargets.length === 0 && compilation.plots.length > 0) {
		diagnostics.push({
			code: 'no-visible-targets',
			message: 'No compiled graph targets are visible inside the selected viewport.'
		});
	}

	const engine: GraphEngine = compilation.unsupportedExpressions.length === 0 ? 'svg' : 'desmos';

	return {
		engine,
		viewport,
		viewportSource: viewportDecision.source,
		plots,
		visibleTargets,
		diagnostics
	};
}

export function validateGraphRenderPlan(
	graph: DiagramGraph,
	compilation: GraphCompilation,
	plan: GraphRenderPlan
): GraphValidationResult {
	const diagnostics = [...plan.diagnostics];
	if (plan.viewportSource === 'advisory' && isUselessViewport(plan.viewport, compilation.plots)) {
		diagnostics.push({
			code: 'useless-viewport',
			message: 'The AI-provided viewport is too large or poorly framed for the plotted content.'
		});
	}

	if (compilation.plots.length > 0 && plan.visibleTargets.length === 0) {
		diagnostics.push({
			code: 'no-visible-targets',
			message: 'No visible graph targets remain after viewport fitting.'
		});
	}

	if (!(graph.viewport.left < graph.viewport.right && graph.viewport.bottom < graph.viewport.top)) {
		diagnostics.push({
			code: 'useless-viewport',
			message: 'The graph viewport is invalid.'
		});
	}

	return {
		ok: diagnostics.filter((item) => item.code !== 'unsupported-expression').length === 0,
		engine: plan.engine,
		diagnostics
	};
}

export function getDesmosViewport(graph: DiagramGraph, plan: GraphRenderPlan): GraphViewport {
	return plan.viewportSource === 'autofit' || plan.viewportSource === 'default'
		? plan.viewport
		: sanitizeViewport(graph.viewport);
}

function parseExpression(expression: GraphExpression, fallbackIndex: number): CompiledGraphPlot | null {
	const id = expression.id ?? `expr-${fallbackIndex}`;
	const latex = normalizeLatex(expression.latex);
	if (!latex) return null;

	const point = parsePoint(expression, id, latex);
	if (point) return point;

	const circle = parseCircle(expression, id, latex);
	if (circle) return circle;

	const vertical = parseVerticalLine(expression, id, latex);
	if (vertical) return vertical;

	const horizontalOrFunction = parseFunctionLike(expression, id, latex);
	if (horizontalOrFunction) return horizontalOrFunction;

	const standardLine = parseStandardLine(expression, id, latex);
	if (standardLine) return standardLine;

	return null;
}

function parsePoint(expression: GraphExpression, id: string, latex: string): CompiledPointPlot | null {
	const match = latex.match(/^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/);
	if (!match) return null;
	return {
		kind: 'point',
		expressionId: id,
		sourceLatex: expression.latex,
		color: expression.color ?? DEFAULT_COLOR,
		x: Number(match[1]),
		y: Number(match[2]),
		open: expression.point_style === 'open',
		label: expression.show_label ? getSafeGraphLabel(expression.label) : undefined
	};
}

function parseVerticalLine(expression: GraphExpression, id: string, latex: string): CompiledVerticalLinePlot | null {
	const relationMatch = latex.match(/^x(<=|>=|<|>|=)(.+)$/);
	if (!relationMatch) return null;
	const x = parseSimpleNumber(relationMatch[2]);
	if (x == null) return null;
	return {
		kind: 'vertical-line',
		expressionId: id,
		sourceLatex: expression.latex,
		color: expression.color ?? DEFAULT_COLOR,
		lineStyle: expression.line_style ?? 'solid',
		relation: relationMatch[1] as GraphRelation,
		x
	};
}

function parseFunctionLike(expression: GraphExpression, id: string, latex: string): CompiledFunctionPlot | null {
	const relationMatch = latex.match(/^(?:y|[A-Za-z][A-Za-z0-9_]*\(x\))(<=|>=|<|>|=)(.+)$/);
	if (!relationMatch) return null;

	const relation = relationMatch[1] as GraphRelation;
	const { body, restriction } = splitRestriction(relationMatch[2]);
	const evaluator = buildEvaluator(body, 'x');
	if (!evaluator) return null;
	const restrictionFn = restriction ? buildRestriction(restriction, 'x') : undefined;
	const keyPoints = deriveKeyPoints(body, evaluator);

	return {
		kind: 'function',
		expressionId: id,
		sourceLatex: expression.latex,
		color: expression.color ?? DEFAULT_COLOR,
		lineStyle: expression.line_style ?? 'solid',
		shape: isLinearExpression(body) ? 'linear' : 'nonlinear',
		relation,
		label: getSafeGraphLabel(expression.label),
		showLabel: expression.show_label,
		evaluate: evaluator,
		restriction: restrictionFn ?? undefined,
		keyPoints
	};
}

function parseStandardLine(expression: GraphExpression, id: string, latex: string): CompiledFunctionPlot | CompiledVerticalLinePlot | null {
	const relationMatch = latex.match(/^(.+?)=(.+)$/);
	if (!relationMatch) return null;

	const left = extractLinearSide(relationMatch[1]);
	const right = extractLinearSide(relationMatch[2]);
	if (!left || !right) return null;
	const a = left.x - right.x;
	const b = left.y - right.y;
	const c = left.constant - right.constant;

	if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) return null;

	if (Math.abs(b) < 1e-9) {
		return {
			kind: 'vertical-line',
			expressionId: id,
			sourceLatex: expression.latex,
			color: expression.color ?? DEFAULT_COLOR,
			lineStyle: expression.line_style ?? 'solid',
			relation: '=',
			x: -c / a
		};
	}

	const evaluator = (x: number) => (-a * x - c) / b;
	const intercept = -c / b;
	const slope = -a / b;
	return {
		kind: 'function',
		expressionId: id,
		sourceLatex: expression.latex,
		color: expression.color ?? DEFAULT_COLOR,
		lineStyle: expression.line_style ?? 'solid',
		shape: 'linear',
		relation: '=',
		label: getSafeGraphLabel(expression.label),
		showLabel: expression.show_label,
		evaluate: (x: number) => evaluator(x),
		keyPoints: [
			{ x: 0, y: intercept },
			{ x: 1, y: slope + intercept }
		]
	};
}

function parseCircle(expression: GraphExpression, id: string, latex: string): CompiledCirclePlot | null {
	const relationMatch = latex.match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
	if (!relationMatch) return null;
	const relation = relationMatch[2] as GraphRelation;
	const left = relationMatch[1];
	const right = relationMatch[3];

	const standard = left.replace(/\s+/g, '');
	const radiusSquared = parseSimpleNumber(right);

	const centered = standard.match(/^\(x([+-]\d+(?:\.\d+)?)\)\^2\+\(y([+-]\d+(?:\.\d+)?)\)\^2$/);
	if (centered && radiusSquared != null && radiusSquared > 0) {
		return {
			kind: 'circle',
			expressionId: id,
			sourceLatex: expression.latex,
			color: expression.color ?? DEFAULT_COLOR,
			lineStyle: expression.line_style ?? 'solid',
			relation,
			h: -Number(centered[1]),
			k: -Number(centered[2]),
			r: Math.sqrt(radiusSquared)
		};
	}

	const origin = standard === 'x^2+y^2' ? 0 : null;
	if (origin != null && radiusSquared != null && radiusSquared > 0) {
		return {
			kind: 'circle',
			expressionId: id,
			sourceLatex: expression.latex,
			color: expression.color ?? DEFAULT_COLOR,
			lineStyle: expression.line_style ?? 'solid',
			relation,
			h: 0,
			k: 0,
			r: Math.sqrt(radiusSquared)
		};
	}

	return null;
}

function chooseViewport(
	plots: CompiledGraphPlot[],
	advisoryViewport: GraphViewport
): { viewport: GraphViewport; source: 'autofit' | 'advisory' | 'default' } {
	if (plots.length === 0) {
		return {
			viewport: sanitizeViewport(advisoryViewport),
			source: isValidViewport(advisoryViewport) ? 'advisory' : 'default'
		};
	}

	const bounds = plots
		.map((plot) => estimatePlotBounds(plot, advisoryViewport))
		.filter((value): value is GraphViewport => value !== null);

	if (bounds.length === 0) {
		return {
			viewport: sanitizeViewport(advisoryViewport),
			source: isValidViewport(advisoryViewport) ? 'advisory' : 'default'
		};
	}

	const merged = bounds.reduce((acc, bound) => ({
		left: Math.min(acc.left, bound.left),
		right: Math.max(acc.right, bound.right),
		bottom: Math.min(acc.bottom, bound.bottom),
		top: Math.max(acc.top, bound.top)
	}));

	const padded = addViewportPadding(merged);
	return { viewport: padded, source: 'autofit' };
}

function renderPlot(plot: CompiledGraphPlot, viewport: GraphViewport): RenderGraphPlot[] {
	switch (plot.kind) {
		case 'point':
			if (!pointVisible(plot.x, plot.y, viewport)) return [];
			return [{
				kind: 'point',
				expressionId: plot.expressionId,
				color: plot.color,
				x: plot.x,
				y: plot.y,
				open: plot.open,
				label: plot.label
			}];
		case 'vertical-line':
			return [renderVerticalLine(plot, viewport)];
		case 'circle':
			if (!circleIntersectsViewport(plot, viewport)) return [];
			return [renderCircle(plot)];
		case 'function': {
			const rendered = renderFunction(plot, viewport);
			return rendered ? [rendered] : [];
		}
	}
}

function renderVerticalLine(plot: CompiledVerticalLinePlot, viewport: GraphViewport): RenderVerticalLinePlot {
	let fillPolygon: Array<{ x: number; y: number }> | undefined;
	if (plot.relation === '<=' || plot.relation === '<') {
		fillPolygon = [
			{ x: viewport.left, y: viewport.bottom },
			{ x: plot.x, y: viewport.bottom },
			{ x: plot.x, y: viewport.top },
			{ x: viewport.left, y: viewport.top }
		];
	} else if (plot.relation === '>=' || plot.relation === '>') {
		fillPolygon = [
			{ x: plot.x, y: viewport.bottom },
			{ x: viewport.right, y: viewport.bottom },
			{ x: viewport.right, y: viewport.top },
			{ x: plot.x, y: viewport.top }
		];
	}

	return {
		kind: 'vertical-line',
		expressionId: plot.expressionId,
		color: plot.color,
		lineStyle: plot.lineStyle,
		x: plot.x,
		fillPolygon
	};
}

function renderCircle(plot: CompiledCirclePlot): RenderCirclePlot {
	let fill: 'inside' | 'outside' | 'none' = 'none';
	if (plot.relation === '<=' || plot.relation === '<') fill = 'inside';
	if (plot.relation === '>=' || plot.relation === '>') fill = 'outside';
	return {
		kind: 'circle',
		expressionId: plot.expressionId,
		color: plot.color,
		lineStyle: plot.lineStyle,
		h: plot.h,
		k: plot.k,
		r: plot.r,
		fill
	};
}

function renderFunction(plot: CompiledFunctionPlot, viewport: GraphViewport): RenderFunctionPlot | null {
	const sampleCount = 220;
	const step = (viewport.right - viewport.left) / sampleCount;
	const segments: Array<Array<{ x: number; y: number }>> = [];
	let current: Array<{ x: number; y: number }> = [];

	for (let i = 0; i <= sampleCount; i++) {
		const x = viewport.left + step * i;
		if (plot.restriction && !plot.restriction(x)) {
			pushSegment();
			continue;
		}

		const y = plot.evaluate(x);
		if (y == null || !Number.isFinite(y)) {
			pushSegment();
			continue;
		}

		const point = { x, y };
		if (Math.abs(y) > (viewport.top - viewport.bottom) * 8) {
			pushSegment();
			continue;
		}

		if (current.length > 0) {
			const prev = current[current.length - 1];
			if (Math.abs(prev.y - point.y) > (viewport.top - viewport.bottom) * 1.75) {
				pushSegment();
			}
		}

		current.push(point);
	}

	pushSegment();

	if (segments.length === 0) return null;

	const fillPolygons: Array<Array<{ x: number; y: number }>> = [];
	if (plot.relation === '<=' || plot.relation === '<' || plot.relation === '>=' || plot.relation === '>') {
		for (const segment of segments) {
			if (segment.length < 2) continue;
			const boundaryY = plot.relation === '<=' || plot.relation === '<' ? viewport.bottom : viewport.top;
			fillPolygons.push([
				...segment,
				{ x: segment[segment.length - 1].x, y: boundaryY },
				{ x: segment[0].x, y: boundaryY }
			]);
		}
	}

	const labelPoint = plot.showLabel ? pickLabelPoint(segments, viewport) : undefined;

	return {
		kind: 'function',
		expressionId: plot.expressionId,
		color: plot.color,
		lineStyle: plot.lineStyle,
		segments,
		fillPolygons,
		label: plot.showLabel ? plot.label : undefined,
		showLabel: plot.showLabel,
		labelPoint
	};

	function pushSegment() {
		if (current.length >= 2) segments.push(current);
		current = [];
	}
}

function estimatePlotBounds(plot: CompiledGraphPlot, advisoryViewport: GraphViewport): GraphViewport | null {
	switch (plot.kind) {
		case 'point':
			return addViewportPadding({
				left: plot.x - 1,
				right: plot.x + 1,
				bottom: plot.y - 1,
				top: plot.y + 1
			}, 0.35);
		case 'vertical-line':
			return addViewportPadding({
				left: plot.x - 4,
				right: plot.x + 4,
				bottom: advisoryViewport.bottom,
				top: advisoryViewport.top
			}, 0.15);
		case 'circle':
			return addViewportPadding({
				left: plot.h - plot.r,
				right: plot.h + plot.r,
				bottom: plot.k - plot.r,
				top: plot.k + plot.r
			}, 0.2);
		case 'function': {
			if (plot.shape === 'linear') {
				return estimateLinearFunctionBounds(plot);
			}
			const advisorySpan = isValidViewport(advisoryViewport) ? advisoryViewport.right - advisoryViewport.left : Infinity;
			const sampleLeft = advisorySpan <= 24 ? advisoryViewport.left : DEFAULT_SAMPLE_DOMAIN.left;
			const sampleRight = advisorySpan <= 24 ? advisoryViewport.right : DEFAULT_SAMPLE_DOMAIN.right;
			const points: Array<{ x: number; y: number }> = [];
			for (const keyPoint of plot.keyPoints) {
				if (Number.isFinite(keyPoint.x) && Number.isFinite(keyPoint.y)) points.push(keyPoint);
			}
			const sampleCount = 140;
			const step = (sampleRight - sampleLeft) / sampleCount;
			for (let i = 0; i <= sampleCount; i++) {
				const x = sampleLeft + step * i;
				if (plot.restriction && !plot.restriction(x)) continue;
				const y = plot.evaluate(x);
				if (y == null || !Number.isFinite(y) || Math.abs(y) > 1e4) continue;
				points.push({ x, y });
			}
			if (points.length === 0) return null;
			return addViewportPadding({
				left: Math.min(...points.map((point) => point.x)),
				right: Math.max(...points.map((point) => point.x)),
				bottom: Math.min(...points.map((point) => point.y)),
				top: Math.max(...points.map((point) => point.y))
			}, 0.18);
		}
	}
}

function estimateLinearFunctionBounds(plot: CompiledFunctionPlot): GraphViewport | null {
	const points = plot.keyPoints
		.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
		.sort((a, b) => Math.abs(a.x) - Math.abs(b.x))
		.filter((point, index, arr) => arr.findIndex((candidate) => approximatelyEqual(candidate.x, point.x)) === index)
		.slice(0, 3)
		.map((point) => ({ ...point }));

	const yIntercept = plot.evaluate(0);
	if (yIntercept != null && Number.isFinite(yIntercept)) {
		points.push({ x: 0, y: yIntercept });
	}

	const xIntercept = deriveXIntercept(plot);
	if (xIntercept != null && Number.isFinite(xIntercept) && Math.abs(xIntercept) <= 40) {
		points.push({ x: xIntercept, y: 0 });
	}

	if (points.length === 0) return null;

	const base = {
		left: Math.min(...points.map((point) => point.x)),
		right: Math.max(...points.map((point) => point.x)),
		bottom: Math.min(...points.map((point) => point.y)),
		top: Math.max(...points.map((point) => point.y))
	};

	const width = Math.max(6, base.right - base.left);
	const height = Math.max(6, base.top - base.bottom);

	return addViewportPadding({
		left: Math.min(base.left, 0) - Math.max(1, width * 0.15),
		right: Math.max(base.right, 0) + Math.max(1, width * 0.15),
		bottom: Math.min(base.bottom, 0) - Math.max(1, height * 0.15),
		top: Math.max(base.top, 0) + Math.max(1, height * 0.15)
	}, 0.12);
}

function deriveXIntercept(plot: CompiledFunctionPlot): number | undefined {
	const first = plot.keyPoints[0];
	const second = plot.keyPoints.find((point) => point.x !== first?.x);
	if (!first || !second) return undefined;
	const slope = (second.y - first.y) / (second.x - first.x);
	if (!Number.isFinite(slope) || Math.abs(slope) < 1e-9) return undefined;
	return first.x - first.y / slope;
}

function pointVisible(x: number, y: number, viewport: GraphViewport): boolean {
	return x >= viewport.left && x <= viewport.right && y >= viewport.bottom && y <= viewport.top;
}

function circleIntersectsViewport(plot: CompiledCirclePlot, viewport: GraphViewport): boolean {
	return !(plot.h + plot.r < viewport.left
		|| plot.h - plot.r > viewport.right
		|| plot.k + plot.r < viewport.bottom
		|| plot.k - plot.r > viewport.top);
}

function isUselessViewport(viewport: GraphViewport, plots: CompiledGraphPlot[]): boolean {
	const spanX = viewport.right - viewport.left;
	const spanY = viewport.top - viewport.bottom;
	if (spanX <= 0 || spanY <= 0) return true;
	if (spanX > 120 || spanY > 120) return true;
	if (plots.length === 0) return false;
	const bounds = plots
		.map((plot) => estimatePlotBounds(plot, viewport))
		.filter((value): value is GraphViewport => value !== null);
	if (bounds.length === 0) return false;
	const merged = bounds.reduce((acc, bound) => ({
		left: Math.min(acc.left, bound.left),
		right: Math.max(acc.right, bound.right),
		bottom: Math.min(acc.bottom, bound.bottom),
		top: Math.max(acc.top, bound.top)
	}));
	return spanX > (merged.right - merged.left) * 4.5 || spanY > (merged.top - merged.bottom) * 4.5;
}

function pickLabelPoint(
	segments: Array<Array<{ x: number; y: number }>>,
	viewport: GraphViewport
): { x: number; y: number } | undefined {
	for (const segment of segments) {
		const midpoint = segment[Math.floor(segment.length / 2)];
		if (!midpoint) continue;
		if (midpoint.x > viewport.left && midpoint.x < viewport.right && midpoint.y > viewport.bottom && midpoint.y < viewport.top) {
			return midpoint;
		}
	}
	return undefined;
}

function sanitizeViewport(viewport: GraphViewport): GraphViewport {
	if (!isValidViewport(viewport)) return { ...DEFAULT_VIEWPORT };
	const left = clamp(viewport.left, -100, 100);
	const right = clamp(viewport.right, -100, 100);
	const bottom = clamp(viewport.bottom, -100, 100);
	const top = clamp(viewport.top, -100, 100);
	if (left >= right || bottom >= top) return { ...DEFAULT_VIEWPORT };
	return { left, right, bottom, top };
}

function isValidViewport(viewport: GraphViewport): boolean {
	return Number.isFinite(viewport.left)
		&& Number.isFinite(viewport.right)
		&& Number.isFinite(viewport.bottom)
		&& Number.isFinite(viewport.top)
		&& viewport.left < viewport.right
		&& viewport.bottom < viewport.top;
}

function addViewportPadding(viewport: GraphViewport, ratio: number = 0.15): GraphViewport {
	const width = Math.max(2, viewport.right - viewport.left);
	const height = Math.max(2, viewport.top - viewport.bottom);
	const padX = Math.max(1, width * ratio);
	const padY = Math.max(1, height * ratio);
	const left = viewport.left - padX;
	const right = viewport.right + padX;
	const bottom = viewport.bottom - padY;
	const top = viewport.top + padY;
	if (left > 0 && right > 0 && left < 2) return { left: -1, right, bottom, top };
	if (left < 0 && right < 0 && right > -2) return { left, right: 1, bottom, top };
	return { left, right, bottom, top };
}

function buildEvaluator(expression: string, variable: 'x' | 'y'): ((value: number) => number | undefined) | null {
	const normalized = toSafeMathExpression(expression);
	if (!normalized) return null;
	try {
		const fn = new Function(variable, `const abs=Math.abs; const sqrt=Math.sqrt; const pi=Math.PI; const e=Math.E; return ${normalized};`) as (value: number) => number;
		return (value: number) => {
			try {
				const result = fn(value);
				return Number.isFinite(result) ? result : undefined;
			} catch {
				return undefined;
			}
		};
	} catch {
		return null;
	}
}

function buildLinearEvaluator(expression: string): ((x: number, y: number) => number | undefined) | null {
	const normalized = toSafeMathExpression(expression);
	if (!normalized) return null;
	try {
		const fn = new Function('x', 'y', `const abs=Math.abs; const sqrt=Math.sqrt; const pi=Math.PI; const e=Math.E; return ${normalized};`) as (x: number, y: number) => number;
		return (x: number, y: number) => {
			try {
				const result = fn(x, y);
				return Number.isFinite(result) ? result : undefined;
			} catch {
				return undefined;
			}
		};
	} catch {
		return null;
	}
}

function buildRestriction(condition: string, variable: 'x' | 'y'): ((value: number) => boolean) | null {
	const compact = normalizeLatex(condition);
	const chained = compact.match(/^(.+?)(<=|<)([xy])(<=|<)(.+)$/);
	if (chained && chained[3] === variable) {
		const leftExpr = toSafeMathExpression(chained[1]);
		const rightExpr = toSafeMathExpression(chained[5]);
		if (!leftExpr || !rightExpr) return null;
		try {
			const fn = new Function(variable, `const abs=Math.abs; const sqrt=Math.sqrt; const pi=Math.PI; const e=Math.E; return (${leftExpr}) ${chained[2]} ${variable} && ${variable} ${chained[4]} (${rightExpr});`) as (value: number) => boolean;
			return (value: number) => Boolean(fn(value));
		} catch {
			return null;
		}
	}

	const simple = compact.match(/^(.+?)(<=|>=|<|>)(.+)$/);
	if (!simple) return null;
	const leftExpr = toSafeMathExpression(simple[1]);
	const rightExpr = toSafeMathExpression(simple[3]);
	if (!leftExpr || !rightExpr) return null;
	try {
		const fn = new Function(variable, `const abs=Math.abs; const sqrt=Math.sqrt; const pi=Math.PI; const e=Math.E; return (${leftExpr}) ${simple[2]} (${rightExpr});`) as (value: number) => boolean;
		return (value: number) => Boolean(fn(value));
	} catch {
		return null;
	}
}

function splitRestriction(expression: string): { body: string; restriction?: string } {
	const match = expression.match(/^(.*)\{(.+)\}$/);
	if (!match) return { body: expression };
	return {
		body: match[1],
		restriction: match[2]
	};
}

function deriveKeyPoints(
	expression: string,
	evaluate: (x: number) => number | undefined
): Array<{ x: number; y: number }> {
	const points: Array<{ x: number; y: number }> = [];
	for (const x of [-10, -5, -2, -1, 0, 1, 2, 5, 10]) {
		const y = evaluate(x);
		if (y != null && Number.isFinite(y) && Math.abs(y) < 1e4) points.push({ x, y });
	}

	const quadratic = expression.match(/^([+-]?\d*(?:\.\d+)?)x\^2([+-]\d*(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?$/);
	if (quadratic) {
		const a = parseCoefficient(quadratic[1]);
		const b = parseCoefficient(quadratic[2]);
		const vertexX = -b / (2 * a);
		const vertexY = evaluate(vertexX);
		if (vertexY != null) points.push({ x: vertexX, y: vertexY });
	}

	return points;
}

function isLinearExpression(expression: string): boolean {
	const normalized = normalizeLatex(expression);
	if (!normalized) return false;
	if (normalized.includes('{')) return false;
	if (normalized.includes('sqrt') || normalized.includes('abs')) return false;
	if (normalized.includes('x^') || normalized.includes('y^')) return false;
	return /^[-+0-9x*/().]+$/.test(normalized);
}

function normalizeLatex(input: string): string {
	let value = input
		.replace(/\$/g, '')
		.replace(/\\left/g, '')
		.replace(/\\right/g, '')
		.replace(/\\dfrac/g, '\\frac')
		.replace(/\\\{/g, '{')
		.replace(/\\\}/g, '}')
		.replace(/\\cdot|\\times/g, '*')
		.replace(/\\leq|\\le/g, '<=')
		.replace(/\\geq|\\ge/g, '>=')
		.replace(/≤/g, '<=')
		.replace(/≥/g, '>=')
		.replace(/\s+/g, '');

	while (/\\frac\{[^{}]+\}\{[^{}]+\}/.test(value)) {
		value = value.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
	}
	while (/\\sqrt\{[^{}]+\}/.test(value)) {
		value = value.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
	}

	value = value.replace(/\\pi/g, 'pi');
	return value;
}

function toSafeMathExpression(expression: string): string | null {
	const normalized = normalizeLatex(expression);
	const absNormalized = replaceAbsoluteBars(normalized);
	const tokens = tokenize(absNormalized);
	if (!tokens) return null;
	const withMultiplication = insertImplicitMultiplication(tokens);
	const joined = withMultiplication.join('').replace(/\^/g, '**');
	if (!/^[0-9+\-*/().,a-zA-Z<>=]*$/.test(joined)) return null;
	const identifiers = joined.match(/[A-Za-z_]+/g) ?? [];
	for (const identifier of identifiers) {
		if (!['x', 'y', 'abs', 'sqrt', 'pi', 'e'].includes(identifier)) {
			return null;
		}
	}
	return joined;
}

function replaceAbsoluteBars(expression: string): string {
	let value = expression;
	let safety = 0;
	while (/\|[^|]+\|/.test(value) && safety < 10) {
		value = value.replace(/\|([^|]+)\|/g, 'abs($1)');
		safety += 1;
	}
	return value;
}

function tokenize(expression: string): string[] | null {
	const tokens: string[] = [];
	let index = 0;

	while (index < expression.length) {
		const char = expression[index];
		if (/\d|\./.test(char)) {
			let end = index + 1;
			while (end < expression.length && /[\d.]/.test(expression[end])) end += 1;
			tokens.push(expression.slice(index, end));
			index = end;
			continue;
		}

		if (/[A-Za-z]/.test(char)) {
			let end = index + 1;
			while (end < expression.length && /[A-Za-z]/.test(expression[end])) end += 1;
			tokens.push(expression.slice(index, end));
			index = end;
			continue;
		}

		if ('+-*/^(),'.includes(char)) {
			tokens.push(char);
			index += 1;
			continue;
		}

		return null;
	}

	return tokens;
}

function insertImplicitMultiplication(tokens: string[]): string[] {
	const result: string[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const previous = result[result.length - 1];
		if (previous && needsImplicitMultiplication(previous, token)) {
			result.push('*');
		}
		result.push(token);
	}
	return result;
}

function needsImplicitMultiplication(previous: string, next: string): boolean {
	const prevIsValue = isValueToken(previous) || previous === ')';
	const nextIsValue = isValueToken(next) || next === '(';
	if (!prevIsValue || !nextIsValue) return false;
	if (isFunctionToken(previous) && next === '(') return false;
	return true;
}

function isValueToken(token: string): boolean {
	return /^\d/.test(token) || ['x', 'y', 'pi', 'e', 'abs', 'sqrt'].includes(token);
}

function isFunctionToken(token: string): boolean {
	return token === 'abs' || token === 'sqrt';
}

function extractLinearSide(side: string): { x: number; y: number; constant: number } | null {
	const evaluate = buildLinearEvaluator(side);
	if (!evaluate) return null;

	const constant = evaluate(0, 0);
	const xAt1 = evaluate(1, 0);
	const yAt1 = evaluate(0, 1);
	const xyAt1 = evaluate(1, 1);
	const xAt2 = evaluate(2, 0);
	const yAt2 = evaluate(0, 2);

	if ([constant, xAt1, yAt1, xyAt1, xAt2, yAt2].some((value) => value == null)) return null;

	const x = xAt1! - constant!;
	const y = yAt1! - constant!;
	if (!approximatelyEqual(xyAt1!, constant! + x + y)) return null;
	if (!approximatelyEqual(xAt2!, constant! + x * 2)) return null;
	if (!approximatelyEqual(yAt2!, constant! + y * 2)) return null;

	return { x, y, constant: constant! };
}

function parseCoefficient(value: string): number {
	if (value === '' || value === '+') return 1;
	if (value === '-') return -1;
	return Number(value);
}

function parseSimpleNumber(value: string): number | null {
	const safe = toSafeMathExpression(value);
	if (!safe) return null;
	try {
		const fn = new Function(`const abs=Math.abs; const sqrt=Math.sqrt; const pi=Math.PI; const e=Math.E; return ${safe};`) as () => number;
		const result = fn();
		return Number.isFinite(result) ? result : null;
	} catch {
		return null;
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function approximatelyEqual(a: number, b: number, epsilon: number = 1e-6): boolean {
	return Math.abs(a - b) <= epsilon;
}
