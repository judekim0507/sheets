<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Sheets</title>
</svelte:head>

<div class="min-h-screen bg-background">
	{@render children()}
</div>
