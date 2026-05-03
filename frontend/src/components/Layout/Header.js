import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { loadNavOrder, NAV_ORDER_KEY } from '../Options/NavOrderSettings';
import NotificationBell from './NotificationBell';
import './Header.css';

const FLAG_GB = 'https://flagcdn.com/w40/gb.png';
const FLAG_GE = 'https://flagcdn.com/w40/ge.png';

const NAV_CONFIG = {
  home: {
    path: '/', end: true, labelKey: 'nav.home',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>
      </svg>
    ),
  },
  analytics: {
    path: '/analytics', end: false, labelKey: 'nav.analytics',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
      </svg>
    ),
  },
  documents: {
    path: '/documents', end: false, labelKey: 'nav.documents',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9H8"/>
      </svg>
    ),
  },
  accounting: {
    path: '/accounting', end: false, labelKey: 'nav.accounting',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h.01"/><path d="M11 15h2"/>
      </svg>
    ),
  },
  options: {
    path: '/options', end: false, labelKey: 'nav.options',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
};

const ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const isAdmin = (email) => ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes((email || '').toLowerCase());

function Header() {
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
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
          {isAdmin(user?.email) && (
            <NavLink to="/admin" end={false} style={({ isActive }) => ({ color: isActive ? '#16a34a' : undefined })}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
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
                <Link to="/options" className="profile-dropdown-item" onClick={() => setIsProfileOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Profile
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
