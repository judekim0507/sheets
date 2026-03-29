import { z } from 'zod';

/**
 * Keep the generation schema intentionally lightweight.
 *
 * The model already gets detailed diagram instructions in the prompt, and the
 * app normalizes / repairs diagrams after generation. Trying to encode the full
 * scene graph as a deeply constrained structured-output schema causes provider
 * serving failures ("too many states for serving").
 */

const generatedQuestionSchema = z.object({
	question: z.string(),
	has_diagram: z.boolean(),
	diagram: z.string().optional(),
	diagram_intent: z.string().optional(),
	choices: z.array(z.string()).optional(),
	match_pairs: z.array(
		z.object({
			left: z.string(),
			right: z.string()
		})
	).optional(),
	solution_steps: z.array(z.string()),
	final_answer: z.string()
});

export const singleQuestionSchema = z.object({
	question: generatedQuestionSchema
});

export const questionBriefSchema = z.object({
	brief_id: z.string(),
	uniqueness_key: z.string(),
	concept_family: z.string(),
	skill_focus: z.string(),
	problem_type: z.string(),
	diagram_mode: z.enum(['none', 'graph', 'geometry']),
	diagram_family: z.string().optional(),
	givens: z.array(z.string()).min(1),
	task: z.string(),
	constraints: z.array(z.string()).optional()
});

export const worksheetPlanSchema = z.object({
	title: z.string(),
	briefs: z.array(questionBriefSchema)
});

export const worksheetSchema = z.object({
	title: z.string(),
	questions: z.array(generatedQuestionSchema)
});

export type SingleQuestionOutput = z.infer<typeof singleQuestionSchema>;
export type QuestionBriefOutput = z.infer<typeof questionBriefSchema>;
export type WorksheetPlanOutput = z.infer<typeof worksheetPlanSchema>;
export type WorksheetOutput = z.infer<typeof worksheetSchema>;
