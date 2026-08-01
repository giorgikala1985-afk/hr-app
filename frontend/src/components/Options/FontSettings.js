import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const BASE_FONTS = [
  { label: 'Lexend (Default)', value: 'Lexend' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans' },
  { label: 'Roboto', value: 'Roboto' },
];

const MONO_FONTS = [
  { label: 'Default Monospace', value: 'default' },
  { label: 'IBM Plex Sans', value: 'IBM Plex Sans' },
  { label: 'Public Sans', value: 'Public Sans' },
  { label: 'Source Sans 3', value: 'Source Sans 3' },
  { label: 'Product Sans', value: 'Product Sans', local: true },
];

export default function FontSettings() {
  const { fontBase, setFontBase, fontMono, setFontMono } = useTheme();

  return (
    <div style={{ maxWidth: 560, padding: '32px 0', borderTop: '1px solid var(--border)', marginTop: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
        Typography
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 28px' }}>
        Customize the fonts used throughout the application.
      </p>

      {/* Base Font */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', margin: '0 0 10px' }}>
          Base Font
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {BASE_FONTS.map(({ label, value }) => {
            const isActive = fontBase === value;
            return (
              <button
                key={value}
                onClick={() => setFontBase(value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: isActive ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                  background: isActive ? 'var(--surface-3)' : 'var(--surface)',
                  color: isActive ? 'var(--accent)' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 14,
                  transition: 'all 0.15s',
                  fontFamily: value === 'Lexend' ? 'inherit' : `'${value}', sans-serif`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monospace Font */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', margin: '0 0 10px' }}>
          Numbers Font
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {MONO_FONTS.map(({ label, value, local }) => {
            const isActive = fontMono === value;
            return (
              <button
                key={value}
                onClick={() => setFontMono(value)}
                title={local ? 'Only renders if this font is already installed on your device — Google doesn\'t publish it for web use.' : undefined}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: isActive ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                  background: isActive ? 'var(--surface-3)' : 'var(--surface)',
                  color: isActive ? 'var(--accent)' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 14,
                  transition: 'all 0.15s',
                  fontFamily: value === 'default' ? 'var(--font-mono)' : `'${value}', sans-serif`,
                }}
              >
                {label}{local && <span style={{ opacity: 0.6, fontWeight: 400 }}> *</span>}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
          Used for tabular data like salaries, account numbers, and rates.
          {' '}* Product Sans isn't distributed by Google Fonts, so it only appears if it's already installed on your device — otherwise this falls back to the default automatically.
        </p>
      </div>
      
    </div>
  );
}
