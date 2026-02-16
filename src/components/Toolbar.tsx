import './Toolbar.css';

export interface ToolbarOptions {
  showAltAzGrid: boolean;
  showEquatorialGrid: boolean;
  showConstellations: boolean;
  showHorizon: boolean;
  showCardinals: boolean;
  lightMode: boolean;
  nightMode: boolean;
  pixelStars: boolean;
}

interface ToolbarProps {
  options: ToolbarOptions;
  onOptionsChange: (options: ToolbarOptions) => void;
  onSearch: () => void;
}

interface ToolbarButton {
  key: keyof ToolbarOptions;
  icon: string;
  label: string;
}

const buttons: ToolbarButton[] = [
  { key: 'lightMode', icon: '☀', label: 'Light Mode' },
  { key: 'nightMode', icon: '🔴', label: 'Night Mode' },
  { key: 'pixelStars', icon: '▪', label: 'Pixel Stars' },
  { key: 'showAltAzGrid', icon: '◎', label: 'Alt/Az Grid' },
  { key: 'showEquatorialGrid', icon: '⊕', label: 'RA/Dec Grid' },
  { key: 'showConstellations', icon: '✧', label: 'Constellations' },
  { key: 'showHorizon', icon: '―', label: 'Horizon Line' },
  { key: 'showCardinals', icon: '✦', label: 'Cardinal Points' },
];

export function Toolbar({ options, onOptionsChange, onSearch }: ToolbarProps) {
  const toggle = (key: keyof ToolbarOptions) => {
    onOptionsChange({ ...options, [key]: !options[key] });
  };

  return (
    <div className="toolbar">
      <button
        className="toolbar-btn search-btn"
        onClick={onSearch}
        title="Search"
      >
        🔍
      </button>
      <div className="toolbar-divider" />
      {buttons.map(({ key, icon, label }) => (
        <button
          key={key}
          className={`toolbar-btn ${options[key] ? 'active' : ''}`}
          onClick={() => toggle(key)}
          title={label}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
