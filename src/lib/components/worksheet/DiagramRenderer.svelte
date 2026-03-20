<script lang="ts">
	import type { DiagramSceneGraph, DiagramElement } from '$lib/data/types';
	import GraphRenderer from './GraphRenderer.svelte';
	import {
		buildPointMap, resolvePoint, sortElementsByLayer,
		extendLineToBounds, extendLineToViewBox, extendRayToBounds, extendRayToViewBox,
		arcPath, perpOffset, bezierPath, labelOffset, angleBisector, pointCentroid,
		type PointMap
	} from '$lib/diagram/renderer';

	let { diagram }: { diagram: DiagramSceneGraph } = $props();

	const pad = 1;
	const sw = 0.07;
	const pr = 0.12;
	const ptLabelFs = 0.65;
	const measLabelFs = 0.5;
	const angleLabelFs = 0.45;

	// If diagram has axes, use axis range for viewBox (y-flipped for math convention)
	const axesEl = $derived(diagram.elements.find((e) => e.type === 'axes'));
	const hasAxes = $derived(axesEl && axesEl.x_min != null && axesEl.x_max != null && axesEl.y_min != null && axesEl.y_max != null);
	const viewBounds = $derived(
		hasAxes
			? {
				left: axesEl!.x_min! - pad,
				right: axesEl!.x_max! + pad,
				top: axesEl!.y_min! - pad,
				bottom: axesEl!.y_max! + pad
			}
			: {
				left: -pad,
				right: diagram.width + pad,
				top: -pad,
				bottom: diagram.height + pad
			}
	);
	const vb = $derived(
		hasAxes
			? `${axesEl!.x_min! - pad} ${-axesEl!.y_max! - pad} ${axesEl!.x_max! - axesEl!.x_min! + pad * 2} ${axesEl!.y_max! - axesEl!.y_min! + pad * 2}`
			: `${-pad} ${-pad} ${diagram.width + pad * 2} ${diagram.height + pad * 2}`
	);
	// For axes diagrams: flip y coordinate (math y-up → SVG y-down)
	function yf(y: number): number { return hasAxes ? -y : y; }
	const pm: PointMap = $derived(buildPointMap(diagram.elements));
	const sorted: DiagramElement[] = $derived(sortElementsByLayer(diagram.elements));

	function d(el: { style?: string }): string | undefined {
		return el.style === 'dashed' ? `${sw * 5} ${sw * 3}` : undefined;
	}

	function segMid(fId: string, tId: string) {
		const a = resolvePoint(fId, pm), b = resolvePoint(tId, pm);
		if (!a || !b) return null;
		const screenA = { x: a.x, y: yf(a.y) };
		const screenB = { x: b.x, y: yf(b.y) };
		const centroid = pointCentroid(pm);
		if (!centroid) return perpOffset(screenA.x, screenA.y, screenB.x, screenB.y, 0.45);
		const screenCentroid = { x: centroid.x, y: yf(centroid.y) };
		const above = perpOffset(screenA.x, screenA.y, screenB.x, screenB.y, 0.5);
		const below = perpOffset(screenA.x, screenA.y, screenB.x, screenB.y, -0.5);
		const dAbove = Math.hypot(above.x - screenCentroid.x, above.y - screenCentroid.y);
		const dBelow = Math.hypot(below.x - screenCentroid.x, below.y - screenCentroid.y);
		return dAbove >= dBelow ? above : below;
	}

	function mkAngleArc(vId: string, r1Id: string, r2Id: string, r: number): string {
		const vRaw = resolvePoint(vId, pm), p1Raw = resolvePoint(r1Id, pm), p2Raw = resolvePoint(r2Id, pm);
		const v = vRaw ? { x: vRaw.x, y: yf(vRaw.y) } : null;
		const p1 = p1Raw ? { x: p1Raw.x, y: yf(p1Raw.y) } : null;
		const p2 = p2Raw ? { x: p2Raw.x, y: yf(p2Raw.y) } : null;
		if (!v || !p1 || !p2) return '';
		const a1 = Math.atan2(p1.y - v.y, p1.x - v.x) * (180 / Math.PI);
		const a2 = Math.atan2(p2.y - v.y, p2.x - v.x) * (180 / Math.PI);
		return arcPath(v.x, v.y, r, a1, a2);
	}

	function mkRightAngle(vId: string, r1Id: string, r2Id: string, sz: number): string {
		const vRaw = resolvePoint(vId, pm), p1Raw = resolvePoint(r1Id, pm), p2Raw = resolvePoint(r2Id, pm);
		const v = vRaw ? { x: vRaw.x, y: yf(vRaw.y) } : null;
		const p1 = p1Raw ? { x: p1Raw.x, y: yf(p1Raw.y) } : null;
		const p2 = p2Raw ? { x: p2Raw.x, y: yf(p2Raw.y) } : null;
		if (!v || !p1 || !p2) return '';
		const d1x = p1.x - v.x, d1y = p1.y - v.y, d2x = p2.x - v.x, d2y = p2.y - v.y;
		const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
		if (l1 === 0 || l2 === 0) return '';
		const u1x = (d1x / l1) * sz, u1y = (d1y / l1) * sz;
		const u2x = (d2x / l2) * sz, u2y = (d2y / l2) * sz;
		return `M ${v.x + u1x} ${v.y + u1y} L ${v.x + u1x + u2x} ${v.y + u1y + u2y} L ${v.x + u2x} ${v.y + u2y}`;
	}

	function ticks(fId: string, tId: string, n: number) {
		const aRaw = resolvePoint(fId, pm), bRaw = resolvePoint(tId, pm);
		const a = aRaw ? { x: aRaw.x, y: yf(aRaw.y) } : null;
		const b = bRaw ? { x: bRaw.x, y: yf(bRaw.y) } : null;
		if (!a || !b) return [];
		const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
		const ang = Math.atan2(b.y - a.y, b.x - a.x), perp = ang + Math.PI / 2;
		const sp = 0.15, st = -((n - 1) * sp) / 2;
		return Array.from({ length: n }, (_, i) => ({
			x: mx + Math.cos(ang) * (st + i * sp), y: my + Math.sin(ang) * (st + i * sp), a: perp
		}));
	}

	function rng(min: number, max: number, step: number): number[] {
		const a = [];
		for (let v = min; v <= max + step * 0.001; v += step) a.push(Math.round(v * 1e3) / 1e3);
		return a;
	}

	// 3D projection helpers — standard oblique at ~30° angle
	const OBL = 0.35; // oblique depth factor
	const OBLA = Math.PI / 6; // 30° angle
	function oblX(d: number) { return d * OBL * Math.cos(OBLA); }
	function oblY(d: number) { return -d * OBL * Math.sin(OBLA); } // negative = up in screen coords

	// SVG ellipse arc path for partial ellipses
	function ellipseArc(cx: number, cy: number, rx: number, ry: number, start: number, end: number): string {
		const s = (start * Math.PI) / 180, e = (end * Math.PI) / 180;
		const x1 = cx + rx * Math.cos(s), y1 = cy + ry * Math.sin(s);
		const x2 = cx + rx * Math.cos(e), y2 = cy + ry * Math.sin(e);
		const sweep = ((end - start + 360) % 360) > 180 ? 1 : 0;
		return `M ${x1} ${y1} A ${rx} ${ry} 0 ${sweep} 1 ${x2} ${y2}`;
	}

	function dimLabel(labels: Record<string, string> | undefined, key: string): string | undefined {
		return labels?.[key];
	}

	function prettyText(text: string): string {
		return text
			.replace(/\\theta/g, 'θ')
			.replace(/\\alpha/g, 'α')
			.replace(/\\beta/g, 'β')
			.replace(/\\gamma/g, 'γ')
			.replace(/\\delta/g, 'δ')
			.replace(/\\phi/g, 'φ')
			.replace(/\\pi/g, 'π')
			.replace(/\\angle/g, '∠')
			.replace(/\\circ/g, '°')
			.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1/$2')
			.replace(/\\left/g, '')
			.replace(/\\right/g, '')
			.replace(/[{}]/g, '')
			.replace(/_([A-Za-z0-9]+)/g, '$1')
			.trim();
	}

	function extLine(a: { x: number; y: number }, b: { x: number; y: number }) {
		return hasAxes ? extendLineToBounds(a, b, viewBounds) : extendLineToViewBox(a, b, diagram.width, diagram.height);
	}

	function extRay(a: { x: number; y: number }, b: { x: number; y: number }) {
		return hasAxes ? extendRayToBounds(a, b, viewBounds) : extendRayToViewBox(a, b, diagram.width, diagram.height);
	}
</script>

{#snippet lbl(x: number, y: number, text: string, size: number, weight: string = '600')}
	<text x={x} y={y} text-anchor="middle" dominant-baseline="central" font-size={size} font-weight={weight} fill="white" stroke="white" stroke-width={size * 0.4} stroke-linejoin="round" font-family="sans-serif">{prettyText(text)}</text>
	<text x={x} y={y} text-anchor="middle" dominant-baseline="central" font-size={size} font-weight={weight} fill="#1a1a1a" font-family="sans-serif">{prettyText(text)}</text>
{/snippet}

{#if diagram?.graph}
	<GraphRenderer graph={diagram.graph} />
{:else if diagram?.elements}
	<svg viewBox={vb} class="diagram-svg w-full max-w-[280px]" style="height: auto;" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mathematical diagram">
		{#each sorted as el}
			{#if el.type === 'polygon' && el.vertices}
				{@const pts = el.vertices.map((id) => resolvePoint(id, pm)).filter((p): p is {x:number;y:number} => p !== null).map((p) => `${p.x},${yf(p.y)}`).join(' ')}
				<polygon points={pts} fill={el.fill ?? '#f5f5f5'} stroke="#1a1a1a" stroke-width={sw} stroke-linejoin="round" stroke-dasharray={d(el)} />

			{:else if el.type === 'segment' && el.from && el.to}
				{@const a = resolvePoint(el.from, pm)}
				{@const b = resolvePoint(el.to, pm)}
				{#if a && b}
					<line x1={a.x} y1={yf(a.y)} x2={b.x} y2={yf(b.y)} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
					{#if el.label}
						{@const lp = segMid(el.from, el.to)}
						{#if lp}
							{@render lbl(lp.x, lp.y, el.label, measLabelFs, '500')}
						{/if}
					{/if}
				{/if}

			{:else if el.type === 'line' && el.through_points && el.through_points.length >= 2}
				{@const a = resolvePoint(el.through_points[0], pm)}
				{@const b = resolvePoint(el.through_points[1], pm)}
				{#if a && b}
					{@const ext = extLine(a, b)}
					<line x1={ext.x1} y1={yf(ext.y1)} x2={ext.x2} y2={yf(ext.y2)} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} marker-start="url(#ar)" marker-end="url(#ar)" />
				{/if}

			{:else if el.type === 'ray' && el.origin && el.through}
				{@const o = resolvePoint(el.origin, pm)}
				{@const t = resolvePoint(el.through, pm)}
				{#if o && t}
					{@const end = extRay(o, t)}
					<line x1={o.x} y1={yf(o.y)} x2={end.x} y2={yf(end.y)} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} marker-end="url(#ar)" />
				{/if}

			{:else if el.type === 'circle' && el.center}
				{@const c = resolvePoint(el.center, pm)}
				{#if c}
					{@const r = el.radius ?? (el.through ? (() => { const t = resolvePoint(el.through, pm); return t ? Math.hypot(t.x - c.x, t.y - c.y) : 1; })() : 1)}
					<circle cx={c.x} cy={yf(c.y)} r={r} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
				{/if}

			{:else if el.type === 'arc' && el.center && el.radius != null && el.start_angle != null && el.end_angle != null}
				{@const c = resolvePoint(el.center, pm)}
				{#if c}
					<path d={arcPath(c.x, yf(c.y), el.radius, el.start_angle, el.end_angle)} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
				{/if}

			{:else if el.type === 'curve' && el.curve_points}
				{@const pts = el.curve_points.map((p) => ({ x: p.x, y: yf(p.y) }))}
				<!-- Clip curves to viewBox to prevent asymptotes shooting to infinity -->
				<g clip-path={hasAxes ? 'url(#axes-clip)' : undefined}>
					{#if el.smooth}
						<path d={bezierPath(pts)} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
					{:else}
						<polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
					{/if}
				</g>

			{:else if el.type === 'angle_arc' && el.vertex && el.ray1_through && el.ray2_through}
				{@const r = el.radius ?? 0.7}
				{@const path = mkAngleArc(el.vertex, el.ray1_through, el.ray2_through, r)}
				{#if path}
					<path d={path} fill="none" stroke="#1a1a1a" stroke-width={sw * 0.7} />
					{#if el.label}
						{@const vRaw = resolvePoint(el.vertex, pm)}
						{@const p1Raw = resolvePoint(el.ray1_through, pm)}
						{@const p2Raw = resolvePoint(el.ray2_through, pm)}
						{@const v = vRaw ? { x: vRaw.x, y: yf(vRaw.y) } : null}
						{@const p1 = p1Raw ? { x: p1Raw.x, y: yf(p1Raw.y) } : null}
						{@const p2 = p2Raw ? { x: p2Raw.x, y: yf(p2Raw.y) } : null}
						{#if v && p1 && p2}
							{@const bis = angleBisector(v.x, v.y, p1.x, p1.y, p2.x, p2.y)}
							{@const lr = r + 0.5}
							{@render lbl(v.x + Math.cos(bis) * lr, v.y + Math.sin(bis) * lr, el.label, angleLabelFs, '500')}
						{/if}
					{/if}
				{/if}

			{:else if el.type === 'right_angle' && el.vertex && el.ray1_through && el.ray2_through}
				{@const path = mkRightAngle(el.vertex, el.ray1_through, el.ray2_through, el.size ?? 0.35)}
				{#if path}
					<path d={path} fill="none" stroke="#1a1a1a" stroke-width={sw * 0.7} />
				{/if}

			{:else if el.type === 'axes' && el.x_min != null && el.x_max != null && el.y_min != null && el.y_max != null}
				{@const xRange = el.x_max - el.x_min}
				{@const yRange = el.y_max - el.y_min}
				{@const rawTi = el.tick_interval ?? 1}
				{@const ti = xRange / rawTi > 20 ? Math.ceil(xRange / 10) : rawTi}
				{@const tickSize = Math.max(0.08, Math.min(0.15, xRange * 0.012))}
				{@const tickFs = Math.max(0.2, Math.min(0.4, xRange * 0.035))}
				{#if el.grid}
					{#each rng(el.x_min, el.x_max, ti) as x}
						<line x1={x} y1={yf(el.y_min)} x2={x} y2={yf(el.y_max)} stroke="#e5e5e5" stroke-width={sw * 0.4} />
					{/each}
					{#each rng(el.y_min, el.y_max, ti) as y}
						<line x1={el.x_min} y1={yf(y)} x2={el.x_max} y2={yf(y)} stroke="#e5e5e5" stroke-width={sw * 0.4} />
					{/each}
				{/if}
				<!-- X axis -->
				<line x1={el.x_min} y1={0} x2={el.x_max} y2={0} stroke="#1a1a1a" stroke-width={sw} marker-end="url(#ar)" />
				<!-- Y axis -->
				<line x1={0} y1={yf(el.y_min)} x2={0} y2={yf(el.y_max)} stroke="#1a1a1a" stroke-width={sw} marker-end="url(#ar)" />
				{#each rng(el.x_min, el.x_max, ti) as x}
					{#if x !== 0}
						<line x1={x} y1={-tickSize} x2={x} y2={tickSize} stroke="#1a1a1a" stroke-width={sw} />
						{@render lbl(x, tickSize + tickFs * 0.8, String(x), tickFs, '400')}
					{/if}
				{/each}
				{#each rng(el.y_min, el.y_max, ti) as y}
					{#if y !== 0}
						<line x1={-tickSize} y1={yf(y)} x2={tickSize} y2={yf(y)} stroke="#1a1a1a" stroke-width={sw} />
						{@render lbl(-tickSize - tickFs, yf(y), String(y), tickFs, '400')}
					{/if}
				{/each}

			{:else if el.type === 'number_line' && el.min != null && el.max != null && el.tick_interval}
				{@const nlY = diagram.height / 2}
				{@const sc = (diagram.width - 1) / (el.max - el.min)}
				{@const xO = 0.5}
				<line x1={xO} y1={nlY} x2={xO + (el.max - el.min) * sc} y2={nlY} stroke="#1a1a1a" stroke-width={sw} marker-end="url(#ar)" />
				{#each rng(el.min, el.max, el.tick_interval) as val}
					{@const tx = xO + (val - el.min) * sc}
					<line x1={tx} y1={nlY - 0.2} x2={tx} y2={nlY + 0.2} stroke="#1a1a1a" stroke-width={sw} />
					{@render lbl(tx, nlY + 0.45, String(val), measLabelFs * 0.7, '400')}
				{/each}
				{#if el.points}
					{#each el.points as pt}
						{@const px = xO + (pt.value - el.min) * sc}
						<circle cx={px} cy={nlY} r={pr * 1.3} fill={pt.filled !== false ? '#1a1a1a' : 'white'} stroke="#1a1a1a" stroke-width={sw} />
						{#if pt.label}
							{@render lbl(px, nlY - 0.45, pt.label, measLabelFs * 0.8, '500')}
						{/if}
					{/each}
				{/if}

			{:else if el.type === 'tick_marks' && el.segment_from && el.segment_to && el.count}
				{#each ticks(el.segment_from, el.segment_to, el.count) as m}
					<line x1={m.x - Math.cos(m.a) * 0.15} y1={m.y - Math.sin(m.a) * 0.15} x2={m.x + Math.cos(m.a) * 0.15} y2={m.y + Math.sin(m.a) * 0.15} stroke="#1a1a1a" stroke-width={sw} />
				{/each}

			{:else if el.type === 'parallel_marks' && el.segment_from && el.segment_to && el.count}
				{@const sp1 = resolvePoint(el.segment_from, pm)}
				{@const sp2 = resolvePoint(el.segment_to, pm)}
				{#if sp1 && sp2}
					{@const sa = Math.atan2(sp2.y - sp1.y, sp2.x - sp1.x)}
					{#each ticks(el.segment_from, el.segment_to, el.count) as m}
						<line x1={m.x - Math.cos(sa + 0.5) * 0.12} y1={m.y - Math.sin(sa + 0.5) * 0.12} x2={m.x} y2={m.y} stroke="#1a1a1a" stroke-width={sw * 0.8} />
						<line x1={m.x - Math.cos(sa - 0.5) * 0.12} y1={m.y - Math.sin(sa - 0.5) * 0.12} x2={m.x} y2={m.y} stroke="#1a1a1a" stroke-width={sw * 0.8} />
					{/each}
				{/if}

			{:else if el.type === 'point' && el.x != null && el.y != null}
				{@const pointR = hasAxes ? pr * 0.6 : pr}
				{@const pointFs = hasAxes ? measLabelFs : ptLabelFs}
				<circle cx={el.x} cy={yf(el.y)} r={pointR} fill={el.filled !== false ? '#1a1a1a' : 'white'} stroke="#1a1a1a" stroke-width={sw} />
				{#if el.label}
					{@const off = labelOffset(el.label_position)}
					{@render lbl(el.x + off.dx, yf(el.y) + off.dy, el.label, pointFs, hasAxes ? '500' : '700')}
				{/if}

			{:else if el.type === 'label' && el.x != null && el.y != null && el.text}
				{@render lbl(el.x, yf(el.y), el.text, el.font_size ? el.font_size * 0.08 : measLabelFs, '500')}

			<!-- 3D SHAPES -->
			{:else if el.type === 'rectangular_prism' && el.cx != null && el.cy != null && el.shape_width && el.shape_height && el.depth}
				{@const w = el.shape_width}
				{@const h = el.shape_height}
				{@const ox = oblX(el.depth)}
				{@const oy = oblY(el.depth)}
				{@const x0 = el.cx - w / 2}
				{@const y0 = el.cy - h / 2}
				<!-- Visible faces -->
				<polygon points={`${x0},${y0} ${x0 + w},${y0} ${x0 + w + ox},${y0 + oy} ${x0 + ox},${y0 + oy}`} fill="#f8f8f8" stroke="#1a1a1a" stroke-width={sw} />
				<polygon points={`${x0 + w},${y0} ${x0 + w},${y0 + h} ${x0 + w + ox},${y0 + h + oy} ${x0 + w + ox},${y0 + oy}`} fill="#f1f1f1" stroke="#1a1a1a" stroke-width={sw} />
				<rect x={x0} y={y0} width={w} height={h} fill="#ffffff" stroke="#1a1a1a" stroke-width={sw} />
				<!-- Hidden edges -->
				<line x1={x0 + ox} y1={y0 + oy} x2={x0 + ox} y2={y0 + h + oy} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<line x1={x0 + ox} y1={y0 + h + oy} x2={x0 + w + ox} y2={y0 + h + oy} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<line x1={x0} y1={y0 + h} x2={x0 + ox} y2={y0 + h + oy} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<!-- Dimension labels -->
				{#if dimLabel(el.dimension_labels, 'width')}
					<line x1={x0} y1={y0 + h + 0.25} x2={x0 + w} y2={y0 + h + 0.25} stroke="#1a1a1a" stroke-width={sw * 0.6} />
					{@render lbl(el.cx, y0 + h + 0.5, dimLabel(el.dimension_labels, 'width')!, measLabelFs, '500')}
				{/if}
				{#if dimLabel(el.dimension_labels, 'height')}
					<line x1={x0 - 0.2} y1={y0} x2={x0 - 0.2} y2={y0 + h} stroke="#1a1a1a" stroke-width={sw * 0.6} />
					{@render lbl(x0 - 0.5, el.cy, dimLabel(el.dimension_labels, 'height')!, measLabelFs, '500')}
				{/if}
				{#if dimLabel(el.dimension_labels, 'depth')}
					<line x1={x0 + w} y1={y0} x2={x0 + w + ox} y2={y0 + oy} stroke="#1a1a1a" stroke-width={sw * 0.6} />
					{@render lbl(x0 + w + ox / 2 + 0.4, y0 + oy / 2 - 0.3, dimLabel(el.dimension_labels, 'depth')!, measLabelFs, '500')}
				{/if}
				<!-- Vertex labels -->
				{#if el.vertex_labels}
					{#each Object.entries(el.vertex_labels) as [key, label]}
						{#if key === 'A'}{@render lbl(x0 - 0.3, y0 + h + 0.3, label, ptLabelFs, '600')}
						{:else if key === 'B'}{@render lbl(x0 + w + 0.3, y0 + h + 0.3, label, ptLabelFs, '600')}
						{:else if key === 'C'}{@render lbl(x0 + w + 0.3, y0 - 0.3, label, ptLabelFs, '600')}
						{:else if key === 'D'}{@render lbl(x0 - 0.3, y0 - 0.3, label, ptLabelFs, '600')}
						{:else if key === 'E'}{@render lbl(x0 + ox - 0.3, y0 + h + oy + 0.3, label, ptLabelFs, '600')}
						{:else if key === 'F'}{@render lbl(x0 + w + ox + 0.3, y0 + h + oy + 0.3, label, ptLabelFs, '600')}
						{:else if key === 'G'}{@render lbl(x0 + w + ox + 0.3, y0 + oy - 0.3, label, ptLabelFs, '600')}
						{:else if key === 'H'}{@render lbl(x0 + ox - 0.3, y0 + oy - 0.3, label, ptLabelFs, '600')}
						{/if}
					{/each}
				{/if}

			{:else if el.type === 'cylinder' && el.cx != null && el.cy != null && el.radius && el.shape_height}
				{@const r = el.radius}
				{@const h = el.shape_height}
				{@const ry = r * 0.3}
				{@const topY = el.cy - h / 2}
				{@const botY = el.cy + h / 2}
				<!-- Side lines -->
				<line x1={el.cx - r} y1={topY} x2={el.cx - r} y2={botY} stroke="#1a1a1a" stroke-width={sw} />
				<line x1={el.cx + r} y1={topY} x2={el.cx + r} y2={botY} stroke="#1a1a1a" stroke-width={sw} />
				<!-- Bottom ellipse (front half solid, back half dashed) -->
				<path d={ellipseArc(el.cx, botY, r, ry, 0, 180)} fill="none" stroke="#1a1a1a" stroke-width={sw} />
				<path d={ellipseArc(el.cx, botY, r, ry, 180, 360)} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<!-- Top ellipse (full, solid) -->
				<ellipse cx={el.cx} cy={topY} rx={r} ry={ry} fill="#f5f5f5" stroke="#1a1a1a" stroke-width={sw} />
				<!-- Labels -->
				{#if dimLabel(el.dimension_labels, 'radius')}
					<line x1={el.cx} y1={topY} x2={el.cx + r} y2={topY} stroke="#1a1a1a" stroke-width={sw * 0.6} />
					{@render lbl(el.cx + r / 2, topY - 0.35, dimLabel(el.dimension_labels, 'radius')!, measLabelFs, '500')}
				{/if}
				{#if dimLabel(el.dimension_labels, 'height')}
					<line x1={el.cx + r + 0.15} y1={topY} x2={el.cx + r + 0.15} y2={botY} stroke="#1a1a1a" stroke-width={sw * 0.6} />
					{@render lbl(el.cx + r + 0.5, el.cy, dimLabel(el.dimension_labels, 'height')!, measLabelFs, '500')}
				{/if}

			{:else if el.type === 'cone' && el.cx != null && el.cy != null && el.radius && el.shape_height}
				{@const r = el.radius}
				{@const h = el.shape_height}
				{@const ry = r * 0.3}
				{@const botY = el.cy + h / 2}
				{@const topY = el.cy - h / 2}
				<!-- Slant lines -->
				<line x1={el.cx} y1={topY} x2={el.cx - r} y2={botY} stroke="#1a1a1a" stroke-width={sw} />
				<line x1={el.cx} y1={topY} x2={el.cx + r} y2={botY} stroke="#1a1a1a" stroke-width={sw} />
				<!-- Base ellipse (front solid, back dashed) -->
				<path d={ellipseArc(el.cx, botY, r, ry, 0, 180)} fill="none" stroke="#1a1a1a" stroke-width={sw} />
				<path d={ellipseArc(el.cx, botY, r, ry, 180, 360)} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<!-- Apex dot -->
				<circle cx={el.cx} cy={topY} r={pr * 0.8} fill="#1a1a1a" />
				<!-- Labels -->
				{#if dimLabel(el.dimension_labels, 'radius')}
					<line x1={el.cx} y1={botY} x2={el.cx + r} y2={botY} stroke="#1a1a1a" stroke-width={sw * 0.6} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
					{@render lbl(el.cx + r / 2, botY + 0.5, dimLabel(el.dimension_labels, 'radius')!, measLabelFs, '500')}
				{/if}
				{#if dimLabel(el.dimension_labels, 'height')}
					<line x1={el.cx} y1={topY} x2={el.cx} y2={botY} stroke="#1a1a1a" stroke-width={sw * 0.6} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
					{@render lbl(el.cx - 0.6, el.cy, dimLabel(el.dimension_labels, 'height')!, measLabelFs, '500')}
				{/if}
				{#if dimLabel(el.dimension_labels, 'slant')}
					<line x1={el.cx} y1={topY} x2={el.cx + r} y2={botY} stroke="#1a1a1a" stroke-width={sw * 0.6} />
					{@render lbl(el.cx + r / 2 + 0.3, el.cy - 0.2, dimLabel(el.dimension_labels, 'slant')!, measLabelFs, '500')}
				{/if}

			{:else if el.type === 'sphere' && el.cx != null && el.cy != null && el.radius}
				{@const r = el.radius}
				<!-- Main circle -->
				<circle cx={el.cx} cy={el.cy} r={r} fill="#f5f5f5" stroke="#1a1a1a" stroke-width={sw} />
				<!-- Equator ellipse -->
				<path d={ellipseArc(el.cx, el.cy, r, r * 0.3, 0, 180)} fill="none" stroke="#1a1a1a" stroke-width={sw * 0.6} />
				<path d={ellipseArc(el.cx, el.cy, r, r * 0.3, 180, 360)} fill="none" stroke="#1a1a1a" stroke-width={sw * 0.6} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<!-- Center dot -->
				<circle cx={el.cx} cy={el.cy} r={pr * 0.6} fill="#1a1a1a" />
				<!-- Radius line -->
				{#if dimLabel(el.dimension_labels, 'radius')}
					<line x1={el.cx} y1={el.cy} x2={el.cx + r} y2={el.cy} stroke="#1a1a1a" stroke-width={sw * 0.6} />
					{@render lbl(el.cx + r / 2, el.cy - 0.35, dimLabel(el.dimension_labels, 'radius')!, measLabelFs, '500')}
				{/if}

			{:else if el.type === 'pyramid' && el.cx != null && el.cy != null && el.shape_width && el.shape_height && el.depth}
				{@const bw = el.shape_width}
				{@const bd = el.depth}
				{@const h = el.shape_height}
				{@const ox2 = oblX(bd)}
				{@const oy2 = oblY(bd)}
				{@const botY = el.cy + h / 2}
				{@const topY = el.cy - h / 2}
				<!-- Base (front edge solid, back edges dashed) -->
				<line x1={el.cx - bw / 2} y1={botY} x2={el.cx + bw / 2} y2={botY} stroke="#1a1a1a" stroke-width={sw} />
				<line x1={el.cx - bw / 2} y1={botY} x2={el.cx - bw / 2 + ox2} y2={botY + oy2} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<line x1={el.cx + bw / 2} y1={botY} x2={el.cx + bw / 2 + ox2} y2={botY + oy2} stroke="#1a1a1a" stroke-width={sw} />
				<line x1={el.cx - bw / 2 + ox2} y1={botY + oy2} x2={el.cx + bw / 2 + ox2} y2={botY + oy2} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<!-- Edges to apex -->
				<line x1={el.cx - bw / 2} y1={botY} x2={el.cx + ox2 / 2} y2={topY} stroke="#1a1a1a" stroke-width={sw} />
				<line x1={el.cx + bw / 2} y1={botY} x2={el.cx + ox2 / 2} y2={topY} stroke="#1a1a1a" stroke-width={sw} />
				<line x1={el.cx + bw / 2 + ox2} y1={botY + oy2} x2={el.cx + ox2 / 2} y2={topY} stroke="#1a1a1a" stroke-width={sw} />
				<line x1={el.cx - bw / 2 + ox2} y1={botY + oy2} x2={el.cx + ox2 / 2} y2={topY} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
				<!-- Apex dot -->
				<circle cx={el.cx + ox2 / 2} cy={topY} r={pr * 0.8} fill="#1a1a1a" />
				<!-- Labels -->
				{#if dimLabel(el.dimension_labels, 'height')}
					<line x1={el.cx + ox2 / 2} y1={topY} x2={el.cx + ox2 / 2} y2={botY} stroke="#1a1a1a" stroke-width={sw * 0.6} stroke-dasharray={`${sw * 5} ${sw * 3}`} />
					{@render lbl(el.cx + ox2 / 2 - 0.6, el.cy, dimLabel(el.dimension_labels, 'height')!, measLabelFs, '500')}
				{/if}
				{#if dimLabel(el.dimension_labels, 'base')}
					<line x1={el.cx - bw / 2} y1={botY + 0.2} x2={el.cx + bw / 2} y2={botY + 0.2} stroke="#1a1a1a" stroke-width={sw * 0.6} />
					{@render lbl(el.cx, botY + 0.5, dimLabel(el.dimension_labels, 'base')!, measLabelFs, '500')}
				{/if}
			{/if}
		{/each}
		<defs>
			{#if hasAxes}
				<clipPath id="axes-clip">
					<rect x={axesEl!.x_min! - 0.5} y={yf(axesEl!.y_max!) - 0.5} width={axesEl!.x_max! - axesEl!.x_min! + 1} height={axesEl!.y_max! - axesEl!.y_min! + 1} />
				</clipPath>
			{/if}
			<marker id="ar" markerWidth={hasAxes ? 0.4 : 8} markerHeight={hasAxes ? 0.3 : 6} refX={hasAxes ? 0.35 : 7} refY={hasAxes ? 0.15 : 3} orient="auto" markerUnits={hasAxes ? 'userSpaceOnUse' : 'strokeWidth'}>
				<polygon points={hasAxes ? '0 0, 0.4 0.15, 0 0.3' : '0 0, 8 3, 0 6'} fill="#1a1a1a" />
			</marker>
		</defs>
	</svg>
{/if}
