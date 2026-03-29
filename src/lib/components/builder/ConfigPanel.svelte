<script lang="ts">
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { navigate } from '$lib/nav';
	import { parseDifficultyNotes } from '$lib/data/math';
	import type { QuestionType, DifficultyLevel } from '$lib/data/types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	let { onOpenSettings }: { onOpenSettings: () => void } = $props();

	const difficulties: { value: DifficultyLevel; label: string; short: string }[] = [
		{ value: 1, label: 'Introductory', short: 'L1' },
		{ value: 2, label: 'Developing', short: 'L2' },
		{ value: 3, label: 'Proficient', short: 'L3' },
		{ value: 4, label: 'Advanced', short: 'L4' },
		{ value: 5, label: 'Challenge', short: 'L5' }
	];

	const questionTypeLabels: Record<QuestionType, string> = {
		auto: 'Auto (mixed)',
		computation: 'Computation',
		word_problem: 'Word Problem',
		visual: 'Visual',
		multiple_choice: 'Multiple Choice',
		true_false: 'True / False',
		fill_in_blank: 'Fill in the Blank',
		matching: 'Matching',
		error_analysis: 'Error Analysis',
		open_response: 'Open Response'
	};

	const countPresets = [5, 10, 15, 20, 25, 30, 40, 50];

	const diffNote = $derived(() => {
		if (worksheetStore.selectedSkills.length === 0) return '';
		const notes = parseDifficultyNotes(worksheetStore.selectedSkills[0].difficulty_notes);
		return notes[worksheetStore.difficulty] || '';
	});

	const availableTypes = $derived(worksheetStore.availableQuestionTypes);

	let customCount = $state(false);

	let costLabel = $state('');

	$effect(() => {
		const model = settingsStore.activeModel;
		const count = worksheetStore.questionCount;
		const skills = worksheetStore.isCustom ? 1 : worksheetStore.selectedSkills.length;
		const params = new URLSearchParams({ model, questions: String(count), skills: String(skills) });
		fetch(`/api/estimate?${params}`)
			.then((r) => r.json())
			.then((d) => {
				if (d.totalUSD != null) {
					const c = d.totalUSD as number;
					if (c < 0.005) costLabel = '< 1¢';
					else if (c < 0.01) costLabel = `~${(c * 100).toFixed(1)}¢`;
					else if (c < 1) costLabel = `~${(c * 100).toFixed(0)}¢`;
					else costLabel = `~$${c.toFixed(2)}`;
				} else {
					costLabel = '';
				}
			})
			.catch(() => { costLabel = ''; });
	});

	function handleGenerate() {
		if (worksheetStore.isGenerating) return;
		if (!settingsStore.isConfigured) {
			onOpenSettings();
			return;
		}
		worksheetStore.generate();
		navigate('/worksheet');
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center gap-3">
		<button
			class="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
			onclick={() => {
				if (worksheetStore.isCustom) {
					worksheetStore.customTopic = '';
					worksheetStore.step = 1;
				} else {
					worksheetStore.prevStep();
				}
			}}
		>
			<ChevronLeft class="h-4 w-4" />
		</button>
		<div>
			<h2 class="text-xl font-semibold tracking-tight">Configure Worksheet</h2>
			<p class="text-sm text-muted-foreground">
				{#if worksheetStore.isCustom}
					{worksheetStore.customTopic}
				{:else}
					{worksheetStore.selectedSkills.length} skill{worksheetStore.selectedSkills.length !== 1 ? 's' : ''} selected
				{/if}
			</p>
		</div>
	</div>

	<div class="space-y-8">
		<!-- Difficulty -->
		<div class="space-y-3">
			<Label class="text-base font-medium">Difficulty</Label>
			<div class="flex flex-wrap gap-2">
				{#each difficulties as d}
					<button
						class="rounded-lg border px-3 py-2 text-sm transition-colors
							{worksheetStore.difficulty === d.value
							? 'border-primary bg-primary/5 font-medium text-primary'
							: 'hover:bg-accent'}"
						onclick={() => { worksheetStore.difficulty = d.value; }}
					>
						<span class="font-semibold">{d.short}</span>
						<span class="ml-1 hidden sm:inline">{d.label}</span>
					</button>
				{/each}
			</div>
			{#if diffNote()}
				<p class="text-sm text-muted-foreground">{diffNote()}</p>
			{/if}
		</div>

		<Separator />

		<!-- Question Count -->
		<div class="space-y-3">
			<Label class="text-base font-medium">Questions</Label>
			<div class="flex flex-wrap gap-2">
				{#each countPresets as n}
					<button
						class="flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg border px-3 text-sm transition-colors
							{!customCount && worksheetStore.questionCount === n
							? 'border-primary bg-primary/5 font-medium text-primary'
							: 'hover:bg-accent'}"
						onclick={() => { worksheetStore.questionCount = n; customCount = false; }}
					>
						{n}
					</button>
				{/each}
				{#if customCount}
					<input
						type="number"
						class="h-9 w-16 rounded-lg border bg-primary/5 border-primary text-center text-sm font-medium text-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						value={worksheetStore.questionCount}
						min={1}
						max={50}
						autofocus
						oninput={(e) => {
							const val = parseInt(e.currentTarget.value);
							if (!isNaN(val) && val >= 1 && val <= 50) {
								worksheetStore.questionCount = val;
							}
						}}
					/>
				{:else}
					<button
						class="flex h-9 items-center rounded-lg border px-3 text-sm text-muted-foreground hover:bg-accent"
						onclick={() => { customCount = true; }}
					>
						Custom
					</button>
				{/if}
			</div>
		</div>

		<Separator />

		<!-- Question Type -->
		<div class="space-y-3">
			<Label class="text-base font-medium">Question Type</Label>
			<div class="flex flex-wrap gap-2">
				{#each ['auto' as QuestionType, ...availableTypes] as qtype}
					<button
						class="rounded-lg border px-3 py-2 text-sm transition-colors
							{worksheetStore.questionType === qtype
							? 'border-primary bg-primary/5 font-medium text-primary'
							: 'hover:bg-accent'}"
						onclick={() => { worksheetStore.questionType = qtype; }}
					>
						{questionTypeLabels[qtype]}
					</button>
				{/each}
			</div>
		</div>

		<Separator />

		<!-- Generate -->
		<div class="space-y-3">
			{#if worksheetStore.error}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
					{worksheetStore.error}
				</div>
			{/if}

			{#if !settingsStore.isConfigured}
				<p class="text-sm text-muted-foreground">
					You need to configure an API key before generating.
				</p>
			{/if}

			<Button
				class="w-full py-6 text-base"
				disabled={worksheetStore.isGenerating}
				onclick={handleGenerate}
			>
				{#if worksheetStore.isGenerating}
					<LoadingSpinner size={20} class="mr-2" />
					Generating...
				{:else if !settingsStore.isConfigured}
					Set API Key & Generate
				{:else}
					Generate Worksheet
				{/if}
			</Button>

			{#if settingsStore.isConfigured && costLabel}
				<p class="text-center text-xs text-muted-foreground">
					Estimated cost: {costLabel}
				</p>
			{/if}
		</div>
	</div>
</div>
