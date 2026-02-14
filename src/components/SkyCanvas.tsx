import { useEffect, useRef, useState, useCallback } from 'react';
import { useSkyRenderer } from '../hooks/useSkyRenderer';
import { useGridRenderer, type GridOptions } from '../hooks/useGridRenderer';
import type { StarData, Star } from '../utils/starLoader';
import { azimuthToCardinal, getCelestialRotationMatrix, type GeoLocation } from '../utils/astronomy';
import { StarInfo } from './StarInfo';
import './SkyCanvas.css';

interface ConstellationLabel {
  name: string;
  x: number;
  y: number;
  distance: number;
}

interface SkyCanvasProps {
  starData: StarData | null;
  location: GeoLocation;
  date: Date;
  gridOptions: GridOptions;
  onViewChange?: (yaw: number, pitch: number) => void;
}

export function SkyCanvas({ starData, location, date, gridOptions, onViewChange }: SkyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [viewState, setViewState] = useState({ yaw: 0, pitch: Math.PI / 4 });
  const [constellationLabels, setConstellationLabels] = useState<ConstellationLabel[]>([]);
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const viewRef = useRef({ yaw: 0, pitch: Math.PI / 4 }); // Start looking at 45° altitude
  
  const { render: renderStars, setView, handleResize } = useSkyRenderer(
    canvasRef,
    starData,
    location,
    date,
    { lightMode: gridOptions.lightMode, magnitudeScale: 10, pixelStars: gridOptions.pixelStars }
  );
  
  const { render: renderGrid, getConstellationLabels } = useGridRenderer(
    canvasRef,
    location,
    date,
    viewRef,
    gridOptions
  );

  // Initial setup and resize handling
  useEffect(() => {
    handleResize();
    renderStars();
    renderGrid();
    
    const onResize = () => {
      handleResize();
      renderStars();
      renderGrid();
    };
    
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [handleResize, renderStars, renderGrid]);

  // Animation loop for smooth updates
  useEffect(() => {
    let frameId: number;
    
    const animate = () => {
      renderStars();
      renderGrid();
      
      // Update constellation labels every frame for smooth tracking
      if (gridOptions.showConstellations) {
        setConstellationLabels(getConstellationLabels());
      } else if (constellationLabels.length > 0) {
        setConstellationLabels([]);
      }
      
      frameId = requestAnimationFrame(animate);
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [renderStars, renderGrid, getConstellationLabels, gridOptions.showConstellations, constellationLabels.length]);

  // Mouse drag for view rotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Find star under cursor
  const findStarAtPosition = useCallback((clientX: number, clientY: number): Star | null => {
    const canvas = canvasRef.current;
    if (!canvas || !starData) return null;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    
    // Convert screen position to normalized device coordinates
    const ndcX = (x / canvas.width) * 2 - 1;
    const ndcY = 1 - (y / canvas.height) * 2;
    
    // Get view direction from NDC
    const fov = 60;
    const aspect = canvas.width / canvas.height;
    const tanHalfFov = Math.tan((fov * Math.PI / 180) / 2);
    
    // Ray direction in view space
    const rayX = ndcX * tanHalfFov * aspect;
    const rayY = ndcY * tanHalfFov;
    const rayZ = 1;
    
    // Transform to world space using inverse view matrix
    const yaw = viewRef.current.yaw;
    const pitch = viewRef.current.pitch;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    
    // Inverse view rotation
    const worldRayX = cy * rayX + sy * cp * rayZ + sy * sp * rayY;
    const worldRayY = sp * rayZ - cp * rayY;
    const worldRayZ = -sy * rayX + cy * cp * rayZ + cy * sp * rayY;
    
    // Normalize
    const len = Math.sqrt(worldRayX * worldRayX + worldRayY * worldRayY + worldRayZ * worldRayZ);
    const dirX = worldRayX / len;
    const dirY = worldRayY / len;
    const dirZ = worldRayZ / len;
    
    // Get inverse celestial rotation
    const celestialRotation = getCelestialRotationMatrix(location, date);
    // Apply inverse (transpose for orthogonal matrix)
    const celestialDirX = celestialRotation[0] * dirX + celestialRotation[1] * dirY + celestialRotation[2] * dirZ;
    const celestialDirY = celestialRotation[4] * dirX + celestialRotation[5] * dirY + celestialRotation[6] * dirZ;
    const celestialDirZ = celestialRotation[8] * dirX + celestialRotation[9] * dirY + celestialRotation[10] * dirZ;
    
    // Find closest star to this direction
    let closestStar: Star | null = null;
    let closestDist = 0.02; // Threshold for hover detection
    
    for (const star of starData.stars) {
      const dx = star.x - celestialDirX;
      const dy = star.y - celestialDirY;
      const dz = star.z - celestialDirZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (dist < closestDist) {
        closestDist = dist;
        closestStar = star;
      }
    }
    
    return closestStar;
  }, [starData, location, date]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
    
    if (isDragging) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      
      // Update view angles
      const sensitivity = 0.005;
      viewRef.current.yaw -= dx * sensitivity;
      viewRef.current.pitch = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, viewRef.current.pitch + dy * sensitivity)
      );
      
      setView(viewRef.current.yaw, viewRef.current.pitch);
      setViewState({ ...viewRef.current });
      onViewChange?.(viewRef.current.yaw, viewRef.current.pitch);
      setHoveredStar(null);
    } else {
      // Check for star hover
      const star = findStarAtPosition(e.clientX, e.clientY);
      setHoveredStar(star);
    }
  }, [isDragging, setView, onViewChange, findStarAtPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredStar(null);
  }, []);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    
    const dx = e.touches[0].clientX - lastMouseRef.current.x;
    const dy = e.touches[0].clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    
    const sensitivity = 0.005;
    viewRef.current.yaw -= dx * sensitivity;
    viewRef.current.pitch = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, viewRef.current.pitch + dy * sensitivity)
    );
    
    setView(viewRef.current.yaw, viewRef.current.pitch);
    setViewState({ ...viewRef.current });
  }, [isDragging, setView]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate current view direction for display
  const viewAzimuth = (((-viewState.yaw * 180 / Math.PI) % 360) + 360) % 360;
  const viewAltitude = viewState.pitch * 180 / Math.PI;

  return (
    <div 
      ref={containerRef}
      className={`sky-container ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="sky-canvas" />
      
      {/* Constellation labels */}
      {gridOptions.showConstellations && constellationLabels.map((label, i) => {
        // Fade in as constellation approaches center (distance 0 = center, 1 = edge)
        // Start fading in at distance 0.8, fully visible at 0.3
        const fadeStart = 0.9;
        const fadeEnd = 0.35;
        const opacity = label.distance >= fadeStart 
          ? 0 
          : label.distance <= fadeEnd 
            ? 1 
            : 1 - (label.distance - fadeEnd) / (fadeStart - fadeEnd);
        
        if (opacity <= 0.05) return null;
        
        return (
          <div
            key={`${label.name}-${i}`}
            className="constellation-label"
            style={{
              left: label.x,
              top: label.y,
              opacity,
            }}
          >
            {label.name}
          </div>
        );
      })}
      
      {/* Compass overlay */}
      <div className="compass-overlay">
        <span className="compass-direction">{azimuthToCardinal(viewAzimuth)}</span>
        <span className="compass-degrees">{viewAzimuth.toFixed(0)}°</span>
        <span className="compass-altitude">Alt: {viewAltitude.toFixed(0)}°</span>
      </div>
      
      {/* Star info panel */}
      <StarInfo star={hoveredStar} />
    </div>
  );
}
