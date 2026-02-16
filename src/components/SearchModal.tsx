import { useState, useEffect, useRef, useMemo } from 'react';
import type { StarData } from '../utils/starLoader';
import { CONSTELLATION_NAMES } from '../utils/constellationNames';
import './SearchModal.css';

interface SearchResult {
  type: 'star' | 'constellation';
  name: string;
  subtitle?: string;
  ra: number;  // hours for stars, hours for constellations
  dec: number; // degrees
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ra: number, dec: number) => void;
  starData: StarData | null;
}

export function SearchModal({ isOpen, onClose, onSelect, starData }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Build searchable index from stars and constellations
  const searchIndex = useMemo(() => {
    const results: SearchResult[] = [];
    
    // Add constellations
    for (const [abbr, name] of Object.entries(CONSTELLATION_NAMES)) {
      // Get approximate center from constellation data
      // For now, use a lookup table of major constellations
      const coords = CONSTELLATION_COORDS[abbr];
      if (coords) {
        results.push({
          type: 'constellation',
          name,
          subtitle: abbr,
          ra: coords.ra,
          dec: coords.dec,
        });
      }
    }
    
    // Add named stars
    if (starData) {
      for (const star of starData.stars) {
        if (star.proper) {
          results.push({
            type: 'star',
            name: star.proper,
            subtitle: star.bayer || `mag ${star.mag.toFixed(1)}`,
            ra: star.ra,
            dec: star.dec,
          });
        }
      }
    }
    
    return results;
  }, [starData]);

  // Filter results based on query
  const filteredResults = useMemo(() => {
    if (!query.trim()) return [];
    
    const q = query.toLowerCase();
    return searchIndex
      .filter(r => 
        r.name.toLowerCase().includes(q) || 
        (r.subtitle && r.subtitle.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        // Prioritize starts-with matches
        const aStarts = a.name.toLowerCase().startsWith(q);
        const bStarts = b.name.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        // Then sort by name
        return a.name.localeCompare(b.name);
      })
      .slice(0, 20);
  }, [query, searchIndex]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredResults.length) {
      setSelectedIndex(Math.max(0, filteredResults.length - 1));
    }
  }, [filteredResults.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          const result = filteredResults[selectedIndex];
          onSelect(result.ra, result.dec);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    onSelect(result.ra, result.dec);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search stars and constellations..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        
        {filteredResults.length > 0 && (
          <div className="search-results" ref={resultsRef}>
            {filteredResults.map((result, i) => (
              <div
                key={`${result.type}-${result.name}`}
                className={`search-result ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleResultClick(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="result-icon">
                  {result.type === 'star' ? '★' : '✧'}
                </span>
                <div className="result-text">
                  <span className="result-name">{result.name}</span>
                  {result.subtitle && (
                    <span className="result-subtitle">{result.subtitle}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {query && filteredResults.length === 0 && (
          <div className="search-empty">No results found</div>
        )}
      </div>
    </div>
  );
}

// Approximate constellation center coordinates (RA in hours, Dec in degrees)
const CONSTELLATION_COORDS: Record<string, { ra: number; dec: number }> = {
  And: { ra: 0.8, dec: 38 },
  Ant: { ra: 10.3, dec: -33 },
  Aps: { ra: 16, dec: -75 },
  Aqr: { ra: 22.3, dec: -11 },
  Aql: { ra: 19.7, dec: 3 },
  Ara: { ra: 17.3, dec: -55 },
  Ari: { ra: 2.6, dec: 21 },
  Aur: { ra: 6, dec: 42 },
  Boo: { ra: 14.7, dec: 31 },
  Cae: { ra: 4.7, dec: -38 },
  Cam: { ra: 6, dec: 70 },
  Cnc: { ra: 8.6, dec: 20 },
  CVn: { ra: 13, dec: 40 },
  CMa: { ra: 6.8, dec: -22 },
  CMi: { ra: 7.6, dec: 6 },
  Cap: { ra: 21, dec: -20 },
  Car: { ra: 8.7, dec: -63 },
  Cas: { ra: 1, dec: 60 },
  Cen: { ra: 13, dec: -47 },
  Cep: { ra: 22, dec: 70 },
  Cet: { ra: 1.7, dec: -8 },
  Cha: { ra: 10.5, dec: -79 },
  Cir: { ra: 15, dec: -63 },
  Col: { ra: 5.9, dec: -35 },
  Com: { ra: 12.8, dec: 23 },
  CrA: { ra: 18.6, dec: -41 },
  CrB: { ra: 15.8, dec: 33 },
  Crv: { ra: 12.4, dec: -18 },
  Crt: { ra: 11.4, dec: -15 },
  Cru: { ra: 12.4, dec: -60 },
  Cyg: { ra: 20.6, dec: 42 },
  Del: { ra: 20.7, dec: 12 },
  Dor: { ra: 5.2, dec: -60 },
  Dra: { ra: 15, dec: 65 },
  Equ: { ra: 21.2, dec: 8 },
  Eri: { ra: 3.3, dec: -29 },
  For: { ra: 2.8, dec: -32 },
  Gem: { ra: 7, dec: 23 },
  Gru: { ra: 22.5, dec: -47 },
  Her: { ra: 17.4, dec: 27 },
  Hor: { ra: 3.3, dec: -53 },
  Hya: { ra: 10, dec: -15 },
  Hyi: { ra: 2.3, dec: -70 },
  Ind: { ra: 21.5, dec: -58 },
  Lac: { ra: 22.5, dec: 45 },
  Leo: { ra: 10.7, dec: 15 },
  LMi: { ra: 10.2, dec: 33 },
  Lep: { ra: 5.5, dec: -19 },
  Lib: { ra: 15.2, dec: -16 },
  Lup: { ra: 15.3, dec: -43 },
  Lyn: { ra: 8, dec: 48 },
  Lyr: { ra: 18.9, dec: 37 },
  Men: { ra: 5.5, dec: -77 },
  Mic: { ra: 21, dec: -37 },
  Mon: { ra: 7.1, dec: 0 },
  Mus: { ra: 12.5, dec: -70 },
  Nor: { ra: 16, dec: -52 },
  Oct: { ra: 22, dec: -85 },
  Oph: { ra: 17.4, dec: -7 },
  Ori: { ra: 5.5, dec: 3 },
  Pav: { ra: 19.6, dec: -65 },
  Peg: { ra: 22.7, dec: 20 },
  Per: { ra: 3.2, dec: 45 },
  Phe: { ra: 0.9, dec: -48 },
  Pic: { ra: 5.7, dec: -53 },
  Psc: { ra: 0.5, dec: 12 },
  PsA: { ra: 22.5, dec: -31 },
  Pup: { ra: 7.3, dec: -31 },
  Pyx: { ra: 8.9, dec: -27 },
  Ret: { ra: 3.9, dec: -60 },
  Sge: { ra: 19.8, dec: 18 },
  Sgr: { ra: 19, dec: -28 },
  Sco: { ra: 16.9, dec: -30 },
  Scl: { ra: 0.4, dec: -33 },
  Sct: { ra: 18.7, dec: -10 },
  Ser: { ra: 16.9, dec: 6 },
  Sex: { ra: 10.3, dec: -2 },
  Tau: { ra: 4.7, dec: 16 },
  Tel: { ra: 19, dec: -52 },
  Tri: { ra: 2.2, dec: 32 },
  TrA: { ra: 16, dec: -65 },
  Tuc: { ra: 23.8, dec: -66 },
  UMa: { ra: 11, dec: 55 },
  UMi: { ra: 15, dec: 78 },
  Vel: { ra: 9.4, dec: -47 },
  Vir: { ra: 13.4, dec: -3 },
  Vol: { ra: 7.8, dec: -69 },
  Vul: { ra: 20.2, dec: 25 },
};
