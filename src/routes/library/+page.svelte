<script lang="ts">
	import { navigate } from '$lib/nav';
	import { libraryStore } from '$lib/stores/library.svelte';
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { gradeLabel } from '$lib/data/math';
	import type { Worksheet } from '$lib/data/types';
	import Button from '$lib/components/ui/button/button.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Copy from '@lucide/svelte/icons/copy';
	import GitBranch from '@lucide/svelte/icons/git-branch';

	let deleteTarget = $state<string | null>(null);

	function confirmDelete(id: string) {
		deleteTarget = id;
	}

	function executeDelete() {
		if (deleteTarget) {
			libraryStore.remove(deleteTarget);
			deleteTarget = null;
		}
	}

	function open(ws: Worksheet, route: string) {
		worksheetStore.worksheet = ws;
		worksheetStore.step = 4;
		navigate(route);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'l')) {
			e.preventDefault();
			navigate('/');
		}
	}

	function fmt(iso: string): string {
		const d = new Date(iso);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		if (diff < 60000) return 'Just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function threadCount(ws: Worksheet): number {
		if (!ws.threads) return 0;
		return ws.threads.filter((t) => t.versions.length > 1).length;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Library — Sheets</title>
</svelte:head>

<header class="border-b">
	<div class="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
		<div class="flex items-center gap-3">
			<button
				class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				onclick={() => navigate('/')}
			>
				<ArrowLeft class="h-4 w-4" />
			</button>
			<div>
				<h1 class="text-lg font-semibold tracking-tight">Library</h1>
				<p class="text-sm text-muted-foreground">{libraryStore.worksheets.length} worksheet{libraryStore.worksheets.length !== 1 ? 's' : ''}</p>
			</div>
		</div>
	</div>
</header>

<main class="mx-auto max-w-3xl px-5 py-5">
	{#if libraryStore.worksheets.length === 0}
		<div class="flex flex-col items-center gap-4 py-24 text-center">
			<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
				<FileText class="h-6 w-6 text-muted-foreground" />
			</div>
			<div>
				<p class="font-medium">No worksheets yet</p>
				<p class="mt-1 text-sm text-muted-foreground">Generated worksheets will appear here</p>
			</div>
			<Button onclick={() => navigate('/')}>Create Worksheet</Button>
		</div>
	{:else}
		{#if libraryStore.storageFull}
			<div class="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
				Storage full — delete old worksheets to save new ones.
			</div>
		{/if}
		<div class="space-y-1.5">
			{#each libraryStore.worksheets as ws, i}
				{@const threads = threadCount(ws)}
				<div
					class="group flex items-center gap-4 rounded-xl px-4 py-3.5 transition-colors hover:bg-accent/50"
					style="animation: fadeIn 0.2s ease-out both; animation-delay: {i * 30}ms;"
				>
					<button class="flex-1 text-left" onclick={() => open(ws, '/worksheet')}>
						<div class="font-medium">
							{ws.title}
							{#if ws.studentName}
								<span class="ml-2 text-sm font-normal text-muted-foreground">— {ws.studentName}</span>
							{/if}
						</div>
						<div class="mt-1 flex items-center gap-2.5 text-sm text-muted-foreground">
							<span>Grade {ws.config.grade !== null ? gradeLabel(ws.config.grade) : '?'}</span>
							<span class="text-muted-foreground/30">/</span>
							<span>{ws.questions.length}q</span>
							{#if threads > 0}
								<span class="text-muted-foreground/30">/</span>
								<span class="flex items-center gap-0.5">
									<GitBranch class="h-2.5 w-2.5" />
									{threads} edited
								</span>
							{/if}
							<span class="text-muted-foreground/30">/</span>
							<span>{fmt(ws.created_at)}</span>
						</div>
					</button>

					<div class="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
						<button
							class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
							onclick={() => open(ws, '/worksheet')}
							title="View worksheet"
						>
							<FileText class="h-4 w-4" />
						</button>
						<button
							class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
							onclick={() => open(ws, '/answer-key')}
							title="Answer key"
						>
							<BookOpen class="h-4 w-4" />
						</button>
						<button
							class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
							onclick={() => libraryStore.duplicate(ws.id)}
							title="Duplicate"
						>
							<Copy class="h-4 w-4" />
						</button>
						<button
							class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
							onclick={() => confirmDelete(ws.id)}
							title="Delete"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>

{#if deleteTarget}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]" onclick={() => (deleteTarget = null)} onkeydown={() => {}}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="mx-4 w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<h3 class="text-base font-semibold">Delete worksheet?</h3>
			<p class="mt-2 text-sm text-muted-foreground">This can't be undone. The worksheet and all its versions will be permanently deleted.</p>
			<div class="mt-5 flex justify-end gap-2">
				<Button variant="outline" size="sm" onclick={() => (deleteTarget = null)}>Cancel</Button>
				<Button variant="destructive" size="sm" onclick={executeDelete}>Delete</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
