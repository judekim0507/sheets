import { z } from 'zod';

// Diagram uses typed arrays — each element type gets its own array
// with only relevant fields. Keeps optional params low per object
// (Anthropic limit: 24) and gives LLMs clear structure.

const pointSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	label: z.string().optional(),
	label_position: z.enum(['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
	filled: z.boolean().optional(),
	style: z.enum(['solid', 'dashed']).optional()
});

const segmentSchema = z.object({
	from: z.string(),
	to: z.string(),
	label: z.string().optional(),
	style: z.enum(['solid', 'dashed']).optional()
});

const lineSchema = z.object({
	through_points: z.array(z.string()),
	style: z.enum(['solid', 'dashed']).optional()
});

const raySchema = z.object({
	origin: z.string(),
	through: z.string(),
	style: z.enum(['solid', 'dashed']).optional()
});

const polygonSchema = z.object({
	vertices: z.array(z.string()),
	fill: z.string().optional(),
	style: z.enum(['solid', 'dashed']).optional()
});

const circleSchema = z.object({
	center: z.string(),
	radius: z.number().optional(),
	through: z.string().optional(),
	style: z.enum(['solid', 'dashed']).optional()
});

const arcSchema = z.object({
	center: z.string(),
	radius: z.number(),
	start_angle: z.number(),
	end_angle: z.number(),
	style: z.enum(['solid', 'dashed']).optional()
});

const angleArcSchema = z.object({
	vertex: z.string(),
	ray1_through: z.string(),
	ray2_through: z.string(),
	radius: z.number().optional(),
	label: z.string().optional(),
	style: z.enum(['solid', 'dashed']).optional()
});

const rightAngleSchema = z.object({
	vertex: z.string(),
	ray1_through: z.string(),
	ray2_through: z.string(),
	size: z.number().optional()
});

const axesSchema = z.object({
	x_min: z.number(),
	x_max: z.number(),
	y_min: z.number(),
	y_max: z.number(),
	x_label: z.string().optional(),
	y_label: z.string().optional(),
	grid: z.boolean().optional(),
	tick_interval: z.number().optional()
});

const numberLineSchema = z.object({
	min: z.number(),
	max: z.number(),
	tick_interval: z.number(),
	points: z.array(z.object({
		value: z.number(),
		label: z.string().optional(),
		filled: z.boolean().optional()
	})).optional()
});

const curveSchema = z.object({
	curve_points: z.array(z.object({ x: z.number(), y: z.number() })),
	smooth: z.boolean().optional(),
	style: z.enum(['solid', 'dashed']).optional()
});

const labelSchema = z.object({
	x: z.number(),
	y: z.number(),
	text: z.string(),
	font_size: z.number().optional()
});

const tickMarksSchema = z.object({
	segment_from: z.string(),
	segment_to: z.string(),
	count: z.number()
});

const parallelMarksSchema = z.object({
	segment_from: z.string(),
	segment_to: z.string(),
	count: z.number()
});

// 3D shapes — use simple string labels to keep optional param count low (Anthropic limit: 24)
const rectangularPrismSchema = z.object({
	cx: z.number(),
	cy: z.number(),
	shape_width: z.number(),
	shape_height: z.number(),
	depth: z.number(),
	width_label: z.string().optional(),
	height_label: z.string().optional(),
	depth_label: z.string().optional()
});

const cylinderSchema = z.object({
	cx: z.number(),
	cy: z.number(),
	radius: z.number(),
	shape_height: z.number(),
	radius_label: z.string().optional(),
	height_label: z.string().optional()
});

const coneSchema = z.object({
	cx: z.number(),
	cy: z.number(),
	radius: z.number(),
	shape_height: z.number(),
	radius_label: z.string().optional(),
	height_label: z.string().optional(),
	slant_label: z.string().optional()
});

const sphereSchema = z.object({
	cx: z.number(),
	cy: z.number(),
	radius: z.number(),
	radius_label: z.string().optional()
});

const pyramidSchema = z.object({
	cx: z.number(),
	cy: z.number(),
	base_width: z.number(),
	base_depth: z.number(),
	shape_height: z.number(),
	base_label: z.string().optional(),
	height_label: z.string().optional()
});

const diagramSceneGraphSchema = z.object({
	width: z.number(),
	height: z.number(),
	points: z.array(pointSchema).optional(),
	segments: z.array(segmentSchema).optional(),
	lines: z.array(lineSchema).optional(),
	rays: z.array(raySchema).optional(),
	polygons: z.array(polygonSchema).optional(),
	circles: z.array(circleSchema).optional(),
	arcs: z.array(arcSchema).optional(),
	angle_arcs: z.array(angleArcSchema).optional(),
	right_angles: z.array(rightAngleSchema).optional(),
	axes: z.array(axesSchema).optional(),
	number_lines: z.array(numberLineSchema).optional(),
	curves: z.array(curveSchema).optional(),
	labels: z.array(labelSchema).optional(),
	tick_marks: z.array(tickMarksSchema).optional(),
	parallel_marks: z.array(parallelMarksSchema).optional(),
	rectangular_prisms: z.array(rectangularPrismSchema).optional(),
	cylinders: z.array(cylinderSchema).optional(),
	cones: z.array(coneSchema).optional(),
	spheres: z.array(sphereSchema).optional(),
	pyramids: z.array(pyramidSchema).optional()
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
