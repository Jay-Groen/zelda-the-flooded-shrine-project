import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { live, useGame } from './store'
import { stoneMaterial } from './shaders/stoneMaterial'
import { doorAmount } from './sun'

const CLOSED = { x: 3.5, y: 5.75, z: -10.5 }
const DROP = 3.8

/** Sealed exit door in the north wall. Sinks into the floor after the chest opens. */
export function Door() {
  const body = useRef<RapierRigidBody>(null)
  useFrame(() => {
    const { chestOpen, finished, finish } = useGame.getState()
    // Small shudder as the seal breaks, then the slab grinds down into the floor.
    const t = live.chestT
    const k = doorAmount(t)
    const shudder = k > 0 && k < 1 ? Math.sin(t * 70) * 0.02 * (1 - k) : 0
    body.current?.setNextKinematicTranslation({ x: CLOSED.x + shudder, y: CLOSED.y - k * DROP, z: CLOSED.z })

    // Walking through the doorway ends the run.
    const p = live.playerPos
    if (!finished && chestOpen && p.z < -12 && p.y > 3) finish()
  })

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[CLOSED.x, CLOSED.y, CLOSED.z]}>
      <CuboidCollider args={[1.5, 1.75, 0.3]} />
      <mesh material={stoneMaterial('#66625a', { moss: 0.5 })} castShadow receiveShadow>
        <boxGeometry args={[3, 3.5, 0.6]} />
      </mesh>
    </RigidBody>
  )
}
