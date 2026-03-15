export interface CostEstimate {
	inputTokens: number;
	outputTokens: number;
	totalUSD: number | null;
	formatted: string;
	live: boolean;
}

// Client-side cache: key = "modelId:questions:skills"
const cache = new Map<string, { data: CostEstimate; at: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min client cache

const pending = new Map<string, Promise<CostEstimate>>();

export async function fetchCostEstimate(
	modelId: string,
	questionCount: number,
	skillCount: number
): Promise<CostEstimate> {
	const key = `${modelId}:${questionCount}:${skillCount}`;

	// Check cache
	const cached = cache.get(key);
	if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

	// Deduplicate in-flight requests
	if (pending.has(key)) return pending.get(key)!;

	const promise = (async () => {
		try {
			const params = new URLSearchParams({
				model: modelId,
				questions: String(questionCount),
				skills: String(skillCount)
			});
			const res = await fetch(`/api/estimate?${params}`);
			if (!res.ok) throw new Error();
			const data = await res.json();

			const estimate: CostEstimate = {
				inputTokens: data.inputTokens,
				outputTokens: data.outputTokens,
				totalUSD: data.totalUSD,
				formatted: data.totalUSD != null ? formatCost(data.totalUSD) : '—',
				live: data.live ?? false
			};

			cache.set(key, { data: estimate, at: Date.now() });
			return estimate;
		} catch {
			return { inputTokens: 0, outputTokens: 0, totalUSD: null, formatted: '—', live: false };
		} finally {
			pending.delete(key);
		}
	})();

	pending.set(key, promise);
	return promise;
}

function formatCost(usd: number): string {
	if (usd < 0.005) return '< 1¢';
	if (usd < 0.01) return `~${(usd * 100).toFixed(1)}¢`;
	if (usd < 1) return `~${(usd * 100).toFixed(0)}¢`;
	return `~$${usd.toFixed(2)}`;
}
