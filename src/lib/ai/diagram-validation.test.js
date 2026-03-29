import { describe, expect, test } from 'bun:test';
import { findDiagramIssues } from './diagram-validation';
import { fixDiagram } from './fix-diagram';

describe('diagram validation', () => {
	test('flags graph expressions that do not match the question', () => {
		const issues = findDiagramIssues({
			question: 'Graph $y = -2x + 3$ on the coordinate plane.',
			has_diagram: true,
			diagram: {
				width: 10,
				height: 8,
				elements: [],
				graph: {
					viewport: { left: -5, right: 5, bottom: -5, top: 5 },
					expressions: [{ latex: 'y=x^2' }]
				}
			}
		});

		expect(issues.some((issue) => issue.code === 'graph-mismatch')).toBe(true);
	});

	test('flags missing circle shading when the question explicitly asks for it', () => {
		const issues = findDiagramIssues({
			question: 'Find the area of the red shaded region of the circle shown below.',
			has_diagram: true,
			diagram: {
				width: 10,
				height: 8,
				elements: [],
				graph: undefined
			}
		});

		expect(issues.some((issue) => issue.code === 'missing-circle')).toBe(true);
		expect(issues.some((issue) => issue.code === 'missing-shading')).toBe(true);
		expect(issues.some((issue) => issue.code === 'missing-red-fill')).toBe(true);
	});

	test('accepts a shaded circle sector when the question asks for a red region', () => {
		const issues = findDiagramIssues({
			question: 'Find the area of the red shaded region of the circle shown below.',
			has_diagram: true,
			diagram: {
				width: 10,
				height: 8,
				elements: [
					{ type: 'point', id: 'O', x: 5, y: 4, label: 'O' },
					{ type: 'circle', center: 'O', radius: 3, stroke: '#111827' },
					{ type: 'sector', center: 'O', radius: 3, start_angle: 10, end_angle: 120, fill: '#ef4444', fill_opacity: 0.35 }
				],
				graph: undefined
			}
		});

		expect(issues).toHaveLength(0);
	});

	test('ignores standard-form answer templates when validating graph targets', () => {
		const issues = findDiagramIssues({
			question: 'The graph below displays a linear function. Write the equation of this line in standard form $Ax + By = C$, where A, B, and C are integers and A is non-negative.',
			has_diagram: true,
			diagram: {
				width: 10,
				height: 8,
				elements: [],
				graph: {
					viewport: { left: -4, right: 4, bottom: -4, top: 4 },
					expressions: [{ latex: 'x-y=-1' }, { latex: '(-2,-1)' }, { latex: '(2,3)' }]
				}
			}
		});

		expect(issues.some((issue) => issue.code === 'graph-mismatch')).toBe(false);
	});

	test('matches function notation against equivalent y-form graph expressions', () => {
		const issues = findDiagramIssues({
			question: 'The cost, $C(x)$, of producing $x$ items is given by the linear function $C(x) = 5x + 500$.',
			has_diagram: true,
			diagram: {
				width: 10,
				height: 8,
				elements: [],
				graph: {
					viewport: { left: -20, right: 200, bottom: -100, top: 1500 },
					expressions: [{ latex: 'y=5x+500' }, { latex: '(0,500)' }, { latex: '(150,1250)' }]
				}
			}
		});

		expect(issues.some((issue) => issue.code === 'graph-mismatch')).toBe(false);
	});

	test('ignores slope-intercept teaching templates when validating graph targets', () => {
		const issues = findDiagramIssues({
			question: 'Convert the equation $5x + 2y = 10$ to slope-intercept form ($y = mx + b$).',
			has_diagram: true,
			diagram: {
				width: 10,
				height: 8,
				elements: [],
				graph: {
					viewport: { left: -4, right: 4, bottom: -2, top: 7 },
					expressions: [{ latex: '5x+2y=10' }]
				}
			}
		});

		expect(issues.some((issue) => issue.code === 'graph-mismatch')).toBe(false);
	});

	test('matches equivalent frac and dfrac graph targets', () => {
		const issues = findDiagramIssues({
			question: 'Convert $y = \\dfrac{3}{4}x - 5$ to standard form $Ax + By = C$, where $A$, $B$, and $C$ are integers and $A > 0$.',
			has_diagram: true,
			diagram: {
				width: 10,
				height: 8,
				elements: [],
				graph: {
					viewport: { left: -6, right: 10, bottom: -8, top: 4 },
					expressions: [{ latex: 'y=\\frac{3}{4}x-5' }]
				}
			}
		});

		expect(issues.some((issue) => issue.code === 'graph-mismatch')).toBe(false);
	});
});

describe('fixDiagram graph sanitizing', () => {
	test('deduplicates repeated graph expressions', () => {
		const fixed = fixDiagram({
			question: 'Graph $y=x^2$.',
			has_diagram: true,
			diagram: JSON.stringify({
				width: 10,
				height: 8,
				graph: {
					viewport: { left: -4, right: 4, bottom: -1, top: 8 },
					expressions: [
						{ latex: 'y=x^2' },
						{ latex: ' y = x^2 ' }
					]
				}
			})
		});

		expect(fixed.diagram?.graph?.expressions).toHaveLength(1);
	});
});
