import React, { useState, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export const NAV_ORDER_KEY = 'nav_order';
export const NAV_KEYS_DEFAULT = ['home', 'analytics', 'documents', 'accounting', 'options'];

export const ACC_SIDEBAR_ORDER_KEY = 'acc_sidebar_order';
export const ACC_SIDEBAR_DEFAULT = ['bookkeeping', 'purchases', 'sales', 'invoices', 'salary-accrual', 'stock', 'calendar', 'transfers', 'banking', 'rsge'];

export const OPT_SIDEBAR_ORDER_KEY = 'opt_sidebar_order';
export const OPT_SIDEBAR_DEFAULT = ['holidays', 'info', 'pagination', 'tax', 'language', 'navorder', 'accounts', 'users', 'tools', 'about'];

export const DOCS_SIDEBAR_ORDER_KEY = 'docs_sidebar_order';
export const DOCS_SIDEBAR_DEFAULT = ['employees', 'agents', 'agreements', 'devices', 'nbg-rates', 'ai-agent', 'orders', 'importdata', 'datalake'];

export function loadNavOrder() {
  try {
    const saved = localStorage.getItem(NAV_ORDER_KEY);
    if (!saved) return [...NAV_KEYS_DEFAULT];
    const parsed = JSON.parse(saved);
    const valid = NAV_KEYS_DEFAULT.filter(k => parsed.includes(k));
    valid.sort((a, b) => parsed.indexOf(a) - parsed.indexOf(b));
    NAV_KEYS_DEFAULT.forEach(k => { if (!valid.includes(k)) valid.push(k); });
    return valid;
  } catch { return [...NAV_KEYS_DEFAULT]; }
}

export function loadSidebarOrder(key, defaults) {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return [...defaults];
    const parsed = JSON.parse(saved);
    const valid = defaults.filter(k => parsed.includes(k));
    valid.sort((a, b) => parsed.indexOf(a) - parsed.indexOf(b));
    defaults.forEach(k => { if (!valid.includes(k)) valid.push(k); });
    return valid;
  } catch { return [...defaults]; }
}

const NAV_ICONS = {
  home: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  analytics: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  documents: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
  accounting: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  options: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

const ACC_LABELS = {
  'bookkeeping': 'Bookkeeping', 'purchases': 'Purchases', 'sales': 'Sales',
  'invoices': 'Invoices', 'salary-accrual': 'Salaries', 'stock': 'Stock',
  'calendar': 'Calendar', 'transfers': 'Transfers', 'banking': 'TBC Bank', 'rsge': 'RS.ge',
};

const DOCS_LABELS = {
  'employees': 'Employees', 'agents': 'Agents', 'agreements': 'Agreements',
  'devices': 'Devices', 'nbg-rates': 'NBG Rates', 'ai-agent': 'FinBot',
  'orders': 'Orders', 'importdata': 'Import Data', 'datalake': 'Data Lake',
};

const OPT_LABELS = {
  'holidays': 'Holidays', 'info': 'Info', 'pagination': 'Pagination',
  'tax': 'Tax', 'language': 'Language', 'navorder': 'Navigation',
  'accounts': 'Accounts', 'users': 'Users & Roles', 'tools': 'Tools', 'about': 'About',
};

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
      <circle cx="4.5" cy="2.5" r="1.3"/><circle cx="9.5" cy="2.5" r="1.3"/>
      <circle cx="4.5" cy="7" r="1.3"/><circle cx="9.5" cy="7" r="1.3"/>
      <circle cx="4.5" cy="11.5" r="1.3"/><circle cx="9.5" cy="11.5" r="1.3"/>
    </svg>
  );
}

function DraggableList({ items, labels, icons, onSave }) {
  const [order, setOrder] = useState([...items]);
  const [dragOver, setDragOver] = useState(null);
  const dragIdx = useRef(null);

  const save = (newOrder) => {
    setOrder(newOrder);
    onSave(newOrder);
  };

  const onDragStart = (e, idx) => { dragIdx.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e, idx) => { e.preventDefault(); setDragOver(idx); };
  const onDrop = (e, toIdx) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === toIdx) { setDragOver(null); return; }
    const newOrder = [...order];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    save(newOrder);
    dragIdx.current = null;
    setDragOver(null);
  };
  const onDragEnd = () => { setDragOver(null); dragIdx.current = null; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 400 }}>
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
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: isOver ? 'rgba(59,130,246,0.1)' : 'var(--surface)',
              border: `1.5px solid ${isOver ? '#3b82f6' : 'var(--border-2)'}`,
              borderRadius: 9, cursor: 'grab', userSelect: 'none',
              transition: 'border-color 0.12s, background 0.12s',
              boxShadow: isOver ? '0 4px 12px rgba(59,130,246,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <GripIcon />
            {icons && <span style={{ color: isOver ? '#60a5fa' : 'var(--text-3)', display: 'flex', alignItems: 'center' }}>{icons[key]}</span>}
            <span style={{ fontSize: 14, fontWeight: 600, color: isOver ? '#60a5fa' : 'var(--text)', flex: 1 }}>
              {labels[key] || key}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: isOver ? '#60a5fa' : 'var(--text-3)',
              background: isOver ? 'rgba(59,130,246,0.15)' : 'var(--surface-2)',
              border: `1px solid ${isOver ? 'rgba(59,130,246,0.35)' : 'var(--border-2)'}`,
              borderRadius: 5, padding: '2px 7px',
            }}>{idx + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{subtitle}</div>
    </div>
  );
}

function ResetBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
        background: 'var(--surface)', border: '1.5px solid var(--border-2)', borderRadius: 7,
        fontSize: 13, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-3.67"/>
      </svg>
      Reset to default
    </button>
  );
}

function NavOrderSettings() {
  const { t } = useLanguage();
  const [navKey, setNavKey] = useState(0);
  const [accKey, setAccKey] = useState(0);
  const [optKey, setOptKey] = useState(0);
  const [docsKey, setDocsKey] = useState(0);

  const saveNav = (order) => {
    try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order)); } catch {}
    window.dispatchEvent(new Event('nav_order_changed'));
  };

  const saveAcc = (order) => {
    try { localStorage.setItem(ACC_SIDEBAR_ORDER_KEY, JSON.stringify(order)); } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: ACC_SIDEBAR_ORDER_KEY }));
  };

  const saveOpt = (order) => {
    try { localStorage.setItem(OPT_SIDEBAR_ORDER_KEY, JSON.stringify(order)); } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: OPT_SIDEBAR_ORDER_KEY }));
  };

  const saveDocs = (order) => {
    try { localStorage.setItem(DOCS_SIDEBAR_ORDER_KEY, JSON.stringify(order)); } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: DOCS_SIDEBAR_ORDER_KEY }));
  };

  const resetNav  = () => { localStorage.removeItem(NAV_ORDER_KEY); window.dispatchEvent(new Event('nav_order_changed')); setNavKey(k => k + 1); };
  const resetAcc  = () => { localStorage.removeItem(ACC_SIDEBAR_ORDER_KEY); window.dispatchEvent(new StorageEvent('storage', { key: ACC_SIDEBAR_ORDER_KEY })); setAccKey(k => k + 1); };
  const resetOpt  = () => { localStorage.removeItem(OPT_SIDEBAR_ORDER_KEY); window.dispatchEvent(new StorageEvent('storage', { key: OPT_SIDEBAR_ORDER_KEY })); setOptKey(k => k + 1); };
  const resetDocs = () => { localStorage.removeItem(DOCS_SIDEBAR_ORDER_KEY); window.dispatchEvent(new StorageEvent('storage', { key: DOCS_SIDEBAR_ORDER_KEY })); setDocsKey(k => k + 1); };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
        {t('options.navOrder')}
      </h2>
      <p className="acc-subtitle" style={{ marginBottom: 28 }}>Drag items to reorder menus. Changes apply immediately.</p>

      {/* Top navigation */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="Top Navigation" subtitle="Reorder the main navigation bar items." />
        <DraggableList key={`nav-${navKey}`} items={loadNavOrder()} labels={{ home: 'Home', analytics: 'Analytics', documents: 'Documents', accounting: 'Accounting', options: 'Options' }} icons={NAV_ICONS} onSave={saveNav} />
        <div style={{ marginTop: 10 }}><ResetBtn onClick={resetNav} /></div>
      </div>

      <div style={{ height: 1, background: 'var(--border-2)', marginBottom: 28 }} />

      {/* Accounting sidebar */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="Accounting Sidebar" subtitle="Reorder the Accounting section sidebar tabs." />
        <DraggableList key={`acc-${accKey}`} items={loadSidebarOrder(ACC_SIDEBAR_ORDER_KEY, ACC_SIDEBAR_DEFAULT)} labels={ACC_LABELS} onSave={saveAcc} />
        <div style={{ marginTop: 10 }}><ResetBtn onClick={resetAcc} /></div>
      </div>

      <div style={{ height: 1, background: 'var(--border-2)', marginBottom: 28 }} />

      {/* Options sidebar */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="Options Sidebar" subtitle="Reorder the Options section sidebar tabs." />
        <DraggableList key={`opt-${optKey}`} items={loadSidebarOrder(OPT_SIDEBAR_ORDER_KEY, OPT_SIDEBAR_DEFAULT)} labels={OPT_LABELS} onSave={saveOpt} />
        <div style={{ marginTop: 10 }}><ResetBtn onClick={resetOpt} /></div>
      </div>

      <div style={{ height: 1, background: 'var(--border-2)', marginBottom: 28 }} />

      {/* Documents sidebar */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title="Documents Sidebar" subtitle="Reorder the Documents section sidebar tabs." />
        <DraggableList key={`docs-${docsKey}`} items={loadSidebarOrder(DOCS_SIDEBAR_ORDER_KEY, DOCS_SIDEBAR_DEFAULT)} labels={DOCS_LABELS} onSave={saveDocs} />
        <div style={{ marginTop: 10 }}><ResetBtn onClick={resetDocs} /></div>
      </div>
    </div>
  );
}

export default NavOrderSettings;
