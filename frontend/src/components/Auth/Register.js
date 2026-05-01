import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import './Login.css';
import './Register.css';

function Register() {
  const [type, setType] = useState('solo'); // 'solo' | 'company'
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    personalId: '',
    companyName: '',
    companyId: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const f = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const switchType = (t) => {
    setType(t);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError(t('reg.nameRequired'));
      return;
    }
    if (type === 'solo' && !form.personalId.trim()) {
      setError(t('reg.personalIdRequired'));
      return;
    }
    if (type === 'company' && !form.companyName.trim()) {
      setError(t('reg.companyNameRequired'));
      return;
    }
    if (!form.email.trim()) {
      setError(t('reg.emailRequired'));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t('reg.passwordMismatch'));
      return;
    }
    if (form.password.length < 6) {
      setError(t('reg.passwordMin6'));
      return;
    }

    setLoading(true);
    try {
      await signUp(form.email, form.password, {
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        account_type: type,
        ...(type === 'solo'
          ? { personal_id: form.personalId }
          : { company_name: form.companyName, company_id: form.companyId }
        ),
      });
      navigate('/');
    } catch (err) {
      setError(err.message || t('reg.failedCreate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-wide reg-card">

        {/* Theme toggle */}
        <button className="reg-theme-btn" onClick={toggleTheme} title="Toggle theme" type="button">
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        <div className="auth-header">
          <div className="auth-logo">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Finpilot
          </div>
          <h1>{t('reg.createAccount')}</h1>
          <p>{t('reg.getStarted')}</p>
        </div>

        {/* Toggle */}
        <div className="reg-toggle">
          <button
            type="button"
            className={`reg-toggle-btn${type === 'solo' ? ' active' : ''}`}
            onClick={() => switchType('solo')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            {t('reg.solo')}
          </button>
          <button
            type="button"
            className={`reg-toggle-btn${type === 'company' ? ' active' : ''}`}
            onClick={() => switchType('company')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              <line x1="12" y1="12" x2="12" y2="16"/>
              <line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
            {t('reg.company')}
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>

          {/* Company-only fields */}
          {type === 'company' && (
            <>
              <div className="auth-section-label">{t('reg.companyInfo')}</div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('reg.companyName')}</label>
                  <input type="text" value={form.companyName} onChange={f('companyName')} placeholder="e.g. Acme Corp" required />
                </div>
                <div className="form-group">
                  <label>{t('reg.companyId')}</label>
                  <input type="text" value={form.companyId} onChange={f('companyId')} placeholder="e.g. 123456789" />
                </div>
              </div>
            </>
          )}

          {/* Personal info */}
          <div className="auth-section-label" style={{ marginTop: type === 'company' ? 8 : 0 }}>
            {t('reg.personalInfo')}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('reg.firstName')}</label>
              <input type="text" value={form.firstName} onChange={f('firstName')} placeholder="First name" required />
            </div>
            <div className="form-group">
              <label>{t('reg.lastName')}</label>
              <input type="text" value={form.lastName} onChange={f('lastName')} placeholder="Last name" required />
            </div>
          </div>

          {type === 'solo' && (
            <div className="form-group">
              <label>{t('reg.personalIdLabel')}</label>
              <input type="text" value={form.personalId} onChange={f('personalId')} placeholder="ID number" required />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={f('email')} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={form.phone} onChange={f('phone')} placeholder="+1 234 567 8900" />
            </div>
          </div>

          {/* Security */}
          <div className="auth-section-label" style={{ marginTop: 8 }}>Security</div>
          <div className="form-row">
            <div className="form-group">
              <label>Password *</label>
              <input type="password" value={form.password} onChange={f('password')} placeholder="Min. 6 characters" required minLength={6} />
            </div>
            <div className="form-group">
              <label>Confirm Password *</label>
              <input type="password" value={form.confirmPassword} onChange={f('confirmPassword')} placeholder="Repeat password" required minLength={6} />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-link">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}

export default Register;
