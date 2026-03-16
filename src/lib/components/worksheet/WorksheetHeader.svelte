<script lang="ts">
	let {
		title,
		studentName,
		editable = false,
		onTitleChange,
		onStudentChange
	}: {
		title: string;
		studentName?: string;
		editable?: boolean;
		onTitleChange?: (title: string) => void;
		onStudentChange?: (name: string) => void;
	} = $props();

	let editingTitle = $state(false);
	let editingStudent = $state(false);
	let titleDraft = $state(title);
	let studentDraft = $state(studentName ?? '');

	function commitTitle() {
		editingTitle = false;
		const v = titleDraft.trim();
		if (v && v !== title) onTitleChange?.(v);
		else titleDraft = title;
	}

	function commitStudent() {
		editingStudent = false;
		const v = studentDraft.trim();
		if (v !== (studentName ?? '')) onStudentChange?.(v);
	}
</script>

<div class="worksheet-header mb-6">
	{#if editable && editingTitle}
		<input
			class="no-print w-full border-b-2 border-primary bg-transparent text-center text-lg font-bold leading-tight outline-none"
			bind:value={titleDraft}
			onblur={commitTitle}
			onkeydown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { titleDraft = title; editingTitle = false; } }}
			autofocus
		/>
		<h1 class="hidden text-center text-lg font-bold leading-tight print:block">{title}</h1>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<h1
			class="text-center text-lg font-bold leading-tight {editable ? 'cursor-text rounded px-1 hover:bg-accent/40' : ''}"
			onclick={() => { if (editable) { titleDraft = title; editingTitle = true; } }}
			onkeydown={() => {}}
		>
			{title}
		</h1>
	{/if}

	<div class="mt-3 flex items-end gap-6 border-b border-foreground/30 pb-2 text-xs">
		<div class="flex-1">
			<span class="font-medium">Name:</span>
			<!-- Screen: editable click-to-edit -->
			{#if editable}
				{#if editingStudent}
					<input
						class="no-print ml-1 w-40 border-b border-primary bg-transparent text-xs outline-none"
						bind:value={studentDraft}
						placeholder="Student name"
						onblur={commitStudent}
						onkeydown={(e) => { if (e.key === 'Enter') commitStudent(); if (e.key === 'Escape') { studentDraft = studentName ?? ''; editingStudent = false; } }}
						autofocus
					/>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<span
						class="no-print ml-1 inline-block cursor-text rounded px-1 hover:bg-accent/40 {studentName ? '' : 'text-muted-foreground'}"
						onclick={() => { studentDraft = studentName ?? ''; editingStudent = true; }}
						onkeydown={() => {}}
					>
						{studentName || 'Add student'}
					</span>
				{/if}
			{/if}
			<!-- Print: show name or blank line -->
			<span class="ml-1 hidden print:inline-block {studentName ? '' : 'w-full border-b border-foreground/40'}">
				{studentName ?? ''}
			</span>
		</div>
		<div>
			<span class="font-medium">Date:</span>
			<span class="ml-1 inline-block w-28 border-b border-foreground/40"></span>
		</div>
		<div>
			<span class="font-medium">Period:</span>
			<span class="ml-1 inline-block w-12 border-b border-foreground/40"></span>
		</div>
	</div>
</div>
