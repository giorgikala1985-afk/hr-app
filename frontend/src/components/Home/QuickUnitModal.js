import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const today = () => new Date().toISOString().slice(0, 10);

const CURRENCIES = [
  { code: 'USD', symbol: '$', flag: '🇺🇸' },
  { code: 'GEL', symbol: '₾', flag: '🇬🇪' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺' },
];

export default function QuickUnitModal({ onClose }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [unitTypes, setUnitTypes] = useState([]);
  const [overtimeRates, setOvertimeRates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [gelRate, setGelRate] = useState(null);
  const [eurRate, setEurRate] = useState(null);

  const [empSearch, setEmpSearch] = useState('');
  const [empSuggestions, setEmpSuggestions] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GEL');
  const [date, setDate] = useState(today());
  const [otRate, setOtRate] = useState('');
  const [otHours, setOtHours] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const overlayRef = useRef(null);

  const isOT = selectedUnit && (selectedUnit.name === 'OT' || selectedUnit.name === 'Overtime');

  useEffect(() => {
    api.get('/units').then(r => setUnitTypes(r.data.unit_types || [])).catch(() => {});
    api.get('/employees').then(r => setEmployees(r.data.employees || [])).catch(() => {});
    api.get('/overtime-rates').then(r => {
      const rates = r.data.overtime_rates || [];
      setOvertimeRates(rates);
      if (rates.length > 0) setOtRate(String(rates[0].rate));
    }).catch(() => {});
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(d => { if (d.rates) { setGelRate(d.rates.GEL); setEurRate(d.rates.EUR); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!empSearch.trim()) { setEmpSuggestions([]); return; }
    const q = empSearch.toLowerCase();
    setEmpSuggestions(
      employees.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        (e.personal_id || '').includes(q)
      ).slice(0, 8)
    );
  }, [empSearch, employees]);

  const toUSD = (val, cur) => {
    const v = parseFloat(val);
    if (cur === 'GEL' && gelRate) return Math.round((v / gelRate) * 100) / 100;
    if (cur === 'EUR' && eurRate) return Math.round((v / eurRate) * 100) / 100;
    return v;
  };

  const pickUnit = (ut) => { setSelectedUnit(ut); setAmount(''); setOtHours(''); setError(''); setSuccess(false); setStep(2); };
  const pickEmp = (emp) => { setSelectedEmp(emp); setEmpSearch(`${emp.first_name} ${emp.last_name}`); setEmpSuggestions([]); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmp) { setError(t('quick.errorEmp')); return; }
    if (!amount || isNaN(parseFloat(amount))) { setError(t('quick.errorAmount')); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/employees/${selectedEmp.id}/units`, {
        type: selectedUnit.name,
        amount: toUSD(amount, currency),
        date,
      });
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = (e) => { if (e.target === overlayRef.current) onClose(); };

  const directionColor = selectedUnit?.direction === 'addition' ? '#10b981' : '#ef4444';

  return (
    <div className="qum-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="qum-modal">
        {/* Header */}
        <div className="qum-header">
          {step === 2 && (
            <button className="qum-back" onClick={() => { setStep(1); setSelectedUnit(null); setError(''); setSuccess(false); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          <div className="qum-title">
            {step === 1
              ? t('quick.selectUnit')
              : <span>{selectedUnit?.name} <span style={{ color: directionColor, fontSize: 12 }}>({selectedUnit?.direction})</span></span>
            }
          </div>
          <button className="qum-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Step 1 — unit picker grid */}
        {step === 1 && (
          <div className="qum-unit-grid">
            {unitTypes.length === 0 && (
              <div className="qum-empty">{t('quick.noUnits')}</div>
            )}
            {unitTypes.map(ut => (
              <button
                key={ut.id}
                className="qum-unit-card"
                style={{ '--ut-color': ut.direction === 'addition' ? '#10b981' : '#ef4444' }}
                onClick={() => pickUnit(ut)}
              >
                <span className="qum-unit-name">{ut.name}</span>
                <span className="qum-unit-dir">{ut.direction === 'addition' ? '+' : '−'}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — entry form matching SalaryList style */}
        {step === 2 && (
          <form className="qum-form" onSubmit={handleSubmit}>
            {/* Employee search */}
            <div className="qum-field">
              <label className="qum-label">{t('quick.employee')}</label>
              <div className="qum-emp-wrap">
                <input
                  className="qum-input"
                  placeholder={t('quick.searchEmp')}
                  value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); setSelectedEmp(null); }}
                  autoFocus
                />
                {empSuggestions.length > 0 && (
                  <div className="qum-suggestions">
                    {empSuggestions.map(emp => (
                      <button key={emp.id} type="button" className="qum-suggestion" onClick={() => pickEmp(emp)}>
                        {emp.first_name} {emp.last_name}
                        {emp.personal_id && <span className="qum-pid"> · {emp.personal_id}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* OT-specific: rate + hours */}
            {isOT && (
              <div className="qum-row">
                <div className="qum-field" style={{ flex: 1 }}>
                  <label className="qum-label">{t('quick.otRate')}</label>
                  <select className="qum-input" value={otRate} onChange={e => setOtRate(e.target.value)}>
                    {overtimeRates.length > 0
                      ? overtimeRates.map(r => <option key={r.id} value={String(r.rate)}>{r.label} ({r.rate}%)</option>)
                      : <><option value="110">110%</option><option value="200">200%</option></>
                    }
                  </select>
                </div>
                <div className="qum-field" style={{ flex: 1 }}>
                  <label className="qum-label">{t('quick.otHours')}</label>
                  <input
                    className="qum-input"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
                    value={otHours}
                    onChange={e => setOtHours(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Amount + currency flags */}
            <div className="qum-field">
              <label className="qum-label">{t('quick.amount')}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="qum-input"
                  style={{ flex: 1 }}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  {CURRENCIES.map(({ code, symbol, flag }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCurrency(code)}
                      style={{
                        padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${currency === code ? 'var(--accent, #3b82f6)' : 'var(--border-2)'}`,
                        background: currency === code ? 'var(--accent, #3b82f6)' : 'var(--surface-2)',
                        color: currency === code ? '#fff' : 'var(--text-2)',
                        transition: 'all .15s',
                      }}
                    >
                      {flag} {symbol}
                    </button>
                  ))}
                </div>
              </div>
              {currency !== 'USD' && amount && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  ≈ ${toUSD(amount, currency)}
                </div>
              )}
            </div>

            {/* Date */}
            <div className="qum-field">
              <label className="qum-label">{t('quick.date')}</label>
              <input className="qum-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>

            {/* Direction hint */}
            <div style={{
              fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 6,
              background: selectedUnit?.direction === 'addition' ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.08)',
              color: directionColor, marginBottom: 4,
            }}>
              {selectedUnit?.direction === 'addition' ? t('quick.addedToNet') : t('quick.deductedFromNet')}
            </div>

            {error && <div className="qum-error">{error}</div>}
            {success && <div className="qum-success">✓ {t('quick.saved')}</div>}

            <button className="qum-submit" type="submit" disabled={saving || success}>
              {saving ? '…' : t('quick.save')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
