import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Accounting.css';

const FONT_MONO = 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';
const TBC_STORAGE_KEY = 'tbc_excel_data';

const todayMonth = () => new Date().toISOString().slice(0, 7);
function fmtMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
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
function fmtGEL(n) {
  return `₾${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}
function normalizeId(id) {
  return String(id || '').trim().replace(/\s+/g, '');
}
function idsMatch(a, b) {
  const na = normalizeId(a), nb = normalizeId(b);
  if (!na || !nb) return false;
  return na === nb || na.replace(/^0+/, '') === nb.replace(/^0+/, '');
}
function dateMatchesMonth(date, m) {
  if (!date) return false;
  const d = String(date).trim();
  if (d.startsWith(m)) return true;
  try {
    const p = new Date(d);
    if (!isNaN(p)) return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}` === m;
  } catch {}
  return false;
}

// ── TBC helpers ────────────────────────────────────────────────────────────
function parseTBCDate(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    // Excel serial number (e.g. 46106)
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const s = String(val).trim();
  if (!s) return null;
  // DD/MM/YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function dateToMonth(d) {
  if (!d || isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function findColIdx(headers, keywords) {
  const kw = keywords.map(k => k.toLowerCase());
  return headers.findIndex(h => kw.some(k => String(h).toLowerCase().includes(k)));
}
function loadTBCForMonth(month) {
  try {
    const stored = localStorage.getItem(TBC_STORAGE_KEY);
    if (!stored) return null;
    const { rows } = JSON.parse(stored);
    if (!rows || rows.length < 2) return null;
    const headers = rows[0];
    const dateCol = findColIdx(headers, ['თარიღი', 'date']);
    const outCol  = findColIdx(headers, ['გასული', 'debit', 'withdrawal', 'გამოსული', 'დებეტი', 'out']);
    if (dateCol === -1) return { rows: [], headers, outCol, missing: true };
    const filtered = rows.slice(1).filter(row => {
      const d = parseTBCDate(row[dateCol]);
      return d && dateToMonth(d) === month;
    });
    return { rows: filtered, headers, outCol, missing: outCol === -1 };
  } catch {
    return null;
  }
}
function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).replace(/\s/g, '').replace(',', '.');
  return parseFloat(s.replace(/[^\d.-]/g, '')) || 0;
}
function getTBCAmount(tbc, emp) {
  if (!tbc || !tbc.rows.length || tbc.outCol === -1) return null;
  const first = (emp.first_name || '').toLowerCase().trim();
  const last  = (emp.last_name  || '').toLowerCase().trim();
  if (!first && !last) return null;

  const matched = tbc.rows.filter(row =>
    row.some((cell, idx) => {
      if (idx === tbc.outCol) return false;
      const val = String(cell || '').toLowerCase();
      return (first.length > 1 && val.includes(first)) ||
             (last.length  > 1 && val.includes(last));
    })
  );
  if (!matched.length) return null;
  return matched.reduce((s, row) => s + parseAmount(row[tbc.outCol]), 0);
}
// ───────────────────────────────────────────────────────────────────────────

const TH = ({ right, children }) => (
  <th style={{
    background: 'var(--surface-2)', color: 'var(--text-3)',
    fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px',
    padding: '10px 16px', textAlign: right ? 'right' : 'left',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  }}>{children}</th>
);

function Transferred({ month: initialMonth }) {
  const [month, setMonth] = useState(initialMonth || todayMonth());
  const [salaries, setSalaries] = useState([]);
  const [insuranceList, setInsuranceList] = useState([]);
  const [tbc, setTbc] = useState(null);
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!month) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/salaries?month=${month}`),
      api.get('/insurance-list'),
    ])
      .then(([salRes, insRes]) => {
        const all = salRes.data?.salaries || [];
        setSalaries(all.filter(r => r.accrued_salary > 0 || r.net_salary > 0));
        setInsuranceList(insRes.data?.records || []);
      })
      .catch(() => setError('Failed to load salary data.'))
      .finally(() => setLoading(false));
    setTbc(loadTBCForMonth(month));
  }, [month]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/?date=${today}&lang=en`)
      .then(r => r.json())
      .then(json => {
        const usd = (json?.[0]?.currencies || []).find(c => c.code === 'USD');
        if (usd) setRate(usd.rate / (usd.quantity || 1));
      })
      .catch(() => {
        fetch('https://api.exchangerate-api.com/v4/latest/USD')
          .then(r => r.json())
          .then(d => { if (d.rates?.GEL) setRate(d.rates.GEL); })
          .catch(() => {});
      });
  }, []);

  const getIns2 = (personalId) =>
    insuranceList
      .filter(rec => idsMatch(rec.personal_id, personalId) && dateMatchesMonth(rec.period || rec.date, month))
      .reduce((s, rec) => s + parseFloat(rec.amount2 || 0), 0);

  const rows = salaries.map(r => {
    const emp = r.employee;
    const ins2 = getIns2(emp?.personal_id);
    const corrected = parseFloat(r.net_salary || 0) + parseFloat(r.insurance_deduction || 0) - ins2;
    const gel = rate ? Math.round(corrected * rate * 100) / 100 : null;
    const tbcAmount = getTBCAmount(tbc, emp);
    return { emp, gel, tbcAmount };
  });

  const totalGEL = rows.reduce((s, r) => s + (r.gel || 0), 0);
  const totalTBC = rows.reduce((s, r) => s + (r.tbcAmount || 0), 0);
  const hasTBC   = tbc && !tbc.missing && tbc.rows.length > 0;

  return (
    <div style={{ width: '100%' }}>
      <div className="sa-month-bar" style={{ marginBottom: 16 }}>
        <button className="sa-arrow" onClick={() => setMonth(prevMonth(month))}>‹</button>
        <span className="sa-month-label">{fmtMonth(month)}</span>
        <button className="sa-arrow" onClick={() => setMonth(nextMonth(month))}>›</button>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="sa-month-input" />
        {tbc && !tbc.missing && (
          <span style={{ fontSize: 12, color: '#479c73', marginLeft: 10 }}>
            ✓ TBC: {tbc.rows.length} row{tbc.rows.length !== 1 ? 's' : ''} matched to period
            {tbc.outCol !== -1 && tbc.headers?.[tbc.outCol] &&
              <span style={{ color: 'var(--text-4)' }}> · amount col: "{tbc.headers[tbc.outCol]}"</span>}
          </span>
        )}
        {tbc && tbc.missing && (
          <span style={{ fontSize: 12, color: '#f59e0b', marginLeft: 10 }}>
            ⚠ TBC loaded — columns: [{(tbc.headers || []).join(', ')}]
          </span>
        )}
        {!tbc && (
          <span style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 10 }}>
            No TBC file — upload one in Data Lake → TBC Bank
          </span>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', color: 'var(--text-3)', fontSize: 14 }}>
          <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'dl-spin 0.7s linear infinite' }} />
          Loading...
        </div>
      )}
      {error && <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>}
      {!loading && !error &&
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-4)' }}>
            {rows.length} employees · {rate ? `Rate: ₾${rate.toFixed(4)}` : 'Rate unavailable'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <TH>#</TH>
                  <TH>Name</TH>
                  <TH>Last Name</TH>
                  <TH right>Total GEL</TH>
                  <TH right>გასული თანხა</TH>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ emp, gel, tbcAmount }, i) => {
                  const match = gel != null && tbcAmount != null && Math.abs(gel - tbcAmount) < 0.01;
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text-4)', fontFamily: FONT_MONO, fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text)' }}>{emp.first_name}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text)' }}>{emp.last_name}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700, color: match ? '#479c73' : '#f59e0b' }}>
                        {gel != null ? fmtGEL(gel) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700, color: match ? '#479c73' : tbcAmount != null ? '#479c73' : 'var(--text-4)' }}>
                        {tbcAmount != null ? fmtGEL(tbcAmount) : hasTBC ? '—' : ''}
                      </td>
                    </tr>
                  );
                })}
                {rows.length > 0 && (() => {
                  const totalMatch = hasTBC && totalTBC > 0 && Math.abs(totalGEL - totalTBC) < 0.01;
                  return (
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td colSpan={3} style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>Total</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700, color: totalMatch ? '#479c73' : '#f59e0b', fontSize: 14 }}>
                        {fmtGEL(totalGEL)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: FONT_MONO, fontWeight: 700, color: '#479c73', fontSize: 14 }}>
                        {hasTBC && totalTBC > 0 ? fmtGEL(totalTBC) : ''}
                      </td>
                    </tr>
                  );
                })()}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-4)' }}>No salary data for this month</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  );
}

export default Transferred;
