<script lang="ts">
	import { browser } from '$app/environment';
	import { createDesmosExpressions, loadDesmos, type DesmosCalculator } from '$lib/diagram/desmos';
	import type { DiagramGraph } from '$lib/data/types';

	let { graph }: { graph: DiagramGraph } = $props();

	let imageData = $state<string | null>(null);
	let error = $state<string | null>(null);
	let rendering = $state(false);

	let calculator: DesmosCalculator | null = null;
	let host: HTMLDivElement | null = null;
	let renderVersion = 0;

	const signature = $derived(JSON.stringify(graph));

	$effect(() => {
		if (!browser) return;
		signature;
		void renderGraph();
		return () => cleanup();
	});

	async function renderGraph() {
		const version = ++renderVersion;
		rendering = true;
		error = null;
		imageData = null;
		cleanup();

		try {
			const Desmos = await loadDesmos();
			if (version !== renderVersion) return;

			host = document.createElement('div');
			host.style.position = 'fixed';
			host.style.left = '-10000px';
			host.style.top = '0';
			host.style.width = `${screenshotWidth()}px`;
			host.style.height = `${screenshotHeight()}px`;
			host.style.opacity = '0';
			host.style.pointerEvents = 'none';
			document.body.appendChild(host);

			calculator = Desmos.GraphingCalculator(host, {
				keypad: false,
				expressions: false,
				settingsMenu: false,
				zoomButtons: false,
				expressionsTopbar: false,
				expressionsCollapsed: true,
				pointsOfInterest: false,
				trace: false,
				border: false,
				lockViewport: true
			});

			calculator.updateSettings({
				degreeMode: graph.degree_mode ?? false,
				projectorMode: true,
				fontSize: Desmos.FontSizes.SMALL,
				showGrid: graph.show_grid ?? true,
				showXAxis: graph.show_x_axis ?? true,
				showYAxis: graph.show_y_axis ?? true,
				xAxisNumbers: graph.show_x_axis_numbers ?? true,
				yAxisNumbers: graph.show_y_axis_numbers ?? true,
				xAxisArrowMode: Desmos.AxisArrowModes.NONE,
				yAxisArrowMode: Desmos.AxisArrowModes.NONE
			});
			calculator.setMathBounds(graph.viewport);
			const expressions = createDesmosExpressions(graph, Desmos);
			let plotted = 0;
			for (const expression of expressions) {
				try {
					calculator.setExpression(expression);
					plotted += 1;
				} catch (exprError) {
					console.warn('Skipping invalid graph expression', expression, exprError);
				}
			}

			if (plotted === 0) {
				throw new Error('No graph expressions could be plotted');
			}

			await new Promise((resolve) => setTimeout(resolve, 80));

			const dataUri = await new Promise<string>((resolve, reject) => {
				try {
					calculator!.asyncScreenshot(
					{
						mode: 'stretch',
						width: screenshotWidth(),
						height: screenshotHeight(),
						targetPixelRatio: 2,
						preserveAxisNumbers: true,
						mathBounds: graph.viewport
					},
					(uri) => resolve(uri)
				);
				} catch (shotError) {
					try {
						resolve(calculator!.screenshot({
							width: screenshotWidth(),
							height: screenshotHeight(),
							targetPixelRatio: 2,
							preserveAxisNumbers: true
						}));
					} catch {
						reject(shotError);
					}
				}
			});

			if (version !== renderVersion) return;
			imageData = dataUri;
		} catch (err) {
			if (version !== renderVersion) return;
			error = err instanceof Error ? err.message : 'Failed to render graph';
		} finally {
			if (version === renderVersion) rendering = false;
			cleanup();
		}
	}

	function screenshotWidth(): number {
		const xSpan = Math.max(1, graph.viewport.right - graph.viewport.left);
		const ySpan = Math.max(1, graph.viewport.top - graph.viewport.bottom);
		const aspect = xSpan / ySpan;
		if (aspect >= 1) return 760;
		return Math.max(460, Math.round(760 * aspect));
	}

	function screenshotHeight(): number {
		const xSpan = Math.max(1, graph.viewport.right - graph.viewport.left);
		const ySpan = Math.max(1, graph.viewport.top - graph.viewport.bottom);
		const aspect = xSpan / ySpan;
		if (aspect >= 1) return Math.max(360, Math.round(760 / aspect));
		return 760;
	}

	function cleanup() {
		calculator?.destroy();
		calculator = null;
		host?.remove();
		host = null;
	}
</script>

{#if imageData}
	<img
		src={imageData}
		alt="Mathematical graph"
		class="diagram-graph w-full max-w-[320px] rounded-sm border border-border/60 bg-white"
	/>
{:else if error}
	<div class="flex min-h-[180px] w-full max-w-[320px] items-center justify-center rounded-sm border border-dashed border-destructive/40 bg-muted/30 px-3 text-center text-xs text-muted-foreground">
		{error}
	</div>
{:else}
	<div class="flex min-h-[180px] w-full max-w-[320px] items-center justify-center rounded-sm border border-dashed border-border/60 bg-muted/30 px-3 text-center text-xs text-muted-foreground">
		{rendering ? 'Rendering graph…' : 'Preparing graph…'}
	</div>
{/if}
