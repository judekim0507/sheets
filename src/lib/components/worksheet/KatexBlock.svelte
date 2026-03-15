<script lang="ts">
	import katex from 'katex';

	let { text }: { text: string } = $props();

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function renderMathInText(input: string): string {
		let result = escapeHtml(input);

		// Display math: $$...$$
		result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
			try {
				return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false, strict: false });
			} catch {
				return `<code>${escapeHtml(tex)}</code>`;
			}
		});

		// Inline math: $...$
		result = result.replace(/(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g, (_, tex) => {
			try {
				return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false, strict: false });
			} catch {
				return `<code>${escapeHtml(tex)}</code>`;
			}
		});

		return result;
	}

	const rendered = $derived(renderMathInText(text));
</script>

<span class="katex-block">{@html rendered}</span>
