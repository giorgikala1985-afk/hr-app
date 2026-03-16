import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ImportEmployees from './ImportEmployees';
import HolidayList from '../Holidays/HolidayList';
import PaginationSettings from './PaginationSettings';
import UnitTypesSettings from './UnitTypesSettings';
import PositionsSettings from './PositionsSettings';
import DepartmentsSettings from './DepartmentsSettings';
import OvertimeSettings from './OvertimeSettings';
import StockSettings from './StockSettings';
import LanguageSettings from './LanguageSettings';
import TaxSettings from './TaxSettings';
import InsuranceImport from './InsuranceImport';
import AgentsImport from './AgentsImport';
import NavOrderSettings from './NavOrderSettings';
import UsersSettings from './UsersSettings';
import ToolsPage from './Tools/ToolsPage';
import { useLanguage } from '../../contexts/LanguageContext';
import './Options.css';

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

function OptionsPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'importdata');
  const [infoView, setInfoView] = useState('positions');
  const [importView, setImportView] = useState('employees');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('opt_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const { t } = useLanguage();

  const toggleSidebar = () => setCollapsed(v => {
    const next = !v;
    try { localStorage.setItem('opt_sidebar_collapsed', next); } catch {}
    return next;
  });

  const tabs = [
    { key: 'importdata', label: 'Import Data', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    )},
    { key: 'holidays', label: t('options.holidays'), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
    { key: 'info', label: 'Info', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="8"/>
        <line x1="12" y1="12" x2="12" y2="16"/>
      </svg>
    )},
    { key: 'pagination', label: t('options.pagination'), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
      </svg>
    )},
    { key: 'tax', label: t('options.tax'), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h16v22l-3-2-2 2-2-2-2 2-2-2-3 2V2z"/>
        <line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    )},
    { key: 'language', label: t('options.language'), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    )},
    { key: 'navorder', label: t('options.navOrder'), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    )},
    { key: 'users', label: 'Users & Roles', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )},
    { key: 'tools', label: 'Tools', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    )},
    { key: 'about', label: 'About', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    )},
  ];

  return (
    <div className="acc-layout">
      <aside className={`acc-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="acc-sidebar-header">
          <span className="acc-sidebar-title">{t('options.title')}</span>
          <button className="acc-sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? CHEVRON_RIGHT : CHEVRON_LEFT}
          </button>
        </div>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`acc-sidebar-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            title={collapsed ? tab.label : ''}
          >
            <span className="acc-sidebar-icon">{tab.icon}</span>
            <span className="acc-sidebar-btn-label">{tab.label}</span>
          </button>
        ))}
      </aside>
      <main className="acc-content">
        {activeTab === 'importdata' && (
          <div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
              {[{ key: 'employees', label: 'Import Employees' }, { key: 'insurance', label: 'Insurance Import' }, { key: 'agents', label: 'Import Agents' }].map(tab => (
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
          </div>
        )}
        {activeTab === 'holidays' && <HolidayList />}
        {activeTab === 'info' && (
          <div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
              {[{ key: 'positions', label: 'Positions' }, { key: 'units', label: 'Units' }, { key: 'departments', label: 'Departments' }, { key: 'overtime', label: 'Overtime Rates' }, { key: 'stock', label: 'Stock' }].map(tab => (
                <button key={tab.key} onClick={() => setInfoView(tab.key)} style={{
                  padding: '7px 20px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  background: infoView === tab.key ? 'var(--surface)' : 'transparent',
                  color: infoView === tab.key ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: infoView === tab.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}>{tab.label}</button>
              ))}
            </div>
            {infoView === 'positions' && <PositionsSettings />}
            {infoView === 'units' && <UnitTypesSettings />}
            {infoView === 'departments' && <DepartmentsSettings />}
            {infoView === 'overtime' && <OvertimeSettings />}
            {infoView === 'stock' && <StockSettings />}
          </div>
        )}
        {activeTab === 'pagination' && <PaginationSettings />}
        {activeTab === 'tax' && <TaxSettings />}
{activeTab === 'language' && <LanguageSettings />}
        {activeTab === 'navorder' && <NavOrderSettings />}
        {activeTab === 'users' && <UsersSettings />}
        {activeTab === 'tools' && <ToolsPage />}
        {activeTab === 'about' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 72 }}>🍾</div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              A Giorgi Kalandadze &amp; Archil Chogovadze Product
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-4)', margin: 0 }}>© 2026 Finpilot</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default OptionsPage;
