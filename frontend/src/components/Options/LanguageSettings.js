import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const LANGS = [
  { code: 'en', label: 'English',   sub: 'English',    flag: 'https://flagcdn.com/w40/gb.png', alt: 'GB' },
  { code: 'ka', label: 'ქართული',  sub: 'Georgian',   flag: 'https://flagcdn.com/w40/ge.png', alt: 'GE' },
];

function LanguageSettings() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="settings-section">
      <h3>{t('lang.title')}</h3>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{t('lang.desc')}</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {LANGS.map(lang => {
          const isActive = language === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px',
                border: `2px solid ${isActive ? '#2563eb' : '#e5e7eb'}`,
                borderRadius: 10,
                background: isActive ? '#eff6ff' : 'white',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
              }}
            >
              <img
                src={lang.flag}
                alt={lang.alt}
                width="32"
                height="22"
                style={{ borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.18)', display: 'block' }}
              />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? '#1d4ed8' : '#111827' }}>{lang.label}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{lang.sub}</div>
              </div>
              {isActive && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default LanguageSettings;
