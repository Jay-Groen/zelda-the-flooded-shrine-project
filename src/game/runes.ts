import { CanvasTexture, SRGBColorSpace } from 'three'
import { WATER_LEVELS } from './constants'
import { live, useGame } from './store'
import { FINALE } from './sun'

/**
 * Glow (0..~1.5) of each level's rune. Written once per frame by LevelRunes,
 * read by anything that shows the same symbols (the pedestal).
 */
export const runeGlow = WATER_LEVELS.map(() => 0)

/** Level the switch would move to if the hovered button were clicked, or -1. */
export function previewLevel() {
  const { level, hover } = useGame.getState()
  const t = hover === 'up' ? level + 1 : hover === 'down' ? level - 1 : -1
  return t >= 0 && t < WATER_LEVELS.length ? t : -1
}

/** Smoothly update runeGlow from the water level, the switch target and the hover preview. */
export function updateRuneGlow(time: number, dt: number) {
  const { level } = useGame.getState()
  const preview = previewLevel()
  const moving = Math.abs(live.waterY - WATER_LEVELS[level]) > 0.05
  WATER_LEVELS.forEach((y, i) => {
    const near = 1 - Math.min(1, Math.abs(live.waterY - y) / 0.8)
    let target = 0.12 + 0.85 * near
    if (i === level && moving) target = Math.max(target, 0.65 + 0.35 * Math.sin(time * 6))
    if (i === preview) target = Math.max(target, 1.05 + 0.45 * Math.sin(time * 8))
    // Finale: the runes flare one after another, low to high, as the shrine wakes.
    const flareAt = FINALE.runeCascade + i * 0.28
    if (live.chestT >= flareAt) target = Math.max(target, 1.5 * Math.exp(-(live.chestT - flareAt) * 1.6))
    runeGlow[i] += (target - runeGlow[i]) * (1 - Math.exp(-10 * dt))
  })
}

function makeCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  return [canvas, canvas.getContext('2d')!] as const
}

const glyphCache = new Map<number, CanvasTexture>()

/** Original shrine glyph: a ring holding one, two or three waves. */
export function glyphTexture(level: number) {
  const cached = glyphCache.get(level)
  if (cached) return cached
  const [canvas, ctx] = makeCanvas(256)
  ctx.strokeStyle = '#fff'
  ctx.lineCap = 'round'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 10

  ctx.lineWidth = 11
  ctx.beginPath()
  ctx.arc(128, 128, 100, 0, Math.PI * 2)
  ctx.stroke()
  // notch at the top, pointing the eye upward
  ctx.beginPath()
  ctx.moveTo(108, 22)
  ctx.lineTo(128, 6)
  ctx.lineTo(148, 22)
  ctx.stroke()

  ctx.lineWidth = 12
  const count = level + 1
  for (let i = 0; i < count; i++) {
    const y = 128 + (i - (count - 1) / 2) * 38
    ctx.beginPath()
    for (let x = 62; x <= 194; x += 2) {
      const yy = y + Math.sin(((x - 62) / 132) * Math.PI * 3) * 9
      if (x === 62) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  glyphCache.set(level, tex)
  return tex
}

let halo: CanvasTexture | null = null

export function haloTexture() {
  if (halo) return halo
  const [canvas, ctx] = makeCanvas(128)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  halo = new CanvasTexture(canvas)
  halo.colorSpace = SRGBColorSpace
  return halo
}
