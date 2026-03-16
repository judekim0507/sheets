import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;

export function getDb(): Client | null {
	if (client) return client;

	const url = process.env.TURSO_DATABASE_URL || import.meta.env?.VITE_TURSO_DATABASE_URL;
	const authToken = process.env.TURSO_AUTH_TOKEN || import.meta.env?.VITE_TURSO_AUTH_TOKEN;

	if (!url) return null;

	client = createClient({ url, authToken });
	return client;
}

export async function initDb() {
	const db = getDb();
	if (!db) return;

	await db.execute(`
		CREATE TABLE IF NOT EXISTS questions (
			id TEXT PRIMARY KEY,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			grade INTEGER,
			skill_ids TEXT,
			custom_topic TEXT,
			difficulty INTEGER NOT NULL,
			question_type TEXT NOT NULL,
			question TEXT NOT NULL,
			final_answer TEXT NOT NULL,
			solution_steps TEXT,
			has_diagram INTEGER NOT NULL DEFAULT 0,
			diagram TEXT,
			choices TEXT,
			match_pairs TEXT,
			worksheet_id TEXT,
			worksheet_title TEXT,
			provider TEXT,
			model TEXT
		)
	`);
}

let initialized = false;

export async function logQuestions(params: {
	worksheetId: string;
	worksheetTitle: string;
	grade: number | null;
	skillIds: string[];
	customTopic?: string;
	difficulty: number;
	questionType: string;
	provider: string;
	model: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	questions: any[];
}) {
	const db = getDb();
	if (!db) return; // silently skip if no Turso configured

	if (!initialized) {
		await initDb();
		initialized = true;
	}

	const { worksheetId, worksheetTitle, grade, skillIds, customTopic, difficulty, questionType, provider, model, questions } = params;

	try {
		const stmts = questions.map((q) => ({
			sql: `INSERT OR IGNORE INTO questions (id, grade, skill_ids, custom_topic, difficulty, question_type, question, final_answer, solution_steps, has_diagram, diagram, choices, match_pairs, worksheet_id, worksheet_title, provider, model)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				crypto.randomUUID(),
				grade,
				skillIds.length > 0 ? JSON.stringify(skillIds) : null,
				customTopic || null,
				difficulty,
				questionType,
				q.question || '',
				q.final_answer || '',
				q.solution_steps ? JSON.stringify(q.solution_steps) : null,
				q.has_diagram ? 1 : 0,
				q.diagram ? JSON.stringify(q.diagram) : null,
				q.choices ? JSON.stringify(q.choices) : null,
				q.match_pairs ? JSON.stringify(q.match_pairs) : null,
				worksheetId,
				worksheetTitle,
				provider,
				model
			]
		}));

		await db.batch(stmts);
	} catch (e) {
		// Never let logging break generation
		console.error('Question logging failed:', e);
	}
}
