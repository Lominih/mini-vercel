const attempts = new Map<string, { count: number; lockoutUntil?: number }>();
const MAX = 5; const DURATIONS = [1, 5, 15, 30];
export function recordFailedAttempt(email: string) {
  const now = Date.now(); const r = attempts.get(email);
  if (r?.lockoutUntil && now < r.lockoutUntil) return { locked: true, attemptsRemaining: 0, lockoutMinutes: Math.ceil((r.lockoutUntil - now) / 60000) };
  const rec = r || { count: 0 }; rec.count++;
  if (rec.count >= MAX) { const d = DURATIONS[Math.min(Math.floor((rec.count - MAX) / MAX), DURATIONS.length - 1)] * 60000; rec.lockoutUntil = now + d; attempts.set(email, rec); return { locked: true, attemptsRemaining: 0, lockoutMinutes: Math.ceil(d / 60000) }; }
  attempts.set(email, rec); return { locked: false, attemptsRemaining: MAX - rec.count };
}
export function isLocked(email: string): boolean { const r = attempts.get(email); if (!r?.lockoutUntil) return false; if (Date.now() >= r.lockoutUntil) { attempts.delete(email); return false; } return true; }
export function resetAttempts(email: string): void { attempts.delete(email); }