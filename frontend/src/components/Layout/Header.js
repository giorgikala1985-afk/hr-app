import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { loadNavOrder, NAV_ORDER_KEY } from '../Options/NavOrderSettings';
import './Header.css';

const FLAG_GB = 'https://flagcdn.com/w40/gb.png';
const FLAG_GE = 'https://flagcdn.com/w40/ge.png';

const NAV_CONFIG = {
  home: {
    path: '/', end: true, labelKey: 'nav.home',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
  },
  analytics: {
    path: '/analytics', end: false, labelKey: 'nav.analytics',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  documents: {
    path: '/documents', end: false, labelKey: 'nav.documents',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  accounting: {
    path: '/accounting', end: false, labelKey: 'nav.accounting',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  options: {
    path: '/options', end: false, labelKey: 'nav.options',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
};

function Header() {
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [navOrder, setNavOrder] = useState(loadNavOrder);

  useEffect(() => {
    const handler = () => setNavOrder(loadNavOrder());
    window.addEventListener('nav_order_changed', handler);
    window.addEventListener('storage', (e) => {
      if (e.key === NAV_ORDER_KEY) handler();
    });
    return () => {
      window.removeEventListener('nav_order_changed', handler);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-logo">
          <Link to="/">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Finpilot
          </Link>
        </div>
        <nav className="header-nav">
          {navOrder.map(key => {
            const cfg = NAV_CONFIG[key];
            if (!cfg) return null;
            return (
              <NavLink key={key} to={cfg.path} end={cfg.end}>
                {cfg.icon}
                {t(cfg.labelKey)}
              </NavLink>
            );
          })}
        </nav>
        <div className="header-user">
          <div className="lang-switcher">
            <button
              className={`lang-flag-btn${language === 'en' ? ' active' : ''}`}
              onClick={() => setLanguage('en')}
              title="English"
            >
              <img src={FLAG_GB} alt="EN" width="20" height="14" style={{ borderRadius: 2, display: 'block' }} />
            </button>
            <button
              className={`lang-flag-btn${language === 'ka' ? ' active' : ''}`}
              onClick={() => setLanguage('ka')}
              title="ქართული"
            >
              <img src={FLAG_GE} alt="KA" width="20" height="14" style={{ borderRadius: 2, display: 'block' }} />
            </button>
          </div>
          <span className="user-email">{user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">
            {t('nav.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
