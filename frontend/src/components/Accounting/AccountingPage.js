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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  sales: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
      <polyline points="17,6 23,6 23,12"/>
    </svg>
  ),
  invoices: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  salaryAccrual: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  bookkeeping: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h16v22l-3-2-2 2-2-2-2 2-2-2-3 2V2z"/>
      <line x1="8" y1="9" x2="16" y2="9"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  ),
  stock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  transfers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17,1 21,5 17,9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7,23 3,19 7,15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
  banking: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/>
      <path d="M3 10h18"/>
      <path d="M12 3l9 7H3l9-7z"/>
      <path d="M5 10v11"/><path d="M9 10v11"/><path d="M15 10v11"/><path d="M19 10v11"/>
    </svg>
  ),
  rsge: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
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
