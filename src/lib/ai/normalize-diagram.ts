import type { DiagramSceneGraph, DiagramElement, DiagramGraph, GraphExpression } from '$lib/data/types';

/**
 * Convert typed-array diagram format (from schema) to flat element array (for renderer).
 * The schema uses separate arrays per type (points[], segments[], etc.)
 * but the renderer expects a single elements[] with a `type` field.
 */
export function normalizeDiagram(raw: Record<string, unknown>): DiagramSceneGraph | undefined {
	if (!raw || typeof raw !== 'object') return undefined;

	const width = (raw.width as number) ?? 10;
	const height = (raw.height as number) ?? 8;
	const elements: DiagramElement[] = [];
	const graph = normalizeGraph(raw.graph);

	const arr = (key: string) => (Array.isArray(raw[key]) ? raw[key] : []) as Record<string, unknown>[];

	for (const p of arr('points')) {
		elements.push({ type: 'point', id: s(p.id), x: n(p.x), y: n(p.y), label: s(p.label), label_position: s(p.label_position), filled: b(p.filled), style: s(p.style) as 'solid' | 'dashed' | undefined });
	}
	for (const seg of arr('segments')) {
		elements.push({ type: 'segment', from: s(seg.from), to: s(seg.to), label: s(seg.label), style: s(seg.style) as 'solid' | 'dashed' | undefined, stroke: s(seg.stroke), stroke_opacity: n(seg.stroke_opacity) });
	}
	for (const line of arr('lines')) {
		elements.push({ type: 'line', through_points: line.through_points as string[], style: s(line.style) as 'solid' | 'dashed' | undefined, stroke: s(line.stroke), stroke_opacity: n(line.stroke_opacity) });
	}
	for (const ray of arr('rays')) {
		elements.push({ type: 'ray', origin: s(ray.origin), through: s(ray.through), style: s(ray.style) as 'solid' | 'dashed' | undefined, stroke: s(ray.stroke), stroke_opacity: n(ray.stroke_opacity) });
	}
	for (const poly of arr('polygons')) {
		elements.push({ type: 'polygon', vertices: poly.vertices as string[], fill: s(poly.fill), fill_opacity: n(poly.fill_opacity), stroke: s(poly.stroke), stroke_opacity: n(poly.stroke_opacity), style: s(poly.style) as 'solid' | 'dashed' | undefined });
	}
	for (const c of arr('circles')) {
		elements.push({ type: 'circle', center: s(c.center), radius: n(c.radius), through: s(c.through), fill: s(c.fill), fill_opacity: n(c.fill_opacity), stroke: s(c.stroke), stroke_opacity: n(c.stroke_opacity), style: s(c.style) as 'solid' | 'dashed' | undefined });
	}
	for (const a of arr('arcs')) {
		elements.push({ type: 'arc', center: s(a.center), radius: n(a.radius)!, start_angle: n(a.start_angle)!, end_angle: n(a.end_angle)!, stroke: s(a.stroke), stroke_opacity: n(a.stroke_opacity), style: s(a.style) as 'solid' | 'dashed' | undefined });
	}
	for (const sector of arr('sectors')) {
		elements.push({ type: 'sector', center: s(sector.center), radius: n(sector.radius), start_angle: n(sector.start_angle), end_angle: n(sector.end_angle), fill: s(sector.fill), fill_opacity: n(sector.fill_opacity), stroke: s(sector.stroke), stroke_opacity: n(sector.stroke_opacity), label: s(sector.label), style: s(sector.style) as 'solid' | 'dashed' | undefined });
	}
	for (const aa of arr('angle_arcs')) {
		elements.push({ type: 'angle_arc', vertex: s(aa.vertex), ray1_through: s(aa.ray1_through), ray2_through: s(aa.ray2_through), radius: n(aa.radius), label: s(aa.label), style: s(aa.style) as 'solid' | 'dashed' | undefined });
	}
	for (const ra of arr('right_angles')) {
		elements.push({ type: 'right_angle', vertex: s(ra.vertex), ray1_through: s(ra.ray1_through), ray2_through: s(ra.ray2_through), size: n(ra.size) });
	}
	for (const ax of arr('axes')) {
		elements.push({ type: 'axes', x_min: n(ax.x_min), x_max: n(ax.x_max), y_min: n(ax.y_min), y_max: n(ax.y_max), x_label: s(ax.x_label), y_label: s(ax.y_label), grid: b(ax.grid), tick_interval: n(ax.tick_interval) });
	}
	for (const nl of arr('number_lines')) {
		elements.push({ type: 'number_line', min: n(nl.min), max: n(nl.max), tick_interval: n(nl.tick_interval), points: nl.points as DiagramElement['points'] });
	}
	for (const c of arr('curves')) {
		elements.push({ type: 'curve', curve_points: c.curve_points as { x: number; y: number }[], smooth: b(c.smooth), style: s(c.style) as 'solid' | 'dashed' | undefined });
	}
	for (const l of arr('labels')) {
		elements.push({ type: 'label', x: n(l.x), y: n(l.y), text: s(l.text), font_size: n(l.font_size), fill: s(l.fill) });
	}
	for (const tm of arr('tick_marks')) {
		elements.push({ type: 'tick_marks', segment_from: s(tm.segment_from), segment_to: s(tm.segment_to), count: n(tm.count) });
	}
	for (const pm of arr('parallel_marks')) {
		elements.push({ type: 'parallel_marks', segment_from: s(pm.segment_from), segment_to: s(pm.segment_to), count: n(pm.count) });
	}
	// 3D shapes — convert flat label fields to dimension_labels Record
	for (const rp of arr('rectangular_prisms')) {
		const dl = dimensionLabels(rp);
		if (s(rp.width_label)) dl.width = s(rp.width_label)!;
		if (s(rp.height_label)) dl.height = s(rp.height_label)!;
		if (s(rp.depth_label)) dl.depth = s(rp.depth_label)!;
		elements.push({
			type: 'rectangular_prism',
			cx: n(rp.cx),
			cy: n(rp.cy),
			shape_width: n(rp.shape_width),
			shape_height: n(rp.shape_height),
			depth: n(rp.depth),
			dimension_labels: Object.keys(dl).length > 0 ? dl : undefined,
			vertex_labels: record(rp.vertex_labels)
		});
	}
	for (const cy of arr('cylinders')) {
		const dl = dimensionLabels(cy);
		if (s(cy.radius_label)) dl.radius = s(cy.radius_label)!;
		if (s(cy.height_label)) dl.height = s(cy.height_label)!;
		elements.push({ type: 'cylinder', cx: n(cy.cx), cy: n(cy.cy), radius: n(cy.radius), shape_height: n(cy.shape_height), dimension_labels: Object.keys(dl).length > 0 ? dl : undefined });
	}
	for (const co of arr('cones')) {
		const dl = dimensionLabels(co);
		if (s(co.radius_label)) dl.radius = s(co.radius_label)!;
		if (s(co.height_label)) dl.height = s(co.height_label)!;
		if (s(co.slant_label)) dl.slant = s(co.slant_label)!;
		elements.push({ type: 'cone', cx: n(co.cx), cy: n(co.cy), radius: n(co.radius), shape_height: n(co.shape_height), dimension_labels: Object.keys(dl).length > 0 ? dl : undefined });
	}
	for (const sp of arr('spheres')) {
		const dl = dimensionLabels(sp);
		if (s(sp.radius_label)) dl.radius = s(sp.radius_label)!;
		elements.push({ type: 'sphere', cx: n(sp.cx), cy: n(sp.cy), radius: n(sp.radius), dimension_labels: Object.keys(dl).length > 0 ? dl : undefined });
	}
	for (const py of arr('pyramids')) {
		const dl = dimensionLabels(py);
		if (s(py.base_label)) dl.base = s(py.base_label)!;
		if (s(py.height_label)) dl.height = s(py.height_label)!;
		elements.push({ type: 'pyramid', cx: n(py.cx), cy: n(py.cy), shape_width: n(py.base_width), depth: n(py.base_depth), shape_height: n(py.shape_height), dimension_labels: Object.keys(dl).length > 0 ? dl : undefined });
	}

	if (elements.length === 0 && !graph) return undefined;
	return { width, height, elements, graph };
}

function s(v: unknown): string | undefined {
	return typeof v === 'string' ? v : undefined;
}

function n(v: unknown): number | undefined {
	return typeof v === 'number' ? v : undefined;
}

function b(v: unknown): boolean | undefined {
	return typeof v === 'boolean' ? v : undefined;
}

function record(v: unknown): Record<string, string> | undefined {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
	const entries = Object.entries(v).filter(([, value]) => typeof value === 'string');
	return entries.length > 0 ? Object.fromEntries(entries) as Record<string, string> : undefined;
}

function dimensionLabels(v: Record<string, unknown>): Record<string, string> {
	return record(v.dimension_labels) ?? {};
}

function normalizeGraph(rawGraph: unknown): DiagramGraph | undefined {
	if (!rawGraph || typeof rawGraph !== 'object' || Array.isArray(rawGraph)) return undefined;
	const graph = rawGraph as Record<string, unknown>;
	const viewport = graph.viewport;
	if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport)) return undefined;
	const vp = viewport as Record<string, unknown>;
	const left = n(vp.left);
	const right = n(vp.right);
	const bottom = n(vp.bottom);
	const top = n(vp.top);
	if (left == null || right == null || bottom == null || top == null) return undefined;

	const expressions = (Array.isArray(graph.expressions) ? graph.expressions : [])
		.map((expr, index) => normalizeGraphExpression(expr, index))
		.filter((expr): expr is GraphExpression => expr !== undefined);

	if (expressions.length === 0) return undefined;

	return {
		viewport: { left, right, bottom, top },
		expressions,
		degree_mode: b(graph.degree_mode),
		show_grid: b(graph.show_grid),
		show_x_axis: b(graph.show_x_axis),
		show_y_axis: b(graph.show_y_axis),
		show_x_axis_numbers: b(graph.show_x_axis_numbers),
		show_y_axis_numbers: b(graph.show_y_axis_numbers)
	};
}

function normalizeGraphExpression(rawExpr: unknown, index: number): GraphExpression | undefined {
	if (!rawExpr || typeof rawExpr !== 'object' || Array.isArray(rawExpr)) return undefined;
	const expr = rawExpr as Record<string, unknown>;
	const latex = s(expr.latex);
	if (!latex) return undefined;
	return {
		id: s(expr.id) ?? `expr-${index + 1}`,
		latex,
		color: s(expr.color),
		line_style: s(expr.line_style) as GraphExpression['line_style'],
		point_style: s(expr.point_style) as GraphExpression['point_style'],
		points: b(expr.points),
		lines: b(expr.lines),
		fill: b(expr.fill),
		fill_opacity: n(expr.fill_opacity),
		hidden: b(expr.hidden),
		label: s(expr.label),
		show_label: b(expr.show_label)
	};
}
