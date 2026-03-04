import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HiringDocuments from './HiringDocuments';
import EmployeeList from '../Employees/EmployeeList';
import Agents from '../Accounting/Agents';
import Agreements from './Agreements';
import './Documents.css';

const TABS = [
  { key: 'employees', label: 'Employees', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { key: 'agents', label: 'Agents', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { key: 'agreements', label: 'Agreements', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )},
  { key: 'devices', label: 'Devices & Tools', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )},
];

function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'employees');

  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        <div className="docs-sidebar-title">Documents</div>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`docs-sidebar-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="docs-sidebar-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </aside>

      <main className="docs-content">
        {activeTab === 'employees' && (
          <div className="docs-split">
            <div className="docs-split-pane">
              <HiringDocuments />
            </div>
            <div className="docs-split-divider" />
            <div className="docs-split-pane">
              <EmployeeList />
            </div>
          </div>
        )}
        {activeTab === 'agents' && <Agents />}
        {activeTab === 'agreements' && <Agreements />}
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
