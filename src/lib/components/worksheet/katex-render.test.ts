import { describe, expect, test } from 'bun:test';
import { renderMathInText } from './katex-render';

describe('renderMathInText', () => {
	test('keeps escaped currency dollars as literal text', () => {
		const rendered = renderMathInText('A gym costs \\$30 per day plus a \\$50 initiation fee.');
		expect(rendered).toContain('$30 per day plus a $50');
		expect(rendered).not.toContain('\\$30');
	});

	test('renders inline bracketed latex', () => {
		const rendered = renderMathInText('Solve \\(x^2 + 1 = 0\\).');
		expect(rendered).toContain('katex');
		expect(rendered).toContain('x^2');
	});

	test('does not treat plain currency as inline math', () => {
		const rendered = renderMathInText('Membership is $30 today and $45 next week.');
		expect(rendered).toContain('$30 today and $45');
	});

	test('renders equation wrapped in dollar delimiters that starts with a number', () => {
		const rendered = renderMathInText('Rewrite $7x - 3y = 21$ in slope-intercept form.');
		expect(rendered).toContain('katex');
		expect(rendered).not.toContain('$7x - 3y = 21$');
	});

	test('repairs malformed inline math that is missing a closing dollar before prose', () => {
		const rendered = renderMathInText(
			'Convert $5x + 4y = 20 to slope-intercept form and identify the slope and y$-intercept.'
		);
		expect(rendered).toContain('katex');
		expect(rendered).toContain('y-intercept');
		expect(rendered).not.toContain('toslope');
		expect(rendered).not.toContain('y$-intercept');
	});

	test('renders coordinate points wrapped in inline dollars', () => {
		const rendered = renderMathInText('Plot the point $(4,5)$.');
		expect(rendered).toContain('katex');
		expect(rendered).not.toContain('$(4,5)$');
	});

	test('renders multiple inline math spans in the same sentence', () => {
		const rendered = renderMathInText(
			'Convert $Ax + By = C$, where $A$, $B$, and $C$ are integers and $A > 0$.'
		);
		expect(rendered.match(/katex/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
		expect(rendered).not.toContain('$A > 0$');
	});

	test('renders basic markdown emphasis in prose', () => {
		const rendered = renderMathInText('**Left column:** Match each graph.');
		expect(rendered).toContain('<strong>Left column:</strong>');
		expect(rendered).not.toContain('**Left column:**');
	});

	test('normalizes malformed doubled-dollar currency markers', () => {
		const rendered = renderMathInText(
			'A music streaming service charges a $$15$ monthly fee and $$0.05$ per song downloaded.'
		);
		expect(rendered).toContain('$15 monthly fee and $0.05 per song downloaded');
		expect(rendered).not.toContain('$$15$');
		expect(rendered).not.toContain('$$0.05$');
	});

	test('normalizes malformed doubled-dollar decimal amounts in prose', () => {
		const rendered = renderMathInText('The total is $$3.50$ plus $$1.75$.');
		expect(rendered).toContain('$3.50 plus $1.75');
		expect(rendered).not.toContain('$$3.50$');
		expect(rendered).not.toContain('$$1.75$');
	});

	test('normalizes escaped malformed doubled-dollar currency markers', () => {
		const rendered = renderMathInText('The total is \\$\\$3.50\\$ plus \\$\\$1.75\\$.');
		expect(rendered).toContain('$3.50 plus $1.75');
		expect(rendered).not.toContain('$$3.50$');
		expect(rendered).not.toContain('$$1.75$');
	});
});
