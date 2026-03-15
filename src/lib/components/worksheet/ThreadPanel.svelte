<script lang="ts">
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	import type { GeneratedQuestion, Worksheet, QuestionThread } from '$lib/data/types';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import KatexBlock from './KatexBlock.svelte';
	import DiagramRenderer from './DiagramRenderer.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import X from '@lucide/svelte/icons/x';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Send from '@lucide/svelte/icons/send';

	let {
		worksheet,
		questionIndex,
		onClose,
		onUpdate
	}: {
		worksheet: Worksheet;
		questionIndex: number;
		onClose: () => void;
		onUpdate: (ws: Worksheet) => void;
	} = $props();

	let instruction = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let visible = $state(false);

	onMount(async () => {
		await tick();
		// Trigger the CSS transition by flipping state after mount
		requestAnimationFrame(() => { visible = true; });
	});

	function close() {
		visible = false;
		setTimeout(onClose, 280);
	}

	const thread = $derived(getThread());
	const currentQuestion = $derived(thread.versions[thread.activeIndex]);
	const hasHistory = $derived(thread.versions.length > 1);

	function getThread(): QuestionThread {
		if (worksheet.threads?.[questionIndex]) {
			return worksheet.threads[questionIndex];
		}
		return {
			versions: [worksheet.questions[questionIndex]],
			activeIndex: 0,
			instructions: ['']
		};
	}

	function updateWorksheet(newThread: QuestionThread) {
		const threads = [...(worksheet.threads || worksheet.questions.map((q) => ({
			versions: [q], activeIndex: 0, instructions: ['']
		})))];
		threads[questionIndex] = newThread;
		onUpdate({
			...worksheet,
			questions: threads.map((t) => t.versions[t.activeIndex]),
			threads
		});
	}

	function selectVersion(i: number) {
		updateWorksheet({ ...thread, activeIndex: i });
	}

	async function handleSubmit() {
		if (!instruction.trim() || isLoading) return;
		await generateQuestion(instruction.trim());
		instruction = '';
	}

	async function generateQuestion(inst: string | null) {
		if (isLoading) return;
		isLoading = true;
		error = null;
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 60000);

			const res = await fetch('/api/generate-question', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({
					original: currentQuestion,
					instruction: inst, config: worksheet.config,
					provider: settingsStore.provider, apiKey: settingsStore.activeApiKey,
					model: settingsStore.activeModel
				})
			});
			clearTimeout(timeout);

			if (!res.ok) {
				let msg = `Failed (${res.status})`;
				try { const d = await res.json(); msg = d.error || msg; } catch { /* non-JSON error */ }
				throw new Error(msg);
			}

			const data = await res.json();
			if (!data.question) throw new Error('No question returned');

			const newQ: GeneratedQuestion = data.question;
			updateWorksheet({
				versions: [...thread.versions.slice(0, thread.activeIndex + 1), newQ],
				activeIndex: thread.activeIndex + 1,
				instructions: [...thread.instructions.slice(0, thread.activeIndex + 1), inst || '(regenerated)']
			});
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') {
				error = 'Request timed out — try again';
			} else {
				error = e instanceof Error ? e.message : 'Something went wrong';
			}
		} finally {
			isLoading = false;
		}
	}

	function preview(q: GeneratedQuestion): string {
		const raw = q.question.replace(/\$\$[\s\S]*?\$\$/g, '[math]').replace(/\$.*?\$/g, '[math]');
		return raw.length > 70 ? raw.slice(0, 70) + '...' : raw;
	}

	const quickActions = $derived((() => {
		const actions = [
			{ label: 'Harder', inst: 'Make this question more challenging with larger numbers or more steps' },
			{ label: 'Easier', inst: 'Simplify this question with smaller numbers and fewer steps' },
			{ label: 'Word problem', inst: 'Convert this into a real-world word problem' },
			{ label: 'Multiple choice', inst: 'Convert to multiple choice with 4 options' },
			{ label: 'New numbers', inst: 'Keep the same structure but use completely different numbers' }
		];
		// Add "Fix diagram" if the current question has diagram issues
		if (currentQuestion.has_diagram && currentQuestion.diagram) {
			const els = currentQuestion.diagram.elements;
			const hasUnlabeled = els.some((e) => e.type === 'point' && !e.label);
			const noSegLabels = els.filter((e) => e.type === 'segment').every((e) => !e.label);
			const noAngles = !els.some((e) => e.type === 'angle_arc' || e.type === 'right_angle');
			if (hasUnlabeled || noSegLabels || noAngles) {
				actions.unshift({ label: 'Fix diagram labels', inst: 'Fix the diagram: add vertex letter labels to all points, add measurement labels to all segments with known lengths, and add angle_arc markers for all mentioned angles. Keep the same question.' });
			}
		}
		return actions;
	})());
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 transition-all duration-300 {visible ? 'bg-black/20 backdrop-blur-[2px]' : 'bg-transparent backdrop-blur-0'}"
	onclick={close}
	onkeydown={() => {}}
></div>

<div class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:w-[440px] {visible ? 'translate-x-0' : 'translate-x-full'}">

	<!-- Header -->
	<div class="flex items-center justify-between border-b px-5 py-3.5">
		<span class="text-sm font-semibold">Question {questionIndex + 1}</span>
		<button class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" onclick={close}>
			<X class="h-4 w-4" />
		</button>
	</div>

	<div class="flex-1 overflow-y-auto">

		<!-- VERSION TIMELINE — always visible when there's history -->
		{#if hasHistory}
			<div class="border-b bg-muted/15 px-5 py-4">
				<div class="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">History</div>
				<div class="relative">
					{#each thread.versions as ver, i}
						{@const active = i === thread.activeIndex}
						{@const label = thread.instructions[i]}
						<div class="relative flex gap-3 {i < thread.versions.length - 1 ? 'pb-2.5' : ''}">
							<!-- Vertical line -->
							{#if i < thread.versions.length - 1}
								<div class="absolute left-[6.5px] top-[18px] bottom-0 w-px bg-border"></div>
							{/if}
							<!-- Dot -->
							<div class="relative z-10 mt-[5px] flex h-[14px] w-[14px] shrink-0 items-center justify-center">
								<div class="rounded-full transition-all {active ? 'h-3 w-3 bg-foreground shadow-[0_0_0_3px] shadow-foreground/15' : 'h-[6px] w-[6px] bg-muted-foreground/35 hover:bg-muted-foreground/60'}"></div>
							</div>
							<!-- Card -->
							<button
								class="flex-1 rounded-lg px-3 py-2 text-left transition-all {active ? 'bg-accent ring-1 ring-border' : 'hover:bg-accent/50'}"
								onclick={() => selectVersion(i)}
							>
								<div class="flex items-baseline gap-2">
									<span class="text-[11px] font-semibold {active ? '' : 'text-muted-foreground'}">
										{i === 0 ? 'Original' : `Version ${i + 1}`}
									</span>
									{#if active}
										<span class="rounded bg-foreground px-1 py-px text-[8px] font-bold uppercase text-background">active</span>
									{/if}
								</div>
								{#if label && i > 0}
									<div class="mt-0.5 text-[10px] italic text-muted-foreground">"{label}"</div>
								{/if}
								<div class="mt-1 text-[10px] leading-snug text-muted-foreground/60">{preview(ver)}</div>
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Current question preview -->
		<div class="px-5 py-5">
			<div class="text-[13px] leading-relaxed">
				<KatexBlock text={currentQuestion.question} />
			</div>

			{#if currentQuestion.has_diagram && currentQuestion.diagram}
				<div class="my-4 flex justify-center">
					<DiagramRenderer diagram={currentQuestion.diagram} />
				</div>
			{/if}

			{#if currentQuestion.choices?.length}
				<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
					{#each currentQuestion.choices as choice, i}
						<div class="flex gap-1.5 rounded-md bg-muted/40 px-2 py-1.5">
							<span class="font-medium text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
							<KatexBlock text={choice} />
						</div>
					{/each}
				</div>
			{/if}

			<details class="mt-4">
				<summary class="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Show solution</summary>
				<div class="mt-2 space-y-1 rounded-lg bg-muted/30 p-3">
					{#each currentQuestion.solution_steps as step, i}
						<div class="text-xs text-muted-foreground">({i + 1}) <KatexBlock text={step} /></div>
					{/each}
					<div class="mt-2 border-t pt-2 text-xs font-semibold">Answer: <KatexBlock text={currentQuestion.final_answer} /></div>
				</div>
			</details>
		</div>

		<!-- Quick actions -->
		{#if !isLoading}
			<div class="border-t px-5 py-4">
				<div class="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Quick edits</div>
				<div class="flex flex-wrap gap-1.5">
					{#each quickActions as a}
						<button class="rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:border-foreground/20 hover:bg-accent" onclick={() => generateQuestion(a.inst)}>{a.label}</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if error}
			<div class="mx-5 mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
		{/if}

		{#if isLoading}
			<div class="flex flex-col items-center gap-3 py-8">
				<LoadingSpinner size={24} />
				<p class="text-xs text-muted-foreground">Generating...</p>
			</div>
		{/if}
	</div>

	<!-- Input bar -->
	<div class="border-t px-4 py-3">
		<div class="flex items-center gap-2">
			<button
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
				onclick={() => generateQuestion(null)} disabled={isLoading} title="Regenerate"
			>
				<RotateCcw class="h-3.5 w-3.5" />
			</button>
			<div class="relative flex-1">
				<input
					type="text"
					class="h-9 w-full rounded-lg border bg-transparent pl-3 pr-9 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
					placeholder="Describe a change..."
					bind:value={instruction}
					onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
					disabled={isLoading}
				/>
				<button
					class="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
					onclick={handleSubmit} disabled={isLoading || !instruction.trim()} title="Send"
				>
					<Send class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	</div>
</div>

