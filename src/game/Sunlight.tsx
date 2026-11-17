import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  MeshBasicMaterial,
  Object3D,
  PointsMaterial,
  Quaternion,
  Vector3,
  type DirectionalLight,
  type HemisphereLight,
  type SpotLight,
} from 'three'
import { BEAM_LENGTH, BEAM_RADIUS, SUN_POS, SUN_TARGET } from './constants'
import { live, useGame } from './store'
import { waterUniforms } from './shaders/common'
import { createBeamMaterial } from './shaders/beamMaterial'
import { haloTexture } from './runes'
import { BEAM_DIR, BEAM_ORIGIN, FINALE, sunAmount } from './sun'

const SKY_COOL = new Color('#b8d4d0')
const SKY_WARM = new Color('#f3e6cc')
const GROUND_COOL = new Color('#3b3426')
const GROUND_WARM = new Color('#4c3c2a')
const KEY_COOL = new Color('#cfe0ff')
const KEY_WARM = new Color('#ffd49a')
const DUST_COUNT = 180

/**
 * Lighting for the whole shrine, plus the finale: when the chest opens the
 * shrine warms up and a shaft of sunlight pours through the exit door.
 */
export function Sunlight() {
  const hemi = useRef<HemisphereLight>(null)
  const key = useRef<DirectionalLight>(null)
  const spot = useRef<SpotLight>(null)
  const spotTarget = useMemo(() => {
    const o = new Object3D()
    o.position.set(...SUN_TARGET)
    return o
  }, [])

  const beamGeo = useMemo(() => {
    const g = new CylinderGeometry(BEAM_RADIUS[0], BEAM_RADIUS[1], BEAM_LENGTH, 24, 1, true)
    g.translate(0, -BEAM_LENGTH / 2, 0) // narrow end at the origin, beam runs along -y
    return g
  }, [])
  const beamQuat = useMemo(
    () => new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), BEAM_DIR),
    [],
  )
  const beamMat = useMemo(createBeamMaterial, [])

  const outsideMat = useMemo(
    () => new MeshBasicMaterial({ color: '#fff1d0', transparent: true, opacity: 0, toneMapped: false }),
    [],
  )

  const dust = useMemo(() => {
    const seeds = Array.from({ length: DUST_COUNT }, () => ({
      along: Math.random(),
      angle: Math.random() * Math.PI * 2,
      radius: Math.sqrt(Math.random()) * 0.85,
      phase: Math.random() * Math.PI * 2,
    }))
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(DUST_COUNT * 3), 3))
    const mat = new PointsMaterial({
      map: haloTexture(),
      color: '#ffe4b5',
      size: 0.13,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    // Basis perpendicular to the beam.
    const side = new Vector3().crossVectors(BEAM_DIR, new Vector3(0, 1, 0)).normalize()
    const up = new Vector3().crossVectors(side, BEAM_DIR).normalize()
    return { seeds, geo, mat, side, up }
  }, [])

  const tmp = useMemo(() => new Vector3(), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const { chestOpen, beat, setBeat } = useGame.getState()
    live.chestT = chestOpen ? (live.chestT < 0 ? 0 : live.chestT + dt) : -1
    const t = live.chestT
    const s = sunAmount(t)
    waterUniforms.uSun.value = s

    // Story beats for the HUD.
    const wantBeat = t < 0 ? 0 : t > FINALE.sunRise[1] ? 2 : t > FINALE.pearlRise[1] ? 1 : 0
    if (wantBeat !== beat) setBeat(wantBeat)

    // The shrine warms from cool shade to golden afternoon.
    if (hemi.current) {
      hemi.current.color.lerpColors(SKY_COOL, SKY_WARM, s)
      hemi.current.groundColor.lerpColors(GROUND_COOL, GROUND_WARM, s)
      hemi.current.intensity = 0.7 + 0.3 * s
    }
    if (key.current) {
      key.current.color.lerpColors(KEY_COOL, KEY_WARM, s)
      key.current.intensity = 1.2 + 0.4 * s
    }
    if (spot.current) spot.current.intensity = 18 * s

    outsideMat.opacity = Math.min(1, s * 1.5)

    // Dust motes drift slowly down the beam.
    const pos = dust.geo.attributes.position as BufferAttribute
    const time = waterUniforms.uTime.value
    dust.seeds.forEach((d, i) => {
      const along = (d.along + time * 0.012) % 1
      const dist = 0.4 + along * (BEAM_LENGTH - 4)
      const r = (BEAM_RADIUS[0] + (BEAM_RADIUS[1] - BEAM_RADIUS[0]) * (dist / BEAM_LENGTH)) * d.radius
      const wobble = Math.sin(time * 0.6 + d.phase) * 0.12
      tmp
        .copy(BEAM_ORIGIN)
        .addScaledVector(BEAM_DIR, dist)
        .addScaledVector(dust.side, Math.cos(d.angle) * r + wobble)
        .addScaledVector(dust.up, Math.sin(d.angle) * r)
      if (tmp.y < live.waterY) tmp.y = -100 // hide motes under water
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z)
    })
    pos.needsUpdate = true
    dust.mat.opacity = s * 0.9
  }, -2) // first: everything else reads live.chestT

  return (
    <>
      <hemisphereLight ref={hemi} args={[SKY_COOL, GROUND_COOL, 0.7]} />
      <directionalLight
        ref={key}
        position={[-9, 22, 13]}
        color={KEY_COOL}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
      />

      {/* The sun, hidden in the exit corridor; the doorway shapes its light. */}
      <primitive object={spotTarget} />
      <spotLight
        ref={spot}
        position={SUN_POS}
        target={spotTarget}
        color="#ffd7a1"
        intensity={0}
        angle={0.55}
        penumbra={0.6}
        decay={0}
        distance={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />

      <mesh geometry={beamGeo} material={beamMat} position={BEAM_ORIGIN} quaternion={beamQuat} renderOrder={5} raycast={() => null} />
      <points geometry={dust.geo} material={dust.mat} renderOrder={6} frustumCulled={false} />

      {/* Daylight at the far end of the corridor. */}
      <mesh position={[3.5, 6, -15.97]} material={outsideMat}>
        <planeGeometry args={[3, 4]} />
      </mesh>
    </>
  )
}
