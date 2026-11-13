import { create } from 'zustand'
import { Vector2, Vector3 } from 'three'
import { ALCOVE_CELL, START_LEVEL, WATER_LEVELS, type Cell } from './constants'
import type { Pose } from './Explorer'

type GameState = {
  /** Index into WATER_LEVELS the water is moving towards. */
  level: number
  raise: () => void
  lower: () => void
  platformCell: Cell
  setPlatformCell: (c: Cell) => void
  nearChest: boolean
  setNearChest: (near: boolean) => void
  chestOpen: boolean
  openChest: () => void
  finished: boolean
  finish: () => void
  /** Story beats after the chest opens: 0 none, 1 treasure shown, 2 exit revealed. */
  beat: number
  setBeat: (beat: number) => void
  startedAt: number
  finishedAt: number
  /** Which switch button the pointer is over, so the level it targets can light up. */
  hover: 'up' | 'down' | null
  setHover: (h: 'up' | 'down' | null) => void
  resetId: number
  reset: () => void
}

export const useGame = create<GameState>((set) => ({
  level: START_LEVEL,
  raise: () => set((s) => ({ level: Math.min(s.level + 1, WATER_LEVELS.length - 1) })),
  lower: () => set((s) => ({ level: Math.max(s.level - 1, 0) })),
  platformCell: ALCOVE_CELL,
  setPlatformCell: (platformCell) => set({ platformCell }),
  nearChest: false,
  setNearChest: (nearChest) => set({ nearChest }),
  chestOpen: false,
  openChest: () => set({ chestOpen: true }),
  finished: false,
  finish: () => set({ finished: true, finishedAt: performance.now() }),
  beat: 0,
  setBeat: (beat) => set({ beat }),
  startedAt: performance.now(),
  finishedAt: 0,
  hover: null,
  setHover: (hover) => set({ hover }),
  resetId: 0,
  reset: () => {
    live.waterY = WATER_LEVELS[START_LEVEL]
    set((s) => ({
      level: START_LEVEL,
      platformCell: ALCOVE_CELL,
      chestOpen: false,
      nearChest: false,
      finished: false,
      beat: 0,
      startedAt: performance.now(),
      finishedAt: 0,
      resetId: s.resetId + 1,
    }))
  },
}))

/** Per-frame values. Mutated in useFrame, never trigger React renders. */
export const live = {
  waterY: WATER_LEVELS[START_LEVEL] as number,
  playerPos: new Vector3(),
  /** Input direction in world XZ (x = east, y = south). */
  moveDir: new Vector2(),
  /** Standing on something solid and not swimming. */
  grounded: false,
  platformPos: new Vector3(),
  /** Seconds since the chest opened, -1 while closed. Drives the whole finale. */
  chestT: -1,
  /** Leaning on the platform block (whether or not it slides yet). */
  pushing: false,
  /** Animation the character should play. */
  pose: 'Idle' as Pose,
}

/** True while the finale's camera move plays; the player can't move. */
export const cutsceneActive = () => live.chestT >= 0 && live.chestT < 6.4

if (import.meta.env.DEV) {
  Object.assign(window, { __shrine: { useGame, live } })
}
