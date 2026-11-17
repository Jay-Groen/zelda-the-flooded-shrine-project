import { create } from 'zustand'
import { EMBERS } from './logic'

type FrozenGardenState = {
  /** performance.now() when each ember was picked up, or 0. */
  embers: number[]
  collect: (i: number) => void
  /** Standing at the brazier without all embers. */
  needEmbers: boolean
  setNeedEmbers: (v: boolean) => void
  solved: boolean
  solve: () => void
  resetId: number
  reset: () => void
}

export const useFrozenGarden = create<FrozenGardenState>((set) => ({
  embers: EMBERS.map(() => 0),
  collect: (i) => set((s) => ({ embers: s.embers.map((t, j) => (j === i && !t ? performance.now() : t)) })),
  needEmbers: false,
  setNeedEmbers: (needEmbers) => set({ needEmbers }),
  solved: false,
  solve: () => set({ solved: true }),
  resetId: 0,
  reset: () =>
    set((s) => ({ embers: EMBERS.map(() => 0), needEmbers: false, solved: false, resetId: s.resetId + 1 })),
}))
