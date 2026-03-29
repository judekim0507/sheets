import katex from 'katex';

const ESCAPED_DOLLAR_TOKEN = 'ESCAPEDDOLLARTOKEN';

type RenderSegment =
	| { type: 'text'; value: string }
	| { type: 'html'; value: string };

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function protectLiteralDollars(text: string): string {
	return text.replace(/\\\$/g, ESCAPED_DOLLAR_TOKEN);
}

function restoreLiteralDollars(text: string): string {
	return text.replaceAll(ESCAPED_DOLLAR_TOKEN, '$');
}

function normalizeMalformedCurrency(text: string): string {
	const marker = `(?:\\$|${ESCAPED_DOLLAR_TOKEN})`;
	const leadingDouble = new RegExp(`(^|[^$])${marker}{2}(\\d[\\d,]*(?:\\.\\d{1,2})?)${marker}(?!\\$|${ESCAPED_DOLLAR_TOKEN})`, 'g');
	const trailingDouble = new RegExp(`(^|[^$])${marker}(\\d[\\d,]*(?:\\.\\d{1,2})?)${marker}{2}(?!\\$|${ESCAPED_DOLLAR_TOKEN})`, 'g');

	return text
		.replace(leadingDouble, (_, prefix: string, amount: string) => `${prefix}${ESCAPED_DOLLAR_TOKEN}${amount}`)
		.replace(trailingDouble, (_, prefix: string, amount: string) => `${prefix}${ESCAPED_DOLLAR_TOKEN}${amount}`);
}

function renderLatex(tex: string, displayMode: boolean): string {
	try {
		return katex.renderToString(tex.trim(), {
			displayMode,
			throwOnError: false,
			strict: false
		});
	} catch {
		return `<code>${escapeHtml(tex)}</code>`;
	}
}

function isEscaped(text: string, index: number): boolean {
	let slashCount = 0;
	for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
		slashCount += 1;
	}
	return slashCount % 2 === 1;
}

function isLikelyInlineMath(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	if (trimmed.length > 80) return false;
	if (/^\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)$/.test(trimmed)) return true;
	if (/\b(?:slope|intercept|rewrite|convert|identify|graph|equation|answer|form|find|solve|then|what|where|when)\b/i.test(trimmed)) {
		return false;
	}
	if (/\\[a-zA-Z]+|[\^_=<>±÷×°′″]|(?<!\s)[+\-*/](?!\s)|\{|\}/.test(trimmed)) {
		return true;
	}
	if (/^[A-Za-z]$/.test(trimmed)) return true;
	// Geometry labels: AB, ABC, ABCD, etc.
	if (/^[A-Z]{2,6}$/.test(trimmed)) return true;
	// Numbers with degree/prime: 35°, 90°, 45′
	if (/^[+-]?\d+(?:\.\d+)?[°′″%]?$/.test(trimmed)) return true;
	if (/^[A-Za-z0-9()., ]+$/.test(trimmed) && trimmed.split(/\s+/).length <= 3) {
		return trimmed.split(/\s+/).every((token) =>
			/^[+-]?\d+(?:\.\d+)?[°′″%]?$/.test(token)
			|| /^[A-Za-z]$/.test(token)
			|| /^[A-Z]{2,6}$/.test(token)
			|| /^[A-Za-z]?\d+(?:\.\d+)?[A-Za-z]?$/.test(token)
			|| /^[A-Za-z]+\([A-Za-z]+\)$/.test(token)
			|| /^\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)$/.test(token)
		);
	}
	return false;
}

function findMathBoundary(text: string): number | null {
	const trimmed = text.trimStart();
	const offset = text.length - trimmed.length;
	const boundary = trimmed.match(
		/^(.{1,80}?)(?=(?:\s+(?:in|to|and|then|where|what|graph|identify|write|rewrite|convert|solve|simplify|evaluate|determine|find)\b|[.,;:!?]))/
	);
	if (!boundary) return null;
	const candidate = boundary[1]?.trim();
	if (!candidate || !isLikelyInlineMath(candidate)) return null;
	return offset + boundary[1].length;
}

function pushText(segments: RenderSegment[], value: string) {
	if (!value) return;
	const last = segments[segments.length - 1];
	if (last?.type === 'text') {
		last.value += value;
		return;
	}
	segments.push({ type: 'text', value });
}

function findClosingDelimiter(input: string, start: number, delimiter: string): number {
	for (let index = start; index <= input.length - delimiter.length; index += 1) {
		if (input.slice(index, index + delimiter.length) === delimiter && !isEscaped(input, index)) {
			return index;
		}
	}
	return -1;
}

function tokenizeRichText(input: string): RenderSegment[] {
	const segments: RenderSegment[] = [];
	let cursor = 0;

	while (cursor < input.length) {
		if (input.startsWith('\\[', cursor)) {
			const close = input.indexOf('\\]', cursor + 2);
			if (close >= 0) {
				pushText(segments, input.slice(0, 0)); // no-op to preserve flat structure
				segments.push({ type: 'html', value: renderLatex(input.slice(cursor + 2, close), true) });
				cursor = close + 2;
				continue;
			}
		}

		if (input.startsWith('\\(', cursor)) {
			const close = input.indexOf('\\)', cursor + 2);
			if (close >= 0) {
				segments.push({ type: 'html', value: renderLatex(input.slice(cursor + 2, close), false) });
				cursor = close + 2;
				continue;
			}
		}

		if (input.startsWith('$$', cursor)) {
			const close = findClosingDelimiter(input, cursor + 2, '$$');
			if (close >= 0) {
				segments.push({ type: 'html', value: renderLatex(input.slice(cursor + 2, close), true) });
				cursor = close + 2;
				continue;
			}
		}

		if (input[cursor] === '$' && !isEscaped(input, cursor)) {
			let matched = false;
			for (let close = cursor + 1; close < input.length; close += 1) {
				if (input[close] !== '$' || isEscaped(input, close)) continue;
				const candidate = input.slice(cursor + 1, close);
				if (!isLikelyInlineMath(candidate)) continue;
				segments.push({ type: 'html', value: renderLatex(candidate, false) });
				cursor = close + 1;
				matched = true;
				break;
			}

			if (matched) continue;

			const boundary = findMathBoundary(input.slice(cursor + 1));
			if (boundary != null) {
				const candidate = input.slice(cursor + 1, cursor + 1 + boundary);
				segments.push({ type: 'html', value: renderLatex(candidate, false) });
				cursor = cursor + 1 + boundary;
				continue;
			}
		}

		pushText(segments, input[cursor]);
		cursor += 1;
	}

	return segments;
}

function renderMarkdownText(text: string): string {
	let html = escapeHtml(text);
	html = html.replace(/\r\n|\r|\n/g, '<br>');
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
	html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
	html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
	return html;
}

export function renderMathInText(input: string): string {
	const protectedInput = normalizeMalformedCurrency(protectLiteralDollars(input));
	const segments = tokenizeRichText(protectedInput);
	const html = segments
		.map((segment) => segment.type === 'html' ? segment.value : renderMarkdownText(segment.value))
		.join('');

	return restoreLiteralDollars(html).replace(/([A-Za-z0-9)])\$(?=-[A-Za-z])/g, '$1');
}
