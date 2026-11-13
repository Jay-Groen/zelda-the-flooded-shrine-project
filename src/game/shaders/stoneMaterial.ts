import { MeshStandardMaterial } from 'three'
import { GLSL_COMMON, waterUniforms } from './common'

const VERTEX_DECL = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
`

const VERTEX_BODY = /* glsl */ `
vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
`

const FRAGMENT_DECL = /* glsl */ `
${GLSL_COMMON}
uniform float uMoss;
uniform float uBlocks;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
`

const FRAGMENT_BODY = /* glsl */ `
{
  vec3 wp = vWorldPos;
  vec3 wn = normalize(vWorldNormal);
  // Planar coordinates for whichever way this face points.
  vec2 uv = abs(wn.y) > 0.5 ? wp.xz : (abs(wn.x) > 0.5 ? wp.zy : wp.xy);

  // Offset stone blocks with darker grout.
  vec2 b = uv / vec2(1.25, 0.625);
  b.x += step(1.0, mod(floor(b.y), 2.0)) * 0.5;
  vec2 fb = fract(b);
  float grout = smoothstep(0.0, 0.035, fb.x) * smoothstep(1.0, 0.965, fb.x)
              * smoothstep(0.0, 0.06, fb.y) * smoothstep(1.0, 0.94, fb.y);
  float blockTone = hash12(floor(b));
  float n = fbm(uv * 1.7);
  diffuseColor.rgb *= mix(1.0, mix(0.6, 1.0, grout) * (0.8 + 0.25 * blockTone), uBlocks) * (0.82 + 0.3 * n);

  // Moss, mostly on top faces.
  float moss = smoothstep(0.55, 0.78, fbm(uv * 0.8 + 7.3)) * (wn.y > 0.5 ? 1.0 : 0.4);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.34, 0.15), moss * 0.75 * uMoss);

  // Water: the waterline wobbles with the same waves as the surface.
  float wl = uWaterY + waveHeight(wp.xz, uTime);
  // Only surfaces inside the room (or the east niche) can touch the water.
  bool inRoom = abs(wp.x) < 10.01 && abs(wp.z) < 10.01;
  bool inNiche = wp.x > 9.99 && wp.x < 12.51 && wp.z > -2.51 && wp.z < 0.01;
  float depth = (inRoom || inNiche) ? wl - wp.y : -100.0;
  if (depth > 0.0) {
    float d = clamp(depth / 4.0, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.45, 0.66, 0.62), vec3(0.03, 0.13, 0.13), d * 0.8);
    float c = caustic(uv * 0.9 + wp.y * 0.15, uTime);
    diffuseColor.rgb += c * vec3(0.5, 0.8, 0.75) * (1.0 - d) * (1.0 - d) * 0.35;
  } else {
    // Wet band left behind by receding water, with ragged drip edges.
    float wetH = uWetY - uWaterY;
    float above = -depth;
    if (wetH > 0.001) {
      float edge = wetH * (0.65 + 0.35 * vnoise(vec2(uv.x * 5.0, 1.7)));
      float wet = 1.0 - smoothstep(edge - 0.25, edge, above);
      diffuseColor.rgb *= mix(1.0, 0.6, wet);
    }
  }

  // Foam where the surface meets the stone.
  float foam = smoothstep(0.09, 0.0, abs(depth)) * (0.55 + 0.45 * vnoise(uv * 8.0 + uTime * 1.5));
  foam += smoothstep(0.03, 0.0, abs(depth)) * 0.3 * abs(uFlow);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.95, 0.95), clamp(foam, 0.0, 1.0) * 0.8);
}
`

const cache = new Map<string, MeshStandardMaterial>()

/**
 * MeshStandardMaterial patched with procedural stone, moss and the shared
 * waterline (submerged tint, caustics, foam line, drying wet band).
 */
export function stoneMaterial(color: string, { moss = 1, blocks = 1 } = {}) {
  const key = `${color}|${moss}|${blocks}`
  const cached = cache.get(key)
  if (cached) return cached

  const mat = new MeshStandardMaterial({ color, roughness: 0.92 })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waterUniforms, {
      uMoss: { value: moss },
      uBlocks: { value: blocks },
    })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_BODY}`)
  }
  mat.customProgramCacheKey = () => 'shrine-stone'
  cache.set(key, mat)
  return mat
}
