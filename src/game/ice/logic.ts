/**
 * The Frozen Garden: a 6×6 grid (cells of 2 units), column c west→east,
 * row r north→south, local to the level.
 *
 *   .  ice: step on it and you slide until something stops you
 *   #  frozen boulder (T is the frozen tree; it blocks like a boulder)
 *   s  snow: you stop on it and can walk freely
 *   G  snow island with the brazier (the goal)
 *   e  ember lying on the ice; sliding over it picks it up
 *
 * Chosen with a breadth-first solver: the shortest solution is 13 slides, every
 * position can still get back to the entrance (no soft-locks), and all three
 * embers are needed.
 */
export const MAP = [
  '..#G..',
  'e#...#',
  '...Ts.',
  '#.e..#',
  'e##...',
  'ssssss',
]

export const N = 6
export const CELL = 2
export const HALF = (N * CELL) / 2

export type Cell = readonly [c: number, r: number]
export type Dir = readonly [dc: number, dr: number]
export type Tile = 'ice' | 'rock' | 'tree' | 'snow' | 'goal'

export const cellX = (c: number) => -HALF + CELL / 2 + c * CELL
export const cellZ = (r: number) => -HALF + CELL / 2 + r * CELL
/** Cell under a local position (may be outside the grid). */
export const cellAt = (x: number, z: number): Cell => [Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)]

export function tile([c, r]: Cell): Tile | null {
  if (c < 0 || r < 0 || c >= N || r >= N) return null
  switch (MAP[r][c]) {
    case '#':
      return 'rock'
    case 'T':
      return 'tree'
    case 's':
      return 'snow'
    case 'G':
      return 'goal'
    default:
      return 'ice'
  }
}

export const isSnow = (t: Tile | null) => t === 'snow' || t === 'goal'
export const isSolid = (t: Tile | null) => t === null || t === 'rock' || t === 'tree'

export const EMBERS: Cell[] = []
export let GOAL: Cell = [0, 0]
export const ROCKS: Cell[] = []
export let TREE: Cell = [0, 0]
export const SNOW: Cell[] = []
MAP.forEach((row, r) =>
  [...row].forEach((ch, c) => {
    if (ch === 'e') EMBERS.push([c, r])
    if (ch === 'G') GOAL = [c, r]
    if (ch === '#') ROCKS.push([c, r])
    if (ch === 'T') TREE = [c, r]
    if (ch === 's') SNOW.push([c, r])
  }),
)

/**
 * Slide from `from` in `dir`. Returns the cell where the slide ends (on ice next
 * to an obstacle, or on the first snow cell reached) and every cell passed.
 * Null when the first step is blocked.
 */
export function slide(from: Cell, dir: Dir): { end: Cell; passed: Cell[] } | null {
  let [c, r] = from
  const passed: Cell[] = []
  while (true) {
    const next: Cell = [c + dir[0], r + dir[1]]
    if (isSolid(tile(next))) break
    ;[c, r] = next
    passed.push(next)
    if (isSnow(tile(next))) break
  }
  return passed.length ? { end: [c, r], passed } : null
}

/**
 * Keyboard direction while standing on ice. The grid runs diagonally on screen,
 * so the screen-relative input is turned 45°: W ↗ east, D ↘ south, S ↙ west, A ↖ north.
 */
export function gridDirFromInput(x: number, z: number): Dir | null {
  if (x === 0 && z === 0) return null
  const a = Math.atan2(z, x) + Math.PI / 4
  const q = Math.round(a / (Math.PI / 2))
  const dirs: Dir[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]
  return dirs[((q % 4) + 4) % 4]
}
