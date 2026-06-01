export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.round(sec || 0))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtAgo(ts: number): string {
  const diff = Date.now() - ts
  const h = diff / 3600000
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}分前`
  if (h < 24) return `${Math.round(h)}時間前`
  const d = Math.round(h / 24)
  return `${d}日前`
}

export function rng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

export function waveBars(seed: number, n: number): number[] {
  const r = rng((seed || 1) * 97 + 13)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / n
    const env = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.7 + 0.3 * r())
    const detail = 0.55 + 0.45 * r()
    out.push(Math.max(0.08, Math.min(1, env * detail)))
  }
  return out
}

export function hue(h: number): string {
  return `oklch(0.78 0.13 ${h})`
}
