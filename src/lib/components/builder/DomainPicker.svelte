<script lang="ts">
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { getDomainsForGrade, gradeLabel } from '$lib/data/math';
	import type { Domain, Unit } from '$lib/data/types';
	import * as Accordion from '$lib/components/ui/accordion';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Hash from '@lucide/svelte/icons/hash';
	import Variable from '@lucide/svelte/icons/variable';
	import Triangle from '@lucide/svelte/icons/triangle';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import Sigma from '@lucide/svelte/icons/sigma';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	const iconMap: Record<string, typeof Hash> = {
		NUM: Hash,
		ALG: Variable,
		GEO: Triangle,
		STAT: BarChart3,
		CALC: Sigma
	};

	const domains = $derived(
		worksheetStore.grade !== null ? getDomainsForGrade(worksheetStore.grade) : []
	);

	let customInput = $state('');
	let showCustom = $state(false);

	function selectUnit(domain: Domain, unit: Unit) {
		worksheetStore.selectUnit(domain, unit);
	}

	function submitCustom() {
		if (customInput.trim()) {
			worksheetStore.useCustomTopic(customInput.trim());
		}
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
			<h2 class="text-xl font-semibold tracking-tight">Choose a Topic</h2>
			<p class="text-sm text-muted-foreground">
				Grade {worksheetStore.grade !== null ? gradeLabel(worksheetStore.grade) : ''} — pick from curriculum or write your own
			</p>
		</div>
	</div>

	<!-- Custom Topic -->
	{#if showCustom}
		<div class="mb-6 rounded-xl border bg-accent/20 p-4">
			<div class="mb-3 flex items-center gap-2">
				<Pencil class="h-4 w-4 text-primary" />
				<span class="text-sm font-medium">Custom Topic</span>
			</div>
			<div class="flex gap-2">
				<input
					type="text"
					class="h-10 flex-1 rounded-lg border bg-background px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
					placeholder="e.g. Long division with remainders, Pythagorean theorem word problems..."
					bind:value={customInput}
					onkeydown={(e) => { if (e.key === 'Enter') submitCustom(); }}
					autofocus
				/>
				<Button disabled={!customInput.trim()} onclick={submitCustom}>
					<ArrowRight class="h-4 w-4" />
				</Button>
			</div>
			<p class="mt-2 text-xs text-muted-foreground">
				Describe any math topic — the AI will generate questions for it.
			</p>
		</div>
	{:else}
		<button
			class="mb-6 flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-left transition-colors hover:border-primary/30 hover:bg-accent/30"
			onclick={() => (showCustom = true)}
		>
			<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
				<Pencil class="h-4 w-4" />
			</div>
			<div>
				<div class="text-sm font-medium">Custom Topic</div>
				<div class="text-xs text-muted-foreground">Type any math topic instead of picking from the list</div>
			</div>
		</button>
	{/if}

	<!-- Curriculum Tree -->
	{#if domains.length === 0}
		<div class="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
			No skills found for this grade level.
		</div>
	{:else}
		<Accordion.Root type="single">
			{#each domains as domain}
				{@const Icon = iconMap[domain.domain_id] || Hash}
				<Accordion.Item value={domain.domain_id}>
					<Accordion.Trigger class="hover:no-underline">
						<div class="flex items-center gap-3">
							<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<Icon class="h-4 w-4" />
							</div>
							<div class="text-left">
								<div class="font-medium">{domain.domain_name}</div>
								<div class="text-xs text-muted-foreground">{domain.units.length} unit{domain.units.length !== 1 ? 's' : ''}</div>
							</div>
						</div>
					</Accordion.Trigger>
					<Accordion.Content>
						<div class="space-y-1 pb-2 pl-12">
							{#each domain.units as unit}
								<button
									class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
									onclick={(e) => { e.stopPropagation(); selectUnit(domain, unit); }}
								>
									<span>{unit.unit_name}</span>
									<Badge variant="secondary" class="ml-2">
										{unit.skills.length}
									</Badge>
								</button>
							{/each}
						</div>
					</Accordion.Content>
				</Accordion.Item>
			{/each}
		</Accordion.Root>
	{/if}
</div>
