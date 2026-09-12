export const HASH_GLSL = `
vec3 meltPermute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float meltHash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float meltHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`

export const SIMPLEX_NOISE_GLSL = `
float meltSimplex(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = meltPermute(meltPermute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`

export const FBM_GLSL = `
float meltFbm(vec2 p, int octaves, float lacunarity, float gain) {
  float amplitude = 0.5;
  float total = 0.0;
  float normalisation = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    total += amplitude * meltSimplex(p);
    normalisation += amplitude;
    p *= lacunarity;
    amplitude *= gain;
  }
  return normalisation > 0.0 ? total / normalisation : 0.0;
}

float meltRidged(vec2 p, int octaves, float lacunarity, float gain) {
  float amplitude = 0.5;
  float total = 0.0;
  float normalisation = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    total += amplitude * (1.0 - abs(meltSimplex(p)));
    normalisation += amplitude;
    p *= lacunarity;
    amplitude *= gain;
  }
  return normalisation > 0.0 ? total / normalisation : 0.0;
}
`

export const NOISE_CHUNKS = {
  hash: HASH_GLSL,
  simplex: SIMPLEX_NOISE_GLSL,
  fbm: FBM_GLSL,
} as const

export type NoiseChunkName = keyof typeof NOISE_CHUNKS

export const composeNoise = (...names: NoiseChunkName[]): string =>
  names.map((name) => NOISE_CHUNKS[name]).join('\n')

export const NOISE_PRELUDE = composeNoise('hash', 'simplex', 'fbm')
