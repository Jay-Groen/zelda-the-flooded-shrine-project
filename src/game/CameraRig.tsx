import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Vector3, type PerspectiveCamera } from 'three'
import { CAMERA_DIR, CAMERA_FOV } from './constants'
import { live } from './store'
import { cameraAmount } from './sun'

/** Middle of the shrine, including the terrace, door and east niche. */
const ROOM_CENTER = new Vector3(0.8, 0.5, -2.5)
/** Radius that has to stay in frame to see the whole room as a diorama. */
const FIT_RADIUS = 15
/** How much the view drifts toward the player (0 = fixed diorama). */
const FOLLOW = 0.12
/** Finale framing: the exit door with the sunbeam pouring out of it. */
const FINALE_FOCUS = new Vector3(2, 3, -7)
const FINALE_ZOOM = 0.55

const DIR = new Vector3(...CAMERA_DIR).normalize()

/**
 * Diorama camera: looks at the room from the south-west corner, high up, with a
 * narrow lens so it reads almost isometric. The distance is fitted to the
 * screen's aspect ratio so the whole room is always visible.
 */
export function CameraRig() {
  const focus = useRef(ROOM_CENTER.clone())
  const desiredFocus = new Vector3()
  const desiredPos = new Vector3()

  useFrame(({ camera, size }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const cam = camera as PerspectiveCamera
    if (cam.fov !== CAMERA_FOV) {
      cam.fov = CAMERA_FOV
      cam.updateProjectionMatrix()
    }

    const p = live.playerPos
    desiredFocus.set(p.x, Math.max(p.y, -1), p.z).sub(ROOM_CENTER).multiplyScalar(FOLLOW).add(ROOM_CENTER)

    // Finale: glide toward the door while it opens, then back out.
    const cine = cameraAmount(live.chestT)
    desiredFocus.lerp(FINALE_FOCUS, cine)

    // Fit the room in whichever of the two field-of-view angles is smaller.
    const vHalf = MathUtils.degToRad(CAMERA_FOV / 2)
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / size.height))
    const distance = (FIT_RADIUS / Math.sin(Math.min(vHalf, hHalf))) * (1 + (FINALE_ZOOM - 1) * cine)

    const k = 1 - Math.exp(-(cine > 0 ? 2 : 3) * dt)
    focus.current.lerp(desiredFocus, k)
    desiredPos.copy(focus.current).addScaledVector(DIR, distance)
    camera.position.lerp(desiredPos, k)
    camera.lookAt(focus.current)
  })

  return null
}
