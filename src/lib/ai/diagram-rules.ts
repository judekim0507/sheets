/**
 * These rules get appended to every prompt so the LLM does not improvise
 * fragile geometry layouts that the app can compile more reliably itself.
 */
export const DIAGRAM_RULES = `
## DIAGRAM REQUIREMENTS — DO NOT SKIP ANY OF THESE:

1. If the question is a FUNCTION / EQUATION / INEQUALITY / COORDINATE-PLANE GRAPHING problem, use the "diagram" field with the dedicated "graph" object.
   - Include viewport + expressions.
   - Every graph expression MUST match the actual relation(s) or point(s) named in the question.
   - Do NOT approximate graphs with sampled curve_points.

2. For ALL OTHER diagrams, do NOT hand-author a final point-by-point scene graph.
   Instead, set "diagram_intent" to a valid JSON string describing the semantic diagram intent.
   The app will compile that into a teacher-grade textbook diagram.

3. Supported "diagram_intent.family" values are:
   - "standard-position-trig"
   - "cast-circle"
   - "coordinate-segment"
   - "polygon-measurement"
   - "circle-geometry"
   - "three-d-solid"
   - "number-line"
   - "parallel-lines"

4. Geometry intent must describe facts, not layout guesses.
   Include what the student should see: point coordinates, known side labels, angle labels, right angles, shading, which solid, which circle construction, number-line endpoints, and so on.
   Do NOT invent screen coordinates or SVG-like placement in "diagram_intent".

5. Example: standard-position trig
   "diagram_intent": "{\\"family\\":\\"standard-position-trig\\",\\"point\\":{\\"x\\":-3,\\"y\\":4},\\"pointLabel\\":\\"P(-3,4)\\",\\"footLabel\\":\\"A\\",\\"originLabel\\":\\"O\\",\\"angleLabel\\":\\"θ\\"}"

6. Example: CAST / reference-angle circle
   "diagram_intent": "{\\"family\\":\\"cast-circle\\",\\"trigFunction\\":\\"tan\\",\\"sign\\":\\"negative\\",\\"referenceAngleDegrees\\":60,\\"solutionAngles\\":[120,240]}"

7. Example: polygon measurement
   "diagram_intent": "{\\"family\\":\\"polygon-measurement\\",\\"shape\\":\\"rectangle\\",\\"vertexLabels\\":[\\"A\\",\\"B\\",\\"C\\",\\"D\\"],\\"sideLabels\\":{\\"A-B\\":\\"8 cm\\",\\"B-C\\":\\"5 cm\\"},\\"rightAngles\\":[\\"A\\",\\"B\\",\\"C\\",\\"D\\"]}"

8. Example: circle geometry
   "diagram_intent": "{\\"family\\":\\"circle-geometry\\",\\"variant\\":\\"sector\\",\\"angleLabel\\":\\"110°\\",\\"fill\\":\\"#d1d5db\\",\\"fillOpacity\\":0.35}"

9. Example: 3D solid
   "diagram_intent": "{\\"family\\":\\"three-d-solid\\",\\"solid\\":\\"cylinder\\",\\"dimensionLabels\\":{\\"radius\\":\\"3 cm\\",\\"height\\":\\"8 cm\\"}}"

10. Example: number line
    "diagram_intent": "{\\"family\\":\\"number-line\\",\\"min\\":-4,\\"max\\":6,\\"tickInterval\\":1,\\"points\\":[{\\"value\\":-1,\\"label\\":\\"-1\\",\\"filled\\":true},{\\"value\\":3,\\"label\\":\\"3\\",\\"filled\\":false}]}"

11. Example: parallel lines / transversal
    "diagram_intent": "{\\"family\\":\\"parallel-lines\\",\\"angleLabels\\":{\\"topLeft\\":\\"120°\\",\\"lowerBottomRight\\":\\"x°\\"}}"

12. If the question mentions a shaded or colored region, the intent must explicitly encode that shading.
    Never say a region is shaded unless "diagram_intent" includes a fill color / fill opacity or the graph object encodes the fill.

13. If has_diagram is true, include ONE of:
    - "diagram" for graph questions, OR
    - "diagram_intent" for non-graph geometry / visual questions.
    Do not omit both.
`;
