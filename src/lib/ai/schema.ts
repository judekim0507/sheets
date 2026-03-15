import { z } from 'zod';

// Flattened diagram element schema — uses a single object with optional fields
// instead of discriminatedUnion (unsupported by Gemini).
// The `type` field determines which fields are relevant.
const diagramElementSchema = z.object({
	type: z.enum([
		'point',
		'segment',
		'line',
		'ray',
		'polygon',
		'circle',
		'arc',
		'angle_arc',
		'right_angle',
		'axes',
		'number_line',
		'curve',
		'label',
		'tick_marks',
		'parallel_marks'
	]),
	style: z.enum(['solid', 'dashed']).optional(),

	// point
	id: z.string().optional(),
	x: z.number().optional(),
	y: z.number().optional(),
	label: z.string().optional(),
	label_position: z
		.enum(['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'])
		.optional(),
	filled: z.boolean().optional(),

	// segment, ray
	from: z.string().optional(),
	to: z.string().optional(),
	origin: z.string().optional(),
	through: z.string().optional(),

	// line (through as array of 2 point IDs)
	through_points: z.array(z.string()).optional(),

	// polygon
	vertices: z.array(z.string()).optional(),
	fill: z.string().optional(),

	// circle
	center: z.string().optional(),
	radius: z.number().optional(),

	// arc
	start_angle: z.number().optional(),
	end_angle: z.number().optional(),

	// angle_arc, right_angle
	vertex: z.string().optional(),
	ray1_through: z.string().optional(),
	ray2_through: z.string().optional(),
	size: z.number().optional(),

	// axes — use separate min/max fields instead of tuple
	x_min: z.number().optional(),
	x_max: z.number().optional(),
	y_min: z.number().optional(),
	y_max: z.number().optional(),
	x_label: z.string().optional(),
	y_label: z.string().optional(),
	grid: z.boolean().optional(),
	tick_interval: z.number().optional(),

	// number_line
	min: z.number().optional(),
	max: z.number().optional(),
	points: z
		.array(
			z.object({
				value: z.number(),
				label: z.string().optional(),
				filled: z.boolean().optional()
			})
		)
		.optional(),

	// curve
	curve_points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
	smooth: z.boolean().optional(),

	// label
	text: z.string().optional(),
	font_size: z.number().optional(),

	// tick_marks, parallel_marks
	segment_from: z.string().optional(),
	segment_to: z.string().optional(),
	count: z.number().optional()
});

const diagramSceneGraphSchema = z.object({
	width: z.number(),
	height: z.number(),
	elements: z.array(diagramElementSchema)
});

const generatedQuestionSchema = z.object({
	question: z.string(),
	has_diagram: z.boolean(),
	diagram: diagramSceneGraphSchema.optional(),
	choices: z.array(z.string()).optional(),
	match_pairs: z.array(z.object({ left: z.string(), right: z.string() })).optional(),
	solution_steps: z.array(z.string()),
	final_answer: z.string()
});

export const worksheetSchema = z.object({
	title: z.string(),
	questions: z.array(generatedQuestionSchema)
});

export type WorksheetOutput = z.infer<typeof worksheetSchema>;
