<script lang="ts">
	import type { GeneratedQuestion } from '$lib/data/types';
	import KatexBlock from './KatexBlock.svelte';

	let { question, index }: { question: GeneratedQuestion; index: number } = $props();
</script>

<div class="question-card">
	<div class="flex gap-2">
		<span class="mt-px text-sm font-bold">{index + 1}.</span>
		<div class="flex-1 space-y-1">
			<div class="text-[10px] leading-snug text-muted-foreground">
				<KatexBlock text={question.question} />
			</div>

			{#if question.solution_steps.length > 0}
				<div class="space-y-0.5 rounded bg-muted/40 px-2 py-1.5">
					{#each question.solution_steps as step, i}
						<div class="flex gap-1 text-[10px]">
							<span class="shrink-0 text-muted-foreground">({i + 1})</span>
							<KatexBlock text={step} />
						</div>
					{/each}
				</div>
			{/if}

			<div class="flex items-center gap-1 text-[11px]">
				<span class="font-semibold">Ans:</span>
				<span class="font-semibold text-primary">
					<KatexBlock text={question.final_answer} />
				</span>
			</div>
		</div>
	</div>
</div>
