import { useState, useCallback, useEffect, useRef } from 'react';
import type { GeoLocation } from '../utils/astronomy';
import './LocationPicker.css';

interface LocationPickerProps {
  location: GeoLocation;
  onLocationChange: (location: GeoLocation) => void;
}

// Common locations for quick selection
const PRESET_LOCATIONS: { name: string; location: GeoLocation }[] = [
  { name: 'New York, USA', location: { lat: 40.7128, lon: -74.006 } },
  { name: 'London, UK', location: { lat: 51.5074, lon: -0.1278 } },
  { name: 'Tokyo, Japan', location: { lat: 35.6762, lon: 139.6503 } },
  { name: 'Sydney, Australia', location: { lat: -33.8688, lon: 151.2093 } },
  { name: 'Cairo, Egypt', location: { lat: 30.0444, lon: 31.2357 } },
  { name: 'Rio de Janeiro, Brazil', location: { lat: -22.9068, lon: -43.1729 } },
  { name: 'Reykjavik, Iceland', location: { lat: 64.1466, lon: -21.9426 } },
  { name: 'Cape Town, South Africa', location: { lat: -33.9249, lon: 18.4241 } },
  { name: 'Bend, Oregon', location: { lat: 44.0582, lon: -121.3153 } },
];

export function LocationPicker({ location, onLocationChange }: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [latInput, setLatInput] = useState(location.lat.toString());
  const [lonInput, setLonInput] = useState(location.lon.toString());
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLatInput(location.lat.toFixed(4));
    setLonInput(location.lon.toFixed(4));
  }, [location]);

  const handleApply = useCallback(() => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      onLocationChange({ lat, lon });
      setIsOpen(false);
    }
  }, [latInput, lonInput, onLocationChange]);

  const handlePresetClick = useCallback((preset: typeof PRESET_LOCATIONS[0]) => {
    onLocationChange(preset.location);
    setIsOpen(false);
  }, [onLocationChange]);

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to lat/lon (simple equirectangular projection)
    const lon = (x / rect.width) * 360 - 180;
    const lat = 90 - (y / rect.height) * 180;
    
    onLocationChange({ lat, lon });
    setIsOpen(false);
  }, [onLocationChange]);

  const handleUseMyLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onLocationChange({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setIsOpen(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Could not get your location. Please enter coordinates manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }, [onLocationChange]);

  // Convert location to map position
  const markerX = ((location.lon + 180) / 360) * 100;
  const markerY = ((90 - location.lat) / 180) * 100;

  return (
    <div className="location-picker">
      <button 
        className="location-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        📍 {location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°
      </button>
      
      {isOpen && (
        <div className="location-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="location-modal" onClick={e => e.stopPropagation()}>
            <div className="location-header">
              <h3>Select Location</h3>
              <button className="close-button" onClick={() => setIsOpen(false)}>×</button>
            </div>
            
            {/* Simple world map */}
            <div 
              ref={mapRef}
              className="world-map" 
              onClick={handleMapClick}
            >
              <div 
                className="location-marker"
                style={{ left: `${markerX}%`, top: `${markerY}%` }}
              />
            </div>
            
            {/* Coordinate inputs */}
            <div className="coord-inputs">
              <div className="coord-field">
                <label>Latitude</label>
                <input
                  type="number"
                  min="-90"
                  max="90"
                  step="0.0001"
                  value={latInput}
                  onChange={e => setLatInput(e.target.value)}
                />
              </div>
              <div className="coord-field">
                <label>Longitude</label>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="0.0001"
                  value={lonInput}
                  onChange={e => setLonInput(e.target.value)}
                />
              </div>
              <button className="apply-button" onClick={handleApply}>Apply</button>
            </div>
            
            <button className="my-location-button" onClick={handleUseMyLocation}>
              🎯 Use My Location
            </button>
            
            {/* Preset locations */}
            <div className="presets">
              <div className="presets-label">Quick Select:</div>
              <div className="preset-grid">
                {PRESET_LOCATIONS.map(preset => (
                  <button
                    key={preset.name}
                    className="preset-button"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
