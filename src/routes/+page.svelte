<script lang="ts">
	import { navigate } from '$lib/nav';
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import BuilderStepper from '$lib/components/builder/BuilderStepper.svelte';
	import GradeSelector from '$lib/components/builder/GradeSelector.svelte';
	import DomainPicker from '$lib/components/builder/DomainPicker.svelte';
	import SkillPicker from '$lib/components/builder/SkillPicker.svelte';
	import ConfigPanel from '$lib/components/builder/ConfigPanel.svelte';
	import SettingsDialog from '$lib/components/settings/SettingsDialog.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { libraryStore } from '$lib/stores/library.svelte';
	import Onboarding from '$lib/components/shared/Onboarding.svelte';
	import { onMount } from 'svelte';
	import Settings from '@lucide/svelte/icons/settings';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import FileText from '@lucide/svelte/icons/file-text';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Library from '@lucide/svelte/icons/library';

	let settingsOpen = $state(false);
	let showOnboarding = $state(false);

	onMount(() => {
		if (typeof window !== 'undefined' && !localStorage.getItem('sheets-onboarded') && libraryStore.worksheets.length === 0) {
			showOnboarding = true;
		}
	});

	function dismissOnboarding() {
		showOnboarding = false;
		localStorage.setItem('sheets-onboarded', '1');
	}

	function onKeydown(e: KeyboardEvent) {
		// Cmd/Ctrl + , → settings
		if ((e.metaKey || e.ctrlKey) && e.key === ',') {
			e.preventDefault();
			settingsOpen = true;
		}
		// Cmd/Ctrl + L → library
		if ((e.metaKey || e.ctrlKey) && e.key === 'l' && libraryStore.worksheets.length > 0) {
			e.preventDefault();
			navigate('/library');
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Header -->
<header class="no-print border-b">
	<div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
		<button class="flex items-center gap-2" onclick={() => worksheetStore.reset()}>
			<span class="text-lg font-bold tracking-tight">Sheets</span>
		</button>
		<div class="flex items-center gap-1">
			{#if settingsStore.isConfigured}
				<span class="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
					{settingsStore.provider === 'anthropic' ? 'Claude' : 'Gemini'}
				</span>
			{/if}
			{#if libraryStore.worksheets.length > 0}
				<Button variant="ghost" size="icon" onclick={() => navigate('/library')}>
					<Library class="h-4 w-4" />
				</Button>
			{/if}
			<Button variant="ghost" size="icon" onclick={() => (settingsOpen = true)}>
				<Settings class="h-4 w-4" />
			</Button>
		</div>
	</div>
</header>

<main class="mx-auto max-w-3xl px-4 py-8">
	{#if worksheetStore.step < 4}
		<!-- Builder Steps -->
		<BuilderStepper />

		{#if worksheetStore.step === 0}
			<GradeSelector />
		{:else if worksheetStore.step === 1}
			<DomainPicker />
		{:else if worksheetStore.step === 2}
			<SkillPicker />
		{:else if worksheetStore.step === 3}
			{#if worksheetStore.isGenerating}
				<div class="flex flex-col items-center justify-center gap-4 py-20">
					<LoadingSpinner size={40} />
					<p class="text-lg font-medium text-muted-foreground">Generating your worksheet...</p>
					<p class="text-sm text-muted-foreground">This may take 15-30 seconds</p>
				</div>
			{:else}
				<ConfigPanel onOpenSettings={() => (settingsOpen = true)} />
			{/if}
		{/if}
	{:else}
		<!-- Step 4: Generation Result (fallback reset if worksheet is gone) -->
		{#if !worksheetStore.worksheet && !worksheetStore.error}
			{(worksheetStore.reset(), '')}
		{:else if worksheetStore.worksheet}
			<div class="mx-auto max-w-md space-y-6 py-8 text-center">
				<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
					<FileText class="h-8 w-8 text-green-600" />
				</div>
				<div>
					<h2 class="text-2xl font-semibold">{worksheetStore.worksheet.title}</h2>
					<p class="mt-1 text-muted-foreground">
						{worksheetStore.worksheet.questions.length} questions generated
					</p>
				</div>
				<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button class="w-full sm:w-auto" onclick={() => navigate('/worksheet')}>
						<FileText class="mr-2 h-4 w-4" />
						View Worksheet
					</Button>
					<Button variant="outline" class="w-full sm:w-auto" onclick={() => navigate('/answer-key')}>
						<BookOpen class="mr-2 h-4 w-4" />
						View Answer Key
					</Button>
				</div>
				<Button variant="ghost" onclick={() => worksheetStore.reset()}>
					<RotateCcw class="mr-2 h-4 w-4" />
					Create Another
				</Button>
			</div>
		{:else if worksheetStore.error}
			<div class="mx-auto max-w-md space-y-4 py-8 text-center">
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
					{worksheetStore.error}
				</div>
				<div class="flex gap-3 justify-center">
					<Button variant="outline" onclick={() => { worksheetStore.error = null; worksheetStore.step = 3; }}>
						Try Again
					</Button>
					<Button variant="ghost" onclick={() => worksheetStore.reset()}>
						Start Over
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</main>

<SettingsDialog bind:open={settingsOpen} />

{#if showOnboarding}
	<Onboarding onDismiss={dismissOnboarding} />
{/if}
