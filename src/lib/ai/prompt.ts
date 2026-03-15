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

Available primitives:
1. **point** — { type: "point", id: "A", x: 2, y: 3, label: "A", label_position: "top-right" }
2. **segment** — { type: "segment", from: "A", to: "B", label: "5 cm" }
3. **line** — { type: "line", through_points: ["A", "B"] }
4. **ray** — { type: "ray", origin: "A", through: "B" }
5. **polygon** — { type: "polygon", vertices: ["A", "B", "C"] }
6. **circle** — { type: "circle", center: "O", radius: 3 }
7. **arc** — { type: "arc", center: "O", radius: 2, start_angle: 0, end_angle: 90 }
8. **angle_arc** — { type: "angle_arc", vertex: "B", ray1_through: "A", ray2_through: "C", label: "60°" }
9. **right_angle** — { type: "right_angle", vertex: "B", ray1_through: "A", ray2_through: "C" }
10. **axes** — { type: "axes", x_min: -5, x_max: 5, y_min: -5, y_max: 5, grid: true, tick_interval: 1 }
11. **number_line** — { type: "number_line", min: 0, max: 10, tick_interval: 1, points: [{ value: 3, label: "A", filled: true }] }
12. **curve** — { type: "curve", curve_points: [{x:0,y:0},{x:1,y:1},{x:2,y:4}], smooth: true }
13. **label** — { type: "label", x: 3, y: 4, text: "12 sq units" }
14. **tick_marks** — { type: "tick_marks", segment_from: "A", segment_to: "B", count: 2 }
15. **parallel_marks** — { type: "parallel_marks", segment_from: "A", segment_to: "B", count: 1 }

Scene graph format: { width: number, height: number, elements: [...] }

### Example: Triangle PQR with labels, side lengths, and angle marks
{
  "width": 10, "height": 8,
  "elements": [
    { "type": "point", "id": "P", "x": 5, "y": 1, "label": "P", "label_position": "top" },
    { "type": "point", "id": "Q", "x": 1, "y": 7, "label": "Q", "label_position": "bottom-left" },
    { "type": "point", "id": "R", "x": 9, "y": 7, "label": "R", "label_position": "bottom-right" },
    { "type": "polygon", "vertices": ["P", "Q", "R"] },
    { "type": "segment", "from": "P", "to": "Q", "label": "6 cm" },
    { "type": "segment", "from": "Q", "to": "R", "label": "10 cm" },
    { "type": "segment", "from": "P", "to": "R", "label": "8 cm" },
    { "type": "angle_arc", "vertex": "P", "ray1_through": "Q", "ray2_through": "R", "label": "55°" },
    { "type": "angle_arc", "vertex": "Q", "ray1_through": "R", "ray2_through": "P", "label": "75°" },
    { "type": "right_angle", "vertex": "R", "ray1_through": "P", "ray2_through": "Q" }
  ]
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
