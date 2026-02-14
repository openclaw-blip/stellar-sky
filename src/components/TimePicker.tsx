import { useState, useCallback, useEffect } from 'react';
import './TimePicker.css';

interface TimePickerProps {
  date: Date;
  onDateChange: (date: Date) => void;
  isRealtime: boolean;
  onRealtimeChange: (realtime: boolean) => void;
}

export function TimePicker({ date, onDateChange, isRealtime, onRealtimeChange }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');

  useEffect(() => {
    // Format date for input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    setDateInput(`${year}-${month}-${day}`);
    setTimeInput(`${hours}:${minutes}`);
  }, [date]);

  const handleApply = useCallback(() => {
    const [year, month, day] = dateInput.split('-').map(Number);
    const [hours, minutes] = timeInput.split(':').map(Number);
    
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes)) {
      const newDate = new Date(year, month - 1, day, hours, minutes);
      onDateChange(newDate);
      onRealtimeChange(false);
      setIsOpen(false);
    }
  }, [dateInput, timeInput, onDateChange, onRealtimeChange]);

  const handleNow = useCallback(() => {
    onDateChange(new Date());
    onRealtimeChange(true);
    setIsOpen(false);
  }, [onDateChange, onRealtimeChange]);

  const handleTimeShift = useCallback((hours: number) => {
    const newDate = new Date(date.getTime() + hours * 60 * 60 * 1000);
    onDateChange(newDate);
    onRealtimeChange(false);
  }, [date, onDateChange, onRealtimeChange]);

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="time-picker">
      <button 
        className="time-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="time-display">
          {formatTime(date)}
        </span>
        <span className="date-display">
          {formatDate(date)}
        </span>
        {isRealtime && <span className="realtime-badge">LIVE</span>}
      </button>

      {isOpen && (
        <div className="time-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="time-modal" onClick={e => e.stopPropagation()}>
            <div className="time-header">
              <h3>Set Date & Time</h3>
              <button className="close-button" onClick={() => setIsOpen(false)}>×</button>
            </div>

            <div className="time-inputs">
              <div className="time-field">
                <label>Date</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                />
              </div>
              <div className="time-field">
                <label>Time</label>
                <input
                  type="time"
                  value={timeInput}
                  onChange={e => setTimeInput(e.target.value)}
                />
              </div>
            </div>

            <div className="time-actions">
              <button className="apply-button" onClick={handleApply}>
                Apply
              </button>
              <button className="now-button" onClick={handleNow}>
                🔴 Now (Live)
              </button>
            </div>

            <div className="time-shortcuts">
              <div className="shortcuts-label">Quick Adjust:</div>
              <div className="shortcut-buttons">
                <button onClick={() => handleTimeShift(-6)}>-6h</button>
                <button onClick={() => handleTimeShift(-1)}>-1h</button>
                <button onClick={() => handleTimeShift(1)}>+1h</button>
                <button onClick={() => handleTimeShift(6)}>+6h</button>
                <button onClick={() => handleTimeShift(12)}>+12h</button>
                <button onClick={() => handleTimeShift(24)}>+24h</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
