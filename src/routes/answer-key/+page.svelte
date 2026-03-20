<script lang="ts">
	import { onMount } from 'svelte';
	import { navigate } from '$lib/nav';
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import AnswerCard from '$lib/components/worksheet/AnswerCard.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import FileText from '@lucide/svelte/icons/file-text';

	onMount(() => {
		if (!worksheetStore.worksheet) navigate('/');
	});

	const questions = $derived(worksheetStore.worksheet?.questions ?? []);
	const mid = $derived(Math.ceil(questions.length / 2));
</script>

<svelte:head>
	<title>Answer Key — {worksheetStore.worksheet?.title ?? 'Worksheet'}</title>
</svelte:head>

{#if worksheetStore.worksheet}
	<div class="no-print mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
		<Button variant="ghost" onclick={() => navigate('/')}>
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</Button>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => navigate('/worksheet')}>
				<FileText class="mr-2 h-4 w-4" />
				Worksheet
			</Button>
			<Button onclick={() => window.print()}>
				<Printer class="mr-2 h-4 w-4" />
				Print
			</Button>
		</div>
	</div>

	<div class="worksheet-page mx-auto max-w-4xl px-6 py-4">
		<div class="mb-6 text-center">
			<h1 class="text-lg font-bold">Answer Key</h1>
			<p class="text-sm text-muted-foreground">
				{worksheetStore.worksheet.title}{worksheetStore.worksheet.studentName ? ` — ${worksheetStore.worksheet.studentName}` : ''}
			</p>
		</div>

		<div class="screen-only worksheet-columns">
			<div class="worksheet-col space-y-3">
				{#each questions.slice(0, mid) as question, i}
					<AnswerCard {question} index={i} />
				{/each}
			</div>
			<div class="worksheet-col-divider"></div>
			<div class="worksheet-col space-y-3">
				{#each questions.slice(mid) as question, i}
					<AnswerCard {question} index={mid + i} />
				{/each}
			</div>
		</div>

		<div class="print-only worksheet-print-flow">
			{#each questions as question, i (`${i}:${question.question}`)}
				<div class="worksheet-print-item">
					<AnswerCard {question} index={i} />
				</div>
			{/each}
		</div>
	</div>
{/if}
