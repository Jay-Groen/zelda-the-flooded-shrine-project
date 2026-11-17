import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { AdditiveBlending, MathUtils, MeshBasicMaterial, type Group, type PointLight } from 'three'
import { CHEST_POS } from './constants'
import { input } from './input'
import { live, useGame } from './store'
import { playChime } from './audio'
import { haloTexture } from './runes'
import { FINALE } from './sun'
import { useLevels } from './levels'

const REACH = 2.3
const OPEN_ANGLE = -1.9
const easeOutBack = (t: number) => {
  const c = 1.6
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

export function Chest() {
  const lid = useRef<Group>(null)
  const openT = useRef(0)

  const tryOpen = () => {
    const s = useGame.getState()
    if (s.chestOpen || !s.nearChest) return
    s.openChest()
    playChime()
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const s = useGame.getState()

    const dx = live.playerPos.x - CHEST_POS[0]
    const dz = live.playerPos.z - CHEST_POS[2]
    const dy = live.playerPos.y - CHEST_POS[1]
    const near = Math.hypot(dx, dz) < REACH && Math.abs(dy) < 2
    if (near !== s.nearChest) s.setNearChest(near)

    if (useLevels.getState().active === 0 && input.consumeInteract()) tryOpen()

    // lid: brief wobble, then swing open with a little overshoot
    openT.current = s.chestOpen ? Math.min(1, openT.current + dt / 1.1) : 0
    if (lid.current) {
      const t = openT.current
      const wobble = t < 0.25 ? Math.sin(t * 60) * 0.04 * (1 - t / 0.25) : 0
      const swing = t < 0.25 ? 0 : easeOutBack(MathUtils.clamp((t - 0.25) / 0.75, 0, 1))
      lid.current.rotation.x = swing * OPEN_ANGLE + wobble
    }
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    tryOpen()
  }

  return (
    <group position={CHEST_POS}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.65, 0.5, 0.45]} position-y={0.5} />
      </RigidBody>
      <group onClick={onClick}>
        <mesh position-y={0.35} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.7, 0.9]} />
          <meshStandardMaterial color="#7a5a36" />
        </mesh>
        {/* lid hinges on the back (-z) edge */}
        <group ref={lid} position={[0, 0.7, -0.45]}>
          <mesh position={[0, 0.15, 0.45]} castShadow>
            <boxGeometry args={[1.32, 0.3, 0.92]} />
            <meshStandardMaterial color="#8b6a40" />
          </mesh>
          <mesh position={[0, 0.1, 0.92]}>
            <boxGeometry args={[0.2, 0.25, 0.04]} />
            <meshStandardMaterial color="#d8b24a" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** The treasure: a pearl that rises out of the chest and hangs there, glowing. */
export function TidePearl() {
  const group = useRef<Group>(null)
  const light = useRef<PointLight>(null)
  const haloMat = useMemo(
    () =>
      new MeshBasicMaterial({
        map: haloTexture(),
        color: '#ffe7b8',
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  useFrame(({ camera }) => {
    const t = live.chestT
    const g = group.current
    if (!g) return
    g.visible = t >= FINALE.pearlRise[0]
    if (!g.visible) {
      if (light.current) light.current.intensity = 0
      return
    }
    const [a, b] = FINALE.pearlRise
    const k = MathUtils.clamp((t - a) / (b - a), 0, 1)
    const rise = 1 - Math.pow(1 - k, 3)
    g.position.set(CHEST_POS[0], CHEST_POS[1] + 0.45 + rise * 1.35 + Math.sin(t * 2) * 0.06 * k, CHEST_POS[2])
    g.rotation.y = t * 1.5
    g.scale.setScalar(0.4 + 0.6 * rise)
    haloMat.opacity = 0.35 + 0.15 * Math.sin(t * 3)
    // keep the halo facing the camera
    g.children[1]?.quaternion.copy(camera.quaternion).premultiply(g.quaternion.clone().invert())
    if (light.current) light.current.intensity = 6 * Math.min(1, (t - a) * 2)
  })

  return (
    <group ref={group} visible={false}>
      <mesh castShadow>
        <sphereGeometry args={[0.28, 32, 16]} />
        <meshStandardMaterial color="#f4ecdf" emissive="#ffd9a6" emissiveIntensity={0.9} roughness={0.15} metalness={0.1} />
      </mesh>
      <mesh material={haloMat} renderOrder={5}>
        <planeGeometry args={[1.6, 1.6]} />
      </mesh>
      <pointLight ref={light} color="#ffcf8a" intensity={0} distance={7} decay={1.5} />
    </group>
  )
}
