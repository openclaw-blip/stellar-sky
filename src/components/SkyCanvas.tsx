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
  const [fov, setFov] = useState(60); // Field of view in degrees
  const [constellationLabels, setConstellationLabels] = useState<ConstellationLabel[]>([]);
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [selectedStarScreenPos, setSelectedStarScreenPos] = useState<{x: number, y: number} | null>(null);
  const [hoveredStarScreenPos, setHoveredStarScreenPos] = useState<{x: number, y: number} | null>(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const viewRef = useRef({ yaw: 0, pitch: Math.PI / 4 }); // Start looking at 45° altitude
  
  const { render: renderStars, setView, handleResize } = useSkyRenderer(
    canvasRef,
    starData,
    location,
    date,
    { fov, lightMode: gridOptions.lightMode, magnitudeScale: 10, pixelStars: gridOptions.pixelStars }
  );
  
  const { render: renderGrid, getConstellationLabels } = useGridRenderer(
    canvasRef,
    location,
    date,
    viewRef,
    gridOptions,
    fov
  );

  // Project star to screen coordinates
  const projectStarToScreen = useCallback((star: Star): {x: number, y: number} | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const dpr = window.devicePixelRatio || 1;
    const aspect = canvas.width / canvas.height;
    
    // Get celestial rotation
    const celestialRotation = getCelestialRotationMatrix(location, date);
    
    // Transform star position to observer frame
    const rx = celestialRotation[0] * star.x + celestialRotation[4] * star.y + celestialRotation[8] * star.z;
    const ry = celestialRotation[1] * star.x + celestialRotation[5] * star.y + celestialRotation[9] * star.z;
    const rz = celestialRotation[2] * star.x + celestialRotation[6] * star.y + celestialRotation[10] * star.z;
    
    // Apply view rotation
    const yaw = viewRef.current.yaw;
    const pitch = viewRef.current.pitch;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    
    const vx = cy * rx + sy * rz;
    const vy = sy * sp * rx + cp * ry - cy * sp * rz;
    const vz = -sy * cp * rx + sp * ry + cy * cp * rz;
    
    // Behind camera?
    // Note: vz sign is inverted from GPU convention, so skip behind-camera check
    // Stars behind camera will project outside screen bounds anyway
    
    // Project to screen - X negated to match GPU projection
    const f = 1.0 / Math.tan((fov * Math.PI / 180) / 2);
    const screenX = -(f / aspect) * (vx / vz);
    const screenY = -f * (vy / vz);
    
    // Convert to CSS pixels
    const cssX = ((screenX + 1) * 0.5 * canvas.width) / dpr;
    const cssY = ((1 - screenY) * 0.5 * canvas.height) / dpr;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    
    // Check if on screen
    if (cssX < 0 || cssX > rect.width || cssY < 0 || cssY > rect.height) {
      return null;
    }
    
    return { x: cssX, y: cssY };
  }, [location, date, fov]);

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
      
      // Update selected star position
      if (selectedStar) {
        setSelectedStarScreenPos(projectStarToScreen(selectedStar));
      }
      
      // Update hovered star position
      if (hoveredStar) {
        setHoveredStarScreenPos(projectStarToScreen(hoveredStar));
      } else {
        setHoveredStarScreenPos(null);
      }
      
      frameId = requestAnimationFrame(animate);
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [renderStars, renderGrid, getConstellationLabels, gridOptions.showConstellations, constellationLabels.length, selectedStar, hoveredStar, projectStarToScreen]);

  // Mouse drag for view rotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    didDragRef.current = false;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Find star under cursor
  // Find star at screen position by projecting all visible stars and finding closest
  const findStarAtPosition = useCallback((clientX: number, clientY: number): Star | null => {
    const canvas = canvasRef.current;
    if (!canvas || !starData) return null;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    
    let closestStar: Star | null = null;
    let closestDistSq = Infinity;
    const baseThreshold = 20; // pixels
    
    for (const star of starData.stars) {
      const pos = projectStarToScreen(star);
      if (!pos) continue;
      
      const dx = pos.x - clickX;
      const dy = pos.y - clickY;
      const distSq = dx * dx + dy * dy;
      
      // Brighter stars get larger hit radius
      const magFactor = 1 + Math.max(0, (4 - star.mag) * 0.5);
      const threshold = baseThreshold * magFactor;
      const thresholdSq = threshold * threshold;
      
      if (distSq < thresholdSq && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestStar = star;
      }
    }
    
    return closestStar;
  }, [starData, projectStarToScreen]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
    
    if (isDragging) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      
      // Mark as dragged if moved more than a few pixels
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragRef.current = true;
      }
      
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

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    setIsDragging(false);
    
    // If it was a click (not a drag), select/deselect star
    if (!didDragRef.current) {
      const star = findStarAtPosition(e.clientX, e.clientY);
      if (star) {
        setSelectedStar(star);
        setSelectedStarScreenPos(projectStarToScreen(star));
      } else {
        setSelectedStar(null);
        setSelectedStarScreenPos(null);
      }
    }
  }, [findStarAtPosition, projectStarToScreen]);

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

  // Block scroll wheel (no zoom)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
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
      onWheel={handleWheel}
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
      <StarInfo star={hoveredStar || selectedStar} />
      
      {/* Hover reticule */}
      {hoveredStar && hoveredStarScreenPos && hoveredStar !== selectedStar && (
        <div 
          className="star-reticule hover"
          style={{
            left: hoveredStarScreenPos.x,
            top: hoveredStarScreenPos.y,
          }}
        >
          <div className="reticule-corner tl" />
          <div className="reticule-corner tr" />
          <div className="reticule-corner bl" />
          <div className="reticule-corner br" />
        </div>
      )}
      
      {/* Selection reticule */}
      {selectedStar && selectedStarScreenPos && (
        <div 
          className="star-reticule selected"
          style={{
            left: selectedStarScreenPos.x,
            top: selectedStarScreenPos.y,
          }}
        >
          <div className="reticule-corner tl" />
          <div className="reticule-corner tr" />
          <div className="reticule-corner bl" />
          <div className="reticule-corner br" />
        </div>
      )}
    </div>
  );
}
