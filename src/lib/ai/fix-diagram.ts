import type { GeneratedQuestion, DiagramElement, DiagramSceneGraph, DiagramGraph } from '$lib/data/types';
import { buildTeacherGradeGeometryDiagram, validateGeometryDiagram } from '$lib/geometry/compiler';
import { normalizeDiagram } from './normalize-diagram';

/**
 * Post-process a generated question conservatively:
 * - normalize typed-array diagrams into the flat runtime shape
 * - fill in obvious missing point labels for 2D geometry
 * - add polygon boundary segments when they are implied by the vertices
 * - apply exact measurement labels that are explicitly stated in the prompt text
 * - add rectangle right-angle markers when the shape is unambiguously axis-aligned
 *
 * It intentionally avoids "creative" graph reconstruction because that was
 * producing mathematically wrong diagrams.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fixDiagram(q: any): GeneratedQuestion {
	const { diagram_intent: rawIntent, ...rest } = q as Record<string, unknown>;
	const restQuestion = rest as unknown as GeneratedQuestion;
	if (!rest.has_diagram) return restQuestion;

	const rawValue = parseRawDiagram(rest.diagram);
	const rawDiagram = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
		? rawValue as Record<string, unknown>
		: undefined;
	const text = typeof rest.question === 'string' ? rest.question : '';

	const compiledGeometry = buildTeacherGradeGeometryDiagram(text, rawIntent, rawDiagram);
	if (compiledGeometry) {
		return {
			...restQuestion,
			diagram: compiledGeometry.diagram
		};
	}

	if (!rawDiagram) {
		return { ...restQuestion, has_diagram: false, diagram: undefined } as GeneratedQuestion;
	}

	const diagram = Array.isArray(rawDiagram.elements)
		? sanitizeFlatDiagram(rawDiagram as unknown as DiagramSceneGraph)
		: normalizeDiagram(rawDiagram);

	if (!diagram) {
		return { ...restQuestion, has_diagram: false, diagram: undefined } as GeneratedQuestion;
	}

	const elements = [...diagram.elements.map((e) => ({ ...e }))];
	const pointMap = buildPointMap(elements);
	const isGraphDiagram = Boolean(diagram.graph);

	for (const el of elements) {
		if (el.type !== 'point' || el.x == null || el.y == null) continue;
		if (!isGraphDiagram) {
			if (!el.label && el.id) el.label = el.id;
			if (!el.label_position) {
				el.label_position = inferLabelPosition(el.x, el.y, pointMap);
			}
		} else if (el.label && /^[A-Z]$/.test(el.label)) {
			el.label = undefined;
		}
	}

	for (let i = elements.length - 1; i >= 0; i--) {
		if (elements[i].type === 'point' && (elements[i].x == null || elements[i].y == null)) {
			elements.splice(i, 1);
		}
	}

	if (!isGraphDiagram) {
		ensurePolygonSegments(elements, pointMap);
		applyExactSegmentMeasurements(elements, text);
		ensureRectangleHints(elements, pointMap, text);
		ensureAngleMarkers(elements, pointMap, text);
	} else {
		sanitizeLegacyGraphElements(elements);
	}

	const sanitizedDiagram = {
		width: safeDimension(diagram.width, 10),
		height: safeDimension(diagram.height, 8),
		elements,
		graph: sanitizeGraph(diagram.graph)
	};

	if (!isGraphDiagram) {
		const geometryIssues = validateGeometryDiagram(text, sanitizedDiagram).diagnostics;
		if (geometryIssues.length > 0) {
			return { ...restQuestion, has_diagram: false, diagram: undefined } as GeneratedQuestion;
		}
	}

	return {
		...restQuestion,
		diagram: sanitizedDiagram
	};
}

function parseRawDiagram(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function sanitizeFlatDiagram(diagram: DiagramSceneGraph): DiagramSceneGraph {
	return {
		width: safeDimension(diagram.width, 10),
		height: safeDimension(diagram.height, 8),
		elements: Array.isArray(diagram.elements) ? diagram.elements : [],
		graph: sanitizeGraph(diagram.graph)
	};
}

function sanitizeGraph(graph: DiagramGraph | undefined): DiagramGraph | undefined {
	if (!graph) return undefined;
	const { left, right, bottom, top } = graph.viewport;
	if (!(left < right && bottom < top)) return undefined;

	const expressions = graph.expressions
		.filter((expr) => typeof expr.latex === 'string' && expr.latex.trim().length > 0)
		.map((expr, index) => ({
			...expr,
			id: expr.id || `expr-${index + 1}`,
			latex: expr.latex.trim(),
			fill_opacity: expr.fill_opacity == null ? undefined : clamp(expr.fill_opacity, 0, 1)
		}))
		.filter((expr, index, arr) => {
			const signature = normalizeExpression(expr.latex);
			return arr.findIndex((candidate) => normalizeExpression(candidate.latex) === signature) === index;
		});

	if (expressions.length === 0) return undefined;

	return {
		...graph,
		viewport: { left, right, bottom, top },
		expressions
	};
}

function buildPointMap(elements: DiagramElement[]): Map<string, { x: number; y: number }> {
	const pointMap = new Map<string, { x: number; y: number }>();
	for (const el of elements) {
		if (el.type === 'point' && el.id && el.x != null && el.y != null) {
			pointMap.set(el.id, { x: el.x, y: el.y });
		}
	}
	return pointMap;
}

function inferLabelPosition(
	x: number,
	y: number,
	pointMap: Map<string, { x: number; y: number }>
): string {
	const pts = [...pointMap.values()];
	if (pts.length === 0) return 'top';
	const cx = pts.reduce((sum, point) => sum + point.x, 0) / pts.length;
	const cy = pts.reduce((sum, point) => sum + point.y, 0) / pts.length;
	const dx = x - cx;
	const dy = y - cy;
	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);

	if (absDx > absDy * 2) return dx < 0 ? 'left' : 'right';
	if (absDy > absDx * 2) return dy < 0 ? 'top' : 'bottom';
	if (dx < 0 && dy < 0) return 'top-left';
	if (dx > 0 && dy < 0) return 'top-right';
	if (dx < 0 && dy > 0) return 'bottom-left';
	if (dx > 0 && dy > 0) return 'bottom-right';
	return 'top';
}

function ensurePolygonSegments(
	elements: DiagramElement[],
	pointMap: Map<string, { x: number; y: number }>
): void {
	const existingSegments = new Set(
		elements
			.filter((e) => e.type === 'segment' && e.from && e.to)
			.map((e) => canonicalSegmentKey(e.from!, e.to!))
	);

	for (const el of elements) {
		if (el.type !== 'polygon' || !el.vertices || el.vertices.length < 3) continue;
		for (let i = 0; i < el.vertices.length; i++) {
			const from = el.vertices[i];
			const to = el.vertices[(i + 1) % el.vertices.length];
			if (!pointMap.has(from) || !pointMap.has(to)) continue;
			const key = canonicalSegmentKey(from, to);
			if (existingSegments.has(key)) continue;
			elements.push({ type: 'segment', from, to });
			existingSegments.add(key);
		}
	}
}

function applyExactSegmentMeasurements(elements: DiagramElement[], text: string): void {
	const measurements = extractMeasurements(text);
	if (measurements.length === 0) return;
	for (const el of elements) {
		if (el.type !== 'segment' || el.label || !el.from || !el.to) continue;
		const match = measurements.find((m) => {
			const key = canonicalSegmentKey(el.from!, el.to!);
			return key === canonicalSegmentKey(m.from, m.to);
		});
		if (match) el.label = match.value;
	}
}

function ensureRectangleHints(
	elements: DiagramElement[],
	pointMap: Map<string, { x: number; y: number }>,
	text: string
): void {
	const rectangle = findAxisAlignedRectangle(elements, pointMap);
	if (!rectangle) return;

	const rightAngleKeys = new Set(
		elements
			.filter((e) => e.type === 'right_angle' && e.vertex && e.ray1_through && e.ray2_through)
			.map((e) => `${e.vertex}:${canonicalSegmentKey(e.ray1_through!, e.ray2_through!)}`)
	);

	for (let i = 0; i < rectangle.length; i++) {
		const vertex = rectangle[i];
		const prev = rectangle[(i - 1 + rectangle.length) % rectangle.length];
		const next = rectangle[(i + 1) % rectangle.length];
		const key = `${vertex}:${canonicalSegmentKey(prev, next)}`;
		if (rightAngleKeys.has(key)) continue;
		elements.push({ type: 'right_angle', vertex, ray1_through: prev, ray2_through: next, size: 0.35 });
		rightAngleKeys.add(key);
	}

	const widthLabel = text.match(/width\s*(?:of|is|=|:)?\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?)?)/i)?.[1]?.trim()
		|| text.match(/length\s*(?:of|is|=|:)?\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?)?)/i)?.[1]?.trim();
	const heightLabel = text.match(/height\s*(?:of|is|=|:)?\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?)?)/i)?.[1]?.trim();
	if (!widthLabel && !heightLabel) return;

	for (const el of elements) {
		if (el.type !== 'segment' || el.label || !el.from || !el.to) continue;
		const a = pointMap.get(el.from);
		const b = pointMap.get(el.to);
		if (!a || !b) continue;
		if (approximatelyEqual(a.y, b.y) && widthLabel) {
			el.label = widthLabel;
		} else if (approximatelyEqual(a.x, b.x) && heightLabel) {
			el.label = heightLabel;
		}
	}
}

function ensureAngleMarkers(
	elements: DiagramElement[],
	pointMap: Map<string, { x: number; y: number }>,
	text: string
): void {
	const angleRefs = extractAngleReferences(text);
	if (angleRefs.length === 0) return;

	const existingAngleKeys = new Set(
		elements
			.filter((e) => (e.type === 'angle_arc' || e.type === 'right_angle') && e.vertex && e.ray1_through && e.ray2_through)
			.map((e) => angleKey(e.vertex!, e.ray1_through!, e.ray2_through!))
	);

	for (const ref of angleRefs) {
		if (!pointMap.has(ref.vertex)) continue;
		let ray1 = ref.ray1;
		let ray2 = ref.ray2;

		if (!(ray1 && ray2 && pointMap.has(ray1) && pointMap.has(ray2))) {
			const neighbors = findNeighbors(ref.vertex, elements).filter((neighbor) => pointMap.has(neighbor));
			if (neighbors.length < 2) continue;
			[ray1, ray2] = neighbors.slice(0, 2);
		}

		if (!ray1 || !ray2) continue;
		const key = angleKey(ref.vertex, ray1, ray2);
		if (existingAngleKeys.has(key)) continue;

		elements.push({
			type: 'angle_arc',
			vertex: ref.vertex,
			ray1_through: ray1,
			ray2_through: ray2,
			label: ref.label,
			radius: 0.7
		});
		existingAngleKeys.add(key);
	}
}

function sanitizeLegacyGraphElements(elements: DiagramElement[]): void {
	for (const el of elements) {
		if ((el.type === 'axes' || el.type === 'number_line') && (!el.tick_interval || el.tick_interval <= 0)) {
			el.tick_interval = 1;
		}
	}
}

interface SegmentMeasurement {
	from: string;
	to: string;
	value: string;
}

function extractMeasurements(text: string): SegmentMeasurement[] {
	const cleaned = text.replace(/\$/g, '');
	const measurements: SegmentMeasurement[] = [];

	for (const match of cleaned.matchAll(/([A-Z]{2})\s*=\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?)?)/gi)) {
		const pair = match[1].toUpperCase();
		measurements.push({ from: pair[0], to: pair[1], value: match[2].trim() });
	}

	return measurements;
}

interface AngleRef {
	vertex: string;
	ray1?: string;
	ray2?: string;
	label: string;
}

function extractAngleReferences(text: string): AngleRef[] {
	const cleaned = text.replace(/\$/g, '');
	const refs: AngleRef[] = [];
	for (const match of cleaned.matchAll(/(?:∠|\\angle\s*|angle\s+)([A-Z](?:[A-Z]{2})?)\s*=\s*([\d.]+)°?/gi)) {
		const letters = match[1].toUpperCase();
		if (letters.length === 3) {
			refs.push({ vertex: letters[1], ray1: letters[0], ray2: letters[2], label: `${match[2]}°` });
		} else {
			refs.push({ vertex: letters[0], label: `${match[2]}°` });
		}
	}
	return refs;
}

function findAxisAlignedRectangle(
	elements: DiagramElement[],
	pointMap: Map<string, { x: number; y: number }>
): string[] | null {
	for (const el of elements) {
		if (el.type !== 'polygon' || !el.vertices || el.vertices.length !== 4) continue;
		const vertices = el.vertices;
		const points = vertices.map((vertex) => pointMap.get(vertex));
		if (points.some((point) => !point)) continue;
		const coords = points as { x: number; y: number }[];
		const orthogonal = coords.every((point, index) => {
			const next = coords[(index + 1) % coords.length];
			return approximatelyEqual(point.x, next.x) || approximatelyEqual(point.y, next.y);
		});
		if (!orthogonal) continue;
		return vertices;
	}
	return null;
}

function findNeighbors(pointId: string, elements: DiagramElement[]): string[] {
	const neighbors = new Set<string>();
	for (const el of elements) {
		if (el.type === 'segment') {
			if (el.from === pointId && el.to) neighbors.add(el.to);
			if (el.to === pointId && el.from) neighbors.add(el.from);
		}
		if (el.type === 'polygon' && el.vertices) {
			const index = el.vertices.indexOf(pointId);
			if (index < 0) continue;
			neighbors.add(el.vertices[(index - 1 + el.vertices.length) % el.vertices.length]);
			neighbors.add(el.vertices[(index + 1) % el.vertices.length]);
		}
	}
	return [...neighbors];
}

function canonicalSegmentKey(a: string, b: string): string {
	return [a, b].sort().join('-');
}

function angleKey(vertex: string, ray1: string, ray2: string): string {
	return `${vertex}:${canonicalSegmentKey(ray1, ray2)}`;
}

function safeDimension(value: number, fallback: number): number {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function approximatelyEqual(a: number, b: number, epsilon: number = 1e-3): boolean {
	return Math.abs(a - b) <= epsilon;
}

function normalizeExpression(value: string): string {
	return value.replace(/\s+/g, '').replace(/\$/g, '').toLowerCase();
}
