import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_LOGO_ID } from '../components/Options/logos';

const ThemeContext = createContext();

// Background color is stored per-theme so a dark custom color doesn't leak into
// light mode (and vice-versa). BG_KEY is the legacy single-value key.
const BG_KEY = 'app-bg-color';
const BG_KEY_LIGHT = 'app-bg-color-light';
const BG_KEY_DARK = 'app-bg-color-dark';
// Bump to force a one-time wipe of any stale/cross-theme background state.
const BG_MIGRATION_KEY = 'app-bg-migrated-v2';

const FONT_BASE_KEY = 'app-font-base';
const FONT_MONO_KEY = 'app-font-mono';

const LOGO_KEY = 'app-logo';

const GOOGLE_FONTS = {
  'Lexend': 'family=Lexend:wght@300;400;500;600;700',
  'Inter': 'family=Inter:wght@300;400;500;600;700',
  'Plus Jakarta Sans': 'family=Plus+Jakarta+Sans:wght@300;400;500;600;700',
  'Roboto': 'family=Roboto:wght@300;400;500;700',
  'IBM Plex Sans': 'family=IBM+Plex+Sans:wght@400;500;600;700',
  'Public Sans': 'family=Public+Sans:wght@400;500;600;700',
  'Source Sans 3': 'family=Source+Sans+3:wght@400;500;600;700',
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'light');
  // { light, dark } custom background colors. Empty string = use theme default.
  const [bgColors, setBgColors] = useState(() => {
    // Earlier builds stored one cross-theme background color, which could leak
    // between light/dark. The legacy value's intended theme is unknowable, so do a
    // one-time wipe of all background state to start per-theme storage cleanly.
    if (localStorage.getItem(BG_MIGRATION_KEY) !== '1') {
      localStorage.removeItem(BG_KEY);
      localStorage.removeItem(BG_KEY_LIGHT);
      localStorage.removeItem(BG_KEY_DARK);
      localStorage.setItem(BG_MIGRATION_KEY, '1');
      return { light: '', dark: '' };
    }
    return {
      light: localStorage.getItem(BG_KEY_LIGHT) || '',
      dark: localStorage.getItem(BG_KEY_DARK) || '',
    };
  });
  const bgColor = bgColors[theme] || '';
  const [fontBase, setFontBaseState] = useState(() => localStorage.getItem(FONT_BASE_KEY) || 'Lexend');
  const [fontMono, setFontMonoState] = useState(() => localStorage.getItem(FONT_MONO_KEY) || 'default');
  const [logo, setLogoState] = useState(() => localStorage.getItem(LOGO_KEY) || DEFAULT_LOGO_ID);

  useEffect(() => {
    localStorage.setItem(LOGO_KEY, logo);
  }, [logo]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Apply the custom color for the *current* theme, or fall back to the theme's
    // default (defined in CSS via [data-theme]) when none is set. Re-runs on theme
    // switch so a dark custom color never bleeds into light mode.
    const current = bgColors[theme];
    if (current) {
      document.documentElement.style.setProperty('--bg', current);
    } else {
      document.documentElement.style.removeProperty('--bg');
    }
    localStorage.setItem(BG_KEY_LIGHT, bgColors.light || '');
    localStorage.setItem(BG_KEY_DARK, bgColors.dark || '');
  }, [bgColors, theme]);

  useEffect(() => {
    // Load font families dynamically
    const loadFont = (fontName) => {
      if (!fontName || fontName === 'default' || !GOOGLE_FONTS[fontName]) return;
      const linkId = `font-${fontName.replace(/\s+/g, '-')}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?${GOOGLE_FONTS[fontName]}&display=swap`;
        document.head.appendChild(link);
      }
    };

    loadFont(fontBase);
    loadFont(fontMono);

    // Apply CSS variables
    document.documentElement.style.setProperty('--font-base', `'${fontBase}', 'Calibri', Calibri, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`);
    
    if (fontMono === 'default') {
      document.documentElement.style.setProperty('--font-mono', `'ui-monospace', 'Cascadia Code', 'SF Mono', 'Fira Mono', 'Menlo', 'Consolas', monospace`);
    } else {
      document.documentElement.style.setProperty('--font-mono', `'${fontMono}', 'ui-monospace', 'Cascadia Code', 'SF Mono', monospace`);
    }

    localStorage.setItem(FONT_BASE_KEY, fontBase);
    localStorage.setItem(FONT_MONO_KEY, fontMono);
  }, [fontBase, fontMono]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const setBgColor = (color) => setBgColors(prev => ({ ...prev, [theme]: color }));
  const resetBgColor = () => setBgColors(prev => ({ ...prev, [theme]: '' }));
  const setFontBase = (font) => setFontBaseState(font);
  const setFontMono = (font) => setFontMonoState(font);
  const setLogo = (id) => setLogoState(id);

  return (
    <ThemeContext.Provider value={{
      theme, toggleTheme,
      bgColor, setBgColor, resetBgColor,
      fontBase, setFontBase,
      fontMono, setFontMono,
      logo, setLogo
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
