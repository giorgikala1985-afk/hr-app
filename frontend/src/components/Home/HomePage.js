import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './HomePage.css';

const ALL_TABS = [
  // Documents
  {
    key: 'doc-hr', label: 'HR', section: 'Documents', route: '/documents?tab=hiring',
    color: '#0891b2', bg: '#f0fdfa',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'doc-devices', label: 'Devices & Tools', section: 'Documents', route: '/documents?tab=devices',
    color: '#0891b2', bg: '#f0fdfa',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  // Accounting
  {
    key: 'acc-purchases', label: 'Purchases', section: 'Accounting', route: '/accounting?tab=purchases',
    color: '#16a34a', bg: '#f0fdf4',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    ),
  },
  {
    key: 'acc-sales', label: 'Sales', section: 'Accounting', route: '/accounting?tab=sales',
    color: '#16a34a', bg: '#f0fdf4',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    key: 'acc-invoices', label: 'Invoices', section: 'Accounting', route: '/accounting?tab=invoices',
    color: '#16a34a', bg: '#f0fdf4',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    key: 'acc-salary', label: 'Salaries', section: 'Accounting', route: '/accounting?tab=salary-accrual',
    color: '#16a34a', bg: '#f0fdf4',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  // Options
  {
    key: 'opt-import', label: 'Import', section: 'Options', route: '/options?tab=import',
    color: '#ea580c', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
  {
    key: 'opt-holidays', label: 'Holidays', section: 'Options', route: '/options?tab=holidays',
    color: '#ea580c', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    key: 'opt-positions', label: 'Positions', section: 'Options', route: '/options?tab=positions',
    color: '#ea580c', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    key: 'opt-units', label: 'Unit Types', section: 'Options', route: '/options?tab=units',
    color: '#ea580c', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    key: 'opt-tax', label: 'Tax', section: 'Options', route: '/options?tab=tax',
    color: '#ea580c', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h16v22l-3-2-2 2-2-2-2 2-2-2-3 2V2z"/>
        <line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  },
  {
    key: 'opt-insurance', label: 'Insurance', section: 'Options', route: '/options?tab=insurance',
    color: '#ea580c', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    key: 'opt-departments', label: 'Departments', section: 'Options', route: '/options?tab=departments',
    color: '#ea580c', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
  },
  {
    key: 'opt-language', label: 'Language', section: 'Options', route: '/options?tab=language',
    color: '#ea580c', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  // Employees
  {
    key: 'employees', label: 'Employees', section: 'Employees', route: '/employees',
    color: '#3185FC', bg: '#eff6ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  // Analytics
  {
    key: 'analytics', label: 'Analytics', section: 'Analytics', route: '/analytics',
    color: '#7c3aed', bg: '#faf5ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
];

const STORAGE_KEY = 'hr_pinned_tabs';
const DEFAULT_PINS = ['doc-hr', 'opt-units', 'acc-purchases', 'employees'];

function HomePage() {
  const [pinned, setPinned] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PINS;
    } catch { return DEFAULT_PINS; }
  });
  const [customizing, setCustomizing] = useState(false);
  const [empCount, setEmpCount] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  }, [pinned]);

  useEffect(() => {
    api.get('/employees').then(res => setEmpCount((res.data.employees || []).length)).catch(() => {});
  }, []);

  const togglePin = (key) => {
    setPinned(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const pinnedTabs = ALL_TABS.filter(t => pinned.includes(t.key));
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const sections = [...new Set(ALL_TABS.map(t => t.section))];

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1 className="home-title">Dashboard</h1>
          <p className="home-date">{today}</p>
        </div>
        <button
          className={`home-customize-btn${customizing ? ' active' : ''}`}
          onClick={() => setCustomizing(c => !c)}
        >
          {customizing ? 'Done' : 'Customize'}
        </button>
      </div>

      {empCount !== null && (
        <div className="home-stat-row">
          <div className="home-stat-card">
            <div className="home-stat-icon" style={{ background: '#eff6ff', color: '#3185FC' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div className="home-stat-value">{empCount}</div>
              <div className="home-stat-label">Total Employees</div>
            </div>
          </div>
        </div>
      )}

      <div className="home-section-title">
        {customizing ? 'Select tabs to pin' : 'Pinned Tabs'}
      </div>

      {customizing ? (
        <div className="home-customize-sections">
          {sections.map(section => {
            const sectionTabs = ALL_TABS.filter(t => t.section === section);
            const sectionColor = sectionTabs[0]?.color;
            return (
              <div key={section} className="home-customize-group">
                <div className="home-customize-group-label" style={{ color: sectionColor }}>{section}</div>
                <div className="home-all-grid">
                  {sectionTabs.map(tab => (
                    <button
                      key={tab.key}
                      className={`home-section-card${pinned.includes(tab.key) ? ' pinned' : ''}`}
                      style={{ '--section-color': tab.color, '--section-bg': tab.bg }}
                      onClick={() => togglePin(tab.key)}
                    >
                      <div className="home-card-pin-badge">
                        {pinned.includes(tab.key) ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        )}
                      </div>
                      <div className="home-card-icon" style={{ background: tab.bg, color: tab.color }}>{tab.icon}</div>
                      <div className="home-card-label">{tab.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : pinnedTabs.length === 0 ? (
        <div className="home-empty">
          <p>No pinned tabs. Click <strong>Customize</strong> to add shortcuts.</p>
        </div>
      ) : (
        <div className="home-pinned-grid">
          {pinnedTabs.map(tab => (
            <Link key={tab.key} to={tab.route} className="home-pinned-card" style={{ '--section-color': tab.color, '--section-bg': tab.bg }}>
              <div className="home-card-icon" style={{ background: tab.bg, color: tab.color }}>{tab.icon}</div>
              <div>
                <div className="home-card-label">{tab.label}</div>
                <div className="home-card-section">{tab.section}</div>
              </div>
              <svg className="home-card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default HomePage;
