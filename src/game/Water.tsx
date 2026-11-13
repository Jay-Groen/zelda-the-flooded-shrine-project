import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, PlaneGeometry, type Mesh } from 'three'
import { WATER_LEVELS, WATER_SPEED } from './constants'
import { live, useGame } from './store'
import { waterUniforms } from './shaders/common'
import { createWaterMaterial } from './shaders/waterMaterial'

/** Walls dry out (the wet band sinks) at this many units per second. */
const DRY_SPEED = 0.12
const PLAYER_HALF = 0.9

/**
 * Moves the waterline toward the switch's target at a constant speed.
 * Everything else (platform, buoyancy, wall shaders) reads this one number.
 */
export function Water() {
  const main = useRef<Mesh>(null)
  const niche = useRef<Mesh>(null)
  const material = useMemo(createWaterMaterial, [])
  const mainGeo = useMemo(() => new PlaneGeometry(20, 20, 160, 160).rotateX(-Math.PI / 2), [])
  const nicheGeo = useMemo(() => new PlaneGeometry(2.5, 2.5, 20, 20).rotateX(-Math.PI / 2), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const target = WATER_LEVELS[useGame.getState().level]
    const step = WATER_SPEED * dt
    const before = live.waterY
    live.waterY += MathUtils.clamp(target - live.waterY, -step, step)
    const velocity = dt > 0 ? (live.waterY - before) / dt / WATER_SPEED : 0

    const u = waterUniforms
    u.uTime.value += dt
    u.uWaterY.value = live.waterY
    u.uWetY.value = Math.max(live.waterY, u.uWetY.value - DRY_SPEED * dt)
    u.uFlow.value = MathUtils.damp(u.uFlow.value, velocity, 4, dt)
    u.uPlayer.value.copy(live.playerPos)

    // Ripples when the waterline cuts through the player.
    const p = live.playerPos
    const touching = live.waterY > p.y - PLAYER_HALF && live.waterY < p.y + PLAYER_HALF
    const moving = live.moveDir.lengthSq() > 0
    const ripple = touching ? (moving ? 1 : 0.35) : 0
    u.uRipple.value = MathUtils.damp(u.uRipple.value, ripple, 3, dt)

    if (main.current) main.current.position.y = live.waterY
    if (niche.current) niche.current.position.y = live.waterY
  }, -1) // run before the platform and player read it

  return (
    <>
      <mesh ref={main} geometry={mainGeo} material={material} renderOrder={2} raycast={() => null} />
      <mesh
        ref={niche}
        geometry={nicheGeo}
        material={material}
        position={[11.25, live.waterY, -1.25]}
        renderOrder={2}
        raycast={() => null}
      />
    </>
  )
}
