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
   THIS INCLUDES RECTANGLES. If a rectangle has width 5 cm and height 3 cm, BOTH the width segment AND height segment MUST have labels.

3. Every angle mentioned MUST have an entry in "angle_arcs" with a "label" field showing the degree.
   For right angles (90°), use "right_angles" instead.

4. The label field on points is NOT optional. Every point MUST have label set.

5. Use y-DOWN screen coordinates: top of shape = small y value, bottom = large y value.

6. Width/height should be about 10x8. Keep all coordinates within bounds with at least 0.5 margin from edges.

7. RECTANGLES must have all 4 vertices as points, 4 segments with labels for width and height, and right_angle markers at corners.
   Example rectangle ABCD (width 5, height 3):
   - points: A(1,1), B(9,1), C(9,5), D(1,5) with labels
   - segments: A→B "5 cm", B→C "3 cm", C→D "5 cm", D→A "3 cm"
   - right_angles at each corner

8. FUNCTION/EQUATION questions MUST have a graph with axes and the curve plotted.
   Use "axes" with grid:true and appropriate x/y ranges, then "curves" with plotted points.
   Example for y = x²:
   - axes: [{ x_min: -4, x_max: 4, y_min: -1, y_max: 8, grid: true, tick_interval: 1 }]
   - curves: [{ curve_points: [{x:-3,y:9},{x:-2,y:4},{x:-1,y:1},{x:0,y:0},{x:1,y:1},{x:2,y:4},{x:3,y:9}], smooth: true }]
   - labels: [{ x: 3.5, y: 7, text: "y = x²" }]
   Plot at least 7 points for smooth curves.

9. ANY question about area, perimeter, surface area, or volume of a shape MUST include a diagram with ALL dimensions labeled.

10. FOR 3D SHAPES: You MUST use the dedicated 3D shape arrays. Do NOT draw 3D shapes using points/segments/polygons.
    - Cones → use "cones" array: [{ cx: 5, cy: 4, radius: 3, shape_height: 5, dimension_labels: { radius: "3 cm", height: "5 cm", slant: "5.8 cm" } }]
    - Cylinders → use "cylinders" array
    - Spheres → use "spheres" array
    - Rectangular prisms/boxes → use "rectangular_prisms" array
    - Pyramids → use "pyramids" array
    These render as proper 3D oblique projections with dashed hidden edges. Using points/segments to fake 3D shapes will look WRONG.`;

