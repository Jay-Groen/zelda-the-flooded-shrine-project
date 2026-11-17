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
import { cutsceneActive, live } from './store'
import { Explorer, type Pose } from './Explorer'
import { FINALE } from './sun'

const HALF_HEIGHT = 0.5
const RADIUS = 0.4
const FOOT = HALF_HEIGHT + RADIUS
/** Where the player's centre floats relative to the waterline. */
const SWIM_DEPTH = 0.2

type PlayerProps = {
  /** Spawn point in world space. */
  start?: [number, number, number]
  /** Water surface height in this level (very low = no water). */
  waterY?: () => number
  /** Changes whenever this level resets; the player respawns. */
  resetKey?: number
  canJump?: boolean
  /**
   * Lets a level take over horizontal movement (e.g. sliding on ice). Gets the
   * camera-relative input and the player's world position; return a velocity,
   * or null to walk normally.
   */
  override?: (input: { x: number; z: number }, pos: { x: number; y: number; z: number }, dt: number) => MoveOverride | null
}

export type MoveOverride = { x: number; z: number; pose?: Pose }

const levelOneWater = () => live.waterY

export function Player({
  start = PLAYER_START,
  waterY = levelOneWater,
  resetKey = 0,
  canJump = true,
  override,
}: PlayerProps) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const jumpLock = useRef(0)
  const facing = useRef(0)
  const { rapier, world } = useRapier()

  const respawn = () => {
    const b = body.current
    if (!b) return
    b.setTranslation({ x: start[0], y: start[1], z: start[2] }, true)
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }

  useEffect(() => {
    const b = body.current
    if (resetKey === 0 || !b) return
    b.setTranslation({ x: start[0], y: start[1], z: start[2] }, true)
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }, [resetKey, start])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const b = body.current
    if (!b) return
    const p = b.translation()
    const v = b.linvel()

    const ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 })
    const hit = world.castRay(ray, FOOT + 0.15, true, undefined, undefined, undefined, b)
    const onSolid = hit !== null && v.y < 3

    const swimY = waterY() - SWIM_DEPTH
    const inWater = p.y < swimY + 0.05
    jumpLock.current = Math.max(0, jumpLock.current - dt)
    const swimming = inWater && jumpLock.current === 0

    const celebrating = performance.now() < live.celebrateUntil
    const locked = cutsceneActive() || celebrating
    const { x: ax, z: az } = locked ? { x: 0, z: 0 } : input.axis()
    const speed = inWater ? SWIM_SPEED : MOVE_SPEED

    let vy = v.y
    b.setGravityScale(swimming ? 0 : 1, true)
    if (swimming) {
      const rise = MathUtils.clamp((swimY - p.y) * 5, -4, 4)
      vy = MathUtils.damp(vy, rise, 8, dt)
    }

    if (input.consumeJump() && !locked && canJump) {
      if (inWater && p.y > swimY - 0.4) {
        vy = SWIM_JUMP_VELOCITY
        jumpLock.current = 0.4
      } else if (onSolid && !inWater) {
        vy = JUMP_VELOCITY
        jumpLock.current = 0.15
      }
    }

    let vx = ax * speed
    let vz = az * speed
    const forced = override?.({ x: ax, z: az }, p, dt) ?? null
    if (forced) {
      vx = forced.x
      vz = forced.z
    }
    b.setLinvel({ x: vx, y: vy, z: vz }, true)

    live.playerPos.set(p.x, p.y, p.z)
    live.moveDir.set(ax, az)
    live.grounded = onSolid && !inWater

    // Pick the animation, and turn smoothly toward where we're heading.
    const t = live.chestT
    const presenting = (t >= FINALE.pearlRise[0] && t < FINALE.cameraOut[0]) || celebrating
    const moving = forced ? Math.hypot(vx, vz) > 0.3 : ax !== 0 || az !== 0
    live.pose = presenting
      ? 'Hold'
      : forced?.pose
        ? forced.pose
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
      const target = presenting ? 0 : moving ? Math.atan2(vx, vz) : facing.current
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
      position={start}
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
