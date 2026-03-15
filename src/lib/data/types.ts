export type GradeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;
export type AIProvider = 'anthropic' | 'google';
export type QuestionType =
	| 'auto'
	| 'computation'
	| 'word_problem'
	| 'visual'
	| 'multiple_choice'
	| 'true_false'
	| 'fill_in_blank'
	| 'matching'
	| 'error_analysis'
	| 'open_response';

// Mirrors math.json
export interface Skill {
	skill_id: string;
	skill_name: string;
	grade_range: [number, number];
	prerequisites: string[];
	difficulty_notes: string;
	question_types: QuestionType[];
}

export interface Unit {
	unit_id: string;
	unit_name: string;
	skills: Skill[];
}

export interface Domain {
	domain_id: string;
	domain_name: string;
	description: string;
	units: Unit[];
}

export interface MathData {
	meta: Record<string, unknown>;
	domains: Domain[];
}

// Builder state
export interface BuilderConfig {
	grade: GradeLevel | null;
	selectedSkills: Skill[];
	customTopic?: string;
	difficulty: DifficultyLevel;
	questionCount: number;
	questionType: QuestionType;
}

// Generated output
export interface GeneratedQuestion {
	question: string;
	has_diagram: boolean;
	diagram?: DiagramSceneGraph;
	choices?: string[];
	match_pairs?: { left: string; right: string }[];
	solution_steps: string[];
	final_answer: string;
}

export interface QuestionThread {
	versions: GeneratedQuestion[];
	activeIndex: number;
	instructions: string[]; // what the user asked for each version (empty string for original)
}

export interface Worksheet {
	id: string;
	title: string;
	studentName?: string;
	created_at: string;
	config: BuilderConfig;
	questions: GeneratedQuestion[];
	threads?: QuestionThread[]; // one per question, tracks modifications
}

// Diagram scene graph — flat element structure for Gemini compatibility
export interface DiagramSceneGraph {
	width: number;
	height: number;
	elements: DiagramElement[];
}

export interface DiagramElement {
	type: string;
	style?: 'solid' | 'dashed';
	// point
	id?: string;
	x?: number;
	y?: number;
	label?: string;
	label_position?: string;
	filled?: boolean;
	// segment, ray
	from?: string;
	to?: string;
	origin?: string;
	through?: string;
	// line
	through_points?: string[];
	// polygon
	vertices?: string[];
	fill?: string;
	// circle, arc
	center?: string;
	radius?: number;
	start_angle?: number;
	end_angle?: number;
	// angle_arc, right_angle
	vertex?: string;
	ray1_through?: string;
	ray2_through?: string;
	size?: number;
	// axes
	x_min?: number;
	x_max?: number;
	y_min?: number;
	y_max?: number;
	x_label?: string;
	y_label?: string;
	grid?: boolean;
	tick_interval?: number;
	// number_line
	min?: number;
	max?: number;
	points?: { value: number; label?: string; filled?: boolean }[];
	// curve
	curve_points?: { x: number; y: number }[];
	smooth?: boolean;
	// label
	text?: string;
	font_size?: number;
	// tick_marks, parallel_marks
	segment_from?: string;
	segment_to?: string;
	count?: number;
}
