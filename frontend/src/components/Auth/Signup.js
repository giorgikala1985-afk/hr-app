import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

function Signup() {
  const [form, setForm] = useState({
    companyName: '',
    companyId: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const f = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.companyName.trim()) { setError('Company name is required.'); return; }
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First and last name are required.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      await signUp(form.email, form.password, {
        company_name: form.companyName,
        company_id: form.companyId,
        first_name: form.firstName,
        last_name: form.lastName,
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Finpilot
          </div>
          <h1>Create your account</h1>
          <p>Set up your company workspace</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-section-label">Company Info</div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="companyName">Company Name *</label>
              <input
                id="companyName"
                type="text"
                value={form.companyName}
                onChange={f('companyName')}
                placeholder="e.g. Acme Corp"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="companyId">Company ID</label>
              <input
                id="companyId"
                type="text"
                value={form.companyId}
                onChange={f('companyId')}
                placeholder="e.g. 123456789"
              />
            </div>
          </div>

          <div className="auth-section-label" style={{ marginTop: 8 }}>Your Details</div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                id="firstName"
                type="text"
                value={form.firstName}
                onChange={f('firstName')}
                placeholder="First name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                id="lastName"
                type="text"
                value={form.lastName}
                onChange={f('lastName')}
                placeholder="Last name"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={f('email')}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="auth-section-label" style={{ marginTop: 8 }}>Security</div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={f('password')}
                placeholder="Min. 6 characters"
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={f('confirmPassword')}
                placeholder="Repeat password"
                required
                minLength={6}
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
