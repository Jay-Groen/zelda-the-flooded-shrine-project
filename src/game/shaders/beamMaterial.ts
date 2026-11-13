import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three'
import { GLSL_COMMON, waterUniforms } from './common'

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWp;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const fragmentShader = /* glsl */ `
${GLSL_COMMON}
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWp;

void main() {
  vec3 v = normalize(cameraPosition - vWp);
  // Faces seen edge-on fade out, so the cone reads as a soft volume.
  float facing = pow(abs(dot(normalize(vN), v)), 1.4);
  // uv.y = 1 at the door, 0 at the far end.
  float along = pow(vUv.y, 1.3) * smoothstep(1.0, 0.9, vUv.y) + smoothstep(0.9, 1.0, vUv.y) * 0.6;
  float streaks = 0.55 + 0.45 * vnoise(vec2(vUv.x * 14.0, vUv.y * 1.5 - uTime * 0.12));
  float a = uSun * facing * along * streaks * 0.32;
  // The beam ends where it meets the water.
  a *= smoothstep(uWaterY - 0.2, uWaterY + 0.5, vWp.y);
  gl_FragColor = vec4(uColor, a);
}
`

export function createBeamMaterial() {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: {
      ...waterUniforms,
      uColor: { value: new Color('#ffd9a0') },
    },
  })
}
