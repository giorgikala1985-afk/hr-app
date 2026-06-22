import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import QuickUnitModal from './QuickUnitModal';

const HIDDEN_PATHS = ['/login', '/signup', '/register', '/sign'];

export default function FloatingQuickAdd() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return null;
  if (HIDDEN_PATHS.some(p => location.pathname.startsWith(p))) return null;
  if (location.pathname.startsWith('/portal')) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="New Order"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          background: '#3b82f6',
          color: '#fff',
          fontSize: 26,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(59,130,246,0.45)',
          zIndex: 890,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(59,130,246,0.6)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.45)'; }}
      >
        +
      </button>

      {open && <QuickUnitModal onClose={() => setOpen(false)} />}
    </>
  );
}
