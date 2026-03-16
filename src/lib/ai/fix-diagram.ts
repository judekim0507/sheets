import type { GeneratedQuestion, DiagramElement, DiagramSceneGraph } from '$lib/data/types';
import { normalizeDiagram } from './normalize-diagram';

/**
 * Post-process a generated question:
 * 0. Normalize typed-array diagram to flat elements array
 * 1. Copy point id → label if label is missing
 * 2. Infer label_position from point coordinates
 * 3. Extract measurements from question text and add to unlabeled segments
 * 4. Detect angle references and add angle_arc if missing
 */
// Accept raw schema output (typed arrays) or already-normalized (flat elements)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fixDiagram(q: any): GeneratedQuestion {
	if (!q.has_diagram || !q.diagram) return q as GeneratedQuestion;

	// Normalize typed-array format (from schema) to flat elements array (for renderer)
	const raw = q.diagram as Record<string, unknown>;
	let diagram: DiagramSceneGraph;
	if (Array.isArray(raw.elements)) {
		diagram = raw as unknown as DiagramSceneGraph;
	} else {
		const normalized = normalizeDiagram(raw);
		if (!normalized) return { ...q, has_diagram: false, diagram: undefined } as GeneratedQuestion;
		diagram = normalized;
	}

	const elements = [...diagram.elements.map((e) => ({ ...e }))];
	const text = q.question;

	// Build point map
	const pointMap = new Map<string, { x: number; y: number }>();
	for (const el of elements) {
		if (el.type === 'point' && el.id && el.x != null && el.y != null) {
			pointMap.set(el.id, { x: el.x, y: el.y });
		}
	}

	// Check if this is a graph/axes diagram (don't auto-label points on graphs)
	const isGraphDiagram = elements.some((e) => e.type === 'axes');

	// 1. Fix point labels, positions, and validate coordinates
	for (const el of elements) {
		if (el.type !== 'point') continue;
		if (el.x == null || el.y == null) continue;
		// For graph diagrams: DON'T auto-copy id→label (points are just markers, not vertices)
		// Only keep labels the LLM explicitly set (like "(2,0)" for intercepts)
		if (!isGraphDiagram) {
			if (!el.label && el.id) {
				el.label = el.id;
			}
			if (!el.label_position) {
				el.label_position = inferLabelPosition(el.x, el.y, diagram.width, diagram.height, pointMap);
			}
		} else {
			// On graphs, strip single-letter labels (like "A", "B") — they're noise
			// Keep coordinate labels like "(2,0)" or descriptive ones
			if (el.label && /^[A-Z]$/.test(el.label)) {
				el.label = undefined;
			}
		}
	}
	// Remove invalid points (no coordinates)
	for (let i = elements.length - 1; i >= 0; i--) {
		if (elements[i].type === 'point' && (elements[i].x == null || elements[i].y == null)) {
			elements.splice(i, 1);
		}
	}

	// 2. Auto-generate segments for polygons that are missing them
	const existingSegments = new Set(
		elements.filter((e) => e.type === 'segment' && e.from && e.to)
			.map((e) => [e.from, e.to].sort().join('-'))
	);
	for (const el of elements) {
		if (el.type !== 'polygon' || !el.vertices || el.vertices.length < 3) continue;
		for (let i = 0; i < el.vertices.length; i++) {
			const from = el.vertices[i];
			const to = el.vertices[(i + 1) % el.vertices.length];
			const key = [from, to].sort().join('-');
			if (!existingSegments.has(key) && pointMap.has(from) && pointMap.has(to)) {
				elements.push({ type: 'segment', from, to });
				existingSegments.add(key);
			}
		}
	}

	// 3. Try to add measurement labels to segments
	const measurements = extractMeasurements(text);
	for (const el of elements) {
		if (el.type !== 'segment' || el.label) continue;
		if (!el.from || !el.to) continue;
		const label = findSegmentMeasurement(el.from, el.to, measurements);
		if (label) el.label = label;
	}

	// 3b. For rectangles: extract width/height from text and apply to segments
	const widthMatch = text.match(/width\s*(?:of|is|=|:)?\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?)?)/i);
	const heightMatch = text.match(/height\s*(?:of|is|=|:)?\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?)?)/i);
	const lengthMatch = text.match(/length\s*(?:of|is|=|:)?\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?)?)/i);
	if (widthMatch || heightMatch || lengthMatch) {
		const wLabel = widthMatch?.[1]?.trim() || lengthMatch?.[1]?.trim();
		const hLabel = heightMatch?.[1]?.trim();
		for (const el of elements) {
			if (el.type !== 'segment' || el.label || !el.from || !el.to) continue;
			const p1 = pointMap.get(el.from);
			const p2 = pointMap.get(el.to);
			if (!p1 || !p2) continue;
			const isHorizontal = Math.abs(p1.y - p2.y) < Math.abs(p1.x - p2.x);
			if (isHorizontal && wLabel && !el.label) el.label = wLabel;
			else if (!isHorizontal && hLabel && !el.label) el.label = hLabel;
		}
	}

	// 4. Try to add angle_arc for mentioned angles
	const angleRefs = extractAngleReferences(text);
	const existingAngleVertices = new Set(
		elements.filter((e) => e.type === 'angle_arc' || e.type === 'right_angle').map((e) => e.vertex)
	);

	for (const ref of angleRefs) {
		if (existingAngleVertices.has(ref.vertex)) continue;
		if (!pointMap.has(ref.vertex)) continue;

		let r1: string | undefined;
		let r2: string | undefined;

		// Use explicit ray points from triple (∠ABC → A and C) if they exist
		if (ref.ray1 && ref.ray2 && pointMap.has(ref.ray1) && pointMap.has(ref.ray2)) {
			r1 = ref.ray1;
			r2 = ref.ray2;
		} else {
			// Fall back to polygon/segment neighbors
			const neighbors = findNeighbors(ref.vertex, elements).filter((n) => pointMap.has(n));
			if (neighbors.length >= 2) {
				r1 = neighbors[0];
				r2 = neighbors[1];
			}
		}

		if (r1 && r2) {
			elements.push({
				type: 'angle_arc',
				vertex: ref.vertex,
				ray1_through: r1,
				ray2_through: r2,
				label: ref.label,
				radius: 0.7
			});
		}
	}

	return {
		...q,
		diagram: { width: diagram.width, height: diagram.height, elements }
	};
}

function inferLabelPosition(
	x: number, y: number, w: number, h: number,
	pointMap: Map<string, { x: number; y: number }>
): string {
	// Find centroid of all points
	const pts = [...pointMap.values()];
	if (pts.length === 0) return 'top';
	const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
	const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

	// Place label away from centroid
	const dx = x - cx;
	const dy = y - cy;

	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);

	// Primarily horizontal offset → left/right
	if (absDx > absDy * 2) return dx < 0 ? 'left' : 'right';
	// Primarily vertical offset → top/bottom
	if (absDy > absDx * 2) return dy < 0 ? 'top' : 'bottom';
	// Diagonal
	if (dx < 0 && dy < 0) return 'top-left';
	if (dx > 0 && dy < 0) return 'top-right';
	if (dx < 0 && dy > 0) return 'bottom-left';
	if (dx > 0 && dy > 0) return 'bottom-right';
	return 'top';
}

interface Measurement {
	/** Could be "AB", "PQ", "a", "p", etc. */
	key: string;
	value: string;
}

function extractMeasurements(text: string): Measurement[] {
	const results: Measurement[] = [];

	// Match patterns like: AB = 10 cm, side a = 5, PQ = 12 units, a = 10
	// Also: $a = 10$, $AB = 15$ cm
	const cleaned = text.replace(/\$/g, '');

	// "AB = 10 cm" or "AB = 10"
	const segPattern = /([A-Z]{2})\s*=\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?|)?)/gi;
	for (const m of cleaned.matchAll(segPattern)) {
		results.push({ key: m[1].toUpperCase(), value: m[2].trim() });
	}

	// "side a = 10" or "a = 10 cm"
	const sidePattern = /(?:side\s+)?([a-z])\s*=\s*([\d.]+\s*(?:cm|m|mm|in|ft|units?|)?)/gi;
	for (const m of cleaned.matchAll(sidePattern)) {
		results.push({ key: m[1].toLowerCase(), value: m[2].trim() });
	}

	return results;
}

function findSegmentMeasurement(fromId: string, toId: string, measurements: Measurement[]): string | null {
	// Direct match: "AB" for segment from A to B
	const pair = fromId + toId;
	const pairRev = toId + fromId;
	for (const m of measurements) {
		if (m.key === pair || m.key === pairRev) return m.value;
	}

	// Lowercase side name: in triangle ABC, side "a" is opposite vertex A (= side BC)
	// side "a" → opposite A → segment BC
	// This is a convention: side a is opposite vertex A
	for (const m of measurements) {
		if (m.key.length === 1) {
			const opposite = m.key.toUpperCase();
			// If neither endpoint is the opposite vertex, this segment could be "side a"
			if (fromId !== opposite && toId !== opposite) {
				// Only assign if we haven't already found a match
				return m.value;
			}
		}
	}

	return null;
}

interface AngleRef {
	vertex: string;
	ray1?: string; // first letter of triple (if ∠ABC, this is A)
	ray2?: string; // third letter of triple (if ∠ABC, this is C)
	label: string;
}

function extractAngleReferences(text: string): AngleRef[] {
	const results: AngleRef[] = [];
	const cleaned = text.replace(/\$/g, '');

	// Match: ∠A = 60°, ∠P = 30°, angle A = 45°, ∠ABC = 90°
	const anglePattern = /(?:∠|\\angle\s*|angle\s+)([A-Z](?:[A-Z]{2})?)\s*=\s*([\d.]+)°?/gi;
	for (const m of cleaned.matchAll(anglePattern)) {
		const letters = m[1].toUpperCase();
		if (letters.length === 3) {
			// ∠ABC → vertex B, rays through A and C
			results.push({ vertex: letters[1], ray1: letters[0], ray2: letters[2], label: `${m[2]}°` });
		} else {
			results.push({ vertex: letters[0], label: `${m[2]}°` });
		}
	}

	return results;
}

function findNeighbors(pointId: string, elements: DiagramElement[]): string[] {
	const neighbors = new Set<string>();

	for (const el of elements) {
		if (el.type === 'segment') {
			if (el.from === pointId && el.to) neighbors.add(el.to);
			if (el.to === pointId && el.from) neighbors.add(el.from);
		}
		if (el.type === 'polygon' && el.vertices) {
			const idx = el.vertices.indexOf(pointId);
			if (idx >= 0) {
				const prev = el.vertices[(idx - 1 + el.vertices.length) % el.vertices.length];
				const next = el.vertices[(idx + 1) % el.vertices.length];
				neighbors.add(prev);
				neighbors.add(next);
			}
		}
	}

	return [...neighbors];
}
