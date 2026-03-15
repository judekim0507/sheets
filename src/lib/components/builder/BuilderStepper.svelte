<script lang="ts">
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import Check from '@lucide/svelte/icons/check';

	const allSteps = ['Grade', 'Topic', 'Skills', 'Configure'];

	// When using custom topic, skip the Skills step
	const steps = $derived(
		worksheetStore.isCustom
			? [{ label: 'Grade', step: 0 }, { label: 'Topic', step: 1 }, { label: 'Configure', step: 3 }]
			: allSteps.map((label, i) => ({ label, step: i }))
	);
</script>

<nav class="mb-8 flex items-center justify-center gap-2">
	{#each steps as { label, step }, i}
		{@const isCompleted = worksheetStore.step > step}
		{@const isCurrent = worksheetStore.step === step}
		{#if i > 0}
			<div
				class="h-px w-8 transition-colors sm:w-12 {isCompleted
					? 'bg-primary'
					: 'bg-border'}"
			></div>
		{/if}
		<button
			class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors
				{isCurrent
				? 'bg-primary text-primary-foreground'
				: isCompleted
					? 'bg-primary/10 text-primary hover:bg-primary/20'
					: 'text-muted-foreground'}"
			onclick={() => {
				if (isCompleted) {
					if (step === 1 && worksheetStore.isCustom) {
						worksheetStore.customTopic = '';
					}
					worksheetStore.step = step;
				}
			}}
			disabled={!isCompleted && !isCurrent}
		>
			{#if isCompleted}
				<Check class="h-3.5 w-3.5" />
			{:else}
				<span
					class="flex h-5 w-5 items-center justify-center rounded-full text-xs
						{isCurrent ? 'bg-primary-foreground/20' : 'bg-muted'}"
				>
					{i + 1}
				</span>
			{/if}
			<span class="hidden sm:inline">{label}</span>
		</button>
	{/each}
</nav>
