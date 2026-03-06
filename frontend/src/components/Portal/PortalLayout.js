import React from 'react';
import { NavLink } from 'react-router-dom';
import './Portal.css';

const NAV = [
  {
    to: '/portal/home', label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )
  },
  {
    to: '/portal/payroll', label: 'Payroll',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    )
  },
  {
    to: '/portal/documents', label: 'Documents',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    )
  },
  {
    to: '/portal/scan', label: 'Scan',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
      </svg>
    )
  },
];

export default function PortalLayout({ children }) {
  return (
    <div className="portal-layout">
      <nav className="portal-bottom-nav">
        {NAV.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `portal-nav-item${isActive ? ' active' : ''}`}>
            {icon}
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="portal-main">
        {children}
      </main>
    </div>
  );
}
