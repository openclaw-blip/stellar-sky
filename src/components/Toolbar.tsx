import { useState } from 'react';
import './Toolbar.css';

export interface ToolbarOptions {
  showAltAzGrid: boolean;
  showEquatorialGrid: boolean;
  showHorizon: boolean;
  showCardinals: boolean;
  lightMode: boolean;
}

interface ToolbarProps {
  options: ToolbarOptions;
  onOptionsChange: (options: ToolbarOptions) => void;
}

export function Toolbar({ options, onOptionsChange }: ToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggle = (key: keyof ToolbarOptions) => {
    onOptionsChange({ ...options, [key]: !options[key] });
  };

  return (
    <div className={`toolbar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button 
        className="toolbar-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? 'Collapse' : 'Expand'}
      >
        {isExpanded ? '◀' : '▶'}
      </button>
      
      {isExpanded && (
        <div className="toolbar-content">
          <div className="toolbar-section">
            <div className="toolbar-section-title">Display</div>
            
            <label className="toolbar-option">
              <input
                type="checkbox"
                checked={options.lightMode}
                onChange={() => toggle('lightMode')}
              />
              <span className="option-icon">☀</span>
              <span className="option-label">Light Mode</span>
            </label>
          </div>
          
          <div className="toolbar-section">
            <div className="toolbar-section-title">Grid Overlays</div>
            
            <label className="toolbar-option">
              <input
                type="checkbox"
                checked={options.showAltAzGrid}
                onChange={() => toggle('showAltAzGrid')}
              />
              <span className="option-icon">◎</span>
              <span className="option-label">Alt/Az Grid</span>
            </label>
            
            <label className="toolbar-option">
              <input
                type="checkbox"
                checked={options.showEquatorialGrid}
                onChange={() => toggle('showEquatorialGrid')}
              />
              <span className="option-icon">⊕</span>
              <span className="option-label">RA/Dec Grid</span>
            </label>
            
            <label className="toolbar-option">
              <input
                type="checkbox"
                checked={options.showHorizon}
                onChange={() => toggle('showHorizon')}
              />
              <span className="option-icon">―</span>
              <span className="option-label">Horizon Line</span>
            </label>
            
            <label className="toolbar-option">
              <input
                type="checkbox"
                checked={options.showCardinals}
                onChange={() => toggle('showCardinals')}
              />
              <span className="option-icon">✦</span>
              <span className="option-label">Cardinal Points</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
