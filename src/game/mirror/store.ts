import { create } from 'zustand'
import { START_STATES, type MirrorState } from './logic'

type MirrorHallState = {
  states: MirrorState[]
  toggle: (i: number) => void
  /** Index of the mirror the player can reach (-1 none), for the HUD prompt. */
  reachable: number
  setReachable: (i: number) => void
  solved: boolean
  solve: () => void
  resetId: number
  reset: () => void
}

export const useMirrorHall = create<MirrorHallState>((set) => ({
  states: START_STATES,
  toggle: (i) =>
    set((s) => ({ states: s.states.map((m, j) => (j === i ? (m === '/' ? '\\' : '/') : m)) })),
  reachable: -1,
  setReachable: (reachable) => set({ reachable }),
  solved: false,
  solve: () => set({ solved: true }),
  resetId: 0,
  reset: () => set((s) => ({ states: START_STATES, solved: false, resetId: s.resetId + 1 })),
}))
