import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { BACKGROUND, CAMERA_FOV, GRAVITY } from './game/constants'
import { Room } from './game/Room'
import { Water } from './game/Water'
import { LevelRunes } from './game/LevelRunes'
import { Sunlight } from './game/Sunlight'
import { Platform } from './game/Platform'
import { Player } from './game/Player'
import { WaterSwitch } from './game/WaterSwitch'
import { Chest, TidePearl } from './game/Chest'
import { Door } from './game/Door'
import { CameraRig } from './game/CameraRig'
import { Hud } from './game/Hud'
import { useGame } from './game/store'
import { useLevels } from './game/levels'
import { MirrorHall } from './game/mirror/MirrorHall'
import { useMirrorHall } from './game/mirror/store'

const debug = new URLSearchParams(location.search).has('debug')

export default function App() {
  const active = useLevels((s) => s.active)
  const resetId = useGame((s) => s.resetId)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyR' || e.repeat) return
      if (useLevels.getState().active === 0) useGame.getState().reset()
      else useMirrorHall.getState().reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Canvas shadows camera={{ fov: CAMERA_FOV, position: [-30, 30, 30] }}>
        <color attach="background" args={[BACKGROUND]} />
        <Sunlight />
        <Suspense fallback={null}>
          <Physics gravity={[0, GRAVITY, 0]} debug={debug}>
            <Room />
            <Platform />
            {active === 0 && <Player resetKey={resetId} />}
            <WaterSwitch />
            <Chest />
            <TidePearl />
            <Door />
            <MirrorHall />
          </Physics>
        </Suspense>
        <Water />
        <LevelRunes />
        <CameraRig />
      </Canvas>
      <Hud />
    </>
  )
}
