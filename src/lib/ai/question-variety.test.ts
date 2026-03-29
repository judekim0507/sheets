import { describe, expect, test } from 'bun:test';
import { findDuplicateQuestion, normalizeQuestionTemplate, questionBriefFingerprint, uniqueQuestionBriefs } from './question-variety';

describe('question variety', () => {
	test('normalizes repeated terminal-arm trig stems to the same template', () => {
		const a = normalizeQuestionTemplate('The point $P(-5,12)$ lies on the terminal arm of angle $\\theta$ in standard position. Determine the exact values of $\\sin\\theta$, $\\cos\\theta$, and $\\tan\\theta$.');
		const b = normalizeQuestionTemplate('The point $P(-3,4)$ lies on the terminal arm of angle $\\theta$ in standard position. Determine the exact values of $\\sin\\theta$, $\\cos\\theta$, and $\\tan\\theta$.');

		expect(a).toBe(b);
	});

	test('flags repeated worksheet templates even when the numbers change', () => {
		const duplicate = findDuplicateQuestion(
			{
				question: 'Solve the equation $2\\cos^2\\theta-\\cos\\theta-1=0$ for $\\theta\\in[0^\\circ,360^\\circ)$. Give exact answers.',
				has_diagram: false,
				solution_steps: [],
				final_answer: ''
			},
			[
				{
					question: 'Solve the equation $3\\cos^2\\theta-2\\cos\\theta-1=0$ for $\\theta\\in[0^\\circ,360^\\circ)$. Give exact answers.',
					has_diagram: false,
					solution_steps: [],
					final_answer: ''
				}
			]
		);

		expect(duplicate?.reason).toBe('template-match');
	});

	test('flags standard-position trig questions that reuse the same point with extra follow-up asks', () => {
		const duplicate = findDuplicateQuestion(
			{
				question: 'The point $P(-5,12)$ lies on the terminal arm of angle $\\theta$ in standard position. Determine the exact values of $\\sin\\theta$, $\\cos\\theta$, and $\\tan\\theta$, then state the reference angle $\\theta_R$ to the nearest degree.',
				has_diagram: true,
				solution_steps: [],
				final_answer: ''
			},
			[
				{
					question: 'The terminal arm of angle $\\theta$ in standard position passes through the point $P(-5,12)$. Determine the exact values of $\\sin\\theta$, $\\cos\\theta$, and $\\tan\\theta$.',
					has_diagram: true,
					solution_steps: [],
					final_answer: ''
				}
			]
		);

		expect(duplicate?.reason).toBe('semantic-match');
	});

	test('dedupes planner briefs that only vary by numbers', () => {
		const a = {
			brief_id: 'b1',
			uniqueness_key: 'standard-position-trig|point(-5,12)|exact-values',
			concept_family: 'standard-position-trig',
			skill_focus: 'exact trig ratios from a terminal-arm point',
			problem_type: 'open response',
			diagram_mode: 'geometry' as const,
			diagram_family: 'standard-position-trig',
			givens: ['point P(-5,12)', 'standard position'],
			task: 'Find the exact values of sin theta, cos theta, and tan theta.',
			constraints: []
		};
		const b = {
			...a,
			brief_id: 'b2',
			uniqueness_key: 'standard-position-trig|point(-3,4)|exact-values',
			givens: ['point P(-3,4)', 'standard position']
		};

		expect(questionBriefFingerprint(a)).toBe(questionBriefFingerprint(b));
		expect(uniqueQuestionBriefs([a, b])).toHaveLength(1);
	});
});
