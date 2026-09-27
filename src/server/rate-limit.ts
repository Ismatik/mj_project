import "server-only";

// Simple in-memory limiter for sign-in attempts (one web process per server).
const attempts = new Map<string, { count: number; resetAt: number }>();

export function tooManyAttempts(key: string, max = 8, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
