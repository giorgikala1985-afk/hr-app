import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import QuickUnitModal from './QuickUnitModal';
import QuickFireModal from './QuickFireModal';
import QuickPromoteModal from './QuickPromoteModal';
import QuickTransferModal from './QuickTransferModal';
import './FloatingQuickAdd.css';

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

// Stack straight up above the button — the item closest to the button
// (last in the array) unfolds first, the farthest last, so it reads as
// the stack "growing" outward rather than everything popping at once.
// The closest item is offset by the button's own size + a gap, not just
// one item-height, otherwise it sits underneath the (taller) button.
const BUTTON_SIZE = 52;
const BUTTON_GAP = 12;
const ITEM_HEIGHT = 46;
const fanPosition = (i, total) => {
  const distanceFromButton = total - 1 - i; // 0 = closest item
  const ty = -(BUTTON_SIZE + BUTTON_GAP + distanceFromButton * ITEM_HEIGHT);
  return { '--tx': '0px', '--ty': `${ty}px`, '--delay': `${distanceFromButton * 50}ms` };
};

export default function FloatingQuickAdd() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const checkboxRef = useRef(null);
  const [activeModal, setActiveModal] = useState(null);

  if (!user) return null;
  if (HIDDEN_PATHS.some(p => location.pathname.startsWith(p))) return null;
  if (location.pathname.startsWith('/portal')) return null;

  const closeModal = () => setActiveModal(null);
  const closeMenu = () => { if (checkboxRef.current) checkboxRef.current.checked = false; };

  const handleItemClick = (key) => {
    closeMenu();
    if (key === 'hire') {
      navigate('/finances?tab=orders', { state: { openHire: true } });
      return;
    }
    setActiveModal(key);
  };

  return (
    <>
      {/* Hidden checkbox drives every visual: open/close, fan-out, icon
          rotation — all pure CSS via :checked sibling selectors below. */}
      <input ref={checkboxRef} type="checkbox" id="fab-toggle" className="fab-checkbox" aria-label="Quick Orders" />

      {MENU_ITEMS.map((item, i) => (
        <button
          key={item.key}
          className="fab-item"
          style={{ ...fanPosition(i, MENU_ITEMS.length), color: item.color }}
          onClick={() => handleItemClick(item.key)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}

      <label htmlFor="fab-toggle" className="fab-overlay" />
      <label htmlFor="fab-toggle" className="fab-label" title="Quick Orders">
        <svg className="fab-icon" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect x="10" y="4" width="4" height="16" rx="2" fill="currentColor" />
          <rect x="4" y="10" width="16" height="4" rx="2" fill="currentColor" />
        </svg>
      </label>

      {activeModal === 'fire' && <QuickFireModal onClose={closeModal} />}
      {activeModal === 'promote' && <QuickPromoteModal onClose={closeModal} />}
      {activeModal === 'adjust' && <QuickUnitModal onClose={closeModal} />}
      {activeModal === 'transfer' && <QuickTransferModal onClose={closeModal} />}
    </>
  );
}
