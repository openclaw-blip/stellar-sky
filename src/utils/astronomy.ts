/**
 * Astronomy utilities for coordinate conversions
 * 
 * Coordinate systems:
 * - Equatorial: Right Ascension (RA) and Declination (Dec) - fixed to celestial sphere
 * - Horizontal: Altitude (Alt) and Azimuth (Az) - relative to observer's location
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const HOURS_TO_RAD = Math.PI / 12;

export interface EquatorialCoords {
  ra: number;   // Right Ascension in hours (0-24)
  dec: number;  // Declination in degrees (-90 to +90)
}

export interface HorizontalCoords {
  alt: number;  // Altitude in degrees (-90 to +90, negative = below horizon)
  az: number;   // Azimuth in degrees (0-360, 0=North, 90=East)
}

export interface GeoLocation {
  lat: number;  // Latitude in degrees (-90 to +90)
  lon: number;  // Longitude in degrees (-180 to +180)
}

/**
 * Calculate Julian Date from a JavaScript Date
 */
export function dateToJD(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  
  let y = year;
  let m = month;
  
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  
  const JD = Math.floor(365.25 * (y + 4716)) + 
             Math.floor(30.6001 * (m + 1)) + 
             day + B - 1524.5 +
             (hour + minute / 60 + second / 3600) / 24;
  
  return JD;
}

/**
 * Calculate Greenwich Mean Sidereal Time from Julian Date
 * Returns GMST in hours (0-24)
 */
export function jdToGMST(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  
  let gmst = 280.46061837 + 
             360.98564736629 * (jd - 2451545.0) +
             0.000387933 * T * T -
             T * T * T / 38710000.0;
  
  // Normalize to 0-360 degrees
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;
  
  // Convert to hours
  return gmst / 15;
}

/**
 * Calculate Local Sidereal Time
 * Returns LST in hours (0-24)
 */
export function getLST(date: Date, longitude: number): number {
  const jd = dateToJD(date);
  const gmst = jdToGMST(jd);
  
  // Add longitude (convert degrees to hours)
  let lst = gmst + longitude / 15;
  
  // Normalize to 0-24 hours
  lst = lst % 24;
  if (lst < 0) lst += 24;
  
  return lst;
}

/**
 * Convert equatorial coordinates (RA/Dec) to horizontal coordinates (Alt/Az)
 * for a given observer location and time
 */
export function equatorialToHorizontal(
  coords: EquatorialCoords,
  location: GeoLocation,
  date: Date
): HorizontalCoords {
  const lst = getLST(date, location.lon);
  
  // Hour angle = LST - RA (in hours, then convert to radians)
  let ha = (lst - coords.ra) * HOURS_TO_RAD;
  
  const decRad = coords.dec * DEG_TO_RAD;
  const latRad = location.lat * DEG_TO_RAD;
  
  // Calculate altitude
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(ha);
  const alt = Math.asin(sinAlt) * RAD_TO_DEG;
  
  // Calculate azimuth
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
                (Math.cos(latRad) * Math.cos(alt * DEG_TO_RAD));
  const sinAz = -Math.cos(decRad) * Math.sin(ha) / Math.cos(alt * DEG_TO_RAD);
  
  let az = Math.atan2(sinAz, cosAz) * RAD_TO_DEG;
  
  // Normalize azimuth to 0-360
  if (az < 0) az += 360;
  
  return { alt, az };
}

/**
 * Convert horizontal coordinates to 3D cartesian for rendering
 * Returns [x, y, z] on unit sphere
 * x = East, y = Up (zenith), z = North
 */
export function horizontalToCartesian(coords: HorizontalCoords): [number, number, number] {
  const altRad = coords.alt * DEG_TO_RAD;
  const azRad = coords.az * DEG_TO_RAD;
  
  // Convert spherical to cartesian
  // Azimuth: 0=North(+z), 90=East(+x), 180=South(-z), 270=West(-x)
  const cosAlt = Math.cos(altRad);
  const x = cosAlt * Math.sin(azRad);
  const y = Math.sin(altRad);
  const z = cosAlt * Math.cos(azRad);
  
  return [x, y, z];
}

/**
 * Convert equatorial coordinates directly to 3D cartesian on celestial sphere
 * Used for rendering without needing per-star coordinate conversion
 * Returns [x, y, z] on unit sphere centered at celestial north pole
 */
export function equatorialToCartesian(ra: number, dec: number): [number, number, number] {
  const raRad = ra * HOURS_TO_RAD;
  const decRad = dec * DEG_TO_RAD;
  
  const cosDec = Math.cos(decRad);
  const x = cosDec * Math.cos(raRad);
  const y = Math.sin(decRad);
  const z = cosDec * Math.sin(raRad);
  
  return [x, y, z];
}

/**
 * Build rotation matrix to transform celestial coordinates to observer's frame
 * This allows us to transform all stars at once in the vertex shader
 */
export function getCelestialRotationMatrix(location: GeoLocation, date: Date): Float32Array {
  const lst = getLST(date, location.lon);
  const lstRad = lst * HOURS_TO_RAD;
  const latRad = location.lat * DEG_TO_RAD;
  
  // First rotate around Y axis by LST (hour angle)
  // Then rotate around X axis by (90 - latitude) to align zenith
  
  const cosLst = Math.cos(lstRad);
  const sinLst = Math.sin(lstRad);
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  
  // Combined rotation matrix (column-major for WebGL)
  // R = Rx(90-lat) * Ry(lst)
  return new Float32Array([
    cosLst,           sinLst * sinLat,  sinLst * cosLat,  0,
    0,                cosLat,           -sinLat,          0,
    -sinLst,          cosLst * sinLat,  cosLst * cosLat,  0,
    0,                0,                0,                1
  ]);
}

/**
 * Get cardinal direction label for an azimuth
 */
export function azimuthToCardinal(az: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(az / 45) % 8;
  return directions[index];
}
