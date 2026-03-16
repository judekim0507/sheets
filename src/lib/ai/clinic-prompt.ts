import type { GeneratedQuestion, BuilderConfig } from '$lib/data/types';
import { gradeLabel } from '$lib/data/math';
import { DIAGRAM_RULES } from './diagram-rules';

export function buildClinicPrompt(
	sourceQuestions: GeneratedQuestion[],
	questionCount: number,
	config: BuilderConfig
): string {
	const grade = config.grade !== null ? gradeLabel(config.grade) : '?';

	const examples = sourceQuestions
		.map((q, i) => `${i + 1}. ${q.question}\n   Answer: ${q.final_answer}`)
		.join('\n\n');

	const difficultyLabels: Record<number, string> = {
		1: 'Introductory', 2: 'Developing', 3: 'Proficient', 4: 'Advanced', 5: 'Challenge'
	};

	return `Generate a CLINIC worksheet — targeted practice for a student who needs extra work on specific problem types.

**Grade:** ${grade === '0' ? 'K' : grade}
**Difficulty:** L${config.difficulty} — ${difficultyLabels[config.difficulty]}
**Questions:** ${questionCount}

The student struggled with these problems:

${examples}

Generate exactly ${questionCount} NEW questions that practice the SAME concepts and problem types as the examples above. The questions should:
- Cover the same skills/techniques but with different numbers and scenarios
- Start slightly easier than the examples, then build to the same difficulty
- Vary the presentation (some computation, some word problems) while keeping the same underlying concept
- Be different enough that the student can't just copy answers, but similar enough to build mastery

${DIAGRAM_RULES}`;
}
