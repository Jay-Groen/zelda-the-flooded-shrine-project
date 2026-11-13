import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { live } from './store'
import { cameraAmount } from './sun'

const OFFSET = new Vector3(0, 19, 15)
/** 0 = locked on the room centre, 1 = locked on the player. */
const FOLLOW = 0.35
/** Finale framing: the exit door with the sunbeam pouring out of it. */
const FINALE_FOCUS = new Vector3(2, 2.5, -6.5)
const FINALE_ZOOM = 0.62

/** Fixed-angle dungeon camera that drifts toward the player but keeps the room framed. */
export function CameraRig() {
  const focus = useRef(new Vector3(0, 0, 0))
  const desiredFocus = new Vector3()
  const desiredPos = new Vector3()

  useFrame(({ camera, size }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const p = live.playerPos
    desiredFocus.set(p.x * FOLLOW, Math.max(p.y, -1) * 0.5, p.z * FOLLOW - 1.5)

    // Finale: glide over to the door while it opens, then hand control back.
    const cine = cameraAmount(live.chestT)
    desiredFocus.lerp(FINALE_FOCUS, cine)

    const k = 1 - Math.exp(-(cine > 0 ? 2 : 3) * dt)
    focus.current.lerp(desiredFocus, k)
    // Narrow screens: pull back so the full width of the room stays in view.
    const zoomOut = Math.min(2.4, Math.max(1, 1.5 / (size.width / size.height)))
    const zoom = zoomOut * (1 + (FINALE_ZOOM - 1) * cine)
    desiredPos.copy(focus.current).addScaledVector(OFFSET, zoom)
    camera.position.lerp(desiredPos, k)
    camera.lookAt(focus.current)
  })

  return null
}
