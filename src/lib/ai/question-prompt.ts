import type { GeneratedQuestion, BuilderConfig } from '$lib/data/types';
import { systemPrompt } from './prompt';
import { gradeLabel } from '$lib/data/math';
import { DIAGRAM_RULES } from './diagram-rules';

export { systemPrompt };

function describeDiagramIssues(q: GeneratedQuestion): string {
	if (!q.has_diagram || !q.diagram) return '';

	const elements = q.diagram.elements;
	const points = elements.filter((e) => e.type === 'point');
	const segments = elements.filter((e) => e.type === 'segment');
	const angleArcs = elements.filter((e) => e.type === 'angle_arc');
	const rightAngles = elements.filter((e) => e.type === 'right_angle');

	const issues: string[] = [];

	const unlabeledPoints = points.filter((p) => !p.label);
	if (unlabeledPoints.length > 0) {
		issues.push(`${unlabeledPoints.length} point(s) are missing the "label" field — vertex letters are NOT visible`);
	}

	const unlabeledSegments = segments.filter((s) => !s.label);
	if (unlabeledSegments.length > 0 && unlabeledSegments.length === segments.length) {
		issues.push('No segments have measurement labels — side lengths are NOT visible');
	}

	if (angleArcs.length === 0 && rightAngles.length === 0) {
		issues.push('No angle_arc or right_angle elements — angle markers are NOT visible');
	}

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
- Every point has "label" set to the vertex letter (e.g., label: "A")
- Every known side has a segment with a measurement label (e.g., label: "10 cm")
- Every referenced angle has an angle_arc with a degree label (e.g., label: "60°")
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

IMPORTANT: Every point MUST have "label" set. Every known side MUST have a labeled segment. Every mentioned angle MUST have an angle_arc with label.`;
}
