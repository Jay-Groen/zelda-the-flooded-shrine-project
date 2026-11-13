import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { MathUtils, Vector3 } from 'three'
import {
  ALCOVE_CELL,
  PLATFORM_FLOAT_OFFSET,
  PLATFORM_HALF,
  PLATFORM_REST_Y,
  PUSH_DELAY,
  PUSH_SPEED,
  TUNNEL_X,
  WATER_LEVELS,
  cellX,
  cellZ,
  isCellAllowed,
  type Cell,
} from './constants'
import { live, useGame } from './store'
import { stoneMaterial } from './shaders/stoneMaterial'

/** Platform height is a pure function of the water level and where it stands. */
export function platformY(x: number, waterY: number) {
  const underTunnelCeiling = x + PLATFORM_HALF.x > TUNNEL_X[0] && x - PLATFORM_HALF.x < TUNNEL_X[1]
  if (underTunnelCeiling) return PLATFORM_REST_Y
  return Math.max(PLATFORM_REST_Y, waterY + PLATFORM_FLOAT_OFFSET)
}

const startPos = () =>
  new Vector3(cellX(ALCOVE_CELL[0]), platformY(cellX(ALCOVE_CELL[0]), live.waterY), cellZ(ALCOVE_CELL[1]))

export function Platform() {
  const body = useRef<RapierRigidBody>(null)
  const pos = useRef(startPos())
  const pushTime = useRef(0)
  const resetId = useGame((s) => s.resetId)

  useEffect(() => {
    if (resetId === 0) return
    pos.current.copy(startPos())
    body.current?.setTranslation(pos.current, true)
  }, [resetId])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const { platformCell: cell, level, setPlatformCell } = useGame.getState()
    const p = pos.current

    // Slide horizontally toward the current cell.
    const tx = cellX(cell[0])
    const tz = cellZ(cell[1])
    const step = PUSH_SPEED * dt
    p.x += MathUtils.clamp(tx - p.x, -step, step)
    p.z += MathUtils.clamp(tz - p.z, -step, step)
    const sliding = Math.abs(tx - p.x) > 1e-3 || Math.abs(tz - p.z) > 1e-3

    p.y = platformY(p.x, live.waterY)
    body.current?.setNextKinematicTranslation(p)
    live.platformPos.copy(p)

    // Pushing: only when the pool is drained and the block rests on the floor.
    const drained = level === 0 && Math.abs(live.waterY - WATER_LEVELS[0]) < 0.05
    let dir: Cell | null = null
    if (!sliding && drained && live.grounded && live.playerPos.y < -1.2) {
      const dx = live.playerPos.x - p.x
      const dz = live.playerPos.z - p.z
      const m = live.moveDir
      const reach = PLATFORM_HALF.x + 0.4 + 0.3
      if (Math.abs(dx) >= Math.abs(dz)) {
        if (Math.abs(dx) < reach && Math.abs(dz) < 1.0 && m.x * dx < 0 && Math.abs(m.x) > 0.6) {
          dir = [-Math.sign(dx), 0]
        }
      } else if (Math.abs(dz) < reach && Math.abs(dx) < 1.0 && m.y * dz < 0 && Math.abs(m.y) > 0.6) {
        dir = [0, -Math.sign(dz)]
      }
    }

    live.pushing = dir !== null
    if (dir) {
      pushTime.current += dt
      if (pushTime.current > PUSH_DELAY) {
        pushTime.current = 0
        const next: Cell = [cell[0] + dir[0], cell[1] + dir[1]]
        if (isCellAllowed(next)) setPlatformCell(next)
      }
    } else {
      pushTime.current = 0
    }
  })

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={pos.current.toArray()}>
      <CuboidCollider args={[PLATFORM_HALF.x, PLATFORM_HALF.y, PLATFORM_HALF.z]} />
      <mesh material={stoneMaterial('#b8a882', { moss: 0.6, blocks: 0 })} castShadow receiveShadow>
        <boxGeometry args={[PLATFORM_HALF.x * 2, PLATFORM_HALF.y * 2, PLATFORM_HALF.z * 2]} />
      </mesh>
      {/* top marker so the "rideable" face reads clearly */}
      <mesh position-y={PLATFORM_HALF.y + 0.01} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshStandardMaterial color="#d8c99f" />
      </mesh>
    </RigidBody>
  )
}
