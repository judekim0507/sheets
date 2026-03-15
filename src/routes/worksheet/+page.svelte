<script lang="ts">
	import { onMount } from 'svelte';
	import { navigate } from '$lib/nav';
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { libraryStore } from '$lib/stores/library.svelte';
	import type { Worksheet } from '$lib/data/types';
	import WorksheetHeader from '$lib/components/worksheet/WorksheetHeader.svelte';
	import QuestionCard from '$lib/components/worksheet/QuestionCard.svelte';
	import ThreadPanel from '$lib/components/worksheet/ThreadPanel.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import BookOpen from '@lucide/svelte/icons/book-open';

	let activeQuestion = $state<number | null>(null);

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

	function onKeydown(e: KeyboardEvent) {
		// Escape → close thread panel
		if (e.key === 'Escape' && activeQuestion !== null) {
			activeQuestion = null;
			return;
		}
		// Cmd+P → print
		if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
			// let browser handle it
		}
		// Arrow keys → navigate questions when panel open
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
	<div class="no-print mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
		<Button variant="ghost" onclick={() => navigate('/')}>
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</Button>
		<div class="flex items-center gap-2">
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

	<div class="worksheet-page mx-auto max-w-4xl px-6 py-4">
		<WorksheetHeader title={worksheetStore.worksheet.title} />

		<div class="worksheet-columns">
			<div class="worksheet-col space-y-4">
				{#each leftCol as question, i}
					<button
						class="question-wrapper w-full rounded-lg text-left transition-all hover:bg-accent/30 hover:ring-1 hover:ring-ring/15 {activeQuestion === i ? 'bg-accent/40 ring-1 ring-ring/25' : ''}"
						onclick={() => (activeQuestion = i)}
					>
						{#if worksheetStore.worksheet?.threads?.[i]?.versions && worksheetStore.worksheet.threads[i].versions.length > 1}
							<div class="flex items-center gap-1 px-2 pt-1">
								{#each worksheetStore.worksheet.threads[i].versions as _, vi}
									<div class="h-1 rounded-full {vi === worksheetStore.worksheet.threads[i].activeIndex ? 'w-2.5 bg-foreground' : 'w-1 bg-muted-foreground/20'}"></div>
								{/each}
							</div>
						{/if}
						<QuestionCard {question} index={i} />
					</button>
				{/each}
			</div>
			<div class="worksheet-col-divider"></div>
			<div class="worksheet-col space-y-4">
				{#each rightCol as question, i}
					{@const idx = mid + i}
					<button
						class="question-wrapper w-full rounded-lg text-left transition-all hover:bg-accent/30 hover:ring-1 hover:ring-ring/15 {activeQuestion === idx ? 'bg-accent/40 ring-1 ring-ring/25' : ''}"
						onclick={() => (activeQuestion = idx)}
					>
						{#if worksheetStore.worksheet?.threads?.[idx]?.versions && worksheetStore.worksheet.threads[idx].versions.length > 1}
							<div class="flex items-center gap-1 px-2 pt-1">
								{#each worksheetStore.worksheet.threads[idx].versions as _, vi}
									<div class="h-1 rounded-full {vi === worksheetStore.worksheet.threads[idx].activeIndex ? 'w-2.5 bg-foreground' : 'w-1 bg-muted-foreground/20'}"></div>
								{/each}
							</div>
						{/if}
						<QuestionCard {question} index={idx} />
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if activeQuestion !== null && worksheetStore.worksheet}
		<ThreadPanel
			worksheet={worksheetStore.worksheet}
			questionIndex={activeQuestion}
			onClose={() => (activeQuestion = null)}
			onUpdate={handleWorksheetUpdate}
		/>
	{/if}
{/if}
