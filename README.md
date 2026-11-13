# The Flooded Shrine

A one-room, Zelda-inspired puzzle in the browser: raise and lower the water to reach a treasure chest on a high ledge. About a three-minute playthrough.

Built with React Three Fiber, Rapier physics and custom GLSL shaders.

**[Play it in your browser →](https://jay-groen.github.io/zelda-the-flooded-shrine-project/)**

## Play

```bash
npm install
npm run dev
```

- **WASD / arrows**: move
- **Space**: jump, or climb out of the water
- **Click ▲ / ▼** on the pedestal: raise or lower the water (hover to preview the level)
- **E**: open the chest
- **R**: reset the room

Add `?debug` to the URL to see the physics colliders.

## How it's built

- **Puzzle logic.** The water level is one number that moves at a constant speed toward the switch's target. The floating platform's height is a pure function of that level and where it stands, so the puzzle always behaves the same way. The block slides one tile at a time, and only when the pool is drained.
- **Water.** A ripple shader with per-pixel normals, fresnel, glints, player ripples and flow streaks while the level changes. Its transparency depends on depth.
- **Waterline on the walls.** Every stone surface uses a patched `MeshStandardMaterial` that shares uniforms with the water. That gives a foam line that follows the same waves, a tinted underwater zone with caustics, and a wet band that slowly dries after the water drops.
- **Level runes.** Original glyphs drawn to a canvas at each water level. They glow at the current level, pulse at the destination, and preview the target (plus a ghost surface) when you hover a button.
- **Finale.** Everything is driven by a single timeline (`src/game/sun.ts`): the chest lid opens with an original four-note chime (Web Audio), the Tide Pearl rises out, the camera pans to the exit, the door sinks, and sunlight pours in. The sunlight is a shadow-casting spotlight shaped by the doorway, a volumetric beam with dust motes, and a golden pool of light on the water.

## Layout

```
src/game/
  constants.ts     room layout, water levels, tuning
  store.ts         game state (zustand) + per-frame values
  Room.tsx         static stone geometry and colliders
  Water.tsx        water level, shared uniforms, water surface
  Platform.tsx     floating / pushable platform
  Player.tsx       character controller, swimming
  WaterSwitch.tsx  clickable pedestal
  LevelRunes.tsx   glowing level markers + hover preview
  Chest.tsx        chest and Tide Pearl
  Door.tsx         exit door
  Sunlight.tsx     lighting and the finale's sunlight
  CameraRig.tsx    dungeon camera + finale camera move
  shaders/         water, stone and beam shaders
```
