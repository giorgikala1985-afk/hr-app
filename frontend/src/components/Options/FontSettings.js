import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const BASE_FONTS_EN = [
  { label: 'Lexend (Default)', value: 'Lexend' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Product Sans', value: 'Product Sans', local: true },
];

// Google Fonts only publishes two font families with real Georgian glyph
// coverage — every Latin font above (and Product Sans) has zero Georgian
// glyphs and would silently fall back, so the Georgian list is intentionally
// short rather than padded with fonts that wouldn't actually render.
const BASE_FONTS_KA = [
  { label: 'Noto Sans Georgian (Default)', value: 'Noto Sans Georgian' },
  { label: 'Noto Serif Georgian', value: 'Noto Serif Georgian' },
];

const MONO_FONTS_EN = [
  { label: 'Default Monospace', value: 'default' },
  { label: 'IBM Plex Sans', value: 'IBM Plex Sans' },
  { label: 'Public Sans', value: 'Public Sans' },
  { label: 'Source Sans 3', value: 'Source Sans 3' },
  { label: 'Product Sans', value: 'Product Sans', local: true },
];

const MONO_FONTS_KA = [
  { label: 'Noto Sans Georgian (Default)', value: 'Noto Sans Georgian' },
  { label: 'Noto Serif Georgian', value: 'Noto Serif Georgian' },
];

function FontButtonGroup({ options, activeValue, onSelect }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {options.map(({ label, value, local }) => {
        const isActive = activeValue === value;
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
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
              fontFamily: value === 'Lexend' || value === 'default' ? 'inherit' : `'${value}', sans-serif`,
            }}
          >
            {label}{local && <span style={{ opacity: 0.6, fontWeight: 400 }}> *</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function FontSettings() {
  const { fontBase, setFontBase, fontMono, setFontMono } = useTheme();
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  const baseFonts = isGeorgian ? BASE_FONTS_KA : BASE_FONTS_EN;
  const monoFonts = isGeorgian ? MONO_FONTS_KA : MONO_FONTS_EN;
  const hasLocalOption = !isGeorgian;

  return (
    <div style={{ maxWidth: 560, padding: '32px 0', borderTop: '1px solid var(--border)', marginTop: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
        Typography
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 28px' }}>
        Customize the fonts used throughout the application.
        {isGeorgian && ' Showing Georgian-script fonts since the app language is currently set to ქართული.'}
      </p>

      {/* Base Font */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', margin: '0 0 10px' }}>
          Base Font
        </p>
        <FontButtonGroup options={baseFonts} activeValue={fontBase} onSelect={setFontBase} />
        {hasLocalOption && (
          <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
            * Product Sans isn't distributed by Google Fonts, so it only appears if it's already installed on your device — otherwise this falls back to the default automatically.
          </p>
        )}
      </div>

      {/* Monospace Font */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', margin: '0 0 10px' }}>
          Numbers Font
        </p>
        <FontButtonGroup options={monoFonts} activeValue={fontMono} onSelect={setFontMono} />
        <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
          Used for tabular data like salaries, account numbers, and rates.
          {hasLocalOption && ' * Product Sans isn\'t distributed by Google Fonts, so it only appears if it\'s already installed on your device — otherwise this falls back to the default automatically.'}
        </p>
      </div>

    </div>
  );
}
