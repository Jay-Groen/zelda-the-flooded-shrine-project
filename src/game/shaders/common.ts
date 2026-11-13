import { Vector3 } from 'three'
import { WATER_LEVELS, START_LEVEL } from '../constants'

/**
 * Uniforms shared by the water surface and every stone material, so the
 * waterline on the walls always matches the water itself.
 */
export const waterUniforms = {
  uTime: { value: 0 },
  uWaterY: { value: WATER_LEVELS[START_LEVEL] as number },
  /** Highest recent waterline; walls stay dark and wet up to here, then dry. */
  uWetY: { value: WATER_LEVELS[START_LEVEL] as number },
  uPlayer: { value: new Vector3() },
  /** 0..1 how strongly the player disturbs the surface. */
  uRipple: { value: 0 },
  /** -1..1 water velocity (draining / filling). */
  uFlow: { value: 0 },
  /** 0..1 how far the finale's sunlight has spilled in. */
  uSun: { value: 0 },
}

/** Noise, caustics and the wave function. Used by both shaders. */
export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform float uWaterY;
uniform float uWetY;
uniform vec3 uPlayer;
uniform float uRipple;
uniform float uFlow;
uniform float uSun;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

// Two drifting noise layers; bright thin lines where they cross the midpoint.
float caustic(vec2 p, float t) {
  float n = vnoise(p + vec2(t * 0.45, t * 0.3)) + vnoise(p * 1.6 + vec2(-t * 0.35, t * 0.25));
  return pow(clamp(1.0 - abs(n - 1.0) * 3.0, 0.0, 1.0), 6.0);
}

float waveHeight(vec2 p, float t) {
  return 0.035 * sin(p.x * 1.3 + t * 1.1)
       + 0.030 * sin(p.y * 1.7 - t * 0.9)
       + 0.020 * sin((p.x + p.y) * 2.3 + t * 1.7);
}

float playerRipple(vec2 p) {
  float d = distance(p, uPlayer.xz);
  return uRipple * 0.05 * sin(d * 9.0 - uTime * 7.0) * exp(-d * 1.3) * smoothstep(0.3, 0.7, d);
}
`
