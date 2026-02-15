import { useState, useEffect, useRef } from 'react';
import { SkyCanvas } from './components/SkyCanvas';
import { LocationPicker } from './components/LocationPicker';
import { TimePicker } from './components/TimePicker';
import { PlaybackControls } from './components/PlaybackControls';
import { Toolbar, type ToolbarOptions } from './components/Toolbar';
import { loadStarData, type StarData } from './utils/starLoader';
import type { GeoLocation } from './utils/astronomy';
import './App.css';

const STORAGE_KEY = 'stellar-sky-settings';

interface StoredSettings {
  location: GeoLocation;
  toolbarOptions: ToolbarOptions;
}

const defaultLocation: GeoLocation = { lat: 44.0582, lon: -121.3153 }; // Bend, Oregon

const defaultToolbarOptions: ToolbarOptions = {
  showAltAzGrid: false,
  showEquatorialGrid: false,
  showConstellations: false,
  showHorizon: true,
  showCardinals: true,
  lightMode: false,
  nightMode: false,
  pixelStars: false,
};

function loadSettings(): StoredSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        location: { ...defaultLocation, ...parsed.location },
        toolbarOptions: { ...defaultToolbarOptions, ...parsed.toolbarOptions },
      };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return { location: defaultLocation, toolbarOptions: defaultToolbarOptions };
}

function saveSettings(settings: StoredSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

function App() {
  const [starData, setStarData] = useState<StarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load persisted settings
  const [initialSettings] = useState(() => loadSettings());
  const [location, setLocation] = useState<GeoLocation>(initialSettings.location);
  const [date, setDate] = useState(new Date());
  const [isRealtime, setIsRealtime] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(0); // 0 = paused/realtime, positive = forward, negative = reverse
  const lastUpdateRef = useRef(Date.now());
  
  // Grid/overlay options
  const [toolbarOptions, setToolbarOptions] = useState<ToolbarOptions>(initialSettings.toolbarOptions);
  
  // Persist settings when they change
  useEffect(() => {
    saveSettings({ location, toolbarOptions });
  }, [location, toolbarOptions]);

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

  // Update time based on playback speed or realtime mode
  useEffect(() => {
    if (playbackSpeed === 0) {
      // When paused/stopped, use realtime if enabled
      if (!isRealtime) return;
      
      const interval = setInterval(() => {
        setDate(new Date());
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      // Playback mode - advance time based on speed
      setIsRealtime(false);
      lastUpdateRef.current = Date.now();
      
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastUpdateRef.current) / 1000; // seconds
        lastUpdateRef.current = now;
        
        setDate(prev => {
          const newTime = prev.getTime() + elapsed * playbackSpeed * 1000;
          return new Date(newTime);
        });
      }, 50); // Update at 20fps for smooth animation
      
      return () => clearInterval(interval);
    }
  }, [isRealtime, playbackSpeed]);

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
          isRealtime={isRealtime && playbackSpeed === 0}
          onRealtimeChange={(rt) => {
            setIsRealtime(rt);
            if (rt) setPlaybackSpeed(0);
          }}
        />
        <PlaybackControls
          speed={playbackSpeed}
          onSpeedChange={(speed) => {
            setPlaybackSpeed(speed);
            if (speed !== 0) setIsRealtime(false);
          }}
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
