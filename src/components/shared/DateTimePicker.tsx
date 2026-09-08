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
  const today = new Date().toISOString().split('T')[0];
  const max = maxDate || today;

  // Split ISO into date and time parts for the two inputs
  const dateVal = value ? value.substring(0, 10) : today;
  const timeVal = value ? value.substring(11, 16) : new Date().toTimeString().substring(0, 5);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    onChange(`${newDate}T${timeVal}:00.000Z`);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    onChange(`${dateVal}T${newTime}:00.000Z`);
  };

  const isModified = dateVal !== today;

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
