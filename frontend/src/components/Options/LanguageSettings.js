import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

function LanguageSettings() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="settings-section">
      <h3>{t('lang.title')}</h3>
      <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{t('lang.desc')}</p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          className={`btn ${language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setLanguage('en')}
        >
          🇬🇧 English
        </button>
        <button
          className={`btn ${language === 'ka' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setLanguage('ka')}
        >
          🇬🇪 ქართული
        </button>
      </div>
    </div>
  );
}

export default LanguageSettings;
