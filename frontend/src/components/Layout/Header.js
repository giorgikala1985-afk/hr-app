import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Header.css';

function Header() {
  const { user, signOut } = useAuth();
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
          <Link to="/">Employees</Link>
          <Link to="/salaries">Salaries</Link>
          <Link to="/options">Options</Link>
        </nav>
        <div className="header-user">
          <span className="user-email">{user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
