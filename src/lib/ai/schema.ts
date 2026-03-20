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

export const worksheetSchema = z.object({
	title: z.string(),
	questions: z.array(generatedQuestionSchema)
});

export type WorksheetOutput = z.infer<typeof worksheetSchema>;
