import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_dark;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p = rot * p * 2.02 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return v;
}

float surfaceHeight(vec2 p, float t, vec2 pointer) {
  vec2 q = vec2(fbm(p + t * 0.08), fbm(p + vec2(5.2, 1.3) - t * 0.06));
  vec2 r = vec2(fbm(p + 2.1 * q + vec2(1.7, 9.2) + t * 0.05), fbm(p + 2.1 * q + vec2(8.3, 2.8) - t * 0.04));
  float h = fbm(p + 1.8 * r);
  float dist = length(p - pointer);
  float ripple = exp(-dist * 2.6) * sin(dist * 14.0 - t * 2.4) * 0.06;
  return h + ripple;
}

void main() {
  vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
  vec2 p = (v_uv - 0.5) * aspect * 2.2;
  vec2 ptr = (u_pointer - 0.5) * aspect * 2.2;

  float eps = 0.015;
  float h0 = surfaceHeight(p, u_time, ptr);
  float hx = surfaceHeight(p + vec2(eps, 0.0), u_time, ptr);
  float hy = surfaceHeight(p + vec2(0.0, eps), u_time, ptr);

  vec3 normal = normalize(vec3((h0 - hx) * 3.4, (h0 - hy) * 3.4, 1.0));
  vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
  vec3 lightDir1 = normalize(vec3(0.55, 0.72, 0.85));
  vec3 lightDir2 = normalize(vec3(-0.7, -0.4, 0.65));

  float diff1 = max(dot(normal, lightDir1), 0.0);
  float diff2 = max(dot(normal, lightDir2), 0.0);

  vec3 half1 = normalize(lightDir1 + viewDir);
  vec3 half2 = normalize(lightDir2 + viewDir);
  float spec1 = pow(max(dot(normal, half1), 0.0), 36.0);
  float spec2 = pow(max(dot(normal, half2), 0.0), 18.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

  // Dark Mode: Obsidian gunmetal + molten crimson metallic specular crests
  vec3 darkBase = vec3(0.035, 0.020, 0.026);
  vec3 darkMid = vec3(0.28, 0.025, 0.075);
  vec3 darkHighlight = vec3(0.86, 0.14, 0.28);
  vec3 darkChrome = vec3(0.98, 0.76, 0.80);

  vec3 darkCol = mix(darkBase, darkMid, smoothstep(0.25, 0.82, h0));
  darkCol += darkHighlight * (diff1 * 0.42 + diff2 * 0.16);
  darkCol += darkChrome * spec1 * 0.62;
  darkCol += darkHighlight * (spec2 * 0.32 + fresnel * 0.48);

  // Light Mode: Pearlescent platinum-porcelain + brushed liquid rose-crimson sheen
  vec3 lightBase = vec3(0.945, 0.935, 0.942);
  vec3 lightMid = vec3(0.895, 0.845, 0.862);
  vec3 lightCrimson = vec3(0.76, 0.16, 0.28);
  vec3 lightChrome = vec3(1.0, 0.98, 0.99);

  vec3 lightCol = mix(lightBase, lightMid, smoothstep(0.25, 0.85, h0));
  lightCol = mix(lightCol, lightCrimson, diff1 * 0.14 + fresnel * 0.16);
  lightCol += lightChrome * spec1 * 0.35;
  lightCol -= vec3(0.06, 0.04, 0.045) * (1.0 - diff1) * 0.28;

  vec3 finalCol = mix(lightCol, darkCol, u_dark);
  gl_FragColor = vec4(clamp(finalCol, 0.0, 1.0), 0.78);
}
`;

export function LiquidCrimsonCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();
  const darkTargetRef = useRef(resolvedTheme === 'dark' ? 1.0 : 0.0);
  const redrawRef = useRef<(() => void) | null>(null);

  darkTargetRef.current = resolvedTheme === 'dark' ? 1.0 : 0.0;

  useEffect(() => {
    redrawRef.current?.();
  }, [resolvedTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });

    if (!gl) return;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const ptrLoc = gl.getUniformLocation(program, 'u_pointer');
    const darkLoc = gl.getUniformLocation(program, 'u_dark');

    gl.useProgram(program);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const pointer = { x: 0.65, y: 0.35, targetX: 0.65, targetY: 0.35 };
    const onPointerMove = (e: PointerEvent) => {
      pointer.targetX = e.clientX / Math.max(window.innerWidth, 1);
      pointer.targetY = 1.0 - e.clientY / Math.max(window.innerHeight, 1);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = Math.floor(window.innerWidth * dpr * 0.65);
      const h = Math.floor(window.innerHeight * dpr * 0.65);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = Math.max(w, 1);
        canvas.height = Math.max(h, 1);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    const start = performance.now();
    let lastTime = start;
    let currentDark = darkTargetRef.current;

    const drawStatic = () => {
      currentDark = darkTargetRef.current;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeLoc, 1.2);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform2f(ptrLoc, pointer.x, pointer.y);
      gl.uniform1f(darkLoc, currentDark);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    redrawRef.current = () => {
      if (reducedMotion) {
        drawStatic();
      }
    };

    const renderFrame = (now: number) => {
      const dt = Math.min((now - lastTime) * 0.001, 0.05);
      lastTime = now;

      pointer.x += (pointer.targetX - pointer.x) * Math.min(1, dt * 4.5);
      pointer.y += (pointer.targetY - pointer.y) * Math.min(1, dt * 4.5);
      currentDark += (darkTargetRef.current - currentDark) * Math.min(1, dt * 5.2);

      const elapsed = (now - start) * 0.001;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeLoc, elapsed);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform2f(ptrLoc, pointer.x, pointer.y);
      gl.uniform1f(darkLoc, currentDark);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafId = requestAnimationFrame(renderFrame);
    };

    if (reducedMotion) {
      drawStatic();
    } else {
      rafId = requestAnimationFrame(renderFrame);
    }

    return () => {
      redrawRef.current = null;
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
