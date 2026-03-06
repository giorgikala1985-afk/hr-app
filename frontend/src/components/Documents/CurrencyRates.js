import React, { useState, useEffect } from 'react';

const CURRENCIES = ['USD', 'EUR', 'GBP'];

const CURRENCY_LABELS = { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound' };

const FLAG = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧' };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function CurrencyRates() {
  const [date, setDate] = useState(today());
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRates = async (d) => {
    setLoading(true);
    setError('');
    setRates([]);
    try {
      const url = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/?date=${d}&lang=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const list = json?.[0]?.currencies || [];
      setRates(list.filter(c => CURRENCIES.includes(c.code)));
    } catch {
      setError('Failed to load rates. NBG API may be unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRates(date); }, []);

  const handleDateChange = (e) => {
    setDate(e.target.value);
    fetchRates(e.target.value);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 600 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>NBG Exchange Rates</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>National Bank of Georgia — GEL rates</p>
        </div>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={handleDateChange}
          style={{
            padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
            fontSize: 13, color: '#1e293b', outline: 'none', cursor: 'pointer',
          }}
        />
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 40, fontSize: 13 }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rates.map(r => (
            <div key={r.code} style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 32 }}>{FLAG[r.code]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{r.code}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{CURRENCY_LABELS[r.code]}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {r.quantity > 1 ? `${r.quantity} ${r.code}` : `1 ${r.code}`} = <strong style={{ color: '#1e293b' }}>{r.rate?.toFixed(4)}</strong> GEL
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{r.rate?.toFixed(4)}</div>
                <div style={{
                  fontSize: 12, fontWeight: 600, marginTop: 2,
                  color: r.diff > 0 ? '#16a34a' : r.diff < 0 ? '#dc2626' : '#94a3b8',
                }}>
                  {r.diff > 0 ? '▲' : r.diff < 0 ? '▼' : '—'} {Math.abs(r.diff)?.toFixed(4)}
                </div>
              </div>
            </div>
          ))}
          {!loading && rates.length === 0 && !error && (
            <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 40, fontSize: 13 }}>No rates found for this date.</div>
          )}
        </div>
      )}
    </div>
  );
}
