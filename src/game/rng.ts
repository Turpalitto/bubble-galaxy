/** Deterministic PRNG (mulberry32) so levels & daily are identical for everyone. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

export type Rng = ReturnType<typeof createRng>;

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Days since launch, used as "Daily #N" */
export function dailyIndex(d = new Date()): number {
  const epoch = Date.UTC(2025, 0, 1);
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((now - epoch) / 86400000) + 1;
}

export function msUntilNextDay(d = new Date()): number {
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - d.getTime();
}
