import type { DiagramElement } from '$lib/data/types';

export type PointMap = Map<string, { x: number; y: number }>;

export function buildPointMap(elements: DiagramElement[]): PointMap {
	const map: PointMap = new Map();
	for (const el of elements) {
		if (el.type === 'point' && el.id && el.x != null && el.y != null) {
			map.set(el.id, { x: el.x, y: el.y });
		}
	}
	return map;
}

export function resolvePoint(id: string, pointMap: PointMap): { x: number; y: number } | null {
	return pointMap.get(id) ?? null;
}

/**
 * Sort elements into rendering layers so geometry draws in the right order:
 * 1. Fills (polygons)  2. Lines/segments  3. Marks  4. Points  5. Labels
 */
export function sortElementsByLayer(elements: DiagramElement[]): DiagramElement[] {
	const order: Record<string, number> = {
		polygon: 0, axes: 1, number_line: 1,
		line: 2, ray: 2, segment: 2, circle: 2, arc: 2, curve: 2,
		angle_arc: 3, right_angle: 3, tick_marks: 3, parallel_marks: 3,
		point: 4, label: 5
	};
	return [...elements].sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3));
}

export function extendLineToViewBox(
	p1: { x: number; y: number }, p2: { x: number; y: number },
	width: number, height: number, padding: number = 0.5
) {
	const dx = p2.x - p1.x, dy = p2.y - p1.y;
	if (dx === 0 && dy === 0) return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
	let tMin = -1000, tMax = 1000;
	if (dx !== 0) {
		const t1 = (-padding - p1.x) / dx, t2 = (width + padding - p1.x) / dx;
		tMin = Math.max(tMin, Math.min(t1, t2));
		tMax = Math.min(tMax, Math.max(t1, t2));
	}
	if (dy !== 0) {
		const t1 = (-padding - p1.y) / dy, t2 = (height + padding - p1.y) / dy;
		tMin = Math.max(tMin, Math.min(t1, t2));
		tMax = Math.min(tMax, Math.max(t1, t2));
	}
	return { x1: p1.x + dx * tMin, y1: p1.y + dy * tMin, x2: p1.x + dx * tMax, y2: p1.y + dy * tMax };
}

export function extendRayToViewBox(
	origin: { x: number; y: number }, through: { x: number; y: number },
	width: number, height: number, padding: number = 0.5
) {
	const dx = through.x - origin.x, dy = through.y - origin.y;
	if (dx === 0 && dy === 0) return through;
	let tMax = 1000;
	if (dx !== 0) {
		const t1 = (-padding - origin.x) / dx, t2 = (width + padding - origin.x) / dx;
		const maxT = Math.max(t1, t2);
		if (maxT > 0) tMax = Math.min(tMax, maxT);
	}
	if (dy !== 0) {
		const t1 = (-padding - origin.y) / dy, t2 = (height + padding - origin.y) / dy;
		const maxT = Math.max(t1, t2);
		if (maxT > 0) tMax = Math.min(tMax, maxT);
	}
	return { x: origin.x + dx * tMax, y: origin.y + dy * tMax };
}

/** Normalize angle to [0, 360) */
function normAngle(a: number): number {
	return ((a % 360) + 360) % 360;
}

/**
 * SVG arc path in screen coordinates (y-down, angles clockwise).
 * Draws the SHORTER arc between two angles.
 */
export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
	const s = normAngle(startDeg);
	const e = normAngle(endDeg);
	let sweep = normAngle(e - s);
	// Always take the shorter path for angle markers
	if (sweep > 180) sweep = 360 - sweep;
	const largeArc = sweep > 180 ? 1 : 0;

	const sRad = (s * Math.PI) / 180;
	const eActual = s + (normAngle(e - s) <= 180 ? normAngle(e - s) : -(360 - normAngle(e - s)));
	const eRad = (eActual * Math.PI) / 180;
	const sweepFlag = eActual > s ? 1 : 0;

	const x1 = cx + r * Math.cos(sRad);
	const y1 = cy + r * Math.sin(sRad);
	const x2 = cx + r * Math.cos(eRad);
	const y2 = cy + r * Math.sin(eRad);

	return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${x2} ${y2}`;
}

/**
 * Get angle bisector direction in screen coordinates (y-down).
 * Returns the midpoint angle (radians) of the smaller arc between two rays from vertex.
 */
export function angleBisector(vx: number, vy: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
	const a1 = Math.atan2(p1y - vy, p1x - vx);
	const a2 = Math.atan2(p2y - vy, p2x - vx);
	let diff = a2 - a1;
	while (diff > Math.PI) diff -= 2 * Math.PI;
	while (diff <= -Math.PI) diff += 2 * Math.PI;
	return a1 + diff / 2;
}

export function perpOffset(x1: number, y1: number, x2: number, y2: number, dist: number) {
	const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
	const dx = x2 - x1, dy = y2 - y1;
	const len = Math.sqrt(dx * dx + dy * dy);
	if (len === 0) return { x: mx, y: my + dist };
	return { x: mx + (-dy / len) * dist, y: my + (dx / len) * dist };
}

export function bezierPath(points: { x: number; y: number }[]): string {
	if (points.length === 0) return '';
	if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
	if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
	let d = `M ${points[0].x} ${points[0].y}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(0, i - 1)];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[Math.min(points.length - 1, i + 2)];
		d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
	}
	return d;
}

/**
 * Label offset in SCREEN coordinates (y increases downward).
 * "top" means label above the point (negative y offset).
 */
export function labelOffset(position: string | undefined, dist: number = 0.55): { dx: number; dy: number } {
	switch (position) {
		case 'top': return { dx: 0, dy: -dist };
		case 'bottom': return { dx: 0, dy: dist };
		case 'left': return { dx: -dist, dy: 0 };
		case 'right': return { dx: dist, dy: 0 };
		case 'top-left': return { dx: -dist * 0.7, dy: -dist * 0.7 };
		case 'top-right': return { dx: dist * 0.7, dy: -dist * 0.7 };
		case 'bottom-left': return { dx: -dist * 0.7, dy: dist * 0.7 };
		case 'bottom-right': return { dx: dist * 0.7, dy: dist * 0.7 };
		default: return { dx: dist * 0.7, dy: -dist * 0.7 };
	}
}
