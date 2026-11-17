import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { stoneMaterial } from './shaders/stoneMaterial'

type V3 = [number, number, number]
type Block = {
  min: V3
  max: V3
  color?: string
  /** false = invisible wall (collider only). */
  visible?: boolean
  /** false = decoration only. */
  collider?: boolean
}

const STONE = '#8d8a7e'
const FLOOR = '#9a9585'
const POOL = '#6f6c62'
const TERRACE = '#a8a08c'
const WALL = '#7c786b'

/** Every static piece of the shrine as an axis-aligned box. */
export const BLOCKS: Block[] = [
  // pool bed under everything
  { min: [-10, -4, -10], max: [10, -3, 10], color: POOL },
  // west walkway
  { min: [-10, -3, -5], max: [-5, 0, 10], color: FLOOR },
  // south entrance
  { min: [-5, -3, 5], max: [10, 0, 10], color: FLOOR },
  // east walkway: north part, south part, and the thin slab over the tunnel
  { min: [5, -3, -5], max: [10, 0, -2.5], color: FLOOR },
  { min: [5, -3, 0], max: [10, 0, 5], color: FLOOR },
  { min: [5, -0.5, -2.5], max: [7.5, 0, 0], color: STONE },
  // north terrace — the ledge with the chest
  { min: [-10, -3, -10], max: [10, 4, -5], color: TERRACE },

  // outer walls
  // west wall faces the camera: invisible collider + a low visible lip
  { min: [-11, -4, -11], max: [-10, 10, 11], visible: false },
  { min: [-11, -4, -11], max: [-10, 0.5, 11], color: WALL, collider: false },
  { min: [10, -4, -11], max: [11, 10, -2.5], color: WALL }, // east, north of the niche
  { min: [10, -4, 0], max: [11, 10, 11], color: WALL }, // east, south of the niche
  // niche behind the alcove so the player can get behind the block and push it west
  { min: [10, -4, -2.5], max: [12.5, -3, 0], color: POOL },
  { min: [10, -4, -3.5], max: [13.5, 10, -2.5], color: WALL },
  { min: [10, -4, 0], max: [13.5, 10, 1], color: WALL },
  { min: [12.5, -4, -2.5], max: [13.5, 10, 0], color: WALL },
  { min: [-11, -4, -11], max: [2, 10, -10], color: WALL }, // north, left of the door
  { min: [5, -4, -11], max: [11, 10, -10], color: WALL }, // north, right of the door
  { min: [2, 7.5, -11], max: [5, 10, -10], color: WALL }, // door lintel
  // south wall faces the camera: invisible collider + a low visible lip
  { min: [-11, -4, 10], max: [11, 10, 11], visible: false },
  { min: [-11, -4, 10], max: [11, 0.5, 11], color: WALL, collider: false },

  // exit corridor behind the door
  { min: [2, -4, -16], max: [5, 4, -11], color: TERRACE },
  { min: [1, 4, -16], max: [2, 8, -11], color: WALL },
  { min: [5, 4, -16], max: [6, 8, -11], color: WALL },
  { min: [1, 4, -17], max: [6, 8, -16], color: WALL },
  { min: [1, 7.5, -17], max: [6, 8.2, -11], color: WALL, collider: false }, // corridor roof
]

export function Room() {
  return (
    <RigidBody type="fixed" colliders={false}>
      {BLOCKS.map((b, i) => {
        const size: V3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
        const center: V3 = [
          (b.max[0] + b.min[0]) / 2,
          (b.max[1] + b.min[1]) / 2,
          (b.max[2] + b.min[2]) / 2,
        ]
        return (
          <group key={i}>
            {b.visible !== false && (
              <mesh position={center} material={stoneMaterial(b.color ?? STONE)} castShadow receiveShadow>
                <boxGeometry args={size} />
              </mesh>
            )}
            {b.collider !== false && (
              <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={center} />
            )}
          </group>
        )
      })}
    </RigidBody>
  )
}
