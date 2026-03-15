const requests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

export function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const timestamps = requests.get(ip) ?? [];
	const recent = timestamps.filter((t) => now - t < WINDOW_MS);
	if (recent.length >= MAX_PER_WINDOW) return false;
	recent.push(now);
	requests.set(ip, recent);
	return true;
}
