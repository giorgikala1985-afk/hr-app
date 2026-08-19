import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import QuickUnitModal from './QuickUnitModal';
import QuickFireModal from './QuickFireModal';
import QuickPromoteModal from './QuickPromoteModal';
import QuickTransferModal from './QuickTransferModal';

const HIDDEN_PATHS = ['/login', '/signup', '/register', '/sign'];

const MENU_ITEMS = [
  { key: 'hire', label: 'Hire', color: '#479c73', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  )},
  { key: 'fire', label: 'Fire', color: '#ef4444', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  )},
  { key: 'promote', label: 'Promote', color: '#f59e0b', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
    </svg>
  )},
  { key: 'adjust', label: 'Adjust', color: '#06b6d4', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  )},
  { key: 'transfer', label: 'Transfer', color: '#3b82f6', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  )},
];

export default function FloatingQuickAdd() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  if (!user) return null;
  if (HIDDEN_PATHS.some(p => location.pathname.startsWith(p))) return null;
  if (location.pathname.startsWith('/portal')) return null;

  const closeModal = () => setActiveModal(null);

  const handleItemClick = (key) => {
    setMenuOpen(false);
    if (key === 'hire') {
      navigate('/finances?tab=orders', { state: { openHire: true } });
      return;
    }
    setActiveModal(key);
  };

  return (
    <>
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 889 }} onClick={() => setMenuOpen(false)} />
      )}

      {menuOpen && (
        <div style={{
          position: 'fixed', bottom: 86, right: 24, zIndex: 890,
          display: 'flex', flexDirection: 'column', gap: 8,
          background: 'var(--surface)', border: '1px solid var(--border-2)',
          borderRadius: 12, padding: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        }}>
          {MENU_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => handleItemClick(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                borderRadius: 8, border: 'none', background: 'transparent',
                color: item.color, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setMenuOpen(v => !v)}
        title="Quick Orders"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: 14,
          border: 'none',
          background: '#4CAF50',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(76,175,80,0.45)',
          zIndex: 890,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(76,175,80,0.6)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(76,175,80,0.45)'; }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ transform: menuOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <rect x="10" y="4" width="4" height="16" rx="2" fill="currentColor" />
          <rect x="4" y="10" width="16" height="4" rx="2" fill="currentColor" />
        </svg>
      </button>

      {activeModal === 'fire' && <QuickFireModal onClose={closeModal} />}
      {activeModal === 'promote' && <QuickPromoteModal onClose={closeModal} />}
      {activeModal === 'adjust' && <QuickUnitModal onClose={closeModal} />}
      {activeModal === 'transfer' && <QuickTransferModal onClose={closeModal} />}
    </>
  );
}
