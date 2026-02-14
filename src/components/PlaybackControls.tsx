import './PlaybackControls.css';

interface PlaybackControlsProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const SPEED_LABELS: Record<number, string> = {
  [-3600]: '-1h/s',
  [-600]: '-10m/s',
  [-60]: '-1m/s',
  [-10]: '-10s/s',
  [-1]: '-1s/s',
  0: 'PAUSED',
  1: '1s/s',
  10: '10s/s',
  60: '1m/s',
  600: '10m/s',
  3600: '1h/s',
};

const SPEEDS = [-3600, -600, -60, -10, -1, 0, 1, 10, 60, 600, 3600];

export function PlaybackControls({ speed, onSpeedChange }: PlaybackControlsProps) {
  const handleReverse = () => {
    if (speed > 0) {
      // If going forward, switch to reverse at same magnitude
      onSpeedChange(-speed);
    } else if (speed === 0) {
      // If paused, start reverse at 1x
      onSpeedChange(-1);
    } else {
      // If already reversing, go faster
      const currentIdx = SPEEDS.indexOf(speed);
      if (currentIdx > 0) {
        onSpeedChange(SPEEDS[currentIdx - 1]);
      }
    }
  };

  const handlePause = () => {
    onSpeedChange(0);
  };

  const handleForward = () => {
    if (speed < 0) {
      // If going reverse, switch to forward at same magnitude
      onSpeedChange(-speed);
    } else if (speed === 0) {
      // If paused, start forward at 1x
      onSpeedChange(1);
    } else {
      // If already going forward, go faster
      const currentIdx = SPEEDS.indexOf(speed);
      if (currentIdx < SPEEDS.length - 1) {
        onSpeedChange(SPEEDS[currentIdx + 1]);
      }
    }
  };

  const speedLabel = SPEED_LABELS[speed] || `${speed}x`;

  return (
    <div className="playback-controls">
      <button 
        className={`playback-btn reverse ${speed < 0 ? 'active' : ''}`}
        onClick={handleReverse}
        title="Reverse (click multiple times to speed up)"
      >
        ◀◀
      </button>
      <button 
        className={`playback-btn pause ${speed === 0 ? 'active' : ''}`}
        onClick={handlePause}
        title="Pause"
      >
        ⏸
      </button>
      <button 
        className={`playback-btn forward ${speed > 0 ? 'active' : ''}`}
        onClick={handleForward}
        title="Forward (click multiple times to speed up)"
      >
        ▶▶
      </button>
      <div className="playback-speed">{speedLabel}</div>
    </div>
  );
}
