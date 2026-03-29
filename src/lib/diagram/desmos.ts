import type { DiagramGraph, GraphExpression } from '$lib/data/types';

const DEMO_API_KEY = 'dcb31709b452b1cf9dc26972add0fda6';
const SCRIPT_ID = 'desmos-calculator-script';
const SCRIPT_SRC = `https://www.desmos.com/api/v1.1/calculator.js?apiKey=${import.meta.env.PUBLIC_DESMOS_API_KEY || DEMO_API_KEY}`;

let loadPromise: Promise<DesmosGlobal> | null = null;

export interface DesmosExpression {
	id: string;
	latex: string;
	color?: string;
	lineStyle?: string;
	pointStyle?: string;
	points?: boolean;
	lines?: boolean;
	hidden?: boolean;
	label?: string;
	showLabel?: boolean;
	dragMode?: string;
}

export interface DesmosCalculator {
	setExpression(expression: DesmosExpression): void;
	setExpressions(expressions: DesmosExpression[]): void;
	updateSettings(settings: Record<string, unknown>): void;
	setMathBounds(bounds: { left: number; right: number; bottom: number; top: number }): void;
	resize(): void;
	screenshot(opts?: Record<string, unknown>): string;
	asyncScreenshot(
		opts: Record<string, unknown>,
		callback: (dataUri: string) => void
	): void;
	destroy(): void;
}

export interface DesmosGlobal {
	GraphingCalculator(
		element: HTMLElement,
		options?: Record<string, unknown>
	): DesmosCalculator;
	Styles: Record<string, string>;
	DragModes: Record<string, string>;
	AxisArrowModes: Record<string, string>;
	FontSizes: Record<string, number>;
}

declare global {
	interface Window {
		Desmos?: DesmosGlobal;
	}
}

export async function loadDesmos(): Promise<DesmosGlobal> {
	if (window.Desmos) return window.Desmos;
	if (loadPromise) return loadPromise;

	loadPromise = new Promise<DesmosGlobal>((resolve, reject) => {
		const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
		if (existing) {
			if (window.Desmos) {
				resolve(window.Desmos);
				return;
			}
			existing.addEventListener('load', () => window.Desmos ? resolve(window.Desmos) : reject(new Error('Desmos failed to initialize')));
			existing.addEventListener('error', () => reject(new Error('Failed to load Desmos')));
			return;
		}

		const script = document.createElement('script');
		script.id = SCRIPT_ID;
		script.async = true;
		script.src = SCRIPT_SRC;
		script.onload = () => {
			if (window.Desmos) resolve(window.Desmos);
			else reject(new Error('Desmos failed to initialize'));
		};
		script.onerror = () => reject(new Error('Failed to load Desmos'));
		document.head.appendChild(script);
	});

	return loadPromise;
}

export function createDesmosExpressions(graph: DiagramGraph, desmos: DesmosGlobal): DesmosExpression[] {
	return graph.expressions.map((expr, index) => {
		const state: Record<string, unknown> = {
			type: 'expression',
			id: expr.id || `expr-${index + 1}`,
			latex: expr.latex
		};

		if (expr.color) state.color = expr.color;

		const lineStyle = mapLineStyle(expr, desmos);
		if (lineStyle) state.lineStyle = lineStyle;

		const pointStyle = mapPointStyle(expr, desmos);
		if (pointStyle) {
			state.pointStyle = pointStyle;
			state.dragMode = desmos.DragModes.NONE;
		}

		if (expr.points != null) state.points = expr.points;
		if (expr.lines != null) state.lines = expr.lines;
		if (expr.fill != null) state.fill = expr.fill;
		if (expr.fill_opacity != null) state.fillOpacity = expr.fill_opacity;
		if (expr.hidden != null) state.hidden = expr.hidden;
		return state as unknown as DesmosExpression;
	});
}

function mapLineStyle(expr: GraphExpression, desmos: DesmosGlobal): string | undefined {
	switch (expr.line_style) {
		case 'dashed':
			return desmos.Styles.DASHED;
		case 'dotted':
			return desmos.Styles.DOTTED;
		case 'solid':
			return desmos.Styles.SOLID;
		default:
			return undefined;
	}
}

function mapPointStyle(expr: GraphExpression, desmos: DesmosGlobal): string | undefined {
	switch (expr.point_style) {
		case 'open':
			return desmos.Styles.OPEN;
		case 'cross':
			return desmos.Styles.CROSS;
		case 'point':
			return desmos.Styles.POINT;
		default:
			return undefined;
	}
}
