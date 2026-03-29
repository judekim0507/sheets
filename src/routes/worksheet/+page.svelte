<script lang="ts">
	import { onMount } from 'svelte';
	import { navigate } from '$lib/nav';
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { libraryStore } from '$lib/stores/library.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { Worksheet } from '$lib/data/types';
	import WorksheetHeader from '$lib/components/worksheet/WorksheetHeader.svelte';
	import QuestionCard from '$lib/components/worksheet/QuestionCard.svelte';
	import ThreadPanel from '$lib/components/worksheet/ThreadPanel.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Stethoscope from '@lucide/svelte/icons/stethoscope';
	import X from '@lucide/svelte/icons/x';

	let activeQuestion = $state<number | null>(null);
	let selectedForClinic = $state<Set<number>>(new Set());
	let clinicMode = $state(false);
	let clinicLoading = $state(false);
	let clinicError = $state<string | null>(null);

	onMount(() => {
		if (!worksheetStore.worksheet) navigate('/');
	});

	const questions = $derived(worksheetStore.worksheet?.questions ?? []);
	const mid = $derived(Math.ceil(questions.length / 2));
	const leftCol = $derived(questions.slice(0, mid));
	const rightCol = $derived(questions.slice(mid));

	function handleWorksheetUpdate(ws: Worksheet) {
		worksheetStore.worksheet = ws;
		worksheetStore.saveWorksheet();
		libraryStore.update(ws);
	}

	function handleQuestionRepair(index: number, repairedQuestion: Worksheet['questions'][number]) {
		if (!worksheetStore.worksheet) return;
		const currentThreads = worksheetStore.worksheet.threads;
		let threads = currentThreads;
		if (threads?.[index]) {
			const thread = threads[index];
			const versions = [...thread.versions];
			versions[thread.activeIndex] = repairedQuestion;
			threads = [...threads];
			threads[index] = { ...thread, versions };
		}

		const questions = [...worksheetStore.worksheet.questions];
		questions[index] = repairedQuestion;
		handleWorksheetUpdate({
			...worksheetStore.worksheet,
			questions,
			threads
		});
	}

	function updateField(field: 'title' | 'studentName', value: string) {
		if (!worksheetStore.worksheet) return;
		const ws = { ...worksheetStore.worksheet, [field]: value || undefined };
		handleWorksheetUpdate(ws);
	}

	function handleQuestionClick(idx: number) {
		if (clinicMode) {
			const next = new Set(selectedForClinic);
			if (next.has(idx)) next.delete(idx);
			else next.add(idx);
			selectedForClinic = next;
		} else {
			activeQuestion = idx;
		}
	}

	function exitClinicMode() {
		clinicMode = false;
		selectedForClinic = new Set();
		clinicError = null;
	}

	async function generateClinic() {
		if (!worksheetStore.worksheet || selectedForClinic.size === 0 || clinicLoading) return;
		clinicLoading = true;
		clinicError = null;

		const sourceQuestions = [...selectedForClinic].sort().map((i) => questions[i]);

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 90000);

			const res = await fetch('/api/clinic', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({
					sourceQuestions: sourceQuestions.map((q) => ({ ...q, diagram: undefined })),
					questionCount: 10,
					config: worksheetStore.worksheet!.config,
					sourceTitle: worksheetStore.worksheet!.title,
					provider: settingsStore.provider,
					apiKey: settingsStore.activeApiKey,
					model: settingsStore.activeModel
				})
			});
			clearTimeout(timeout);

			if (!res.ok) {
				let msg = `Failed (${res.status})`;
				try { const d = await res.json(); msg = d.error || msg; } catch { /* */ }
				throw new Error(msg);
			}

			const data = await res.json();
			const clinicWs: Worksheet = data.worksheet;

			// Save and navigate
			libraryStore.save(clinicWs);
			worksheetStore.worksheet = clinicWs;
			worksheetStore.saveWorksheet();
			exitClinicMode();
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') {
				clinicError = 'Request timed out — try again';
			} else {
				clinicError = e instanceof Error ? e.message : 'Something went wrong';
			}
		} finally {
			clinicLoading = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (clinicMode) { exitClinicMode(); return; }
			if (activeQuestion !== null) { activeQuestion = null; return; }
		}
		if (activeQuestion !== null && questions.length > 0) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
				e.preventDefault();
				activeQuestion = Math.min(activeQuestion + 1, questions.length - 1);
			} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
				e.preventDefault();
				activeQuestion = Math.max(activeQuestion - 1, 0);
			}
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>{worksheetStore.worksheet?.title ?? 'Worksheet'} — Sheets</title>
</svelte:head>

{#if worksheetStore.worksheet}
	<!-- Toolbar -->
	<div class="no-print mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
		<Button variant="ghost" onclick={() => navigate('/')}>
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</Button>
		<div class="flex items-center gap-2">
			{#if !clinicMode}
				<Button variant="outline" size="sm" onclick={() => { clinicMode = true; activeQuestion = null; }}>
					<Stethoscope class="mr-1.5 h-3.5 w-3.5" />
					Clinic
				</Button>
			{/if}
			<Button variant="outline" size="sm" onclick={() => navigate('/answer-key')}>
				<BookOpen class="mr-1.5 h-3.5 w-3.5" />
				Key
			</Button>
			<Button size="sm" onclick={() => window.print()}>
				<Printer class="mr-1.5 h-3.5 w-3.5" />
				Print
			</Button>
		</div>
	</div>

	<!-- Clinic mode bar -->
	{#if clinicMode}
		<div class="no-print sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
			<div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
				<div class="flex items-center gap-3">
					<Stethoscope class="h-4 w-4 text-primary" />
					<div>
						<div class="text-sm font-medium">Clinic Mode</div>
						<div class="text-xs text-muted-foreground">
							{#if selectedForClinic.size === 0}
								Tap questions the student struggled with
							{:else}
								{selectedForClinic.size} question{selectedForClinic.size !== 1 ? 's' : ''} selected
							{/if}
						</div>
					</div>
				</div>
				<div class="flex items-center gap-2">
					{#if clinicError}
						<span class="text-xs text-destructive">{clinicError}</span>
					{/if}
					<Button variant="ghost" size="sm" onclick={exitClinicMode}>
						<X class="mr-1 h-3.5 w-3.5" />
						Cancel
					</Button>
					<Button
						size="sm"
						disabled={selectedForClinic.size === 0 || clinicLoading}
						onclick={generateClinic}
					>
						{#if clinicLoading}
							<LoadingSpinner size={14} class="mr-1.5" />
							Generating...
						{:else}
							Generate Clinic ({selectedForClinic.size})
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Worksheet content -->
	<div class="worksheet-page mx-auto max-w-4xl px-6 py-4">
		<WorksheetHeader
			title={worksheetStore.worksheet.title}
			studentName={worksheetStore.worksheet.studentName}
			editable={!clinicMode}
			onTitleChange={(t) => updateField('title', t)}
			onStudentChange={(n) => updateField('studentName', n)}
		/>

		<div class="screen-only worksheet-columns">
			<div class="worksheet-col space-y-4">
				{#each leftCol as question, i}
					{@const isSelected = selectedForClinic.has(i)}
					<button
						class="question-wrapper w-full rounded-lg text-left transition-all
							{clinicMode
								? isSelected
									? 'bg-primary/10 ring-2 ring-primary/40'
									: 'hover:bg-accent/30 hover:ring-1 hover:ring-ring/15'
								: activeQuestion === i
									? 'bg-accent/40 ring-1 ring-ring/25'
									: 'hover:bg-accent/30 hover:ring-1 hover:ring-ring/15'}"
						onclick={() => handleQuestionClick(i)}
					>
						{#if clinicMode && isSelected}
							<div class="flex items-center gap-1.5 px-2 pt-1.5">
								<div class="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
									{[...selectedForClinic].sort().indexOf(i) + 1}
								</div>
								<span class="text-[10px] font-medium text-primary">Selected for clinic</span>
							</div>
						{/if}
						{#if !clinicMode && worksheetStore.worksheet?.threads?.[i]?.versions && worksheetStore.worksheet.threads[i].versions.length > 1}
							<div class="flex items-center gap-1 px-2 pt-1">
								{#each worksheetStore.worksheet.threads[i].versions as _, vi}
									<div class="h-1 rounded-full {vi === worksheetStore.worksheet.threads[i].activeIndex ? 'w-2.5 bg-foreground' : 'w-1 bg-muted-foreground/20'}"></div>
								{/each}
							</div>
						{/if}
						<QuestionCard
							{question}
							index={i}
							config={worksheetStore.worksheet.config}
							onQuestionRepair={(repaired) => handleQuestionRepair(i, repaired)}
						/>
					</button>
				{/each}
			</div>
			<div class="worksheet-col-divider"></div>
			<div class="worksheet-col space-y-4">
				{#each rightCol as question, i}
					{@const idx = mid + i}
					{@const isSelected = selectedForClinic.has(idx)}
					<button
						class="question-wrapper w-full rounded-lg text-left transition-all
							{clinicMode
								? isSelected
									? 'bg-primary/10 ring-2 ring-primary/40'
									: 'hover:bg-accent/30 hover:ring-1 hover:ring-ring/15'
								: activeQuestion === idx
									? 'bg-accent/40 ring-1 ring-ring/25'
									: 'hover:bg-accent/30 hover:ring-1 hover:ring-ring/15'}"
						onclick={() => handleQuestionClick(idx)}
					>
						{#if clinicMode && isSelected}
							<div class="flex items-center gap-1.5 px-2 pt-1.5">
								<div class="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
									{[...selectedForClinic].sort().indexOf(idx) + 1}
								</div>
								<span class="text-[10px] font-medium text-primary">Selected for clinic</span>
							</div>
						{/if}
						{#if !clinicMode && worksheetStore.worksheet?.threads?.[idx]?.versions && worksheetStore.worksheet.threads[idx].versions.length > 1}
							<div class="flex items-center gap-1 px-2 pt-1">
								{#each worksheetStore.worksheet.threads[idx].versions as _, vi}
									<div class="h-1 rounded-full {vi === worksheetStore.worksheet.threads[idx].activeIndex ? 'w-2.5 bg-foreground' : 'w-1 bg-muted-foreground/20'}"></div>
								{/each}
							</div>
						{/if}
						<QuestionCard
							{question}
							index={idx}
							config={worksheetStore.worksheet.config}
							onQuestionRepair={(repaired) => handleQuestionRepair(idx, repaired)}
						/>
					</button>
				{/each}
			</div>
		</div>

		<div class="print-only worksheet-print-flow">
			{#each questions as question, i (`${i}:${question.question}`)}
				<div class="worksheet-print-item">
					<QuestionCard {question} index={i} />
				</div>
			{/each}
		</div>
	</div>

	<!-- Thread panel (only in normal mode) -->
	{#if !clinicMode && activeQuestion !== null && worksheetStore.worksheet}
		<ThreadPanel
			worksheet={worksheetStore.worksheet}
			questionIndex={activeQuestion}
			onClose={() => (activeQuestion = null)}
			onUpdate={handleWorksheetUpdate}
		/>
	{/if}
{/if}
