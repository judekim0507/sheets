<script lang="ts">
	import type { DiagramSceneGraph, DiagramElement } from '$lib/data/types';
	import {
		buildPointMap, resolvePoint, sortElementsByLayer,
		extendLineToViewBox, extendRayToViewBox,
		arcPath, perpOffset, bezierPath, labelOffset, angleBisector,
		type PointMap
	} from '$lib/diagram/renderer';

	let { diagram }: { diagram: DiagramSceneGraph } = $props();

	const pad = 1;
	const sw = 0.07;
	const pr = 0.12;
	const ptLabelFs = 0.65;
	const measLabelFs = 0.5;
	const angleLabelFs = 0.45;

	const vb = $derived(`${-pad} ${-pad} ${diagram.width + pad * 2} ${diagram.height + pad * 2}`);
	const pm: PointMap = $derived(buildPointMap(diagram.elements));
	const sorted: DiagramElement[] = $derived(sortElementsByLayer(diagram.elements));

	function d(el: { style?: string }): string | undefined {
		return el.style === 'dashed' ? `${sw * 5} ${sw * 3}` : undefined;
	}

	function segMid(fId: string, tId: string) {
		const a = resolvePoint(fId, pm), b = resolvePoint(tId, pm);
		if (!a || !b) return null;
		return perpOffset(a.x, a.y, b.x, b.y, 0.45);
	}

	function mkAngleArc(vId: string, r1Id: string, r2Id: string, r: number): string {
		const v = resolvePoint(vId, pm), p1 = resolvePoint(r1Id, pm), p2 = resolvePoint(r2Id, pm);
		if (!v || !p1 || !p2) return '';
		const a1 = Math.atan2(p1.y - v.y, p1.x - v.x) * (180 / Math.PI);
		const a2 = Math.atan2(p2.y - v.y, p2.x - v.x) * (180 / Math.PI);
		return arcPath(v.x, v.y, r, a1, a2);
	}

	function mkRightAngle(vId: string, r1Id: string, r2Id: string, sz: number): string {
		const v = resolvePoint(vId, pm), p1 = resolvePoint(r1Id, pm), p2 = resolvePoint(r2Id, pm);
		if (!v || !p1 || !p2) return '';
		const d1x = p1.x - v.x, d1y = p1.y - v.y, d2x = p2.x - v.x, d2y = p2.y - v.y;
		const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
		if (l1 === 0 || l2 === 0) return '';
		const u1x = (d1x / l1) * sz, u1y = (d1y / l1) * sz;
		const u2x = (d2x / l2) * sz, u2y = (d2y / l2) * sz;
		return `M ${v.x + u1x} ${v.y + u1y} L ${v.x + u1x + u2x} ${v.y + u1y + u2y} L ${v.x + u2x} ${v.y + u2y}`;
	}

	function ticks(fId: string, tId: string, n: number) {
		const a = resolvePoint(fId, pm), b = resolvePoint(tId, pm);
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
</script>

{#snippet lbl(x: number, y: number, text: string, size: number, weight: string = '600')}
	<text x={x} y={y} text-anchor="middle" dominant-baseline="central" font-size={size} font-weight={weight} fill="white" stroke="white" stroke-width={size * 0.4} stroke-linejoin="round" font-family="sans-serif">{text}</text>
	<text x={x} y={y} text-anchor="middle" dominant-baseline="central" font-size={size} font-weight={weight} fill="#1a1a1a" font-family="sans-serif">{text}</text>
{/snippet}

{#if diagram?.elements}
	<svg viewBox={vb} class="diagram-svg w-full max-w-[240px]" style="height: auto;" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mathematical diagram">
		{#each sorted as el}
			{#if el.type === 'polygon' && el.vertices}
				{@const pts = el.vertices.map((id) => resolvePoint(id, pm)).filter((p): p is {x:number;y:number} => p !== null).map((p) => `${p.x},${p.y}`).join(' ')}
				<polygon points={pts} fill="#f5f5f5" stroke="#1a1a1a" stroke-width={sw} stroke-linejoin="round" stroke-dasharray={d(el)} />

			{:else if el.type === 'segment' && el.from && el.to}
				{@const a = resolvePoint(el.from, pm)}
				{@const b = resolvePoint(el.to, pm)}
				{#if a && b}
					<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
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
					{@const ext = extendLineToViewBox(a, b, diagram.width, diagram.height)}
					<line x1={ext.x1} y1={ext.y1} x2={ext.x2} y2={ext.y2} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} marker-start="url(#ar)" marker-end="url(#ar)" />
				{/if}

			{:else if el.type === 'ray' && el.origin && el.through}
				{@const o = resolvePoint(el.origin, pm)}
				{@const t = resolvePoint(el.through, pm)}
				{#if o && t}
					{@const end = extendRayToViewBox(o, t, diagram.width, diagram.height)}
					<line x1={o.x} y1={o.y} x2={end.x} y2={end.y} stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} marker-end="url(#ar)" />
				{/if}

			{:else if el.type === 'circle' && el.center}
				{@const c = resolvePoint(el.center, pm)}
				{#if c}
					{@const r = el.radius ?? (el.through ? (() => { const t = resolvePoint(el.through, pm); return t ? Math.hypot(t.x - c.x, t.y - c.y) : 1; })() : 1)}
					<circle cx={c.x} cy={c.y} r={r} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
				{/if}

			{:else if el.type === 'arc' && el.center && el.radius != null && el.start_angle != null && el.end_angle != null}
				{@const c = resolvePoint(el.center, pm)}
				{#if c}
					<path d={arcPath(c.x, c.y, el.radius, el.start_angle, el.end_angle)} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
				{/if}

			{:else if el.type === 'curve' && el.curve_points}
				{#if el.smooth}
					<path d={bezierPath(el.curve_points)} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
				{:else}
					<polyline points={el.curve_points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1a1a1a" stroke-width={sw} stroke-dasharray={d(el)} />
				{/if}

			{:else if el.type === 'angle_arc' && el.vertex && el.ray1_through && el.ray2_through}
				{@const r = el.radius ?? 0.7}
				{@const path = mkAngleArc(el.vertex, el.ray1_through, el.ray2_through, r)}
				{#if path}
					<path d={path} fill="none" stroke="#1a1a1a" stroke-width={sw * 0.7} />
					{#if el.label}
						{@const v = resolvePoint(el.vertex, pm)}
						{@const p1 = resolvePoint(el.ray1_through, pm)}
						{@const p2 = resolvePoint(el.ray2_through, pm)}
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
				{@const ti = el.tick_interval ?? 1}
				{#if el.grid}
					{#each rng(el.x_min, el.x_max, ti) as x}
						<line x1={x} y1={el.y_min} x2={x} y2={el.y_max} stroke="#e5e5e5" stroke-width={sw * 0.4} />
					{/each}
					{#each rng(el.y_min, el.y_max, ti) as y}
						<line x1={el.x_min} y1={y} x2={el.x_max} y2={y} stroke="#e5e5e5" stroke-width={sw * 0.4} />
					{/each}
				{/if}
				<line x1={el.x_min} y1={0} x2={el.x_max} y2={0} stroke="#1a1a1a" stroke-width={sw} marker-end="url(#ar)" />
				<line x1={0} y1={el.y_max} x2={0} y2={el.y_min} stroke="#1a1a1a" stroke-width={sw} marker-end="url(#ar)" />
				{#each rng(el.x_min, el.x_max, ti) as x}
					{#if x !== 0}
						<line x1={x} y1={-0.1} x2={x} y2={0.1} stroke="#1a1a1a" stroke-width={sw} />
						{@render lbl(x, 0.4, String(x), measLabelFs * 0.7, '400')}
					{/if}
				{/each}
				{#each rng(el.y_min, el.y_max, ti) as y}
					{#if y !== 0}
						<line x1={-0.1} y1={y} x2={0.1} y2={y} stroke="#1a1a1a" stroke-width={sw} />
						{@render lbl(-0.4, y, String(y), measLabelFs * 0.7, '400')}
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
				<circle cx={el.x} cy={el.y} r={pr} fill={el.filled !== false ? '#1a1a1a' : 'white'} stroke="#1a1a1a" stroke-width={sw} />
				{#if el.label}
					{@const off = labelOffset(el.label_position)}
					{@render lbl(el.x + off.dx, el.y + off.dy, el.label, ptLabelFs, '700')}
				{/if}

			{:else if el.type === 'label' && el.x != null && el.y != null && el.text}
				{@render lbl(el.x, el.y, el.text, el.font_size ? el.font_size * 0.08 : measLabelFs, '500')}
			{/if}
		{/each}
		<defs>
			<marker id="ar" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
				<polygon points="0 0, 8 3, 0 6" fill="#1a1a1a" />
			</marker>
		</defs>
	</svg>
{/if}
