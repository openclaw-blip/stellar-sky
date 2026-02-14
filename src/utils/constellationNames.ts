/**
 * Constellation abbreviation to full name mapping
 */
export const CONSTELLATION_NAMES: Record<string, string> = {
  And: 'Andromeda',
  Ant: 'Antlia',
  Aps: 'Apus',
  Aqr: 'Aquarius',
  Aql: 'Aquila',
  Ara: 'Ara',
  Ari: 'Aries',
  Aur: 'Auriga',
  Boo: 'Boötes',
  Cae: 'Caelum',
  Cam: 'Camelopardalis',
  Cnc: 'Cancer',
  CVn: 'Canes Venatici',
  CMa: 'Canis Major',
  CMi: 'Canis Minor',
  Cap: 'Capricornus',
  Car: 'Carina',
  Cas: 'Cassiopeia',
  Cen: 'Centaurus',
  Cep: 'Cepheus',
  Cet: 'Cetus',
  Cha: 'Chamaeleon',
  Cir: 'Circinus',
  Col: 'Columba',
  Com: 'Coma Berenices',
  CrA: 'Corona Australis',
  CrB: 'Corona Borealis',
  Crv: 'Corvus',
  Crt: 'Crater',
  Cru: 'Crux',
  Cyg: 'Cygnus',
  Del: 'Delphinus',
  Dor: 'Dorado',
  Dra: 'Draco',
  Equ: 'Equuleus',
  Eri: 'Eridanus',
  For: 'Fornax',
  Gem: 'Gemini',
  Gru: 'Grus',
  Her: 'Hercules',
  Hor: 'Horologium',
  Hya: 'Hydra',
  Hyi: 'Hydrus',
  Ind: 'Indus',
  Lac: 'Lacerta',
  Leo: 'Leo',
  LMi: 'Leo Minor',
  Lep: 'Lepus',
  Lib: 'Libra',
  Lup: 'Lupus',
  Lyn: 'Lynx',
  Lyr: 'Lyra',
  Men: 'Mensa',
  Mic: 'Microscopium',
  Mon: 'Monoceros',
  Mus: 'Musca',
  Nor: 'Norma',
  Oct: 'Octans',
  Oph: 'Ophiuchus',
  Ori: 'Orion',
  Pav: 'Pavo',
  Peg: 'Pegasus',
  Per: 'Perseus',
  Phe: 'Phoenix',
  Pic: 'Pictor',
  Psc: 'Pisces',
  PsA: 'Piscis Austrinus',
  Pup: 'Puppis',
  Pyx: 'Pyxis',
  Ret: 'Reticulum',
  Sge: 'Sagitta',
  Sgr: 'Sagittarius',
  Sco: 'Scorpius',
  Scl: 'Sculptor',
  Sct: 'Scutum',
  Ser: 'Serpens',
  Sex: 'Sextans',
  Tau: 'Taurus',
  Tel: 'Telescopium',
  Tri: 'Triangulum',
  TrA: 'Triangulum Australe',
  Tuc: 'Tucana',
  UMa: 'Ursa Major',
  UMi: 'Ursa Minor',
  Vel: 'Vela',
  Vir: 'Virgo',
  Vol: 'Volans',
  Vul: 'Vulpecula',
};

export interface ConstellationCenter {
  id: string;
  name: string;
  ra: number;  // Right ascension in degrees
  dec: number; // Declination in degrees
  // Unit sphere position (celestial coordinates)
  x: number;
  y: number;
  z: number;
}

/**
 * Calculate constellation centers from line geometry
 * Note: Constellation GeoJSON uses RA in degrees (-180 to 180)
 * We need to convert to the same coordinate system as stars (RA in hours)
 */
export function calculateConstellationCenters(
  features: Array<{
    id: string;
    geometry: {
      type: string;
      coordinates: number[][][];
    };
  }>
): ConstellationCenter[] {
  const centersMap = new Map<string, { sumRa: number; sumDec: number; count: number }>();
  
  for (const feature of features) {
    const id = feature.id;
    if (!centersMap.has(id)) {
      centersMap.set(id, { sumRa: 0, sumDec: 0, count: 0 });
    }
    
    const entry = centersMap.get(id)!;
    
    if (feature.geometry.type === 'MultiLineString') {
      for (const line of feature.geometry.coordinates) {
        for (const coord of line) {
          entry.sumRa += coord[0];
          entry.sumDec += coord[1];
          entry.count++;
        }
      }
    }
  }
  
  const centers: ConstellationCenter[] = [];
  const HOURS_TO_RAD = Math.PI / 12;
  const DEG_TO_RAD = Math.PI / 180;
  
  for (const [id, entry] of centersMap) {
    if (entry.count === 0) continue;
    
    // RA in degrees from GeoJSON
    const raDeg = entry.sumRa / entry.count;
    const dec = entry.sumDec / entry.count;
    const name = CONSTELLATION_NAMES[id] || id;
    
    // Convert RA from degrees to hours (same as star data)
    // RA degrees: -180 to 180 -> hours: 0 to 24
    let raHours = raDeg / 15; // 15 degrees per hour
    if (raHours < 0) raHours += 24;
    
    // Convert to unit sphere position (matching equatorialToCartesian)
    const raRad = raHours * HOURS_TO_RAD;
    const decRad = dec * DEG_TO_RAD;
    const cosDec = Math.cos(decRad);
    
    centers.push({
      id,
      name,
      ra: raHours,
      dec,
      x: cosDec * Math.cos(raRad),
      y: Math.sin(decRad),
      z: cosDec * Math.sin(raRad),
    });
  }
  
  return centers;
}
