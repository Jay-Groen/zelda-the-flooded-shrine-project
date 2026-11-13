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

export const input = {
  /** Normalised movement in world XZ: x = east, z = south (camera faces north). */
  axis() {
    let x = (any('KeyD', 'ArrowRight') ? 1 : 0) - (any('KeyA', 'ArrowLeft') ? 1 : 0)
    let z = (any('KeyS', 'ArrowDown') ? 1 : 0) - (any('KeyW', 'ArrowUp') ? 1 : 0)
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
