import type { DiagramSceneGraph, DiagramElement } from '$lib/data/types';

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

	const arr = (key: string) => (Array.isArray(raw[key]) ? raw[key] : []) as Record<string, unknown>[];

	for (const p of arr('points')) {
		elements.push({ type: 'point', id: s(p.id), x: n(p.x), y: n(p.y), label: s(p.label), label_position: s(p.label_position), filled: b(p.filled), style: s(p.style) as 'solid' | 'dashed' | undefined });
	}
	for (const seg of arr('segments')) {
		elements.push({ type: 'segment', from: s(seg.from), to: s(seg.to), label: s(seg.label), style: s(seg.style) as 'solid' | 'dashed' | undefined });
	}
	for (const line of arr('lines')) {
		elements.push({ type: 'line', through_points: line.through_points as string[] });
	}
	for (const ray of arr('rays')) {
		elements.push({ type: 'ray', origin: s(ray.origin), through: s(ray.through) });
	}
	for (const poly of arr('polygons')) {
		elements.push({ type: 'polygon', vertices: poly.vertices as string[], fill: s(poly.fill) });
	}
	for (const c of arr('circles')) {
		elements.push({ type: 'circle', center: s(c.center), radius: n(c.radius), through: s(c.through) });
	}
	for (const a of arr('arcs')) {
		elements.push({ type: 'arc', center: s(a.center), radius: n(a.radius)!, start_angle: n(a.start_angle)!, end_angle: n(a.end_angle)! });
	}
	for (const aa of arr('angle_arcs')) {
		elements.push({ type: 'angle_arc', vertex: s(aa.vertex), ray1_through: s(aa.ray1_through), ray2_through: s(aa.ray2_through), radius: n(aa.radius), label: s(aa.label) });
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
		elements.push({ type: 'curve', curve_points: c.curve_points as { x: number; y: number }[], smooth: b(c.smooth) });
	}
	for (const l of arr('labels')) {
		elements.push({ type: 'label', x: n(l.x), y: n(l.y), text: s(l.text), font_size: n(l.font_size) });
	}
	for (const tm of arr('tick_marks')) {
		elements.push({ type: 'tick_marks', segment_from: s(tm.segment_from), segment_to: s(tm.segment_to), count: n(tm.count) });
	}
	for (const pm of arr('parallel_marks')) {
		elements.push({ type: 'parallel_marks', segment_from: s(pm.segment_from), segment_to: s(pm.segment_to), count: n(pm.count) });
	}
	// 3D shapes
	for (const rp of arr('rectangular_prisms')) {
		elements.push({ type: 'rectangular_prism', cx: n(rp.cx), cy: n(rp.cy), shape_width: n(rp.shape_width), shape_height: n(rp.shape_height), depth: n(rp.depth), vertex_labels: rp.vertex_labels as Record<string, string>, dimension_labels: rp.dimension_labels as Record<string, string> });
	}
	for (const cy of arr('cylinders')) {
		elements.push({ type: 'cylinder', cx: n(cy.cx), cy: n(cy.cy), radius: n(cy.radius), shape_height: n(cy.shape_height), dimension_labels: cy.dimension_labels as Record<string, string> });
	}
	for (const co of arr('cones')) {
		elements.push({ type: 'cone', cx: n(co.cx), cy: n(co.cy), radius: n(co.radius), shape_height: n(co.shape_height), dimension_labels: co.dimension_labels as Record<string, string> });
	}
	for (const sp of arr('spheres')) {
		elements.push({ type: 'sphere', cx: n(sp.cx), cy: n(sp.cy), radius: n(sp.radius), dimension_labels: sp.dimension_labels as Record<string, string> });
	}
	for (const py of arr('pyramids')) {
		elements.push({ type: 'pyramid', cx: n(py.cx), cy: n(py.cy), shape_width: n(py.base_width), depth: n(py.base_depth), shape_height: n(py.shape_height), vertex_labels: py.vertex_labels as Record<string, string>, dimension_labels: py.dimension_labels as Record<string, string> });
	}

	if (elements.length === 0) return undefined;
	return { width, height, elements };
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
