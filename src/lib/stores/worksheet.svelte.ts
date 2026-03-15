import type {
	GradeLevel,
	DifficultyLevel,
	QuestionType,
	Skill,
	Domain,
	Unit,
	Worksheet,
	BuilderConfig
} from '$lib/data/types';
import { getAvailableQuestionTypes } from '$lib/data/math';
import { settingsStore } from './settings.svelte';
import { libraryStore } from './library.svelte';

const SESSION_KEY = 'math-worksheet-data';

class WorksheetStore {
	// Builder state
	step = $state(0);
	grade = $state<GradeLevel | null>(null);
	selectedDomain = $state<Domain | null>(null);
	selectedUnit = $state<Unit | null>(null);
	selectedSkills = $state<Skill[]>([]);
	customTopic = $state('');
	difficulty = $state<DifficultyLevel>(3);
	questionCount = $state(10);
	questionType = $state<QuestionType>('auto');

	// Generation state
	isGenerating = $state(false);
	worksheet = $state<Worksheet | null>(null);
	error = $state<string | null>(null);

	/** True when using custom topic instead of curriculum skills */
	get isCustom(): boolean {
		return this.customTopic.trim().length > 0 && this.selectedSkills.length === 0;
	}

	get canProceed(): boolean {
		switch (this.step) {
			case 0:
				return this.grade !== null;
			case 1:
				return this.selectedUnit !== null;
			case 2:
				return this.selectedSkills.length > 0;
			case 3:
				return settingsStore.isConfigured;
			default:
				return false;
		}
	}

	get availableQuestionTypes(): QuestionType[] {
		if (this.isCustom) {
			// All types available for custom topics
			return ['computation', 'word_problem', 'multiple_choice', 'fill_in_blank', 'open_response'] as QuestionType[];
		}
		return getAvailableQuestionTypes(this.selectedSkills);
	}

	constructor() {
		this.loadWorksheet();
	}

	nextStep() {
		if (this.step < 4) this.step++;
	}

	prevStep() {
		if (this.step > 0) this.step--;
	}

	reset() {
		this.step = 0;
		this.grade = null;
		this.selectedDomain = null;
		this.selectedUnit = null;
		this.selectedSkills = [];
		this.customTopic = '';
		this.difficulty = 3;
		this.questionCount = 10;
		this.questionType = 'auto';
		this.worksheet = null;
		this.error = null;
		if (typeof window !== 'undefined') {
			sessionStorage.removeItem(SESSION_KEY);
		}
	}

	selectGrade(grade: GradeLevel) {
		this.grade = grade;
		this.selectedDomain = null;
		this.selectedUnit = null;
		this.selectedSkills = [];
		this.customTopic = '';
		this.step = 1;
	}

	selectUnit(domain: Domain, unit: Unit) {
		this.selectedDomain = domain;
		this.selectedUnit = unit;
		this.selectedSkills = [];
		this.customTopic = '';
		this.step = 2;
	}

	/** Use a custom topic — skip skill selection, go straight to config */
	useCustomTopic(topic: string) {
		this.customTopic = topic;
		this.selectedDomain = null;
		this.selectedUnit = null;
		this.selectedSkills = [];
		this.step = 3;
	}

	toggleSkill(skill: Skill) {
		const idx = this.selectedSkills.findIndex((s) => s.skill_id === skill.skill_id);
		if (idx >= 0) {
			this.selectedSkills = this.selectedSkills.filter((_, i) => i !== idx);
		} else {
			this.selectedSkills = [...this.selectedSkills, skill];
		}
		const available = getAvailableQuestionTypes(this.selectedSkills);
		if (available.length > 0 && !available.includes(this.questionType)) {
			this.questionType = available[0];
		}
	}

	toggleAllSkills(skills: Skill[]) {
		if (this.selectedSkills.length === skills.length) {
			this.selectedSkills = [];
		} else {
			this.selectedSkills = [...skills];
		}
		const available = getAvailableQuestionTypes(this.selectedSkills);
		if (available.length > 0 && !available.includes(this.questionType)) {
			this.questionType = available[0];
		}
	}

	async generate() {
		if (this.isGenerating) return;
		this.isGenerating = true;
		this.error = null;

		const config: BuilderConfig = {
			grade: this.grade,
			selectedSkills: this.selectedSkills,
			customTopic: this.customTopic.trim() || undefined,
			difficulty: this.difficulty,
			questionCount: this.questionCount,
			questionType: this.questionType
		};

		try {
			const response = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					config,
					provider: settingsStore.provider,
					apiKey: settingsStore.activeApiKey,
					model: settingsStore.activeModel
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `Generation failed (${response.status})`);
			}

			const data = await response.json();
			this.worksheet = data.worksheet;
			this.saveWorksheet();
			libraryStore.save(data.worksheet);
			this.step = 4;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'An unexpected error occurred';
		} finally {
			this.isGenerating = false;
		}
	}

	saveWorksheet() {
		if (typeof window === 'undefined' || !this.worksheet) return;
		try {
			sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.worksheet));
		} catch {
			// ignore
		}
	}

	private loadWorksheet() {
		if (typeof window === 'undefined') return;
		try {
			const stored = sessionStorage.getItem(SESSION_KEY);
			if (stored) {
				this.worksheet = JSON.parse(stored);
			}
		} catch {
			// ignore
		}
	}
}

export const worksheetStore = new WorksheetStore();
