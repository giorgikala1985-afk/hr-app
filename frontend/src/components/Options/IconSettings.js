import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export const MOTION_CANVAS_ICONS = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>
    </svg>
  ),
  employees: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3185FC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  documents: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9H8"/>
    </svg>
  ),
  accounting: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h.01"/><path d="M11 15h2"/>
    </svg>
  ),
  analytics: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  ),
  finbot: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2v3"/><circle cx="12" cy="5" r="1"/><path d="M8 11V9a4 4 0 0 1 8 0v2"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/><path d="M9 19h6"/>
    </svg>
  ),
  options: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  import: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  holidays: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
    </svg>
  ),
  insurance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  positions: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

function IconSettings() {
  const { t } = useLanguage();

  return (
    <div className="icon-settings">
      <div className="opt-section-title" style={{ marginBottom: 8 }}>Motion Canvas Icons</div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
        Preview and manage the modern icon set for your navigation tabs.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {Object.entries(MOTION_CANVAS_ICONS).map(([key, icon]) => (
          <div key={key} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            transition: 'transform 0.15s, box-shadow 0.15s',
            cursor: 'default'
          }} className="icon-preview-card">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              {icon}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', textTransform: 'capitalize' }}>
              {key}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: 20, background: 'rgba(99,102,241,0.05)', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)' }}>
        <h4 style={{ margin: '0 0 8px', color: '#6366f1' }}>Apply Style?</h4>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
          These icons follow the premium "Motion Canvas" design language with 1.8px stroke width and curated colors.
        </p>
        <button style={{
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: 8,
          fontWeight: 700,
          cursor: 'pointer'
        }} onClick={() => alert('Feature coming soon: Persist icon selection')}>
          Apply to All Tabs
        </button>
      </div>
      
      <style>{`
        .icon-preview-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
}

export default IconSettings;
