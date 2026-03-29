import type { BuilderConfig } from '$lib/data/types';
import { gradeLabel, parseDifficultyNotes } from '$lib/data/math';
import { DIAGRAM_RULES } from './diagram-rules';

export const systemPrompt = `You are a math educator creating worksheet questions.

## Math Formatting
- Inline math: $...$  (e.g., $3x + 5 = 20$)
- Display math: $$...$$ (e.g., $$\\frac{a}{b}$$)

## Diagrams
For any question involving shapes, angles, graphs, coordinate visuals, 3D solids, circles, or number lines, you MUST set has_diagram to true and include diagram data.

There are TWO valid output modes:

1. Graph questions:
   Use the "diagram" field and put a valid JSON string whose object contains a dedicated "graph" object.
   Example:
   {
     "width": 10,
     "height": 8,
     "graph": {
       "viewport": { "left": -4, "right": 4, "bottom": -1, "top": 8 },
       "show_grid": true,
       "show_x_axis": true,
       "show_y_axis": true,
       "show_x_axis_numbers": true,
       "show_y_axis_numbers": true,
       "expressions": [
         { "id": "parabola", "latex": "y=x^2" },
         { "id": "vertex", "latex": "(0,0)", "point_style": "point", "label": "(0,0)", "show_label": true }
       ]
     }
   }

2. Non-graph geometry / visual questions:
   Use the "diagram_intent" field and put a valid JSON string describing semantic facts, NOT raw point-by-point layout coordinates.
   The app will compile that intent into a teacher-grade textbook diagram.

Examples:
- standard-position trig:
  {"family":"standard-position-trig","point":{"x":-3,"y":4},"pointLabel":"P(-3,4)","footLabel":"A","originLabel":"O","angleLabel":"θ"}
- CAST rule:
  {"family":"cast-circle","trigFunction":"tan","sign":"negative","referenceAngleDegrees":60,"solutionAngles":[120,240]}
- polygon measurement:
  {"family":"polygon-measurement","shape":"rectangle","vertexLabels":["A","B","C","D"],"sideLabels":{"A-B":"8 cm","B-C":"5 cm"},"rightAngles":["A","B","C","D"]}
- circle geometry:
  {"family":"circle-geometry","variant":"sector","angleLabel":"110°","fill":"#d1d5db","fillOpacity":0.35}
- 3D solid:
  {"family":"three-d-solid","solid":"cylinder","dimensionLabels":{"radius":"3 cm","height":"8 cm"}}
- number line:
  {"family":"number-line","min":-4,"max":6,"tickInterval":1,"points":[{"value":-1,"label":"-1","filled":true},{"value":3,"label":"3","filled":false}]}
- parallel lines:
  {"family":"parallel-lines","angleLabels":{"topLeft":"120°","lowerBottomRight":"x°"}}

For graph questions, every expression must match the exact equation(s), inequality/inequalities, and coordinate point(s) named in the question.
For non-graph geometry, do NOT invent scene-graph coordinates, SVG placement, or styling decisions inside "diagram_intent".

${DIAGRAM_RULES}

## Question Rules
- Keep questions concise — two-column printed worksheet
- For multiple_choice: exactly 4 choices
- solution_steps: clear step-by-step work
- final_answer: concise
- has_diagram: true with diagram/diagram_intent when visual, false without diagram when pure computation`;

export const planningSystemPrompt = `You are planning a math worksheet before writing the actual questions.

Return only concise structured question briefs, not full questions, not solutions, and not answer keys.

Each brief must be globally distinct from the others:
- different stem pattern
- different mathematical setup
- different givens/scenario
- different uniqueness_key

Do NOT create two briefs that are the same exercise with different numbers.
Keep each brief compact but specific enough that a separate model call can generate the final question from it.`;

export function buildUserPrompt(
	config: BuilderConfig,
	options: { avoidQuestionTexts?: string[] } = {}
): string {
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

	const avoidSection = options.avoidQuestionTexts && options.avoidQuestionTexts.length > 0
		? `\nAlready accepted questions from earlier batches. Do NOT generate anything structurally similar to these:\n${options.avoidQuestionTexts.slice(-8).map((question, index) => `${index + 1}. ${question}`).join('\n')}\n`
		: '';

	return `Generate a math worksheet:

**Grade:** ${grade === '0' ? 'K' : grade}
**Difficulty:** L${config.difficulty} — ${difficultyLabels[config.difficulty]}
**Type:** ${config.questionType === 'auto' ? 'Mixed formats' : config.questionType.replace(/_/g, ' ')}
**Questions:** ${config.questionCount}

${topicSection}

Generate exactly ${config.questionCount} questions.${config.customTopic ? ` Cover different aspects of "${config.customTopic}" across the questions.` : ''}
Every question in this batch MUST use a different stem pattern and different mathematical setup from the others. Do not repeat the same template with different numbers.
${avoidSection}

${DIAGRAM_RULES}`;
}

export function buildWorksheetPlanPrompt(
	config: BuilderConfig,
	briefCount: number,
	options: { avoidBriefFingerprints?: string[]; avoidQuestionTexts?: string[] } = {}
): string {
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

	const avoidBriefSection = options.avoidBriefFingerprints && options.avoidBriefFingerprints.length > 0
		? `\nAvoid these already-used worksheet brief fingerprints and do not return anything structurally similar:\n${options.avoidBriefFingerprints.slice(-12).map((fingerprint, index) => `${index + 1}. ${fingerprint}`).join('\n')}\n`
		: '';

	const avoidQuestionSection = options.avoidQuestionTexts && options.avoidQuestionTexts.length > 0
		? `\nAvoid anything structurally similar to these already-accepted worksheet questions:\n${options.avoidQuestionTexts.slice(-8).map((question, index) => `${index + 1}. ${question}`).join('\n')}\n`
		: '';

	return `Plan a math worksheet.

**Grade:** ${grade === '0' ? 'K' : grade}
**Difficulty:** L${config.difficulty} — ${difficultyLabels[config.difficulty]}
**Type:** ${config.questionType === 'auto' ? 'Mixed formats' : config.questionType.replace(/_/g, ' ')}
**Needed Briefs:** ${briefCount}

${topicSection}
${avoidBriefSection}${avoidQuestionSection}

Return:
- 1 concise worksheet title
- exactly ${briefCount} question briefs

For each brief include:
- a unique brief_id
- a uniqueness_key that describes the math setup
- concept_family
- skill_focus
- problem_type
- diagram_mode: none, graph, or geometry
- diagram_family if a diagram is needed
- givens: short bullet-like facts
- task: one concise sentence describing what the final question should ask
- constraints: optional short notes like "multiple choice" or "nearest degree"

Rules:
- Every brief must be materially different from every other brief.
- Do not repeat the same exercise with different numbers.
- Keep briefs concise, concrete, and worksheet-ready.
- If customTopic is provided, cover different aspects of that topic across the briefs.
- Only request diagrams when they are educationally useful.
- Do not write the full question text.
- Do not include solutions.`;
}
