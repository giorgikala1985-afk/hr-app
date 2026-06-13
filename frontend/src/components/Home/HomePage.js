import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import WeatherWidget from './WeatherWidget';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserGroupIcon, Briefcase01Icon, Agreement01Icon, ExchangeDollarIcon, AiBrain01Icon,
  ClipboardListIcon, Database01Icon, ComputerIcon, Book01Icon, ShoppingCart01Icon,
  SaleTag01Icon, Invoice01Icon, MoneyBag01Icon, Package01Icon, Calendar03Icon,
  ArrowDataTransferHorizontalIcon, BankIcon, SecurityCheckIcon, TaxesIcon, Globe02Icon,
  Menu01Icon, AccountSetting01Icon, UserSettings01Icon, Settings01Icon, PaintBoardIcon,
  ManagerIcon, CubeIcon, ColorsIcon, Analytics01Icon,
} from '@hugeicons/core-free-icons';
import './HomePage.css';

const homeIcon = (icon) => <HugeiconsIcon icon={icon} size={24} color="currentColor" strokeWidth={1.8} />;

const ALL_TABS = [
  // Documents
  {
    key: 'doc-employees', label: 'Employees', labelKey: 'docs.employees', section: 'Documents', route: '/documents?tab=employees',
    color: '#3b82f6', bg: '#eff6ff', icon: homeIcon(UserGroupIcon),
  },
  {
    key: 'doc-agents', label: 'Agents', labelKey: 'docs.agents', section: 'Documents', route: '/documents?tab=agents',
    color: '#8b5cf6', bg: '#f5f3ff', icon: homeIcon(Briefcase01Icon),
  },
  {
    key: 'doc-agreements', label: 'Agreements', labelKey: 'docs.agreements', section: 'Documents', route: '/documents?tab=agreements',
    color: '#10b981', bg: '#ecfdf5', icon: homeIcon(Agreement01Icon),
  },
  {
    key: 'doc-nbg', label: 'NBG Rates', labelKey: 'docs.nbgRates', section: 'Documents', route: '/documents?tab=nbg-rates',
    color: '#06b6d4', bg: '#ecfeff', icon: homeIcon(ExchangeDollarIcon),
  },
  {
    key: 'doc-finbot', label: 'FinBot', labelKey: 'docs.finbot', section: 'Accounting', route: '/accounting?tab=ai-agent',
    color: '#ec4899', bg: '#fdf2f8', icon: homeIcon(AiBrain01Icon),
  },
  {
    key: 'doc-orders', label: 'Orders', labelKey: 'docs.orders', section: 'Documents', route: '/documents?tab=orders',
    color: '#f59e0b', bg: '#fffbeb', icon: homeIcon(ClipboardListIcon),
  },
  {
    key: 'doc-datalake', label: 'Data Lake', labelKey: 'docs.dataLake', section: 'Documents', route: '/documents?tab=datalake',
    color: '#14b8a6', bg: '#f0fdfa', icon: homeIcon(Database01Icon),
  },
  {
    key: 'doc-devices', label: 'Devices', labelKey: 'docs.devices', section: 'Documents', route: '/documents?tab=devices',
    color: '#6366f1', bg: '#eef2ff', icon: homeIcon(ComputerIcon),
  },

  // Accounting
  {
    key: 'acc-bookkeeping', label: 'Bookkeeping', labelKey: 'acc.bookkeeping', section: 'Accounting', route: '/accounting?tab=bookkeeping',
    color: '#6366f1', bg: '#eef2ff', icon: homeIcon(Book01Icon),
  },
  {
    key: 'acc-purchases', label: 'Purchases', labelKey: 'acc.purchases', section: 'Accounting', route: '/accounting?tab=purchases',
    color: '#f97316', bg: '#fff7ed', icon: homeIcon(ShoppingCart01Icon),
  },
  {
    key: 'acc-sales', label: 'Sales', labelKey: 'acc.sales', section: 'Accounting', route: '/accounting?tab=sales',
    color: '#10b981', bg: '#ecfdf5', icon: homeIcon(SaleTag01Icon),
  },
  {
    key: 'acc-invoices', label: 'Invoices', labelKey: 'acc.invoices', section: 'Accounting', route: '/accounting?tab=invoices',
    color: '#3b82f6', bg: '#eff6ff', icon: homeIcon(Invoice01Icon),
  },
  {
    key: 'acc-salaries', label: 'Salaries', labelKey: 'acc.salaries', section: 'Accounting', route: '/accounting?tab=salary-accrual',
    color: '#8b5cf6', bg: '#f5f3ff', icon: homeIcon(MoneyBag01Icon),
  },
  {
    key: 'acc-stock', label: 'Stock', labelKey: 'acc.stock', section: 'Accounting', route: '/accounting?tab=stock',
    color: '#f59e0b', bg: '#fffbeb', icon: homeIcon(Package01Icon),
  },
  {
    key: 'acc-calendar', label: 'Calendar', labelKey: 'acc.calendar', section: 'Accounting', route: '/accounting?tab=calendar',
    color: '#ec4899', bg: '#fdf2f8', icon: homeIcon(Calendar03Icon),
  },
  {
    key: 'acc-transfers', label: 'Transfers', labelKey: 'acc.transfers', section: 'Accounting', route: '/accounting?tab=transfers',
    color: '#06b6d4', bg: '#ecfeff', icon: homeIcon(ArrowDataTransferHorizontalIcon),
  },
  {
    key: 'acc-banking', label: 'Banking', labelKey: 'acc.banking', section: 'Accounting', route: '/accounting?tab=banking',
    color: '#14b8a6', bg: '#f0fdfa', icon: homeIcon(BankIcon),
  },
  {
    key: 'acc-rsge', label: 'RS.ge', labelKey: 'acc.rsge', section: 'Accounting', route: '/accounting?tab=rsge',
    color: '#e11d48', bg: '#fff1f2', icon: homeIcon(SecurityCheckIcon),
  },

  // Options
  {
    key: 'opt-holidays', label: 'Holidays', labelKey: 'options.holidays', section: 'Options', route: '/options?tab=holidays',
    color: '#f43f5e', bg: '#fff1f2', icon: homeIcon(Calendar03Icon),
  },
  {
    key: 'opt-positions', label: 'Positions', labelKey: 'pos.title', section: 'Options', route: '/options?tab=info',
    color: '#8b5cf6', bg: '#f5f3ff', icon: homeIcon(ManagerIcon),
  },
  {
    key: 'opt-units', label: 'Units', labelKey: 'ut.title', section: 'Options', route: '/options?tab=info',
    color: '#f97316', bg: '#fff7ed', icon: homeIcon(CubeIcon),
  },
  {
    key: 'opt-tax', label: 'Tax', labelKey: 'options.tax', section: 'Options', route: '/options?tab=tax',
    color: '#10b981', bg: '#ecfdf5', icon: homeIcon(TaxesIcon),
  },
  {
    key: 'opt-language', label: 'Language', labelKey: 'options.language', section: 'Options', route: '/options?tab=language',
    color: '#06b6d4', bg: '#ecfeff', icon: homeIcon(Globe02Icon),
  },
  {
    key: 'opt-navorder', label: 'Nav Order', labelKey: 'options.navOrder', section: 'Options', route: '/options?tab=navorder',
    color: '#6366f1', bg: '#eef2ff', icon: homeIcon(Menu01Icon),
  },
  {
    key: 'opt-accounts', label: 'Accounts', labelKey: 'options.accounts', section: 'Options', route: '/options?tab=accounts',
    color: '#0369a1', bg: '#f0f9ff', icon: homeIcon(AccountSetting01Icon),
  },
  {
    key: 'opt-users', label: 'Users', labelKey: 'options.users', section: 'Options', route: '/options?tab=users',
    color: '#7c3aed', bg: '#faf5ff', icon: homeIcon(UserSettings01Icon),
  },
  {
    key: 'opt-tools', label: 'Tools', labelKey: 'options.tools', section: 'Options', route: '/options?tab=tools',
    color: '#f59e0b', bg: '#fffbeb', icon: homeIcon(Settings01Icon),
  },
  {
    key: 'opt-appearance', label: 'Appearance', labelKey: 'options.appearance', section: 'Options', route: '/options?tab=appearance',
    color: '#f43f5e', bg: '#fff1f2', icon: homeIcon(PaintBoardIcon),
  },
  {
    key: 'opt-icons', label: 'Icons', labelKey: 'options.icons', section: 'Options', route: '/options?tab=icons',
    color: '#10b981', bg: '#ecfdf5', icon: homeIcon(ColorsIcon),
  },

  // Employees
  {
    key: 'employees', label: 'Employees', labelKey: 'nav.employees', section: 'Employees', route: '/employees',
    color: '#3185FC', bg: '#eff6ff', icon: homeIcon(UserGroupIcon),
  },
  // Analytics
  {
    key: 'analytics', label: 'Analytics', labelKey: 'nav.analytics', section: 'Analytics', route: '/analytics',
    color: '#7c3aed', bg: '#faf5ff', icon: homeIcon(Analytics01Icon),
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

      <div className="home-stat-row">
        <WeatherWidget />
        {empCount !== null && (
          <div className="home-stat-card">
            <div className="home-stat-icon" style={{ background: theme === 'dark' ? 'rgba(49,133,252,0.15)' : '#eff6ff', color: '#3185FC' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div className="home-stat-value">{empCount}</div>
              <div className="home-stat-label">{t('analytics.totalEmployees')}</div>
            </div>
          </div>
        )}
      </div>

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
