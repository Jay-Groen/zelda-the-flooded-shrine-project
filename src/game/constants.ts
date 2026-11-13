/**
 * Layout of the shrine (y is up, the camera looks north = -z).
 *
 *   z = -10 ┌──────────── north terrace (top y=4) ───────┐  chest + exit door
 *   z =  -5 ├──────┬──────────── pool ──────────┬────────┤
 *           │ west │  4x4 cells of 2.5, floor -3 │ tunnel │ alcove pit │ niche (x 10..12.5)
 *           │ walk │                             │ (z -2.5..0, under the east walkway)
 *   z =   5 ├──────┴─────── entrance (y=0) ──────┴────────┤
 *   z =  10 └─────────────────────────────────────────────┘
 *          x=-10  -5                              5       10
 */

export const CELL = 2.5
export const POOL_FLOOR = -3
export const TERRACE_TOP = 4

/** Water heights for the three switch positions: LOW, MID, HIGH. */
export const WATER_LEVELS = [-2.6, -0.5, 2.5] as const
export const LEVEL_NAMES = ['Low', 'Middle', 'High'] as const
export const START_LEVEL = 1
/** Units per second the waterline moves. */
export const WATER_SPEED = 1.5

/** Floating stone platform. */
export const PLATFORM_HALF = { x: 1.2, y: 1.1, z: 1.2 }
export const PLATFORM_REST_Y = POOL_FLOOR + PLATFORM_HALF.y
/** Platform centre sits this far above the waterline (top = water + 1.5). */
export const PLATFORM_FLOAT_OFFSET = 0.4
/** Seconds the player has to lean on the block before it slides one cell. */
export const PUSH_DELAY = 0.35
export const PUSH_SPEED = 5

/** The tunnel ceiling: the platform cannot rise while it is inside it. */
export const TUNNEL_X = [5, 7.5] as const

export type Cell = readonly [number, number]

export const cellX = (ix: number) => -3.75 + CELL * ix
export const cellZ = (iz: number) => -3.75 + CELL * iz

export const ALCOVE_CELL: Cell = [5, 1]
export const TUNNEL_CELL: Cell = [4, 1]

export function isCellAllowed([ix, iz]: Cell) {
  const inPool = ix >= 0 && ix <= 3 && iz >= 0 && iz <= 3
  const inPassage = iz === 1 && (ix === TUNNEL_CELL[0] || ix === ALCOVE_CELL[0])
  return inPool || inPassage
}

/** Finale: sunlight pours in through the exit door from a sun inside the corridor. */
export const SUN_POS: [number, number, number] = [3.5, 7.2, -15.5]
export const SUN_TARGET: [number, number, number] = [1.5, -1.5, 3]
export const DOOR_CENTER: [number, number, number] = [3.5, 5.75, -10.5]
export const BEAM_LENGTH = 15
export const BEAM_RADIUS: [top: number, bottom: number] = [1.5, 3.4]

export const PLAYER_START: [number, number, number] = [0, 1.5, 7.5]
export const CHEST_POS: [number, number, number] = [-3.75, TERRACE_TOP, -7.5]

/** Player physics. Gravity is -20. */
export const GRAVITY = -20
export const MOVE_SPEED = 5.5
export const SWIM_SPEED = 3.2
export const JUMP_VELOCITY = 7.5 // ~1.4 units high
export const SWIM_JUMP_VELOCITY = 8.9 // ~2.0 units: enough to climb out, not onto the platform
