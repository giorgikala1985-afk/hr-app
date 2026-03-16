import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import './Portal.css';

const KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓'];

export default function PortalLogin() {
  const { t } = useLanguage();
  const { login, loading, error, setError } = usePortalAuth();
  const navigate = useNavigate();
  const [personalId, setPersonalId] = useState('');
  const [pin, setPin] = useState('');

  const handleKey = async (k) => {
    if (k === '⌫') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }
    if (k === '✓') {
      if (!personalId.trim()) { setError(t('portal.enterPersonalId')); return; }
      if (pin.length !== 4) { setError(t('portal.enterPin')); return; }
      const ok = await login(personalId.trim(), pin);
      if (ok) navigate('/portal/home', { replace: true });
      return;
    }
    if (pin.length < 4) {
      setPin(p => p + k);
      setError('');
    }
  };

  return (
    <div className="portal-login-wrap">
      <div className="portal-login-card">
        <div className="portal-login-logo">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h1>{t('portal.title')}</h1>
          <p>{t('portal.enterIdPin')}</p>
        </div>

        <input
          className="portal-id-input"
          type="text"
          {...{placeholder: t('portal.personalId')}}
          value={personalId}
          onChange={e => { setPersonalId(e.target.value); setError(''); }}
          autoComplete="off"
        />

        <div className="portal-pin-label">{t('portal.pin')}</div>
        <div className="portal-pin-dots">
          {[0,1,2,3].map(i => (
            <div key={i} className={`portal-pin-dot${i < pin.length ? ' filled' : ''}`} />
          ))}
        </div>

        <div className="portal-pin-pad">
          {KEYS.map(k => (
            <button
              key={k}
              className={`portal-pin-btn${k === '✓' ? ' submit' : k === '⌫' ? ' action' : ''}`}
              onClick={() => handleKey(k)}
              disabled={loading || (k !== '⌫' && k !== '✓' && pin.length >= 4)}
            >
              {k}
            </button>
          ))}
        </div>

        {error && <div className="portal-login-error">{error}</div>}
      </div>
    </div>
  );
}
