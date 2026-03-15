/**
 * These rules get appended to EVERY prompt (system, edit, regen)
 * so the LLM can never ignore them.
 */
export const DIAGRAM_RULES = `
## DIAGRAM REQUIREMENTS — DO NOT SKIP ANY OF THESE:

1. Every vertex of a shape MUST have a point element with BOTH "id" and "label" fields set to the vertex letter.
   Example: { "type": "point", "id": "A", "x": 5, "y": 1, "label": "A", "label_position": "top" }
   If you reference triangle PQR, you MUST create points with id="P" label="P", id="Q" label="Q", id="R" label="R".

2. Every side with a known length MUST have a segment element with a "label" field showing the measurement.
   Example: { "type": "segment", "from": "A", "to": "B", "label": "10 cm" }
   If the question says side AB = 10 cm, the segment MUST have label: "10 cm".

3. Every angle mentioned MUST have an angle_arc element with a "label" field showing the degree.
   Example: { "type": "angle_arc", "vertex": "A", "ray1_through": "B", "ray2_through": "C", "label": "60°" }
   If the question says ∠A = 60°, you MUST include this angle_arc. For right angles (90°), use right_angle instead.

4. The label field on points is NOT optional. Every point MUST have label set. Without it the vertex letter will not appear.

5. Use y-DOWN screen coordinates: top of shape = small y value, bottom = large y value.
   A triangle pointing up: apex at y=1, base vertices at y=7.

6. Width/height should be about 10x8. Keep all coordinates within bounds with at least 0.5 margin from edges.`;
