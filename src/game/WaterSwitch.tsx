import { useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { AdditiveBlending, MeshBasicMaterial } from 'three'
import { WATER_LEVELS } from './constants'
import { glyphTexture, runeGlow } from './runes'
import { useGame } from './store'
import { stoneMaterial } from './shaders/stoneMaterial'

const POS: [number, number, number] = [-7.5, 0, 1.5]
const H = 1.2

/** Stone pedestal with a raise (▲) and lower (▼) button. Click with the mouse. */
export function WaterSwitch() {
  const level = useGame((s) => s.level)
  const hover = useGame((s) => s.hover)
  const { raise, lower, setHover } = useGame.getState()

  const canRaise = level < WATER_LEVELS.length - 1
  const canLower = level > 0

  const bind = (which: 'up' | 'down', action: () => void, enabled: boolean) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (enabled) action()
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHover(which)
      document.body.style.cursor = enabled ? 'pointer' : 'not-allowed'
    },
    onPointerOut: () => {
      setHover(null)
      document.body.style.cursor = ''
    },
  })

  return (
    <group position={POS}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.55, H / 2, 0.55]} position-y={H / 2} />
      </RigidBody>
      <mesh position-y={H / 2} material={stoneMaterial('#8f8a7c', { moss: 0.3, blocks: 0 })} castShadow receiveShadow>
        <boxGeometry args={[1.1, H, 1.1]} />
      </mesh>

      <SwitchButton which="up" x={0.28} enabled={canRaise} hovered={hover === 'up'} {...bind('up', raise, canRaise)} />
      <SwitchButton which="down" x={-0.28} enabled={canLower} hovered={hover === 'down'} {...bind('down', lower, canLower)} />

      <PedestalGlyphs />
    </group>
  )
}

/** The same three level glyphs as on the terrace wall, stacked on the camera-facing side. */
function PedestalGlyphs() {
  const mats = useMemo(
    () =>
      WATER_LEVELS.map(
        (_, i) =>
          new MeshBasicMaterial({
            map: glyphTexture(i),
            color: '#7ff0ff',
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [],
  )
  useFrame(() => {
    mats.forEach((m, i) => {
      m.opacity = Math.min(1, 0.2 + runeGlow[i])
      m.color.set('#7ff0ff').multiplyScalar(0.3 + runeGlow[i])
    })
  })
  return (
    <>
      {mats.map((m, i) => (
        <mesh key={i} material={m} position={[0, 0.22 + i * 0.36, 0.56]}>
          <planeGeometry args={[0.34, 0.34]} />
        </mesh>
      ))}
    </>
  )
}

type ButtonProps = {
  which: 'up' | 'down'
  x: number
  enabled: boolean
  hovered: boolean
  onClick: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut: () => void
}

/** A cone you can see, inside a bigger invisible box you can click. */
function SwitchButton({ which, x, enabled, hovered, ...handlers }: ButtonProps) {
  const color = !enabled ? '#555' : hovered ? '#9ff3ff' : '#4fb3c9'
  return (
    <group position={[x, H + 0.3, 0]}>
      <mesh rotation-z={which === 'down' ? Math.PI : 0} castShadow>
        <coneGeometry args={[0.3, 0.5, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered && enabled ? 0.8 : 0.2} />
      </mesh>
      <mesh {...handlers}>
        <boxGeometry args={[0.6, 0.9, 1.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
