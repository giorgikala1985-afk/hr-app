import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { loadSidebarOrder, DOCS_SIDEBAR_ORDER_KEY, DOCS_SIDEBAR_DEFAULT } from '../Options/NavOrderSettings';
import HiringDocuments from './HiringDocuments';
import EmployeeList from '../Employees/EmployeeList';
import Agents from '../Accounting/Agents';
import Agreements from './Agreements';
import CurrencyRates from './CurrencyRates';
import ImportEmployees from '../Options/ImportEmployees';
import InsuranceImport from '../Options/InsuranceImport';
import AgentsImport from '../Options/AgentsImport';
import FitPassImport from '../Options/FitPassImport';
import Orders from './Orders';
import DataLake from './DataLake';
import FinBotsPage from './FinBotsPage';
import './Documents.css';

const TAB_KEYS = [
  { key: 'employees', labelKey: 'docs.employees', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { key: 'agents', labelKey: 'docs.agents', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
      <line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  )},
  { key: 'agreements', labelKey: 'docs.agreements', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="9 15 11 17 15 13"/>
    </svg>
  )},
  { key: 'devices', labelKey: 'docs.devices', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )},
  { key: 'nbg-rates', labelKey: 'docs.nbgRates', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
      <polyline points="17,6 23,6 23,12"/>
    </svg>
  )},
  { key: 'ai-agent', labelKey: 'docs.finbot', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <path d="M12 2v3"/>
      <circle cx="12" cy="5" r="1"/>
      <path d="M8 11V9a4 4 0 0 1 8 0v2"/>
      <circle cx="9" cy="15" r="1" fill="#ec4899"/>
      <circle cx="15" cy="15" r="1" fill="#ec4899"/>
      <path d="M9 19h6"/>
    </svg>
  )},
  { key: 'orders', labelKey: 'docs.orders', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <line x1="8" y1="8" x2="16" y2="8"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="8" y1="16" x2="12" y2="16"/>
    </svg>
  )},
  { key: 'importdata', labelKey: 'docs.importData', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )},
  { key: 'datalake', labelKey: 'docs.dataLake', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  )},
];

const CHEVRON_LEFT = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const CHEVRON_RIGHT = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;

function DocumentsPage() {
  const { t } = useLanguage();
  const TABS = TAB_KEYS.map(tab => ({ ...tab, label: t(tab.labelKey) }));
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'employees');
  const [innerTab, setInnerTab] = useState(searchParams.get('inner') || 'hr');
  const [importView, setImportView] = useState('employees');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('docs_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [sidebarOrder, setSidebarOrder] = useState(() => loadSidebarOrder(DOCS_SIDEBAR_ORDER_KEY, DOCS_SIDEBAR_DEFAULT));

  useEffect(() => {
    const sync = (e) => {
      if (!e.key || e.key === DOCS_SIDEBAR_ORDER_KEY) setSidebarOrder(loadSidebarOrder(DOCS_SIDEBAR_ORDER_KEY, DOCS_SIDEBAR_DEFAULT));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const toggleSidebar = () => setCollapsed(v => {
    const next = !v;
    try { localStorage.setItem('docs_sidebar_collapsed', next); } catch {}
    return next;
  });

  return (
    <div className="docs-layout">
      <aside className={`docs-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="docs-sidebar-header">
          <span className="docs-sidebar-title">{t('docs.title')}</span>
          <button className="docs-sidebar-toggle" onClick={toggleSidebar} title={collapsed ? t('docs.expand') : t('docs.collapse')}>
            {collapsed ? CHEVRON_RIGHT : CHEVRON_LEFT}
          </button>
        </div>
        {[...TABS].sort((a, b) => sidebarOrder.indexOf(a.key) - sidebarOrder.indexOf(b.key)).map((tab) => (
          <button
            key={tab.key}
            className={`docs-sidebar-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            title={collapsed ? tab.label : ''}
          >
            <span className="docs-sidebar-icon">{tab.icon}</span>
            <span className="docs-sidebar-btn-label">{tab.label}</span>
          </button>
        ))}
      </aside>

      <main className="docs-content">
        {activeTab === 'employees' && <EmployeeList />}
        {activeTab === 'agents' && <Agents />}
        {activeTab === 'agreements' && <Agreements />}
        {activeTab === 'nbg-rates' && <CurrencyRates />}
        {activeTab === 'ai-agent' && <FinBotsPage />}
        {activeTab === 'importdata' && (
          <div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
              {[{ key: 'employees', label: t('docs.importEmployees') }, { key: 'insurance', label: t('docs.importInsurance') }, { key: 'agents', label: t('docs.importAgents') }, { key: 'fitpass', label: t('docs.importFitpass') }].map(tab => (
                <button key={tab.key} onClick={() => setImportView(tab.key)} style={{
                  padding: '7px 20px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  background: importView === tab.key ? 'var(--surface)' : 'transparent',
                  color: importView === tab.key ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: importView === tab.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}>{tab.label}</button>
              ))}
            </div>
            {importView === 'employees' && <ImportEmployees />}
            {importView === 'insurance' && <InsuranceImport />}
            {importView === 'agents' && <AgentsImport />}
            {importView === 'fitpass' && <FitPassImport />}
          </div>
        )}
        {activeTab === 'orders' && <Orders />}
        {activeTab === 'devices' && (
          <div className="docs-blank">
            <div className="docs-blank-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h3>{t('docs.devices')}</h3>
            <p>{t('docs.devicesComingSoon')}</p>
          </div>
        )}
        {activeTab === 'datalake' && <DataLake />}
      </main>
    </div>
  );
}

export default DocumentsPage;
