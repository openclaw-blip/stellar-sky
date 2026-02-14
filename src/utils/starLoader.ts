/**
 * Star data loader - parses HYG database CSV
 */

import { equatorialToCartesian } from './astronomy';

export interface Star {
  id: number;
  ra: number;        // Right Ascension in hours
  dec: number;       // Declination in degrees
  mag: number;       // Apparent magnitude
  ci: number;        // Color index (B-V)
  x: number;         // Cartesian X on celestial sphere
  y: number;         // Cartesian Y
  z: number;         // Cartesian Z
  proper?: string;   // Proper name (e.g., "Sirius")
  bayer?: string;    // Bayer designation (e.g., "Alp CMa")
  constellation?: string;
}

export interface StarData {
  stars: Star[];
  positions: Float32Array;   // Interleaved [x, y, z, x, y, z, ...]
  magnitudes: Float32Array;  // Apparent magnitudes
  colors: Float32Array;      // RGB colors derived from B-V
  count: number;
}

/**
 * Convert B-V color index to RGB color
 * Based on approximation of black body radiation
 */
function colorIndexToRGB(ci: number): [number, number, number] {
  // Clamp color index to reasonable range
  const bv = Math.max(-0.4, Math.min(2.0, ci));
  
  let r: number, g: number, b: number;
  
  // Temperature approximation from B-V
  let t: number;
  if (bv < 0) {
    t = 10000 + bv * 10000;
  } else {
    t = 10000 / (bv + 1);
  }
  
  // Approximate RGB from temperature
  if (t >= 10000) {
    // Hot blue-white stars
    r = 0.7 + 0.3 * Math.min(1, (t - 10000) / 20000);
    g = 0.8 + 0.2 * Math.min(1, (t - 10000) / 20000);
    b = 1.0;
  } else if (t >= 7500) {
    // White stars
    r = 1.0;
    g = 1.0;
    b = 1.0;
  } else if (t >= 6000) {
    // Yellow-white
    r = 1.0;
    g = 0.95;
    b = 0.85;
  } else if (t >= 5000) {
    // Yellow (Sun-like)
    r = 1.0;
    g = 0.9;
    b = 0.7;
  } else if (t >= 3500) {
    // Orange
    r = 1.0;
    g = 0.7;
    b = 0.4;
  } else {
    // Red
    r = 1.0;
    g = 0.5;
    b = 0.3;
  }
  
  return [r, g, b];
}

/**
 * Load and parse the HYG star database
 */
export async function loadStarData(
  url: string = '/data/hyg.csv',
  maxMagnitude: number = 8.0  // Limit to visible stars (mag < 8)
): Promise<StarData> {
  const response = await fetch(url);
  const text = await response.text();
  
  const lines = text.split('\n');
  const header = lines[0].split(',').map(h => h.replace(/"/g, ''));
  
  // Find column indices
  const cols = {
    id: header.indexOf('id'),
    ra: header.indexOf('ra'),
    dec: header.indexOf('dec'),
    mag: header.indexOf('mag'),
    ci: header.indexOf('ci'),
    proper: header.indexOf('proper'),
    bayer: header.indexOf('bayer'),
    con: header.indexOf('con'),
  };
  
  const stars: Star[] = [];
  
  // Parse each line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV (handle quoted fields)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    const ra = parseFloat(values[cols.ra]);
    const dec = parseFloat(values[cols.dec]);
    const mag = parseFloat(values[cols.mag]);
    const ci = parseFloat(values[cols.ci]) || 0;
    
    // Skip invalid or too dim stars
    if (isNaN(ra) || isNaN(dec) || isNaN(mag)) continue;
    if (mag > maxMagnitude) continue;
    
    // Calculate cartesian position on celestial sphere
    const [x, y, z] = equatorialToCartesian(ra, dec);
    
    stars.push({
      id: parseInt(values[cols.id]) || i,
      ra,
      dec,
      mag,
      ci,
      x,
      y,
      z,
      proper: values[cols.proper] || undefined,
      bayer: values[cols.bayer] || undefined,
      constellation: values[cols.con] || undefined,
    });
  }
  
  // Sort by magnitude (brightest first)
  stars.sort((a, b) => a.mag - b.mag);
  
  // Create typed arrays for WebGL
  const count = stars.length;
  const positions = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    const star = stars[i];
    
    positions[i * 3] = star.x;
    positions[i * 3 + 1] = star.y;
    positions[i * 3 + 2] = star.z;
    
    magnitudes[i] = star.mag;
    
    const [r, g, b] = colorIndexToRGB(star.ci);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  
  console.log(`Loaded ${count} stars (magnitude < ${maxMagnitude})`);
  
  return { stars, positions, magnitudes, colors, count };
}

/**
 * Find stars near a given direction
 */
export function findStarsNear(
  stars: Star[],
  x: number,
  y: number,
  z: number,
  radius: number = 0.1
): Star[] {
  const radiusSq = radius * radius;
  
  return stars.filter(star => {
    const dx = star.x - x;
    const dy = star.y - y;
    const dz = star.z - z;
    return dx * dx + dy * dy + dz * dz < radiusSq;
  });
}
