import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 300];

function getPaginationSettings() {
  try {
    const saved = localStorage.getItem('pagination_settings');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { enabled: false, pageSize: 50 };
}

function PaginationSettings() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(getPaginationSettings);

  const save = (next) => {
    setSettings(next);
    localStorage.setItem('pagination_settings', JSON.stringify(next));
    window.dispatchEvent(new Event('pagination-changed'));
  };

  const toggleEnabled = () => {
    save({ ...settings, enabled: !settings.enabled });
  };

  const changeSize = (size) => {
    save({ ...settings, pageSize: size });
  };

  return (
    <div className="pagination-settings">
      <h3>{t('pagination.title')}</h3>
      <p className="pagination-desc">
        {t('pagination.desc')}
      </p>

      <div className="pagination-toggle-row">
        <span className="pagination-toggle-label">{t('pagination.enable')}</span>
        <button
          className={`pagination-toggle ${settings.enabled ? 'pagination-toggle-on' : ''}`}
          onClick={toggleEnabled}
        >
          <span className="pagination-toggle-knob" />
        </button>
      </div>

      {settings.enabled && (
        <div className="pagination-size-section">
          <span className="pagination-size-label">{t('pagination.rowsPerPage')}</span>
          <div className="pagination-size-options">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                className={`pagination-size-btn ${settings.pageSize === size ? 'active' : ''}`}
                onClick={() => changeSize(size)}
              >
                {size}
              </button>
            ))}
            <button
              className={`pagination-size-btn ${settings.pageSize === 'all' ? 'active' : ''}`}
              onClick={() => changeSize('all')}
            >
              {t('pagination.all')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaginationSettings;
