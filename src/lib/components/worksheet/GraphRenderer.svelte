<script lang="ts">
	import { browser } from '$app/environment';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { BuilderConfig, DiagramGraph, GeneratedQuestion } from '$lib/data/types';
	import { createDesmosExpressions, loadDesmos, type DesmosCalculator } from '$lib/diagram/desmos';
	import {
		compileGraph,
		createGraphRenderPlan,
		getDesmosViewport,
		validateGraphRenderPlan,
		type GraphRenderPlan,
		type GraphRenderStatus
	} from '$lib/graph/compiler';

	let {
		graph,
		question,
		config,
		onQuestionRepair
	}: {
		graph: DiagramGraph;
		question?: GeneratedQuestion;
		config?: BuilderConfig;
		onQuestionRepair?: (question: GeneratedQuestion) => void;
	} = $props();

	let status = $state<GraphRenderStatus>('repairing');
	let error = $state<string | null>(null);
	let repairMessage = $state<string | null>(null);
	let desmosHost = $state<HTMLDivElement | null>(null);
	let printImage = $state<string | null>(null);

	let calculator: DesmosCalculator | null = null;
	let repairInFlight = false;
	let repairedSignature: string | null = null;

	const signature = $derived(JSON.stringify(graph));
	const compilation = $derived(compileGraph(graph));
	const renderPlan = $derived(createGraphRenderPlan(graph, compilation));
	const validation = $derived(validateGraphRenderPlan(graph, compilation, renderPlan));
	const svgViewport = $derived(svgViewBox(renderPlan.viewport));
	const tickStep = $derived(getTickStep(renderPlan.viewport));
	const graphAspectRatio = $derived(graphAspect(renderPlan.viewport));
	const displayAspectRatio = $derived(clampAspectRatio(graphAspectRatio));
	const graphLabelFontSize = $derived(labelFontSize(renderPlan.viewport));
	const graphLabelOffset = $derived(Number((graphLabelFontSize * 0.55).toFixed(3)));
	const graphPointRadius = $derived(pointRadius(renderPlan.viewport));
	const overlayLabels = $derived(createOverlayLabels(renderPlan));
	const axisOverlay = $derived(createAxisOverlay(renderPlan.viewport, tickStep));

	$effect(() => {
		signature;
		error = null;
		repairMessage = null;
		printImage = null;

		if (renderPlan.engine === 'svg' && validation.ok) {
			status = 'ready-svg';
			return;
		}

		status = renderPlan.engine === 'desmos' ? 'repairing' : 'failed';
		if (!validation.ok) {
			void requestRepair(validation.diagnostics.map((item) => item.message));
		}
	});

	$effect(() => {
		if (!browser || renderPlan.engine !== 'desmos' || !desmosHost) return;
		signature;

		let cancelled = false;
		status = 'repairing';
		printImage = null;
		void mountDesmos();

		return () => {
			cancelled = true;
			cleanup();
		};

		async function mountDesmos() {
			try {
				const Desmos = await loadDesmos();
				if (cancelled || !desmosHost) return;

				cleanup();
				calculator = Desmos.GraphingCalculator(desmosHost, {
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
					fontSize: Desmos.FontSizes.LARGE ?? Desmos.FontSizes.MEDIUM ?? Desmos.FontSizes.SMALL,
					showGrid: graph.show_grid ?? true,
					showXAxis: graph.show_x_axis ?? true,
					showYAxis: graph.show_y_axis ?? true,
					xAxisNumbers: graph.show_x_axis_numbers ?? true,
					yAxisNumbers: graph.show_y_axis_numbers ?? true,
					xAxisArrowMode: Desmos.AxisArrowModes.NONE,
					yAxisArrowMode: Desmos.AxisArrowModes.NONE
				});

				calculator.setMathBounds(getDesmosViewport(graph, renderPlan));
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
					throw new Error('Desmos could not plot any expressions');
				}

				await new Promise((resolve) => setTimeout(resolve, 220));
				if (cancelled || !calculator) return;
				calculator.resize();
				status = 'ready-desmos';

				try {
					printImage = await new Promise<string>((resolve, reject) => {
						try {
							calculator!.asyncScreenshot(
								{
									mode: 'contain',
									width: 960,
									height: 720,
									targetPixelRatio: 2,
									preserveAxisNumbers: true,
									mathBounds: getDesmosViewport(graph, renderPlan)
								},
								(uri) => resolve(uri)
							);
						} catch (shotError) {
							try {
								resolve(calculator!.screenshot({
									width: 960,
									height: 720,
									targetPixelRatio: 2,
									preserveAxisNumbers: true
								}));
							} catch {
								reject(shotError);
							}
						}
					});
				} catch (shotError) {
					console.warn('Desmos print screenshot failed', shotError);
				}
			} catch (err) {
				if (cancelled) return;
				error = err instanceof Error ? err.message : 'Failed to render graph';
				status = 'failed';
				await requestRepair([
					error,
					'Client-side Desmos fallback failed to render the graph'
				]);
			}
		}
	});

	async function requestRepair(messages: string[]) {
		if (!browser || !question || !config || !onQuestionRepair) return;
		const currentSignature = `${question.question}:${signature}`;
		if (repairInFlight || repairedSignature === currentSignature) return;
		if (!settingsStore.activeApiKey) return;

		repairInFlight = true;
		repairedSignature = currentSignature;
		status = 'repairing';
		repairMessage = 'Repairing graph…';

		try {
			const res = await fetch('/api/generate-question', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					original: question,
					instruction: `Repair only the graph. The client renderer could not confirm a usable graph. Diagnostics: ${messages.join(' | ')}`,
					config,
					provider: settingsStore.provider,
					apiKey: settingsStore.activeApiKey,
					model: settingsStore.activeModel
				})
			});

			if (!res.ok) {
				let message = `Repair failed (${res.status})`;
				try {
					const payload = await res.json();
					message = payload.error || message;
				} catch {
					// ignore
				}
				throw new Error(message);
			}

			const payload = await res.json();
			if (payload.question) {
				onQuestionRepair(payload.question);
			} else {
				throw new Error('Repair response did not include a question');
			}
		} catch (repairError) {
			error = repairError instanceof Error ? repairError.message : 'Graph repair failed';
			status = 'failed';
		} finally {
			repairInFlight = false;
			repairMessage = null;
		}
	}

	function cleanup() {
		calculator?.destroy();
		calculator = null;
	}

	function svgViewBox(viewport: GraphRenderPlan['viewport']): string {
		return `${viewport.left} ${-viewport.top} ${viewport.right - viewport.left} ${viewport.top - viewport.bottom}`;
	}

	function y(value: number): number {
		return -value;
	}

	function polyline(points: Array<{ x: number; y: number }>): string {
		return points.map((point) => `${point.x},${y(point.y)}`).join(' ');
	}

	function polygon(points: Array<{ x: number; y: number }>): string {
		return points.map((point) => `${point.x},${y(point.y)}`).join(' ');
	}

	function dashArray(style: 'solid' | 'dashed' | 'dotted'): string | undefined {
		if (style === 'dashed') return '0.5 0.35';
		if (style === 'dotted') return '0.1 0.24';
		return undefined;
	}

	function getTickStep(viewport: GraphRenderPlan['viewport']): number {
		const span = Math.max(viewport.right - viewport.left, viewport.top - viewport.bottom);
		const rough = span / 8;
		const power = Math.pow(10, Math.floor(Math.log10(rough || 1)));
		const normalized = rough / power;
		if (normalized <= 1) return power;
		if (normalized <= 2) return 2 * power;
		if (normalized <= 5) return 5 * power;
		return 10 * power;
	}

	function axisTicks(min: number, max: number, step: number): number[] {
		const start = Math.ceil(min / step) * step;
		const ticks: number[] = [];
		for (let value = start; value <= max + step * 0.25; value += step) {
			ticks.push(Number(value.toFixed(6)));
		}
		return ticks;
	}

	function graphAspect(viewport: GraphRenderPlan['viewport']): number {
		const width = Math.max(1, viewport.right - viewport.left);
		const height = Math.max(1, viewport.top - viewport.bottom);
		return Number((width / height).toFixed(4));
	}

	function clampAspectRatio(value: number): number {
		return Number(Math.min(1.18, Math.max(0.86, value)).toFixed(4));
	}

	function labelFontSize(viewport: GraphRenderPlan['viewport']): number {
		const span = Math.max(viewport.right - viewport.left, viewport.top - viewport.bottom);
		return Number(Math.min(1.75, Math.max(1.05, span * 0.06)).toFixed(3));
	}

	function pointRadius(viewport: GraphRenderPlan['viewport']): number {
		const span = Math.max(viewport.right - viewport.left, viewport.top - viewport.bottom);
		return Number(Math.min(0.32, Math.max(0.2, span * 0.012)).toFixed(3));
	}

	function createOverlayLabels(plan: GraphRenderPlan): Array<{
		key: string;
		text: string;
		left: number;
		top: number;
		color: string;
		align?: 'left' | 'center';
	}> {
		const labels: Array<{
			key: string;
			text: string;
			left: number;
			top: number;
			color: string;
			align?: 'left' | 'center';
		}> = [];

		for (const plot of plan.plots) {
			if (plot.kind === 'point' && plot.label) {
				labels.push({
					key: `${plot.expressionId}:point-label`,
					text: plot.label,
					left: xPercent(plot.x, plan.viewport),
					top: yPercent(plot.y, plan.viewport),
					color: plot.color,
					align: 'left'
				});
			}

			if (plot.kind === 'function' && plot.label && plot.labelPoint) {
				labels.push({
					key: `${plot.expressionId}:function-label`,
					text: plot.label,
					left: xPercent(plot.labelPoint.x, plan.viewport),
					top: yPercent(plot.labelPoint.y, plan.viewport),
					color: plot.color,
					align: 'center'
				});
			}
		}

		return labels;
	}

	function xPercent(x: number, viewport: GraphRenderPlan['viewport']): number {
		const width = viewport.right - viewport.left;
		return Number((((x - viewport.left) / width) * 100).toFixed(3));
	}

	function yPercent(yValue: number, viewport: GraphRenderPlan['viewport']): number {
		const height = viewport.top - viewport.bottom;
		return Number((((viewport.top - yValue) / height) * 100).toFixed(3));
	}

	function createAxisOverlay(
		viewport: GraphRenderPlan['viewport'],
		step: number
	): {
		xTicks: Array<{ key: string; text: string; left: number }>;
		yTicks: Array<{ key: string; text: string; top: number }>;
		xAxisTop: number;
		yAxisLeft: number;
		showXAxisLabel: boolean;
		showYAxisLabel: boolean;
	} {
		const xAxisVisible = viewport.bottom <= 0 && viewport.top >= 0;
		const yAxisVisible = viewport.left <= 0 && viewport.right >= 0;
		const xAxisTop = xAxisVisible ? yPercent(0, viewport) : 100;
		const yAxisLeft = yAxisVisible ? xPercent(0, viewport) : 0;

		const xTicks = axisTicks(viewport.left, viewport.right, step)
			.filter((value) => Math.abs(value) > 1e-6)
			.map((value) => ({
				key: `x:${value}`,
				text: formatTickLabel(value),
				left: xPercent(value, viewport)
			}));

		const yTicks = axisTicks(viewport.bottom, viewport.top, step)
			.filter((value) => Math.abs(value) > 1e-6)
			.map((value) => ({
				key: `y:${value}`,
				text: formatTickLabel(value),
				top: yPercent(value, viewport)
			}));

		return {
			xTicks,
			yTicks,
			xAxisTop,
			yAxisLeft,
			showXAxisLabel: xAxisVisible,
			showYAxisLabel: yAxisVisible
		};
	}

	function formatTickLabel(value: number): string {
		if (Math.abs(value - Math.round(value)) < 1e-6) return String(Math.round(value));
		return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
	}
</script>

{#if status === 'ready-svg'}
	<div
		class="diagram-graph relative block w-full max-w-[320px] overflow-hidden rounded-sm border border-border/60 bg-white"
		style={`min-height: 240px; aspect-ratio: ${displayAspectRatio};`}
	>
		<svg
			viewBox={svgViewport}
			class="block h-full w-full"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Mathematical graph"
			preserveAspectRatio="xMidYMid meet"
		>
			<rect x={renderPlan.viewport.left} y={-renderPlan.viewport.top} width={renderPlan.viewport.right - renderPlan.viewport.left} height={renderPlan.viewport.top - renderPlan.viewport.bottom} fill="white" />

			{#each axisTicks(renderPlan.viewport.left, renderPlan.viewport.right, tickStep) as xTick (xTick)}
				<line
					x1={xTick}
					y1={-renderPlan.viewport.top}
					x2={xTick}
					y2={-renderPlan.viewport.bottom}
					stroke={xTick === 0 ? '#6b7280' : '#d1d5db'}
					stroke-width={xTick === 0 ? 0.09 : 0.04}
				/>
			{/each}
			{#each axisTicks(renderPlan.viewport.bottom, renderPlan.viewport.top, tickStep) as yTick (yTick)}
				<line
					x1={renderPlan.viewport.left}
					y1={-yTick}
					x2={renderPlan.viewport.right}
					y2={-yTick}
					stroke={yTick === 0 ? '#6b7280' : '#d1d5db'}
					stroke-width={yTick === 0 ? 0.09 : 0.04}
				/>
			{/each}

			{#if renderPlan.viewport.bottom <= 0 && renderPlan.viewport.top >= 0}
				{#each axisTicks(renderPlan.viewport.left, renderPlan.viewport.right, tickStep) as xTick (xTick)}
					<line
						x1={xTick}
						y1={0.22}
						x2={xTick}
						y2={-0.22}
						stroke="#6b7280"
						stroke-width="0.06"
					/>
				{/each}
			{/if}
			{#if renderPlan.viewport.left <= 0 && renderPlan.viewport.right >= 0}
				{#each axisTicks(renderPlan.viewport.bottom, renderPlan.viewport.top, tickStep) as yTick (yTick)}
					<line
						x1={-0.22}
						y1={-yTick}
						x2={0.22}
						y2={-yTick}
						stroke="#6b7280"
						stroke-width="0.06"
					/>
				{/each}
			{/if}

			{#each renderPlan.plots as plot (`${plot.kind}:${plot.expressionId}`)}
				{#if plot.kind === 'function'}
					{#each plot.fillPolygons as fillPoints, index (`${plot.expressionId}:fill:${index}`)}
						<polygon points={polygon(fillPoints)} fill={plot.color} fill-opacity="0.14" stroke="none" />
					{/each}
					{#each plot.segments as segment, index (`${plot.expressionId}:segment:${index}`)}
						<polyline
							points={polyline(segment)}
							fill="none"
							stroke={plot.color}
							stroke-width="0.11"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-dasharray={dashArray(plot.lineStyle)}
						/>
					{/each}

				{:else if plot.kind === 'vertical-line'}
					{#if plot.fillPolygon}
						<polygon points={polygon(plot.fillPolygon)} fill={plot.color} fill-opacity="0.14" stroke="none" />
					{/if}
					<line
						x1={plot.x}
						y1={-renderPlan.viewport.top}
						x2={plot.x}
						y2={-renderPlan.viewport.bottom}
						stroke={plot.color}
						stroke-width="0.11"
						stroke-linecap="round"
						stroke-dasharray={dashArray(plot.lineStyle)}
					/>

				{:else if plot.kind === 'circle'}
					{#if plot.fill === 'inside'}
						<circle cx={plot.h} cy={-plot.k} r={plot.r} fill={plot.color} fill-opacity="0.14" stroke="none" />
					{/if}
					<circle
						cx={plot.h}
						cy={-plot.k}
						r={plot.r}
						fill="none"
						stroke={plot.color}
						stroke-width="0.11"
						stroke-dasharray={dashArray(plot.lineStyle)}
					/>

				{:else if plot.kind === 'point'}
					<circle
						cx={plot.x}
						cy={-plot.y}
						r={graphPointRadius}
						fill={plot.open ? 'white' : plot.color}
						stroke={plot.color}
						stroke-width="0.09"
					/>
				{/if}
			{/each}
		</svg>
		<div class="pointer-events-none absolute inset-0">
			{#each axisOverlay.xTicks as tick (tick.key)}
				<div
					class="absolute text-[9px] leading-none text-muted-foreground print:text-[8px]"
					style={`left:${tick.left}%; top:${Math.min(96, axisOverlay.xAxisTop + 3.8)}%; transform:translate(-50%, 0);`}
				>
					{tick.text}
				</div>
			{/each}
			{#each axisOverlay.yTicks as tick (tick.key)}
				<div
					class="absolute text-[9px] leading-none text-muted-foreground print:text-[8px]"
					style={`left:${Math.max(1, axisOverlay.yAxisLeft - 2.8)}%; top:${tick.top}%; transform:translate(-100%, -50%);`}
				>
					{tick.text}
				</div>
			{/each}
			{#if axisOverlay.showXAxisLabel}
				<div
					class="absolute text-[10px] font-medium leading-none text-muted-foreground print:text-[9px]"
					style={`left:97%; top:${Math.max(2, axisOverlay.xAxisTop - 1.8)}%; transform:translate(-100%, -100%);`}
				>
					x
				</div>
			{/if}
			{#if axisOverlay.showYAxisLabel}
				<div
					class="absolute text-[10px] font-medium leading-none text-muted-foreground print:text-[9px]"
					style={`left:${Math.min(97, axisOverlay.yAxisLeft + 1.6)}%; top:3%;`}
				>
					y
				</div>
			{/if}
			{#each overlayLabels as label (label.key)}
				<div
					class="absolute text-[11px] font-medium leading-none print:text-[10px]"
					style={`left:${label.left}%; top:${label.top}%; color:${label.color}; transform:${label.align === 'center' ? 'translate(-50%, calc(-100% - 6px))' : 'translate(6px, calc(-100% - 6px))'}; text-shadow: 0 0 3px #fff, 0 0 6px #fff, 0 0 8px #fff;`}
				>
					{label.text}
				</div>
			{/each}
		</div>
	</div>
{:else if renderPlan.engine === 'desmos'}
	<div
		class="diagram-graph w-full max-w-[320px] overflow-hidden rounded-sm border border-border/60 bg-white"
		style={`min-height: 240px; aspect-ratio: ${displayAspectRatio};`}
	>
		<div class="print:hidden">
			<div bind:this={desmosHost} class="h-full min-h-[240px] w-full" aria-label="Mathematical graph" role="img"></div>
		</div>
		{#if printImage}
			<img src={printImage} alt="Mathematical graph" class="hidden w-full print:block" />
		{/if}
		{#if status === 'repairing'}
			<div class="flex min-h-[40px] items-center justify-center border-t border-border/60 bg-muted/20 px-3 text-center text-xs text-muted-foreground">
				{repairMessage ?? 'Preparing graph…'}
			</div>
		{/if}
	</div>
{:else}
	<div class="flex min-h-[180px] w-full max-w-[320px] items-center justify-center rounded-sm border border-dashed border-destructive/40 bg-muted/30 px-3 text-center text-xs text-muted-foreground">
		{error ?? 'Graph could not be rendered'}
	</div>
{/if}
