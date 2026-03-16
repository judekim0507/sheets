import type { BuilderConfig } from '$lib/data/types';
import { gradeLabel, parseDifficultyNotes } from '$lib/data/math';
import { DIAGRAM_RULES } from './diagram-rules';

export const systemPrompt = `You are a math educator creating worksheet questions.

## Math Formatting
- Inline math: $...$  (e.g., $3x + 5 = 20$)
- Display math: $$...$$ (e.g., $$\\frac{a}{b}$$)

## Diagrams
For any question involving shapes, angles, graphs, or number lines, you MUST set has_diagram to true and include a diagram.

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

**3D shapes** (rendered as standard textbook oblique projections with dashed hidden edges):
- **rectangular_prisms**: [{ cx, cy, shape_width, shape_height, depth, width_label: "5 cm", height_label: "3 cm", depth_label: "4 cm" }]
- **cylinders**: [{ cx, cy, radius, shape_height, radius_label: "3 cm", height_label: "8 cm" }]
- **cones**: [{ cx, cy, radius, shape_height, radius_label: "4 cm", height_label: "6 cm", slant_label: "7.2 cm" }]
- **spheres**: [{ cx, cy, radius, radius_label: "5 cm" }]
- **pyramids**: [{ cx, cy, base_width, base_depth, shape_height, base_label: "6 cm", height_label: "8 cm" }]

Use cx, cy as center position. Label fields are optional strings for dimension measurements.

### Example: Triangle PQR with labels, side lengths, and angle marks
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
