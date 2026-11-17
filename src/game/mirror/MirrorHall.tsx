import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import {
  AdditiveBlending,
  Color,
  MathUtils,
  MeshBasicMaterial,
  Vector3,
  type Group,
  type Mesh,
  type PointLight,
} from 'three'
import { stoneMaterial } from '../shaders/stoneMaterial'
import { haloTexture } from '../runes'
import { input } from '../input'
import { live } from '../store'
import { playChime } from '../audio'
import { MIRROR_HALL_OFFSET, useLevels } from '../levels'
import { Player } from '../Player'
import { CRYSTAL, HALF, MIRRORS, cellX, cellZ, traceBeam } from './logic'
import { useMirrorHall } from './store'

const LEVEL_INDEX = 1
const BEAM_Y = 1.25
const REACH = 2.4
const BEAM_SPEED = 26
const PLAYER_START: [number, number, number] = [
  MIRROR_HALL_OFFSET.x + 1,
  1.5,
  MIRROR_HALL_OFFSET.z + 4,
]
const noWater = () => -100

type V3 = [number, number, number]
type Block = { min: V3; max: V3; color?: string; visible?: boolean; collider?: boolean }

const FLOOR = '#9a9585'
const WALL = '#857f70'
const H = HALF // 6

/** Static stone of the hall, in local coordinates. */
const BLOCKS: Block[] = [
  { min: [-H, -2, -H], max: [H, 0, H], color: FLOOR },
  // north wall, with a window (sun) at column 1 and a door at x 2..4
  { min: [-H - 1, -2, -H - 1], max: [-3.6, 5, -H], color: WALL },
  { min: [-3.6, -2, -H - 1], max: [-2.4, 0.7, -H], color: WALL },
  { min: [-3.6, 1.8, -H - 1], max: [-2.4, 5, -H], color: WALL },
  { min: [-2.4, -2, -H - 1], max: [2, 5, -H], color: WALL },
  { min: [2, 3.2, -H - 1], max: [4, 5, -H], color: WALL },
  { min: [2, -2, -H - 1], max: [4, 0, -H], color: FLOOR },
  { min: [4, -2, -H - 1], max: [H + 1, 5, -H], color: WALL },
  // east wall
  { min: [H, -2, -H], max: [H + 1, 5, H + 1], color: WALL },
  // camera-facing walls: invisible colliders + low lips
  { min: [-H - 1, -2, -H], max: [-H, 6, H + 1], visible: false },
  { min: [-H - 1, -2, -H], max: [-H, 0.4, H + 1], color: WALL, collider: false },
  { min: [-H, -2, H], max: [H, 6, H + 1], visible: false },
  { min: [-H, -2, H], max: [H, 0.4, H + 1], color: WALL, collider: false },
  // little alcove behind the door
  { min: [2, -2, -H - 4], max: [4, 0, -H - 1], color: FLOOR },
  { min: [1.5, -2, -H - 4], max: [2, 3.4, -H - 1], color: WALL },
  { min: [4, -2, -H - 4], max: [4.5, 3.4, -H - 1], color: WALL },
  { min: [1.5, 3.2, -H - 4], max: [4.5, 3.6, -H - 1], color: WALL, collider: false },
]

function Room() {
  return (
    <RigidBody type="fixed" colliders={false}>
      {BLOCKS.map((b, i) => {
        const size: V3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
        const center: V3 = [(b.max[0] + b.min[0]) / 2, (b.max[1] + b.min[1]) / 2, (b.max[2] + b.min[2]) / 2]
        return (
          <group key={i}>
            {b.visible !== false && (
              <mesh position={center} material={stoneMaterial(b.color ?? WALL)} castShadow receiveShadow>
                <boxGeometry args={size} />
              </mesh>
            )}
            {b.collider !== false && <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={center} />}
          </group>
        )
      })}
      {/* daylight outside the window and at the end of the alcove */}
      <mesh position={[-3, 1.25, -H - 1.02]}>
        <planeGeometry args={[1.2, 1.1]} />
        <meshBasicMaterial color="#fff1d0" toneMapped={false} />
      </mesh>
    </RigidBody>
  )
}

/** Distance from the player to a local point (x/z only). */
function playerDistance(x: number, z: number) {
  const p = live.playerPos
  return Math.hypot(p.x - MIRROR_HALL_OFFSET.x - x, p.z - MIRROR_HALL_OFFSET.z - z)
}

function Mirror({ index }: { index: number }) {
  const [c, r] = MIRRORS[index].cell
  const x = cellX(c)
  const z = cellZ(r)
  const turn = useRef<Group>(null)
  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#7ff0ff',
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const state = useMirrorHall.getState().states[index]
    const target = state === '/' ? Math.PI / 4 : -Math.PI / 4
    if (turn.current) turn.current.rotation.y = MathUtils.damp(turn.current.rotation.y, target, 10, dt)
    const inReach = useLevels.getState().active === LEVEL_INDEX && playerDistance(x, z) < REACH
    ringMat.opacity = MathUtils.damp(ringMat.opacity, inReach ? 0.7 : 0, 8, dt)
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (useLevels.getState().active === LEVEL_INDEX && playerDistance(x, z) < REACH) {
      useMirrorHall.getState().toggle(index)
    }
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = playerDistance(x, z) < REACH ? 'pointer' : 'not-allowed'
  }

  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1, 0.5]} position-y={1} />
      </RigidBody>
      <mesh position-y={0.32} material={stoneMaterial('#8f8a7c', { moss: 0.4, blocks: 0 })} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.64, 16]} />
      </mesh>
      <mesh material={ringMat} rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.75, 0.9, 40]} />
      </mesh>
      <group ref={turn} position-y={BEAM_Y} onClick={onClick} onPointerOver={onOver} onPointerOut={() => (document.body.style.cursor = '')}>
        <mesh castShadow>
          <boxGeometry args={[1.35, 1.15, 0.12]} />
          <meshStandardMaterial color="#9a6a2a" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position-z={0.001}>
          <boxGeometry args={[1.18, 0.98, 0.14]} />
          <meshStandardMaterial color="#cfe6ee" metalness={0.25} roughness={0.12} emissive="#8fbccc" emissiveIntensity={0.55} />
        </mesh>
        {/* stand */}
        <mesh position-y={-0.75}>
          <boxGeometry args={[0.12, 0.4, 0.12]} />
          <meshStandardMaterial color="#9a6a2a" metalness={0.8} roughness={0.35} />
        </mesh>
      </group>
    </group>
  )
}

const BEAM_CORE = new Color('#fff4d6')
const BEAM_GLOW = new Color('#ffcf7a')
const MAX_SEGMENTS = 8

/** The sunbeam: a polyline of glowing bars that grows from the window each time the path changes. */
function Beam() {
  const states = useMirrorHall((s) => s.states)
  const trace = useMemo(() => traceBeam(states), [states])
  const segments = useMemo(() => {
    const out: { start: Vector3; dir: Vector3; length: number; offset: number }[] = []
    let offset = 0
    for (let i = 0; i < trace.points.length - 1; i++) {
      const a = new Vector3(trace.points[i][0], BEAM_Y, trace.points[i][1])
      const b = new Vector3(trace.points[i + 1][0], BEAM_Y, trace.points[i + 1][1])
      const length = a.distanceTo(b)
      out.push({ start: a, dir: b.sub(a).normalize(), length, offset })
      offset += length
    }
    return { list: out, total: offset }
  }, [trace])

  const progress = useRef(0)
  const lastTrace = useRef(trace)
  const cores = useRef<(Mesh | null)[]>([])
  const glows = useRef<(Mesh | null)[]>([])
  const spark = useRef<Mesh>(null)
  const crystalLight = useRef<PointLight>(null)
  const coreMat = useMemo(
    () => new MeshBasicMaterial({ color: BEAM_CORE, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  )
  const glowMat = useMemo(
    () =>
      new MeshBasicMaterial({ color: BEAM_GLOW, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  )
  const sparkMat = useMemo(
    () =>
      new MeshBasicMaterial({ map: haloTexture(), color: BEAM_GLOW, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  )

  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    if (lastTrace.current !== trace) {
      // Keep the part of the beam that didn't change; regrow from the first mirror that moved.
      const prev = lastTrace.current.points
      let shared = 0
      for (let i = 1; i < Math.min(prev.length, trace.points.length); i++) {
        if (prev[i][0] !== trace.points[i][0] || prev[i][1] !== trace.points[i][1]) break
        shared = i
      }
      progress.current = Math.min(progress.current, segments.list[shared]?.offset ?? 0)
      lastTrace.current = trace
    }
    progress.current = Math.min(segments.total, progress.current + BEAM_SPEED * dt)

    const flicker = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 13) * Math.sin(clock.elapsedTime * 7.3)
    coreMat.opacity = flicker
    let tip = segments.list[0]?.start
    segments.list.forEach((s, i) => {
      const visible = MathUtils.clamp(progress.current - s.offset, 0, s.length)
      for (const [mesh, width] of [
        [cores.current[i], 0.07],
        [glows.current[i], 0.38],
      ] as const) {
        if (!mesh) continue
        mesh.visible = visible > 0.001
        mesh.position.copy(s.start).addScaledVector(s.dir, visible / 2)
        mesh.scale.set(width, width, Math.max(visible, 0.001))
        mesh.lookAt(mesh.position.clone().add(s.dir).add(MIRROR_HALL_OFFSET))
      }
      if (visible > 0) tip = s.start.clone().addScaledVector(s.dir, visible)
    })
    for (let i = segments.list.length; i < MAX_SEGMENTS; i++) {
      if (cores.current[i]) cores.current[i]!.visible = false
      if (glows.current[i]) glows.current[i]!.visible = false
    }

    if (spark.current && tip) {
      spark.current.position.copy(tip)
      spark.current.quaternion.copy(camera.quaternion)
      spark.current.scale.setScalar(0.9 + 0.2 * flicker)
    }

    const arrived = progress.current >= segments.total - 0.001
    const lit = trace.hitsCrystal && arrived
    if (crystalLight.current) crystalLight.current.intensity = MathUtils.damp(crystalLight.current.intensity, lit ? 8 : 0, 4, dt)
    live.crystalLit = lit
  })

  return (
    <group>
      {Array.from({ length: MAX_SEGMENTS }, (_, i) => (
        <group key={i}>
          <mesh ref={(m) => void (cores.current[i] = m)} material={coreMat} renderOrder={5} raycast={() => null}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh ref={(m) => void (glows.current[i] = m)} material={glowMat} renderOrder={5} raycast={() => null}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>
      ))}
      <mesh ref={spark} material={sparkMat} renderOrder={6} raycast={() => null}>
        <planeGeometry args={[1.2, 1.2]} />
      </mesh>
      <pointLight ref={crystalLight} position={[cellX(CRYSTAL[0]), 1.6, cellZ(CRYSTAL[1])]} color="#9ff3ff" intensity={0} distance={9} decay={1.5} />
    </group>
  )
}

function Crystal() {
  const gem = useRef<Mesh>(null)
  const glow = useRef(0)
  const x = cellX(CRYSTAL[0])
  const z = cellZ(CRYSTAL[1])
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    glow.current = MathUtils.damp(glow.current, live.crystalLit ? 1 : 0, 3, dt)
    const g = gem.current
    if (!g) return
    g.rotation.y += dt * (0.4 + glow.current * 1.6)
    g.position.y = 1.35 + Math.sin(clock.elapsedTime * 1.5) * 0.05 + glow.current * 0.15
    const mat = g.material as unknown as { emissiveIntensity: number }
    mat.emissiveIntensity = 0.25 + glow.current * 2.5
  })
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.5, 0.5]} position-y={0.5} />
      </RigidBody>
      <mesh position-y={0.4} material={stoneMaterial('#8f8a7c', { moss: 0.5, blocks: 0 })} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.8, 6]} />
      </mesh>
      <mesh ref={gem} castShadow>
        <octahedronGeometry args={[0.38]} />
        <meshStandardMaterial color="#9ff3ff" emissive="#4fd8f0" emissiveIntensity={0.25} roughness={0.1} metalness={0.1} transparent opacity={0.92} />
      </mesh>
    </group>
  )
}

const DOOR_CLOSED: V3 = [3, 1.6, -H - 0.5]

/** Door slab in the north wall; sinks once the crystal is lit. */
function Door() {
  const body = useRef<RapierRigidBody>(null)
  const t = useRef(0)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    t.current = useMirrorHall.getState().solved ? t.current + dt : 0
    const k = MathUtils.smoothstep(t.current, 0.8, 3.2)
    const shudder = k > 0 && k < 1 ? Math.sin(t.current * 70) * 0.02 * (1 - k) : 0
    body.current?.setNextKinematicTranslation({
      x: MIRROR_HALL_OFFSET.x + DOOR_CLOSED[0] + shudder,
      y: DOOR_CLOSED[1] - k * 3.3,
      z: MIRROR_HALL_OFFSET.z + DOOR_CLOSED[2],
    })
  })
  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[MIRROR_HALL_OFFSET.x + DOOR_CLOSED[0], DOOR_CLOSED[1], MIRROR_HALL_OFFSET.z + DOOR_CLOSED[2]]}
    >
      <CuboidCollider args={[1, 1.6, 0.4]} />
      <mesh material={stoneMaterial('#66625a', { moss: 0.5 })} castShadow receiveShadow>
        <boxGeometry args={[2, 3.2, 0.8]} />
      </mesh>
    </RigidBody>
  )
}

/** Level-wide logic: E turns the nearest mirror; lighting the crystal solves the hall. */
function HallLogic() {
  useFrame(() => {
    const active = useLevels.getState().active === LEVEL_INDEX
    const hall = useMirrorHall.getState()

    let nearest = -1
    let best = REACH
    if (active) {
      MIRRORS.forEach((m, i) => {
        const d = playerDistance(cellX(m.cell[0]), cellZ(m.cell[1]))
        if (d < best) {
          best = d
          nearest = i
        }
      })
      if (input.consumeInteract() && nearest >= 0) hall.toggle(nearest)
    }
    if (nearest !== hall.reachable) hall.setReachable(nearest)

    if (live.crystalLit && !hall.solved) {
      hall.solve()
      playChime()
      live.celebrateUntil = performance.now() + 2400
      useLevels.getState().markCleared(LEVEL_INDEX)
    }
  })
  return null
}

/** Level 02: guide the sunbeam with four mirrors onto the crystal. */
export function MirrorHall() {
  const active = useLevels((s) => s.active === LEVEL_INDEX)
  const resetId = useMirrorHall((s) => s.resetId)
  return (
    <>
      <group position={MIRROR_HALL_OFFSET}>
        <Room />
        {MIRRORS.map((_, i) => (
          <Mirror key={i} index={i} />
        ))}
        <Beam />
        <Crystal />
        <HallLogic />
      </group>
      {/* Kinematic door and player live in world space. */}
      <Door />
      {active && <Player start={PLAYER_START} waterY={noWater} resetKey={resetId} />}
    </>
  )
}
