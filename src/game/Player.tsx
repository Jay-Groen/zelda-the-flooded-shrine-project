import { Suspense, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CapsuleCollider,
  CoefficientCombineRule,
  RigidBody,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier'
import { MathUtils, type Group } from 'three'
import {
  JUMP_VELOCITY,
  MOVE_SPEED,
  PLAYER_START,
  SWIM_JUMP_VELOCITY,
  SWIM_SPEED,
} from './constants'
import { input } from './input'
import { cutsceneActive, live, useGame } from './store'
import { Explorer } from './Explorer'
import { FINALE } from './sun'

const HALF_HEIGHT = 0.5
const RADIUS = 0.4
const FOOT = HALF_HEIGHT + RADIUS
/** Where the player's centre floats relative to the waterline. */
const SWIM_DEPTH = 0.2

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const jumpLock = useRef(0)
  const facing = useRef(0)
  const { rapier, world } = useRapier()
  const resetId = useGame((s) => s.resetId)

  const respawn = () => {
    const b = body.current
    if (!b) return
    b.setTranslation({ x: PLAYER_START[0], y: PLAYER_START[1], z: PLAYER_START[2] }, true)
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }

  useEffect(() => {
    if (resetId > 0) respawn()
  }, [resetId])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const b = body.current
    if (!b) return
    const p = b.translation()
    const v = b.linvel()

    const ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 })
    const hit = world.castRay(ray, FOOT + 0.15, true, undefined, undefined, undefined, b)
    const onSolid = hit !== null && v.y < 3

    const swimY = live.waterY - SWIM_DEPTH
    const inWater = p.y < swimY + 0.05
    jumpLock.current = Math.max(0, jumpLock.current - dt)
    const swimming = inWater && jumpLock.current === 0

    const locked = cutsceneActive()
    const { x: ax, z: az } = locked ? { x: 0, z: 0 } : input.axis()
    const speed = inWater ? SWIM_SPEED : MOVE_SPEED

    let vy = v.y
    b.setGravityScale(swimming ? 0 : 1, true)
    if (swimming) {
      const rise = MathUtils.clamp((swimY - p.y) * 5, -4, 4)
      vy = MathUtils.damp(vy, rise, 8, dt)
    }

    if (input.consumeJump() && !locked) {
      if (inWater && p.y > swimY - 0.4) {
        vy = SWIM_JUMP_VELOCITY
        jumpLock.current = 0.4
      } else if (onSolid && !inWater) {
        vy = JUMP_VELOCITY
        jumpLock.current = 0.15
      }
    }

    b.setLinvel({ x: ax * speed, y: vy, z: az * speed }, true)

    live.playerPos.set(p.x, p.y, p.z)
    live.moveDir.set(ax, az)
    live.grounded = onSolid && !inWater

    // Pick the animation, and turn smoothly toward where we're heading.
    const t = live.chestT
    const presenting = t >= FINALE.pearlRise[0] && t < FINALE.cameraOut[0]
    const moving = ax !== 0 || az !== 0
    live.pose = presenting
      ? 'Hold'
      : live.pushing
        ? 'Push'
        : inWater
          ? 'Swim'
          : !onSolid
            ? 'Jump'
            : moving
              ? 'Walk'
              : 'Idle'
    if (visual.current) {
      const target = presenting ? 0 : moving ? Math.atan2(ax, az) : facing.current
      facing.current = target
      const v = visual.current.rotation
      const diff = Math.atan2(Math.sin(target - v.y), Math.cos(target - v.y))
      v.y += diff * (1 - Math.exp(-14 * dt))
    }
    if (p.y < -12) respawn()
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={PLAYER_START}
      enabledRotations={[false, false, false]}
      canSleep={false}
      ccd
    >
      <CapsuleCollider
        args={[HALF_HEIGHT, RADIUS]}
        friction={0}
        frictionCombineRule={CoefficientCombineRule.Min}
      />
      <group ref={visual}>
        <Suspense
          fallback={
            <mesh castShadow>
              <capsuleGeometry args={[RADIUS, HALF_HEIGHT * 2, 6, 12]} />
              <meshStandardMaterial color="#8a3a22" />
            </mesh>
          }
        >
          <Explorer />
        </Suspense>
      </group>
    </RigidBody>
  )
}
