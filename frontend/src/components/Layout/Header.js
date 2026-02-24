import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import './Header.css';

function Header() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

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
          <Link to="/">👥 HR Manager</Link>
        </div>
        <nav className="header-nav">
          <Link to="/">{t('nav.employees')}</Link>
          <Link to="/salaries">{t('nav.salaries')}</Link>
          <Link to="/analytics">{t('nav.analytics')}</Link>
          <Link to="/options">{t('nav.options')}</Link>
        </nav>
        <div className="header-user">
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
