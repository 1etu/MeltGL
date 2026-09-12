import { NOISE_PRELUDE } from '@meltgl/noise-generator'
import {
  AIR_VELOCITY_DECAY,
  AMBIENT,
  CFL_LIMIT,
  COLUMN_FREQUENCY,
  COLUMN_OCTAVES,
  COVERAGE_CUTOFF,
  CURVATURE_BAND_INNER,
  CURVATURE_BAND_OUTER,
  FAR_FIELD,
  FLOOR_SOFT,
  FREEZE_ONSET,
  FRESNEL_POWER,
  GRAVITY_BAND,
  HEAT_BAND_START,
  HELD_BAND_INNER,
  HELD_BAND_OUTER,
  INITIAL_SLOPE,
  LIQUID_BAND,
  MAX_TEMPERATURE,
  MELT_BAND,
  NORMAL_FLATNESS,
  ONSET_OCTAVES,
  PAPANASTASIOU_EXPONENT,
  REFLECTION_STRENGTH,
  SEED_DECORRELATION,
  SHADE_WET_BAND,
  SKY_FLOOR,
  SPECULAR_POWER_MAX,
  SPECULAR_POWER_MIN,
  STRETCH_ALPHA_INNER,
  STRETCH_ALPHA_OUTER,
  SURFACE_BAND_OUTER,
  TENSION_BAND,
  THICKNESS_PER_RIM,
  TRANSLUCENCY_STRENGTH,
  WALL_DISTANCE,
} from './scheme.js'

const glslFloat = (name: string, value: number): string => `const float ${name} = ${value.toFixed(6)};`
const glslInt = (name: string, value: number): string => `const int ${name} = ${Math.round(value)};`

export const SCHEME_GLSL = [
  glslFloat('INITIAL_SLOPE', INITIAL_SLOPE),
  glslFloat('FAR_FIELD', FAR_FIELD),
  glslFloat('CURVATURE_BAND_INNER', CURVATURE_BAND_INNER),
  glslFloat('CURVATURE_BAND_OUTER', CURVATURE_BAND_OUTER),
  glslFloat('HEAT_BAND_START', HEAT_BAND_START),
  glslFloat('MAX_TEMPERATURE', MAX_TEMPERATURE),
  glslFloat('LIQUID_BAND', LIQUID_BAND),
  glslFloat('MELT_BAND', MELT_BAND),
  glslFloat('SHADE_WET_BAND', SHADE_WET_BAND),
  glslFloat('SURFACE_BAND_OUTER', SURFACE_BAND_OUTER),
  glslFloat('GRAVITY_BAND', GRAVITY_BAND),
  glslFloat('TENSION_BAND', TENSION_BAND),
  glslFloat('FREEZE_ONSET', FREEZE_ONSET),
  glslFloat('PAPANASTASIOU_EXPONENT', PAPANASTASIOU_EXPONENT),
  glslFloat('AIR_VELOCITY_DECAY', AIR_VELOCITY_DECAY),
  glslFloat('CFL_LIMIT', CFL_LIMIT),
  glslFloat('WALL_DISTANCE', WALL_DISTANCE),
  glslFloat('FLOOR_SOFT', FLOOR_SOFT),
  glslInt('ONSET_OCTAVES', ONSET_OCTAVES),
  glslInt('COLUMN_OCTAVES', COLUMN_OCTAVES),
  glslFloat('COLUMN_FREQUENCY', COLUMN_FREQUENCY),
  glslFloat('SEED_DECORRELATION', SEED_DECORRELATION),
  glslFloat('NORMAL_FLATNESS', NORMAL_FLATNESS),
  glslFloat('HELD_BAND_INNER', HELD_BAND_INNER),
  glslFloat('HELD_BAND_OUTER', HELD_BAND_OUTER),
  glslFloat('STRETCH_ALPHA_INNER', STRETCH_ALPHA_INNER),
  glslFloat('STRETCH_ALPHA_OUTER', STRETCH_ALPHA_OUTER),
  glslFloat('THICKNESS_PER_RIM', THICKNESS_PER_RIM),
  glslFloat('COVERAGE_CUTOFF', COVERAGE_CUTOFF),
  glslFloat('AMBIENT', AMBIENT),
  glslFloat('SPECULAR_POWER_MIN', SPECULAR_POWER_MIN),
  glslFloat('SPECULAR_POWER_MAX', SPECULAR_POWER_MAX),
  glslFloat('FRESNEL_POWER', FRESNEL_POWER),
  glslFloat('SKY_FLOOR', SKY_FLOOR),
  glslFloat('REFLECTION_STRENGTH', REFLECTION_STRENGTH),
  glslFloat('TRANSLUCENCY_STRENGTH', TRANSLUCENCY_STRENGTH),
].join('\n')

const FIELD_HEADER_GLSL = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outField;

uniform sampler2D uA;
uniform sampler2D uB;
uniform vec2 uTexel;
uniform float uDt;
uniform float uTime;
uniform float uFloor;
uniform float uFloorLevel;
${SCHEME_GLSL}

bool wallLeft(vec2 uv) { return uv.x < uTexel.x; }
bool wallRight(vec2 uv) { return uv.x > 1.0 - uTexel.x; }
bool wallBottom(vec2 uv) { return uFloor > 0.5 && uv.y < uFloorLevel; }
`

const LEVEL_SET_GLSL = `
float phiAt(vec2 uv) {
  return texture(uA, uv).z;
}

vec2 gradientAt(vec2 uv) {
  return vec2(
    phiAt(uv + vec2(uTexel.x, 0.0)) - phiAt(uv - vec2(uTexel.x, 0.0)),
    phiAt(uv + vec2(0.0, uTexel.y)) - phiAt(uv - vec2(0.0, uTexel.y))
  ) * 0.5;
}

float curvatureAt(vec2 uv) {
  vec2 t = uTexel;
  float pC = phiAt(uv);
  float pE = phiAt(uv + vec2(t.x, 0.0));
  float pW = phiAt(uv - vec2(t.x, 0.0));
  float pN = phiAt(uv + vec2(0.0, t.y));
  float pS = phiAt(uv - vec2(0.0, t.y));
  float pNE = phiAt(uv + t);
  float pNW = phiAt(uv + vec2(-t.x, t.y));
  float pSE = phiAt(uv + vec2(t.x, -t.y));
  float pSW = phiAt(uv - t);
  float px = (pE - pW) * 0.5;
  float py = (pN - pS) * 0.5;
  float pxx = pE - 2.0 * pC + pW;
  float pyy = pN - 2.0 * pC + pS;
  float pxy = (pNE - pNW - pSE + pSW) * 0.25;
  float g2 = px * px + py * py;
  float kappa = (pxx * py * py - 2.0 * px * py * pxy + pyy * px * px) / max(pow(g2, 1.5), 1e-4);
  return clamp(kappa, -1.0, 1.0);
}
`

export const INIT_A_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform sampler2D uOrigin;

void main() {
  float alpha = texture(uOrigin, vUv).a;
  float phi = (0.5 - alpha) * INITIAL_SLOPE;
  outField = vec4(0.0, 0.0, phi, 0.0);
}
`

export const INIT_B_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
void main() {
  outField = vec4(vUv, 0.0, 0.0);
}
`

export const REINIT_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
${LEVEL_SET_GLSL}
uniform sampler2D uRhs;
uniform sampler2D uVolume;
uniform sampler2D uVolumeReference;
uniform float uTensionFlow;
uniform float uVolumeGuard;
uniform float uMeltPoint;

void main() {
  vec2 t = uTexel;
  vec4 c = texture(uA, vUv);
  float pC = c.z;
  float pE = phiAt(vUv + vec2(t.x, 0.0));
  float pW = phiAt(vUv - vec2(t.x, 0.0));
  float pN = phiAt(vUv + vec2(0.0, t.y));
  float pS = phiAt(vUv - vec2(0.0, t.y));

  float p0 = texture(uRhs, vUv).z;
  float p0E = texture(uRhs, vUv + vec2(t.x, 0.0)).z;
  float p0W = texture(uRhs, vUv - vec2(t.x, 0.0)).z;
  float p0N = texture(uRhs, vUv + vec2(0.0, t.y)).z;
  float p0S = texture(uRhs, vUv - vec2(0.0, t.y)).z;
  bool onInterface = p0 * p0E < 0.0 || p0 * p0W < 0.0 || p0 * p0N < 0.0 || p0 * p0S < 0.0;

  float s = p0 / sqrt(p0 * p0 + 1.0);
  float phi;
  if (onInterface) {
    float dx = max(max(abs(p0E - p0W) * 0.5, abs(p0E - p0)), max(abs(p0 - p0W), 1e-3));
    float dy = max(max(abs(p0N - p0S) * 0.5, abs(p0N - p0)), max(abs(p0 - p0S), 1e-3));
    float distance = p0 / max(dx, dy);
    float sign0 = p0 >= 0.0 ? 1.0 : -1.0;
    phi = pC - 0.5 * (sign0 * abs(pC) - distance);
  } else {
    float a = pC - pW;
    float b = pE - pC;
    float cc = pC - pS;
    float d = pN - pC;
    float ap = max(a, 0.0);
    float am = min(a, 0.0);
    float bp = max(b, 0.0);
    float bm = min(b, 0.0);
    float cp = max(cc, 0.0);
    float cm = min(cc, 0.0);
    float dp = max(d, 0.0);
    float dm = min(d, 0.0);
    float grad = s > 0.0
      ? sqrt(max(ap * ap, bm * bm) + max(cp * cp, dm * dm))
      : sqrt(max(am * am, bp * bp) + max(cm * cm, dp * dp));
    phi = pC - 0.5 * s * (grad - 1.0);
  }

  float wet = smoothstep(uMeltPoint - MELT_BAND, uMeltPoint, c.w);
  float kappa = curvatureAt(vUv);
  float edgeBand = (1.0 - smoothstep(CURVATURE_BAND_INNER, CURVATURE_BAND_OUTER, abs(pC))) * wet;
  phi += uTensionFlow * kappa * edgeBand;
  float volume = texture(uVolume, vec2(0.5)).x;
  float reference = texture(uVolumeReference, vec2(0.5)).x;
  float excess = max(0.0, volume - reference) / max(reference, 1e-5);
  phi += uVolumeGuard * excess * edgeBand;
  phi = clamp(phi, -FAR_FIELD, FAR_FIELD);

  outField = vec4(c.xy, phi, c.w);
}
`

export const ADVECT_A_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
${LEVEL_SET_GLSL}
${NOISE_PRELUDE}
uniform float uGravity;
uniform float uDrag;
uniform float uSigma;
uniform float uMeltRate;
uniform float uMeltPoint;
uniform float uConduction;
uniform float uCooling;
uniform float uHeatTop;
uniform float uCoreHeat;
uniform float uSurfaceHeat;
uniform float uSurfaceDepth;
uniform float uColumnFeed;
uniform float uOnsetSpread;
uniform float uNoiseScale;
uniform float uFreezePoint;
uniform float uSeed;
uniform float uDelay;

void main() {
  vec2 t = uTexel;
  vec4 here = texture(uA, vUv);
  vec2 back = vUv - here.xy * uDt * t;
  vec4 a = texture(uA, back);
  vec2 u = a.xy;
  float phi = a.z;
  float T = a.w;

  float phiC = here.z;
  float TL = texture(uA, vUv - vec2(t.x, 0.0)).w;
  float TR = texture(uA, vUv + vec2(t.x, 0.0)).w;
  float TN = texture(uA, vUv + vec2(0.0, t.y)).w;
  float TS = texture(uA, vUv - vec2(0.0, t.y)).w;

  float inside = 1.0 - smoothstep(0.0, 1.0, phiC);
  float surface = smoothstep(-uSurfaceDepth, SURFACE_BAND_OUTER, phiC);
  float exposure = uCoreHeat + uSurfaceHeat * surface;

  float noise = meltFbm(vUv * uNoiseScale + uSeed, ONSET_OCTAVES, 2.0, 0.5);
  float delay = (noise * 0.5 + 0.5) * uOnsetSpread;
  float column = meltFbm(vec2(vUv.x * uNoiseScale * COLUMN_FREQUENCY, uSeed * SEED_DECORRELATION), COLUMN_OCTAVES, 2.0, 0.5);
  float feed = 1.0 + uColumnFeed * column;
  float top = 1.0 + uHeatTop * smoothstep(HEAT_BAND_START, 1.0, vUv.y);
  float started = step(uDelay, uTime);
  float heating = uMeltRate * feed * top * exposure * max(0.0, 1.0 - delay) * started;

  float lapT = TL + TR + TN + TS - 4.0 * here.w;
  T += (heating + uConduction * lapT) * uDt * inside;
  if (phiC > 0.0) T = max(T, max(max(TL, TR), max(TN, TS)));
  float liquid = smoothstep(uMeltPoint, uMeltPoint + LIQUID_BAND, T);
  T -= uCooling * uDt * liquid * surface;
  T = clamp(T, 0.0, MAX_TEMPERATURE);

  float band = 1.0 - smoothstep(0.0, GRAVITY_BAND, phi);
  u.y -= uGravity * uDt * band;
  u /= 1.0 + uDrag * uDt;
  if (uFloor > 0.5 && u.y < 0.0) u.y *= smoothstep(uFloorLevel, uFloorLevel + FLOOR_SOFT * t.y, vUv.y);

  float kappa = curvatureAt(vUv);
  vec2 grad = gradientAt(vUv);
  vec2 normal = grad / max(length(grad), 1e-4);
  float delta = max(0.0, 1.0 - abs(phiC) / TENSION_BAND) / TENSION_BAND;
  u -= uSigma * kappa * normal * delta * uDt;

  float freeze = uFreezePoint > 0.0 ? smoothstep(uFreezePoint * FREEZE_ONSET, uFreezePoint, T) : 1.0;
  u *= freeze;

  float limit = CFL_LIMIT / uDt;
  float speed = length(u);
  if (speed > limit) u *= limit / speed;

  if (wallLeft(vUv) || wallRight(vUv)) u.x = 0.0;
  if (wallBottom(vUv)) {
    u = vec2(0.0);
    phi = max(phi, WALL_DISTANCE);
  }

  outField = vec4(u, phi, T);
}
`

export const ROW_VOLUME_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform int uCount;

void main() {
  float total = 0.0;
  for (int i = 0; i < uCount; i++) {
    float phi = texture(uA, vec2((float(i) + 0.5) * uTexel.x, vUv.y)).z;
    total += 1.0 - smoothstep(-0.5, 0.5, phi);
  }
  outField = vec4(total / float(uCount), 0.0, 0.0, 0.0);
}
`

export const COLUMN_VOLUME_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform sampler2D uRows;
uniform int uCount;

void main() {
  float total = 0.0;
  for (int i = 0; i < uCount; i++) {
    total += texture(uRows, vec2(0.5, (float(i) + 0.5) * uTexel.y)).x;
  }
  outField = vec4(total / float(uCount), 0.0, 0.0, 0.0);
}
`

export const ADVECT_B_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
void main() {
  vec2 velocity = texture(uA, vUv).xy;
  vec2 back = vUv - velocity * uDt * uTexel;
  outField = texture(uB, back);
}
`

export const VISCOSITY_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform sampler2D uRhs;
uniform float uNuSolid;
uniform float uNuLiquid;
uniform float uMeltPoint;
uniform float uYield;

float nuOf(float T) {
  float s = smoothstep(uMeltPoint - MELT_BAND, uMeltPoint + MELT_BAND, T);
  return exp(mix(log(uNuSolid), log(uNuLiquid), s));
}

float faceOf(float own, vec4 neighbour, bool wall) {
  if (wall) return own;
  return neighbour.z > 0.0 ? 0.0 : 0.5 * (own + nuOf(neighbour.w));
}

void main() {
  vec2 t = uTexel;
  vec4 c = texture(uA, vUv);
  if (c.z > 0.0) {
    outField = c;
    return;
  }
  vec4 rhs = texture(uRhs, vUv);
  vec4 E = texture(uA, vUv + vec2(t.x, 0.0));
  vec4 W = texture(uA, vUv - vec2(t.x, 0.0));
  vec4 N = texture(uA, vUv + vec2(0.0, t.y));
  vec4 S = texture(uA, vUv - vec2(0.0, t.y));
  vec4 NE = texture(uA, vUv + t);
  vec4 NW = texture(uA, vUv + vec2(-t.x, t.y));
  vec4 SE = texture(uA, vUv + vec2(t.x, -t.y));
  vec4 SW = texture(uA, vUv - t);

  float dudx = (E.x - W.x) * 0.5;
  float dvdy = (N.y - S.y) * 0.5;
  float dudy = (N.x - S.x) * 0.5;
  float dvdx = (E.y - W.y) * 0.5;
  float rate = sqrt(2.0 * dudx * dudx + 2.0 * dvdy * dvdy + (dudy + dvdx) * (dudy + dvdx));
  float wet = smoothstep(uMeltPoint - MELT_BAND, uMeltPoint + MELT_BAND, c.w);
  float nuYield = uYield * wet * (1.0 - exp(-rate * PAPANASTASIOU_EXPONENT)) / max(rate, 1e-3);

  float nC = nuOf(c.w) + nuYield;
  float ne = faceOf(nC, E, false);
  float nw = faceOf(nC, W, false);
  float nn = faceOf(nC, N, false);
  float ns = faceOf(nC, S, wallBottom(vUv - vec2(0.0, t.y)));

  float dvdxN = 0.25 * (NE.y + E.y - NW.y - W.y);
  float dvdxS = 0.25 * (SE.y + E.y - SW.y - W.y);
  float dudyE = 0.25 * (NE.x + N.x - SE.x - S.x);
  float dudyW = 0.25 * (NW.x + N.x - SW.x - S.x);

  float k = uDt;
  float diagU = 1.0 + k * (2.0 * ne + 2.0 * nw + nn + ns);
  float offU = k * (2.0 * ne * E.x + 2.0 * nw * W.x + nn * N.x + ns * S.x + nn * dvdxN - ns * dvdxS);
  float diagV = 1.0 + k * (2.0 * nn + 2.0 * ns + ne + nw);
  float offV = k * (2.0 * nn * N.y + 2.0 * ns * S.y + ne * E.y + nw * W.y + ne * dudyE - nw * dudyW);

  vec2 u = vec2((rhs.x + offU) / diagU, (rhs.y + offV) / diagV);
  outField = vec4(u, c.z, c.w);
}
`

export const DIVERGENCE_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
${LEVEL_SET_GLSL}
void main() {
  vec2 t = uTexel;
  vec4 c = texture(uA, vUv);
  if (c.z > 0.0) {
    outField = vec4(0.0, c.z, 0.0, 0.0);
    return;
  }
  vec2 E = texture(uA, vUv + vec2(t.x, 0.0)).xy;
  vec2 W = texture(uA, vUv - vec2(t.x, 0.0)).xy;
  vec2 N = texture(uA, vUv + vec2(0.0, t.y)).xy;
  vec2 S = texture(uA, vUv - vec2(0.0, t.y)).xy;
  if (wallRight(vUv)) E.x = 0.0;
  if (wallLeft(vUv)) W.x = 0.0;
  if (wallBottom(vUv - vec2(0.0, t.y))) S.y = 0.0;
  float div = 0.5 * (E.x - W.x + N.y - S.y);
  outField = vec4(div, c.z, 0.0, 0.0);
}
`

const PRESSURE_COMMON_GLSL = `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;

float maskAt(vec2 uv) {
  return texture(uDivergence, uv).y;
}

float pressureAt(vec2 uv, float own) {
  if (uv.x < 0.0 || uv.x > 1.0 || wallBottom(uv)) return own;
  if (maskAt(uv) > 0.0) return 0.0;
  return texture(uPressure, uv).x;
}
`

export const PRESSURE_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
${PRESSURE_COMMON_GLSL}
void main() {
  vec2 t = uTexel;
  vec2 rhs = texture(uDivergence, vUv).xy;
  if (rhs.y > 0.0) {
    outField = vec4(0.0);
    return;
  }
  float own = texture(uPressure, vUv).x;
  float pE = pressureAt(vUv + vec2(t.x, 0.0), own);
  float pW = pressureAt(vUv - vec2(t.x, 0.0), own);
  float pN = pressureAt(vUv + vec2(0.0, t.y), own);
  float pS = pressureAt(vUv - vec2(0.0, t.y), own);
  float p = 0.25 * (pE + pW + pN + pS - rhs.x);
  outField = vec4(p, 0.0, 0.0, 0.0);
}
`

export const RESIDUAL_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
${PRESSURE_COMMON_GLSL}
void main() {
  vec2 t = uTexel;
  vec2 rhs = texture(uDivergence, vUv).xy;
  if (rhs.y > 0.0) {
    outField = vec4(0.0);
    return;
  }
  float own = texture(uPressure, vUv).x;
  float pE = pressureAt(vUv + vec2(t.x, 0.0), own);
  float pW = pressureAt(vUv - vec2(t.x, 0.0), own);
  float pN = pressureAt(vUv + vec2(0.0, t.y), own);
  float pS = pressureAt(vUv - vec2(0.0, t.y), own);
  float residual = rhs.x - (pE + pW + pN + pS - 4.0 * own);
  outField = vec4(residual, 0.0, 0.0, 0.0);
}
`

export const RESTRICT_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform sampler2D uResidual;
uniform sampler2D uFineRhs;

void main() {
  float residual = texture(uResidual, vUv).x;
  float mask = texture(uFineRhs, vUv).y;
  outField = vec4(residual * 4.0, mask, 0.0, 0.0);
}
`

export const PROLONGATE_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform sampler2D uPressure;
uniform sampler2D uCoarse;
uniform sampler2D uDivergence;

void main() {
  float mask = texture(uDivergence, vUv).y;
  if (mask > 0.0) {
    outField = vec4(0.0);
    return;
  }
  float p = texture(uPressure, vUv).x + texture(uCoarse, vUv).x;
  outField = vec4(p, 0.0, 0.0, 0.0);
}
`

export const SUBTRACT_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
${LEVEL_SET_GLSL}
uniform sampler2D uPressure;

float pressureAt(vec2 uv, float own) {
  if (uv.x < 0.0 || uv.x > 1.0 || wallBottom(uv)) return own;
  if (phiAt(uv) > 0.0) return 0.0;
  return texture(uPressure, uv).x;
}

vec2 projected(vec2 uv) {
  vec2 t = uTexel;
  vec4 c = texture(uA, uv);
  float own = texture(uPressure, uv).x;
  float pE = pressureAt(uv + vec2(t.x, 0.0), own);
  float pW = pressureAt(uv - vec2(t.x, 0.0), own);
  float pN = pressureAt(uv + vec2(0.0, t.y), own);
  float pS = pressureAt(uv - vec2(0.0, t.y), own);
  return c.xy - 0.5 * vec2(pE - pW, pN - pS);
}

void main() {
  vec2 t = uTexel;
  vec4 c = texture(uA, vUv);
  vec2 u;
  if (c.z <= 0.0) {
    u = projected(vUv);
  } else {
    vec2 sum = vec2(0.0);
    float count = 0.0;
    vec2 offsets[4] = vec2[4](vec2(t.x, 0.0), vec2(-t.x, 0.0), vec2(0.0, t.y), vec2(0.0, -t.y));
    for (int i = 0; i < 4; i++) {
      vec2 uv = vUv + offsets[i];
      if (phiAt(uv) <= 0.0) {
        sum += projected(uv);
        count += 1.0;
      }
    }
    u = count > 0.0 ? sum / count : c.xy * AIR_VELOCITY_DECAY;
  }
  float limit = CFL_LIMIT / uDt;
  float speed = length(u);
  if (speed > limit) u *= limit / speed;
  if (wallLeft(vUv) || wallRight(vUv)) u.x = 0.0;
  if (wallBottom(vUv)) u = vec2(0.0);
  outField = vec4(u, c.z, c.w);
}
`

export const SHADE_FRAGMENT_GLSL = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uOrigin;
uniform vec2 uTexel;
uniform float uMeltPoint;
uniform float uRim;
uniform float uEdgeWidth;
uniform float uGloss;
uniform float uFresnel;
uniform float uRefraction;
uniform float uBlend;
uniform float uTranslucency;
uniform vec3 uAbsorption;
uniform vec3 uLight;
uniform vec4 uTint;
${SCHEME_GLSL}

void main() {
  vec4 a = texture(uA, vUv);
  float phi = a.z;
  float T = a.w;
  float inside = 1.0 - smoothstep(-uEdgeWidth, uEdgeWidth, phi);
  float wet = smoothstep(uMeltPoint - SHADE_WET_BAND, uMeltPoint + SHADE_WET_BAND, T);

  vec2 t = uTexel;
  float pE = texture(uA, vUv + vec2(t.x, 0.0)).z;
  float pW = texture(uA, vUv - vec2(t.x, 0.0)).z;
  float pN = texture(uA, vUv + vec2(0.0, t.y)).z;
  float pS = texture(uA, vUv - vec2(0.0, t.y)).z;
  vec2 grad = vec2(pE - pW, pN - pS) * 0.5;
  vec2 outward = grad / max(length(grad), 1e-4);
  float depth = clamp(-phi / uRim, 0.0, 1.0);
  vec3 n = normalize(vec3(outward * (1.0 - depth), NORMAL_FLATNESS + depth));

  vec2 ref = texture(uB, vUv + n.xy * uRefraction * wet).xy;
  vec4 pic = texture(uOrigin, clamp(ref, 0.0, 1.0));
  float picAlpha = pic.a;
  float held = 1.0 - smoothstep(HELD_BAND_INNER, HELD_BAND_OUTER, phi);
  float coverage = mix(picAlpha * held, inside, wet);
  if (coverage < COVERAGE_CUTOFF) {
    fragColor = vec4(0.0);
    return;
  }
  vec3 picColour = pic.rgb / max(picAlpha, 1e-4);
  float stretched = 1.0 - smoothstep(STRETCH_ALPHA_INNER, STRETCH_ALPHA_OUTER, picAlpha);
  vec3 base = mix(picColour, uTint.rgb, max(uBlend * wet, stretched));
  float thickness = depth * THICKNESS_PER_RIM;
  base *= exp(-uAbsorption * thickness * wet);

  vec3 L = normalize(uLight);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float facing = max(dot(n, V), 0.0);
  float diffuse = AMBIENT + (1.0 - AMBIENT) * max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, H), 0.0), mix(SPECULAR_POWER_MIN, SPECULAR_POWER_MAX, uGloss)) * uGloss * wet;
  float rim = pow(1.0 - facing, FRESNEL_POWER) * uFresnel * wet;
  float sky = 0.5 + 0.5 * n.y;
  vec3 reflection = mix(vec3(SKY_FLOOR), vec3(1.0), sky) * rim;
  vec3 colour = base * diffuse + vec3(spec) + reflection * REFLECTION_STRENGTH;

  float alpha = coverage * uTint.a * (1.0 - uTranslucency * wet * TRANSLUCENCY_STRENGTH * (1.0 - depth));
  fragColor = vec4(colour * alpha, alpha);
}
`

export const PAINT_FRAGMENT_GLSL = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outField;

uniform sampler2D uSource;
uniform vec4 uRect;
uniform vec3 uKey;
uniform float uKeyTolerance;
uniform float uKeyEnabled;

void main() {
  vec2 local = (vUv - uRect.xy) / uRect.zw;
  float inside = step(0.0, local.x) * step(local.x, 1.0) * step(0.0, local.y) * step(local.y, 1.0);
  vec4 colour = texture(uSource, clamp(local, 0.0, 1.0)) * inside;
  vec3 straight = colour.rgb / max(colour.a, 1e-4);
  float keep = smoothstep(uKeyTolerance, uKeyTolerance * 2.0 + 0.02, distance(straight, uKey));
  colour *= mix(1.0, keep, uKeyEnabled);
  outField = colour;
}
`
