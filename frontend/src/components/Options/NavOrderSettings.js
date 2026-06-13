import React, { useState, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon, Analytics01Icon, File01Icon, Calculator01Icon, Settings01Icon,
  InboxIcon, UserGroupIcon, Briefcase01Icon, Agreement01Icon, ComputerIcon,
  ExchangeDollarIcon, ClipboardListIcon, Database01Icon, Book01Icon, ShoppingCart01Icon,
  SaleTag01Icon, Invoice01Icon, MoneyBag01Icon, Package01Icon, Calendar03Icon,
  ArrowDataTransferHorizontalIcon, BankIcon, SecurityCheckIcon, AiBrain01Icon,
  InformationCircleIcon, Table01Icon, TaxesIcon, Globe02Icon, Menu01Icon,
  AccountSetting01Icon, UserSettings01Icon, PaintBoardIcon, InformationSquareIcon,
} from '@hugeicons/core-free-icons';

const listIcon = (icon) => <HugeiconsIcon icon={icon} size={16} color="currentColor" strokeWidth={1.8} />;

// Sidebar menu items are no longer draggable in place. Reordering is done
// exclusively through the Navigation panel in Options (see DraggableList below).
// getItemProps is kept as a no-op so existing sidebars can keep spreading it
// without changes.
export function useSidebarReorder() {
  const getItemProps = () => ({});
  return { getItemProps, draggingKey: null, overKey: null };
}

export const NAV_ORDER_KEY = 'nav_order';
export const NAV_KEYS_DEFAULT = ['home', 'analytics', 'documents', 'accounting', 'options'];

export const ACC_SIDEBAR_ORDER_KEY = 'acc_sidebar_order';
export const ACC_SIDEBAR_DEFAULT = ['bookkeeping', 'purchases', 'sales', 'invoices', 'salary-accrual', 'stock', 'calendar', 'transfers', 'banking', 'rsge', 'ai-agent'];

export const OPT_SIDEBAR_ORDER_KEY = 'opt_sidebar_order';
export const OPT_SIDEBAR_DEFAULT = ['holidays', 'info', 'pagination', 'tax', 'language', 'navorder', 'accounts', 'users', 'tools', 'appearance', 'about'];

export const DOCS_SIDEBAR_ORDER_KEY = 'docs_sidebar_order';
export const DOCS_SIDEBAR_DEFAULT = ['requests', 'employees', 'agents', 'agreements', 'devices', 'nbg-rates', 'orders', 'datalake'];

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
  home: listIcon(Home01Icon),
  analytics: listIcon(Analytics01Icon),
  documents: listIcon(File01Icon),
  accounting: listIcon(Calculator01Icon),
  options: listIcon(Settings01Icon),
};

const DOCS_ICONS = {
  requests: listIcon(InboxIcon),
  employees: listIcon(UserGroupIcon),
  agents: listIcon(Briefcase01Icon),
  agreements: listIcon(Agreement01Icon),
  devices: listIcon(ComputerIcon),
  'nbg-rates': listIcon(ExchangeDollarIcon),
  orders: listIcon(ClipboardListIcon),
  datalake: listIcon(Database01Icon),
};

const ACC_ICONS = {
  bookkeeping: listIcon(Book01Icon),
  purchases: listIcon(ShoppingCart01Icon),
  sales: listIcon(SaleTag01Icon),
  invoices: listIcon(Invoice01Icon),
  'salary-accrual': listIcon(MoneyBag01Icon),
  stock: listIcon(Package01Icon),
  calendar: listIcon(Calendar03Icon),
  transfers: listIcon(ArrowDataTransferHorizontalIcon),
  banking: listIcon(BankIcon),
  rsge: listIcon(SecurityCheckIcon),
  'ai-agent': listIcon(AiBrain01Icon),
};

const OPT_ICONS = {
  holidays: listIcon(Calendar03Icon),
  info: listIcon(InformationCircleIcon),
  pagination: listIcon(Table01Icon),
  tax: listIcon(TaxesIcon),
  language: listIcon(Globe02Icon),
  navorder: listIcon(Menu01Icon),
  accounts: listIcon(AccountSetting01Icon),
  users: listIcon(UserSettings01Icon),
  tools: listIcon(Settings01Icon),
  appearance: listIcon(PaintBoardIcon),
  about: listIcon(InformationSquareIcon),
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

function ResetBtn({ onClick, label }) {
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
      {label}
    </button>
  );
}

function NavOrderSettings() {
  const { t } = useLanguage();

  // Labels reuse the same translation keys as the actual tabs/nav.
  const navLabels = {
    home: t('nav.home'), analytics: t('nav.analytics'), documents: t('nav.documents'),
    accounting: t('nav.accounting'), options: t('nav.options'),
  };
  const accLabels = {
    bookkeeping: t('acc.bookkeeping'), purchases: t('acc.purchases'), sales: t('acc.sales'),
    invoices: t('acc.invoices'), 'salary-accrual': t('acc.salaries'), stock: t('acc.stock'),
    calendar: t('acc.calendar'), transfers: t('acc.transfers'), banking: t('acc.banking'),
    rsge: t('acc.rsge'), 'ai-agent': t('docs.finbot'),
  };
  const docsLabels = {
    requests: t('docs.requests'), employees: t('docs.employees'), agents: t('docs.agents'),
    agreements: t('docs.agreements'), devices: t('docs.devices'), 'nbg-rates': t('docs.nbgRates'),
    orders: t('docs.orders'), datalake: t('docs.dataLake'),
  };
  const optLabels = {
    holidays: t('options.holidays'), info: t('options.info'), pagination: t('options.pagination'),
    tax: t('options.tax'), language: t('options.language'), navorder: t('options.navOrder'),
    accounts: t('options.accounts'), users: t('options.users'), tools: t('options.tools'),
    appearance: t('options.appearance'), about: t('options.about'),
  };
  const resetLabel = t('navset.reset');

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
      <p className="acc-subtitle" style={{ marginBottom: 28 }}>{t('navset.subtitle')}</p>

      {/* Top navigation */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title={t('navset.topNav')} subtitle={t('navset.topNavDesc')} />
        <DraggableList key={`nav-${navKey}`} items={loadNavOrder()} labels={navLabels} icons={NAV_ICONS} onSave={saveNav} />
        <div style={{ marginTop: 10 }}><ResetBtn onClick={resetNav} label={resetLabel} /></div>
      </div>

      <div style={{ height: 1, background: 'var(--border-2)', marginBottom: 28 }} />

      {/* Accounting sidebar */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title={t('navset.accSidebar')} subtitle={t('navset.accSidebarDesc')} />
        <DraggableList key={`acc-${accKey}`} items={loadSidebarOrder(ACC_SIDEBAR_ORDER_KEY, ACC_SIDEBAR_DEFAULT)} labels={accLabels} icons={ACC_ICONS} onSave={saveAcc} />
        <div style={{ marginTop: 10 }}><ResetBtn onClick={resetAcc} label={resetLabel} /></div>
      </div>

      <div style={{ height: 1, background: 'var(--border-2)', marginBottom: 28 }} />

      {/* Options sidebar */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title={t('navset.optSidebar')} subtitle={t('navset.optSidebarDesc')} />
        <DraggableList key={`opt-${optKey}`} items={loadSidebarOrder(OPT_SIDEBAR_ORDER_KEY, OPT_SIDEBAR_DEFAULT)} labels={optLabels} icons={OPT_ICONS} onSave={saveOpt} />
        <div style={{ marginTop: 10 }}><ResetBtn onClick={resetOpt} label={resetLabel} /></div>
      </div>

      <div style={{ height: 1, background: 'var(--border-2)', marginBottom: 28 }} />

      {/* Documents sidebar */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader title={t('navset.docsSidebar')} subtitle={t('navset.docsSidebarDesc')} />
        <DraggableList key={`docs-${docsKey}`} items={loadSidebarOrder(DOCS_SIDEBAR_ORDER_KEY, DOCS_SIDEBAR_DEFAULT)} labels={docsLabels} icons={DOCS_ICONS} onSave={saveDocs} />
        <div style={{ marginTop: 10 }}><ResetBtn onClick={resetDocs} label={resetLabel} /></div>
      </div>
    </div>
  );
}

export default NavOrderSettings;
