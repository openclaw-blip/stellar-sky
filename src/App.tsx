import { useState, useEffect } from 'react';
import { SkyCanvas } from './components/SkyCanvas';
import { LocationPicker } from './components/LocationPicker';
import { TimePicker } from './components/TimePicker';
import { Toolbar, type ToolbarOptions } from './components/Toolbar';
import { loadStarData, type StarData } from './utils/starLoader';
import type { GeoLocation } from './utils/astronomy';
import './App.css';

function App() {
  const [starData, setStarData] = useState<StarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default to Bend, Oregon
  const [location, setLocation] = useState<GeoLocation>({ lat: 44.0582, lon: -121.3153 });
  const [date, setDate] = useState(new Date());
  const [isRealtime, setIsRealtime] = useState(true);
  
  // Grid/overlay options
  const [toolbarOptions, setToolbarOptions] = useState<ToolbarOptions>({
    showAltAzGrid: false,
    showEquatorialGrid: false,
    showConstellations: false,
    showHorizon: true,
    showCardinals: true,
    lightMode: false,
  });

  // Load star data on mount
  useEffect(() => {
    // Use import.meta.env.BASE_URL for correct path in production
    const dataUrl = `${import.meta.env.BASE_URL}data/hyg.csv`;
    console.log('Loading stars from:', dataUrl);
    
    loadStarData(dataUrl, 6.0)
      .then(data => {
        console.log('Stars loaded successfully:', data.count);
        setStarData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load star data:', err);
        setError(`Failed to load star database: ${err.message}`);
        setLoading(false);
      });
  }, []);

  // Update time in realtime mode
  useEffect(() => {
    if (!isRealtime) return;
    
    const interval = setInterval(() => {
      setDate(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRealtime]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner" />
          <div className="loading-text">Loading stellar database...</div>
          <div className="loading-subtext">119,627 stars</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${toolbarOptions.lightMode ? 'light-mode' : 'dark-mode'}`}>
      <SkyCanvas 
        starData={starData}
        location={location}
        date={date}
        gridOptions={toolbarOptions}
      />
      
      <Toolbar
        options={toolbarOptions}
        onOptionsChange={setToolbarOptions}
      />
      
      <div className="controls">
        <LocationPicker 
          location={location}
          onLocationChange={setLocation}
        />
        <TimePicker
          date={date}
          onDateChange={setDate}
          isRealtime={isRealtime}
          onRealtimeChange={setIsRealtime}
        />
      </div>
      
      <div className="star-info">
        {starData && (
          <span>{starData.count.toLocaleString()} stars visible</span>
        )}
      </div>
    </div>
  );
}

export default App;
