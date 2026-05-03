import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadSidebarOrder, ACC_SIDEBAR_ORDER_KEY, ACC_SIDEBAR_DEFAULT } from '../Options/NavOrderSettings';
import { useLanguage } from '../../contexts/LanguageContext';
import Purchases from './Purchases';
import Sales from './Sales';
import Invoices from './Invoices';
import SalariesPage from './SalariesPage';
import Bookkeeping from './Bookkeeping';
import Transfers from './Transfers';
import PaymentCalendar from './PaymentCalendar';
import Stock from './Stock';
import TbcBanking from './TbcBanking';
import RsGeIntegration from './RsGeIntegration';
import './Accounting.css';

const ICONS = {
  purchases: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>
  ),
  sales: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
    </svg>
  ),
  invoices: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9H8"/>
    </svg>
  ),
  salaryAccrual: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/><path d="m5 7-3 5 3 5"/><path d="m19 7 3 5-3 5"/>
    </svg>
  ),
  bookkeeping: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  stock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22.5V12"/>
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
    </svg>
  ),
  transfers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 3 4 4-4 4"/><path d="M20 7H4a2 2 0 0 0-2 2v2"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16a2 2 0 0 0 2-2v-2"/>
    </svg>
  ),
  banking: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/><path d="M3 10h18"/><path d="m5 6 7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/>
    </svg>
  ),
  rsge: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  ),
};

const TAB_KEYS = [
  { key: 'bookkeeping',    labelKey: 'acc.bookkeeping', icon: ICONS.bookkeeping },
  { key: 'purchases',      labelKey: 'acc.purchases',   icon: ICONS.purchases },
  { key: 'sales',          labelKey: 'acc.sales',       icon: ICONS.sales },
  { key: 'invoices',       labelKey: 'acc.invoices',    icon: ICONS.invoices },
  { key: 'salary-accrual', labelKey: 'acc.salaries',    icon: ICONS.salaryAccrual },
  { key: 'stock',          labelKey: 'acc.stock',       icon: ICONS.stock },
  { key: 'calendar',       labelKey: 'acc.calendar',    icon: ICONS.calendar },
  { key: 'transfers',      labelKey: 'acc.transfers',   icon: ICONS.transfers },
  { key: 'banking',        labelKey: 'acc.banking',     icon: ICONS.banking },
  { key: 'rsge',           labelKey: 'acc.rsge',        icon: ICONS.rsge },
];

const CHEVRON_LEFT = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
);
const CHEVRON_RIGHT = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,18 15,12 9,6"/>
  </svg>
);

function AccountingPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'bookkeeping');
  const [sidebarOrder, setSidebarOrder] = useState(() => loadSidebarOrder(ACC_SIDEBAR_ORDER_KEY, ACC_SIDEBAR_DEFAULT));
  const TABS = TAB_KEYS.map(tab => ({ ...tab, label: t(tab.labelKey) }));

  useEffect(() => {
    const sync = (e) => {
      if (!e.key || e.key === ACC_SIDEBAR_ORDER_KEY) setSidebarOrder(loadSidebarOrder(ACC_SIDEBAR_ORDER_KEY, ACC_SIDEBAR_DEFAULT));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const orderedTabs = [...TABS].sort((a, b) => sidebarOrder.indexOf(a.key) - sidebarOrder.indexOf(b.key));

  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
  };
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('acc_sidebar_collapsed') === 'true'; } catch { return false; }
  });

  const toggleSidebar = () => setCollapsed(v => {
    const next = !v;
    try { localStorage.setItem('acc_sidebar_collapsed', next); } catch {}
    return next;
  });

  return (
    <div className="acc-layout">
      <aside className={`acc-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="acc-sidebar-header">
          <span className="acc-sidebar-title">{t('acc.title')}</span>
          <button className="acc-sidebar-toggle" onClick={toggleSidebar} title={collapsed ? t('acc.expand') : t('acc.collapse')}>
            {collapsed ? CHEVRON_RIGHT : CHEVRON_LEFT}
          </button>
        </div>
        {orderedTabs.map((tab) => (
          <button
            key={tab.key}
            className={`acc-sidebar-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
            title={collapsed ? tab.label : ''}
          >
            <span className="acc-sidebar-icon">{tab.icon}</span>
            <span className="acc-sidebar-btn-label">{tab.label}</span>
          </button>
        ))}
      </aside>
      <main className="acc-content">
        {activeTab === 'purchases'      && <Purchases />}
        {activeTab === 'sales'          && <Sales />}
        {activeTab === 'invoices'       && <Invoices />}
        {activeTab === 'salary-accrual' && <SalariesPage />}
        {activeTab === 'bookkeeping'    && <Bookkeeping />}
        {activeTab === 'stock'          && <Stock />}
        {activeTab === 'calendar'       && <PaymentCalendar />}
        {activeTab === 'transfers'      && <Transfers />}
        {activeTab === 'banking'        && <TbcBanking />}
        {activeTab === 'rsge'           && <RsGeIntegration />}
      </main>
    </div>
  );
}

export default AccountingPage;
