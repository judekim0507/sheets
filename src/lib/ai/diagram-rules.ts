/**
 * These rules get appended to EVERY prompt (system, edit, regen)
 * so the LLM can never ignore them.
 */
export const DIAGRAM_RULES = `
## DIAGRAM REQUIREMENTS — DO NOT SKIP ANY OF THESE:

1. Every vertex of a shape MUST have a point in the "points" array with BOTH "id" and "label" fields set to the vertex letter.
   Example: { "id": "A", "x": 5, "y": 1, "label": "A", "label_position": "top" }

2. Every side with a known length MUST have a segment in the "segments" array with a "label" field showing the measurement.
   Example: { "from": "A", "to": "B", "label": "10 cm" }

3. Every angle mentioned MUST have an entry in "angle_arcs" with a "label" field showing the degree.
   Example: { "vertex": "A", "ray1_through": "B", "ray2_through": "C", "label": "60°" }
   For right angles (90°), use "right_angles" instead.

4. The label field on points is NOT optional. Every point MUST have label set.

5. Use y-DOWN screen coordinates: top of shape = small y value, bottom = large y value.
   A triangle pointing up: apex at y=1, base vertices at y=7.

6. Width/height should be about 10x8. Keep all coordinates within bounds with at least 0.5 margin from edges.`;
