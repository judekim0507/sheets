<script lang="ts">
	let { title }: { title: string } = $props();
</script>

<div class="worksheet-header mb-6">
	<h1 class="text-center text-lg font-bold leading-tight">{title}</h1>
	<div class="mt-3 flex items-end gap-6 border-b border-foreground/30 pb-2 text-xs">
		<div class="flex-1">
			<span class="font-medium">Name:</span>
			<span class="ml-1 inline-block w-full border-b border-foreground/40"></span>
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
