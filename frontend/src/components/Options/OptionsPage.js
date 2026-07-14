import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import HolidayList from '../Holidays/HolidayList';
import PaginationSettings from './PaginationSettings';
import UnitTypesSettings from './UnitTypesSettings';
import PositionsSettings from './PositionsSettings';
import DepartmentsSettings from './DepartmentsSettings';
import OvertimeSettings from './OvertimeSettings';
import StockSettings from './StockSettings';
import LanguageSettings from './LanguageSettings';
import TaxSettings from './TaxSettings';
import NavOrderSettings, { loadSidebarOrder, loadHidden, useSidebarReorder, OPT_SIDEBAR_ORDER_KEY, OPT_SIDEBAR_DEFAULT, OPT_SIDEBAR_HIDDEN_KEY } from './NavOrderSettings';
import UsersSettings from './UsersSettings';
import AccountsSettings from './AccountsSettings';
import ToolsPage from './Tools/ToolsPage';
import HierarchyBuilder from './HierarchyBuilder';
import BgColorSettings from './BgColorSettings';
import FontSettings from './FontSettings';
import LogoSettings from './LogoSettings';
import { useLanguage } from '../../contexts/LanguageContext';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  InformationCircleIcon,
  Table01Icon,
  TaxesIcon,
  Globe02Icon,
  Menu01Icon,
  AccountSetting01Icon,
  UserSettings01Icon,
  Settings01Icon,
  PaintBoardIcon,
  InformationSquareIcon,
  DiamondIcon,
} from '@hugeicons/core-free-icons';
import './Options.css';

const optIcon = (icon, color) => <HugeiconsIcon icon={icon} size={16} color={color} strokeWidth={1.8} />;

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
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'holidays');
  const [infoView, setInfoView] = useState('positions');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('opt_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [sidebarOrder, setSidebarOrder] = useState(() => loadSidebarOrder(OPT_SIDEBAR_ORDER_KEY, OPT_SIDEBAR_DEFAULT));
  const [hiddenTabs, setHiddenTabs] = useState(() => loadHidden(OPT_SIDEBAR_HIDDEN_KEY));
  const { t } = useLanguage();

  const currentRights = (() => {
    try { const s = localStorage.getItem('member_user'); return s ? JSON.parse(s).rights : 'Super Admin'; } catch { return 'Super Admin'; }
  })();
  const isSuperAdmin = currentRights === 'Super Admin';

  useEffect(() => {
    const sync = (e) => {
      if (!e.key || e.key === OPT_SIDEBAR_ORDER_KEY) setSidebarOrder(loadSidebarOrder(OPT_SIDEBAR_ORDER_KEY, OPT_SIDEBAR_DEFAULT));
      if (!e.key || e.key === OPT_SIDEBAR_HIDDEN_KEY) setHiddenTabs(loadHidden(OPT_SIDEBAR_HIDDEN_KEY));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const toggleSidebar = () => setCollapsed(v => {
    const next = !v;
    try { localStorage.setItem('opt_sidebar_collapsed', next); } catch {}
    return next;
  });

  const tabs = [
    { key: 'holidays', label: t('options.holidays'), icon: optIcon(Calendar03Icon, '#f43f5e') },
    { key: 'info', label: t('options.info'), icon: optIcon(InformationCircleIcon, '#8b5cf6') },
    { key: 'pagination', label: t('options.pagination'), icon: optIcon(Table01Icon, '#f97316') },
    { key: 'tax', label: t('options.tax'), icon: optIcon(TaxesIcon, '#10b981') },
    { key: 'language', label: t('options.language'), icon: optIcon(Globe02Icon, '#06b6d4') },
    { key: 'navorder', label: t('options.navOrder'), icon: optIcon(Menu01Icon, '#6366f1') },
    { key: 'accounts', label: t('options.accounts'), icon: optIcon(AccountSetting01Icon, '#0369a1') },
    ...(isSuperAdmin ? [{ key: 'users', label: t('options.users'), icon: optIcon(UserSettings01Icon, '#7c3aed') }] : []),
    { key: 'hierarchy', label: t('options.hierarchy'), icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4"  r="2.2"/><line x1="12" y1="6.2" x2="12" y2="9.5"/>
        <line x1="12" y1="9.5" x2="5.5" y2="13"/><line x1="12" y1="9.5" x2="18.5" y2="13"/>
        <circle cx="5.5" cy="15.2" r="2.2"/><circle cx="18.5" cy="15.2" r="2.2"/>
      </svg>
    )},
    { key: 'tools', label: t('options.tools'), icon: optIcon(Settings01Icon, '#f59e0b') },
    { key: 'appearance', label: t('options.appearance'), icon: optIcon(PaintBoardIcon, '#f43f5e') },
    { key: 'about', label: t('options.about'), icon: optIcon(InformationSquareIcon, '#ec4899') },
  ];

  const orderedTabs = [...tabs]
    .sort((a, b) => sidebarOrder.indexOf(a.key) - sidebarOrder.indexOf(b.key))
    .filter(tab => !hiddenTabs.has(tab.key));
  const { getItemProps } = useSidebarReorder(OPT_SIDEBAR_ORDER_KEY, orderedTabs.map(tab => tab.key), setSidebarOrder);

  return (
    <div className="acc-layout">
      <aside className={`acc-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="acc-sidebar-header">
          <span className="acc-sidebar-title">{t('options.title')}</span>
          <button className="acc-sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? CHEVRON_RIGHT : CHEVRON_LEFT}
          </button>
        </div>
        {orderedTabs.map((tab) => (
          <button
            key={tab.key}
            className={`acc-sidebar-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            title={collapsed ? tab.label : ''}
            {...getItemProps(tab.key)}
          >
            <span className="acc-sidebar-icon">{tab.icon}</span>
            <span className="acc-sidebar-btn-label">{tab.label}</span>
          </button>
        ))}
      </aside>
      <main className="acc-content">
        {activeTab === 'holidays' && <HolidayList />}
        {activeTab === 'info' && (
          <div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
              {[
                { key: 'positions', label: 'Positions', icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                )},
                { key: 'units', label: 'Units', icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/>
                  </svg>
                )},
                { key: 'departments', label: 'Departments', icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  </svg>
                )},
                { key: 'overtime', label: 'Overtime Rates', icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                )},
                { key: 'stock', label: 'Stock', icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22.5V12"/>
                  </svg>
                )}
              ]
.map(tab => (
                <button key={tab.key} onClick={() => setInfoView(tab.key)} style={{
                  padding: '7px 16px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: infoView === tab.key ? 'var(--surface)' : 'transparent',
                  color: infoView === tab.key ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: infoView === tab.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {tab.icon}
                  {tab.label}
                </button>
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
        {activeTab === 'accounts' && <AccountsSettings />}
        {activeTab === 'users' && isSuperAdmin && <UsersSettings />}
        {activeTab === 'hierarchy' && <HierarchyBuilder />}
        {activeTab === 'tools' && <ToolsPage />}
        {activeTab === 'appearance' && (
          <div>
            <LogoSettings />
            <BgColorSettings />
            <FontSettings />
          </div>
        )}
        {activeTab === 'about' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #6366f1 0%, #3185FC 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(99,102,241,0.35)' }}>
              <HugeiconsIcon icon={DiamondIcon} size={40} color="white" strokeWidth={1.6} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              A Giorgi Kalandadze &amp; Archil Chogovadze Product
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-4)', margin: 0 }}>© 2026 Finpilot</p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>Deployed: June 19, 2026</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default OptionsPage;
