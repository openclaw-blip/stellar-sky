/**
 * WebGL Grid Renderer
 * Renders Alt/Az and Equatorial coordinate grid lines
 */

import { useCallback, useEffect, useRef } from 'react';
import type { GeoLocation } from '../utils/astronomy';
import { getCelestialRotationMatrix } from '../utils/astronomy';

const vertexShaderSource = `#version 300 es
precision highp float;

in vec3 a_position;

uniform mat4 u_viewProjection;
uniform mat4 u_transform;

void main() {
  vec4 pos = u_transform * vec4(a_position, 1.0);
  gl_Position = u_viewProjection * pos;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec4 u_color;

out vec4 fragColor;

void main() {
  fragColor = u_color;
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Grid shader error:', gl.getShaderInfoLog(shader));
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
    console.error('Grid program error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// Generate circle vertices at a given altitude
function generateAltitudeCircle(alt: number, segments: number = 72): Float32Array {
  const vertices: number[] = [];
  const altRad = alt * Math.PI / 180;
  const cosAlt = Math.cos(altRad);
  const sinAlt = Math.sin(altRad);
  
  for (let i = 0; i <= segments; i++) {
    const az = (i / segments) * Math.PI * 2;
    const x = cosAlt * Math.sin(az);
    const y = sinAlt;
    const z = cosAlt * Math.cos(az);
    vertices.push(x, y, z);
  }
  
  return new Float32Array(vertices);
}

// Generate arc from horizon to zenith at a given azimuth
function generateAzimuthArc(az: number, segments: number = 36): Float32Array {
  const vertices: number[] = [];
  const azRad = az * Math.PI / 180;
  
  for (let i = 0; i <= segments; i++) {
    const alt = (i / segments) * 90; // 0 to 90 degrees
    const altRad = alt * Math.PI / 180;
    const cosAlt = Math.cos(altRad);
    const sinAlt = Math.sin(altRad);
    const x = cosAlt * Math.sin(azRad);
    const y = sinAlt;
    const z = cosAlt * Math.cos(azRad);
    vertices.push(x, y, z);
  }
  
  return new Float32Array(vertices);
}

// Generate RA circle (declination line)
function generateDeclinationCircle(dec: number, segments: number = 72): Float32Array {
  const vertices: number[] = [];
  const decRad = dec * Math.PI / 180;
  const cosDec = Math.cos(decRad);
  const sinDec = Math.sin(decRad);
  
  for (let i = 0; i <= segments; i++) {
    const ra = (i / segments) * Math.PI * 2;
    const x = cosDec * Math.cos(ra);
    const y = sinDec;
    const z = cosDec * Math.sin(ra);
    vertices.push(x, y, z);
  }
  
  return new Float32Array(vertices);
}

// Generate Dec arc (hour circle / RA line)
function generateRACircle(ra: number, segments: number = 72): Float32Array {
  const vertices: number[] = [];
  const raRad = ra * Math.PI / 12; // RA in hours -> radians
  
  for (let i = 0; i <= segments; i++) {
    const dec = -90 + (i / segments) * 180; // -90 to +90
    const decRad = dec * Math.PI / 180;
    const cosDec = Math.cos(decRad);
    const sinDec = Math.sin(decRad);
    const x = cosDec * Math.cos(raRad);
    const y = sinDec;
    const z = cosDec * Math.sin(raRad);
    vertices.push(x, y, z);
  }
  
  return new Float32Array(vertices);
}

// Create view projection matrix (same as star renderer)
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

function createViewMatrix(yaw: number, pitch: number): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return new Float32Array([
    cy, sy * sp, -sy * cp, 0,
    0, cp, sp, 0,
    sy, -cy * sp, cy * cp, 0,
    0, 0, 0, 1
  ]);
}

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

const IDENTITY_MATRIX = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]);

export interface GridOptions {
  showAltAzGrid: boolean;
  showEquatorialGrid: boolean;
  showHorizon: boolean;
  showCardinals: boolean;
  lightMode: boolean;
}

export function useGridRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  location: GeoLocation,
  date: Date,
  viewRef: React.RefObject<{ yaw: number; pitch: number }>,
  options: GridOptions
) {
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<{
    viewProjection: WebGLUniformLocation | null;
    transform: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
  } | null>(null);
  
  // Pre-generated grid geometry
  const altCirclesRef = useRef<{ buffer: WebGLBuffer; count: number }[]>([]);
  const azArcsRef = useRef<{ buffer: WebGLBuffer; count: number }[]>([]);
  const decCirclesRef = useRef<{ buffer: WebGLBuffer; count: number }[]>([]);
  const raCirclesRef = useRef<{ buffer: WebGLBuffer; count: number }[]>([]);
  const horizonRef = useRef<{ buffer: WebGLBuffer; count: number } | null>(null);

  // Initialize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const gl = canvas.getContext('webgl2');
    if (!gl) return;
    
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return;
    
    const program = createProgram(gl, vs, fs);
    if (!program) return;
    
    uniformsRef.current = {
      viewProjection: gl.getUniformLocation(program, 'u_viewProjection'),
      transform: gl.getUniformLocation(program, 'u_transform'),
      color: gl.getUniformLocation(program, 'u_color'),
    };
    
    glRef.current = gl;
    programRef.current = program;
    
    // Generate Alt/Az grid geometry
    const altitudes = [0, 15, 30, 45, 60, 75];
    const azimuths = [0, 45, 90, 135, 180, 225, 270, 315];
    
    altCirclesRef.current = altitudes.map(alt => {
      const vertices = generateAltitudeCircle(alt);
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      return { buffer, count: vertices.length / 3 };
    });
    
    azArcsRef.current = azimuths.map(az => {
      const vertices = generateAzimuthArc(az);
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      return { buffer, count: vertices.length / 3 };
    });
    
    // Horizon line (thicker, at 0 altitude)
    const horizonVertices = generateAltitudeCircle(0, 144);
    const horizonBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, horizonBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, horizonVertices, gl.STATIC_DRAW);
    horizonRef.current = { buffer: horizonBuffer, count: horizonVertices.length / 3 };
    
    // Generate equatorial grid geometry
    const declinations = [-60, -30, 0, 30, 60];
    const rightAscensions = [0, 3, 6, 9, 12, 15, 18, 21];
    
    decCirclesRef.current = declinations.map(dec => {
      const vertices = generateDeclinationCircle(dec);
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      return { buffer, count: vertices.length / 3 };
    });
    
    raCirclesRef.current = rightAscensions.map(ra => {
      const vertices = generateRACircle(ra);
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      return { buffer, count: vertices.length / 3 };
    });
    
    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      altCirclesRef.current.forEach(c => gl.deleteBuffer(c.buffer));
      azArcsRef.current.forEach(c => gl.deleteBuffer(c.buffer));
      decCirclesRef.current.forEach(c => gl.deleteBuffer(c.buffer));
      raCirclesRef.current.forEach(c => gl.deleteBuffer(c.buffer));
      if (horizonRef.current) gl.deleteBuffer(horizonRef.current.buffer);
    };
  }, [canvasRef]);

  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const uniforms = uniformsRef.current;
    const canvas = canvasRef.current;
    
    if (!gl || !program || !uniforms || !canvas) return;
    if (!options.showAltAzGrid && !options.showEquatorialGrid && !options.showHorizon) return;
    
    gl.useProgram(program);
    gl.bindVertexArray(null); // Unbind any VAO to avoid corrupting star renderer's VAO
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    const aspect = canvas.width / canvas.height;
    const projection = createProjectionMatrix(60, aspect);
    const currentView = viewRef.current || { yaw: 0, pitch: 0 };
    const view = createViewMatrix(currentView.yaw, currentView.pitch);
    const viewProjection = multiplyMatrices(projection, view);
    
    gl.uniformMatrix4fv(uniforms.viewProjection, false, viewProjection);
    
    const posLoc = gl.getAttribLocation(program, 'a_position');
    
    const drawLines = (items: { buffer: WebGLBuffer; count: number }[], color: number[], transform: Float32Array) => {
      gl.uniformMatrix4fv(uniforms.transform, false, transform);
      gl.uniform4fv(uniforms.color, color);
      
      items.forEach(item => {
        gl.bindBuffer(gl.ARRAY_BUFFER, item.buffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINE_STRIP, 0, item.count);
      });
    };
    
    // Colors for light vs dark mode
    const altAzColor = options.lightMode ? [0.2, 0.4, 0.7, 0.5] : [0.3, 0.5, 0.8, 0.4];
    const altAzColorDim = options.lightMode ? [0.2, 0.4, 0.7, 0.35] : [0.3, 0.5, 0.8, 0.3];
    const horizonColor = options.lightMode ? [0.6, 0.3, 0.1, 0.8] : [0.8, 0.4, 0.2, 0.7];
    const eqColor = options.lightMode ? [0.5, 0.2, 0.5, 0.4] : [0.6, 0.3, 0.6, 0.3];
    const eqColorDim = options.lightMode ? [0.5, 0.2, 0.5, 0.3] : [0.6, 0.3, 0.6, 0.25];
    
    // Draw Alt/Az grid (in observer frame - identity transform)
    if (options.showAltAzGrid) {
      drawLines(altCirclesRef.current, altAzColor, IDENTITY_MATRIX);
      drawLines(azArcsRef.current, altAzColorDim, IDENTITY_MATRIX);
    }
    
    // Draw horizon line
    if (options.showHorizon && horizonRef.current) {
      gl.uniformMatrix4fv(uniforms.transform, false, IDENTITY_MATRIX);
      gl.uniform4fv(uniforms.color, horizonColor);
      gl.bindBuffer(gl.ARRAY_BUFFER, horizonRef.current.buffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINE_STRIP, 0, horizonRef.current.count);
    }
    
    // Draw equatorial grid (needs celestial rotation)
    if (options.showEquatorialGrid) {
      const celestialRotation = getCelestialRotationMatrix(location, date);
      drawLines(decCirclesRef.current, eqColor, celestialRotation);
      drawLines(raCirclesRef.current, eqColorDim, celestialRotation);
    }
    
  }, [canvasRef, location, date, viewRef, options]);

  return { render };
}
