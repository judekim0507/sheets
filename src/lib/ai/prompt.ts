import type { BuilderConfig } from '$lib/data/types';
import { gradeLabel, parseDifficultyNotes } from '$lib/data/math';
import { DIAGRAM_RULES } from './diagram-rules';

export const systemPrompt = `You are a math educator creating worksheet questions.

## Math Formatting
- Inline math: $...$  (e.g., $3x + 5 = 20$)
- Display math: $$...$$ (e.g., $$\\frac{a}{b}$$)

## Diagrams
For any question involving shapes, angles, graphs, or number lines, you MUST set has_diagram to true and include a diagram.
Because the API schema transports diagrams as text, the "diagram" field must contain a valid JSON string encoding the diagram object.

**Coordinate system: y=0 is TOP, y increases DOWNWARD (screen coordinates). x increases rightward.**

The diagram object uses TYPED ARRAYS — each element type gets its own array:
- **points**: [{ id, x, y, label, label_position }]
- **segments**: [{ from, to, label, style }]
- **lines**: [{ through_points: ["A","B"] }]
- **rays**: [{ origin, through }]
- **polygons**: [{ vertices: ["A","B","C"], fill }]
- **circles**: [{ center, radius }] or [{ center, through }]
- **arcs**: [{ center, radius, start_angle, end_angle }]
- **angle_arcs**: [{ vertex, ray1_through, ray2_through, label }]
- **right_angles**: [{ vertex, ray1_through, ray2_through }]
- **axes**: [{ x_min, x_max, y_min, y_max, grid, tick_interval }]
- **number_lines**: [{ min, max, tick_interval, points: [{ value, label, filled }] }]
- **curves**: [{ curve_points: [{x,y},...], smooth }]
- **labels**: [{ x, y, text }]
- **tick_marks**: [{ segment_from, segment_to, count }]
- **parallel_marks**: [{ segment_from, segment_to, count }]

For coordinate-plane graphing questions, use the dedicated **graph** object:
- **graph**: {
    viewport: { left, right, bottom, top },
    expressions: [{ latex, line_style, point_style, fill, label, show_label }],
    degree_mode, show_grid, show_x_axis, show_y_axis, show_x_axis_numbers, show_y_axis_numbers
  }

**3D shapes** (rendered as standard textbook oblique projections with dashed hidden edges):
- **rectangular_prisms**: [{ cx, cy, shape_width, shape_height, depth, dimension_labels: { width: "5 cm", height: "3 cm", depth: "4 cm" } }]
- **cylinders**: [{ cx, cy, radius, shape_height, dimension_labels: { radius: "3 cm", height: "8 cm" } }]
- **cones**: [{ cx, cy, radius, shape_height, dimension_labels: { radius: "4 cm", height: "6 cm", slant: "7.2 cm" } }]
- **spheres**: [{ cx, cy, radius, dimension_labels: { radius: "5 cm" } }]
- **pyramids**: [{ cx, cy, base_width, base_depth, shape_height, dimension_labels: { base: "6 cm", height: "8 cm" } }]

Use cx, cy as center position. Label fields are optional strings for dimension measurements.

### Example: Triangle PQR with labels, side lengths, and angle marks
Diagram object example:
{
  "width": 10, "height": 8,
  "points": [
    { "id": "P", "x": 5, "y": 1, "label": "P", "label_position": "top" },
    { "id": "Q", "x": 1, "y": 7, "label": "Q", "label_position": "bottom-left" },
    { "id": "R", "x": 9, "y": 7, "label": "R", "label_position": "bottom-right" }
  ],
  "polygons": [{ "vertices": ["P", "Q", "R"] }],
  "segments": [
    { "from": "P", "to": "Q", "label": "6 cm" },
    { "from": "Q", "to": "R", "label": "10 cm" },
    { "from": "P", "to": "R", "label": "8 cm" }
  ],
  "angle_arcs": [
    { "vertex": "P", "ray1_through": "Q", "ray2_through": "R", "label": "55°" },
    { "vertex": "Q", "ray1_through": "R", "ray2_through": "P", "label": "75°" }
  ],
  "right_angles": [{ "vertex": "R", "ray1_through": "P", "ray2_through": "Q" }]
}

Notice: EVERY point has "label" set. EVERY known side has a labeled segment. EVERY angle has an angle_arc.

### Example: Graph of y = x^2 with a labeled vertex
Graph diagram object example:
{
  "width": 10, "height": 8,
  "graph": {
    "viewport": { "left": -4, "right": 4, "bottom": -1, "top": 8 },
    "show_grid": true,
    "expressions": [
      { "id": "parabola", "latex": "y=x^2" },
      { "id": "vertex", "latex": "(0,0)", "point_style": "point", "label": "(0,0)", "show_label": true }
    ]
  }
}

When has_diagram is true, put ONE of the objects above into the "diagram" field as a JSON string.

${DIAGRAM_RULES}

## Question Rules
- Keep questions concise — two-column printed worksheet
- For multiple_choice: exactly 4 choices
- solution_steps: clear step-by-step work
- final_answer: concise
- has_diagram: true with diagram when geometry/visual, false without diagram when pure computation`;

export function buildUserPrompt(config: BuilderConfig): string {
	const grade = config.grade !== null ? gradeLabel(config.grade) : '?';

	const difficultyLabels: Record<number, string> = {
		1: 'Introductory', 2: 'Developing', 3: 'Proficient', 4: 'Advanced', 5: 'Challenge'
	};

	const topicSection = config.customTopic
		? `**Topic:** ${config.customTopic}`
		: `**Skills:**\n${config.selectedSkills
				.map((s) => {
					const diffNotes = parseDifficultyNotes(s.difficulty_notes);
					const levelNote = diffNotes[config.difficulty] || '';
					return `- ${s.skill_name} (${s.skill_id})${levelNote ? `: ${levelNote}` : ''}`;
				})
				.join('\n')}`;

	return `Generate a math worksheet:

**Grade:** ${grade === '0' ? 'K' : grade}
**Difficulty:** L${config.difficulty} — ${difficultyLabels[config.difficulty]}
**Type:** ${config.questionType === 'auto' ? 'Mixed formats' : config.questionType.replace(/_/g, ' ')}
**Questions:** ${config.questionCount}

${topicSection}

Generate exactly ${config.questionCount} questions.${config.customTopic ? ` Cover different aspects of "${config.customTopic}" across the questions.` : ''}

${DIAGRAM_RULES}`;
}
