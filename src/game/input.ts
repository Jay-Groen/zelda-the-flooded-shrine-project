import { CAMERA_DIR } from './constants'

const held = new Set<string>()
let jumpQueued = false
let interactQueued = false

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
])

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault()
  if (!e.repeat) {
    if (e.code === 'Space') jumpQueued = true
    if (e.code === 'KeyE') interactQueued = true
  }
  held.add(e.code)
})
window.addEventListener('keyup', (e) => held.delete(e.code))
window.addEventListener('blur', () => held.clear())

const any = (...codes: string[]) => codes.some((c) => held.has(c))

// Screen-relative movement: "up" walks into the screen along the camera's view.
const viewLen = Math.hypot(CAMERA_DIR[0], CAMERA_DIR[2])
const FORWARD = { x: -CAMERA_DIR[0] / viewLen, z: -CAMERA_DIR[2] / viewLen }
const RIGHT = { x: -FORWARD.z, z: FORWARD.x }

export const input = {
  /** Normalised movement in world XZ (x = east, z = south), relative to the camera. */
  axis() {
    const right = (any('KeyD', 'ArrowRight') ? 1 : 0) - (any('KeyA', 'ArrowLeft') ? 1 : 0)
    const up = (any('KeyW', 'ArrowUp') ? 1 : 0) - (any('KeyS', 'ArrowDown') ? 1 : 0)
    let x = RIGHT.x * right + FORWARD.x * up
    let z = RIGHT.z * right + FORWARD.z * up
    const len = Math.hypot(x, z)
    if (len > 0) {
      x /= len
      z /= len
    }
    return { x, z }
  },
  consumeJump() {
    const j = jumpQueued
    jumpQueued = false
    return j
  },
  consumeInteract() {
    const i = interactQueued
    interactQueued = false
    return i
  },
}
