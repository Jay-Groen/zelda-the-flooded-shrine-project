import { MathUtils, Vector3 } from 'three'
import { DOOR_CENTER, SUN_POS, SUN_TARGET } from './constants'

/** Direction the sunbeam travels: from the corridor, through the door, into the pool. */
export const BEAM_DIR = new Vector3(...SUN_TARGET).sub(new Vector3(...SUN_POS)).normalize()
export const BEAM_ORIGIN = new Vector3(...DOOR_CENTER)

/**
 * The finale timeline, in seconds since the chest opened.
 * Everything that animates in the finale reads these, so the beats line up.
 */
export const FINALE = {
  pearlRise: [0.3, 1.6],
  cameraIn: [1.0, 2.2],
  doorSink: [1.4, 3.9],
  sunRise: [1.6, 4.2],
  runeCascade: 1.9,
  cameraOut: [5.4, 6.8],
} as const

const ramp = (t: number, [a, b]: readonly [number, number]) => MathUtils.smoothstep(t, a, b)

/** 0..1 how much sunlight has spilled in (follows the sinking door). */
export const sunAmount = (t: number) => (t < 0 ? 0 : ramp(t, FINALE.sunRise))
export const doorAmount = (t: number) => (t < 0 ? 0 : ramp(t, FINALE.doorSink))
/** 0..1 how far the camera has moved to frame the door. */
export const cameraAmount = (t: number) =>
  t < 0 ? 0 : ramp(t, FINALE.cameraIn) * (1 - ramp(t, FINALE.cameraOut))
