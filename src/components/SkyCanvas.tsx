import { useEffect, useRef, useState, useCallback } from 'react';
import { useSkyRenderer } from '../hooks/useSkyRenderer';
import { useGridRenderer, type GridOptions } from '../hooks/useGridRenderer';
import type { StarData } from '../utils/starLoader';
import { azimuthToCardinal, type GeoLocation } from '../utils/astronomy';
import './SkyCanvas.css';

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
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const viewRef = useRef({ yaw: 0, pitch: Math.PI / 4 }); // Start looking at 45° altitude
  
  const { render: renderStars, setView, handleResize } = useSkyRenderer(
    canvasRef,
    starData,
    location,
    date,
    { lightMode: gridOptions.lightMode }
  );
  
  const { render: renderGrid } = useGridRenderer(
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
      frameId = requestAnimationFrame(animate);
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [renderStars, renderGrid]);

  // Mouse drag for view rotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
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
  }, [isDragging, setView, onViewChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
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
      
      {/* Compass overlay */}
      <div className="compass-overlay">
        <span className="compass-direction">{azimuthToCardinal(viewAzimuth)}</span>
        <span className="compass-degrees">{viewAzimuth.toFixed(0)}°</span>
        <span className="compass-altitude">Alt: {viewAltitude.toFixed(0)}°</span>
      </div>
      
      {/* Instructions */}
      <div className="instructions">
        Drag to look around
      </div>
    </div>
  );
}
