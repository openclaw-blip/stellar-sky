import type { Star } from '../utils/starLoader';
import './StarInfo.css';

interface StarInfoProps {
  star: Star | null;
}

export function StarInfo({ star }: StarInfoProps) {
  if (!star) return null;

  const formatMagnitude = (mag: number) => mag.toFixed(2);
  
  const getSpectralType = (ci: number) => {
    if (ci < -0.3) return 'O (Blue)';
    if (ci < -0.02) return 'B (Blue-White)';
    if (ci < 0.3) return 'A (White)';
    if (ci < 0.58) return 'F (Yellow-White)';
    if (ci < 0.81) return 'G (Yellow)';
    if (ci < 1.4) return 'K (Orange)';
    return 'M (Red)';
  };

  return (
    <div className="star-info-panel">
      <div className="star-info-header">
        {star.proper || star.bayer || `HYG ${star.id}`}
      </div>
      
      <div className="star-info-rows">
        {star.proper && star.bayer && (
          <div className="star-info-row">
            <span className="star-info-label">Designation</span>
            <span className="star-info-value">{star.bayer}</span>
          </div>
        )}
        
        {star.constellation && (
          <div className="star-info-row">
            <span className="star-info-label">Constellation</span>
            <span className="star-info-value">{star.constellation}</span>
          </div>
        )}
        
        <div className="star-info-row">
          <span className="star-info-label">Magnitude</span>
          <span className="star-info-value">{formatMagnitude(star.mag)}</span>
        </div>
        
        <div className="star-info-row">
          <span className="star-info-label">Spectral</span>
          <span className="star-info-value">{getSpectralType(star.ci)}</span>
        </div>
        
        <div className="star-info-row">
          <span className="star-info-label">RA / Dec</span>
          <span className="star-info-value">
            {star.ra.toFixed(2)}h / {star.dec.toFixed(1)}°
          </span>
        </div>
      </div>
    </div>
  );
}
