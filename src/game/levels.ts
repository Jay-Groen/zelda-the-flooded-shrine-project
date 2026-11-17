import { create } from 'zustand'
import { Vector3 } from 'three'

export type LevelInfo = {
  /** "Level 01" etc. */
  number: string
  name: string
  /** World-space centre the diorama camera frames. */
  center: Vector3
  /** Radius that must stay in frame to see the whole diorama. */
  fitRadius: number
}

/**
 * Levels stand side by side in one world. Each one is offset along the
 * camera's screen-right axis (+x +z), so the camera slides sideways between them.
 */
export const MIRROR_HALL_OFFSET = new Vector3(34, 0, 34)
export const FROZEN_GARDEN_OFFSET = new Vector3(68, 0, 68)

export const LEVELS: LevelInfo[] = [
  { number: '01', name: 'The Flooded Shrine', center: new Vector3(0.8, 0.5, -2.5), fitRadius: 15 },
  {
    number: '02',
    name: 'The Mirror Hall',
    center: MIRROR_HALL_OFFSET.clone().add(new Vector3(0, 0.5, -0.5)),
    fitRadius: 10.5,
  },
  {
    number: '03',
    name: 'The Frozen Garden',
    center: FROZEN_GARDEN_OFFSET.clone().add(new Vector3(0, 0.5, -0.5)),
    fitRadius: 10.5,
  },
]

type LevelState = {
  active: number
  go: (index: number) => void
  cleared: boolean[]
  markCleared: (index: number) => void
}

export const useLevels = create<LevelState>((set) => ({
  active: 0,
  go: (index) => set({ active: Math.max(0, Math.min(LEVELS.length - 1, index)) }),
  cleared: LEVELS.map(() => false),
  markCleared: (index) => set((s) => ({ cleared: s.cleared.map((c, i) => c || i === index) })),
}))
