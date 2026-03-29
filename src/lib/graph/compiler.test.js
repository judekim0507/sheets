import { describe, expect, test } from 'bun:test';
import { compileGraph, createGraphRenderPlan, getSafeGraphLabel, validateGraphRenderPlan } from './compiler';

describe('graph compiler', () => {
	test('compiles a linear function to svg renderable output', () => {
		const graph = {
			viewport: { left: -50, right: 50, bottom: -50, top: 50 },
			expressions: [{ latex: 'y=-2x+3' }]
		};

		const compilation = compileGraph(graph);
		const plan = createGraphRenderPlan(graph, compilation);
		const validation = validateGraphRenderPlan(graph, compilation, plan);

		expect(compilation.plots).toHaveLength(1);
		expect(compilation.unsupportedExpressions).toHaveLength(0);
		expect(plan.engine).toBe('svg');
		expect(plan.visibleTargets).toEqual(['expr-1']);
		expect(validation.ok).toBe(true);
		expect(plan.viewport.top - plan.viewport.bottom).toBeLessThan(80);
	});

	test('autofits an off-origin point instead of trusting the AI viewport', () => {
		const graph = {
			viewport: { left: 0, right: 10, bottom: 40, top: 100 },
			expressions: [{ latex: '(32,-18)', point_style: 'point' }]
		};

		const plan = createGraphRenderPlan(graph, compileGraph(graph));

		expect(plan.viewport.left).toBeLessThan(32);
		expect(plan.viewport.right).toBeGreaterThan(32);
		expect(plan.viewport.bottom).toBeLessThan(-18);
		expect(plan.viewport.top).toBeGreaterThan(-18);
		expect(plan.viewportSource).toBe('autofit');
	});

	test('compiles circles and preserves filled inequalities', () => {
		const graph = {
			viewport: { left: -10, right: 10, bottom: -10, top: 10 },
			expressions: [{ latex: '(x-2)^2+(y+1)^2<=16', color: '#ef4444' }]
		};

		const compilation = compileGraph(graph);
		const plan = createGraphRenderPlan(graph, compilation);

		expect(compilation.plots[0].kind).toBe('circle');
		expect(plan.plots[0].kind).toBe('circle');
		expect(plan.plots[0].fill).toBe('inside');
	});

	test('supports domain-restricted piecewise expressions', () => {
		const graph = {
			viewport: { left: -10, right: 10, bottom: -10, top: 10 },
			expressions: [{ latex: 'y=x^2\\left\\{x<=0\\right\\}' }]
		};

		const plan = createGraphRenderPlan(graph, compileGraph(graph));
		const plot = plan.plots[0];

		expect(plot.kind).toBe('function');
		expect(plot.segments.every((segment) => segment.every((point) => point.x <= 0.1))).toBe(true);
	});

	test('routes unsupported expressions to the desmos fallback', () => {
		const graph = {
			viewport: { left: -10, right: 10, bottom: -10, top: 10 },
			expressions: [{ latex: 'r=2\\sin(5\\theta)' }]
		};

		const compilation = compileGraph(graph);
		const plan = createGraphRenderPlan(graph, compilation);

		expect(compilation.unsupportedExpressions).toHaveLength(1);
		expect(plan.engine).toBe('desmos');
	});

	test('supports point-slope linear equations', () => {
		const graph = {
			viewport: { left: -10, right: 10, bottom: -10, top: 10 },
			expressions: [{ latex: 'y-3=-2(x+1)' }]
		};

		const compilation = compileGraph(graph);
		const plan = createGraphRenderPlan(graph, compilation);

		expect(compilation.plots).toHaveLength(1);
		expect(compilation.unsupportedExpressions).toHaveLength(0);
		expect(plan.engine).toBe('svg');
	});

	test('supports dfrac linear equations', () => {
		const graph = {
			viewport: { left: -10, right: 10, bottom: -10, top: 10 },
			expressions: [{ latex: 'y=\\dfrac{3}{4}x-5' }]
		};

		const compilation = compileGraph(graph);
		const plan = createGraphRenderPlan(graph, compilation);

		expect(compilation.plots).toHaveLength(1);
		expect(compilation.unsupportedExpressions).toHaveLength(0);
		expect(plan.engine).toBe('svg');
	});

	test('autofits linear functions to student-readable bounds', () => {
		const graph = {
			viewport: { left: -50, right: 50, bottom: -50, top: 50 },
			expressions: [{ latex: 'y=2x+1' }, { latex: '(2,5)' }, { latex: '(6,13)' }]
		};

		const plan = createGraphRenderPlan(graph, compileGraph(graph));

		expect(plan.viewport.left).toBeLessThanOrEqual(0);
		expect(plan.viewport.bottom).toBeLessThanOrEqual(0);
		expect(plan.viewport.right).toBeGreaterThanOrEqual(6);
		expect(plan.viewport.top).toBeGreaterThanOrEqual(13);
		expect(plan.viewport.top - plan.viewport.bottom).toBeLessThan(24);
	});

	test('drops unsafe graph labels', () => {
		expect(getSafeGraphLabel('$(0,5)$')).toBeUndefined();
		expect(getSafeGraphLabel('y=5/4x+5')).toBeUndefined();
		expect(getSafeGraphLabel('(4,0)')).toBe('(4,0)');
		expect(getSafeGraphLabel('x-intercept')).toBe('x-intercept');
	});
});
