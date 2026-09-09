export type NoiseSchedule = {
  T: number;
  betas: Float32Array;
  alphas: Float32Array;
  alphaBar: Float32Array;
};

/** Cosine schedule (Nichol & Dhariwal). alphaBar[T-1] ≈ 0 so x_T is real noise. */
export function makeSchedule(T: number): NoiseSchedule {
  const s = 0.008;
  const f = (t: number) => {
    const x = (t / T + s) / (1 + s);
    const c = Math.cos((x * Math.PI) / 2);
    return c * c;
  };
  const f0 = f(0);
  const betas = new Float32Array(T);
  const alphas = new Float32Array(T);
  const alphaBar = new Float32Array(T);
  let prev = 1;
  for (let i = 0; i < T; i++) {
    let ab = f(i + 1) / f0;
    ab = Math.min(Math.max(ab, 0.002), 0.999);
    alphaBar[i] = ab;
    const a = Math.min(Math.max(ab / prev, 0.001), 0.999);
    alphas[i] = a;
    betas[i] = 1 - a;
    prev = ab;
  }
  return { T, betas, alphas, alphaBar };
}

export function ddimTimesteps(T: number, steps: number): number[] {
  if (steps <= 1) return [Math.max(0, T - 1)];
  const n = Math.max(2, Math.min(steps, T));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = Math.round((T - 1) * (1 - i / (n - 1)));
    if (out.length === 0 || out[out.length - 1] !== t) out.push(t);
  }
  if (out[out.length - 1] !== 0) out.push(0);
  return out;
}
