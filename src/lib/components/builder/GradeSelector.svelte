<script lang="ts">
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { gradeLabel } from '$lib/data/math';
	import type { GradeLevel } from '$lib/data/types';

	const groups: { label: string; grades: GradeLevel[] }[] = [
		{ label: 'Elementary', grades: [0, 1, 2, 3, 4, 5] },
		{ label: 'Middle School', grades: [6, 7, 8] },
		{ label: 'High School', grades: [9, 10, 11, 12] }
	];
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-8 text-center">
		<h2 class="text-2xl font-semibold tracking-tight">Select a Grade Level</h2>
		<p class="mt-2 text-muted-foreground">Choose the grade to find relevant math skills</p>
	</div>

	<div class="space-y-8">
		{#each groups as group}
			<div>
				<p class="mb-3 text-sm font-medium text-muted-foreground">{group.label}</p>
				<div class="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-7">
					{#each group.grades as grade}
						<button
							class="flex h-16 items-center justify-center rounded-xl border-2 text-lg font-semibold transition-all hover:border-primary hover:bg-primary/5 active:scale-95
								{worksheetStore.grade === grade
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border'}"
							onclick={() => worksheetStore.selectGrade(grade)}
						>
							{gradeLabel(grade)}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
