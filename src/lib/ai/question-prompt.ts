import type { GeneratedQuestion, BuilderConfig } from '$lib/data/types';
import type { QuestionBriefOutput } from './schema';
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
- For geometry / non-graph visuals: return "diagram_intent" as a valid JSON string that describes the semantic facts only
- For coordinate-plane graphing: use the "diagram" field with the "graph" object instead of geometry intent
- Make the diagram instructional: readable labels, canonical textbook construction, and no raw markdown or LaTeX artifacts in labels
- If the question mentions a shaded or colored region, the intent/graph data must explicitly encode that shading
- Use right angles, side labels, and angle labels in the intent whenever they are part of the problem`;
}

export function buildQuestionRegenPrompt(
	original: GeneratedQuestion,
	config: BuilderConfig,
	avoidQuestionTexts: string[] = []
): string {
	const grade = config.grade !== null ? gradeLabel(config.grade) : '?';
	const avoidSection = avoidQuestionTexts.length > 0
		? `\nDo NOT generate anything structurally similar to these already accepted worksheet questions:\n${avoidQuestionTexts.slice(-8).map((question, index) => `${index + 1}. ${question}`).join('\n')}\n`
		: '';

	return `Generate exactly 1 new math question for Grade ${grade === '0' ? 'K' : grade}.

It should test the same skill/concept as this question: "${original.question}"

But be completely different — new numbers, new scenario, new approach.
${original.has_diagram ? '\nThe original had a diagram. The replacement MUST also include a complete diagram.' : ''}
${avoidSection}

${DIAGRAM_RULES}

IMPORTANT:
- Non-graph geometry / visual questions must use "diagram_intent" as a valid JSON string with semantic facts only.
- Coordinate-plane graphs must use the "diagram" field with mathematically correct graph expressions and viewport bounds.
- If the question mentions a shaded or colored region, the diagram intent / graph must encode that fill explicitly.
- Do not hand-author a fragile freeform scene graph for geometry.
- The new question must use a distinct stem pattern from the avoided questions.`;
}

export function buildQuestionFromBriefPrompt(
	brief: QuestionBriefOutput,
	config: BuilderConfig,
	options: { avoidQuestionTexts?: string[]; avoidUniquenessKeys?: string[] } = {}
): string {
	const parts = buildQuestionFromBriefPromptParts(brief, config, options);
	return `${parts.staticPrompt}\n\n${parts.dynamicPrompt}`;
}

export function buildQuestionFromBriefPromptParts(
	brief: QuestionBriefOutput,
	config: BuilderConfig,
	options: { avoidQuestionTexts?: string[]; avoidUniquenessKeys?: string[] } = {}
): { staticPrompt: string; dynamicPrompt: string } {
	const grade = config.grade !== null ? gradeLabel(config.grade) : '?';
	const avoidQuestionTexts = options.avoidQuestionTexts ?? [];
	const avoidUniquenessKeys = options.avoidUniquenessKeys ?? [];
	const avoidSection = avoidUniquenessKeys.length > 0
		? `\nDo NOT drift toward any of these already-used worksheet setups:\n${avoidUniquenessKeys.slice(-8).map((key, index) => `${index + 1}. ${key}`).join('\n')}\n`
		: avoidQuestionTexts.length > 0
			? `\nDo NOT generate anything structurally similar to these already accepted worksheet questions:\n${avoidQuestionTexts.slice(-8).map((question, index) => `${index + 1}. ${question}`).join('\n')}\n`
			: '';

	const staticPrompt = `Generate exactly 1 new math question for Grade ${grade === '0' ? 'K' : grade} from this approved worksheet brief.

Rules:
- Follow the brief closely. Do not drift into a different exercise.
- Keep the final question concise and worksheet-ready.
- Do not copy wording from the avoided material.
- Do not add extra subparts unless the brief clearly calls for them.
- If the brief requires a diagram, include a complete diagram.
- Return exactly one complete question, with answer and solution steps.`;

	const dynamicPrompt = `**Brief ID:** ${brief.brief_id}
**Uniqueness Key:** ${brief.uniqueness_key}
**Concept Family:** ${brief.concept_family}
**Skill Focus:** ${brief.skill_focus}
**Problem Type:** ${brief.problem_type}
**Diagram Mode:** ${brief.diagram_mode}
${brief.diagram_family ? `**Diagram Family:** ${brief.diagram_family}` : ''}
**Givens:**
${brief.givens.map((given) => `- ${given}`).join('\n')}
**Task:** ${brief.task}
${brief.constraints?.length ? `**Constraints:**\n${brief.constraints.map((constraint) => `- ${constraint}`).join('\n')}` : ''}
${avoidSection}`;

	return { staticPrompt, dynamicPrompt };
}
