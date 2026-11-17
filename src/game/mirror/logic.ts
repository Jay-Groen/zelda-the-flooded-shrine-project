/**
 * The Mirror Hall, as a 6×6 grid (cells of 2 units). Column c runs west→east,
 * row r north→south. All coordinates here are local to the level.
 *
 *        c: 0   1   2   3   4   5
 *   r 0     .  [W]  .   .   .   .        W  = window: sunlight enters heading south
 *   r 1     .   |  M4 ← ← M3   .
 *   r 2     .   |   ↓       ↑   .
 *   r 3     .  M1 → → → → M2   .        (solution path)
 *   r 4     .   .   ↓   .   .   .
 *   r 5     .   .   C   .   .   .        C  = crystal
 */

export type MirrorState = '/' | '\\'
export type Cell = readonly [c: number, r: number]

export const CELL = 2
export const GRID = 6
export const HALF = (GRID * CELL) / 2 // room interior is -6..6 on x and z

export const cellX = (c: number) => -HALF + CELL / 2 + c * CELL
export const cellZ = (r: number) => -HALF + CELL / 2 + r * CELL

export const WINDOW_COLUMN = 1
export const CRYSTAL: Cell = [2, 5]

export const MIRRORS: { cell: Cell; solution: MirrorState }[] = [
  { cell: [1, 3], solution: '\\' }, // M1: south → east
  { cell: [4, 3], solution: '/' }, // M2: east → north
  { cell: [4, 1], solution: '\\' }, // M3: north → west
  { cell: [2, 1], solution: '/' }, // M4: west → south
]

/** Every mirror starts turned the wrong way. */
export const START_STATES: MirrorState[] = MIRRORS.map((m) => (m.solution === '/' ? '\\' : '/'))

/**
 * Reflection in grid terms, with north = -r.
 * '/' runs from the south-west corner to the north-east corner of its cell.
 */
function reflect([dc, dr]: [number, number], m: MirrorState): [number, number] {
  return m === '/' ? [-dr, -dc] : [dr, dc]
}

export type BeamTrace = {
  /** Polyline in local x/z, from the window to wherever the light ends. */
  points: [number, number][]
  hitsCrystal: boolean
}

export function traceBeam(states: MirrorState[]): BeamTrace {
  let c = WINDOW_COLUMN
  let r = -1
  let dir: [number, number] = [0, 1]
  const points: [number, number][] = [[cellX(c), -HALF]]

  for (let step = 0; step < GRID * GRID * 4; step++) {
    c += dir[0]
    r += dir[1]
    if (c < 0 || c >= GRID || r < 0 || r >= GRID) {
      // Ends on the wall it runs into.
      points.push([cellX(c) - (dir[0] * CELL) / 2, cellZ(r) - (dir[1] * CELL) / 2])
      return { points, hitsCrystal: false }
    }
    if (c === CRYSTAL[0] && r === CRYSTAL[1]) {
      points.push([cellX(c), cellZ(r)])
      return { points, hitsCrystal: true }
    }
    const i = MIRRORS.findIndex((m) => m.cell[0] === c && m.cell[1] === r)
    if (i >= 0) {
      points.push([cellX(c), cellZ(r)])
      dir = reflect(dir, states[i])
    }
  }
  return { points, hitsCrystal: false }
}
