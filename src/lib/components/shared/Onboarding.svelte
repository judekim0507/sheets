<script lang="ts">
	import { onMount } from 'svelte';
	import { tick } from 'svelte';

	let { onDismiss }: { onDismiss: () => void } = $props();
	let visible = $state(false);
	let phase = $state(0); // 0=hidden, 1=content in, 2=exiting

	onMount(async () => {
		await tick();
		requestAnimationFrame(() => { visible = true; phase = 1; });
	});

	function enter() {
		phase = 2;
		setTimeout(onDismiss, 500);
	}
</script>

<div
	class="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
	class:opacity-0={phase === 0 || phase === 2}
	class:scale-95={phase === 2}
>
	<!-- Background grid -->
	<div class="pointer-events-none absolute inset-0 opacity-[0.03]"
		style="background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px); background-size: 40px 40px;"
	></div>

	<!-- Content -->
	<div class="relative z-10 mx-auto max-w-lg px-6 text-center">
		<div class="ob-el" class:ob-visible={visible} style="--d: 0ms">
			<div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
				<svg viewBox="0 0 32 32" fill="none" class="h-7 w-7" xmlns="http://www.w3.org/2000/svg">
					<path d="M10 11.5C10 9.567 11.567 8 13.5 8H18c1.933 0 3.5 1.567 3.5 3.5S19.933 15 18 15h-4c-1.933 0-3.5 1.567-3.5 3.5S12.067 22 14 22h4.5c1.933 0 3.5-1.567 3.5-3.5" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
				</svg>
			</div>
		</div>

		<h1 class="ob-el text-[2.75rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl" class:ob-visible={visible} style="--d: 100ms">
			Sheets
		</h1>

		<p class="ob-el mt-4 text-lg leading-relaxed text-white/50" class:ob-visible={visible} style="--d: 200ms">
			AI-powered math worksheets.<br/>Pick a grade. Generate. Print.
		</p>

		<div class="ob-el mt-5 flex items-center justify-center gap-6 text-[13px] text-white/30" class:ob-visible={visible} style="--d: 350ms">
			<span>K–12 curriculum</span>
			<span class="text-white/10">·</span>
			<span>Diagrams & LaTeX</span>
			<span class="text-white/10">·</span>
			<span>BYOK</span>
		</div>

		<div class="ob-el mt-10" class:ob-visible={visible} style="--d: 500ms">
			<button
				class="group relative inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#0a0a0a] transition-transform hover:scale-[1.02]"
				onclick={enter}
			>
				Get Started
				<svg class="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
				</svg>
			</button>
		</div>
	</div>
</div>

<style>
	.ob-el {
		opacity: 0;
		transform: translateY(16px);
	}
	.ob-visible {
		animation: ob-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
		animation-delay: var(--d);
	}
	@keyframes ob-in {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
