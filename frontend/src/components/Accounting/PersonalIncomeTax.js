import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const todayMonth = () => new Date().toISOString().slice(0, 7);

function prevMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nextMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmtMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function isBizTrip(type) {
  const t = (type || '').toLowerCase();
  return t.includes('business trip') || t.includes('business_trip') || t.includes('სამივლინებო');
}

function bizTripSum(r) {
  return (r.deductions || [])
    .filter(u => isBizTrip(u.type))
    .reduce((s, u) => s + parseFloat(u.amount || 0), 0);
}

function fmt(val) {
  if (!val) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

export default function PersonalIncomeTax() {
  const [month, setMonth] = useState(todayMonth());
  const [rows, setRows] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(month); }, [month]);

  const load = async (m) => {
    setLoading(true); setError('');
    try {
      const [salRes, insRes] = await Promise.all([
        api.get(`/salaries?month=${m}`),
        api.get('/insurance-list'),
      ]);
      setRows(salRes.data?.salaries || []);
      setInsurance(insRes.data?.records || []);
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  };

  const normalizeId = (id) => String(id || '').trim().replace(/\s+/g, '');

  const idsMatch = (a, b) => {
    const na = normalizeId(a);
    const nb = normalizeId(b);
    if (!na || !nb) return false;
    return na === nb || na.replace(/^0+/, '') === nb.replace(/^0+/, '');
  };

  const dateMatchesMonth = (date, m) => {
    if (!date) return false;
    const d = String(date).trim();
    if (d.startsWith(m)) return true;
    // try parsing in case format is different
    try {
      const parsed = new Date(d);
      if (!isNaN(parsed)) {
        const y = parsed.getFullYear();
        const mo = String(parsed.getMonth() + 1).padStart(2, '0');
        return `${y}-${mo}` === m;
      }
    } catch {}
    return false;
  };

  // Get insurance amount2 for a personal_id in the selected month
  const getInsAmount2 = (personalId) => {
    if (!personalId) return 0;
    const matches = insurance.filter(rec => {
      if (!idsMatch(rec.personal_id, personalId)) return false;
      // check period first (explicit payroll month), then fall back to date
      const dateToCheck = rec.period || rec.date;
      return dateMatchesMonth(dateToCheck, month);
    });
    return matches.reduce((s, rec) => s + parseFloat(rec.amount2 || 0), 0);
  };

  const totalBizTrip = rows.reduce((s, r) => s + bizTripSum(r), 0);
  const totalIns2 = rows.reduce((s, r) => s + getInsAmount2(r.employee?.personal_id), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 15, color: 'var(--text-2)' }}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', minWidth: 160, textAlign: 'center' }}>{fmtMonth(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 15, color: 'var(--text-2)' }}>›</button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={thStyle}>Personal ID</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Last Name</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Business Trip</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Insurance Amount 2</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>No data for this month.</td></tr>
              ) : rows.map((r, i) => {
                const trip = bizTripSum(r);
                const ins2 = getInsAmount2(r.employee?.personal_id);
                return (
                  <tr key={r.employee?.id || i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{r.employee?.personal_id || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.employee?.first_name || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.employee?.last_name || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: trip ? 'var(--text)' : 'var(--text-3)', fontWeight: trip ? 600 : 400 }}>
                      {trip ? `$${fmt(trip)}` : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: ins2 ? 'var(--text)' : 'var(--text-3)', fontWeight: ins2 ? 600 : 400 }}>
                      {ins2 ? fmt(ins2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {(totalBizTrip > 0 || totalIns2 > 0) && (
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3} style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-3)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{totalBizTrip ? `$${fmt(totalBizTrip)}` : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{totalIns2 ? fmt(totalIns2) : '—'}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '9px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '11px 14px',
  color: 'var(--text)',
};
