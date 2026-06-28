import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { loadNavOrder, NAV_ORDER_KEY } from '../Options/NavOrderSettings';
import { Logo } from '../Options/logos';
import NotificationBell from './NotificationBell';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon,
  Analytics01Icon,
  File01Icon,
  Calculator01Icon,
  Settings01Icon,
  Shield01Icon,
} from '@hugeicons/core-free-icons';
import './Header.css';

const FLAG_GB = 'https://flagcdn.com/w40/gb.png';
const FLAG_GE = 'https://flagcdn.com/w40/ge.png';

const navIcon = (icon, color) => <HugeiconsIcon icon={icon} size={17} color={color} strokeWidth={1.8} />;

const NAV_CONFIG = {
  home: {
    path: '/', end: true, labelKey: 'nav.home',
    icon: navIcon(Home01Icon, '#f97316'),
  },
  analytics: {
    path: '/analytics', end: false, labelKey: 'nav.analytics',
    icon: navIcon(Analytics01Icon, '#10b981'),
  },
  documents: {
    path: '/documents', end: false, labelKey: 'nav.documents',
    icon: navIcon(File01Icon, '#3b82f6'),
  },
  accounting: {
    path: '/finances', end: false, labelKey: 'nav.accounting',
    icon: navIcon(Calculator01Icon, '#8b5cf6'),
  },
  options: {
    path: '/options', end: false, labelKey: 'nav.options',
    icon: navIcon(Settings01Icon, '#f59e0b'),
  },
};

const ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const isAdmin = (email) => ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes((email || '').toLowerCase());

function Header() {
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme, logo } = useTheme();
  const navigate = useNavigate();
  const [navOrder, setNavOrder] = useState(loadNavOrder);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            <Logo id={logo} size={22} />
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
          {isAdmin(user?.email) && (
            <NavLink to="/admin" end={false} style={({ isActive }) => ({ color: isActive ? '#16a34a' : undefined })}>
              <HugeiconsIcon icon={Shield01Icon} size={17} color="#16a34a" strokeWidth={1.8} />
              Admin
            </NavLink>
          )}
        </nav>
        <div className="header-user">
          <NotificationBell />
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
              <img src={FLAG_GE} alt="GE" width="20" height="14" style={{ borderRadius: 2, display: 'block' }} />
            </button>
          </div>
          <button onClick={toggleTheme} className="theme-toggle-btn" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <div className="profile-menu-container" ref={profileRef}>
            <button 
              className="profile-icon-btn" 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              title={user?.email}
            >
              {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </button>
            
            {isProfileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-email">{user?.email}</div>
                </div>
                <div className="profile-dropdown-divider"></div>
                <Link to="/profile" className="profile-dropdown-item" onClick={() => setIsProfileOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  My Account
                </Link>
                <Link to="/options" className="profile-dropdown-item" onClick={() => setIsProfileOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </Link>
                <button onClick={handleLogout} className="profile-dropdown-item signout-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
