import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Vector3, type PerspectiveCamera } from 'three'
import { CAMERA_DIR, CAMERA_FOV } from './constants'
import { live } from './store'
import { LEVELS, useLevels } from './levels'
import { cameraAmount } from './sun'

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
  const focus = useRef(LEVELS[0].center.clone())
  const radius = useRef(LEVELS[0].fitRadius)
  const desiredFocus = new Vector3()
  const desiredPos = new Vector3()

  useFrame(({ camera, size }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const cam = camera as PerspectiveCamera
    if (cam.fov !== CAMERA_FOV) {
      cam.fov = CAMERA_FOV
      cam.updateProjectionMatrix()
    }

    const active = useLevels.getState().active
    const level = LEVELS[active]
    const center = level.center
    const p = live.playerPos
    // Drift a little toward the player, but only once the player is in this level.
    const near = p.distanceTo(center) < level.fitRadius * 1.5
    desiredFocus.copy(center)
    if (near) desiredFocus.add(desiredPos.set(p.x, Math.max(p.y, -1), p.z).sub(center).multiplyScalar(FOLLOW))

    // Finale of level 1: glide toward the door while it opens, then back out.
    const cine = active === 0 ? cameraAmount(live.chestT) : 0
    desiredFocus.lerp(FINALE_FOCUS, cine)
    radius.current = MathUtils.damp(radius.current, level.fitRadius, 3, dt)
    live.cameraFocus.copy(focus.current)

    // Fit the room in whichever of the two field-of-view angles is smaller.
    const vHalf = MathUtils.degToRad(CAMERA_FOV / 2)
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / size.height))
    const distance = (radius.current / Math.sin(Math.min(vHalf, hHalf))) * (1 + (FINALE_ZOOM - 1) * cine)

    const k = 1 - Math.exp(-(cine > 0 ? 2 : 3) * dt)
    focus.current.lerp(desiredFocus, k)
    desiredPos.copy(focus.current).addScaledVector(DIR, distance)
    camera.position.lerp(desiredPos, k)
    camera.lookAt(focus.current)
  })

  return null
}
