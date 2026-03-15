import mathJson from './math.json';
import type { Domain, GradeLevel, MathData, QuestionType, Skill, DifficultyLevel } from './types';

const data = mathJson as unknown as MathData;

export function getDomainsForGrade(grade: GradeLevel): Domain[] {
	return data.domains
		.map((domain) => {
			const filteredUnits = domain.units
				.map((unit) => ({
					...unit,
					skills: unit.skills.filter(
						(skill) => grade >= skill.grade_range[0] && grade <= skill.grade_range[1]
					)
				}))
				.filter((unit) => unit.skills.length > 0);

			if (filteredUnits.length === 0) return null;
			return { ...domain, units: filteredUnits };
		})
		.filter((d): d is Domain => d !== null);
}

export function getAvailableQuestionTypes(skills: Skill[]): QuestionType[] {
	if (skills.length === 0) return [];
	const sets = skills.map((s) => new Set(s.question_types));
	const first = sets[0];
	return [...first].filter((type) => sets.every((s) => s.has(type)));
}

export function parseDifficultyNotes(notes: string): Partial<Record<DifficultyLevel, string>> {
	const result: Partial<Record<DifficultyLevel, string>> = {};
	const parts = notes.split(/,\s*(?=L\d:)/);
	for (const part of parts) {
		const match = part.match(/^L(\d):\s*(.+)/);
		if (match) {
			const level = parseInt(match[1]) as DifficultyLevel;
			result[level] = match[2].trim();
		}
	}
	return result;
}

export function gradeLabel(grade: GradeLevel): string {
	return grade === 0 ? 'K' : String(grade);
}

export function getAllDomains(): Domain[] {
	return data.domains;
}
