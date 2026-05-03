import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './HomePage.css';

const ALL_TABS = [
  // Documents
  {
    key: 'doc-employees', label: 'Employees', labelKey: 'docs.employees', section: 'Documents', route: '/documents?tab=employees',
    color: '#3b82f6', bg: '#eff6ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'doc-agents', label: 'Agents', labelKey: 'docs.agents', section: 'Documents', route: '/documents?tab=agents',
    color: '#8b5cf6', bg: '#f5f3ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
  },
  {
    key: 'doc-agreements', label: 'Agreements', labelKey: 'docs.agreements', section: 'Documents', route: '/documents?tab=agreements',
    color: '#10b981', bg: '#ecfdf5',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>
      </svg>
    ),
  },
  {
    key: 'doc-nbg', label: 'NBG Rates', labelKey: 'docs.nbgRates', section: 'Documents', route: '/documents?tab=nbg-rates',
    color: '#06b6d4', bg: '#ecfeff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
      </svg>
    ),
  },
  {
    key: 'doc-finbot', label: 'FinBot', labelKey: 'docs.finbot', section: 'Documents', route: '/documents?tab=ai-agent',
    color: '#ec4899', bg: '#fdf2f8',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2v3"/><circle cx="12" cy="5" r="1"/><path d="M8 11V9a4 4 0 0 1 8 0v2"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/><path d="M9 19h6"/>
      </svg>
    ),
  },
  {
    key: 'doc-orders', label: 'Orders', labelKey: 'docs.orders', section: 'Documents', route: '/documents?tab=orders',
    color: '#f59e0b', bg: '#fffbeb',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
      </svg>
    ),
  },
  {
    key: 'doc-import', label: 'Import', labelKey: 'docs.importData', section: 'Documents', route: '/documents?tab=importdata',
    color: '#3b82f6', bg: '#eff6ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
  {
    key: 'doc-datalake', label: 'Data Lake', labelKey: 'docs.dataLake', section: 'Documents', route: '/documents?tab=datalake',
    color: '#14b8a6', bg: '#f0fdfa',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
  },
  {
    key: 'doc-devices', label: 'Devices', labelKey: 'docs.devices', section: 'Documents', route: '/documents?tab=devices',
    color: '#6366f1', bg: '#eef2ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },

  // Accounting
  {
    key: 'acc-bookkeeping', label: 'Bookkeeping', labelKey: 'acc.bookkeeping', section: 'Accounting', route: '/accounting?tab=bookkeeping',
    color: '#6366f1', bg: '#eef2ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    key: 'acc-purchases', label: 'Purchases', labelKey: 'acc.purchases', section: 'Accounting', route: '/accounting?tab=purchases',
    color: '#f97316', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
      </svg>
    ),
  },
  {
    key: 'acc-sales', label: 'Sales', labelKey: 'acc.sales', section: 'Accounting', route: '/accounting?tab=sales',
    color: '#10b981', bg: '#ecfdf5',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
      </svg>
    ),
  },
  {
    key: 'acc-invoices', label: 'Invoices', labelKey: 'acc.invoices', section: 'Accounting', route: '/accounting?tab=invoices',
    color: '#3b82f6', bg: '#eff6ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9H8"/>
      </svg>
    ),
  },
  {
    key: 'acc-salaries', label: 'Salaries', labelKey: 'acc.salaries', section: 'Accounting', route: '/accounting?tab=salary-accrual',
    color: '#8b5cf6', bg: '#f5f3ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/><path d="m5 7-3 5 3 5"/><path d="m19 7 3 5-3 5"/>
      </svg>
    ),
  },
  {
    key: 'acc-stock', label: 'Stock', labelKey: 'acc.stock', section: 'Accounting', route: '/accounting?tab=stock',
    color: '#f59e0b', bg: '#fffbeb',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22.5V12"/>
      </svg>
    ),
  },
  {
    key: 'acc-calendar', label: 'Calendar', labelKey: 'acc.calendar', section: 'Accounting', route: '/accounting?tab=calendar',
    color: '#ec4899', bg: '#fdf2f8',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
      </svg>
    ),
  },
  {
    key: 'acc-transfers', label: 'Transfers', labelKey: 'acc.transfers', section: 'Accounting', route: '/accounting?tab=transfers',
    color: '#06b6d4', bg: '#ecfeff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 3 4 4-4 4"/><path d="M20 7H4a2 2 0 0 0-2 2v2"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16a2 2 0 0 0 2-2v-2"/>
      </svg>
    ),
  },
  {
    key: 'acc-banking', label: 'Banking', labelKey: 'acc.banking', section: 'Accounting', route: '/accounting?tab=banking',
    color: '#14b8a6', bg: '#f0fdfa',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"/><path d="M3 10h18"/><path d="m5 6 7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/>
      </svg>
    ),
  },
  {
    key: 'acc-rsge', label: 'RS.ge', labelKey: 'acc.rsge', section: 'Accounting', route: '/accounting?tab=rsge',
    color: '#e11d48', bg: '#fff1f2',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
      </svg>
    ),
  },

  // Options
  {
    key: 'opt-holidays', label: 'Holidays', labelKey: 'options.holidays', section: 'Options', route: '/options?tab=holidays',
    color: '#f43f5e', bg: '#fff1f2',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
      </svg>
    ),
  },
  {
    key: 'opt-positions', label: 'Positions', labelKey: 'pos.title', section: 'Options', route: '/options?tab=info',
    color: '#8b5cf6', bg: '#f5f3ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'opt-units', label: 'Units', labelKey: 'ut.title', section: 'Options', route: '/options?tab=info',
    color: '#f97316', bg: '#fff7ed',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/>
      </svg>
    ),
  },
  {
    key: 'opt-tax', label: 'Tax', labelKey: 'options.tax', section: 'Options', route: '/options?tab=tax',
    color: '#10b981', bg: '#ecfdf5',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h16v22l-3-2-2 2-2-2-2 2-2-2-3 2V2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  },
  {
    key: 'opt-language', label: 'Language', labelKey: 'options.language', section: 'Options', route: '/options?tab=language',
    color: '#06b6d4', bg: '#ecfeff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  {
    key: 'opt-navorder', label: 'Nav Order', labelKey: 'options.navOrder', section: 'Options', route: '/options?tab=navorder',
    color: '#6366f1', bg: '#eef2ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
  },
  {
    key: 'opt-accounts', label: 'Accounts', labelKey: 'options.accounts', section: 'Options', route: '/options?tab=accounts',
    color: '#0369a1', bg: '#f0f9ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h16v22l-3-2-2 2-2-2-2 2-2-2-3 2V2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
      </svg>
    ),
  },
  {
    key: 'opt-users', label: 'Users', labelKey: 'options.users', section: 'Options', route: '/options?tab=users',
    color: '#7c3aed', bg: '#faf5ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    key: 'opt-tools', label: 'Tools', labelKey: 'options.tools', section: 'Options', route: '/options?tab=tools',
    color: '#f59e0b', bg: '#fffbeb',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    key: 'opt-appearance', label: 'Appearance', labelKey: 'options.appearance', section: 'Options', route: '/options?tab=appearance',
    color: '#f43f5e', bg: '#fff1f2',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      </svg>
    ),
  },
  {
    key: 'opt-icons', label: 'Icons', labelKey: 'options.icons', section: 'Options', route: '/options?tab=icons',
    color: '#10b981', bg: '#ecfdf5',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 8v4"/><path d="M12 16h.01"/>
      </svg>
    ),
  },

  // Employees
  {
    key: 'employees', label: 'Employees', labelKey: 'nav.employees', section: 'Employees', route: '/employees',
    color: '#3185FC', bg: '#eff6ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  // Analytics
  {
    key: 'analytics', label: 'Analytics', labelKey: 'nav.analytics', section: 'Analytics', route: '/analytics',
    color: '#7c3aed', bg: '#faf5ff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20"/><path d="M18 20V10"/><path d="M6 20V14"/><path d="m2 20 20 0"/>
      </svg>
    ),
  },
];

const STORAGE_KEY = 'hr_pinned_tabs';
const DEFAULT_PINS = ['doc-hr', 'opt-units', 'acc-purchases', 'employees'];

function HomePage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
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

  const pinnedTabs = ALL_TABS.filter(tab => pinned.includes(tab.key));
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const sections = [
    { key: 'Documents', label: t('nav.documents'), color: '#3b82f6' },
    { key: 'Accounting', label: t('nav.accounting'), color: '#f97316' },
    { key: 'Options', label: t('nav.options'), color: '#10b981' },
    { key: 'Employees', label: t('nav.employees'), color: '#3185FC' },
    { key: 'Analytics', label: t('nav.analytics'), color: '#7c3aed' },
  ];

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1 className="home-title">{t('home.title')}</h1>
          <p className="home-date">{today}</p>
        </div>
        <button
          className={`home-customize-btn${customizing ? ' active' : ''}`}
          onClick={() => setCustomizing(c => !c)}
        >
          {customizing ? t('home.done') : t('home.customize')}
        </button>
      </div>

      {empCount !== null && (
        <div className="home-stat-row">
          <div className="home-stat-card">
            <div className="home-stat-icon" style={{ background: '#eff6ff', color: '#3185FC' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div className="home-stat-value">{empCount}</div>
              <div className="home-stat-label">{t('analytics.totalEmployees')}</div>
            </div>
          </div>
        </div>
      )}

      <div className="home-section-title">
        {customizing ? t('home.selectTabs') : t('home.pinnedTabs')}
      </div>

      {customizing ? (
        <div className="home-customize-sections">
          {sections.map(section => {
            const sectionTabs = ALL_TABS.filter(tab => tab.section === section.key);
            if (sectionTabs.length === 0) return null;
            return (
              <div key={section.key} className="home-customize-group">
                <div className="home-customize-group-label" style={{ color: section.color }}>{section.label}</div>
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
                      <div className="home-card-icon" style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : tab.bg, color: tab.color }}>{tab.icon}</div>
                      <div className="home-card-label">{tab.labelKey ? t(tab.labelKey) : tab.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : pinnedTabs.length === 0 ? (
        <div className="home-empty">
          <p>{t('home.noTabs')}</p>
        </div>
      ) : (
        <div className="home-pinned-grid">
          {pinnedTabs.map(tab => (
            <Link key={tab.key} to={tab.route} className="home-pinned-card" style={{ '--section-color': tab.color, '--section-bg': tab.bg }}>
              <div className="home-card-icon" style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : tab.bg, color: tab.color }}>{tab.icon}</div>
              <div>
                <div className="home-card-label">{tab.labelKey ? t(tab.labelKey) : tab.label}</div>
                <div className="home-card-section">{sections.find(s => s.key === tab.section)?.label || tab.section}</div>
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
