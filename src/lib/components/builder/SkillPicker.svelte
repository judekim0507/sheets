<script lang="ts">
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { parseDifficultyNotes } from '$lib/data/math';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Check from '@lucide/svelte/icons/check';
	import Button from '$lib/components/ui/button/button.svelte';

	const skills = $derived(worksheetStore.selectedUnit?.skills ?? []);
	const allSelected = $derived(
		skills.length > 0 && worksheetStore.selectedSkills.length === skills.length
	);

	function isSelected(skillId: string): boolean {
		return worksheetStore.selectedSkills.some((s) => s.skill_id === skillId);
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center gap-3">
		<button
			class="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
			onclick={() => worksheetStore.prevStep()}
		>
			<ChevronLeft class="h-4 w-4" />
		</button>
		<div>
			<h2 class="text-xl font-semibold tracking-tight">Select Skills</h2>
			<p class="text-sm text-muted-foreground">
				{worksheetStore.selectedUnit?.unit_name} — choose at least one skill
			</p>
		</div>
	</div>

	<div class="mb-4 flex items-center justify-between">
		<button
			class="text-sm font-medium text-primary hover:underline"
			onclick={() => worksheetStore.toggleAllSkills(skills)}
		>
			{allSelected ? 'Deselect All' : 'Select All'}
		</button>
		<span class="text-sm text-muted-foreground">
			{worksheetStore.selectedSkills.length} selected
		</span>
	</div>

	<Separator class="mb-4" />

	<div class="space-y-1">
		{#each skills as skill}
			{@const selected = isSelected(skill.skill_id)}
			{@const diffNotes = parseDifficultyNotes(skill.difficulty_notes)}
			{@const preview = Object.entries(diffNotes)
				.map(([l, d]) => `L${l}: ${d}`)
				.join(' | ')}
			<button
				class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent {selected ? 'bg-accent/50' : ''}"
				onclick={() => worksheetStore.toggleSkill(skill)}
			>
				<div
					class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors {selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}"
				>
					{#if selected}
						<Check class="h-3 w-3" />
					{/if}
				</div>
				<span class="text-sm">{skill.skill_name}</span>
			</button>
		{/each}
	</div>

	{#if skills.length === 0}
		<div class="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
			No skills found for this unit.
		</div>
	{/if}

	<div class="mt-6 flex justify-end">
		<Button
			disabled={worksheetStore.selectedSkills.length === 0}
			onclick={() => worksheetStore.nextStep()}
		>
			Continue ({worksheetStore.selectedSkills.length})
		</Button>
	</div>
</div>
