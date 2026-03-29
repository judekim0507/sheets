<script lang="ts">
	import { renderMathInText } from './katex-render';

	let { text }: { text: string } = $props();

	const rendered = $derived(renderMathInText(text));
</script>

<span class="katex-block">{@html rendered}</span>
