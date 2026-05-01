import React, { useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const LIGHT_PRESETS = [
  { label: 'Default',     color: '#f4f6fa' },
  { label: 'White',       color: '#ffffff' },
  { label: 'Warm',        color: '#faf9f7' },
  { label: 'Cool Gray',   color: '#f1f5f9' },
  { label: 'Blue',        color: '#eff6ff' },
  { label: 'Purple',      color: '#f5f3ff' },
  { label: 'Green',       color: '#f0fdf4' },
  { label: 'Peach',       color: '#fff7ed' },
  { label: 'Rose',        color: '#fff1f2' },
  { label: 'Slate',       color: '#f8fafc' },
];

const DARK_PRESETS = [
  { label: 'Default',     color: '#080e1c' },
  { label: 'Pitch',       color: '#000000' },
  { label: 'Charcoal',    color: '#0f0f0f' },
  { label: 'Navy',        color: '#060d1e' },
  { label: 'Deep Blue',   color: '#050d1f' },
  { label: 'Dark Slate',  color: '#0d1117' },
  { label: 'Dark Teal',   color: '#061a17' },
  { label: 'Dark Brown',  color: '#120c08' },
];

export default function BgColorSettings() {
  const { theme, bgColor, setBgColor, resetBgColor } = useTheme();
  const pickerRef = useRef();

  const presets = theme === 'dark' ? DARK_PRESETS : LIGHT_PRESETS;
  const defaultColor = theme === 'dark' ? '#080e1c' : '#f4f6fa';
  const activeColor = bgColor || defaultColor;

  return (
    <div style={{ maxWidth: 560, padding: '32px 0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
        Background Color
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 28px' }}>
        Customize the background color of the app.
      </p>

      {/* Presets */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', margin: '0 0 10px' }}>
        Presets
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
        {presets.map(({ label, color }) => {
          const isActive = activeColor.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              onClick={() => setBgColor(color)}
              title={label}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: isActive ? '2.5px solid var(--accent)' : '1.5px solid var(--border)',
                background: color,
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.15)' : '0 1px 3px rgba(0,0,0,0.08)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                flexShrink: 0,
                padding: 0,
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={theme === 'dark' ? '#fff' : '#1e3a8a'} strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom color */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', margin: '0 0 10px' }}>
        Custom Color
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div
          onClick={() => pickerRef.current?.click()}
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: activeColor,
            border: '1.5px solid var(--border)',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        />
        <input
          ref={pickerRef}
          type="color"
          value={activeColor}
          onChange={e => setBgColor(e.target.value)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace' }}>
            {activeColor.toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
            Click the swatch to open the color picker
          </div>
        </div>
      </div>

      {/* Reset */}
      {bgColor && (
        <button
          onClick={resetBgColor}
          style={{
            padding: '7px 16px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--text-3)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-3)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          Reset to default
        </button>
      )}
    </div>
  );
}
