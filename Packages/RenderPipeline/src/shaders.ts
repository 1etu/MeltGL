export const FULLSCREEN_VERTEX_GLSL = `#version 300 es
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aUv;
out vec2 vUv;

void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

export const FRAGMENT_HEADER_GLSL = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uInput;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uTime;
uniform float uProgress;
`

export const fragment = (body: string, prelude = ''): string =>
  `${FRAGMENT_HEADER_GLSL}\n${prelude}\n${body}\n`

export const COPY_FRAGMENT_GLSL = fragment(`
void main() {
  fragColor = texture(uInput, vUv);
}
`)
