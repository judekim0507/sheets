const requests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
let lastCleanup = Date.now();

export function checkRateLimit(ip: string): boolean {
	const now = Date.now();

	// Periodic cleanup — clear stale entries every 5 minutes
	if (now - lastCleanup > 300_000) {
		for (const [key, timestamps] of requests) {
			const recent = timestamps.filter((t) => now - t < WINDOW_MS);
			if (recent.length === 0) requests.delete(key);
			else requests.set(key, recent);
		}
		lastCleanup = now;
	}

	const timestamps = requests.get(ip) ?? [];
	const recent = timestamps.filter((t) => now - t < WINDOW_MS);
	if (recent.length >= MAX_PER_WINDOW) return false;
	recent.push(now);
	requests.set(ip, recent);
	return true;
}
