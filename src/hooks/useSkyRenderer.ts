/**
 * WebGL Sky Renderer Hook
 * Renders stars as point sprites with proper magnitude-based sizing and coloring
 */

import { useCallback, useEffect, useRef } from 'react';
import type { StarData } from '../utils/starLoader';
import { getCelestialRotationMatrix, type GeoLocation } from '../utils/astronomy';

const vertexShaderSource = `#version 300 es
precision highp float;

in vec3 a_position;
in float a_magnitude;
in vec3 a_color;

uniform mat4 u_viewProjection;
uniform mat4 u_celestialRotation;
uniform float u_pointScale;
uniform float u_magnitudeScale;
uniform lowp int u_lightMode;

out vec3 v_color;
out float v_brightness;

void main() {
  // Rotate star position from celestial to observer coordinates
  vec4 rotatedPos = u_celestialRotation * vec4(a_position, 1.0);
  
  // Project onto screen
  gl_Position = u_viewProjection * rotatedPos;
  
  // Calculate point size based on magnitude
  // Brighter stars (lower magnitude) = larger points
  // Magnitude scale: -1 (very bright) to 6 (dim)
  float magNorm = clamp((6.0 - a_magnitude) / 7.0, 0.0, 1.0); // 0 for mag 6, 1 for mag -1
  float size = u_magnitudeScale * (0.3 + magNorm * 1.2) * u_pointScale;
  
  // In light mode, make stars slightly larger for visibility
  if (u_lightMode == 1) {
    size *= 1.1;
  }
  
  // Clamp size - smaller min/max
  gl_PointSize = clamp(size, 1.0, 15.0);
  
  v_color = a_color;
  // Brightness for alpha: more contrast between bright and dim
  v_brightness = 0.3 + magNorm * 0.7;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 v_color;
in float v_brightness;

uniform lowp int u_lightMode;
uniform lowp int u_pixelStars;

out vec4 fragColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  float alpha;
  if (u_pixelStars == 1) {
    // Pixel mode: hard square edges
    alpha = (abs(coord.x) < 0.4 && abs(coord.y) < 0.4) ? 1.0 : 0.0;
  } else {
    // Circle mode: soft circular falloff
    alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  }
  
  if (u_lightMode == 1) {
    // Light mode: colored stars on white background (darken the colors)
    vec3 darkColor = v_color * 0.4;
    fragColor = vec4(darkColor, alpha * v_brightness);
  } else {
    // Dark mode: colored glowing stars
    float glow = u_pixelStars == 1 ? 0.0 : exp(-dist * 3.0) * v_brightness;
    vec3 color = v_color * (0.7 + v_brightness * 0.3 + glow * 0.3);
    fragColor = vec4(color, alpha);
  }
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  
  return program;
}

/**
 * Create a perspective projection matrix for the sky dome
 */
function createProjectionMatrix(fov: number, aspect: number): Float32Array {
  const f = 1.0 / Math.tan(fov * Math.PI / 360);
  const near = 0.1;
  const far = 10.0;
  const rangeInv = 1.0 / (near - far);
  
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0
  ]);
}

/**
 * Create a view matrix for looking in a direction
 */
function createViewMatrix(yaw: number, pitch: number): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  
  // Look direction
  return new Float32Array([
    cy, sy * sp, -sy * cp, 0,
    0, cp, sp, 0,
    sy, -cy * sp, cy * cp, 0,
    0, 0, 0, 1
  ]);
}

/**
 * Multiply two 4x4 matrices (column-major order for WebGL)
 * Result = A * B
 */
function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      result[col * 4 + row] = 
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return result;
}

export interface SkyRendererOptions {
  fov?: number;
  magnitudeScale?: number;
  lightMode?: boolean;
  pixelStars?: boolean;
}

export function useSkyRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  starData: StarData | null,
  location: GeoLocation,
  date: Date,
  options: SkyRendererOptions = {}
) {
  const { fov = 60, magnitudeScale = 15, lightMode = false, pixelStars = false } = options;
  
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const vaoRef = useRef<WebGLVertexArrayObject | null>(null);
  const uniformsRef = useRef<{
    viewProjection: WebGLUniformLocation | null;
    celestialRotation: WebGLUniformLocation | null;
    pointScale: WebGLUniformLocation | null;
    magnitudeScale: WebGLUniformLocation | null;
    lightMode: WebGLUniformLocation | null;
    pixelStars: WebGLUniformLocation | null;
  } | null>(null);
  
  const viewRef = useRef({ yaw: 0, pitch: 0 });
  const starCountRef = useRef(0);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) {
      console.error('WebGL 2 not supported');
      return;
    }
    
    // Create shaders and program
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) {
      console.error('Failed to create star shaders');
      return;
    }
    
    const program = createProgram(gl, vs, fs);
    if (!program) {
      console.error('Failed to create star program');
      return;
    }
    
    console.log('Star renderer initialized successfully');
    
    // Get uniform locations
    uniformsRef.current = {
      viewProjection: gl.getUniformLocation(program, 'u_viewProjection'),
      celestialRotation: gl.getUniformLocation(program, 'u_celestialRotation'),
      pointScale: gl.getUniformLocation(program, 'u_pointScale'),
      magnitudeScale: gl.getUniformLocation(program, 'u_magnitudeScale'),
      pixelStars: gl.getUniformLocation(program, 'u_pixelStars'),
      lightMode: gl.getUniformLocation(program, 'u_lightMode'),
    };
    
    glRef.current = gl;
    programRef.current = program;
    
    // Enable blending for star glow
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    
    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [canvasRef]);

  // Upload star data when available
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program || !starData) return;
    
    // Create and bind VAO
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    // Position buffer
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, starData.positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    
    // Magnitude buffer
    const magBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, magBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, starData.magnitudes, gl.STATIC_DRAW);
    const magLoc = gl.getAttribLocation(program, 'a_magnitude');
    gl.enableVertexAttribArray(magLoc);
    gl.vertexAttribPointer(magLoc, 1, gl.FLOAT, false, 0, 0);
    
    // Color buffer
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, starData.colors, gl.STATIC_DRAW);
    const colorLoc = gl.getAttribLocation(program, 'a_color');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
    
    vaoRef.current = vao;
    starCountRef.current = starData.count;
    
    return () => {
      gl.deleteBuffer(posBuffer);
      gl.deleteBuffer(magBuffer);
      gl.deleteBuffer(colorBuffer);
      gl.deleteVertexArray(vao);
    };
  }, [starData]);

  // Render function
  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const uniforms = uniformsRef.current;
    const vao = vaoRef.current;
    const canvas = canvasRef.current;
    
    if (!gl || !program || !uniforms || !vao || !canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    gl.viewport(0, 0, width, height);
    
    // Background color based on mode
    if (lightMode) {
      gl.clearColor(0.95, 0.95, 0.92, 1.0); // Off-white
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Normal blending for light mode
    } else {
      gl.clearColor(0.02, 0.02, 0.08, 1.0); // Dark blue night sky
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for glow
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    
    // Calculate matrices
    const aspect = width / height;
    const projection = createProjectionMatrix(fov, aspect);
    const view = createViewMatrix(viewRef.current.yaw, viewRef.current.pitch);
    const viewProjection = multiplyMatrices(projection, view);
    
    // Get celestial rotation for current time and location
    const celestialRotation = getCelestialRotationMatrix(location, date);
    
    // Set uniforms
    gl.uniformMatrix4fv(uniforms.viewProjection, false, viewProjection);
    gl.uniformMatrix4fv(uniforms.celestialRotation, false, celestialRotation);
    gl.uniform1f(uniforms.pointScale, Math.min(width, height) / 800);
    gl.uniform1f(uniforms.magnitudeScale, magnitudeScale);
    gl.uniform1i(uniforms.lightMode, lightMode ? 1 : 0);
    gl.uniform1i(uniforms.pixelStars, pixelStars ? 1 : 0);
    
    // Draw stars
    gl.drawArrays(gl.POINTS, 0, starCountRef.current);
  }, [canvasRef, location, date, fov, magnitudeScale, lightMode, pixelStars]);

  // Set view direction
  const setView = useCallback((yaw: number, pitch: number) => {
    viewRef.current = { yaw, pitch };
  }, []);

  // Handle resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }, [canvasRef]);

  return {
    render,
    setView,
    handleResize,
    getView: () => viewRef.current,
  };
}
