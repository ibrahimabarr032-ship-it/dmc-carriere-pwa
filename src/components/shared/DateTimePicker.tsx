import React from 'react';

interface DateTimePickerProps {
  value: string; // ISO datetime string
  onChange: (isoValue: string) => void;
  label?: string;
  maxDate?: string; // YYYY-MM-DD, defaults to today
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  label = 'Date & Heure du passage',
  maxDate
}) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const now = new Date();
  const localToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const max = maxDate || localToday;

  const dateObj = value ? new Date(value) : now;
  const dateVal = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  const timeVal = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    const [y, m, d] = newDate.split('-').map(Number);
    const [hh, mm] = timeVal.split(':').map(Number);
    const updated = new Date(y, m - 1, d, hh, mm);
    onChange(updated.toISOString());
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    const [y, m, d] = dateVal.split('-').map(Number);
    const [hh, mm] = newTime.split(':').map(Number);
    const updated = new Date(y, m - 1, d, hh, mm);
    onChange(updated.toISOString());
  };

  const isModified = dateVal !== localToday;

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label htmlFor="datetime-date-input" style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        fontSize: '0.82rem', fontWeight: 700, color: '#334155',
        marginBottom: '0.4rem'
      }}>
        🕐 {label}
        {isModified && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700,
            backgroundColor: '#fef3c7', color: '#b45309',
            padding: '0.1rem 0.45rem', borderRadius: '999px',
            border: '1px solid #fde68a'
          }}>
            ⚠ Date modifiée
          </span>
        )}
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
        <input
          id="datetime-date-input"
          aria-label="Date du passage"
          type="date"
          value={dateVal}
          max={max}
          onChange={handleDateChange}
          className="input-field"
          style={{ fontSize: '0.88rem' }}
        />
        <input
          aria-label="Heure du passage"
          type="time"
          value={timeVal}
          onChange={handleTimeChange}
          className="input-field"
          style={{ fontSize: '0.88rem', width: '110px' }}
        />
      </div>
      {isModified && (
        <div style={{
          marginTop: '0.35rem', fontSize: '0.75rem', color: '#b45309',
          display: 'flex', alignItems: 'center', gap: '0.3rem'
        }}>
          ℹ️ Cette action sera comptée dans l'historique du <strong>{new Date(dateVal).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        </div>
      )}
    </div>
  );
};
