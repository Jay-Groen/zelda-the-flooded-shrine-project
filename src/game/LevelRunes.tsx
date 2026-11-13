import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, MathUtils, MeshBasicMaterial, type Group, type Mesh } from 'three'
import { WATER_LEVELS } from './constants'
import { glyphTexture, haloTexture, previewLevel, runeGlow, updateRuneGlow } from './runes'

const RUNE_COLOR = new Color('#7ff0ff')
/** Terrace face (z = -5), facing the camera. */
const FACE_Z = -4.97
const RUNE_X = 0
const LINE_HALF_WIDTH = 4.9
const GAP = 1.0
/** Glyph sits just above its tide line, like marks on a depth gauge. */
const GLYPH_LIFT = 0.75

const glowMaterial = (map: ReturnType<typeof glyphTexture> | null) =>
  new MeshBasicMaterial({
    map,
    color: RUNE_COLOR,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })

/**
 * A carved rune and a tide line on the terrace face at every water level.
 * The level the water sits at glows, the switch's destination pulses while the
 * water travels, and hovering ▲/▼ previews the level the click would select.
 */
export function LevelRunes() {
  const mats = useMemo(
    () =>
      WATER_LEVELS.map((_, i) => ({
        glyph: glowMaterial(glyphTexture(i)),
        halo: glowMaterial(haloTexture()),
        line: glowMaterial(null),
      })),
    [],
  )
  const ghost = useRef<Mesh>(null)
  const glyphs = useRef<(Group | null)[]>([])
  const ghostMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: RUNE_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    updateRuneGlow(t, dt)
    const preview = previewLevel()
    mats.forEach((m, i) => {
      const g = runeGlow[i]
      const glyph = glyphs.current[i]
      if (glyph) {
        const target = i === preview ? 1.35 + 0.08 * Math.sin(t * 8) : 1
        glyph.scale.setScalar(MathUtils.damp(glyph.scale.x, target, 12, dt))
      }
      m.glyph.opacity = Math.min(1, 0.25 + g)
      m.glyph.color.copy(RUNE_COLOR).multiplyScalar(0.35 + g)
      m.halo.opacity = g * 0.6
      m.line.opacity = Math.min(1, 0.18 + g * 0.8)
    })

    // Ghost surface at the previewed level.
    if (ghost.current) {
      ghost.current.visible = preview >= 0
      if (preview >= 0) ghost.current.position.y = WATER_LEVELS[preview]
    }
    ghostMat.opacity = preview >= 0 ? 0.2 + 0.08 * Math.sin(t * 8) : 0
  })

  const lineLength = LINE_HALF_WIDTH - GAP
  return (
    <group>
      {WATER_LEVELS.map((y, i) => (
        <group key={i} position={[RUNE_X, y, FACE_Z]}>
          <group ref={(g) => void (glyphs.current[i] = g)} position-y={GLYPH_LIFT}>
            <mesh material={mats[i].halo} renderOrder={3}>
              <planeGeometry args={[2.8, 2.8]} />
            </mesh>
            <mesh material={mats[i].glyph} renderOrder={3}>
              <planeGeometry args={[1.3, 1.3]} />
            </mesh>
          </group>
          {[-1, 1].map((side) => (
            <mesh key={side} material={mats[i].line} position-x={side * (GAP + lineLength / 2)} renderOrder={3}>
              <planeGeometry args={[lineLength, 0.09]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh ref={ghost} material={ghostMat} rotation-x={-Math.PI / 2} renderOrder={4} visible={false}>
        <planeGeometry args={[20, 20]} />
      </mesh>
    </group>
  )
}
