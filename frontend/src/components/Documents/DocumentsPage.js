import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HiringDocuments from './HiringDocuments';
import EmployeeList from '../Employees/EmployeeList';
import Agents from '../Accounting/Agents';
import Agreements from './Agreements';
import AiAgentTool from '../Options/Tools/AiAgentTool';
import CurrencyRates from './CurrencyRates';
import './Documents.css';

const TABS = [
  { key: 'employees', label: 'Employees', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { key: 'agents', label: 'Agents', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
      <line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  )},
  { key: 'agreements', label: 'Agreements', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="9 15 11 17 15 13"/>
    </svg>
  )},
  { key: 'devices', label: 'Devices & Tools', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )},
  { key: 'nbg-rates', label: 'NBG Rates', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
      <polyline points="17,6 23,6 23,12"/>
    </svg>
  )},
  { key: 'ai-agent', label: 'FinBot', icon: (
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
];

const CHEVRON_LEFT = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const CHEVRON_RIGHT = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;

function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'employees');
  const [innerTab, setInnerTab] = useState(searchParams.get('inner') || 'hr');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('docs_sidebar_collapsed') === 'true'; } catch { return false; }
  });

  const toggleSidebar = () => setCollapsed(v => {
    const next = !v;
    try { localStorage.setItem('docs_sidebar_collapsed', next); } catch {}
    return next;
  });

  return (
    <div className="docs-layout">
      <aside className={`docs-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="docs-sidebar-header">
          <span className="docs-sidebar-title">Documents</span>
          <button className="docs-sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? CHEVRON_RIGHT : CHEVRON_LEFT}
          </button>
        </div>
        {TABS.map((tab) => (
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
        {activeTab === 'employees' && (
          <div>
            <div className="docs-inner-tabs">
              <button
                className={`docs-inner-tab${innerTab === 'hr' ? ' active' : ''}`}
                onClick={() => setInnerTab('hr')}
              >
                HR
              </button>
              <button
                className={`docs-inner-tab${innerTab === 'employees' ? ' active' : ''}`}
                onClick={() => setInnerTab('employees')}
              >
                Employees
              </button>
            </div>
            {innerTab === 'hr' && <HiringDocuments />}
            {innerTab === 'employees' && <EmployeeList />}
          </div>
        )}
        {activeTab === 'agents' && <Agents />}
        {activeTab === 'agreements' && <Agreements />}
        {activeTab === 'nbg-rates' && <CurrencyRates />}
        {activeTab === 'ai-agent' && <div style={{ padding: '24px 32px', maxWidth: 900 }}><AiAgentTool /></div>}
        {activeTab === 'devices' && (
          <div className="docs-blank">
            <div className="docs-blank-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h3>Devices & Tools</h3>
            <p>Coming soon</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default DocumentsPage;
