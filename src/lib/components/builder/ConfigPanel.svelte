<script lang="ts">
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { parseDifficultyNotes } from '$lib/data/math';
	import type { QuestionType, DifficultyLevel } from '$lib/data/types';
	import Button from '$lib/components/ui/button/button.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import Slider from '$lib/components/ui/slider/slider.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';

	let { onOpenSettings }: { onOpenSettings: () => void } = $props();

	const difficultyLabels: Record<number, string> = {
		1: 'Introductory',
		2: 'Developing',
		3: 'Proficient',
		4: 'Advanced',
		5: 'Challenge'
	};

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

	const diffNote = $derived(() => {
		if (worksheetStore.selectedSkills.length === 0) return '';
		const notes = parseDifficultyNotes(worksheetStore.selectedSkills[0].difficulty_notes);
		return notes[worksheetStore.difficulty] || '';
	});

	const availableTypes = $derived(worksheetStore.availableQuestionTypes);

	function handleDifficultyChange(value: number) {
		worksheetStore.difficulty = value as DifficultyLevel;
	}

	function adjustCount(delta: number) {
		const next = worksheetStore.questionCount + delta;
		if (next >= 5 && next <= 30) {
			worksheetStore.questionCount = next;
		}
	}

	async function handleGenerate() {
		if (worksheetStore.isGenerating) return;
		if (!settingsStore.isConfigured) {
			onOpenSettings();
			return;
		}
		await worksheetStore.generate();
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center gap-3">
		<button
			class="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
			onclick={() => {
				if (worksheetStore.isCustom) {
					// Custom topic came from step 1, go back there
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
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<Label class="text-base font-medium">Difficulty</Label>
				<span class="text-sm font-medium text-primary">
					L{worksheetStore.difficulty} — {difficultyLabels[worksheetStore.difficulty]}
				</span>
			</div>
			<Slider
				type="single"
				value={worksheetStore.difficulty}
				onValueChange={handleDifficultyChange}
				min={1}
				max={5}
				step={1}
			/>
			{#if diffNote()}
				<p class="text-sm text-muted-foreground">{diffNote()}</p>
			{/if}
		</div>

		<Separator />

		<!-- Question Count -->
		<div class="space-y-3">
			<Label class="text-base font-medium">Number of Questions</Label>
			<div class="flex items-center gap-4">
				<button
					class="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-50"
					onclick={() => adjustCount(-1)}
					disabled={worksheetStore.questionCount <= 5}
				>
					<Minus class="h-4 w-4" />
				</button>
				<input
					type="number"
					class="h-10 w-20 rounded-lg border bg-transparent text-center text-lg font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					value={worksheetStore.questionCount}
					min={5}
					max={30}
					oninput={(e) => {
						const val = parseInt(e.currentTarget.value);
						if (!isNaN(val) && val >= 5 && val <= 30) {
							worksheetStore.questionCount = val;
						}
					}}
				/>
				<button
					class="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent disabled:opacity-50"
					onclick={() => adjustCount(1)}
					disabled={worksheetStore.questionCount >= 30}
				>
					<Plus class="h-4 w-4" />
				</button>
				<span class="text-sm text-muted-foreground">5–30 questions</span>
			</div>
		</div>

		<Separator />

		<!-- Question Type -->
		<div class="space-y-3">
			<Label class="text-base font-medium">Question Type</Label>
			<RadioGroup.Root
				value={worksheetStore.questionType}
				onValueChange={(v) => {
					if (v) worksheetStore.questionType = v as QuestionType;
				}}
			>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{#each ['auto' as QuestionType, ...availableTypes] as qtype}
						<label
							class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-accent
								{worksheetStore.questionType === qtype ? 'border-primary bg-primary/5' : ''}"
						>
							<RadioGroup.Item value={qtype} />
							{questionTypeLabels[qtype]}
						</label>
					{/each}
				</div>
			</RadioGroup.Root>
		</div>

		<Separator />

		<!-- Generate Button -->
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
		</div>
	</div>
</div>
