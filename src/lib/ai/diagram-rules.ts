/**
 * These rules get appended to EVERY prompt (system, edit, regen)
 * so the LLM can never ignore them.
 */
export const DIAGRAM_RULES = `
## DIAGRAM REQUIREMENTS — DO NOT SKIP ANY OF THESE:

1. GEOMETRY SHAPES use the point/segment/polygon arrays.
   Every vertex of a 2D shape MUST have a point in the "points" array with BOTH "id" and "label" fields set to the vertex letter.
   Example: { "id": "A", "x": 5, "y": 1, "label": "A", "label_position": "top" }

2. Every known side length in a 2D geometry diagram MUST have a segment in the "segments" array with a "label" field showing the measurement.
   Example: { "from": "A", "to": "B", "label": "10 cm" }
   THIS INCLUDES RECTANGLES. If a rectangle has width 5 cm and height 3 cm, BOTH the width segment AND height segment MUST have labels.

3. Every angle mentioned in a 2D geometry diagram MUST have an entry in "angle_arcs" with a "label" field showing the degree.
   For right angles (90°), use "right_angles" instead.

4. For 2D geometry diagrams, the label field on points is NOT optional. Every point MUST have label set.

5. Use y-DOWN screen coordinates: top of shape = small y value, bottom = large y value.

6. Width/height should be about 10x8. Keep all coordinates within bounds with at least 0.5 margin from edges.

7. RECTANGLES must have all 4 vertices as points, 4 segments with labels for width and height, and right_angle markers at corners.
   Example rectangle ABCD (width 5, height 3):
   - points: A(1,1), B(9,1), C(9,5), D(1,5) with labels
   - segments: A→B "5 cm", B→C "3 cm", C→D "5 cm", D→A "3 cm"
   - right_angles at each corner

8. FUNCTION / EQUATION / COORDINATE-PLANE questions MUST use the "graph" object instead of manually sampled "axes" + "curves".
   The graph object must include:
   - "viewport": { left, right, bottom, top }
   - "expressions": [{ latex, ... }]
   Use valid Desmos-style LaTeX for each plotted relation or point.
   Examples:
   - Parabola: { "latex": "y=x^2" }
   - Inequality: { "latex": "y\\le 2x+1", "fill": true }
   - Piecewise: { "latex": "y=x^2\\left\\{x\\le0\\right\\}" }
   - Open endpoint: { "latex": "(2,3)", "point_style": "open", "show_label": true, "label": "(2,3)" }
   Never approximate a graph by inventing curve_points for ordinary function graphs.

9. ANY question about area, perimeter, surface area, or volume of a shape MUST include a diagram with ALL dimensions labeled.

10. FOR 3D SHAPES: Use the dedicated 3D shape arrays. Do NOT fake 3D solids using points/segments/polygons.
    Put measurements in "dimension_labels".
    - Cones → use "cones" array: [{ cx: 5, cy: 4, radius: 3, shape_height: 5, dimension_labels: { radius: "3 cm", height: "5 cm", slant: "5.8 cm" } }]
    - Cylinders → use "cylinders" array
    - Spheres → use "spheres" array
    - Rectangular prisms/boxes → use "rectangular_prisms" array
    - Pyramids → use "pyramids" array
    3D solids do NOT need matching entries in the 2D "points" array.`;
