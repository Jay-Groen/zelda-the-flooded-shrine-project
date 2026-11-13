import { Color, ShaderMaterial, Vector2, Vector3 } from 'three'
import { GLSL_COMMON, waterUniforms } from './common'
import { BEAM_LENGTH, BEAM_RADIUS, POOL_FLOOR } from '../constants'
import { BEAM_DIR, BEAM_ORIGIN } from '../sun'

const vertexShader = /* glsl */ `
${GLSL_COMMON}
varying vec3 vWp;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += waveHeight(wp.xz, uTime) + playerRipple(wp.xz);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const fragmentShader = /* glsl */ `
${GLSL_COMMON}
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uFloorY;
uniform vec3 uBeamOrigin;
uniform vec3 uBeamDir;
uniform vec2 uBeamRadius;
uniform float uBeamLength;
varying vec3 vWp;

float surface(vec2 p) {
  return waveHeight(p, uTime) + playerRipple(p) + 0.015 * vnoise(p * 4.0 + uTime * 0.6);
}

void main() {
  vec2 p = vWp.xz;
  float e = 0.05;
  vec3 n = normalize(vec3(
    surface(p - vec2(e, 0.0)) - surface(p + vec2(e, 0.0)),
    2.0 * e,
    surface(p - vec2(0.0, e)) - surface(p + vec2(0.0, e))
  ));
  vec3 v = normalize(cameraPosition - vWp);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 l = normalize(uSunDir);
  float spec = pow(max(dot(reflect(-l, n), v), 0.0), 90.0);

  vec3 col = mix(uDeep, uShallow, 0.35 + 0.65 * vnoise(p * 0.35 + uTime * 0.05));
  col = mix(col, uSky, clamp(fres * 0.8, 0.0, 1.0));
  col += caustic(p * 0.8, uTime) * 0.05;

  // Turbulent streaks while the level is changing.
  float streak = smoothstep(0.62, 1.0, vnoise(vec2(p.x * 0.9, p.y * 5.0 + uTime * 3.0 * sign(uFlow))));
  col += streak * abs(uFlow) * 0.35;

  // Foam crests on the player's ripples.
  float d = distance(p, uPlayer.xz);
  float ring = uRipple * smoothstep(0.85, 1.0, sin(d * 9.0 - uTime * 7.0)) * exp(-d * 1.1) * smoothstep(0.3, 0.6, d);
  col += ring * 0.5;

  // Finale: the shrine warms, and the sunbeam leaves a golden pool on the surface.
  col = mix(col, col * vec3(1.25, 1.1, 0.85), uSun * 0.5);
  vec3 w = vWp - uBeamOrigin;
  float along = dot(w, uBeamDir);
  float beamR = mix(uBeamRadius.x, uBeamRadius.y, clamp(along / uBeamLength, 0.0, 1.0));
  float off = length(w - uBeamDir * along);
  float pool = uSun * step(0.0, along) * smoothstep(beamR * 1.15, beamR * 0.3, off);
  col += pool * uSunColor * (0.35 + 0.5 * caustic(p * 1.3, uTime * 1.5));
  spec *= 1.0 + pool * 4.0;

  col += spec * uSunColor * 1.6;
  // Shallow water is clear, deep water murky (the pool bed is flat at uFloorY).
  float depth = clamp((uWaterY - uFloorY) / 2.5, 0.0, 1.0);
  float alpha = clamp(mix(0.3, 0.74, depth) + fres * 0.25 + spec, 0.0, 0.96);
  gl_FragColor = vec4(col, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createWaterMaterial() {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...waterUniforms,
      uDeep: { value: new Color('#082a2c') },
      uShallow: { value: new Color('#1d5e57') },
      uSky: { value: new Color('#8fb3a8') },
      uSunDir: { value: new Vector3(0.4, 0.8, 0.45) },
      uSunColor: { value: new Color('#fff2d6') },
      uFloorY: { value: POOL_FLOOR },
      uBeamOrigin: { value: BEAM_ORIGIN },
      uBeamDir: { value: BEAM_DIR },
      uBeamRadius: { value: new Vector2(...BEAM_RADIUS) },
      uBeamLength: { value: BEAM_LENGTH },
    },
  })
}
