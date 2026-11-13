import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { GRAVITY } from './game/constants'
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

const debug = new URLSearchParams(location.search).has('debug')

export default function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !e.repeat) useGame.getState().reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Canvas shadows camera={{ fov: 45, position: [0, 15, 13] }}>
        <color attach="background" args={['#121512']} />
        <Sunlight />
        <Suspense fallback={null}>
          <Physics gravity={[0, GRAVITY, 0]} debug={debug}>
            <Room />
            <Platform />
            <Player />
            <WaterSwitch />
            <Chest />
            <TidePearl />
            <Door />
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
