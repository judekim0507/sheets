<script lang="ts">
	import { worksheetStore } from '$lib/stores/worksheet.svelte';
	import { getDomainsForGrade, gradeLabel } from '$lib/data/math';
	import type { Domain, GradeLevel, Skill, Unit } from '$lib/data/types';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	const groups: { label: string; grades: GradeLevel[] }[] = [
		{ label: 'Elementary', grades: [0, 1, 2, 3, 4, 5] },
		{ label: 'Middle School', grades: [6, 7, 8] },
		{ label: 'High School', grades: [9, 10, 11, 12] }
	];

	const allGrades = groups.flatMap((group) => group.grades);

	let searchQuery = $state('');

	type SearchResult = {
		key: string;
		grade: GradeLevel;
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

		for (const grade of allGrades) {
			for (const domain of getDomainsForGrade(grade)) {
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
						scoreText(unit.unit_name, query, 220) +
						scoreText(domain.domain_name, query, 120) +
						matchingSkills.reduce(
							(total, skill) => total + scoreText(skill.skill_name, query, 90),
							0
						) +
						matchingSkills.length * 12 +
						(unitMatch ? 50 : 0) +
						(domainMatch ? 16 : 0);

					results.push({
						key: `${grade}:${domain.domain_id}:${unit.unit_id}`,
						grade,
						domain,
						unit,
						matchingSkills,
						score,
						unitMatch,
						domainMatch
					});
				}
			}
		}

		return results.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			if (a.grade !== b.grade) return a.grade - b.grade;
			return a.unit.unit_name.localeCompare(b.unit.unit_name);
		});
	});

	function clearSearch() {
		searchQuery = '';
	}

	function openResult(result: SearchResult) {
		worksheetStore.selectCatalogueUnit(result.grade, result.domain, result.unit);
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-8 text-center">
		<h2 class="text-2xl font-semibold tracking-tight">Select a Grade Level</h2>
		<p class="mt-2 text-muted-foreground">Choose a grade or search the entire catalogue and jump straight in</p>
	</div>

	<div class="mb-8 rounded-2xl border bg-card/80 p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold tracking-tight">Global Catalogue Search</h3>
				<p class="text-xs text-muted-foreground">
					Search every grade, unit, and skill before you commit to a grade.
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
				placeholder="Try 'fractions', 'surface area', 'Pythagorean', or a skill code"
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
						No catalogue matches for "{searchQuery.trim()}". Try a concept, unit title, or skill code.
					</div>
				{:else}
					{#each searchResults as result}
						<button
							type="button"
							class="w-full rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/40"
							onclick={() => openResult(result)}
						>
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<div class="truncate text-sm font-semibold text-foreground">
											{result.unit.unit_name}
										</div>
										<Badge variant="outline">Grade {gradeLabel(result.grade)}</Badge>
									</div>
									<div class="mt-1 text-xs text-muted-foreground">
										{result.domain.domain_name}
									</div>
								</div>
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<Badge variant="secondary">
										{result.unit.skills.length} skill{result.unit.skills.length !== 1 ? 's' : ''}
									</Badge>
									<ArrowRight class="h-4 w-4" />
								</div>
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

	<div class="space-y-8">
		{#each groups as group}
			<div>
				<p class="mb-3 text-sm font-medium text-muted-foreground">{group.label}</p>
				<div class="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-7">
					{#each group.grades as grade}
						<button
							class="flex h-16 items-center justify-center rounded-xl border-2 text-lg font-semibold transition-all hover:border-primary hover:bg-primary/5
								{worksheetStore.grade === grade
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border'}"
							onclick={() => worksheetStore.selectGrade(grade)}
						>
							{gradeLabel(grade)}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
