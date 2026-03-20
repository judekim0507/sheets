<script lang="ts">
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { getDomainsForGrade, gradeLabel } from '$lib/data/math';
	import type { Domain, Skill, Unit } from '$lib/data/types';
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
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';

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
	let searchQuery = $state('');

	type SearchResult = {
		key: string;
		domain: Domain;
		unit: Unit;
		matchingSkills: Skill[];
		score: number;
		unitMatch: boolean;
		domainMatch: boolean;
	};

	function normalize(value: string) {
		return value.trim().toLowerCase();
	}

	function queryTerms(value: string) {
		return normalize(value).split(/\s+/).filter(Boolean);
	}

	function matchesTerms(value: string, terms: string[]) {
		const haystack = normalize(value);
		return terms.every((term) => haystack.includes(term));
	}

	function searchableSkillText(skill: Skill) {
		return `${skill.skill_id} ${skill.skill_name}`;
	}

	function scoreText(value: string, query: string, base: number) {
		const normalizedValue = normalize(value);
		if (normalizedValue === query) return base + 120;
		if (normalizedValue.startsWith(query)) return base + 80;
		if (normalizedValue.includes(query)) return base + 40;
		return 0;
	}

	const searchResults = $derived.by(() => {
		const query = normalize(searchQuery);
		if (!query) return [] as SearchResult[];

		const terms = queryTerms(searchQuery);
		const results: SearchResult[] = [];

		for (const domain of domains) {
			const domainText = `${domain.domain_id} ${domain.domain_name} ${domain.description}`;
			const domainMatch = matchesTerms(domainText, terms);

			for (const unit of domain.units) {
				const unitText = `${unit.unit_id} ${unit.unit_name}`;
				const unitMatch = matchesTerms(unitText, terms);
				const matchingSkills = unit.skills.filter((skill) =>
					matchesTerms(searchableSkillText(skill), terms)
				);
				const combinedText = `${domainText} ${unitText} ${unit.skills
					.map((skill) => searchableSkillText(skill))
					.join(' ')}`;

				if (!matchesTerms(combinedText, terms)) continue;

				const score =
					scoreText(unit.unit_name, query, 200) +
					scoreText(domain.domain_name, query, 120) +
					matchingSkills.reduce(
						(total, skill) => total + scoreText(skill.skill_name, query, 70),
						0
					) +
					matchingSkills.length * 12 +
					(unitMatch ? 40 : 0) +
					(domainMatch ? 12 : 0);

				results.push({
					key: `${domain.domain_id}:${unit.unit_id}`,
					domain,
					unit,
					matchingSkills,
					score,
					unitMatch,
					domainMatch
				});
			}
		}

		return results.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.unit.unit_name.localeCompare(b.unit.unit_name);
		});
	});

	function selectUnit(domain: Domain, unit: Unit) {
		worksheetStore.selectUnit(domain, unit);
	}

	function submitCustom() {
		if (customInput.trim()) {
			worksheetStore.useCustomTopic(customInput.trim());
		}
	}

	function clearSearch() {
		searchQuery = '';
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

	<div class="mb-6 rounded-2xl border bg-card/80 p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold tracking-tight">Search the Catalogue</h3>
				<p class="text-xs text-muted-foreground">
					Search every domain, unit, and skill in Grade {worksheetStore.grade !== null ? gradeLabel(worksheetStore.grade) : ''}.
				</p>
			</div>
			{#if searchQuery.trim()}
				<Badge variant="secondary">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</Badge>
			{/if}
		</div>

		<div class="relative">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
				<Search class="h-4 w-4" />
			</div>
			<input
				type="text"
				class="h-11 w-full rounded-xl border bg-background pl-10 pr-10 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
				placeholder="Try 'surface area', 'angles', 'Pythagorean', or a skill code"
				bind:value={searchQuery}
			/>
			{#if searchQuery.trim()}
				<button
					type="button"
					class="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
					onclick={clearSearch}
					aria-label="Clear search"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>

		{#if searchQuery.trim()}
			<div class="mt-4 space-y-2">
				{#if searchResults.length === 0}
					<div class="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
						No catalogue matches for "{searchQuery.trim()}". Try a unit name, concept, or skill code.
					</div>
				{:else}
					{#each searchResults as result}
						<button
							type="button"
							class="w-full rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/40"
							onclick={() => selectUnit(result.domain, result.unit)}
						>
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="truncate text-sm font-semibold text-foreground">
										{result.unit.unit_name}
									</div>
									<div class="mt-1 text-xs text-muted-foreground">
										{result.domain.domain_name}
									</div>
								</div>
								<Badge variant="secondary">
									{result.unit.skills.length} skill{result.unit.skills.length !== 1 ? 's' : ''}
								</Badge>
							</div>

							<div class="mt-3 flex flex-wrap gap-2 text-xs">
								{#if result.unitMatch}
									<Badge variant="outline">Unit match</Badge>
								{/if}
								{#if result.domainMatch}
									<Badge variant="outline">Domain match</Badge>
								{/if}
								{#if result.matchingSkills.length > 0}
									<Badge variant="outline">
										{result.matchingSkills.length} matching skill{result.matchingSkills.length !== 1 ? 's' : ''}
									</Badge>
								{/if}
							</div>

							{#if result.matchingSkills.length > 0}
								<div class="mt-3 flex flex-wrap gap-2">
									{#each result.matchingSkills.slice(0, 3) as skill}
										<span class="rounded-full bg-accent px-2.5 py-1 text-xs text-foreground/80">
											{skill.skill_name}
										</span>
									{/each}
									{#if result.matchingSkills.length > 3}
										<span class="rounded-full bg-accent px-2.5 py-1 text-xs text-muted-foreground">
											+{result.matchingSkills.length - 3} more
										</span>
									{/if}
								</div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		{/if}
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
			class="mb-6 flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-left hover:border-primary/30 hover:bg-accent/30"
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
	{:else if !searchQuery.trim()}
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
