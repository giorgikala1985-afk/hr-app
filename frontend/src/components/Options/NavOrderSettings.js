import React, { useState, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export const NAV_ORDER_KEY = 'nav_order';
export const NAV_KEYS_DEFAULT = ['home', 'analytics', 'documents', 'accounting', 'options'];

export function loadNavOrder() {
  try {
    const saved = localStorage.getItem(NAV_ORDER_KEY);
    if (!saved) return [...NAV_KEYS_DEFAULT];
    const parsed = JSON.parse(saved);
    const valid = NAV_KEYS_DEFAULT.filter(k => parsed.includes(k));
    valid.sort((a, b) => parsed.indexOf(a) - parsed.indexOf(b));
    NAV_KEYS_DEFAULT.forEach(k => { if (!valid.includes(k)) valid.push(k); });
    return valid;
  } catch {
    return [...NAV_KEYS_DEFAULT];
  }
}

const NAV_ICONS = {
  home: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  employees: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  analytics: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  documents: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  accounting: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  options: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
};

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: '#c4c9d4', flexShrink: 0 }}>
      <circle cx="4.5" cy="2.5" r="1.3"/><circle cx="9.5" cy="2.5" r="1.3"/>
      <circle cx="4.5" cy="7" r="1.3"/><circle cx="9.5" cy="7" r="1.3"/>
      <circle cx="4.5" cy="11.5" r="1.3"/><circle cx="9.5" cy="11.5" r="1.3"/>
    </svg>
  );
}

function NavOrderSettings() {
  const { t } = useLanguage();
  const [order, setOrder] = useState(loadNavOrder);
  const [dragOver, setDragOver] = useState(null);
  const dragIdx = useRef(null);

  const saveOrder = (newOrder) => {
    setOrder(newOrder);
    try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(newOrder)); } catch {}
    window.dispatchEvent(new Event('nav_order_changed'));
  };

  const onDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(idx);
  };

  const onDrop = (e, toIdx) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === toIdx) { setDragOver(null); return; }
    const newOrder = [...order];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    saveOrder(newOrder);
    dragIdx.current = null;
    setDragOver(null);
  };

  const onDragEnd = () => { setDragOver(null); dragIdx.current = null; };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        {t('options.navOrder')}
      </h2>
      <p className="acc-subtitle">Drag items to reorder the navigation menu. Changes apply immediately.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 400, marginBottom: 24 }}>
        {order.map((key, idx) => {
          const isOver = dragOver === idx;
          return (
            <div
              key={key}
              draggable
              onDragStart={e => onDragStart(e, idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDrop={e => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: isOver ? '#eff6ff' : 'white',
                border: `1.5px solid ${isOver ? '#3185FC' : '#e5e7eb'}`,
                borderRadius: 9,
                cursor: 'grab',
                userSelect: 'none',
                transition: 'border-color 0.12s, background 0.12s, transform 0.1s',
                transform: isOver ? 'scale(1.01)' : 'scale(1)',
                boxShadow: isOver ? '0 4px 12px rgba(49,133,252,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <GripIcon />
              <span style={{ color: isOver ? '#2563eb' : '#6b7280', display: 'flex', alignItems: 'center' }}>
                {NAV_ICONS[key]}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: isOver ? '#1d4ed8' : '#111827', flex: 1 }}>
                {t(`nav.${key}`)}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: isOver ? '#3185FC' : '#d1d5db',
                background: isOver ? '#dbeafe' : '#f9fafb',
                border: `1px solid ${isOver ? '#bfdbfe' : '#e5e7eb'}`,
                borderRadius: 5, padding: '2px 7px',
                transition: 'all 0.12s',
              }}>
                {idx + 1}
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => saveOrder([...NAV_KEYS_DEFAULT])}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 16px', background: 'white',
          border: '1.5px solid #e5e7eb', borderRadius: 7,
          fontSize: 13, fontWeight: 500, color: '#374151',
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#d1d5db'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-3.67"/>
        </svg>
        Reset to default
      </button>
    </div>
  );
}

export default NavOrderSettings;
