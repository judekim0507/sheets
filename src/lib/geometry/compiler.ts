import type { DiagramElement, DiagramSceneGraph } from '$lib/data/types';

export type GeometryFamily =
	| 'standard-position-trig'
	| 'cast-circle'
	| 'coordinate-segment'
	| 'polygon-measurement'
	| 'circle-geometry'
	| 'three-d-solid'
	| 'number-line'
	| 'parallel-lines';

export type DiagramFailureCode =
	| 'unsupported-geometry-family'
	| 'semantic-mismatch'
	| 'missing-construction'
	| 'bad-scale'
	| 'layout-collision'
	| 'render-readability-failure'
	| 'invalid-intent';

export interface GeometryDiagnostic {
	code: DiagramFailureCode;
	message: string;
}

export interface GeometryValidationResult {
	family?: GeometryFamily;
	diagnostics: GeometryDiagnostic[];
}

interface BaseIntent {
	family: GeometryFamily;
}

export interface StandardPositionTrigIntent extends BaseIntent {
	family: 'standard-position-trig';
	point: { x: number; y: number };
	pointLabel?: string;
	footLabel?: string;
	originLabel?: string;
	angleLabel?: string;
}

export interface CastCircleIntent extends BaseIntent {
	family: 'cast-circle';
	trigFunction?: 'sin' | 'cos' | 'tan';
	sign?: 'positive' | 'negative';
	referenceAngleDegrees?: number;
	solutionAngles?: number[];
}

export interface CoordinateSegmentIntent extends BaseIntent {
	family: 'coordinate-segment';
	points: Array<{ id?: string; label?: string; x: number; y: number }>;
	connect?: string[][];
}

export interface PolygonMeasurementIntent extends BaseIntent {
	family: 'polygon-measurement';
	shape:
		| 'triangle'
		| 'rectangle'
		| 'square'
		| 'parallelogram'
		| 'trapezoid'
		| 'rhombus'
		| 'kite';
	vertexLabels?: string[];
	sideLabels?: Record<string, string>;
	angleLabels?: Record<string, string>;
	rightAngles?: string[];
	fill?: string;
	fillOpacity?: number;
}

export interface CircleGeometryIntent extends BaseIntent {
	family: 'circle-geometry';
	variant:
		| 'sector'
		| 'central-angle'
		| 'inscribed-angle'
		| 'chord'
		| 'tangent'
		| 'secant'
		| 'diameter'
		| 'radius';
	angleLabel?: string;
	arcLabel?: string;
	sideLabels?: Record<string, string>;
	fill?: string;
	fillOpacity?: number;
}

export interface ThreeDSolidIntent extends BaseIntent {
	family: 'three-d-solid';
	solid: 'rectangular_prism' | 'cylinder' | 'cone' | 'sphere' | 'pyramid';
	dimensionLabels?: Record<string, string>;
}

export interface NumberLineIntent extends BaseIntent {
	family: 'number-line';
	min: number;
	max: number;
	tickInterval: number;
	points?: Array<{ value: number; label?: string; filled?: boolean }>;
}

export interface ParallelLinesIntent extends BaseIntent {
	family: 'parallel-lines';
	angleLabels?: Record<string, string>;
}

export type GeometryIntent =
	| StandardPositionTrigIntent
	| CastCircleIntent
	| CoordinateSegmentIntent
	| PolygonMeasurementIntent
	| CircleGeometryIntent
	| ThreeDSolidIntent
	| NumberLineIntent
	| ParallelLinesIntent;

export interface GeometryLayoutPlan {
	family: GeometryFamily;
	intent: GeometryIntent;
	diagram: DiagramSceneGraph;
}

interface TextPoint {
	label?: string;
	x: number;
	y: number;
}

const LATEX_GARBAGE = /\\text|\\left|\\right|\\begin|\\end|\*\*|\$\$|undefined|null/i;

export function buildTeacherGradeGeometryDiagram(
	questionText: string,
	rawIntent?: unknown,
	rawDiagram?: unknown
): GeometryLayoutPlan | undefined {
	const intent = normalizeGeometryIntent(questionText, rawIntent)
		?? inferGeometryIntent(questionText, rawDiagram);

	if (!intent) return undefined;
	const diagram = compileGeometryIntent(intent);
	if (!diagram) return undefined;
	return { family: intent.family, intent, diagram };
}

export function validateGeometryDiagram(questionText: string, diagram: DiagramSceneGraph): GeometryValidationResult {
	const diagnostics: GeometryDiagnostic[] = [];
	const family = inferGeometryFamily(questionText, diagram);

	for (const element of diagram.elements) {
		const candidateTexts = [element.label, element.text];
		for (const candidate of candidateTexts) {
			if (candidate && LATEX_GARBAGE.test(candidate)) {
				diagnostics.push({
					code: 'render-readability-failure',
					message: `The diagram still contains raw formatting artifacts: ${candidate}.`
				});
				break;
			}
		}
	}

	if (!family) {
		return { diagnostics, family: undefined };
	}

	if (family === 'standard-position-trig') {
		diagnostics.push(...validateStandardPositionTrig(questionText, diagram));
	} else if (family === 'cast-circle') {
		diagnostics.push(...validateCastCircle(diagram));
	} else if (family === 'coordinate-segment') {
		diagnostics.push(...validateCoordinateSegment(questionText, diagram));
	} else if (family === 'three-d-solid') {
		diagnostics.push(...validateThreeDSolid(questionText, diagram));
	} else if (family === 'number-line') {
		diagnostics.push(...validateNumberLine(questionText, diagram));
	} else if (family === 'parallel-lines') {
		diagnostics.push(...validateParallelLines(diagram));
	} else if (family === 'polygon-measurement') {
		diagnostics.push(...validatePolygonMeasurement(questionText, diagram));
	} else if (family === 'circle-geometry') {
		diagnostics.push(...validateCircleGeometry(questionText, diagram));
	}

	return { family, diagnostics };
}

export function inferGeometryFamily(questionText: string, diagram?: DiagramSceneGraph): GeometryFamily | undefined {
	const text = questionText.toLowerCase();

	if (/terminal arm|standard position/.test(text) && /sin|cos|tan/.test(text)) {
		return 'standard-position-trig';
	}
	if (isTrigCircleEquationPrompt(questionText)) {
		return 'cast-circle';
	}
	if (/\bnumber line\b|interval notation|open circle|closed circle/.test(text)) {
		return 'number-line';
	}
	if (/\b(rectangular prism|prism|box|cuboid|cylinder|cone|sphere|pyramid)\b/.test(text)) {
		return 'three-d-solid';
	}
	if (/\b(parallel lines?|transversal|alternate interior|corresponding angles?)\b/.test(text)) {
		return 'parallel-lines';
	}
	if (/\b(sector|central angle|inscribed angle|tangent|secant|chord|diameter|radius|arc)\b/.test(text)) {
		return 'circle-geometry';
	}
	if (/\b(triangle|quadrilateral|rectangle|square|parallelogram|trapezoid|rhombus|kite|polygon)\b/.test(text)) {
		return 'polygon-measurement';
	}
	if (extractCoordinatePoints(questionText).length >= 2 && !/\b(graph|plot|slope-intercept|standard form|function|line on a coordinate plane)\b/.test(text)) {
		return 'coordinate-segment';
	}

	if (!diagram) return undefined;

	const types = new Set(diagram.elements.map((element) => element.type));
	if (types.has('number_line')) return 'number-line';
	if (types.has('rectangular_prism') || types.has('cylinder') || types.has('cone') || types.has('sphere') || types.has('pyramid')) {
		return 'three-d-solid';
	}
	if (types.has('circle') && (types.has('angle_arc') || types.has('sector'))) return 'circle-geometry';
	if (types.has('polygon')) return 'polygon-measurement';
	if (types.has('axes')) return 'coordinate-segment';
	return undefined;
}

function normalizeGeometryIntent(questionText: string, rawIntent: unknown): GeometryIntent | undefined {
	const parsed = parseIntentValue(rawIntent);
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
	const family = stringProp(parsed, 'family');
	if (!family) return undefined;

	if (family === 'standard-position-trig') {
		const point = objectProp(parsed, 'point');
		const x = numberProp(point, 'x');
		const y = numberProp(point, 'y');
		if (x == null || y == null) return undefined;
		return {
			family,
			point: { x, y },
			pointLabel: stringProp(parsed, 'pointLabel') ?? stringProp(parsed, 'point_label') ?? `P(${trimNumber(x)}, ${trimNumber(y)})`,
			footLabel: stringProp(parsed, 'footLabel') ?? stringProp(parsed, 'foot_label') ?? 'A',
			originLabel: stringProp(parsed, 'originLabel') ?? stringProp(parsed, 'origin_label') ?? 'O',
			angleLabel: stringProp(parsed, 'angleLabel') ?? stringProp(parsed, 'angle_label') ?? 'θ'
		};
	}

	if (family === 'cast-circle') {
		const trigFunction = enumProp(parsed, 'trigFunction', ['sin', 'cos', 'tan'])
			?? enumProp(parsed, 'trig_function', ['sin', 'cos', 'tan'])
			?? inferTrigFunction(questionText);
		const sign = enumProp(parsed, 'sign', ['positive', 'negative'])
			?? inferTrigSign(questionText);
		const referenceAngleDegrees = numberProp(parsed, 'referenceAngleDegrees')
			?? numberProp(parsed, 'reference_angle_degrees')
			?? inferReferenceAngleDegrees(questionText, trigFunction);
		const solutionAngles = arrayProp(parsed, 'solutionAngles')
			.map((value) => typeof value === 'number' ? value : undefined)
			.filter((value): value is number => value != null)
			.sort((a, b) => a - b);
		return { family, trigFunction, sign, referenceAngleDegrees, solutionAngles };
	}

	if (family === 'coordinate-segment') {
		const rawPoints = arrayProp(parsed, 'points').flatMap((entry) => {
			const point = objectProp({ value: entry }, 'value');
			const x = numberProp(point, 'x');
			const y = numberProp(point, 'y');
			if (x == null || y == null) return [];
			return [{
				id: stringProp(point, 'id'),
				label: stringProp(point, 'label'),
				x,
				y
			}];
		});
		if (rawPoints.length === 0) return undefined;
		const rawConnect = arrayProp(parsed, 'connect')
			.map((value) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])
			.filter((value): value is string[] => value.length >= 2);
		return { family, points: rawPoints, connect: rawConnect };
	}

	if (family === 'polygon-measurement') {
		const shape = enumProp(parsed, 'shape', ['triangle', 'rectangle', 'square', 'parallelogram', 'trapezoid', 'rhombus', 'kite']);
		if (!shape) return undefined;
		return {
			family,
			shape,
			vertexLabels: stringArrayProp(parsed, 'vertexLabels') ?? stringArrayProp(parsed, 'vertex_labels'),
			sideLabels: recordProp(parsed, 'sideLabels') ?? recordProp(parsed, 'side_labels'),
			angleLabels: recordProp(parsed, 'angleLabels') ?? recordProp(parsed, 'angle_labels'),
			rightAngles: stringArrayProp(parsed, 'rightAngles') ?? stringArrayProp(parsed, 'right_angles'),
			fill: stringProp(parsed, 'fill'),
			fillOpacity: numberProp(parsed, 'fillOpacity') ?? numberProp(parsed, 'fill_opacity')
		};
	}

	if (family === 'circle-geometry') {
		const variant = enumProp(parsed, 'variant', ['sector', 'central-angle', 'inscribed-angle', 'chord', 'tangent', 'secant', 'diameter', 'radius']);
		if (!variant) return undefined;
		return {
			family,
			variant,
			angleLabel: stringProp(parsed, 'angleLabel') ?? stringProp(parsed, 'angle_label'),
			arcLabel: stringProp(parsed, 'arcLabel') ?? stringProp(parsed, 'arc_label'),
			sideLabels: recordProp(parsed, 'sideLabels') ?? recordProp(parsed, 'side_labels'),
			fill: stringProp(parsed, 'fill'),
			fillOpacity: numberProp(parsed, 'fillOpacity') ?? numberProp(parsed, 'fill_opacity')
		};
	}

	if (family === 'three-d-solid') {
		const solid = enumProp(parsed, 'solid', ['rectangular_prism', 'cylinder', 'cone', 'sphere', 'pyramid']);
		if (!solid) return undefined;
		return {
			family,
			solid,
			dimensionLabels: recordProp(parsed, 'dimensionLabels') ?? recordProp(parsed, 'dimension_labels')
		};
	}

	if (family === 'number-line') {
		const min = numberProp(parsed, 'min');
		const max = numberProp(parsed, 'max');
		const tickInterval = numberProp(parsed, 'tickInterval') ?? numberProp(parsed, 'tick_interval');
		if (min == null || max == null || tickInterval == null || !(min < max)) return undefined;
		const points = arrayProp(parsed, 'points').flatMap((entry) => {
			const point = objectProp({ value: entry }, 'value');
			const value = numberProp(point, 'value');
			if (value == null) return [];
			return [{
				value,
				label: stringProp(point, 'label'),
				filled: booleanProp(point, 'filled')
			}];
		});
		return { family, min, max, tickInterval, points };
	}

	if (family === 'parallel-lines') {
		return {
			family,
			angleLabels: recordProp(parsed, 'angleLabels') ?? recordProp(parsed, 'angle_labels')
		};
	}

	return undefined;
}

function inferGeometryIntent(questionText: string, rawDiagram?: unknown): GeometryIntent | undefined {
	const text = questionText.toLowerCase();
	const points = extractCoordinatePoints(questionText);

	if (/terminal arm|standard position/.test(text) && /sin|cos|tan/.test(text) && points.length > 0) {
		const point = points[0];
		return {
			family: 'standard-position-trig',
			point: { x: point.x, y: point.y },
			pointLabel: `P(${trimNumber(point.x)}, ${trimNumber(point.y)})`,
			footLabel: 'A',
			originLabel: 'O',
			angleLabel: 'θ'
		};
	}

	if (isTrigCircleEquationPrompt(questionText)) {
		const solvedAngles = inferTrigEquationSolutionAngles(questionText);
		return {
			family: 'cast-circle',
			trigFunction: solvedAngles?.trigFunction ?? inferTrigFunction(questionText),
			sign: solvedAngles?.sign ?? inferTrigSign(questionText),
			referenceAngleDegrees: solvedAngles?.referenceAngleDegrees ?? inferReferenceAngleDegrees(questionText, inferTrigFunction(questionText)),
			solutionAngles: solvedAngles?.solutionAngles
		};
	}

	const solidIntent = inferThreeDSolidIntent(questionText);
	if (solidIntent) return solidIntent;

	if (extractCoordinatePoints(questionText).length >= 2 && !/\b(graph|plot|slope-intercept|standard form|function|line on a coordinate plane)\b/.test(text)) {
		const labeledPoints = inferNamedCoordinatePoints(questionText);
		return {
			family: 'coordinate-segment',
			points: (labeledPoints.length > 0 ? labeledPoints : points.slice(0, 3).map((point, index) => ({
				id: String.fromCharCode(65 + index),
				label: `${String.fromCharCode(65 + index)}(${trimNumber(point.x)}, ${trimNumber(point.y)})`,
				x: point.x,
				y: point.y
			}))),
			connect: points.length >= 2 ? [[(labeledPoints[0]?.id) ?? 'A', (labeledPoints[1]?.id) ?? 'B']] : undefined
		};
	}

	if (/\bnumber line\b|interval notation|open circle|closed circle/.test(text)) {
		const interval = inferNumberLineIntent(questionText);
		if (interval) return interval;
	}

	const raw = parseIntentValue(rawDiagram);
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		const solid = inferThreeDSolidIntentFromRawDiagram(raw as Record<string, unknown>);
		if (solid) return solid;
	}

	return undefined;
}

function compileGeometryIntent(intent: GeometryIntent): DiagramSceneGraph | undefined {
	switch (intent.family) {
		case 'standard-position-trig':
			return compileStandardPositionTrig(intent);
		case 'cast-circle':
			return compileCastCircle(intent);
		case 'coordinate-segment':
			return compileCoordinateSegment(intent);
		case 'polygon-measurement':
			return compilePolygonMeasurement(intent);
		case 'circle-geometry':
			return compileCircleGeometry(intent);
		case 'three-d-solid':
			return compileThreeDSolid(intent);
		case 'number-line':
			return compileNumberLine(intent);
		case 'parallel-lines':
			return compileParallelLines(intent);
		default:
			return undefined;
	}
}

function compileStandardPositionTrig(intent: StandardPositionTrigIntent): DiagramSceneGraph {
	const { x, y } = intent.point;
	const xMin = Math.floor(Math.min(x, 0) - (x < 0 ? 0.9 : 0.75));
	const xMax = Math.ceil(Math.max(x, 0) + (x > 0 ? 0.9 : 1.75));
	const yMin = Math.floor(Math.min(y, 0) - (y < 0 ? 0.9 : 0.75));
	const yMax = Math.ceil(Math.max(y, 0) + (y > 0 ? 0.9 : 1.75));
	const span = Math.max(xMax - xMin, yMax - yMin);
	const tickInterval = Math.max(1, Math.ceil(Math.max(Math.abs(x), Math.abs(y)) / 7));
	const footId = intent.footLabel ?? 'A';
	const originId = intent.originLabel ?? 'O';
	const pointId = 'P';
	const helperId = 'X';
	const rLabel = radialLengthLabel(x, y);
	const helperX = Math.min(xMax - 0.4, Math.max(1.1, xMax * 0.52));
	const angleRadius = Math.max(0.72, Math.min(1.05, span * 0.07));

	const elements: DiagramElement[] = [
		{
			type: 'axes',
			x_min: xMin,
			x_max: xMax,
			y_min: yMin,
			y_max: yMax,
			grid: false,
			tick_interval: tickInterval,
			axis_number_step: tickInterval,
			padding: 0.35,
			x_label: 'x',
			y_label: 'y'
		},
		{ type: 'point', id: originId, x: 0, y: 0, label: originId, label_position: 'bottom-right' },
		{ type: 'point', id: footId, x, y: 0, label: footId, label_position: y >= 0 ? 'bottom' : 'top' },
		{ type: 'point', id: pointId, x, y, label: intent.pointLabel ?? `P(${trimNumber(x)}, ${trimNumber(y)})`, label_position: pointLabelPosition(x, y) },
		{ type: 'point', id: helperId, x: helperX, y: 0, hidden: true },
		{ type: 'ray', origin: originId, through: pointId },
		{ type: 'segment', from: originId, to: footId, label: trimNumber(x) },
		{ type: 'segment', from: footId, to: pointId, label: trimNumber(Math.abs(y)) },
		{ type: 'segment', from: originId, to: pointId, label: rLabel },
		{ type: 'right_angle', vertex: footId, ray1_through: originId, ray2_through: pointId, size: Math.max(0.25, angleRadius * 0.45) },
		{ type: 'angle_arc', vertex: originId, ray1_through: helperId, ray2_through: pointId, radius: angleRadius, label: intent.angleLabel ?? 'θ' }
	];

	return { width: 10, height: 8, elements };
}

function compileCastCircle(intent: CastCircleIntent): DiagramSceneGraph {
	const center = { x: 5, y: 4.2 };
	const radius = 3.15;
	const xAxisLeft = { x: 0.7, y: center.y };
	const xAxisRight = { x: 9.3, y: center.y };
	const yAxisTop = { x: center.x, y: 0.35 };
	const yAxisBottom = { x: center.x, y: 8.05 };
	const elements: DiagramElement[] = [
		{ type: 'point', id: 'O', x: center.x, y: center.y, label: 'O', label_position: 'bottom-right' },
		{ type: 'point', id: 'XL', x: xAxisLeft.x, y: xAxisLeft.y, hidden: true },
		{ type: 'point', id: 'XR', x: xAxisRight.x, y: xAxisRight.y, hidden: true },
		{ type: 'point', id: 'YT', x: yAxisTop.x, y: yAxisTop.y, hidden: true },
		{ type: 'point', id: 'YB', x: yAxisBottom.x, y: yAxisBottom.y, hidden: true },
		{ type: 'line', through_points: ['XL', 'XR'] },
		{ type: 'line', through_points: ['YT', 'YB'] },
		{ type: 'circle', center: 'O', radius }
	];

	const quadrantLabels = [
		{ x: center.x + 1.45, y: center.y - 1.45, text: 'QI' },
		{ x: center.x - 1.55, y: center.y - 1.45, text: 'QII' },
		{ x: center.x - 1.6, y: center.y + 1.55, text: 'QIII' },
		{ x: center.x + 1.55, y: center.y + 1.55, text: 'QIV' }
	];
	for (const label of quadrantLabels) {
		elements.push({ type: 'label', x: label.x, y: label.y, text: label.text, font_size: 10.5 });
	}

	const degreeLabels = [
		{ x: center.x + radius + 0.95, y: center.y + 0.08, text: '0°/360°', font_size: 8.8 },
		{ x: center.x + 0.05, y: center.y - radius - 0.55, text: '90°', font_size: 8.8 },
		{ x: center.x - radius - 0.95, y: center.y + 0.08, text: '180°', font_size: 8.8 },
		{ x: center.x + 0.1, y: center.y + radius + 0.62, text: '270°', font_size: 8.8 }
	];
	for (const label of degreeLabels) {
		elements.push({ type: 'label', x: label.x, y: label.y, text: label.text, font_size: label.font_size ?? 9 });
	}

	const referenceAngle = intent.referenceAngleDegrees;
	const solutionAngles = intent.solutionAngles && intent.solutionAngles.length > 0
		? [...new Set(intent.solutionAngles.map((angle) => normalizeAngle(angle)))]
		: referenceAngle != null && intent.trigFunction && intent.sign
			? solutionQuadrants(intent.trigFunction, intent.sign).map((quadrant) => quadrantAngle(quadrant, referenceAngle))
			: [];
	if (solutionAngles.length > 0) {
		for (const angle of solutionAngles) {
			const endpoint = polarScreenPoint(center, radius, angle);
			const pointId = `S${Math.round(angle)}`;
			const solutionLabel = solutionLabelPosition(center, radius, angle, solutionAngles);
			elements.push(
				{ type: 'point', id: pointId, x: endpoint.x, y: endpoint.y, hidden: true },
				{ type: 'segment', from: 'O', to: pointId, stroke: '#2563eb' },
				{ type: 'point', x: endpoint.x, y: endpoint.y, filled: true, stroke: '#2563eb' },
				{ type: 'label', x: solutionLabel.x, y: solutionLabel.y, text: `${trimNumber(angle)}°`, font_size: 9.25, fill: '#2563eb' }
			);
		}
	}

	return { width: 10, height: 8, elements };
}

function compileCoordinateSegment(intent: CoordinateSegmentIntent): DiagramSceneGraph {
	const xs = intent.points.map((point) => point.x);
	const ys = intent.points.map((point) => point.y);
	const extent = Math.max(
		4,
		Math.ceil(Math.max(Math.abs(Math.min(...xs)), Math.abs(Math.max(...xs)), Math.abs(Math.min(...ys)), Math.abs(Math.max(...ys))) + 2)
	);
	const tickInterval = extent > 7 ? 2 : 1;
	const points = intent.points.map((point, index) => {
		const id = point.id ?? String.fromCharCode(65 + index);
		return {
			id,
			label: point.label ?? `${id}(${trimNumber(point.x)}, ${trimNumber(point.y)})`,
			x: point.x,
			y: point.y
		};
	});

	const elements: DiagramElement[] = [
		{ type: 'axes', x_min: -extent, x_max: extent, y_min: -extent, y_max: extent, grid: true, tick_interval: tickInterval, x_label: 'x', y_label: 'y' }
	];

	for (const point of points) {
		elements.push({
			type: 'point',
			id: point.id,
			x: point.x,
			y: point.y,
			label: point.label,
			label_position: pointLabelPosition(point.x, point.y)
		});
	}

	const connectPairs = intent.connect && intent.connect.length > 0
		? intent.connect
		: points.length >= 2
			? [[points[0].id, points[1].id]]
			: [];

	for (const pair of connectPairs) {
		if (pair.length < 2) continue;
		elements.push({ type: 'segment', from: pair[0], to: pair[1] });
	}

	return { width: 10, height: 8, elements };
}

function compilePolygonMeasurement(intent: PolygonMeasurementIntent): DiagramSceneGraph {
	const vertexLabels = intent.vertexLabels ?? defaultVertexLabels(intent.shape);
	const shapePoints = canonicalPolygon(intent.shape, vertexLabels);
	const edges = polygonEdges(vertexLabels);
	const elements: DiagramElement[] = [
		{
			type: 'polygon',
			vertices: vertexLabels,
			fill: intent.fill,
			fill_opacity: intent.fillOpacity
		}
	];

	for (const point of shapePoints) {
		elements.push({
			type: 'point',
			id: point.id,
			x: point.x,
			y: point.y,
			label: point.label,
			label_position: point.labelPosition
		});
	}

	for (const [from, to] of edges) {
		elements.push({
			type: 'segment',
			from,
			to,
			label: intent.sideLabels?.[canonicalSegmentKey(from, to)]
		});
	}

	const rightAngles = new Set(intent.rightAngles ?? []);
	for (let index = 0; index < vertexLabels.length; index += 1) {
		const vertex = vertexLabels[index];
		const prev = vertexLabels[(index - 1 + vertexLabels.length) % vertexLabels.length];
		const next = vertexLabels[(index + 1) % vertexLabels.length];
		const angleLabel = intent.angleLabels?.[vertex];
		if (rightAngles.has(vertex)) {
			elements.push({ type: 'right_angle', vertex, ray1_through: prev, ray2_through: next, size: 0.4 });
		} else if (angleLabel) {
			elements.push({ type: 'angle_arc', vertex, ray1_through: prev, ray2_through: next, label: angleLabel, radius: 0.65 });
		}
	}

	return { width: 10, height: 8, elements };
}

function compileCircleGeometry(intent: CircleGeometryIntent): DiagramSceneGraph {
	const radius = 2.8;
	const elements: DiagramElement[] = [
		{ type: 'point', id: 'O', x: 5, y: 4, label: 'O', label_position: 'bottom-right' },
		{ type: 'circle', center: 'O', radius }
	];

	if (intent.variant === 'sector' || intent.variant === 'central-angle') {
		elements.push(
			{ type: 'point', id: 'A', x: 5 + radius, y: 4, label: 'A', label_position: 'right' },
			{ type: 'point', id: 'B', x: 5 + radius * Math.cos((-70 * Math.PI) / 180), y: 4 + radius * Math.sin((-70 * Math.PI) / 180), label: 'B', label_position: 'top-right' },
			{ type: 'segment', from: 'O', to: 'A', label: intent.sideLabels?.OA },
			{ type: 'segment', from: 'O', to: 'B', label: intent.sideLabels?.OB }
		);
		if (intent.variant === 'sector') {
			elements.push({
				type: 'sector',
				center: 'O',
				radius,
				start_angle: 0,
				end_angle: -70,
				fill: intent.fill ?? '#d1d5db',
				fill_opacity: intent.fillOpacity ?? 0.35
			});
		}
		elements.push({ type: 'angle_arc', vertex: 'O', ray1_through: 'A', ray2_through: 'B', label: intent.angleLabel ?? 'θ', radius: 0.8 });
		if (intent.arcLabel) {
			elements.push({ type: 'label', x: 7.15, y: 2.7, text: intent.arcLabel, font_size: 10 });
		}
	}

	if (intent.variant === 'inscribed-angle') {
		elements.push(
			{ type: 'point', id: 'A', x: 3.2, y: 5.2, label: 'A', label_position: 'left' },
			{ type: 'point', id: 'B', x: 7.8, y: 5.2, label: 'B', label_position: 'right' },
			{ type: 'point', id: 'C', x: 5, y: 1.3, label: 'C', label_position: 'top' },
			{ type: 'segment', from: 'C', to: 'A' },
			{ type: 'segment', from: 'C', to: 'B' },
			{ type: 'segment', from: 'A', to: 'B', label: intent.sideLabels?.AB },
			{ type: 'angle_arc', vertex: 'C', ray1_through: 'A', ray2_through: 'B', label: intent.angleLabel ?? 'θ', radius: 0.55 }
		);
		if (intent.arcLabel) {
			elements.push({ type: 'arc', center: 'O', radius, start_angle: 160, end_angle: 20 });
			elements.push({ type: 'label', x: 5, y: 6.8, text: intent.arcLabel, font_size: 10 });
		}
	}

	if (intent.variant === 'chord' || intent.variant === 'diameter' || intent.variant === 'radius') {
		elements.push(
			{ type: 'point', id: 'A', x: 2.2, y: 4, label: 'A', label_position: 'left' },
			{ type: 'point', id: 'B', x: 7.8, y: 4, label: 'B', label_position: 'right' }
		);
		if (intent.variant === 'radius') {
			elements.push({ type: 'segment', from: 'O', to: 'B', label: intent.sideLabels?.OB ?? intent.sideLabels?.radius });
		} else {
			elements.push({ type: 'segment', from: 'A', to: 'B', label: intent.sideLabels?.AB });
		}
	}

	if (intent.variant === 'tangent') {
		elements.push(
			{ type: 'point', id: 'T', x: 7.8, y: 4, label: 'T', label_position: 'right' },
			{ type: 'point', id: 'P', x: 8.9, y: 1.5, label: 'P', label_position: 'top-right' },
			{ type: 'segment', from: 'O', to: 'T', label: intent.sideLabels?.OT },
			{ type: 'segment', from: 'T', to: 'P', label: intent.sideLabels?.TP },
			{ type: 'right_angle', vertex: 'T', ray1_through: 'O', ray2_through: 'P', size: 0.35 }
		);
	}

	if (intent.variant === 'secant') {
		elements.push(
			{ type: 'point', id: 'P', x: 1.2, y: 1.8, label: 'P', label_position: 'top-left' },
			{ type: 'point', id: 'A', x: 3.4, y: 3, label: 'A', label_position: 'left' },
			{ type: 'point', id: 'B', x: 6.7, y: 4.85, label: 'B', label_position: 'right' },
			{ type: 'ray', origin: 'P', through: 'B' },
			{ type: 'segment', from: 'P', to: 'A', label: intent.sideLabels?.PA },
			{ type: 'segment', from: 'A', to: 'B', label: intent.sideLabels?.AB }
		);
	}

	return { width: 10, height: 8, elements };
}

function compileThreeDSolid(intent: ThreeDSolidIntent): DiagramSceneGraph {
	const labels = intent.dimensionLabels;
	const cx = 5;
	const cy = 4;
	const elements: DiagramElement[] = [];

	if (intent.solid === 'rectangular_prism') {
		elements.push({
			type: 'rectangular_prism',
			cx,
			cy,
			shape_width: 4.4,
			shape_height: 3.2,
			depth: 2.2,
			dimension_labels: labels
		});
	}

	if (intent.solid === 'cylinder') {
		elements.push({
			type: 'cylinder',
			cx,
			cy,
			radius: 2,
			shape_height: 4.2,
			dimension_labels: labels
		});
	}

	if (intent.solid === 'cone') {
		elements.push({
			type: 'cone',
			cx,
			cy,
			radius: 2.1,
			shape_height: 4.3,
			dimension_labels: labels
		});
	}

	if (intent.solid === 'sphere') {
		elements.push({
			type: 'sphere',
			cx,
			cy,
			radius: 2.35,
			dimension_labels: labels
		});
	}

	if (intent.solid === 'pyramid') {
		elements.push({
			type: 'pyramid',
			cx,
			cy,
			shape_width: 4.3,
			shape_height: 4.4,
			depth: 2.1,
			dimension_labels: labels
		});
	}

	return { width: 10, height: 8, elements };
}

function compileNumberLine(intent: NumberLineIntent): DiagramSceneGraph {
	return {
		width: 10,
		height: 4,
		elements: [
			{
				type: 'number_line',
				min: intent.min,
				max: intent.max,
				tick_interval: intent.tickInterval,
				points: intent.points
			}
		]
	};
}

function compileParallelLines(intent: ParallelLinesIntent): DiagramSceneGraph {
	const angleLabels = intent.angleLabels ?? {};
	return {
		width: 10,
		height: 8,
		elements: [
			{ type: 'point', id: 'A', x: 2, y: 2, hidden: true },
			{ type: 'point', id: 'B', x: 8, y: 2, hidden: true },
			{ type: 'point', id: 'C', x: 2, y: 6, hidden: true },
			{ type: 'point', id: 'D', x: 8, y: 6, hidden: true },
			{ type: 'point', id: 'E', x: 3.5, y: 0.8, hidden: true },
			{ type: 'point', id: 'F', x: 6.6, y: 7.2, hidden: true },
			{ type: 'line', through_points: ['A', 'B'] },
			{ type: 'line', through_points: ['C', 'D'] },
			{ type: 'line', through_points: ['E', 'F'] },
			{ type: 'parallel_marks', segment_from: 'A', segment_to: 'B', count: 1 },
			{ type: 'parallel_marks', segment_from: 'C', segment_to: 'D', count: 1 },
			{ type: 'label', x: 4.3, y: 1.5, text: angleLabels.topLeft ?? '1', font_size: 11 },
			{ type: 'label', x: 5.2, y: 1.5, text: angleLabels.topRight ?? '2', font_size: 11 },
			{ type: 'label', x: 4.6, y: 2.8, text: angleLabels.bottomLeft ?? '3', font_size: 11 },
			{ type: 'label', x: 5.55, y: 2.8, text: angleLabels.bottomRight ?? '4', font_size: 11 },
			{ type: 'label', x: 5.9, y: 5.05, text: angleLabels.lowerTopLeft ?? '5', font_size: 11 },
			{ type: 'label', x: 6.75, y: 5.05, text: angleLabels.lowerTopRight ?? '6', font_size: 11 },
			{ type: 'label', x: 6.1, y: 6.25, text: angleLabels.lowerBottomLeft ?? '7', font_size: 11 },
			{ type: 'label', x: 7.05, y: 6.25, text: angleLabels.lowerBottomRight ?? '8', font_size: 11 }
		]
	};
}

function validateStandardPositionTrig(questionText: string, diagram: DiagramSceneGraph): GeometryDiagnostic[] {
	const diagnostics: GeometryDiagnostic[] = [];
	const point = extractCoordinatePoints(questionText)[0];
	if (!hasAxes(diagram)) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'A standard-position trig diagram needs labeled coordinate axes.'
		});
	}
	if (!pointExists(diagram, point?.x, point?.y)) {
		diagnostics.push({
			code: 'semantic-mismatch',
			message: 'The trig diagram does not place the referenced point at the stated coordinates.'
		});
	}
	if (!diagram.elements.some((element) => element.type === 'ray')) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'A standard-position trig diagram needs a terminal arm ray from the origin.'
		});
	}
	if (!diagram.elements.some((element) => element.type === 'right_angle')) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'A standard-position trig diagram needs a reference triangle with a right-angle marker.'
		});
	}
	const segmentLabels = diagram.elements.filter((element) => element.type === 'segment' && element.label).map((element) => element.label ?? '');
	if (!segmentLabels.some((label) => /\br\b/i.test(label))) {
		diagnostics.push({
			code: 'render-readability-failure',
			message: 'The reference triangle should label the hypotenuse as r.'
		});
	}
	return diagnostics;
}

function validateCastCircle(diagram: DiagramSceneGraph): GeometryDiagnostic[] {
	const diagnostics: GeometryDiagnostic[] = [];
	const labelTexts = diagram.elements.filter((element) => element.type === 'label' && element.text).map((element) => element.text ?? '');
	if (!diagram.elements.some((element) => element.type === 'circle')) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'A CAST-rule diagram needs a unit-circle style circle.'
		});
	}
	for (const required of ['QI', 'QII', 'QIII', 'QIV', '90°', '180°', '270°']) {
		if (!labelTexts.some((text) => text.includes(required))) {
			diagnostics.push({
				code: 'render-readability-failure',
				message: `The CAST diagram is missing the instructional label ${required}.`
			});
		}
	}
	return diagnostics;
}

function validateCoordinateSegment(questionText: string, diagram: DiagramSceneGraph): GeometryDiagnostic[] {
	const diagnostics: GeometryDiagnostic[] = [];
	const expectedPoints = extractCoordinatePoints(questionText);
	if (!hasAxes(diagram)) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'A coordinate-geometry diagram needs axes and a readable scale.'
		});
	}
	for (const point of expectedPoints.slice(0, 3)) {
		if (!pointExists(diagram, point.x, point.y)) {
			diagnostics.push({
				code: 'semantic-mismatch',
				message: `The diagram is missing the point (${trimNumber(point.x)}, ${trimNumber(point.y)}).`
			});
		}
	}
	return diagnostics;
}

function validateThreeDSolid(questionText: string, diagram: DiagramSceneGraph): GeometryDiagnostic[] {
	const diagnostics: GeometryDiagnostic[] = [];
	const family = inferThreeDSolidIntent(questionText);
	if (!family) return diagnostics;
	if (!diagram.elements.some((element) => element.type === family.solid)) {
		diagnostics.push({
			code: 'semantic-mismatch',
			message: 'The diagram does not render the correct 3D solid.'
		});
	}
	const expectedLabelCount = Object.keys(family.dimensionLabels ?? {}).length;
	const solid = diagram.elements.find((element) => element.type === family.solid);
	const actualLabelCount = Object.keys(solid?.dimension_labels ?? {}).length;
	if (expectedLabelCount > actualLabelCount) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'The 3D solid is missing one or more required dimension labels.'
		});
	}
	return diagnostics;
}

function validateNumberLine(questionText: string, diagram: DiagramSceneGraph): GeometryDiagnostic[] {
	const diagnostics: GeometryDiagnostic[] = [];
	const numberLine = diagram.elements.find((element) => element.type === 'number_line');
	if (!numberLine) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'The question needs a readable number line.'
		});
	}
	const numbers = [...questionText.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
	if (numberLine && numbers.length > 0) {
		const min = numberLine.min ?? 0;
		const max = numberLine.max ?? 0;
		if (Math.min(...numbers) < min || Math.max(...numbers) > max) {
			diagnostics.push({
				code: 'bad-scale',
				message: 'The number-line scale does not include the values named in the question.'
			});
		}
	}
	return diagnostics;
}

function validateParallelLines(diagram: DiagramSceneGraph): GeometryDiagnostic[] {
	const diagnostics: GeometryDiagnostic[] = [];
	const lineCount = diagram.elements.filter((element) => element.type === 'line').length;
	if (lineCount < 3) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'A parallel-lines diagram needs two parallel lines and a transversal.'
		});
	}
	return diagnostics;
}

function validatePolygonMeasurement(questionText: string, diagram: DiagramSceneGraph): GeometryDiagnostic[] {
	const diagnostics: GeometryDiagnostic[] = [];
	if (!diagram.elements.some((element) => element.type === 'polygon')) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'The geometry problem needs a complete polygon outline.'
		});
	}
	const namedMeasures = [...questionText.matchAll(/(\d+(?:\.\d+)?)\s*(cm|mm|m|units?|ft|in)\b/gi)];
	const actualMeasureLabels = diagram.elements.filter((element) => element.type === 'segment' && element.label).length;
	if (namedMeasures.length > 0 && actualMeasureLabels === 0) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'Known side measurements are not labeled on the diagram.'
		});
	}
	return diagnostics;
}

function validateCircleGeometry(questionText: string, diagram: DiagramSceneGraph): GeometryDiagnostic[] {
	const diagnostics: GeometryDiagnostic[] = [];
	if (!diagram.elements.some((element) => element.type === 'circle')) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'Circle-geometry questions need an actual circle.'
		});
	}
	if (/\bshaded|colored|red|blue|green\b/i.test(questionText) && !diagram.elements.some((element) => element.fill && element.fill !== 'none')) {
		diagnostics.push({
			code: 'missing-construction',
			message: 'The requested shaded region is not encoded in the circle diagram.'
		});
	}
	return diagnostics;
}

function inferTrigFunction(questionText: string): 'sin' | 'cos' | 'tan' | undefined {
	const match = questionText.match(/\b(sin|cos|tan)\b/i);
	return match ? match[1].toLowerCase() as 'sin' | 'cos' | 'tan' : undefined;
}

function inferTrigSign(questionText: string): 'positive' | 'negative' | undefined {
	if (/=\s*-\s*|negative/i.test(questionText)) return 'negative';
	if (/=\s*[^-]|positive/i.test(questionText)) return 'positive';
	return undefined;
}

function isTrigCircleEquationPrompt(questionText: string): boolean {
	if (/cast rule/i.test(questionText)) return true;
	if (!/\b(sin|cos|tan)\b/i.test(questionText)) return false;

	const normalized = normalizeTrigEquationText(questionText);
	return /[\[(]0,360[\])]/.test(normalized)
		|| /0<=θ<=360/.test(normalized)
		|| /0<θ<360/.test(normalized)
		|| /0≤θ≤360/.test(normalized);
}

function inferReferenceAngleDegrees(questionText: string, trigFunction?: 'sin' | 'cos' | 'tan'): number | undefined {
	const normalized = questionText
		.replace(/\$+/g, '')
		.replace(/\\left|\\right/g, '')
		.replace(/\\dfrac/g, '\\frac')
		.replace(/\s+/g, '');

	if (/sqrt\{?3\}?\/?3|\\frac\{1\}\{\\sqrt\{3\}\}|1\/sqrt\{?3\}?/i.test(normalized)) {
		return trigFunction === 'sin' ? 30 : trigFunction === 'cos' ? 30 : 30;
	}
	if (/sqrt\{?3\}?/i.test(normalized)) {
		return trigFunction === 'sin' ? 60 : trigFunction === 'cos' ? 30 : 60;
	}
	if (/sqrt\{?2\}?\/?2|\\frac\{\\sqrt\{2\}\}\{2\}|1\/sqrt\{?2\}?/i.test(normalized)) {
		return 45;
	}
	if (/\\frac\{1\}\{2\}|1\/2|\b0\.5\b/.test(normalized)) {
		return trigFunction === 'cos' ? 60 : trigFunction === 'tan' ? 30 : 30;
	}
	if (/=\s*1(?!\d)|=\+1(?!\d)/.test(normalized)) {
		return trigFunction === 'tan' ? 45 : trigFunction === 'cos' ? 0 : 90;
	}
	return undefined;
}

function inferTrigEquationSolutionAngles(questionText: string): {
	trigFunction: 'sin' | 'cos' | 'tan';
	solutionAngles: number[];
	referenceAngleDegrees?: number;
	sign?: 'positive' | 'negative';
} | undefined {
	const trigFunction = inferTrigFunction(questionText);
	if (!trigFunction) return undefined;
	const normalized = normalizeTrigEquationText(questionText);
	const directValues = extractDirectTrigValue(normalized, trigFunction);
	const quadraticValues = extractQuadraticTrigValues(normalized, trigFunction);
	const values = directValues ?? quadraticValues;
	if (!values || values.length === 0) return undefined;
	const approximateDegrees = /nearest degree/i.test(questionText);

	const solutionAngles = [...new Set(
		values.flatMap((value) => anglesForTrigValue(trigFunction, value))
		.map((angle) => approximateDegrees ? Math.round(angle) : angle)
	)].sort((a, b) => a - b);
	if (solutionAngles.length === 0) return undefined;

	const nonCardinal = values.find((value) => Math.abs(Math.abs(value) - 1) > 0.001 && Math.abs(value) > 0.001);
	return {
		trigFunction,
		solutionAngles,
		referenceAngleDegrees: nonCardinal == null
			? undefined
			: (() => {
				const angle = referenceAngleForTrigValue(trigFunction, Math.abs(nonCardinal));
				if (angle == null) return undefined;
				return approximateDegrees ? Math.round(angle) : angle;
			})(),
		sign: nonCardinal == null ? undefined : (nonCardinal < 0 ? 'negative' : 'positive')
	};
}

function solutionQuadrants(
	trigFunction: 'sin' | 'cos' | 'tan',
	sign: 'positive' | 'negative'
): number[] {
	if (trigFunction === 'sin') return sign === 'positive' ? [1, 2] : [3, 4];
	if (trigFunction === 'cos') return sign === 'positive' ? [1, 4] : [2, 3];
	return sign === 'positive' ? [1, 3] : [2, 4];
}

function quadrantAngle(quadrant: number, referenceAngle: number): number {
	if (quadrant === 1) return referenceAngle;
	if (quadrant === 2) return 180 - referenceAngle;
	if (quadrant === 3) return 180 + referenceAngle;
	return 360 - referenceAngle;
}

function polarScreenPoint(center: { x: number; y: number }, radius: number, angleDeg: number): { x: number; y: number } {
	const radians = (angleDeg * Math.PI) / 180;
	return {
		x: center.x + Math.cos(radians) * radius,
		y: center.y - Math.sin(radians) * radius
	};
}

function solutionLabelPosition(
	center: { x: number; y: number },
	radius: number,
	angleDeg: number,
	allAngles: number[] = []
): { x: number; y: number } {
	const outer = polarScreenPoint(center, radius + 0.65, angleDeg);
	if (isCardinalAngle(angleDeg)) {
		if (normalizeAngle(angleDeg) === 0) return { x: center.x + radius + 1.5, y: center.y - 0.45 };
		if (normalizeAngle(angleDeg) === 90) return { x: center.x + 0.7, y: center.y - radius - 1.15 };
		if (normalizeAngle(angleDeg) === 180) return { x: center.x - radius - 1.45, y: center.y - 0.45 };
		return { x: center.x + 0.75, y: center.y + radius + 1.2 };
	}

	const cluster = allAngles
		.filter((candidate) => angularDistance(candidate, angleDeg) <= 18)
		.sort((a, b) => normalizeAngle(a) - normalizeAngle(b));
	if (cluster.length <= 1) return outer;

	const angle = (angleDeg * Math.PI) / 180;
	const tangent = { x: -Math.sin(angle), y: -Math.cos(angle) };
	const index = cluster.findIndex((candidate) => almostEqual(normalizeAngle(candidate), normalizeAngle(angleDeg), 0.01));
	const clusterMid = (cluster.length - 1) / 2;
	const tangentialOffset = (index - clusterMid) * 0.45;
	const radialBump = Math.abs(index - clusterMid) * 0.16;
	const bumped = polarScreenPoint(center, radius + 0.7 + radialBump, angleDeg);
	return {
		x: bumped.x + tangent.x * tangentialOffset,
		y: bumped.y + tangent.y * tangentialOffset
	};
}

function isCardinalAngle(angleDeg: number): boolean {
	const angle = normalizeAngle(angleDeg);
	return angle === 0 || angle === 90 || angle === 180 || angle === 270;
}

function normalizeAngle(angleDeg: number): number {
	const normalized = ((angleDeg % 360) + 360) % 360;
	return normalized === 360 ? 0 : normalized;
}

function angularDistance(a: number, b: number): number {
	const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
	return Math.min(diff, 360 - diff);
}

function normalizeTrigEquationText(questionText: string): string {
	return questionText
		.toLowerCase()
		.replace(/\$/g, '')
		.replace(/\\left|\\right/g, '')
		.replace(/\\(sin|cos|tan)\b/g, '$1')
		.replace(/\\in\b/g, 'in')
		.replace(/\^\{?\\circ\}?/g, '')
		.replace(/\\theta/g, 'θ')
		.replace(/\s+/g, '')
		.replace(/−/g, '-')
		.replace(/\\circ/g, '')
		.replace(/°/g, '')
		.replace(/,\)/g, ')');
}

function extractDirectTrigValue(
	normalized: string,
	trigFunction: 'sin' | 'cos' | 'tan'
): number[] | undefined {
	const directPattern = new RegExp(`${trigFunction}θ=([^.=]+?)(?:forθ|forθin|giveexact|use|$)`);
	const match = normalized.match(directPattern);
	if (!match) return undefined;
	const value = parseSpecialTrigValue(match[1]);
	return value == null ? undefined : [value];
}

function extractQuadraticTrigValues(
	normalized: string,
	trigFunction: 'sin' | 'cos' | 'tan'
): number[] | undefined {
	const escaped = trigFunction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`([+-]?\\d*\\.?\\d*)${escaped}\\^\\{?2\\}?θ([+-]\\d*\\.?\\d*)${escaped}θ([+-]\\d*\\.?\\d*)=0`);
	const match = normalized.match(pattern);
	if (!match) return undefined;
	const a = parseCoefficient(match[1]);
	const b = parseCoefficient(match[2]);
	const c = parseCoefficient(match[3]);
	if (a == null || b == null || c == null || almostEqual(a, 0, 1e-6)) return undefined;
	const discriminant = b * b - 4 * a * c;
	if (discriminant < -1e-6) return undefined;
	const safeDiscriminant = discriminant < 0 ? 0 : discriminant;
	const root = Math.sqrt(safeDiscriminant);
	const values = [(-b + root) / (2 * a), (-b - root) / (2 * a)]
		.filter((value, index, valuesArray) => Number.isFinite(value) && valuesArray.findIndex((candidate) => almostEqual(candidate, value, 1e-6)) === index);
	return values.length > 0 ? values : undefined;
}

function parseCoefficient(value: string): number | undefined {
	if (value === '' || value === '+') return 1;
	if (value === '-') return -1;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseSpecialTrigValue(raw: string): number | undefined {
	const value = raw
		.replace(/^\(+|\)+$/g, '')
		.replace(/\\dfrac/g, '\\frac')
		.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
		.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)')
		.replace(/√3/g, 'sqrt(3)')
		.replace(/√2/g, 'sqrt(2)')
		.replace(/θ/g, '')
		.trim();

	const table: Array<[RegExp, number]> = [
		[/^-?1$/, Number(value)],
		[/^-?0$/, Number(value)],
		[/^-?1\/2$/, value.startsWith('-') ? -0.5 : 0.5],
		[/^-?sqrt\(2\)\/2$/, value.startsWith('-') ? -Math.SQRT1_2 : Math.SQRT1_2],
		[/^-?sqrt\(3\)\/2$/, value.startsWith('-') ? -Math.sqrt(3) / 2 : Math.sqrt(3) / 2],
		[/^-?sqrt\(3\)$/, value.startsWith('-') ? -Math.sqrt(3) : Math.sqrt(3)],
		[/^-?sqrt\(3\)\/3$/, value.startsWith('-') ? -Math.sqrt(3) / 3 : Math.sqrt(3) / 3]
	];
	for (const [pattern, numeric] of table) {
		if (pattern.test(value)) return numeric;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function anglesForTrigValue(
	trigFunction: 'sin' | 'cos' | 'tan',
	value: number
): number[] {
	if (trigFunction === 'sin') {
		if (almostEqual(value, 0)) return [0, 180];
		if (almostEqual(Math.abs(value), 1)) return value > 0 ? [90] : [270];
		const reference = referenceAngleForTrigValue('sin', Math.abs(value));
		if (reference == null) return [];
		return value > 0 ? [reference, 180 - reference] : [180 + reference, 360 - reference];
	}

	if (trigFunction === 'cos') {
		if (almostEqual(value, 0)) return [90, 270];
		if (almostEqual(Math.abs(value), 1)) return value > 0 ? [0] : [180];
		const reference = referenceAngleForTrigValue('cos', Math.abs(value));
		if (reference == null) return [];
		return value > 0 ? [reference, 360 - reference] : [180 - reference, 180 + reference];
	}

	if (almostEqual(value, 0)) return [0, 180];
	const reference = referenceAngleForTrigValue('tan', Math.abs(value));
	if (reference == null) return [];
	return value > 0 ? [reference, reference + 180] : [180 - reference, 360 - reference];
}

function referenceAngleForTrigValue(
	trigFunction: 'sin' | 'cos' | 'tan',
	value: number
): number | undefined {
	const comparisons: Array<[number, number]> = trigFunction === 'tan'
		? [
			[Math.sqrt(3) / 3, 30],
			[1, 45],
			[Math.sqrt(3), 60]
		]
		: [
			[0.5, trigFunction === 'sin' ? 30 : 60],
			[Math.SQRT1_2, 45],
			[Math.sqrt(3) / 2, trigFunction === 'sin' ? 60 : 30]
		];
	if (almostEqual(value, 1)) return trigFunction === 'cos' ? 0 : trigFunction === 'tan' ? 45 : 90;
	for (const [candidate, angle] of comparisons) {
		if (almostEqual(value, candidate, 0.0015)) return angle;
	}
	if (trigFunction === 'sin' && value >= 0 && value <= 1) {
		return (Math.asin(value) * 180) / Math.PI;
	}
	if (trigFunction === 'cos' && value >= 0 && value <= 1) {
		return (Math.acos(value) * 180) / Math.PI;
	}
	if (trigFunction === 'tan' && Number.isFinite(value) && value >= 0) {
		return (Math.atan(value) * 180) / Math.PI;
	}
	return undefined;
}

function inferThreeDSolidIntent(questionText: string): ThreeDSolidIntent | undefined {
	const text = questionText.toLowerCase();
	let solid: ThreeDSolidIntent['solid'] | undefined;
	if (/rectangular prism|prism|box|cuboid/.test(text)) solid = 'rectangular_prism';
	else if (/cylinder/.test(text)) solid = 'cylinder';
	else if (/cone/.test(text)) solid = 'cone';
	else if (/sphere/.test(text)) solid = 'sphere';
	else if (/pyramid/.test(text)) solid = 'pyramid';
	if (!solid) return undefined;
	return {
		family: 'three-d-solid',
		solid,
		dimensionLabels: extractDimensionLabels(questionText, solid)
	};
}

function inferThreeDSolidIntentFromRawDiagram(rawDiagram: Record<string, unknown>): ThreeDSolidIntent | undefined {
	const arrays = ['rectangular_prisms', 'cylinders', 'cones', 'spheres', 'pyramids'] as const;
	for (const key of arrays) {
		const entries = Array.isArray(rawDiagram[key]) ? rawDiagram[key] : [];
		if (entries.length === 0) continue;
		const item = entries[0];
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const solid = key === 'rectangular_prisms'
			? 'rectangular_prism'
			: key === 'cylinders'
				? 'cylinder'
				: key === 'cones'
					? 'cone'
					: key === 'spheres'
						? 'sphere'
						: 'pyramid';
		return {
			family: 'three-d-solid',
			solid,
			dimensionLabels: recordProp(item as Record<string, unknown>, 'dimension_labels')
		};
	}
	return undefined;
}

function extractDimensionLabels(questionText: string, solid: ThreeDSolidIntent['solid']): Record<string, string> {
	const labels: Record<string, string> = {};
	for (const match of questionText.matchAll(/(radius|height|width|depth|length|base|slant)\s*(?:of|is|=|:)?\s*(\d+(?:\.\d+)?\s*(?:cm|mm|m|in|ft|units?)?)/gi)) {
		const key = match[1].toLowerCase();
		const value = match[2].trim();
		if (key === 'length' && solid === 'rectangular_prism') labels.width = value;
		else labels[key] = value;
	}
	return labels;
}

function inferNumberLineIntent(questionText: string): NumberLineIntent | undefined {
	const numbers = [...questionText.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
	if (numbers.length === 0) return undefined;
	const min = Math.min(...numbers);
	const max = Math.max(...numbers);
	const spread = Math.max(2, max - min);
	return {
		family: 'number-line',
		min: Math.floor(min - 1),
		max: Math.ceil(max + 1),
		tickInterval: spread > 10 ? 2 : 1,
		points: numbers.slice(0, 4).map((value) => ({ value, label: trimNumber(value), filled: true }))
	};
}

function extractCoordinatePoints(questionText: string): TextPoint[] {
	return [...questionText.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)].map((match) => ({
		x: Number(match[1]),
		y: Number(match[2])
	}));
}

function inferNamedCoordinatePoints(questionText: string): Array<{ id: string; label: string; x: number; y: number }> {
	return [...questionText.matchAll(/\b([A-Z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)].map((match) => ({
		id: match[1],
		label: `${match[1]}(${trimNumber(Number(match[2]))}, ${trimNumber(Number(match[3]))})`,
		x: Number(match[2]),
		y: Number(match[3])
	}));
}

function pointExists(diagram: DiagramSceneGraph, x?: number, y?: number): boolean {
	if (x == null || y == null) return false;
	return diagram.elements.some((element) => element.type === 'point' && almostEqual(element.x, x) && almostEqual(element.y, y));
}

function hasAxes(diagram: DiagramSceneGraph): boolean {
	return diagram.elements.some((element) => element.type === 'axes');
}

function defaultVertexLabels(shape: PolygonMeasurementIntent['shape']): string[] {
	if (shape === 'triangle') return ['A', 'B', 'C'];
	return ['A', 'B', 'C', 'D'];
}

function canonicalPolygon(shape: PolygonMeasurementIntent['shape'], labels: string[]) {
	if (shape === 'triangle') {
		return [
			{ id: labels[0], label: labels[0], x: 5, y: 1.2, labelPosition: 'top' },
			{ id: labels[1], label: labels[1], x: 1.6, y: 6.4, labelPosition: 'bottom-left' },
			{ id: labels[2], label: labels[2], x: 8.4, y: 6.4, labelPosition: 'bottom-right' }
		];
	}
	if (shape === 'parallelogram') {
		return [
			{ id: labels[0], label: labels[0], x: 2.2, y: 2.2, labelPosition: 'top-left' },
			{ id: labels[1], label: labels[1], x: 7, y: 2.2, labelPosition: 'top-right' },
			{ id: labels[2], label: labels[2], x: 8.6, y: 6.2, labelPosition: 'bottom-right' },
			{ id: labels[3], label: labels[3], x: 3.8, y: 6.2, labelPosition: 'bottom-left' }
		];
	}
	if (shape === 'trapezoid') {
		return [
			{ id: labels[0], label: labels[0], x: 3.1, y: 1.8, labelPosition: 'top-left' },
			{ id: labels[1], label: labels[1], x: 6.9, y: 1.8, labelPosition: 'top-right' },
			{ id: labels[2], label: labels[2], x: 8.3, y: 6.2, labelPosition: 'bottom-right' },
			{ id: labels[3], label: labels[3], x: 1.7, y: 6.2, labelPosition: 'bottom-left' }
		];
	}
	if (shape === 'rhombus') {
		return [
			{ id: labels[0], label: labels[0], x: 5, y: 1.4, labelPosition: 'top' },
			{ id: labels[1], label: labels[1], x: 8, y: 4, labelPosition: 'right' },
			{ id: labels[2], label: labels[2], x: 5, y: 6.6, labelPosition: 'bottom' },
			{ id: labels[3], label: labels[3], x: 2, y: 4, labelPosition: 'left' }
		];
	}
	if (shape === 'kite') {
		return [
			{ id: labels[0], label: labels[0], x: 5, y: 1.2, labelPosition: 'top' },
			{ id: labels[1], label: labels[1], x: 7.4, y: 4.2, labelPosition: 'right' },
			{ id: labels[2], label: labels[2], x: 5, y: 6.8, labelPosition: 'bottom' },
			{ id: labels[3], label: labels[3], x: 2.6, y: 4.2, labelPosition: 'left' }
		];
	}
	const width = shape === 'square' ? 4.2 : 5.4;
	return [
		{ id: labels[0], label: labels[0], x: 2.2, y: 2, labelPosition: 'top-left' },
		{ id: labels[1], label: labels[1], x: 2.2 + width, y: 2, labelPosition: 'top-right' },
		{ id: labels[2], label: labels[2], x: 2.2 + width, y: 6.1, labelPosition: 'bottom-right' },
		{ id: labels[3], label: labels[3], x: 2.2, y: 6.1, labelPosition: 'bottom-left' }
	];
}

function polygonEdges(labels: string[]): string[][] {
	return labels.map((label, index) => [label, labels[(index + 1) % labels.length]]);
}

function radialLengthLabel(x: number, y: number): string {
	const squareSum = x * x + y * y;
	const root = Math.sqrt(squareSum);
	if (almostEqual(root, Math.round(root))) {
		return `r = ${trimNumber(root)}`;
	}
	return `r = √${trimNumber(squareSum)}`;
}

function pointLabelPosition(x: number, y: number): string {
	if (x >= 0 && y >= 0) return 'top-right';
	if (x < 0 && y >= 0) return 'top-left';
	if (x < 0 && y < 0) return 'bottom-left';
	return 'bottom-right';
}

function canonicalSegmentKey(a: string, b: string): string {
	return [a, b].sort().join('-');
}

function parseIntentValue(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function objectProp(source: unknown, key: string): Record<string, unknown> | undefined {
	if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
	const value = (source as Record<string, unknown>)[key];
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	return value as Record<string, unknown>;
}

function stringProp(source: unknown, key: string): string | undefined {
	if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
	const value = (source as Record<string, unknown>)[key];
	return typeof value === 'string' ? value : undefined;
}

function numberProp(source: unknown, key: string): number | undefined {
	if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
	const value = (source as Record<string, unknown>)[key];
	return typeof value === 'number' ? value : undefined;
}

function booleanProp(source: unknown, key: string): boolean | undefined {
	if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
	const value = (source as Record<string, unknown>)[key];
	return typeof value === 'boolean' ? value : undefined;
}

function arrayProp(source: unknown, key: string): unknown[] {
	if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
	const value = (source as Record<string, unknown>)[key];
	return Array.isArray(value) ? value : [];
}

function stringArrayProp(source: unknown, key: string): string[] | undefined {
	const values = arrayProp(source, key).filter((value): value is string => typeof value === 'string');
	return values.length > 0 ? values : undefined;
}

function recordProp(source: unknown, key: string): Record<string, string> | undefined {
	if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
	const value = (source as Record<string, unknown>)[key];
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function enumProp<T extends string>(source: unknown, key: string, values: readonly T[]): T | undefined {
	const value = stringProp(source, key);
	return value && values.includes(value as T) ? value as T : undefined;
}

function almostEqual(a?: number, b?: number, epsilon: number = 0.02): boolean {
	return a != null && b != null ? Math.abs(a - b) <= epsilon : false;
}

function trimNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}
