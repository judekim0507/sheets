import type { GeneratedQuestion, BuilderConfig } from '$lib/data/types';
import { systemPrompt } from './prompt';
import { gradeLabel } from '$lib/data/math';
import { DIAGRAM_RULES } from './diagram-rules';
import { findDiagramIssues } from './diagram-validation';

export { systemPrompt };

function describeDiagramIssues(q: GeneratedQuestion): string {
	const issues = findDiagramIssues(q).map((issue) => issue.message);

	return issues.length > 0
		? `\n\n**CURRENT DIAGRAM PROBLEMS:**\n${issues.map((i) => `- ${i}`).join('\n')}\nYou MUST fix all of these in the replacement.`
		: '';
}

export function buildQuestionEditPrompt(
	original: GeneratedQuestion,
	instruction: string,
	config: BuilderConfig
): string {
	const grade = config.grade !== null ? gradeLabel(config.grade) : '?';
	const diagramIssues = describeDiagramIssues(original);

	return `Here is an existing math question from a Grade ${grade === '0' ? 'K' : grade} worksheet:

**Question:** ${original.question}
**Answer:** ${original.final_answer}
${original.choices ? `**Choices:** ${original.choices.join(' | ')}` : ''}
${original.has_diagram && original.diagram ? `**Current diagram (JSON):**\n\`\`\`json\n${JSON.stringify(original.diagram, null, 2)}\n\`\`\`` : ''}
${diagramIssues}

**User's requested change:** "${instruction}"

Generate exactly 1 replacement question. Keep the same question text and skill unless the user asked to change it. Focus on fixing/improving the diagram.

${DIAGRAM_RULES}

IMPORTANT: The replacement MUST have a complete diagram where:
- For geometry shapes: every point has "label" set to the vertex letter (e.g., label: "A")
- For geometry shapes: every known side has a segment with a measurement label (e.g., label: "10 cm")
- For geometry shapes: every referenced angle has an angle_arc with a degree label (e.g., label: "60°")
- For coordinate-plane graphing: use the "graph" object with viewport + expressions instead of sampled curve_points, and make every expression match the exact equation/inequality/point named in the question
- If the question mentions a shaded or colored region, encode it with fill / fill_opacity or a sector object so the shading actually renders
- Put the final diagram into the "diagram" field as a valid JSON string
- Use right_angle for 90° angles`;
}

export function buildQuestionRegenPrompt(
	original: GeneratedQuestion,
	config: BuilderConfig
): string {
	const grade = config.grade !== null ? gradeLabel(config.grade) : '?';

	return `Generate exactly 1 new math question for Grade ${grade === '0' ? 'K' : grade}.

It should test the same skill/concept as this question: "${original.question}"

But be completely different — new numbers, new scenario, new approach.
${original.has_diagram ? '\nThe original had a diagram. The replacement MUST also include a complete diagram.' : ''}

${DIAGRAM_RULES}

IMPORTANT:
- Geometry shapes must have labeled points, labeled known sides, and angle markers where needed.
- Coordinate-plane graphs must use the "graph" object with mathematically correct expressions and viewport bounds, and those expressions must match the question text.
- If the question mentions a shaded or colored region, the diagram must encode that fill color explicitly.
- Put the final diagram into the "diagram" field as a valid JSON string.`;
}
