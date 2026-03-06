import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import portalApi from '../../services/portalApi';

function fmt(n) {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PortalPayroll() {
  const [searchParams] = useSearchParams();
  const [month, setMonth] = useState(searchParams.get('month') || currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch = (m) => {
    setLoading(true);
    setError('');
    setData(null);
    portalApi.get(`/payroll?month=${m}`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load payroll data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(month); }, [month]);

  const handleMonth = (e) => {
    setMonth(e.target.value);
  };

  const additions = data?.units?.filter(u => u.is_addition) || [];
  const deductions = data?.units?.filter(u => !u.is_addition) || [];

  return (
    <div>
      <div className="portal-payroll-header">
        <p className="portal-page-title" style={{ margin: 0 }}>Payroll</p>
        <input
          type="month"
          className="portal-month-input"
          value={month}
          max={currentMonth()}
          onChange={handleMonth}
        />
      </div>

      {loading && <div className="portal-spinner">Loading...</div>}
      {error && <div className="portal-login-error">{error}</div>}

      {data && !loading && (
        <>
          {/* Summary card */}
          <div className="portal-card">
            <div className="portal-payroll-row">
              <span className="portal-payroll-label">Working days</span>
              <span>{data.days_worked} / {data.working_days}</span>
            </div>
            {data.holiday_days > 0 && (
              <div className="portal-payroll-row">
                <span className="portal-payroll-label">Holidays</span>
                <span>{data.holiday_days} days</span>
              </div>
            )}
            <div className="portal-payroll-row">
              <span className="portal-payroll-label">Base salary</span>
              <span>{fmt(data.base_salary)} GEL</span>
            </div>
            <div className="portal-payroll-row">
              <span className="portal-payroll-label">Accrued (prorated)</span>
              <span>{fmt(data.accrued_salary)} GEL</span>
            </div>
            {data.carry_over > 0 && (
              <div className="portal-payroll-row">
                <span className="portal-payroll-label">Carry-over from prev. month</span>
                <span className="portal-amount-positive">+{fmt(data.carry_over)} GEL</span>
              </div>
            )}
            {data.total_additions > 0 && (
              <div className="portal-payroll-row">
                <span className="portal-payroll-label">Additions</span>
                <span className="portal-amount-positive">+{fmt(data.total_additions)} GEL</span>
              </div>
            )}
            {data.total_deductions > 0 && (
              <div className="portal-payroll-row">
                <span className="portal-payroll-label">Deductions</span>
                <span className="portal-amount-negative">−{fmt(data.total_deductions)} GEL</span>
              </div>
            )}
            {data.insurance_deduction > 0 && (
              <div className="portal-payroll-row">
                <span className="portal-payroll-label">Insurance</span>
                <span className="portal-amount-negative">−{fmt(data.insurance_deduction)} GEL</span>
              </div>
            )}
            {data.is_deferred && (
              <div className="portal-payroll-row">
                <span className="portal-payroll-label" style={{ color: '#f59e0b' }}>Salary deferred this month</span>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Deferred</span>
              </div>
            )}
            <div className="portal-payroll-row total">
              <span className="portal-payroll-label">Net salary</span>
              <span className="portal-amount-main">{fmt(data.net_salary)} GEL</span>
            </div>
          </div>

          {/* Units breakdown */}
          {(additions.length > 0 || deductions.length > 0) && (
            <div className="portal-card">
              <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#374151' }}>Breakdown</p>
              {additions.map(u => (
                <div key={u.id} className="portal-payroll-row">
                  <span className="portal-payroll-label">{u.type}</span>
                  <span className="portal-amount-positive">+{fmt(u.amount)} {u.currency || 'GEL'}</span>
                </div>
              ))}
              {deductions.map(u => (
                <div key={u.id} className="portal-payroll-row">
                  <span className="portal-payroll-label">{u.type}</span>
                  <span className="portal-amount-negative">−{fmt(u.amount)} {u.currency || 'GEL'}</span>
                </div>
              ))}
            </div>
          )}

          {data.days_worked === 0 && (
            <div className="portal-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              No payroll data for this month
            </div>
          )}
        </>
      )}
    </div>
  );
}
