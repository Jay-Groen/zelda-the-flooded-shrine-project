import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { MathUtils, type Group, type Mesh } from 'three'
import { live } from './store'

/** Built by tools/make_explorer.py. */
const MODEL_URL = `${import.meta.env.BASE_URL}models/explorer.glb`
/** The model is ~2.45 units tall; the player capsule is 1.8. */
const MODEL_SCALE = 0.76
/** Capsule centre to feet. */
const FOOT_OFFSET = -0.9
const FADE = 0.2

export type Pose = 'Idle' | 'Walk' | 'Swim' | 'Jump' | 'Push' | 'Hold'

/**
 * The shrine explorer. Sits inside the player's (yaw-rotated) visual group and
 * plays whatever pose the player controller asks for in live.pose.
 */
export function Explorer() {
  const pitch = useRef<Group>(null)
  const root = useRef<Group>(null)
  const { scene, animations } = useGLTF(MODEL_URL)
  const { actions } = useAnimations(animations, root)
  const current = useRef<Pose | null>(null)

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }, [scene])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const pose = live.pose
    if (pose !== current.current) {
      if (current.current) actions[current.current]?.fadeOut(FADE)
      actions[pose]?.reset().fadeIn(FADE).play()
      current.current = pose
    }

    // Walk cadence follows the actual speed; strokes slow down when treading water.
    const moving = live.moveDir.lengthSq() > 0
    const walk = actions.Walk
    if (walk) walk.timeScale = 1.35
    const swim = actions.Swim
    if (swim) swim.timeScale = moving ? 1.1 : 0.55

    // Lean into the water when swimming, so the strokes read as swimming.
    if (pitch.current) {
      const lean = pose === 'Swim' ? (moving ? 1.05 : 0.35) : 0
      pitch.current.rotation.x = MathUtils.damp(pitch.current.rotation.x, lean, 8, dt)
      pitch.current.position.y = MathUtils.damp(pitch.current.position.y, pose === 'Swim' ? 0.2 : 0, 8, dt)
    }
  })

  return (
    <group ref={pitch}>
      <group ref={root} position-y={FOOT_OFFSET} scale={MODEL_SCALE} dispose={null}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
