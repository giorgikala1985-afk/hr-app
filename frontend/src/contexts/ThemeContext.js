import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

const BG_KEY = 'app-bg-color';

const FONT_BASE_KEY = 'app-font-base';
const FONT_MONO_KEY = 'app-font-mono';

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
  const [bgColor, setBgColorState] = useState(() => localStorage.getItem(BG_KEY) || '');
  const [fontBase, setFontBaseState] = useState(() => localStorage.getItem(FONT_BASE_KEY) || 'Lexend');
  const [fontMono, setFontMonoState] = useState(() => localStorage.getItem(FONT_MONO_KEY) || 'default');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (bgColor) {
      document.documentElement.style.setProperty('--bg', bgColor);
      localStorage.setItem(BG_KEY, bgColor);
    } else {
      document.documentElement.style.removeProperty('--bg');
      localStorage.removeItem(BG_KEY);
    }
  }, [bgColor]);

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

  const setBgColor = (color) => setBgColorState(color);
  const resetBgColor = () => setBgColorState('');
  const setFontBase = (font) => setFontBaseState(font);
  const setFontMono = (font) => setFontMonoState(font);

  return (
    <ThemeContext.Provider value={{ 
      theme, toggleTheme, 
      bgColor, setBgColor, resetBgColor,
      fontBase, setFontBase,
      fontMono, setFontMono
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
