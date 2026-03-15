import type { GeneratedQuestion, DiagramElement, DiagramSceneGraph } from '$lib/data/types';

/**
 * Post-process a generated question to fix common diagram issues:
 * 1. Copy point id → label if label is missing
 * 2. Infer label_position from point coordinates
 * 3. Extract measurements from question text and add to unlabeled segments
 * 4. Detect angle references and add angle_arc if missing
 */
export function fixDiagram(q: GeneratedQuestion): GeneratedQuestion {
	if (!q.has_diagram || !q.diagram || !q.diagram.elements) return q;

	const elements = [...q.diagram.elements.map((e) => ({ ...e }))];
	const text = q.question;

	// Build point map
	const pointMap = new Map<string, { x: number; y: number }>();
	for (const el of elements) {
		if (el.type === 'point' && el.id && el.x != null && el.y != null) {
			pointMap.set(el.id, { x: el.x, y: el.y });
		}
	}

	// 1. Fix point labels and positions
	for (const el of elements) {
		if (el.type !== 'point') continue;
		// Copy id to label if missing
		if (!el.label && el.id) {
			el.label = el.id;
		}
		// Set label_position if missing, based on position relative to center
		if (!el.label_position && el.x != null && el.y != null) {
			el.label_position = inferLabelPosition(el.x, el.y, q.diagram.width, q.diagram.height, pointMap);
		}
	}

	// 2. Try to add measurement labels to segments
	const measurements = extractMeasurements(text);
	for (const el of elements) {
		if (el.type !== 'segment' || el.label) continue;
		if (!el.from || !el.to) continue;
		// Check if there's a measurement for this segment (e.g., "AB = 10 cm" or "side a = 10")
		const label = findSegmentMeasurement(el.from, el.to, measurements);
		if (label) el.label = label;
	}

	// 3. Try to add angle_arc for mentioned angles
	const angleRefs = extractAngleReferences(text);
	const existingAngleVertices = new Set(
		elements.filter((e) => e.type === 'angle_arc' || e.type === 'right_angle').map((e) => e.vertex)
	);

	for (const ref of angleRefs) {
		if (existingAngleVertices.has(ref.vertex)) continue;
		if (!pointMap.has(ref.vertex)) continue; // vertex must exist as a point
		const neighbors = findNeighbors(ref.vertex, elements).filter((n) => pointMap.has(n));
		if (neighbors.length >= 2) {
			elements.push({
				type: 'angle_arc',
				vertex: ref.vertex,
				ray1_through: neighbors[0],
				ray2_through: neighbors[1],
				label: ref.label,
				radius: 0.7
			});
		}
	}

	return {
		...q,
		diagram: { ...q.diagram, elements }
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

	if (Math.abs(dx) < 0.5 && dy < 0) return 'top';
	if (Math.abs(dx) < 0.5 && dy > 0) return 'bottom';
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
	label: string;
}

function extractAngleReferences(text: string): AngleRef[] {
	const results: AngleRef[] = [];
	const cleaned = text.replace(/\$/g, '');

	// Match: ∠A = 60°, ∠P = 30°, angle A = 45°, ∠ABC = 90°
	const anglePattern = /(?:∠|\\angle\s*|angle\s+)([A-Z](?:[A-Z]{2})?)\s*=\s*([\d.]+)°?/gi;
	for (const m of cleaned.matchAll(anglePattern)) {
		const letters = m[1].toUpperCase();
		// For ∠ABC, vertex is the middle letter B
		const vertex = letters.length === 3 ? letters[1] : letters[0];
		results.push({ vertex, label: `${m[2]}°` });
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
