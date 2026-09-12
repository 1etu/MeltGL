import { fragment } from '@meltgl/render-pipeline'
import type { FilterDefinition } from './filter.js'

export const MELT_PROGRESS_GLSL = `
float meltProgress() {
  return clamp(uProgress, 0.0, 1.0);
}
`

export const BLUR_FRAGMENT_GLSL = `
uniform float uRadius;

void main() {
  vec2 texel = uRadius / uResolution;
  vec4 total = vec4(0.0);
  float weightSum = 0.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      float weight = exp(-dot(offset, offset) * 40.0);
      total += texture(uInput, vUv + offset) * weight;
      weightSum += weight;
    }
  }
  fragColor = total / max(weightSum, 1e-4);
}
`

export const TINT_FRAGMENT_GLSL = `
uniform vec3 uTint;
uniform float uAmount;

void main() {
  vec4 source = texture(uInput, vUv);
  vec3 mixed = mix(source.rgb, uTint * max(source.a, 1e-4), uAmount);
  fragColor = vec4(mixed, source.a);
}
`

export const THRESHOLD_FRAGMENT_GLSL = `
uniform float uCutoff;
uniform float uSoftness;

void main() {
  vec4 source = texture(uInput, vUv);
  float alpha = smoothstep(uCutoff - uSoftness, uCutoff + uSoftness, source.a);
  fragColor = vec4(source.rgb * alpha, source.a * alpha);
}
`

export const CHROMATIC_ABERRATION_FRAGMENT_GLSL = `
uniform float uAmount;

void main() {
  vec2 direction = (vUv - 0.5) * uAmount * meltProgress();
  float r = texture(uInput, vUv + direction).r;
  vec4 g = texture(uInput, vUv);
  float b = texture(uInput, vUv - direction).b;
  fragColor = vec4(r, g.g, b, g.a);
}
`

export const blur = (radius = 2): FilterDefinition => ({
  name: 'blur',
  uniforms: { uRadius: radius },
  fragment: fragment(BLUR_FRAGMENT_GLSL),
})

export const tint = (colour: readonly [number, number, number] = [1, 1, 1], amount = 0.2): FilterDefinition => ({
  name: 'tint',
  uniforms: { uTint: new Float32Array(colour), uAmount: amount },
  fragment: fragment(TINT_FRAGMENT_GLSL),
})

export const threshold = (cutoff = 0.5, softness = 0.1): FilterDefinition => ({
  name: 'threshold',
  uniforms: { uCutoff: cutoff, uSoftness: softness },
  fragment: fragment(THRESHOLD_FRAGMENT_GLSL),
})

export const chromaticAberration = (amount = 0.004): FilterDefinition => ({
  name: 'chromatic-aberration',
  uniforms: { uAmount: amount },
  fragment: fragment(CHROMATIC_ABERRATION_FRAGMENT_GLSL, MELT_PROGRESS_GLSL),
})
