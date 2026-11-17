import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  MathUtils,
  MeshBasicMaterial,
  PointsMaterial,
  SRGBColorSpace,
  type Group,
  type Mesh,
  type PointLight,
} from 'three'
import { stoneMaterial } from '../shaders/stoneMaterial'
import { haloTexture } from '../runes'
import { live } from '../store'
import { playChime } from '../audio'
import { FROZEN_GARDEN_OFFSET as O, useLevels } from '../levels'
import { Player, type MoveOverride } from '../Player'
import {
  EMBERS,
  GOAL,
  HALF,
  N,
  ROCKS,
  TREE,
  cellAt,
  cellX,
  cellZ,
  gridDirFromInput,
  isSnow,
  slide,
  tile,
  type Cell,
  type Dir,
} from './logic'
import { useFrozenGarden } from './store'

const LEVEL_INDEX = 2
const SLIDE_SPEED = 9
const H = HALF
const PLAYER_START: [number, number, number] = [O.x, 1.5, O.z + cellZ(5)]
const noWater = () => -100
const same = (a: Cell | null, b: Cell | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1]

// ---------------------------------------------------------------- movement

/**
 * Ice controller. On snow you walk freely; the moment you step onto ice you
 * slide in that direction until the grid logic says you stop. Standing on ice,
 * a key press launches the next slide (keys must be released between slides).
 */
const ctrl = {
  sliding: null as null | { dir: Dir; end: Cell },
  prevCell: null as Cell | null,
  needRelease: false,
  /** Exposed for the compass / HUD. */
  standingOnIce: null as Cell | null,
}

function resetCtrl() {
  ctrl.sliding = null
  ctrl.prevCell = null
  ctrl.needRelease = false
  ctrl.standingOnIce = null
}

function startSlide(from: Cell, dir: Dir): boolean {
  const res = slide(from, dir)
  if (!res) return false
  ctrl.sliding = { dir, end: res.end }
  return true
}

function iceOverride(inp: { x: number; z: number }, pos: { x: number; z: number }): MoveOverride | null {
  const lx = pos.x - O.x
  const lz = pos.z - O.z
  const cell = cellAt(lx, lz)
  const here = tile(cell)
  const pressing = inp.x !== 0 || inp.z !== 0
  if (!pressing) ctrl.needRelease = false

  if (ctrl.sliding) {
    ctrl.standingOnIce = null
    const { dir, end } = ctrl.sliding
    const ex = cellX(end[0])
    const ez = cellZ(end[1])
    const remaining = (ex - lx) * dir[0] + (ez - lz) * dir[1]
    if (remaining <= 0.05) {
      ctrl.sliding = null
      ctrl.prevCell = end
      ctrl.needRelease = pressing
      return { x: (ex - lx) * 6, z: (ez - lz) * 6, pose: 'Idle' }
    }
    const speed = Math.min(SLIDE_SPEED, 1.2 + remaining * 5)
    // Keep to the centre of the lane while gliding.
    return {
      x: dir[0] * speed + (dir[0] === 0 ? (ex - lx) * 10 : 0),
      z: dir[1] * speed + (dir[1] === 0 ? (ez - lz) * 10 : 0),
      pose: 'Idle',
    }
  }

  if (here === 'ice') {
    // Just stepped off the snow onto the ice: slide on in that direction.
    const prev = ctrl.prevCell
    if (prev && isSnow(tile(prev)) && !same(prev, cell)) {
      let dc = cell[0] - prev[0]
      let dr = cell[1] - prev[1]
      if (dc !== 0 && dr !== 0) {
        if (Math.abs(inp.x) >= Math.abs(inp.z)) dr = 0
        else dc = 0
      }
      ctrl.prevCell = cell
      if (startSlide(prev, [Math.sign(dc), Math.sign(dr)])) return iceOverride(inp, pos)
    }
    ctrl.prevCell = cell
    ctrl.standingOnIce = cell
    const dir = ctrl.needRelease ? null : gridDirFromInput(inp.x, inp.z)
    if (dir && startSlide(cell, dir)) {
      ctrl.standingOnIce = null
      return iceOverride(inp, pos)
    }
    // Hold still in the middle of the ice cell.
    return { x: (cellX(cell[0]) - lx) * 6, z: (cellZ(cell[1]) - lz) * 6, pose: 'Idle' }
  }

  ctrl.standingOnIce = null
  if (here) ctrl.prevCell = cell
  return null
}

// ---------------------------------------------------------------- room

type V3 = [number, number, number]
type Block = { min: V3; max: V3; color?: string; visible?: boolean; collider?: boolean }
const STONE = '#a7b0b4'
const BLOCKS: Block[] = [
  { min: [-H, -2, -H], max: [H, 0, H], color: '#8f979b' },
  // north wall with the exit door above the goal (x 0..2)
  { min: [-H - 1, -2, -H - 1], max: [0, 5, -H], color: STONE },
  { min: [0, 3.2, -H - 1], max: [2, 5, -H], color: STONE },
  { min: [0, -2, -H - 1], max: [2, 0, -H], color: STONE },
  { min: [2, -2, -H - 1], max: [H + 1, 5, -H], color: STONE },
  { min: [H, -2, -H], max: [H + 1, 5, H + 1], color: STONE },
  { min: [-H - 1, -2, -H], max: [-H, 6, H + 1], visible: false },
  { min: [-H - 1, -2, -H], max: [-H, 0.4, H + 1], color: STONE, collider: false },
  { min: [-H, -2, H], max: [H, 6, H + 1], visible: false },
  { min: [-H, -2, H], max: [H, 0.4, H + 1], color: STONE, collider: false },
  // alcove behind the door
  { min: [0, -2, -H - 4], max: [2, 0, -H - 1], color: '#8f979b' },
  { min: [-0.5, -2, -H - 4], max: [0, 3.4, -H - 1], color: STONE },
  { min: [2, -2, -H - 4], max: [2.5, 3.4, -H - 1], color: STONE },
  { min: [-0.5, 3.2, -H - 4], max: [2.5, 3.6, -H - 1], color: STONE, collider: false },
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
              <mesh position={center} material={stoneMaterial(b.color ?? STONE, { moss: 0 })} castShadow receiveShadow>
                <boxGeometry args={size} />
              </mesh>
            )}
            {b.collider !== false && <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={center} />}
          </group>
        )
      })}
      <mesh position={[1, 1.6, -H - 3.98]}>
        <planeGeometry args={[2, 3.2]} />
        <meshBasicMaterial color="#fff1d0" toneMapped={false} />
      </mesh>
    </RigidBody>
  )
}

/** Ice and snow tiles, one per cell. */
function Floor() {
  const cells = useMemo(() => {
    const out: { c: number; r: number; snow: boolean }[] = []
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = tile([c, r])
      if (t === 'ice' || isSnow(t)) out.push({ c, r, snow: isSnow(t) })
    }
    return out
  }, [])
  return (
    <group>
      {cells.map(({ c, r, snow }) =>
        snow ? (
          <group key={`${c},${r}`} position={[cellX(c), 0, cellZ(r)]}>
            <mesh position-y={0.1} receiveShadow castShadow>
              <boxGeometry args={[2, 0.2, 2]} />
              <meshStandardMaterial color="#f3f6f8" roughness={1} />
            </mesh>
            {[
              [-0.45, 0.3, 0.5],
              [0.5, -0.4, 0.42],
              [0.1, 0.55, 0.35],
            ].map(([x, z, s], i) => (
              <mesh key={i} position={[x, 0.2, z]} scale={[s, s * 0.35, s]} castShadow>
                <sphereGeometry args={[1, 12, 8]} />
                <meshStandardMaterial color="#ffffff" roughness={1} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh key={`${c},${r}`} position={[cellX(c), 0.03, cellZ(r)]} receiveShadow>
            <boxGeometry args={[1.94, 0.06, 1.94]} />
            <meshStandardMaterial color="#bfe2ee" roughness={0.08} metalness={0.05} emissive="#2e5c6b" emissiveIntensity={0.35} />
          </mesh>
        ),
      )}
    </group>
  )
}

function Boulders() {
  return (
    <RigidBody type="fixed" colliders={false}>
      {ROCKS.map(([c, r], i) => (
        <group key={i} position={[cellX(c), 0, cellZ(r)]} rotation-y={i * 1.3}>
          <CuboidCollider args={[0.9, 1, 0.9]} position-y={1} />
          <mesh position-y={0.75} scale={[1, 0.85, 1]} castShadow receiveShadow>
            <icosahedronGeometry args={[0.95, 0]} />
            <meshStandardMaterial color="#8fa9b5" roughness={0.55} flatShading />
          </mesh>
          <mesh position-y={1.42} scale={[0.75, 0.22, 0.7]} castShadow>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={1} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}

const BLOSSOMS: V3[] = [
  [0.75, 2.75, 0.1], [0.95, 2.45, -0.3], [-0.7, 2.6, 0.25], [-0.95, 2.35, -0.1], [0.1, 3.15, 0.55],
  [0.35, 3.05, -0.55], [-0.35, 3.2, -0.3], [0.55, 2.2, 0.55], [-0.5, 2.15, -0.55], [0, 3.35, 0],
  [0.85, 2.95, 0.4], [-0.8, 2.9, -0.45], [0.25, 2.6, 0.75], [-0.2, 2.55, -0.8],
]

/** The frozen tree: bare and frosted until the brazier is lit, then it blooms. */
function Tree() {
  const blossoms = useRef<Group>(null)
  const bloom = useRef(0)
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const target = useFrozenGarden.getState().solved ? 1 : 0
    bloom.current = target ? Math.min(1, bloom.current + dt / 2.2) : 0
    blossoms.current?.children.forEach((b, i) => {
      const k = MathUtils.clamp(bloom.current * 1.6 - i * 0.04, 0, 1)
      const pop = k < 1 ? 1 - Math.pow(1 - k, 3) : 1
      b.scale.setScalar(pop * (0.95 + 0.05 * Math.sin(clock.elapsedTime * 2 + i)))
    })
  })
  const branch = (from: V3, to: V3, r: number, key: string) => {
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]
    const len = Math.hypot(dx, dy, dz)
    const mid: V3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
    const rotX = Math.atan2(Math.hypot(dx, dz), dy)
    const rotY = Math.atan2(dx, dz)
    return (
      <group key={key} position={mid} rotation={[0, rotY, 0]}>
        <mesh rotation-x={rotX} castShadow>
          <cylinderGeometry args={[r * 0.7, r, len, 8]} />
          <meshStandardMaterial color="#4a3628" roughness={0.9} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[cellX(TREE[0]), 0, cellZ(TREE[1])]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.2, 0.85]} position-y={1.2} />
      </RigidBody>
      <mesh position-y={0.15} receiveShadow>
        <cylinderGeometry args={[0.95, 1, 0.3, 20]} />
        <meshStandardMaterial color="#f3f6f8" roughness={1} />
      </mesh>
      {branch([0, 0, 0], [0, 2.1, 0], 0.22, 'trunk')}
      {branch([0, 1.6, 0], [0.85, 2.6, 0.15], 0.1, 'b1')}
      {branch([0, 1.7, 0], [-0.85, 2.5, -0.15], 0.1, 'b2')}
      {branch([0, 2.0, 0], [0.25, 3.1, -0.5], 0.08, 'b3')}
      {branch([0, 2.0, 0], [-0.2, 3.15, 0.5], 0.08, 'b4')}
      {/* frost on the branch tips */}
      {[[0.85, 2.62, 0.15], [-0.85, 2.52, -0.15], [0.25, 3.12, -0.5], [-0.2, 3.17, 0.5]].map((p, i) => (
        <mesh key={i} position={p as V3} scale={[0.16, 0.1, 0.16]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
      <group ref={blossoms}>
        {BLOSSOMS.map((p, i) => (
          <mesh key={i} position={p} scale={0} castShadow>
            <icosahedronGeometry args={[0.2 + (i % 3) * 0.04, 1]} />
            <meshStandardMaterial color={i % 4 === 0 ? '#ffd1e0' : '#f39ab8'} emissive="#f27aa5" emissiveIntensity={0.35} roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Ember({ index }: { index: number }) {
  const [c, r] = EMBERS[index]
  const group = useRef<Group>(null)
  const light = useRef<PointLight>(null)
  const haloMat = useMemo(
    () =>
      new MeshBasicMaterial({ map: haloTexture(), color: '#ff9a4d', transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  )
  useFrame(({ clock, camera }) => {
    const takenAt = useFrozenGarden.getState().embers[index]
    const g = group.current
    if (!g) return
    const k = takenAt ? Math.min(1, (performance.now() - takenAt) / 600) : 0
    g.visible = k < 1
    const t = clock.elapsedTime
    g.position.set(cellX(c), 0.7 + Math.sin(t * 2 + index) * 0.1 + k * 1.8, cellZ(r))
    g.scale.setScalar(1 - k * 0.8)
    haloMat.opacity = (0.75 + 0.25 * Math.sin(t * 9 + index * 2)) * (1 - k)
    g.children[1]?.quaternion.copy(camera.quaternion)
    if (light.current) light.current.intensity = (1.6 + 0.4 * Math.sin(t * 11 + index)) * (1 - k)
  })
  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[0.17, 1]} />
        <meshStandardMaterial color="#ffb070" emissive="#ff7a2e" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh material={haloMat} renderOrder={5}>
        <planeGeometry args={[1.1, 1.1]} />
      </mesh>
      <pointLight ref={light} color="#ff9a4d" distance={3.5} decay={1.5} />
    </group>
  )
}

/** Stone brazier on the snow island; flames once lit. */
function Brazier() {
  const flames = useRef<Group>(null)
  const light = useRef<PointLight>(null)
  const lit = useRef(0)
  const x = cellX(GOAL[0])
  const z = cellZ(GOAL[1]) - 0.62
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    lit.current = MathUtils.damp(lit.current, useFrozenGarden.getState().solved ? 1 : 0, 4, dt)
    const t = clock.elapsedTime
    if (flames.current) {
      flames.current.visible = lit.current > 0.02
      flames.current.children.forEach((f, i) => {
        const flick = 1 + 0.18 * Math.sin(t * (13 + i * 3) + i) * Math.sin(t * 7.1 + i)
        f.scale.set(lit.current * (1 - i * 0.25), lit.current * flick * (1 - i * 0.15), lit.current * (1 - i * 0.25))
      })
    }
    if (light.current) light.current.intensity = lit.current * (5 + Math.sin(t * 17) * 0.6)
  })
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.45, 0.3]} position-y={0.45} />
      </RigidBody>
      <mesh position-y={0.25} material={stoneMaterial('#7d858a', { moss: 0, blocks: 0 })} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 0.5, 10]} />
      </mesh>
      <mesh position-y={0.62} material={stoneMaterial('#7d858a', { moss: 0, blocks: 0 })} castShadow>
        <cylinderGeometry args={[0.38, 0.22, 0.3, 14]} />
      </mesh>
      <group ref={flames} position-y={0.78} visible={false}>
        {['#ff7a2e', '#ffb347', '#fff1b8'].map((color, i) => (
          <mesh key={i} position-y={0.22}>
            <coneGeometry args={[0.24, 0.62, 10, 1, true]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position-y={1.2} color="#ffa04d" intensity={0} distance={10} decay={1.4} />
    </group>
  )
}

/** Gentle snowfall inside the garden. */
function Snowfall() {
  const COUNT = 320
  const { geo, mat, seeds } = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3))
    const mat = new PointsMaterial({ map: haloTexture(), color: '#ffffff', size: 0.12, transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending })
    const seeds = Array.from({ length: COUNT }, () => ({ x: (Math.random() * 2 - 1) * H, z: (Math.random() * 2 - 1) * H, y: Math.random() * 9, s: 0.4 + Math.random() * 0.5, p: Math.random() * 6 }))
    return { geo, mat, seeds }
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = geo.attributes.position as BufferAttribute
    seeds.forEach((d, i) => {
      const y = 9 - ((9 - d.y + t * d.s) % 9)
      pos.setXYZ(i, d.x + Math.sin(t * 0.7 + d.p) * 0.3, y, d.z + Math.cos(t * 0.5 + d.p) * 0.3)
    })
    pos.needsUpdate = true
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

/** Arrows around the player on ice, labelled with the key that slides that way. */
function arrowTexture(letter: string) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(64, 8)
  ctx.lineTo(98, 50)
  ctx.lineTo(30, 50)
  ctx.closePath()
  ctx.fill()
  ctx.font = 'bold 54px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, 64, 92)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const COMPASS: { dir: Dir; key: string }[] = [
  { dir: [1, 0], key: 'W' },
  { dir: [0, 1], key: 'D' },
  { dir: [-1, 0], key: 'S' },
  { dir: [0, -1], key: 'A' },
]

function Compass() {
  const group = useRef<Group>(null)
  const arrows = useRef<(Mesh | null)[]>([])
  const mats = useMemo(
    () => COMPASS.map(({ key }) => new MeshBasicMaterial({ map: arrowTexture(key), color: '#12707e', transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
    [],
  )
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const at = ctrl.standingOnIce
    const show = useLevels.getState().active === LEVEL_INDEX && !!at && !useFrozenGarden.getState().solved
    if (at && group.current) group.current.position.set(cellX(at[0]), 0.09, cellZ(at[1]))
    COMPASS.forEach(({ dir }, i) => {
      const possible = at ? !!slide(at, dir) : false
      mats[i].opacity = MathUtils.damp(mats[i].opacity, show && possible ? 0.95 : 0, 10, dt)
    })
  })
  return (
    <group ref={group}>
      {COMPASS.map(({ dir }, i) => (
        <mesh
          key={i}
          ref={(m) => void (arrows.current[i] = m)}
          material={mats[i]}
          position={[dir[0] * 1.3, 0, dir[1] * 1.3]}
          rotation={[-Math.PI / 2, 0, Math.atan2(-dir[0], -dir[1])]}
          renderOrder={4}
        >
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  )
}

const DOOR_CLOSED: V3 = [1, 1.6, -H - 0.5]

function Door() {
  const body = useRef<RapierRigidBody>(null)
  const t = useRef(0)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    t.current = useFrozenGarden.getState().solved ? t.current + dt : 0
    const k = MathUtils.smoothstep(t.current, 1.6, 4)
    const shudder = k > 0 && k < 1 ? Math.sin(t.current * 70) * 0.02 * (1 - k) : 0
    body.current?.setNextKinematicTranslation({ x: O.x + DOOR_CLOSED[0] + shudder, y: DOOR_CLOSED[1] - k * 3.3, z: O.z + DOOR_CLOSED[2] })
  })
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[O.x + DOOR_CLOSED[0], DOOR_CLOSED[1], O.z + DOOR_CLOSED[2]]}>
      <CuboidCollider args={[1, 1.6, 0.4]} />
      <mesh material={stoneMaterial('#6f777b', { moss: 0 })} castShadow receiveShadow>
        <boxGeometry args={[2, 3.2, 0.8]} />
      </mesh>
    </RigidBody>
  )
}

/** Picks up embers you slide over, and lights the brazier when you arrive with all three. */
function GardenLogic() {
  const resetId = useFrozenGarden((s) => s.resetId)
  const active = useLevels((s) => s.active === LEVEL_INDEX)
  useEffect(() => resetCtrl(), [resetId, active])

  useFrame(() => {
    if (useLevels.getState().active !== LEVEL_INDEX) return
    const garden = useFrozenGarden.getState()
    const cell = cellAt(live.playerPos.x - O.x, live.playerPos.z - O.z)
    EMBERS.forEach((e, i) => {
      if (!garden.embers[i] && same(e, cell)) garden.collect(i)
    })
    const atGoal = same(cell, GOAL) && !ctrl.sliding
    const all = useFrozenGarden.getState().embers.every((t) => t > 0)
    if (atGoal && all && !garden.solved) {
      garden.solve()
      playChime()
      live.celebrateUntil = performance.now() + 2400
      useLevels.getState().markCleared(LEVEL_INDEX)
    }
    const need = atGoal && !all
    if (need !== garden.needEmbers) garden.setNeedEmbers(need)
  })
  return null
}

/** Level 03: slide across the ice, gather three embers, and light the brazier. */
export function FrozenGarden() {
  const active = useLevels((s) => s.active === LEVEL_INDEX)
  const resetId = useFrozenGarden((s) => s.resetId)
  return (
    <>
      <group position={O}>
        <Room />
        <Floor />
        <Boulders />
        <Tree />
        {EMBERS.map((_, i) => (
          <Ember key={i} index={i} />
        ))}
        <Brazier />
        <Snowfall />
        <Compass />
        <GardenLogic />
        <pointLight position={[0, 6, 0]} color="#bfe6ff" intensity={6} distance={18} decay={1.2} />
      </group>
      <Door />
      {active && (
        <Player
          start={PLAYER_START}
          waterY={noWater}
          resetKey={resetId}
          canJump={false}
          override={(inp, pos) => iceOverride(inp, pos)}
        />
      )}
    </>
  )
}
