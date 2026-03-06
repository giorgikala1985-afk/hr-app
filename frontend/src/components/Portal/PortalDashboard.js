import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import portalApi from '../../services/portalApi';

export default function PortalDashboard() {
  const { logout } = usePortalAuth();
  const [profile, setProfile] = useState(null);
  const [docCount, setDocCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      portalApi.get('/me'),
      portalApi.get('/documents')
    ]).then(([meRes, docsRes]) => {
      setProfile(meRes.data.employee);
      setDocCount(docsRes.data.documents.length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const initials = profile
    ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
    : '';

  const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  if (loading) return <div className="portal-spinner">Loading...</div>;

  return (
    <div>
      {/* Profile card */}
      <div className="portal-profile-card">
        {profile?.photo_url
          ? <img src={profile.photo_url} alt="avatar" className="portal-avatar" />
          : <div className="portal-avatar-placeholder">{initials}</div>
        }
        <div>
          <p className="portal-profile-name">{profile?.first_name} {profile?.last_name}</p>
          <p className="portal-profile-meta">{profile?.position || 'Employee'}{profile?.department ? ` · ${profile.department}` : ''}</p>
          {profile?.start_date && (
            <p className="portal-profile-meta" style={{ marginTop: 2, opacity: 0.75, fontSize: 12 }}>
              Since {new Date(profile.start_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="portal-quick-grid">
        <Link to={`/portal/payroll?month=${currentMonth()}`} className="portal-quick-card">
          <div className="portal-quick-icon">💰</div>
          <div className="portal-quick-label">This Month's Pay</div>
          <div className="portal-quick-value" style={{ fontSize: 13, fontWeight: 500, color: '#2563eb' }}>View →</div>
        </Link>
        <Link to="/portal/documents" className="portal-quick-card">
          <div className="portal-quick-icon">📄</div>
          <div className="portal-quick-label">Documents</div>
          <div className="portal-quick-value">{docCount ?? '—'}</div>
        </Link>
        <Link to="/portal/scan" className="portal-quick-card">
          <div className="portal-quick-icon">📷</div>
          <div className="portal-quick-label">Scan Document</div>
          <div className="portal-quick-value" style={{ fontSize: 13, fontWeight: 500, color: '#2563eb' }}>Open →</div>
        </Link>
        <Link to="/portal/payroll" className="portal-quick-card">
          <div className="portal-quick-icon">📅</div>
          <div className="portal-quick-label">Payroll History</div>
          <div className="portal-quick-value" style={{ fontSize: 13, fontWeight: 500, color: '#2563eb' }}>View →</div>
        </Link>
      </div>

      {/* Logout */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button className="portal-logout-btn" onClick={logout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
}
