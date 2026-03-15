<script lang="ts">
	import type { GeneratedQuestion } from '$lib/data/types';
	import KatexBlock from './KatexBlock.svelte';
	import DiagramRenderer from './DiagramRenderer.svelte';

	let { question, index }: { question: GeneratedQuestion; index: number } = $props();
</script>

<div class="question-card">
	<div class="flex gap-2">
		<span class="mt-px text-sm font-bold">{index + 1}.</span>
		<div class="flex-1 space-y-2">
			<div class="text-[11px] leading-snug">
				<KatexBlock text={question.question} />
			</div>

			{#if question.has_diagram && question.diagram}
				<div class="flex justify-center py-1">
					<DiagramRenderer diagram={question.diagram} />
				</div>
			{/if}

			{#if question.choices && question.choices.length > 0}
				<div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
					{#each question.choices as choice, i}
						<div class="flex items-start gap-1">
							<span class="font-medium text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
							<KatexBlock text={choice} />
						</div>
					{/each}
				</div>
			{/if}

			{#if question.match_pairs && question.match_pairs.length > 0}
				<div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
					<div class="font-medium text-muted-foreground">Column A</div>
					<div class="font-medium text-muted-foreground">Column B</div>
					{#each question.match_pairs as pair, i}
						<div>{i + 1}. <KatexBlock text={pair.left} /></div>
						<div>{String.fromCharCode(65 + i)}. <KatexBlock text={pair.right} /></div>
					{/each}
				</div>
			{/if}

			<!-- Answer space -->
			{#if !question.choices && !question.match_pairs}
				<div class="mt-2 space-y-3 pb-1">
					{#each Array(2) as _}
						<div class="border-b border-dashed border-muted-foreground/25"></div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
