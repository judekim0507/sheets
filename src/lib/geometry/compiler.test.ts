import { describe, expect, test } from 'bun:test';
import { buildTeacherGradeGeometryDiagram, validateGeometryDiagram } from './compiler';
import { fixDiagram } from '$lib/ai/fix-diagram';

describe('geometry compiler', () => {
	test('compiles standard-position trig from question text into a canonical reference triangle', () => {
		const result = buildTeacherGradeGeometryDiagram(
			'A point P lies on the terminal arm of an angle in standard position. The coordinates of P are (-3, 4). Determine the exact value of sin θ, cos θ, and tan θ.'
		);

		expect(result?.family).toBe('standard-position-trig');
		expect(result?.diagram.elements.some((element) => element.type === 'axes')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'ray')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'right_angle')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'point' && element.x === -3 && element.y === 4)).toBe(true);
		const axes = result?.diagram.elements.find((element) => element.type === 'axes');
		expect(axes?.y_min).toBeGreaterThan(-4);
		expect(axes?.grid).toBe(false);
		expect(axes?.padding).toBe(0.35);
	});

	test('compiles CAST-rule circle diagrams with solution-angle rays', () => {
		const result = buildTeacherGradeGeometryDiagram(
			'Determine all angles in the interval [0°, 360°) that satisfy tan θ = -√3. Use the reference angle and the CAST rule.',
			JSON.stringify({
				family: 'cast-circle',
				trigFunction: 'tan',
				sign: 'negative',
				referenceAngleDegrees: 60
			})
		);

		expect(result?.family).toBe('cast-circle');
		expect(result?.diagram.elements.some((element) => element.type === 'circle')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '120°')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '300°')).toBe(true);
	});

	test('infers multiple solution angles for simple trig quadratics', () => {
		const result = buildTeacherGradeGeometryDiagram(
			'Solve the equation $2\\cos^2\\theta-\\cos\\theta-1=0$ for $\\theta \\in [0^\\circ,360^\\circ)$. Give exact answers.'
		);

		expect(result?.family).toBe('cast-circle');
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '0°')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '120°')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '240°')).toBe(true);
	});

	test('supports nearest-degree tangent quadratics with non-special values', () => {
		const result = buildTeacherGradeGeometryDiagram(
			'Solve the equation $2\\tan^2\\theta-5\\tan\\theta+3=0$ for $\\theta \\in [0^\\circ,360^\\circ)$. Give answers to the nearest degree where necessary.'
		);

		expect(result?.family).toBe('cast-circle');
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '45°')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '56°')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '225°')).toBe(true);
		expect(result?.diagram.elements.some((element) => element.type === 'label' && element.text === '236°')).toBe(true);
	});

	test('infers teacher-grade 3D solids from the question text', () => {
		const result = buildTeacherGradeGeometryDiagram(
			'Find the volume of a cylinder with radius 3 cm and height 8 cm.'
		);

		expect(result?.family).toBe('three-d-solid');
		expect(result?.diagram.elements[0].type).toBe('cylinder');
		expect(result?.diagram.elements[0].dimension_labels).toEqual({
			radius: '3 cm',
			height: '8 cm'
		});
	});

	test('compiles polygon measurement intents into canonical labeled shapes', () => {
		const result = buildTeacherGradeGeometryDiagram(
			'Find the area of rectangle ABCD.',
			JSON.stringify({
				family: 'polygon-measurement',
				shape: 'rectangle',
				vertexLabels: ['A', 'B', 'C', 'D'],
				sideLabels: { 'A-B': '8 cm', 'B-C': '5 cm' },
				rightAngles: ['A', 'B', 'C', 'D']
			})
		);

		expect(result?.family).toBe('polygon-measurement');
		expect(result?.diagram.elements.some((element) => element.type === 'polygon')).toBe(true);
		expect(result?.diagram.elements.filter((element) => element.type === 'right_angle')).toHaveLength(4);
	});
});

describe('geometry validation', () => {
	test('accepts compiled standard-position trig diagrams', () => {
		const result = buildTeacherGradeGeometryDiagram(
			'A point P lies on the terminal arm of an angle in standard position. The coordinates of P are (-3, 4). Determine the exact value of sin θ, cos θ, and tan θ.'
		);

		expect(validateGeometryDiagram(
			'A point P lies on the terminal arm of an angle in standard position. The coordinates of P are (-3, 4). Determine the exact value of sin θ, cos θ, and tan θ.',
			result!.diagram
		).diagnostics).toHaveLength(0);
	});
});

describe('fixDiagram geometry compilation', () => {
	test('builds geometry from diagram_intent and strips the generation-only field', () => {
		const fixed = fixDiagram({
			question: 'Find the volume of a cylinder with radius 3 cm and height 8 cm.',
			has_diagram: true,
			diagram_intent: JSON.stringify({
				family: 'three-d-solid',
				solid: 'cylinder',
				dimensionLabels: { radius: '3 cm', height: '8 cm' }
			})
		});

		expect(fixed.diagram?.elements[0].type).toBe('cylinder');
		expect(Object.prototype.hasOwnProperty.call(fixed, 'diagram_intent')).toBe(false);
	});
});
