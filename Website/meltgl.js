var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// Packages/Common/src/errors.ts
var MeltError = class extends Error {
  constructor(code, message) {
    super(`[MeltGL:${code}] ${message}`);
    __publicField(this, "code");
    this.name = "MeltError";
    this.code = code;
  }
};
function assert(condition, code, message) {
  if (!condition) throw new MeltError(code, message);
}

// Packages/Common/src/math.ts
var clamp = (value, min, max) => value < min ? min : value > max ? max : value;
var saturate = (value) => clamp(value, 0, 1);
var lerp = (a, b, t) => a + (b - a) * t;
var hashString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

// Packages/Common/src/easing.ts
var linear = (t) => t;
var easeInQuad = (t) => t * t;
var easeOutQuad = (t) => t * (2 - t);
var easeInCubic = (t) => t * t * t;
var easeOutCubic = (t) => 1 - (1 - t) ** 3;
var easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
var easeOutQuint = (t) => 1 - (1 - t) ** 5;
var easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
var easeInExpo = (t) => t === 0 ? 0 : 2 ** (10 * t - 10);
var easings = {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeOutQuint,
  easeInOutSine,
  easeInExpo
};
var resolveEasing = (easing) => typeof easing === "function" ? easing : easings[easing];

// Packages/Common/src/emitter.ts
var Emitter = class {
  constructor() {
    __publicField(this, "listeners", /* @__PURE__ */ new Map());
  }
  on(event, listener) {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = /* @__PURE__ */ new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(listener);
    return () => this.off(event, listener);
  }
  once(event, listener) {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }
  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event, payload) {
    const bucket = this.listeners.get(event);
    if (!bucket || bucket.size === 0) return;
    for (const listener of [...bucket]) listener(payload);
  }
  clear() {
    this.listeners.clear();
  }
};

// Packages/AnimationClock/src/clock.ts
var Clock = class extends Emitter {
  constructor(options = {}) {
    super();
    __publicField(this, "timeScale");
    __publicField(this, "handle", 0);
    __publicField(this, "last", 0);
    __publicField(this, "frame", 0);
    __publicField(this, "elapsed", 0);
    __publicField(this, "active", false);
    __publicField(this, "resumeWhenVisible", false);
    __publicField(this, "maxDelta");
    __publicField(this, "pauseWhenHidden");
    __publicField(this, "loop", (now) => {
      if (!this.active) return;
      this.handle = requestAnimationFrame(this.loop);
      const delta = Math.min((now - this.last) / 1e3, this.maxDelta) * this.timeScale;
      this.last = now;
      this.elapsed += delta;
      this.frame += 1;
      this.emit("tick", { time: this.elapsed, delta, frame: this.frame });
    });
    __publicField(this, "onVisibilityChange", () => {
      if (document.hidden) {
        const wasRunning = this.active;
        this.stop();
        this.resumeWhenVisible = wasRunning;
        return;
      }
      if (!this.resumeWhenVisible) return;
      this.resumeWhenVisible = false;
      this.start();
    });
    this.maxDelta = options.maxDelta ?? 1 / 15;
    this.timeScale = options.timeScale ?? 1;
    this.pauseWhenHidden = options.pauseWhenHidden ?? true;
    if (this.pauseWhenHidden && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
  }
  get running() {
    return this.active;
  }
  get time() {
    return this.elapsed;
  }
  start() {
    if (this.active) return;
    this.active = true;
    this.last = performance.now();
    this.handle = requestAnimationFrame(this.loop);
    this.emit("start", void 0);
  }
  stop() {
    this.resumeWhenVisible = false;
    if (!this.active) return;
    this.active = false;
    cancelAnimationFrame(this.handle);
    this.handle = 0;
    this.emit("stop", void 0);
  }
  dispose() {
    this.stop();
    if (this.pauseWhenHidden && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
    this.clear();
  }
};

// Packages/RenderSurface/src/capabilities.ts
var probeCapabilities = (gl) => {
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    backend: "webgl2",
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    colorBufferFloat: gl.getExtension("EXT_color_buffer_float") !== null,
    colorBufferHalfFloat: gl.getExtension("EXT_color_buffer_half_float") !== null,
    vendor: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
    renderer: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
  };
};
var hasRenderableFloat = (gl) => gl.getExtension("EXT_color_buffer_float") !== null || gl.getExtension("EXT_color_buffer_half_float") !== null;
var FLOAT_TARGET_EXTENSIONS = "EXT_color_buffer_float or EXT_color_buffer_half_float";
var preferredBackend = () => {
  if (typeof document === "undefined") return "svg";
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return "svg";
    const renderable = hasRenderableFloat(gl);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return renderable ? "webgl2" : "svg";
  } catch {
    return "svg";
  }
};

// Packages/RenderSurface/src/surface.ts
var RenderSurface = class extends Emitter {
  constructor(options = {}) {
    super();
    __publicField(this, "canvas");
    __publicField(this, "gl");
    __publicField(this, "capabilities");
    __publicField(this, "width", 0);
    __publicField(this, "height", 0);
    __publicField(this, "pixelRatio", 1);
    __publicField(this, "maxPixelRatio");
    __publicField(this, "contextLost", false);
    __publicField(this, "disposed", false);
    __publicField(this, "onContextLost", () => {
      this.contextLost = true;
      this.emit("contextlost", void 0);
    });
    this.canvas = options.canvas ?? document.createElement("canvas");
    this.maxPixelRatio = options.maxPixelRatio ?? 2;
    const gl = this.canvas.getContext("webgl2", {
      alpha: options.alpha ?? true,
      premultipliedAlpha: options.premultipliedAlpha ?? true,
      antialias: options.antialias ?? false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance"
    });
    assert(gl, "context-unavailable", "webgl2 is not available on this canvas");
    this.gl = gl;
    this.capabilities = probeCapabilities(gl);
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
  }
  get size() {
    return { width: this.width, height: this.height };
  }
  get drawingBufferSize() {
    return { width: this.canvas.width, height: this.canvas.height };
  }
  get ratio() {
    return this.pixelRatio;
  }
  get lost() {
    return this.contextLost || this.gl.isContextLost();
  }
  resize(width, height, pixelRatio = window.devicePixelRatio || 1) {
    const ratio = clamp(pixelRatio, 1, this.maxPixelRatio);
    const max = this.capabilities.maxTextureSize;
    const pixelWidth = Math.min(Math.max(1, Math.round(width * ratio)), max);
    const pixelHeight = Math.min(Math.max(1, Math.round(height * ratio)), max);
    this.width = width;
    this.height = height;
    this.pixelRatio = ratio;
    if (this.canvas.width === pixelWidth && this.canvas.height === pixelHeight) return;
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.emit("resize", { width: pixelWidth, height: pixelHeight });
  }
  bindDefault() {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  clearTo(r = 0, g = 0, b = 0, a = 0) {
    const { gl } = this;
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.clear();
  }
};

// Packages/TransitionController/src/controller.ts
var TransitionController = class extends Emitter {
  constructor(options = {}) {
    super();
    __publicField(this, "duration");
    __publicField(this, "easing");
    __publicField(this, "loop");
    __publicField(this, "raw", 0);
    __publicField(this, "direction", 1);
    __publicField(this, "current", "idle");
    __publicField(this, "active", false);
    __publicField(this, "detach", null);
    this.duration = options.duration ?? 1.4;
    this.easing = resolveEasing(options.easing ?? "easeInOutCubic");
    this.loop = options.loop ?? false;
  }
  get progress() {
    return this.raw;
  }
  get eased() {
    return this.easing(this.raw);
  }
  get state() {
    return this.current;
  }
  get running() {
    return this.active;
  }
  setEasing(easing) {
    this.easing = resolveEasing(easing);
  }
  play() {
    this.direction = 1;
    this.active = true;
    this.transitionTo("melting");
  }
  reverse() {
    this.direction = -1;
    this.active = true;
    this.transitionTo("reforming");
  }
  toggle() {
    if (this.current === "melting" || this.current === "melted") this.reverse();
    else this.play();
  }
  pause() {
    this.active = false;
  }
  reset() {
    this.active = false;
    this.direction = 1;
    this.raw = 0;
    this.transitionTo("idle");
    this.emitChange();
  }
  seek(progress) {
    this.raw = saturate(progress);
    this.emitChange();
  }
  advance(delta) {
    if (!this.active || this.duration <= 0) return;
    const next = saturate(this.raw + delta / this.duration * this.direction);
    if (next === this.raw) return;
    this.raw = next;
    this.emitChange();
    if (this.raw === 1 && this.direction === 1) this.finish("melted");
    else if (this.raw === 0 && this.direction === -1) this.finish("idle");
  }
  attach(ticker) {
    this.detach?.();
    this.detach = ticker.on("tick", (frame) => this.advance(frame.delta));
    return this.detach;
  }
  dispose() {
    this.detach?.();
    this.detach = null;
    this.active = false;
    this.clear();
  }
  finish(state) {
    if (this.loop) {
      this.direction = this.direction === 1 ? -1 : 1;
      this.transitionTo(this.direction === 1 ? "melting" : "reforming");
      return;
    }
    this.active = false;
    this.transitionTo(state);
    this.emit("complete", state);
  }
  transitionTo(state) {
    if (this.current === state) return;
    this.current = state;
    this.emit("statechange", state);
  }
  emitChange() {
    this.emit("change", { progress: this.raw, eased: this.easing(this.raw), state: this.current });
  }
};

// Packages/MeltGL/src/options.ts
var MELT_DEFAULTS = {
  duration: 1.6,
  maxPixelRatio: 2,
  maxStepsPerFrame: 24,
  reducedMotionDuration: 0.05
};
var MELT_RANGES = {
  duration: [0.05, Number.MAX_SAFE_INTEGER],
  maxPixelRatio: [0.5, 8],
  maxStepsPerFrame: [1, 240]
};
var BACKENDS = ["auto", "webgl2", "svg"];
var isPositiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
var validateOptions = (options) => {
  if (typeof HTMLElement === "undefined" || !(options.target instanceof HTMLElement)) {
    throw new MeltError("invalid-options", "target must be an HTMLElement");
  }
  if (options.duration !== void 0 && !isPositiveNumber(options.duration)) {
    throw new MeltError("invalid-options", `duration must be a finite number above zero, received ${String(options.duration)}`);
  }
  if (options.maxPixelRatio !== void 0 && !isPositiveNumber(options.maxPixelRatio)) {
    throw new MeltError("invalid-options", `maxPixelRatio must be a number above zero, received ${String(options.maxPixelRatio)}`);
  }
  if (options.maxStepsPerFrame !== void 0 && !isPositiveNumber(options.maxStepsPerFrame)) {
    throw new MeltError("invalid-options", `maxStepsPerFrame must be a number above zero, received ${String(options.maxStepsPerFrame)}`);
  }
  if (options.backend !== void 0 && !BACKENDS.includes(options.backend)) {
    throw new MeltError("invalid-options", `backend must be one of ${BACKENDS.join(", ")}, received ${String(options.backend)}`);
  }
};
var resolveMaxStepsPerFrame = (value) => {
  const [min, max] = MELT_RANGES.maxStepsPerFrame;
  return Math.round(Math.min(Math.max(value ?? MELT_DEFAULTS.maxStepsPerFrame, min), max));
};
var prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Packages/SourceGraphics/src/imageSource.ts
var ImageSource = class {
  constructor(input) {
    __publicField(this, "dynamic", false);
    __publicField(this, "image", null);
    __publicField(this, "input");
    __publicField(this, "loaded", false);
    this.input = input;
  }
  get ready() {
    return this.loaded;
  }
  get width() {
    return this.image?.naturalWidth ?? 0;
  }
  get height() {
    return this.image?.naturalHeight ?? 0;
  }
  async load() {
    if (this.loaded) return;
    const image = typeof this.input === "string" ? new Image() : this.input;
    if (typeof this.input === "string") {
      image.crossOrigin = "anonymous";
      image.src = this.input;
    }
    if (!image.complete || image.naturalWidth === 0) {
      await new Promise((resolve, reject) => {
        const onLoaded = () => {
          image.removeEventListener("error", onFailed);
          resolve();
        };
        const onFailed = () => {
          image.removeEventListener("load", onLoaded);
          reject(new MeltError("source-unavailable", `failed to load ${image.src}`));
        };
        image.addEventListener("load", onLoaded, { once: true });
        image.addEventListener("error", onFailed, { once: true });
      });
    }
    assert(image.naturalWidth > 0, "source-unavailable", `image has no dimensions: ${image.src}`);
    this.image = image;
    this.loaded = true;
  }
  frame() {
    return this.loaded ? this.image : null;
  }
  dispose() {
    this.image = null;
    this.loaded = false;
  }
};

// Packages/SourceGraphics/src/videoSource.ts
var VideoSource = class {
  constructor(input) {
    __publicField(this, "dynamic", true);
    __publicField(this, "video");
    __publicField(this, "owned");
    __publicField(this, "loaded", false);
    this.owned = typeof input === "string";
    if (typeof input === "string") {
      this.video = document.createElement("video");
      this.video.crossOrigin = "anonymous";
      this.video.muted = true;
      this.video.loop = true;
      this.video.playsInline = true;
      this.video.src = input;
    } else {
      this.video = input;
    }
  }
  get ready() {
    return this.loaded && this.video.readyState >= 2;
  }
  get width() {
    return this.video.videoWidth;
  }
  get height() {
    return this.video.videoHeight;
  }
  async load() {
    if (this.video.readyState < 2) {
      const failure = this.video.error;
      if (failure) throw new MeltError("source-unavailable", `the video element already failed: ${failure.message}`);
      await new Promise((resolve, reject) => {
        const onLoaded = () => {
          this.video.removeEventListener("error", onFailed);
          resolve();
        };
        const onFailed = () => {
          this.video.removeEventListener("loadeddata", onLoaded);
          reject(new MeltError("source-unavailable", `failed to load video: ${this.video.error?.message ?? "unknown error"}`));
        };
        this.video.addEventListener("loadeddata", onLoaded, { once: true });
        this.video.addEventListener("error", onFailed, { once: true });
      });
    }
    await this.video.play().catch(() => void 0);
    this.loaded = true;
  }
  frame() {
    return this.ready ? this.video : null;
  }
  dispose() {
    this.loaded = false;
    if (!this.owned) return;
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
  }
};

// Packages/SourceGraphics/src/analyse.ts
var SAMPLE = 64;
var RING = 2;
var ALPHA_LIMIT = 250;
var MAX_SPREAD = 0.1;
var estimateKey = (frame) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  let data;
  try {
    context.drawImage(frame, 0, 0, SAMPLE, SAMPLE);
    data = context.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null;
  }
  let translucent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 255) < ALPHA_LIMIT) translucent += 1;
  }
  if (translucent > data.length / 4 * 0.01) return null;
  const ring = [];
  for (let y = 0; y < SAMPLE; y += 1) {
    for (let x = 0; x < SAMPLE; x += 1) {
      if (x >= RING && y >= RING && x < SAMPLE - RING && y < SAMPLE - RING) continue;
      const i = (y * SAMPLE + x) * 4;
      ring.push([(data[i] ?? 0) / 255, (data[i + 1] ?? 0) / 255, (data[i + 2] ?? 0) / 255]);
    }
  }
  const mean = [0, 0, 0];
  for (const [r, g, b] of ring) {
    mean[0] += r;
    mean[1] += g;
    mean[2] += b;
  }
  mean[0] /= ring.length;
  mean[1] /= ring.length;
  mean[2] /= ring.length;
  let spread = 0;
  for (const [r, g, b] of ring) {
    spread += Math.hypot(r - mean[0], g - mean[1], b - mean[2]);
  }
  spread /= ring.length;
  if (spread > MAX_SPREAD) return null;
  return { colour: mean, tolerance: clamp(spread * 2.5 + 0.06, 0.08, 0.3) };
};

// Packages/MeltGL/src/resolveSource.ts
var VIDEO_URL = /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i;
var isGraphicsSource = (value) => typeof value === "object" && "frame" in value && typeof value.frame === "function";
var resolveSource = (input) => {
  if (typeof input === "string") return VIDEO_URL.test(input) ? new VideoSource(input) : new ImageSource(input);
  if (isGraphicsSource(input)) return input;
  if (input instanceof HTMLImageElement) return new ImageSource(input);
  if (input instanceof HTMLVideoElement) return new VideoSource(input);
  throw new MeltError("invalid-options", "source must be an image, a video, a URL, or a GraphicsSource");
};

// Packages/DisplacementEngine/src/materials.ts
var MATERIALS = {
  wax: {
    viscosity: 0.02,
    density: 0.9,
    tension: 0.5,
    meltRate: 1,
    cooling: 0.35,
    yield: 0.08,
    gloss: 0.35,
    fresnel: 0.3,
    refraction: 0.01,
    blend: 0.2,
    translucency: 0.2,
    absorption: [0.1, 0.1, 0.1],
    tint: [1, 1, 1, 1]
  },
  honey: {
    viscosity: 2.5,
    density: 1.4,
    tension: 0.7,
    meltRate: 1.2,
    cooling: 0,
    yield: 0,
    gloss: 0.85,
    fresnel: 0.5,
    refraction: 0.03,
    blend: 0.65,
    translucency: 0.6,
    absorption: [0.05, 0.4, 1.1],
    tint: [1, 0.72, 0.25, 1]
  },
  chocolate: {
    viscosity: 1.5,
    density: 1.2,
    tension: 0.45,
    meltRate: 0.9,
    cooling: 0.15,
    yield: 0.35,
    gloss: 0.6,
    fresnel: 0.25,
    refraction: 5e-3,
    blend: 0.9,
    translucency: 0.1,
    absorption: [0.5, 0.9, 1.3],
    tint: [0.36, 0.2, 0.1, 1]
  },
  tar: {
    viscosity: 12,
    density: 1.3,
    tension: 0.3,
    meltRate: 0.6,
    cooling: 0,
    yield: 0.25,
    gloss: 0.95,
    fresnel: 0.7,
    refraction: 0,
    blend: 1,
    translucency: 0,
    absorption: [2, 2, 2],
    tint: [0.05, 0.05, 0.05, 1]
  },
  solder: {
    viscosity: 5e-3,
    density: 3,
    tension: 1,
    meltRate: 2.5,
    cooling: 1.2,
    yield: 0,
    gloss: 1,
    fresnel: 0.9,
    refraction: 0,
    blend: 0.85,
    translucency: 0,
    absorption: [0.15, 0.15, 0.15],
    tint: [0.78, 0.8, 0.85, 1]
  },
  slime: {
    viscosity: 0.4,
    density: 0.8,
    tension: 0.85,
    meltRate: 1.5,
    cooling: 0,
    yield: 0.12,
    gloss: 0.7,
    fresnel: 0.4,
    refraction: 0.04,
    blend: 0.7,
    translucency: 0.5,
    absorption: [0.9, 0.1, 0.9],
    tint: [0.45, 1, 0.3, 1]
  }
};
var MATERIAL_RANGES = {
  viscosity: [1e-3, 50],
  density: [0.1, 4],
  tension: [0, 1],
  meltRate: [0.05, 6],
  cooling: [0, 3],
  yield: [0, 1],
  gloss: [0, 1],
  fresnel: [0, 1],
  refraction: [0, 0.08],
  blend: [0, 1],
  translucency: [0, 1]
};
var resolveMaterial = (input = "wax") => {
  if (typeof input === "string") return { ...MATERIALS[input] };
  const { base, ...overrides } = input;
  const merged = { ...MATERIALS[base ?? "wax"], ...overrides };
  return {
    ...merged,
    viscosity: clamp(merged.viscosity, ...MATERIAL_RANGES.viscosity),
    density: clamp(merged.density, ...MATERIAL_RANGES.density),
    tension: clamp(merged.tension, ...MATERIAL_RANGES.tension),
    meltRate: clamp(merged.meltRate, ...MATERIAL_RANGES.meltRate),
    cooling: clamp(merged.cooling, ...MATERIAL_RANGES.cooling),
    yield: clamp(merged.yield, ...MATERIAL_RANGES.yield),
    gloss: clamp(merged.gloss, ...MATERIAL_RANGES.gloss),
    fresnel: clamp(merged.fresnel, ...MATERIAL_RANGES.fresnel),
    refraction: clamp(merged.refraction, ...MATERIAL_RANGES.refraction),
    blend: clamp(merged.blend, ...MATERIAL_RANGES.blend),
    translucency: clamp(merged.translucency, ...MATERIAL_RANGES.translucency)
  };
};

// Packages/DisplacementEngine/src/options.ts
var DEFAULT_SIMULATION_OPTIONS = {
  material: "wax",
  layerDelay: 0.35,
  ground: "open",
  simulationScale: 0.4,
  substeps: 2,
  viscosityIterations: 16,
  pressureIterations: 24,
  pressureSolver: "multigrid",
  pressureCycles: 2,
  stepDuration: 1 / 60,
  snapshotEvery: 12,
  maxKeyframes: 48,
  gravity: 1,
  drag: 1,
  meltPoint: 0.5,
  conduction: 4,
  heatTop: 1.2,
  coreHeat: 0.1,
  surfaceHeat: 2,
  surfaceDepth: 5,
  columnFeed: 0.5,
  onsetSpread: 0.6,
  noiseScale: 4,
  freezePoint: 0.45,
  solidViscosity: 40,
  curvatureFlow: 0.1,
  volumeGuard: 0.15,
  rim: 6,
  edgeWidth: 0.6,
  dripRoom: 0.6,
  topRoom: 0.08,
  sideRoom: 0.15,
  seed: 11,
  light: [-0.35, 0.6, 1]
};
var SIMULATION_RANGES = {
  layerDelay: [0, 5],
  simulationScale: [0.125, 1],
  substeps: [1, 6],
  viscosityIterations: [2, 64],
  pressureIterations: [2, 96],
  pressureCycles: [1, 6],
  stepDuration: [1 / 240, 1 / 15],
  snapshotEvery: [1, 120],
  maxKeyframes: [4, 512],
  gravity: [0, 4],
  drag: [0, 10],
  meltPoint: [0.2, 0.8],
  conduction: [0, 16],
  heatTop: [0, 3],
  coreHeat: [0, 4],
  surfaceHeat: [0, 6],
  surfaceDepth: [1, 20],
  columnFeed: [0, 1],
  onsetSpread: [0, 1],
  noiseScale: [0.5, 16],
  freezePoint: [0, 0.8],
  solidViscosity: [5, 400],
  curvatureFlow: [0, 0.5],
  volumeGuard: [0, 0.5],
  rim: [0, 32],
  edgeWidth: [0.2, 2],
  dripRoom: [0, 2],
  topRoom: [0, 1],
  sideRoom: [0, 1]
};
var defined = (source) => {
  const result = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== void 0) result[key] = value;
  }
  return result;
};
var number = (value, name) => {
  const [min, max] = SIMULATION_RANGES[name];
  const fallback = DEFAULT_SIMULATION_OPTIONS[name];
  return clamp(Number.isFinite(value) ? value : fallback, min, max);
};
var integer = (value, name) => Math.round(number(value, name));
var unit = (direction) => {
  const [x, y, z] = direction;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
};
var resolveLight = (light) => {
  if (Array.isArray(light) && light.length === 3) {
    const [x, y, z] = light.map((component) => Number(component));
    const length = Math.hypot(x, y, z);
    if (Number.isFinite(length) && length > 1e-6) return unit([x, y, z]);
  }
  return unit(DEFAULT_SIMULATION_OPTIONS.light);
};
var resolveLayers = (inputs, layerDelay) => inputs.map((layer, index) => ({
  material: resolveMaterial(layer.material),
  delay: Math.max(0, Number.isFinite(layer.delay ?? Number.NaN) ? layer.delay : index * layerDelay)
}));
var resolveSimulationOptions = (overrides = {}) => {
  const merged = { ...DEFAULT_SIMULATION_OPTIONS, ...defined(overrides) };
  const layerDelay = number(merged.layerDelay, "layerDelay");
  const layerInputs = merged.layers && merged.layers.length > 0 ? merged.layers : [{ material: merged.material }];
  return {
    layers: resolveLayers(layerInputs, layerDelay),
    layerDelay,
    ground: merged.ground === "floor" ? "floor" : "open",
    simulationScale: number(merged.simulationScale, "simulationScale"),
    substeps: integer(merged.substeps, "substeps"),
    viscosityIterations: integer(merged.viscosityIterations, "viscosityIterations"),
    pressureIterations: integer(merged.pressureIterations, "pressureIterations"),
    pressureSolver: merged.pressureSolver === "jacobi" ? "jacobi" : "multigrid",
    pressureCycles: integer(merged.pressureCycles, "pressureCycles"),
    stepDuration: number(merged.stepDuration, "stepDuration"),
    snapshotEvery: integer(merged.snapshotEvery, "snapshotEvery"),
    maxKeyframes: integer(merged.maxKeyframes, "maxKeyframes"),
    gravity: number(merged.gravity, "gravity"),
    drag: number(merged.drag, "drag"),
    meltPoint: number(merged.meltPoint, "meltPoint"),
    conduction: number(merged.conduction, "conduction"),
    heatTop: number(merged.heatTop, "heatTop"),
    coreHeat: number(merged.coreHeat, "coreHeat"),
    surfaceHeat: number(merged.surfaceHeat, "surfaceHeat"),
    surfaceDepth: number(merged.surfaceDepth, "surfaceDepth"),
    columnFeed: number(merged.columnFeed, "columnFeed"),
    onsetSpread: number(merged.onsetSpread, "onsetSpread"),
    noiseScale: number(merged.noiseScale, "noiseScale"),
    freezePoint: number(merged.freezePoint, "freezePoint"),
    solidViscosity: number(merged.solidViscosity, "solidViscosity"),
    curvatureFlow: number(merged.curvatureFlow, "curvatureFlow"),
    volumeGuard: number(merged.volumeGuard, "volumeGuard"),
    rim: number(merged.rim, "rim"),
    edgeWidth: number(merged.edgeWidth, "edgeWidth"),
    dripRoom: number(merged.dripRoom, "dripRoom"),
    topRoom: number(merged.topRoom, "topRoom"),
    sideRoom: number(merged.sideRoom, "sideRoom"),
    seed: Number.isFinite(merged.seed) ? merged.seed : DEFAULT_SIMULATION_OPTIONS.seed,
    light: resolveLight(merged.light)
  };
};
var toSimulationInput = (resolved) => {
  const { layers, ...rest } = resolved;
  return { ...rest, layers: layers.map((layer) => ({ material: layer.material, delay: layer.delay })) };
};
var mergeSimulationOptions = (previous, overrides) => {
  const { material, layers, ...rest } = defined(overrides);
  const base = { ...toSimulationInput(previous), ...rest };
  if (layers && layers.length > 0) return resolveSimulationOptions({ ...base, layers });
  if (material === void 0) return resolveSimulationOptions(base);
  const replaced = previous.layers.map((layer, index) => ({
    material: index === 0 ? material : layer.material,
    delay: layer.delay
  }));
  return resolveSimulationOptions({ ...base, layers: replaced });
};

// Packages/DisplacementEngine/src/scheme.ts
var INITIAL_SLOPE = 3;
var FAR_FIELD = 24;
var CURVATURE_BAND_INNER = 2;
var CURVATURE_BAND_OUTER = 4;
var HEAT_BAND_START = 0.2;
var MAX_TEMPERATURE = 1.5;
var LIQUID_BAND = 0.1;
var MELT_BAND = 0.2;
var SHADE_WET_BAND = 0.15;
var SURFACE_BAND_OUTER = 0.5;
var GRAVITY_BAND = 2;
var TENSION_BAND = 1.5;
var FREEZE_ONSET = 0.25;
var PAPANASTASIOU_EXPONENT = 50;
var AIR_VELOCITY_DECAY = 0.9;
var ONSET_OCTAVES = 3;
var COLUMN_OCTAVES = 2;
var COLUMN_FREQUENCY = 2;
var SEED_DECORRELATION = 0.37;
var LAYER_SEED_STRIDE = 17.3;
var NORMAL_FLATNESS = 0.25;
var HELD_BAND_INNER = 0.9;
var HELD_BAND_OUTER = 2;
var STRETCH_ALPHA_INNER = 5e-3;
var STRETCH_ALPHA_OUTER = 0.05;
var THICKNESS_PER_RIM = 2;
var COVERAGE_CUTOFF = 3e-3;
var AMBIENT = 0.8;
var SPECULAR_POWER_MIN = 10;
var SPECULAR_POWER_MAX = 260;
var FRESNEL_POWER = 3;
var SKY_FLOOR = 0.2;
var REFLECTION_STRENGTH = 0.7;
var TRANSLUCENCY_STRENGTH = 0.6;
var RIM_MINIMUM = 2;
var GRAVITY_PER_HEIGHT = 0.15;
var MIN_LIQUID_VISCOSITY = 0.05;
var VISCOSITY_PER_HEIGHT = 0.12;
var YIELD_PER_HEIGHT = 0.3;
var TENSION_STABILITY = 0.4;
var REINIT_PASSES = 2;
var INITIAL_REINIT_PASSES = 8;
var SMOOTH_PASSES = 4;
var COARSEST_LEVEL = 8;
var MAX_LEVELS = 6;
var FLOOR_ROWS = 2;
var WALL_DISTANCE = 1;
var CFL_LIMIT = 0.5;
var FLOOR_SOFT = 10;

// Packages/NoiseGenerator/src/glsl.ts
var HASH_GLSL = `
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
`;
var SIMPLEX_NOISE_GLSL = `
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
`;
var FBM_GLSL = `
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
`;
var NOISE_CHUNKS = {
  hash: HASH_GLSL,
  simplex: SIMPLEX_NOISE_GLSL,
  fbm: FBM_GLSL
};
var composeNoise = (...names) => names.map((name) => NOISE_CHUNKS[name]).join("\n");
var NOISE_PRELUDE = composeNoise("hash", "simplex", "fbm");

// Packages/DisplacementEngine/src/shaders.ts
var glslFloat = (name, value) => `const float ${name} = ${value.toFixed(6)};`;
var glslInt = (name, value) => `const int ${name} = ${Math.round(value)};`;
var SCHEME_GLSL = [
  glslFloat("INITIAL_SLOPE", INITIAL_SLOPE),
  glslFloat("FAR_FIELD", FAR_FIELD),
  glslFloat("CURVATURE_BAND_INNER", CURVATURE_BAND_INNER),
  glslFloat("CURVATURE_BAND_OUTER", CURVATURE_BAND_OUTER),
  glslFloat("HEAT_BAND_START", HEAT_BAND_START),
  glslFloat("MAX_TEMPERATURE", MAX_TEMPERATURE),
  glslFloat("LIQUID_BAND", LIQUID_BAND),
  glslFloat("MELT_BAND", MELT_BAND),
  glslFloat("SHADE_WET_BAND", SHADE_WET_BAND),
  glslFloat("SURFACE_BAND_OUTER", SURFACE_BAND_OUTER),
  glslFloat("GRAVITY_BAND", GRAVITY_BAND),
  glslFloat("TENSION_BAND", TENSION_BAND),
  glslFloat("FREEZE_ONSET", FREEZE_ONSET),
  glslFloat("PAPANASTASIOU_EXPONENT", PAPANASTASIOU_EXPONENT),
  glslFloat("AIR_VELOCITY_DECAY", AIR_VELOCITY_DECAY),
  glslFloat("CFL_LIMIT", CFL_LIMIT),
  glslFloat("WALL_DISTANCE", WALL_DISTANCE),
  glslFloat("FLOOR_SOFT", FLOOR_SOFT),
  glslInt("ONSET_OCTAVES", ONSET_OCTAVES),
  glslInt("COLUMN_OCTAVES", COLUMN_OCTAVES),
  glslFloat("COLUMN_FREQUENCY", COLUMN_FREQUENCY),
  glslFloat("SEED_DECORRELATION", SEED_DECORRELATION),
  glslFloat("NORMAL_FLATNESS", NORMAL_FLATNESS),
  glslFloat("HELD_BAND_INNER", HELD_BAND_INNER),
  glslFloat("HELD_BAND_OUTER", HELD_BAND_OUTER),
  glslFloat("STRETCH_ALPHA_INNER", STRETCH_ALPHA_INNER),
  glslFloat("STRETCH_ALPHA_OUTER", STRETCH_ALPHA_OUTER),
  glslFloat("THICKNESS_PER_RIM", THICKNESS_PER_RIM),
  glslFloat("COVERAGE_CUTOFF", COVERAGE_CUTOFF),
  glslFloat("AMBIENT", AMBIENT),
  glslFloat("SPECULAR_POWER_MIN", SPECULAR_POWER_MIN),
  glslFloat("SPECULAR_POWER_MAX", SPECULAR_POWER_MAX),
  glslFloat("FRESNEL_POWER", FRESNEL_POWER),
  glslFloat("SKY_FLOOR", SKY_FLOOR),
  glslFloat("REFLECTION_STRENGTH", REFLECTION_STRENGTH),
  glslFloat("TRANSLUCENCY_STRENGTH", TRANSLUCENCY_STRENGTH)
].join("\n");
var FIELD_HEADER_GLSL = `#version 300 es
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
`;
var LEVEL_SET_GLSL = `
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
`;
var INIT_A_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform sampler2D uOrigin;

void main() {
  float alpha = texture(uOrigin, vUv).a;
  float phi = (0.5 - alpha) * INITIAL_SLOPE;
  outField = vec4(0.0, 0.0, phi, 0.0);
}
`;
var INIT_B_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
void main() {
  outField = vec4(vUv, 0.0, 0.0);
}
`;
var REINIT_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
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
`;
var ADVECT_A_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
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
`;
var ROW_VOLUME_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform int uCount;

void main() {
  float total = 0.0;
  for (int i = 0; i < uCount; i++) {
    float phi = texture(uA, vec2((float(i) + 0.5) * uTexel.x, vUv.y)).z;
    total += 1.0 - smoothstep(-0.5, 0.5, phi);
  }
  outField = vec4(total / float(uCount), 0.0, 0.0, 0.0);
}
`;
var COLUMN_VOLUME_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform sampler2D uRows;
uniform int uCount;

void main() {
  float total = 0.0;
  for (int i = 0; i < uCount; i++) {
    total += texture(uRows, vec2(0.5, (float(i) + 0.5) * uTexel.y)).x;
  }
  outField = vec4(total / float(uCount), 0.0, 0.0, 0.0);
}
`;
var ADVECT_B_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
void main() {
  vec2 velocity = texture(uA, vUv).xy;
  vec2 back = vUv - velocity * uDt * uTexel;
  outField = texture(uB, back);
}
`;
var VISCOSITY_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
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
`;
var DIVERGENCE_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
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
`;
var PRESSURE_COMMON_GLSL = `
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
`;
var PRESSURE_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
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
`;
var RESIDUAL_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
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
`;
var RESTRICT_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
uniform sampler2D uResidual;
uniform sampler2D uFineRhs;

void main() {
  float residual = texture(uResidual, vUv).x;
  float mask = texture(uFineRhs, vUv).y;
  outField = vec4(residual * 4.0, mask, 0.0, 0.0);
}
`;
var PROLONGATE_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
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
`;
var SUBTRACT_FRAGMENT_GLSL = `${FIELD_HEADER_GLSL}
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
`;
var SHADE_FRAGMENT_GLSL = `#version 300 es
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
`;
var PAINT_FRAGMENT_GLSL = `#version 300 es
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
`;

// Packages/RenderPipeline/src/program.ts
var compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  assert(shader, "context-unavailable", "failed to allocate a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "unknown error";
    gl.deleteShader(shader);
    const stage = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    assert(false, "shader-compile", `${stage} shader failed to compile: ${log}`);
  }
  return shader;
};
var Program = class {
  constructor(gl, vertexSource, fragmentSource) {
    __publicField(this, "handle");
    __publicField(this, "gl");
    __publicField(this, "uniforms", /* @__PURE__ */ new Map());
    __publicField(this, "unit", 0);
    this.gl = gl;
    const program = gl.createProgram();
    assert(program, "context-unavailable", "failed to allocate a program");
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment2 = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment2);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment2);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? "unknown error";
      gl.deleteProgram(program);
      assert(false, "program-link", `program failed to link: ${log}`);
    }
    this.handle = program;
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i += 1) {
      const info = gl.getActiveUniform(program, i);
      if (!info) continue;
      const name = info.name.replace(/\[0\]$/, "");
      const location = gl.getUniformLocation(program, name);
      if (location) this.uniforms.set(name, { location, type: info.type });
    }
  }
  use() {
    this.gl.useProgram(this.handle);
    this.unit = 0;
  }
  set(name, value) {
    const record = this.uniforms.get(name);
    if (!record) return;
    const { gl } = this;
    const { location, type } = record;
    if (typeof value === "boolean") {
      gl.uniform1i(location, value ? 1 : 0);
      return;
    }
    if (typeof value === "number") {
      if (type === gl.INT || type === gl.BOOL) gl.uniform1i(location, value);
      else gl.uniform1f(location, value);
      return;
    }
    const data = value instanceof Float32Array ? value : new Float32Array(Array.from(value));
    switch (type) {
      case gl.FLOAT_VEC2:
        gl.uniform2fv(location, data);
        break;
      case gl.FLOAT_VEC3:
        gl.uniform3fv(location, data);
        break;
      case gl.FLOAT_VEC4:
        gl.uniform4fv(location, data);
        break;
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(location, false, data);
        break;
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(location, false, data);
        break;
      default:
        gl.uniform1fv(location, data);
    }
  }
  setTexture(name, texture) {
    const record = this.uniforms.get(name);
    if (!record) return;
    const { gl } = this;
    const unit2 = this.unit;
    this.unit += 1;
    gl.activeTexture(gl.TEXTURE0 + unit2);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(record.location, unit2);
  }
  dispose() {
    this.gl.deleteProgram(this.handle);
    this.uniforms.clear();
  }
};

// Packages/RenderPipeline/src/texture.ts
var Texture = class {
  constructor(gl, options = {}) {
    __publicField(this, "gl");
    __publicField(this, "internalFormat");
    __publicField(this, "format");
    __publicField(this, "type");
    __publicField(this, "filter");
    __publicField(this, "wrap");
    __publicField(this, "flipY");
    __publicField(this, "premultiply");
    __publicField(this, "current");
    __publicField(this, "currentWidth");
    __publicField(this, "currentHeight");
    this.gl = gl;
    this.internalFormat = options.internalFormat ?? gl.RGBA8;
    this.format = options.format ?? gl.RGBA;
    this.type = options.type ?? gl.UNSIGNED_BYTE;
    this.filter = options.filter ?? gl.LINEAR;
    this.wrap = options.wrap ?? gl.CLAMP_TO_EDGE;
    this.flipY = options.flipY ?? false;
    this.premultiply = options.premultiply ?? false;
    this.currentWidth = Math.max(1, options.width ?? 1);
    this.currentHeight = Math.max(1, options.height ?? 1);
    this.current = this.allocate(this.currentWidth, this.currentHeight);
  }
  get handle() {
    return this.current;
  }
  get width() {
    return this.currentWidth;
  }
  get height() {
    return this.currentHeight;
  }
  resize(width, height) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (w === this.currentWidth && h === this.currentHeight) return;
    this.gl.deleteTexture(this.current);
    this.currentWidth = w;
    this.currentHeight = h;
    this.current = this.allocate(w, h);
  }
  upload(source, width, height) {
    const { gl } = this;
    this.resize(width, height);
    gl.bindTexture(gl.TEXTURE_2D, this.current);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiply);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, this.format, this.type, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  uploadData(data, width, height) {
    const { gl } = this;
    this.resize(width, height);
    gl.bindTexture(gl.TEXTURE_2D, this.current);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, this.format, this.type, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  dispose() {
    this.gl.deleteTexture(this.current);
  }
  allocate(width, height) {
    const { gl } = this;
    const texture = gl.createTexture();
    assert(texture, "context-unavailable", "failed to allocate a texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrap);
    gl.texStorage2D(gl.TEXTURE_2D, 1, this.internalFormat, width, height);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }
};

// Packages/RenderPipeline/src/renderTarget.ts
var RenderTarget = class {
  constructor(gl, width, height) {
    __publicField(this, "texture");
    __publicField(this, "gl");
    __publicField(this, "framebuffer");
    const framebuffer = gl.createFramebuffer();
    assert(framebuffer, "context-unavailable", "failed to allocate a framebuffer");
    this.gl = gl;
    this.framebuffer = framebuffer;
    this.texture = new Texture(gl, { width, height });
    this.attach();
  }
  get width() {
    return this.texture.width;
  }
  get height() {
    return this.texture.height;
  }
  resize(width, height) {
    if (width === this.texture.width && height === this.texture.height) return;
    this.texture.resize(width, height);
    this.attach();
  }
  bind() {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.texture.width, this.texture.height);
  }
  dispose() {
    this.gl.deleteFramebuffer(this.framebuffer);
    this.texture.dispose();
  }
  attach() {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture.handle, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    assert(
      status === gl.FRAMEBUFFER_COMPLETE,
      "framebuffer-incomplete",
      `framebuffer is incomplete: 0x${status.toString(16)}`
    );
  }
};
var PingPong = class {
  constructor(gl, width, height) {
    __publicField(this, "front");
    __publicField(this, "back");
    this.front = new RenderTarget(gl, width, height);
    this.back = new RenderTarget(gl, width, height);
  }
  get read() {
    return this.front;
  }
  get write() {
    return this.back;
  }
  swap() {
    const previous = this.front;
    this.front = this.back;
    this.back = previous;
  }
  resize(width, height) {
    this.front.resize(width, height);
    this.back.resize(width, height);
  }
  dispose() {
    this.front.dispose();
    this.back.dispose();
  }
};

// Packages/RenderPipeline/src/multiRenderTarget.ts
var MultiRenderTarget = class {
  constructor(gl, width, height, attachments) {
    __publicField(this, "textures");
    __publicField(this, "gl");
    __publicField(this, "framebuffer");
    __publicField(this, "buffers");
    assert(attachments.length > 0, "invalid-options", "a render target needs at least one attachment");
    const framebuffer = gl.createFramebuffer();
    assert(framebuffer, "context-unavailable", "failed to allocate a framebuffer");
    this.gl = gl;
    this.framebuffer = framebuffer;
    this.textures = attachments.map((options) => new Texture(gl, { ...options, width, height }));
    this.buffers = attachments.map((_, index) => gl.COLOR_ATTACHMENT0 + index);
    this.attach();
  }
  get width() {
    return this.textures[0]?.width ?? 0;
  }
  get height() {
    return this.textures[0]?.height ?? 0;
  }
  texture(index) {
    const texture = this.textures[index];
    assert(texture, "invalid-options", `no attachment at index ${index}`);
    return texture;
  }
  resize(width, height) {
    if (width === this.width && height === this.height) return;
    for (const texture of this.textures) texture.resize(width, height);
    this.attach();
  }
  bind() {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.drawBuffers(this.buffers);
    gl.viewport(0, 0, this.width, this.height);
  }
  dispose() {
    this.gl.deleteFramebuffer(this.framebuffer);
    for (const texture of this.textures) texture.dispose();
  }
  attach() {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    this.textures.forEach((texture, index) => {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + index, gl.TEXTURE_2D, texture.handle, 0);
    });
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    assert(
      status === gl.FRAMEBUFFER_COMPLETE,
      "framebuffer-incomplete",
      `multi render target is incomplete: 0x${status.toString(16)}`
    );
  }
};
var MultiPingPong = class {
  constructor(gl, width, height, attachments) {
    __publicField(this, "front");
    __publicField(this, "back");
    this.front = new MultiRenderTarget(gl, width, height, attachments);
    this.back = new MultiRenderTarget(gl, width, height, attachments);
  }
  get read() {
    return this.front;
  }
  get write() {
    return this.back;
  }
  swap() {
    const previous = this.front;
    this.front = this.back;
    this.back = previous;
  }
  resize(width, height) {
    this.front.resize(width, height);
    this.back.resize(width, height);
  }
  dispose() {
    this.front.dispose();
    this.back.dispose();
  }
};

// Packages/Geometry/src/quad.ts
var QUAD = {
  positions: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
  indices: new Uint16Array([0, 1, 2, 2, 1, 3])
};

// Packages/Geometry/src/buffers.ts
var createBuffer = (gl) => {
  const buffer = gl.createBuffer();
  assert(buffer, "context-unavailable", "failed to allocate a buffer");
  return buffer;
};
var POSITION_LOCATION = 0;
var UV_LOCATION = 1;
var uploadMesh = (gl, mesh) => {
  const vao = gl.createVertexArray();
  assert(vao, "context-unavailable", "failed to allocate a vertex array");
  const position = createBuffer(gl);
  const uv = createBuffer(gl);
  const index = createBuffer(gl);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(POSITION_LOCATION);
  gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, uv);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(UV_LOCATION);
  gl.vertexAttribPointer(UV_LOCATION, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return {
    vao,
    indexCount: mesh.indices.length,
    indexType: mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    dispose: () => {
      gl.deleteBuffer(position);
      gl.deleteBuffer(uv);
      gl.deleteBuffer(index);
      gl.deleteVertexArray(vao);
    }
  };
};
var drawMesh = (gl, buffers) => {
  gl.bindVertexArray(buffers.vao);
  gl.drawElements(gl.TRIANGLES, buffers.indexCount, buffers.indexType, 0);
  gl.bindVertexArray(null);
};

// Packages/RenderPipeline/src/shaders.ts
var FULLSCREEN_VERTEX_GLSL = `#version 300 es
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aUv;
out vec2 vUv;

void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
var FRAGMENT_HEADER_GLSL = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uInput;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uTime;
uniform float uProgress;
`;
var fragment = (body, prelude = "") => `${FRAGMENT_HEADER_GLSL}
${prelude}
${body}
`;
var COPY_FRAGMENT_GLSL = fragment(`
void main() {
  fragColor = texture(uInput, vUv);
}
`);

// Packages/RenderPipeline/src/blitter.ts
var COPY_PAIR_FRAGMENT_GLSL = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outFirst;
layout(location = 1) out vec4 outSecond;
uniform sampler2D uFirst;
uniform sampler2D uSecond;

void main() {
  outFirst = texture(uFirst, vUv);
  outSecond = texture(uSecond, vUv);
}
`;
var Blitter = class {
  constructor(gl) {
    __publicField(this, "gl");
    __publicField(this, "quad");
    __publicField(this, "single");
    __publicField(this, "pair");
    this.gl = gl;
    this.quad = uploadMesh(gl, QUAD);
    this.single = new Program(gl, FULLSCREEN_VERTEX_GLSL, COPY_FRAGMENT_GLSL);
    this.pair = new Program(gl, FULLSCREEN_VERTEX_GLSL, COPY_PAIR_FRAGMENT_GLSL);
  }
  copy(source, target, width = 0, height = 0) {
    const { gl } = this;
    if (target) target.bind();
    else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
    }
    gl.disable(gl.BLEND);
    this.single.use();
    this.single.setTexture("uInput", source.handle);
    drawMesh(gl, this.quad);
  }
  copyPair(first, second, target) {
    const { gl } = this;
    target.bind();
    gl.disable(gl.BLEND);
    this.pair.use();
    this.pair.setTexture("uFirst", first.handle);
    this.pair.setTexture("uSecond", second.handle);
    drawMesh(gl, this.quad);
  }
  drawQuad() {
    drawMesh(this.gl, this.quad);
  }
  dispose() {
    this.single.dispose();
    this.pair.dispose();
    this.quad.dispose();
  }
};

// Packages/RenderPipeline/src/pass.ts
var ShaderPass = class {
  constructor(gl, name, fragmentSource, vertexSource = FULLSCREEN_VERTEX_GLSL) {
    __publicField(this, "name");
    __publicField(this, "enabled", true);
    __publicField(this, "program");
    this.name = name;
    this.program = new Program(gl, vertexSource, fragmentSource);
  }
  render(context) {
    this.program.use();
    this.program.set("uResolution", new Float32Array([context.width, context.height]));
    this.program.set("uTime", context.frame.time);
    this.program.set("uProgress", context.progress);
    this.program.setTexture("uInput", context.input.handle);
    this.program.setTexture("uSource", context.source.handle);
    this.bind(context);
    context.drawQuad();
  }
  dispose() {
    this.program.dispose();
  }
  bind(_context) {
  }
};

// Packages/RenderPipeline/src/pipeline.ts
var RenderPipeline = class {
  constructor(surface) {
    __publicField(this, "surface");
    __publicField(this, "gl");
    __publicField(this, "quad");
    __publicField(this, "targets");
    __publicField(this, "copy");
    __publicField(this, "passes", []);
    this.surface = surface;
    this.gl = surface.gl;
    this.quad = uploadMesh(this.gl, QUAD);
    const { width, height } = surface.drawingBufferSize;
    this.targets = new PingPong(this.gl, width, height);
    this.copy = new Program(this.gl, FULLSCREEN_VERTEX_GLSL, COPY_FRAGMENT_GLSL);
  }
  add(pass) {
    this.passes.push(pass);
  }
  insert(index, pass) {
    this.passes.splice(index, 0, pass);
  }
  remove(pass) {
    const index = this.passes.indexOf(pass);
    if (index >= 0) this.passes.splice(index, 1);
  }
  get length() {
    return this.passes.length;
  }
  resize(width, height) {
    this.targets.resize(width, height);
    for (const pass of this.passes) pass.resize?.(width, height);
  }
  render(source, frame, progress) {
    const { gl } = this;
    const { width, height } = this.surface.drawingBufferSize;
    const active = this.passes.filter((pass) => pass.enabled);
    gl.disable(gl.BLEND);
    if (active.length === 0) {
      this.surface.bindDefault();
      this.copy.use();
      this.copy.setTexture("uInput", source.handle);
      drawMesh(gl, this.quad);
      return;
    }
    let input = source;
    for (let i = 0; i < active.length; i += 1) {
      const pass = active[i];
      if (!pass) continue;
      const last = i === active.length - 1;
      if (last) {
        this.surface.bindDefault();
      } else {
        this.targets.write.bind();
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      const context = {
        gl,
        frame,
        progress,
        width,
        height,
        source,
        input,
        drawQuad: () => drawMesh(gl, this.quad)
      };
      pass.render(context);
      if (!last) {
        input = this.targets.write.texture;
        this.targets.swap();
      }
    }
  }
  dispose() {
    this.passes.length = 0;
    this.copy.dispose();
    this.targets.dispose();
    this.quad.dispose();
  }
};

// Packages/DisplacementEngine/src/simulation.ts
var MeltSimulation = class {
  constructor(gl, options, halfFloatRenderable) {
    __publicField(this, "gl");
    __publicField(this, "blitter");
    __publicField(this, "programs");
    __publicField(this, "fieldA");
    __publicField(this, "fieldB");
    __publicField(this, "scalar");
    __publicField(this, "pair");
    __publicField(this, "colour");
    __publicField(this, "options");
    __publicField(this, "layers", []);
    __publicField(this, "members", []);
    __publicField(this, "origin");
    __publicField(this, "originFull");
    __publicField(this, "width", 1);
    __publicField(this, "height", 1);
    __publicField(this, "simWidth", 4);
    __publicField(this, "simHeight", 4);
    __publicField(this, "steps", 0);
    __publicField(this, "target", 0);
    __publicField(this, "keyframeSpacing");
    __publicField(this, "disposed", false);
    assert(halfFloatRenderable, "context-unavailable", "the melt simulation needs renderable half float textures");
    this.gl = gl;
    this.options = resolveSimulationOptions(options);
    this.keyframeSpacing = this.options.snapshotEvery;
    this.blitter = new Blitter(gl);
    const make = (fragment2) => new Program(gl, FULLSCREEN_VERTEX_GLSL, fragment2);
    this.programs = {
      paint: make(PAINT_FRAGMENT_GLSL),
      initA: make(INIT_A_FRAGMENT_GLSL),
      initB: make(INIT_B_FRAGMENT_GLSL),
      reinit: make(REINIT_FRAGMENT_GLSL),
      advectA: make(ADVECT_A_FRAGMENT_GLSL),
      advectB: make(ADVECT_B_FRAGMENT_GLSL),
      viscosity: make(VISCOSITY_FRAGMENT_GLSL),
      divergence: make(DIVERGENCE_FRAGMENT_GLSL),
      pressure: make(PRESSURE_FRAGMENT_GLSL),
      residual: make(RESIDUAL_FRAGMENT_GLSL),
      restrict: make(RESTRICT_FRAGMENT_GLSL),
      prolongate: make(PROLONGATE_FRAGMENT_GLSL),
      subtract: make(SUBTRACT_FRAGMENT_GLSL),
      rowVolume: make(ROW_VOLUME_FRAGMENT_GLSL),
      columnVolume: make(COLUMN_VOLUME_FRAGMENT_GLSL),
      shade: make(SHADE_FRAGMENT_GLSL)
    };
    this.fieldA = { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.LINEAR };
    this.fieldB = { internalFormat: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT, filter: gl.LINEAR };
    this.scalar = { internalFormat: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT, filter: gl.LINEAR };
    this.pair = { internalFormat: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT, filter: gl.LINEAR };
    this.colour = { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, filter: gl.LINEAR };
    this.origin = new MultiRenderTarget(gl, 4, 4, [this.colour]);
    this.originFull = new MultiRenderTarget(gl, 4, 4, [this.colour]);
    this.rebuildLayers();
  }
  get elapsed() {
    return this.steps * this.options.stepDuration;
  }
  get stepDuration() {
    return this.options.stepDuration;
  }
  get settings() {
    return this.options;
  }
  get pending() {
    return this.steps !== this.target;
  }
  get keyframeCount() {
    return this.layers[0]?.keyframes.size ?? 0;
  }
  resize(width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.applyScale();
    this.originFull.resize(w, h);
    this.reset();
  }
  setMembers(members) {
    this.members = [...members];
    this.reset();
  }
  configure(overrides) {
    const previous = this.options;
    const next = mergeSimulationOptions(previous, overrides);
    const structural = next.layers.length !== previous.layers.length || next.simulationScale !== previous.simulationScale || next.snapshotEvery !== previous.snapshotEvery || next.stepDuration !== previous.stepDuration;
    this.options = next;
    if (structural) {
      this.rebuildLayers();
      this.applyScale();
      this.reset();
      return;
    }
    this.layers.forEach((entry, index) => {
      const layer = next.layers[index];
      if (layer) entry.layer = layer;
      this.clearKeyframes(entry);
    });
    this.keyframeSpacing = next.snapshotEvery;
  }
  reset() {
    this.steps = 0;
    this.target = 0;
    this.keyframeSpacing = this.options.snapshotEvery;
    this.paintMembers(this.origin);
    this.paintMembers(this.originFull);
    for (const entry of this.layers) {
      this.clearKeyframes(entry);
      this.initialise(entry);
    }
  }
  refreshOrigin() {
    this.paintMembers(this.origin);
    this.paintMembers(this.originFull);
  }
  step() {
    const dt = this.options.stepDuration / this.options.substeps;
    for (let sub = 0; sub < this.options.substeps; sub += 1) {
      const time = this.elapsed + sub * dt;
      for (const entry of this.layers) this.substep(entry, dt, time);
    }
    this.steps += 1;
    if (this.steps % this.keyframeSpacing === 0) this.snapshot();
  }
  seek(time, maxSteps = Number.POSITIVE_INFINITY) {
    const target = Math.max(0, Math.round(time / this.options.stepDuration));
    this.target = target;
    if (target < this.steps && !this.restore(target)) this.reset();
    let budget = maxSteps;
    while (this.steps < target && budget > 0) {
      this.step();
      budget -= 1;
    }
    return this.steps === target;
  }
  render() {
    const { gl } = this;
    const program = this.programs.shade;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (let i = this.layers.length - 1; i >= 0; i -= 1) {
      const entry = this.layers[i];
      if (!entry) continue;
      const { material } = entry.layer;
      program.use();
      program.set("uTexel", this.texel());
      program.set("uMeltPoint", this.options.meltPoint);
      program.set("uRim", this.options.rim * this.options.simulationScale + RIM_MINIMUM);
      program.set("uEdgeWidth", this.options.edgeWidth);
      program.set("uLight", new Float32Array(this.options.light));
      program.set("uGloss", material.gloss);
      program.set("uFresnel", material.fresnel);
      program.set("uRefraction", material.refraction);
      program.set("uBlend", material.blend);
      program.set("uTranslucency", material.translucency);
      program.set("uAbsorption", new Float32Array(material.absorption));
      program.set("uTint", new Float32Array(material.tint));
      program.setTexture("uA", entry.a.read.texture(0).handle);
      program.setTexture("uB", entry.b.read.texture(0).handle);
      program.setTexture("uOrigin", this.originFull.texture(0).handle);
      this.blitter.drawQuad();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.layers) this.disposeLayer(entry);
    this.layers = [];
    this.origin.dispose();
    this.originFull.dispose();
    for (const program of Object.values(this.programs)) program.dispose();
    this.blitter.dispose();
  }
  texel() {
    return new Float32Array([1 / this.simWidth, 1 / this.simHeight]);
  }
  levelTexel(level) {
    return new Float32Array([1 / level.width, 1 / level.height]);
  }
  buildLevels(width, height) {
    const { gl } = this;
    const levels = [];
    let w = width;
    let h = height;
    while (levels.length < MAX_LEVELS) {
      levels.push({
        width: w,
        height: h,
        rhs: new MultiRenderTarget(gl, w, h, [this.pair]),
        pressure: new MultiPingPong(gl, w, h, [this.scalar]),
        residual: new MultiRenderTarget(gl, w, h, [this.scalar])
      });
      if (Math.min(w, h) <= COARSEST_LEVEL) break;
      w = Math.ceil(w / 2);
      h = Math.ceil(h / 2);
    }
    return levels;
  }
  disposeLevels(levels) {
    for (const level of levels) {
      level.rhs.dispose();
      level.pressure.dispose();
      level.residual.dispose();
    }
  }
  applyScale() {
    this.simWidth = Math.max(4, Math.round(this.width * this.options.simulationScale));
    this.simHeight = Math.max(4, Math.round(this.height * this.options.simulationScale));
    this.origin.resize(this.simWidth, this.simHeight);
    for (const entry of this.layers) {
      entry.a.resize(this.simWidth, this.simHeight);
      entry.b.resize(this.simWidth, this.simHeight);
      entry.rhs.resize(this.simWidth, this.simHeight);
      entry.rows.resize(1, this.simHeight);
      this.disposeLevels(entry.levels);
      entry.levels = this.buildLevels(this.simWidth, this.simHeight);
      this.clearKeyframes(entry);
    }
  }
  rebuildLayers() {
    for (const entry of this.layers) this.disposeLayer(entry);
    const { gl, simWidth: w, simHeight: h } = this;
    this.layers = this.options.layers.map((layer) => ({
      layer,
      a: new MultiPingPong(gl, w, h, [this.fieldA]),
      b: new MultiPingPong(gl, w, h, [this.fieldB]),
      rhs: new MultiRenderTarget(gl, w, h, [this.fieldA]),
      rows: new MultiRenderTarget(gl, 1, h, [this.scalar]),
      volume: new MultiRenderTarget(gl, 1, 1, [this.scalar]),
      volumeReference: new MultiRenderTarget(gl, 1, 1, [this.scalar]),
      levels: this.buildLevels(w, h),
      keyframes: /* @__PURE__ */ new Map()
    }));
  }
  disposeLayer(entry) {
    this.clearKeyframes(entry);
    entry.a.dispose();
    entry.b.dispose();
    entry.rhs.dispose();
    entry.rows.dispose();
    entry.volume.dispose();
    entry.volumeReference.dispose();
    this.disposeLevels(entry.levels);
  }
  common(program, dt, time, texel = this.texel()) {
    program.use();
    program.set("uTexel", texel);
    program.set("uDt", dt);
    program.set("uTime", time);
    program.set("uFloor", this.options.ground === "floor" ? 1 : 0);
    program.set("uFloorLevel", FLOOR_ROWS / this.simHeight);
  }
  clearTarget(target) {
    const { gl } = this;
    target.bind();
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  paintMembers(target) {
    const { gl } = this;
    const program = this.programs.paint;
    this.clearTarget(target);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const member of this.members) {
      program.use();
      program.set("uRect", new Float32Array(member.rect));
      program.set("uKey", new Float32Array(member.key ? member.key.colour : [0, 0, 0]));
      program.set("uKeyTolerance", member.key ? member.key.tolerance : 0);
      program.set("uKeyEnabled", member.key ? 1 : 0);
      program.setTexture("uSource", member.texture.handle);
      this.blitter.drawQuad();
    }
    gl.disable(gl.BLEND);
  }
  initialise(entry) {
    const { gl } = this;
    gl.disable(gl.BLEND);
    entry.a.write.bind();
    this.common(this.programs.initA, 0, 0);
    this.programs.initA.setTexture("uOrigin", this.origin.texture(0).handle);
    this.blitter.drawQuad();
    entry.a.swap();
    entry.b.write.bind();
    this.common(this.programs.initB, 0, 0);
    this.blitter.drawQuad();
    entry.b.swap();
    this.clearTarget(entry.volume);
    this.clearTarget(entry.volumeReference);
    this.blitter.copy(entry.a.read.texture(0), entry.rhs);
    for (let i = 0; i < INITIAL_REINIT_PASSES; i += 1) this.reinit(entry, 0);
    this.measureVolume(entry);
    this.blitter.copy(entry.volume.texture(0), entry.volumeReference);
    const base = entry.levels[0];
    if (base) {
      this.clearTarget(base.pressure.read);
      this.clearTarget(base.pressure.write);
    }
  }
  reinit(entry, tensionFlow) {
    const program = this.programs.reinit;
    entry.a.write.bind();
    this.common(program, 0, 0);
    program.set("uTensionFlow", tensionFlow);
    program.set("uVolumeGuard", this.options.volumeGuard);
    program.set("uMeltPoint", this.options.meltPoint);
    program.setTexture("uA", entry.a.read.texture(0).handle);
    program.setTexture("uRhs", entry.rhs.texture(0).handle);
    program.setTexture("uVolume", entry.volume.texture(0).handle);
    program.setTexture("uVolumeReference", entry.volumeReference.texture(0).handle);
    this.blitter.drawQuad();
    entry.a.swap();
  }
  measureVolume(entry) {
    const p = this.programs;
    entry.rows.bind();
    this.common(p.rowVolume, 0, 0);
    p.rowVolume.set("uCount", this.simWidth);
    p.rowVolume.setTexture("uA", entry.a.read.texture(0).handle);
    this.blitter.drawQuad();
    entry.volume.bind();
    this.common(p.columnVolume, 0, 0, new Float32Array([1, 1 / this.simHeight]));
    p.columnVolume.set("uCount", this.simHeight);
    p.columnVolume.setTexture("uRows", entry.rows.texture(0).handle);
    this.blitter.drawQuad();
  }
  smooth(level, passes) {
    const program = this.programs.pressure;
    for (let i = 0; i < passes; i += 1) {
      level.pressure.write.bind();
      this.common(program, 0, 0, this.levelTexel(level));
      program.setTexture("uPressure", level.pressure.read.texture(0).handle);
      program.setTexture("uDivergence", level.rhs.texture(0).handle);
      this.blitter.drawQuad();
      level.pressure.swap();
    }
  }
  vcycle(levels, index) {
    const level = levels[index];
    if (!level) return;
    const next = levels[index + 1];
    if (!next) {
      this.smooth(level, SMOOTH_PASSES * 2);
      return;
    }
    this.smooth(level, SMOOTH_PASSES);
    const residual = this.programs.residual;
    level.residual.bind();
    this.common(residual, 0, 0, this.levelTexel(level));
    residual.setTexture("uPressure", level.pressure.read.texture(0).handle);
    residual.setTexture("uDivergence", level.rhs.texture(0).handle);
    this.blitter.drawQuad();
    const restrict = this.programs.restrict;
    next.rhs.bind();
    this.common(restrict, 0, 0, this.levelTexel(next));
    restrict.setTexture("uResidual", level.residual.texture(0).handle);
    restrict.setTexture("uFineRhs", level.rhs.texture(0).handle);
    this.blitter.drawQuad();
    this.clearTarget(next.pressure.read);
    this.clearTarget(next.pressure.write);
    this.vcycle(levels, index + 1);
    const prolongate = this.programs.prolongate;
    level.pressure.write.bind();
    this.common(prolongate, 0, 0, this.levelTexel(level));
    prolongate.setTexture("uPressure", level.pressure.read.texture(0).handle);
    prolongate.setTexture("uCoarse", next.pressure.read.texture(0).handle);
    prolongate.setTexture("uDivergence", level.rhs.texture(0).handle);
    this.blitter.drawQuad();
    level.pressure.swap();
    this.smooth(level, SMOOTH_PASSES);
  }
  project(entry, dt, time) {
    const base = entry.levels[0];
    if (!base) return;
    const p = this.programs;
    base.rhs.bind();
    this.common(p.divergence, dt, time);
    p.divergence.setTexture("uA", entry.a.read.texture(0).handle);
    this.blitter.drawQuad();
    if (this.options.pressureSolver === "jacobi") {
      this.smooth(base, this.options.pressureIterations);
    } else {
      for (let cycle = 0; cycle < this.options.pressureCycles; cycle += 1) this.vcycle(entry.levels, 0);
    }
    entry.a.write.bind();
    this.common(p.subtract, dt, time);
    p.subtract.setTexture("uA", entry.a.read.texture(0).handle);
    p.subtract.setTexture("uPressure", base.pressure.read.texture(0).handle);
    this.blitter.drawQuad();
    entry.a.swap();
  }
  substep(entry, dt, time) {
    const { gl, options } = this;
    const { material } = entry.layer;
    const p = this.programs;
    gl.disable(gl.BLEND);
    const gravity = GRAVITY_PER_HEIGHT * this.simHeight * options.gravity;
    const nuLiquid = Math.max(MIN_LIQUID_VISCOSITY, material.viscosity / material.density * this.simHeight * VISCOSITY_PER_HEIGHT);
    const nuSolid = options.solidViscosity * this.simHeight;
    const yieldStress = material.yield * this.simHeight * YIELD_PER_HEIGHT;
    const sigma = material.tension * TENSION_STABILITY / (2 * Math.PI * dt * dt);
    const tensionFlow = material.tension * options.curvatureFlow;
    entry.b.write.bind();
    this.common(p.advectB, dt, time);
    p.advectB.setTexture("uA", entry.a.read.texture(0).handle);
    p.advectB.setTexture("uB", entry.b.read.texture(0).handle);
    this.blitter.drawQuad();
    entry.b.swap();
    entry.a.write.bind();
    this.common(p.advectA, dt, time);
    p.advectA.set("uGravity", gravity);
    p.advectA.set("uDrag", options.drag);
    p.advectA.set("uSigma", sigma);
    p.advectA.set("uMeltRate", material.meltRate);
    p.advectA.set("uMeltPoint", options.meltPoint);
    p.advectA.set("uConduction", options.conduction);
    p.advectA.set("uCooling", material.cooling);
    p.advectA.set("uHeatTop", options.heatTop);
    p.advectA.set("uCoreHeat", options.coreHeat);
    p.advectA.set("uSurfaceHeat", options.surfaceHeat);
    p.advectA.set("uSurfaceDepth", options.surfaceDepth);
    p.advectA.set("uColumnFeed", options.columnFeed);
    p.advectA.set("uOnsetSpread", options.onsetSpread);
    p.advectA.set("uNoiseScale", options.noiseScale);
    p.advectA.set("uFreezePoint", options.freezePoint);
    p.advectA.set("uSeed", options.seed + this.layers.indexOf(entry) * LAYER_SEED_STRIDE);
    p.advectA.set("uDelay", entry.layer.delay);
    p.advectA.setTexture("uA", entry.a.read.texture(0).handle);
    this.blitter.drawQuad();
    entry.a.swap();
    this.blitter.copy(entry.a.read.texture(0), entry.rhs);
    for (let i = 0; i < options.viscosityIterations; i += 1) {
      entry.a.write.bind();
      this.common(p.viscosity, dt, time);
      p.viscosity.set("uNuSolid", nuSolid);
      p.viscosity.set("uNuLiquid", nuLiquid);
      p.viscosity.set("uMeltPoint", options.meltPoint);
      p.viscosity.set("uYield", yieldStress);
      p.viscosity.setTexture("uA", entry.a.read.texture(0).handle);
      p.viscosity.setTexture("uRhs", entry.rhs.texture(0).handle);
      this.blitter.drawQuad();
      entry.a.swap();
    }
    this.project(entry, dt, time);
    for (let i = 0; i < REINIT_PASSES; i += 1) this.reinit(entry, tensionFlow);
    this.measureVolume(entry);
  }
  snapshot() {
    const first = this.layers[0];
    if (!first || first.keyframes.has(this.steps)) return;
    while (first.keyframes.size >= this.options.maxKeyframes) this.thinKeyframes();
    if (this.steps % this.keyframeSpacing !== 0) return;
    for (const entry of this.layers) {
      const target = new MultiRenderTarget(this.gl, this.simWidth, this.simHeight, [this.fieldA, this.fieldB]);
      this.blitter.copyPair(entry.a.read.texture(0), entry.b.read.texture(0), target);
      entry.keyframes.set(this.steps, target);
    }
  }
  thinKeyframes() {
    const spacing = this.keyframeSpacing * 2;
    for (const entry of this.layers) {
      for (const [step, keyframe] of entry.keyframes) {
        if (step % spacing === 0) continue;
        keyframe.dispose();
        entry.keyframes.delete(step);
      }
    }
    this.keyframeSpacing = spacing;
  }
  restore(target) {
    const first = this.layers[0];
    if (!first) return false;
    let best = -1;
    for (const step of first.keyframes.keys()) {
      if (step <= target && step > best) best = step;
    }
    if (best < 0) return false;
    for (const entry of this.layers) {
      if (!entry.keyframes.has(best)) return false;
    }
    for (const entry of this.layers) {
      const keyframe = entry.keyframes.get(best);
      if (!keyframe) return false;
      this.blitter.copy(keyframe.texture(0), entry.a.write);
      entry.a.swap();
      this.blitter.copy(keyframe.texture(1), entry.b.write);
      entry.b.swap();
      const base = entry.levels[0];
      if (base) this.clearTarget(base.pressure.read);
    }
    this.steps = best;
    return true;
  }
  clearKeyframes(entry) {
    for (const keyframe of entry.keyframes.values()) keyframe.dispose();
    entry.keyframes.clear();
  }
};

// Packages/FilterSystem/src/filter.ts
var FilterPass = class extends ShaderPass {
  constructor(gl, definition) {
    super(gl, definition.name, definition.fragment);
    __publicField(this, "uniforms");
    this.uniforms = { ...definition.uniforms };
  }
  bind(_context) {
    for (const key of Object.keys(this.uniforms)) {
      const value = this.uniforms[key];
      if (value !== void 0) this.program.set(key, value);
    }
  }
};

// Packages/FilterSystem/src/builtin.ts
var MELT_PROGRESS_GLSL = `
float meltProgress() {
  return clamp(uProgress, 0.0, 1.0);
}
`;
var BLUR_FRAGMENT_GLSL = `
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
`;
var TINT_FRAGMENT_GLSL = `
uniform vec3 uTint;
uniform float uAmount;

void main() {
  vec4 source = texture(uInput, vUv);
  vec3 mixed = mix(source.rgb, uTint * max(source.a, 1e-4), uAmount);
  fragColor = vec4(mixed, source.a);
}
`;
var THRESHOLD_FRAGMENT_GLSL = `
uniform float uCutoff;
uniform float uSoftness;

void main() {
  vec4 source = texture(uInput, vUv);
  float alpha = smoothstep(uCutoff - uSoftness, uCutoff + uSoftness, source.a);
  fragColor = vec4(source.rgb * alpha, source.a * alpha);
}
`;
var CHROMATIC_ABERRATION_FRAGMENT_GLSL = `
uniform float uAmount;

void main() {
  vec2 direction = (vUv - 0.5) * uAmount * meltProgress();
  float r = texture(uInput, vUv + direction).r;
  vec4 g = texture(uInput, vUv);
  float b = texture(uInput, vUv - direction).b;
  fragColor = vec4(r, g.g, b, g.a);
}
`;
var blur = (radius = 2) => ({
  name: "blur",
  uniforms: { uRadius: radius },
  fragment: fragment(BLUR_FRAGMENT_GLSL)
});
var tint = (colour = [1, 1, 1], amount = 0.2) => ({
  name: "tint",
  uniforms: { uTint: new Float32Array(colour), uAmount: amount },
  fragment: fragment(TINT_FRAGMENT_GLSL)
});
var threshold = (cutoff = 0.5, softness = 0.1) => ({
  name: "threshold",
  uniforms: { uCutoff: cutoff, uSoftness: softness },
  fragment: fragment(THRESHOLD_FRAGMENT_GLSL)
});
var chromaticAberration = (amount = 4e-3) => ({
  name: "chromatic-aberration",
  uniforms: { uAmount: amount },
  fragment: fragment(CHROMATIC_ABERRATION_FRAGMENT_GLSL, MELT_PROGRESS_GLSL)
});

// Packages/FilterSystem/src/chain.ts
var FilterChain = class {
  constructor(gl) {
    __publicField(this, "gl");
    __publicField(this, "entries", []);
    this.gl = gl;
  }
  get passes() {
    return this.entries;
  }
  add(definition) {
    const pass = new FilterPass(this.gl, definition);
    this.entries.push(pass);
    return pass;
  }
  remove(pass) {
    const index = this.entries.indexOf(pass);
    if (index < 0) return;
    this.entries.splice(index, 1);
    pass.dispose();
  }
  dispose() {
    for (const pass of this.entries) pass.dispose();
    this.entries.length = 0;
  }
};

// Packages/FilterSystem/src/svgFilter.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var SVG_MELT_DEFAULTS = {
  sag: 0.16,
  lateral: 0.08,
  columns: 4,
  streak: 0.08,
  octaves: 2,
  blur: 8e-3,
  pinch: 6,
  dripRoom: 0.6,
  topRoom: 0.08,
  sideRoom: 0.15
};
var SVG_MELT_RANGES = {
  sag: [0, 1],
  lateral: [0, 0.5],
  columns: [0.5, 64],
  streak: [0.01, 1],
  octaves: [1, 5],
  blur: [0, 0.05],
  pinch: [1, 24],
  dripRoom: [0, 2],
  topRoom: [0, 1],
  sideRoom: [0, 1]
};
var DEFAULT_BOX = { width: 300, height: 300 };
var SAG_TO_SCALE = 4;
var FIELD_GAIN = 0.5;
var RAMP_PIVOT = 0.5;
var LATERAL_BLUR = 0.35;
var COARSEN = 0.3;
var STRETCH = 0.55;
var IDENTITY_RGB = "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ";
var instances = 0;
var element = (tag) => document.createElementNS(SVG_NS, tag);
var resolveSettings = (options) => ({
  sag: clamp(options.sag ?? SVG_MELT_DEFAULTS.sag, ...SVG_MELT_RANGES.sag),
  lateral: clamp(options.lateral ?? SVG_MELT_DEFAULTS.lateral, ...SVG_MELT_RANGES.lateral),
  columns: clamp(options.columns ?? SVG_MELT_DEFAULTS.columns, ...SVG_MELT_RANGES.columns),
  streak: clamp(options.streak ?? SVG_MELT_DEFAULTS.streak, ...SVG_MELT_RANGES.streak),
  octaves: Math.round(clamp(options.octaves ?? SVG_MELT_DEFAULTS.octaves, ...SVG_MELT_RANGES.octaves)),
  blur: clamp(options.blur ?? SVG_MELT_DEFAULTS.blur, ...SVG_MELT_RANGES.blur),
  pinch: clamp(options.pinch ?? SVG_MELT_DEFAULTS.pinch, ...SVG_MELT_RANGES.pinch),
  dripRoom: clamp(options.dripRoom ?? SVG_MELT_DEFAULTS.dripRoom, ...SVG_MELT_RANGES.dripRoom),
  topRoom: clamp(options.topRoom ?? SVG_MELT_DEFAULTS.topRoom, ...SVG_MELT_RANGES.topRoom),
  sideRoom: clamp(options.sideRoom ?? SVG_MELT_DEFAULTS.sideRoom, ...SVG_MELT_RANGES.sideRoom)
});
var travelOf = (settings) => SAG_TO_SCALE * settings.sag * 0.5;
var resolveBox = (box) => ({
  width: Math.max(1, box?.width ?? DEFAULT_BOX.width),
  height: Math.max(1, box?.height ?? DEFAULT_BOX.height)
});
var SvgMeltFilter = class {
  constructor(options = {}) {
    __publicField(this, "id");
    __publicField(this, "root");
    __publicField(this, "settings");
    __publicField(this, "turbulence");
    __publicField(this, "displacement");
    __publicField(this, "softening");
    __publicField(this, "ramp");
    __publicField(this, "box");
    __publicField(this, "progress", 0);
    __publicField(this, "frequencyX", 0);
    __publicField(this, "frequencyY", 0);
    __publicField(this, "scale", 0);
    __publicField(this, "softness", 0);
    const seed = options.seed ?? "meltgl";
    const numericSeed = typeof seed === "string" ? hashString(seed) : seed >>> 0;
    instances += 1;
    const unique = `${instances.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.id = options.id ?? `meltgl-melt-${numericSeed.toString(36)}-${unique}`;
    this.settings = resolveSettings(options);
    this.box = resolveBox(options.box);
    this.root = element("svg");
    this.root.setAttribute("aria-hidden", "true");
    this.root.setAttribute("focusable", "false");
    this.root.setAttribute("width", "0");
    this.root.setAttribute("height", "0");
    this.root.style.position = "absolute";
    this.root.style.width = "0";
    this.root.style.height = "0";
    this.root.style.overflow = "hidden";
    this.root.style.pointerEvents = "none";
    const filter = element("filter");
    filter.setAttribute("id", this.id);
    filter.setAttribute("filterUnits", "objectBoundingBox");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const room = Math.max(this.settings.dripRoom, travelOf(this.settings));
    filter.setAttribute("x", (-this.settings.sideRoom).toFixed(4));
    filter.setAttribute("y", (-this.settings.topRoom).toFixed(4));
    filter.setAttribute("width", (1 + this.settings.sideRoom * 2).toFixed(4));
    filter.setAttribute("height", (1 + this.settings.topRoom + room).toFixed(4));
    this.turbulence = element("feTurbulence");
    this.turbulence.setAttribute("type", "fractalNoise");
    this.turbulence.setAttribute("numOctaves", String(this.settings.octaves));
    this.turbulence.setAttribute("seed", String(numericSeed % 1e3));
    this.turbulence.setAttribute("stitchTiles", "noStitch");
    this.turbulence.setAttribute("baseFrequency", "0 0");
    this.turbulence.setAttribute("result", "meltNoise");
    const field = element("feColorMatrix");
    field.setAttribute("in", "meltNoise");
    field.setAttribute("type", "matrix");
    field.setAttribute("values", this.fieldValues());
    field.setAttribute("result", "meltField");
    this.displacement = element("feDisplacementMap");
    this.displacement.setAttribute("in", "SourceGraphic");
    this.displacement.setAttribute("in2", "meltField");
    this.displacement.setAttribute("scale", "0");
    this.displacement.setAttribute("xChannelSelector", "R");
    this.displacement.setAttribute("yChannelSelector", "G");
    this.displacement.setAttribute("result", "meltDisplaced");
    this.softening = this.settings.blur > 0 ? element("feGaussianBlur") : null;
    if (this.softening) {
      this.softening.setAttribute("in", "meltDisplaced");
      this.softening.setAttribute("edgeMode", "none");
      this.softening.setAttribute("stdDeviation", "0 0");
      this.softening.setAttribute("result", "meltSoftened");
    }
    this.ramp = element("feColorMatrix");
    this.ramp.setAttribute("in", this.softening ? "meltSoftened" : "meltDisplaced");
    this.ramp.setAttribute("type", "matrix");
    this.ramp.setAttribute("values", `${IDENTITY_RGB}0 0 0 1 0`);
    this.ramp.setAttribute("result", "meltOut");
    filter.append(this.turbulence, field, this.displacement);
    if (this.softening) filter.append(this.softening);
    filter.append(this.ramp);
    const defs = element("defs");
    defs.append(filter);
    this.root.append(defs);
    this.applyBox();
    this.setProgress(0);
  }
  get cssValue() {
    return `url(#${this.id})`;
  }
  mount(parent = document.body) {
    if (this.root.parentNode === parent) return;
    parent.append(this.root);
  }
  setBox(box) {
    const next = resolveBox(box);
    if (next.width === this.box.width && next.height === this.box.height) return;
    this.box = next;
    this.applyBox();
    this.setProgress(this.progress);
  }
  setProgress(progress) {
    const t = saturate(progress);
    this.progress = t;
    const eased = t * t;
    const x = this.frequencyX * (1 - COARSEN * eased);
    const y = this.frequencyY * (1 - STRETCH * eased);
    this.turbulence.setAttribute("baseFrequency", `${x.toFixed(6)} ${y.toFixed(6)}`);
    this.displacement.setAttribute("scale", (this.scale * eased).toFixed(2));
    if (this.softening) {
      const sigma = this.softness * eased;
      this.softening.setAttribute("stdDeviation", `${(sigma * LATERAL_BLUR).toFixed(3)} ${sigma.toFixed(3)}`);
    }
    const steepness = lerp(1, this.settings.pinch, eased);
    const pivot = RAMP_PIVOT * (1 - steepness);
    this.ramp.setAttribute("values", `${IDENTITY_RGB}0 0 0 ${steepness.toFixed(3)} ${pivot.toFixed(3)}`);
  }
  dispose() {
    this.root.remove();
  }
  fieldValues() {
    const lateral = this.settings.lateral;
    return [
      `${lateral.toFixed(4)} 0 0 0 ${(0.5 - lateral * 0.5).toFixed(4)}`,
      `0 ${FIELD_GAIN.toFixed(4)} 0 0 0`,
      "0 0 0 0 0",
      "0 0 0 0 1"
    ].join("  ");
  }
  applyBox() {
    this.frequencyX = this.settings.columns / this.box.width;
    this.frequencyY = this.frequencyX * this.settings.streak;
    this.scale = SAG_TO_SCALE * this.settings.sag * this.box.height;
    this.softness = this.settings.blur * this.box.height;
  }
};

// Packages/MeltGL/src/svgRenderer.ts
var PIXEL_RATIO_CAP = 2;
var VISCOSITY_FLOOR = -3;
var VISCOSITY_DECADES = 4.7;
var SAG_RUNNY = 0.45;
var SAG_STIFF = 0.06;
var BLUR_LOOSE = 4e-3;
var BLUR_TAUT = 0.014;
var PINCH_LOOSE = 2.5;
var PINCH_TAUT = 12;
var LATERAL_LOOSE = 0.14;
var LATERAL_TAUT = 0.04;
var COLUMNS_PER_NOISE_SCALE = 1;
var DEFAULT_NOISE_SCALE = 4;
var DEFAULT_SEED = 11;
var readRoom = (config, current) => ({
  dripRoom: config.dripRoom ?? current.dripRoom,
  topRoom: config.topRoom ?? current.topRoom,
  sideRoom: config.sideRoom ?? current.sideRoom
});
var sameRoom = (a, b) => a.dripRoom === b.dripRoom && a.topRoom === b.topRoom && a.sideRoom === b.sideRoom;
var SvgRenderer = class {
  constructor(options) {
    __publicField(this, "backend", "svg");
    __publicField(this, "dynamic");
    __publicField(this, "settled", true);
    __publicField(this, "target");
    __publicField(this, "source");
    __publicField(this, "duration");
    __publicField(this, "layer");
    __publicField(this, "canvas");
    __publicField(this, "context");
    __publicField(this, "observer");
    __publicField(this, "filter");
    __publicField(this, "material");
    __publicField(this, "noiseScale");
    __publicField(this, "seed");
    __publicField(this, "room");
    __publicField(this, "scratch", null);
    __publicField(this, "box", null);
    __publicField(this, "progress", 0);
    __publicField(this, "restorePosition", null);
    __publicField(this, "restoreOverflow", null);
    __publicField(this, "mounted", false);
    __publicField(this, "disposed", false);
    this.target = options.target;
    this.source = options.source;
    this.dynamic = options.source.dynamic;
    this.duration = Math.max(0.01, options.duration);
    this.material = resolveMaterial(options.config.layers?.[0]?.material ?? options.config.material);
    this.noiseScale = options.config.noiseScale ?? DEFAULT_NOISE_SCALE;
    this.seed = options.config.seed ?? DEFAULT_SEED;
    this.room = readRoom(options.config, {});
    this.layer = document.createElement("div");
    this.layer.setAttribute("data-meltgl", "svg-melt");
    this.layer.style.position = "absolute";
    this.layer.style.left = "0";
    this.layer.style.top = "0";
    this.layer.style.width = "100%";
    this.layer.style.height = "100%";
    this.layer.style.display = "block";
    this.layer.style.overflow = "visible";
    this.layer.style.pointerEvents = "none";
    this.layer.style.zIndex = "1";
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.position = "absolute";
    this.canvas.style.left = "0";
    this.canvas.style.top = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.layer.append(this.canvas);
    this.context = this.canvas.getContext("2d");
    this.observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => this.layout());
    this.filter = this.build();
  }
  async prepare() {
    await this.source.load();
    if (this.disposed) return;
    const computed = getComputedStyle(this.target);
    if (computed.position === "static") {
      this.restorePosition = this.target.style.position;
      this.target.style.position = "relative";
    }
    if (computed.overflow !== "visible") {
      this.restoreOverflow = this.target.style.overflow;
      this.target.style.overflow = "visible";
    }
    this.target.append(this.layer);
    this.filter.mount(this.filterHost());
    this.layer.style.filter = this.filter.cssValue;
    this.mounted = true;
    this.layout();
    this.observer?.observe(this.target);
  }
  seek(time) {
    this.progress = saturate(time / this.duration);
    this.filter.setProgress(this.progress);
  }
  draw(_frame, _progress) {
    if (!this.mounted || !this.dynamic) return;
    this.paint();
  }
  configure(config) {
    const material = config.material !== void 0 || config.layers !== void 0;
    if (material) this.material = resolveMaterial(config.layers?.[0]?.material ?? config.material);
    if (config.noiseScale !== void 0) this.noiseScale = config.noiseScale;
    if (config.seed !== void 0) this.seed = config.seed;
    const room = readRoom(config, this.room);
    const moved = !sameRoom(room, this.room);
    this.room = room;
    if (!material && config.noiseScale === void 0 && config.seed === void 0 && !moved) return;
    const previous = this.filter;
    this.filter = this.build();
    this.filter.setProgress(this.progress);
    if (this.mounted) {
      this.filter.mount(this.filterHost());
      this.layer.style.filter = this.filter.cssValue;
    }
    previous.dispose();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mounted = false;
    this.observer?.disconnect();
    this.layer.style.filter = "";
    this.layer.remove();
    this.filter.dispose();
    this.source.dispose();
    this.scratch = null;
    if (this.restorePosition !== null) {
      this.target.style.position = this.restorePosition;
      this.restorePosition = null;
    }
    if (this.restoreOverflow !== null) {
      this.target.style.overflow = this.restoreOverflow;
      this.restoreOverflow = null;
    }
  }
  build() {
    const mobility = Math.max(1e-6, this.material.viscosity / this.material.density);
    const stiffness = saturate((Math.log10(mobility) - VISCOSITY_FLOOR) / VISCOSITY_DECADES);
    const tension = saturate(this.material.tension);
    return new SvgMeltFilter({
      seed: this.seed,
      sag: lerp(SAG_RUNNY, SAG_STIFF, stiffness),
      lateral: lerp(LATERAL_LOOSE, LATERAL_TAUT, tension),
      columns: this.noiseScale * COLUMNS_PER_NOISE_SCALE,
      blur: lerp(BLUR_LOOSE, BLUR_TAUT, tension),
      pinch: lerp(PINCH_LOOSE, PINCH_TAUT, tension),
      box: this.box ?? void 0,
      ...this.room
    });
  }
  filterHost() {
    const root = this.target.getRootNode();
    return root instanceof ShadowRoot ? root : document.body;
  }
  layout() {
    if (!this.mounted) return;
    const rect = this.layer.getBoundingClientRect();
    const width = rect.width || this.target.clientWidth;
    const height = rect.height || this.target.clientHeight;
    if (width <= 0 || height <= 0) return;
    this.box = { width, height };
    const ratio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP);
    const pixels = {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio))
    };
    if (this.canvas.width !== pixels.width || this.canvas.height !== pixels.height) {
      this.canvas.width = pixels.width;
      this.canvas.height = pixels.height;
    }
    this.filter.setBox(this.box);
    this.paint();
  }
  paint() {
    const context = this.context;
    const frame = this.source.frame();
    if (!context || !frame) return;
    const { width, height } = this.canvas;
    if (width === 0 || height === 0) return;
    context.clearRect(0, 0, width, height);
    const drawable = this.toDrawable(frame);
    if (!drawable) return;
    const sourceWidth = this.source.width > 0 ? this.source.width : width;
    const sourceHeight = this.source.height > 0 ? this.source.height : height;
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(drawable, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }
  toDrawable(frame) {
    if (!(frame instanceof ImageData)) return frame;
    const scratch = this.scratch ?? document.createElement("canvas");
    this.scratch = scratch;
    if (scratch.width !== frame.width || scratch.height !== frame.height) {
      scratch.width = frame.width;
      scratch.height = frame.height;
    }
    const context = scratch.getContext("2d");
    if (!context) return null;
    context.putImageData(frame, 0, 0);
    return scratch;
  }
};

// Packages/ElementHost/src/host.ts
var NONE = { bottom: 0, top: 0, sides: 0 };
var ElementHost = class extends Emitter {
  constructor(options) {
    super();
    __publicField(this, "target");
    __publicField(this, "surface");
    __publicField(this, "observer");
    __publicField(this, "restorePosition", null);
    __publicField(this, "restoreOverflow", null);
    __publicField(this, "extents");
    __publicField(this, "mounted", false);
    __publicField(this, "lastBox", { width: 0, height: 0 });
    __publicField(this, "lastCanvas", { width: 0, height: 0 });
    __publicField(this, "lastPixels", { width: 0, height: 0 });
    this.target = options.target;
    this.surface = options.surface ?? new RenderSurface();
    this.extents = { ...NONE, ...options.extents };
    const canvas = this.surface.canvas;
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = String(options.zIndex ?? 1);
    this.observer = new ResizeObserver(() => this.sync());
  }
  get size() {
    const rect = this.target.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }
  get room() {
    return this.extents;
  }
  get canvasSize() {
    const { width, height } = this.size;
    return {
      width: width + this.extents.sides * 2,
      height: height + this.extents.top + this.extents.bottom
    };
  }
  get bounds() {
    return this.target.getBoundingClientRect();
  }
  setExtents(extents) {
    this.extents = {
      bottom: Math.max(0, extents.bottom ?? this.extents.bottom),
      top: Math.max(0, extents.top ?? this.extents.top),
      sides: Math.max(0, extents.sides ?? this.extents.sides)
    };
    this.sync();
  }
  mount() {
    if (this.mounted) return;
    this.mounted = true;
    const computed = getComputedStyle(this.target);
    if (computed.position === "static") {
      this.restorePosition = this.target.style.position;
      this.target.style.position = "relative";
    }
    if (computed.overflow !== "visible") {
      this.restoreOverflow = this.target.style.overflow;
      this.target.style.overflow = "visible";
    }
    this.target.append(this.surface.canvas);
    this.observer.observe(this.target);
    this.sync();
  }
  unmount() {
    if (!this.mounted) return;
    this.mounted = false;
    this.observer.unobserve(this.target);
    this.surface.canvas.remove();
    if (this.restorePosition !== null) {
      this.target.style.position = this.restorePosition;
      this.restorePosition = null;
    }
    if (this.restoreOverflow !== null) {
      this.target.style.overflow = this.restoreOverflow;
      this.restoreOverflow = null;
    }
  }
  dispose() {
    this.unmount();
    this.observer.disconnect();
    this.surface.dispose();
    this.clear();
  }
  sync() {
    const box = this.size;
    const { width, height } = this.canvasSize;
    if (width === 0 || height === 0) return;
    const canvas = this.surface.canvas;
    canvas.style.left = `${-this.extents.sides}px`;
    canvas.style.top = `${-this.extents.top}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.surface.resize(width, height);
    const pixels = this.surface.drawingBufferSize;
    const unchanged = box.width === this.lastBox.width && box.height === this.lastBox.height && width === this.lastCanvas.width && height === this.lastCanvas.height && pixels.width === this.lastPixels.width && pixels.height === this.lastPixels.height;
    if (unchanged) return;
    this.lastBox = box;
    this.lastCanvas = { width, height };
    this.lastPixels = pixels;
    this.emit("resize", { width, height });
  }
};

// Packages/MeltGL/src/webglRenderer.ts
var TAINTED_SOURCE = 'the source is cross-origin and was not loaded with crossOrigin="anonymous"';
var createResources = (options) => {
  const surface = new RenderSurface({ maxPixelRatio: options.maxPixelRatio });
  const { capabilities, gl } = surface;
  const floatRenderable = capabilities.colorBufferFloat || capabilities.colorBufferHalfFloat;
  if (!floatRenderable) {
    surface.dispose();
    throw new MeltError(
      "context-unavailable",
      `webgl2 cannot render to float targets, the melt simulation needs ${FLOAT_TARGET_EXTENSIONS}`
    );
  }
  const built = [surface];
  try {
    const simulation = new MeltSimulation(gl, options.simulation, floatRenderable);
    built.push(simulation);
    const texture = new Texture(gl, { flipY: true, premultiply: true });
    built.push(texture);
    const host = new ElementHost({ target: options.target, surface });
    built.push(host);
    const filters = new FilterChain(gl);
    built.push(filters);
    const pipeline = new RenderPipeline(surface);
    built.push(pipeline);
    for (const definition of options.filters) pipeline.add(filters.add(definition));
    const offscreen = new RenderTarget(gl, 1, 1);
    return { surface, simulation, texture, host, filters, pipeline, offscreen };
  } catch (error) {
    for (const resource of built.reverse()) resource.dispose();
    throw error;
  }
};
var WebglRenderer = class {
  constructor(options) {
    __publicField(this, "backend", "webgl2");
    __publicField(this, "dynamic");
    __publicField(this, "host");
    __publicField(this, "simulation");
    __publicField(this, "surface");
    __publicField(this, "source");
    __publicField(this, "texture");
    __publicField(this, "filters");
    __publicField(this, "pipeline");
    __publicField(this, "offscreen");
    __publicField(this, "keyMode");
    __publicField(this, "maxStepsPerFrame");
    __publicField(this, "key", null);
    __publicField(this, "members", null);
    __publicField(this, "caughtUp", true);
    __publicField(this, "prepared", false);
    __publicField(this, "disposed", false);
    const resources = createResources(options);
    this.surface = resources.surface;
    this.simulation = resources.simulation;
    this.texture = resources.texture;
    this.host = resources.host;
    this.filters = resources.filters;
    this.pipeline = resources.pipeline;
    this.offscreen = resources.offscreen;
    this.source = options.source;
    this.keyMode = options.key;
    this.maxStepsPerFrame = options.maxStepsPerFrame;
    this.dynamic = options.source.dynamic;
    this.host.on("resize", () => this.layout());
    const { onContextLost } = options;
    if (onContextLost) this.surface.on("contextlost", () => onContextLost());
  }
  get settled() {
    return this.caughtUp;
  }
  async prepare() {
    await this.source.load();
    this.upload();
    this.key = this.resolveKey();
    this.applyRoom();
    this.host.mount();
    this.layout();
    this.prepared = true;
  }
  seek(time) {
    if (!this.prepared || this.surface.lost) return;
    this.caughtUp = this.simulation.seek(time, this.maxStepsPerFrame);
  }
  draw(frame, progress) {
    if (!this.prepared || this.surface.lost) return;
    if (this.dynamic) {
      this.upload();
      this.simulation.refreshOrigin();
    }
    const { gl } = this.surface;
    gl.disable(gl.DEPTH_TEST);
    if (this.pipeline.length === 0) {
      this.surface.bindDefault();
      this.surface.clearTo();
      this.simulation.render();
      return;
    }
    this.offscreen.bind();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.simulation.render();
    this.surface.bindDefault();
    this.surface.clearTo();
    this.pipeline.render(this.offscreen.texture, frame, progress);
  }
  configure(config) {
    this.simulation.configure(config);
    this.applyRoom();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pipeline.dispose();
    this.filters.dispose();
    this.offscreen.dispose();
    this.simulation.dispose();
    this.texture.dispose();
    this.source.dispose();
    this.host.dispose();
  }
  applyRoom() {
    const { dripRoom, topRoom, sideRoom } = this.simulation.settings;
    const { width, height } = this.host.size;
    const next = { bottom: height * dripRoom, top: height * topRoom, sides: width * sideRoom };
    const current = this.host.room;
    if (next.bottom === current.bottom && next.top === current.top && next.sides === current.sides) return;
    this.host.setExtents(next);
  }
  resolveKey() {
    if (this.keyMode === "none") return null;
    if (this.keyMode !== "auto") return this.keyMode;
    const frame = this.source.frame();
    return frame ? estimateKey(frame) : null;
  }
  upload() {
    const frame = this.source.frame();
    if (!frame || this.source.width === 0 || this.source.height === 0) return;
    try {
      this.texture.upload(frame, this.source.width, this.source.height);
    } catch {
      throw new MeltError("source-unavailable", TAINTED_SOURCE);
    }
  }
  layout() {
    const { width, height } = this.surface.drawingBufferSize;
    if (width === 0 || height === 0) return;
    const box = this.host.size;
    const canvas = this.host.canvasSize;
    const room = this.host.room;
    if (canvas.width === 0 || canvas.height === 0) return;
    const rect = [
      room.sides / canvas.width,
      room.bottom / canvas.height,
      box.width / canvas.width,
      box.height / canvas.height
    ];
    this.offscreen.resize(width, height);
    this.pipeline.resize(width, height);
    this.simulation.resize(width, height);
    const previous = this.members;
    if (previous && previous.texture === this.texture && previous.key === this.key && previous.rect[0] === rect[0] && previous.rect[1] === rect[1] && previous.rect[2] === rect[2] && previous.rect[3] === rect[3]) {
      return;
    }
    this.members = { rect, key: this.key, texture: this.texture };
    this.simulation.setMembers([{ texture: this.texture, rect, key: this.key }]);
  }
};

// Packages/MeltGL/src/melt.ts
var buildConfig = (options) => ({
  ...options.simulation,
  material: options.material ?? "wax",
  ...options.layers && options.layers.length > 0 ? { layers: options.layers } : {}
});
var asMeltError = (error) => {
  if (error instanceof MeltError) return error;
  return new MeltError("source-unavailable", error instanceof Error ? error.message : String(error));
};
var MeltGL = class _MeltGL extends Emitter {
  constructor(options) {
    super();
    __publicField(this, "renderer");
    __publicField(this, "transition");
    __publicField(this, "duration");
    __publicField(this, "clock");
    __publicField(this, "reducedMotion");
    __publicField(this, "prepared", false);
    __publicField(this, "suspended", false);
    __publicField(this, "disposed", false);
    __publicField(this, "onTick", (frame) => {
      this.render(frame);
    });
    __publicField(this, "onContextLost", () => {
      this.clock.stop();
      this.emit("contextlost", void 0);
    });
    validateOptions(options);
    this.reducedMotion = (options.respectReducedMotion ?? true) && prefersReducedMotion();
    this.duration = clamp(options.duration ?? MELT_DEFAULTS.duration, ...MELT_RANGES.duration);
    const backend = options.backend ?? "auto";
    const useWebgl = backend === "webgl2" || backend === "auto" && preferredBackend() === "webgl2";
    const config = buildConfig(options);
    const source = resolveSource(options.source);
    this.renderer = useWebgl ? new WebglRenderer({
      target: options.target,
      source,
      key: options.key ?? "auto",
      simulation: config,
      filters: options.filters ?? [],
      maxPixelRatio: options.maxPixelRatio ?? MELT_DEFAULTS.maxPixelRatio,
      maxStepsPerFrame: resolveMaxStepsPerFrame(options.maxStepsPerFrame),
      onContextLost: () => this.onContextLost()
    }) : new SvgRenderer({ target: options.target, source, config, duration: this.duration });
    this.transition = new TransitionController({
      duration: this.reducedMotion ? MELT_DEFAULTS.reducedMotionDuration : this.duration,
      easing: options.easing ?? "linear",
      loop: options.loop ?? false
    });
    this.clock = new Clock();
    this.transition.attach(this.clock);
    this.clock.on("tick", this.onTick);
    this.transition.on("statechange", (state) => this.emit("statechange", state));
    this.transition.on("complete", (state) => {
      this.emit("complete", state);
      this.syncClock();
    });
  }
  static async create(options) {
    const instance = new _MeltGL(options);
    try {
      await instance.renderer.prepare();
      instance.prepared = true;
      instance.render();
    } catch (error) {
      instance.dispose();
      throw asMeltError(error);
    }
    instance.syncClock();
    if (options.autoPlay) instance.play();
    return instance;
  }
  get progress() {
    return this.transition.progress;
  }
  get state() {
    return this.transition.state;
  }
  get backend() {
    return this.renderer.backend;
  }
  get settled() {
    return this.renderer.settled;
  }
  play() {
    this.assertLive();
    this.transition.play();
    this.syncClock();
  }
  reverse() {
    this.assertLive();
    this.transition.reverse();
    this.syncClock();
  }
  toggle() {
    this.assertLive();
    this.transition.toggle();
    this.syncClock();
  }
  pause() {
    this.assertLive();
    this.transition.pause();
    this.syncClock();
  }
  suspend() {
    this.assertLive();
    this.suspended = true;
    this.clock.stop();
  }
  resume() {
    this.assertLive();
    this.suspended = false;
    this.syncClock();
  }
  seek(progress) {
    this.assertLive();
    this.transition.seek(progress);
    this.render();
  }
  reset() {
    this.assertLive();
    this.transition.reset();
    this.render();
  }
  configure(config) {
    this.assertLive();
    this.renderer.configure(config);
    this.render();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clock.dispose();
    this.transition.dispose();
    this.renderer.dispose();
    this.clear();
  }
  assertLive() {
    if (this.disposed) throw new MeltError("disposed", "this melt has been disposed");
  }
  syncClock() {
    if (this.disposed || this.suspended) return;
    const needsFrames = this.transition.running || this.renderer.dynamic || !this.renderer.settled;
    if (needsFrames) this.clock.start();
    else this.clock.stop();
  }
  render(frame = { time: this.clock.time, delta: 0, frame: 0 }) {
    if (!this.prepared || this.disposed) return;
    this.renderer.seek(this.transition.eased * this.duration);
    this.renderer.draw(frame, this.transition.progress);
    this.emit("progress", this.transition.progress);
    this.syncClock();
  }
};
var createMelt = (options) => MeltGL.create(options);
export {
  DEFAULT_SIMULATION_OPTIONS,
  ImageSource,
  MATERIALS,
  MATERIAL_RANGES,
  MeltError,
  MeltGL,
  SIMULATION_RANGES,
  VideoSource,
  blur,
  chromaticAberration,
  createMelt,
  estimateKey,
  resolveMaterial,
  threshold,
  tint
};
//# sourceMappingURL=meltgl.js.map
