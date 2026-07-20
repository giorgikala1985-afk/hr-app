import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { parseStatementAmount } from '../../utils/bankAmount';
import { fetchTbcRawStatement } from '../../utils/tbcStatement';

const fmt = (n) =>
  n != null ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';

// ── Bank reconciliation: reads the raw TBC Excel upload saved by the
// Data Lake → TBC Bank tab (per-company, via Supabase) and matches rows
// against calculated salaries by IBAN or by name. ──
function parseTbcStatementRows(rows, fileName, savedAt) {
  if (!rows || rows.length < 2) return null;
  const headers = rows[0].map(h => String(h).trim());
  const idx = (target) => headers.findIndex(h => h === target);
  const ibanIdx = idx('ანგარიშის ნომერი');
  const dateIdx = idx('თარიღი');
  const nameIdx = idx('დამატებითი ინფორმაცია');
  const amountIdx = idx('თანხა');
  const purposeIdx = headers.findIndex(h => /დანიშნულება|purpose|description/i.test(h));
  if (ibanIdx === -1 && nameIdx === -1) return null;

  const transactions = rows.slice(1).map(r => ({
    iban: ibanIdx >= 0 ? String(r[ibanIdx] || '').replace(/\s+/g, '').toUpperCase() : '',
    date: dateIdx >= 0 ? String(r[dateIdx] || '') : '',
    name: nameIdx >= 0 ? String(r[nameIdx] || '').trim() : '',
    // Salary transfers are outgoing (debit) and export as negative in TBC
    // statements; take the absolute value since we're only ever comparing
    // against a positive net_salary figure here.
    amount: amountIdx >= 0 ? Math.abs(parseStatementAmount(r[amountIdx])) : 0,
    purpose: purposeIdx >= 0 ? String(r[purposeIdx] || '').trim() : '',
  })).filter(t => t.iban || t.name);

  return { fileName, savedAt, transactions, hasAmount: amountIdx >= 0, hasDate: dateIdx >= 0, hasPurpose: purposeIdx >= 0 };
}

async function loadTbcStatement() {
  const s = await fetchTbcRawStatement();
  if (!s) return null;
  return parseTbcStatementRows(s.rows, s.fileName, s.savedAt);
}

function parseTxDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/); // DD.MM.YYYY (Georgian convention)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Canonicalizes Georgian surname spelling variants — bank exports often
// spell "ძ" (single letter, "dz" sound) as "დზ" (two separate letters), e.g.
// "სალდაძე" vs "სალდადზე" for the same person. Collapsing both to one form
// lets substring matching still work regardless of which spelling was used.
const normalizeName = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-zა-ჰ\s]/gi, '')
  .replace(/დზ/g, 'ძ')
  .replace(/\s+/g, ' ')
  .trim();

// Requires "ხელფასი"/"salary" in the purpose field when that column exists,
// so a matching name/IBAN alone (e.g. a refund or invoice payment) doesn't
// get miscounted as a salary transfer.
const isSalaryPurpose = (t) => {
  if (!t.purpose) return true;
  const p = t.purpose.toLowerCase();
  return p.includes('ხელფასი') || p.includes('salary');
};

function matchSalaryToTx(employee, transactions, month) {
  const empIban = String(employee.account_number || '').replace(/\s+/g, '').toUpperCase();
  const empName = normalizeName(`${employee.first_name} ${employee.last_name}`);
  const empNameRev = normalizeName(`${employee.last_name} ${employee.first_name}`);

  const candidates = transactions.filter(t => {
    if (!isSalaryPurpose(t)) return false;
    if (empIban && t.iban && t.iban === empIban) return true;
    if (!empName) return false;
    const tn = normalizeName(t.name);
    if (!tn) return false;
    return tn.includes(empName) || tn.includes(empNameRev);
  });
  if (candidates.length === 0) return null;

  const inMonth = (t) => { const d = parseTxDate(t.date); return d && d.slice(0, 7) === month; };
  const withinMonth = candidates.find(inMonth);
  const chosen = withinMonth || candidates[0];
  return {
    tx: chosen,
    matchedBy: (empIban && chosen.iban === empIban) ? 'iban' : 'name',
    inMonth: !!withinMonth,
  };
}

const SUB_TABS = [
  { key: 'settings', label: 'Settings' },
  { key: 'salary', label: 'Salary Payments' },
  { key: 'statements', label: 'Bank Statements' },
  { key: 'invoices', label: 'Pay Invoice' },
];

function TbcBanking() {
  const [activeTab, setActiveTab] = useState('settings');

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>TBC Bank</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 14 }}>Banking integration for payments, salaries, and statements</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border-2)', paddingBottom: 0 }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              color: activeTab === tab.key ? '#3b82f6' : 'var(--text-3)',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && <BankSettings />}
      {activeTab === 'salary' && <SalaryPayments />}
      {activeTab === 'statements' && <BankStatements />}
      {activeTab === 'invoices' && <InvoicePayment />}
    </div>
  );
}

// ── BANK SETTINGS ─────────────────────────────────────
function BankSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [iban, setIban] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('GEL');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tbc-bank/settings');
      const s = res.data.settings;
      if (s) {
        setSettings(s);
        setIban(s.company_iban || '');
        setCompanyName(s.company_name || '');
        setCurrency(s.default_currency || 'GEL');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!iban.trim()) { setError('Company IBAN is required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.put('/tbc-bank/settings', {
        company_iban: iban.trim(),
        company_name: companyName.trim(),
        default_currency: currency,
      });
      setSettings(res.data.settings);
      setSuccess('Bank settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 24 }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 520 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>TBC Bank Configuration</h3>

      {error && <div style={errBox}>{error}</div>}
      {success && <div style={successBox}>{success}</div>}

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Company IBAN *</label>
        <input
          value={iban}
          onChange={e => setIban(e.target.value)}
          placeholder="GE29TB0000000000000000"
          style={inpStyle}
        />
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, display: 'block' }}>
          Your company's TBC Bank account IBAN for outgoing payments
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Company Name</label>
        <input
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="Your Company LLC"
          style={inpStyle}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={lbl}>Default Currency</label>
        <select value={currency} onChange={e => setCurrency(e.target.value)} style={inpStyle}>
          <option value="GEL">GEL - Georgian Lari</option>
          <option value="USD">USD - US Dollar</option>
          <option value="EUR">EUR - Euro</option>
        </select>
      </div>

      <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {settings && (
        <div style={{ marginTop: 24, padding: 16, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border-2)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>Current Configuration</div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            <div><strong>IBAN:</strong> {settings.company_iban}</div>
            {settings.company_name && <div><strong>Company:</strong> {settings.company_name}</div>}
            <div><strong>Currency:</strong> {settings.default_currency}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: 'rgba(59,130,246,0.08)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>Environment Variables Required</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace', lineHeight: 1.8 }}>
          TBC_API_BASE_URL<br />
          TBC_API_KEY<br />
          TBC_CLIENT_ID<br />
          TBC_CLIENT_SECRET
        </div>
      </div>
    </div>
  );
}

// ── SALARY PAYMENTS ──────────────────────────────────
function SalaryPayments() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [salaries, setSalaries] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tbcStatement, setTbcStatement] = useState(null);

  const refreshTbcStatement = useCallback(() => { loadTbcStatement().then(setTbcStatement); }, []);
  useEffect(() => { refreshTbcStatement(); }, [refreshTbcStatement]);

  const loadSalaries = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/salaries?month=${month}`);
      const sals = (res.data.salaries || []).filter(s => s.net_salary > 0);
      setSalaries(sals);
      setSelected(new Set(sals.map(s => s.employee.id)));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load salaries');
    } finally {
      setLoading(false);
    }
  }, [month]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/tbc-bank/salary-payments');
      setHistory(res.data.records || []);
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadSalaries(); }, [loadSalaries]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === salaries.length) setSelected(new Set());
    else setSelected(new Set(salaries.map(s => s.employee.id)));
  };

  const reconciliation = useMemo(() => {
    if (!tbcStatement || salaries.length === 0) return null;
    const rows = salaries.map(s => {
      const match = matchSalaryToTx(s.employee, tbcStatement.transactions, month);
      let status = 'notfound';
      if (match) {
        const diff = Math.abs(match.tx.amount - s.net_salary);
        status = diff < 0.01 ? 'paid' : 'mismatch';
      }
      return { salary: s, match, status };
    });
    const counts = {
      paid: rows.filter(r => r.status === 'paid').length,
      mismatch: rows.filter(r => r.status === 'mismatch').length,
      notfound: rows.filter(r => r.status === 'notfound').length,
    };
    return { rows, counts };
  }, [tbcStatement, salaries, month]);

  const handlePaySalaries = async () => {
    const payments = salaries
      .filter(s => selected.has(s.employee.id))
      .map(s => ({
        employeeId: s.employee.id,
        employeeName: `${s.employee.first_name} ${s.employee.last_name}`,
        iban: s.employee.account_number || '',
        amount: s.net_salary,
        currency: 'GEL',
      }));

    const missingIban = payments.filter(p => !p.iban);
    if (missingIban.length > 0) {
      setError(`${missingIban.length} employee(s) have no bank account: ${missingIban.map(p => p.employeeName).join(', ')}`);
      return;
    }

    if (!window.confirm(`Send salary payments for ${payments.length} employees (total: ${fmt(payments.reduce((s, p) => s + p.amount, 0))} GEL)?`)) return;

    setProcessing(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/tbc-bank/salary-payment', { month, employeePayments: payments });
      setSuccess(res.data.message);
      loadHistory();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process salary payments');
    } finally {
      setProcessing(false);
    }
  };

  const totalSelected = salaries.filter(s => selected.has(s.employee.id)).reduce((sum, s) => sum + s.net_salary, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>Month:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inpStyle, width: 180 }} />
        <button onClick={loadSalaries} style={{ ...secondaryBtn }} disabled={loading}>
          {loading ? 'Loading...' : 'Load Salaries'}
        </button>
      </div>

      {error && <div style={{ ...errBox, marginBottom: 14 }}>{error}</div>}
      {success && <div style={{ ...successBox, marginBottom: 14 }}>{success}</div>}

      {salaries.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                  <th style={{ ...th, width: 40 }}>
                    <input type="checkbox" checked={selected.size === salaries.length} onChange={toggleAll} />
                  </th>
                  <th style={th}>Employee</th>
                  <th style={th}>Account/IBAN</th>
                  <th style={{ ...th, textAlign: 'right' }}>Net Salary</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((s, i) => (
                  <tr key={s.employee.id} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <td style={td}>
                      <input type="checkbox" checked={selected.has(s.employee.id)} onChange={() => toggleSelect(s.employee.id)} />
                    </td>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>
                      {s.employee.first_name} {s.employee.last_name}
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: s.employee.account_number ? 'var(--text-2)' : '#f87171' }}>
                      {s.employee.account_number || 'No account'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>
                      {fmt(s.net_salary)}
                    </td>
                    <td style={td}>
                      {s.employee.account_number
                        ? <span style={{ fontSize: 11, color: '#4ade80', background: 'rgba(22,163,74,0.12)', padding: '2px 8px', borderRadius: 4 }}>Ready</span>
                        : <span style={{ fontSize: 11, color: '#f87171', background: 'rgba(220,38,38,0.12)', padding: '2px 8px', borderRadius: 4 }}>Missing IBAN</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border-2)' }}>
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
              <strong>{selected.size}</strong> employees selected &middot; Total: <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{fmt(totalSelected)} GEL</strong>
            </div>
            <button onClick={handlePaySalaries} disabled={processing || selected.size === 0} style={{ ...primaryBtn, opacity: (processing || selected.size === 0) ? 0.6 : 1 }}>
              {processing ? 'Processing...' : `Pay ${selected.size} Employees via TBC`}
            </button>
          </div>
        </>
      )}

      {/* Bank Reconciliation */}
      {salaries.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Bank Reconciliation</h3>
            <button onClick={refreshTbcStatement} style={{ ...secondaryBtn, fontSize: 12, padding: '6px 14px' }}>
              Refresh from Data Lake
            </button>
          </div>

          {!tbcStatement ? (
            <div style={{ background: 'rgba(234,179,8,0.1)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              No TBC bank statement found. Upload one in <strong>Data Lake → TBC Bank</strong>, then click Refresh above.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                Matching against <strong>{tbcStatement.fileName}</strong> · {tbcStatement.transactions.length} transactions
                {!tbcStatement.hasAmount && <span style={{ color: '#f87171' }}> · No "თანხა" column detected — amounts will show as 0</span>}
                {!tbcStatement.hasPurpose && <span style={{ color: '#fbbf24' }}> · No "დანიშნულება" column detected — matching by name/IBAN only, without confirming it's a salary transfer</span>}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={statCard('#16a34a')}>
                  <div style={statLabel}>Paid</div>
                  <div style={{ ...statValue, color: '#4ade80' }}>{reconciliation.counts.paid}</div>
                </div>
                <div style={statCard('#f59e0b')}>
                  <div style={statLabel}>Amount Mismatch</div>
                  <div style={{ ...statValue, color: '#fbbf24' }}>{reconciliation.counts.mismatch}</div>
                </div>
                <div style={statCard('#dc2626')}>
                  <div style={statLabel}>Not Found</div>
                  <div style={{ ...statValue, color: '#f87171' }}>{reconciliation.counts.notfound}</div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                      <th style={th}>Employee</th>
                      <th style={th}>Bank Statement Name</th>
                      <th style={th}>Date</th>
                      <th style={{ ...th, textAlign: 'right' }}>Bank Amount</th>
                      <th style={{ ...th, textAlign: 'right' }}>Expected</th>
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliation.rows.map(({ salary: s, match, status }, i) => (
                      <tr key={s.employee.id} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                        <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{s.employee.first_name} {s.employee.last_name}</td>
                        <td style={{ ...td, color: 'var(--text-2)' }}>{match ? match.tx.name : '—'}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>
                          {match ? match.tx.date : '—'}
                          {match && !match.inMonth && <span style={{ color: '#fbbf24', marginLeft: 6 }} title="Matched transaction is outside the selected month">⚠</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>
                          {match ? fmt(match.tx.amount) : '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-2)' }}>{fmt(s.net_salary)}</td>
                        <td style={td}>
                          {status === 'paid' && <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', background: 'rgba(22,163,74,0.12)', padding: '2px 8px', borderRadius: 4 }}>Paid ✓</span>}
                          {status === 'mismatch' && <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', background: 'rgba(234,179,8,0.12)', padding: '2px 8px', borderRadius: 4 }}>Amount Mismatch</span>}
                          {status === 'notfound' && <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', background: 'rgba(220,38,38,0.12)', padding: '2px 8px', borderRadius: 4 }}>Not Found</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Payment History */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Payment History</h3>
        {historyLoading ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
        ) : history.length === 0 ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No salary payments recorded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                  <th style={th}>Month</th>
                  <th style={th}>Employees</th>
                  <th style={{ ...th, textAlign: 'right' }}>Total</th>
                  <th style={th}>Status</th>
                  <th style={th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{h.month}</td>
                    <td style={td}>{h.employee_count}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(h.total_amount)}</td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        ...(h.status === 'completed' ? { color: '#4ade80', background: 'rgba(22,163,74,0.12)' }
                          : h.status === 'failed' ? { color: '#f87171', background: 'rgba(220,38,38,0.12)' }
                          : { color: '#fbbf24', background: 'rgba(234,179,8,0.12)' }),
                      }}>
                        {h.status}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--text-3)', fontSize: 12 }}>{new Date(h.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Excel column fuzzy matching for TBC statement exports ──
const norm = s => String(s).toLowerCase().replace(/[\s_\-.]+/g, '').trim();
const getCol = (row, ...keys) => {
  const normKeys = keys.map(norm);
  for (const col of Object.keys(row)) {
    if (normKeys.includes(norm(col))) return row[col];
  }
  return undefined;
};
const excelDateToStr = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{2}[./]\d{2}[./]\d{4}/.test(str)) {
    const [d, m, y] = str.split(/[./]/);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return str;
};
const toNum = parseStatementAmount;

function parseStatementExcel(data) {
  return data.map(row => {
    const date = excelDateToStr(getCol(row, 'Date', 'თარიღი', 'ოპერაციის თარიღი', 'Booking Date', 'Value Date', 'Transaction Date', 'დამატების თარიღი'));
    const description = getCol(row, 'Description', 'დანიშნულება', 'Purpose', 'Details', 'Remittance Information', 'გადახდის დანიშნულება', 'ოპერაციის დანიშნულება') || '';
    const counterparty = getCol(row, 'Counterparty', 'Beneficiary', 'Payee', 'Payer', 'მიმღები', 'გადამხდელი', 'Name', 'Contragent', 'კონტრაგენტი', 'მეორე მხარე') || '';
    const currency = String(getCol(row, 'Currency', 'ვალუტა', 'Ccy') || 'GEL').toUpperCase().trim();
    const debit = getCol(row, 'Debit', 'დებეტი', 'Withdrawal', 'Outgoing', 'Expense', 'გასავალი');
    const credit = getCol(row, 'Credit', 'კრედიტი', 'Deposit', 'Incoming', 'Income', 'შემოსავალი');
    let amount;
    if (debit !== undefined || credit !== undefined) {
      amount = toNum(credit) - toNum(debit);
    } else {
      amount = toNum(getCol(row, 'Amount', 'თანხა', 'Sum', 'Value'));
    }
    const balance = getCol(row, 'Balance', 'ნაშთი', 'Running Balance');
    const docNumber = getCol(row, 'Document Number', 'დოკუმენტის ნომერი', 'Reference', 'Ref', 'Doc No', 'ნომერი');
    return {
      date, description, currency, amount,
      creditorName: amount >= 0 ? counterparty : '',
      debtorName: amount < 0 ? counterparty : '',
      balance: balance !== undefined ? toNum(balance) : null,
      docNumber: docNumber || '',
      _valid: !!date && !!counterparty,
    };
  });
}

function IconUpload() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/>
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19,12 12,19 5,12"/>
    </svg>
  );
}

// ── BANK STATEMENTS ──────────────────────────────────
function BankStatements() {
  const [mode, setMode] = useState('upload'); // 'upload' | 'api'

  // Upload mode state
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef(null);

  // API mode state
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [apiLoading, setApiLoading] = useState(false);

  // Shared state
  const [transactions, setTransactions] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTx, setSelectedTx] = useState(new Set());
  const [search, setSearch] = useState('');

  const resetResults = () => {
    setTransactions(null);
    setSelectedTx(new Set());
    setError(''); setSuccess(''); setParseError('');
  };

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    resetResults();
    setFileName('');
  };

  // ── Excel upload ──
  const processFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    resetResults();
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (data.length === 0) { setParseError('The file appears to be empty.'); return; }
        const parsed = parseStatementExcel(data);
        const valid = parsed.filter(t => t._valid);
        if (valid.length === 0) {
          const cols = Object.keys(data[0]).join(', ');
          setParseError(`Couldn't detect date/counterparty columns. Columns found: ${cols}`);
          return;
        }
        setTransactions(valid);
        setSelectedTx(new Set(valid.map((_, i) => i)));
      } catch (err) {
        setParseError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInput = (e) => processFile(e.target.files[0]);
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) processFile(file);
    else setParseError('Please upload a .xlsx or .xls file.');
  };
  const clearFile = () => {
    setFileName(''); resetResults();
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── API fetch ──
  const loadStatements = async () => {
    if (!accountId.trim()) { setError('Account ID / IBAN is required'); return; }
    setApiLoading(true); resetResults();
    try {
      const params = new URLSearchParams({ accountId: accountId.trim() });
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      const res = await api.get(`/tbc-bank/statements?${params.toString()}`);
      const txs = res.data?.statements?.transactions || [];
      setTransactions(txs);
      setSelectedTx(new Set(txs.map((_, i) => i)));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch statements');
    } finally {
      setApiLoading(false);
    }
  };

  // ── Shared: filtering, selection, import ──
  const filtered = useMemo(() => {
    if (!transactions) return [];
    if (!search.trim()) return transactions.map((tx, i) => ({ tx, i }));
    const q = search.toLowerCase();
    return transactions
      .map((tx, i) => ({ tx, i }))
      .filter(({ tx }) =>
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.creditorName || '').toLowerCase().includes(q) ||
        (tx.debtorName || '').toLowerCase().includes(q)
      );
  }, [transactions, search]);

  const toggleTx = (idx) => {
    setSelectedTx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };
  const toggleAllFiltered = () => {
    const filteredIdx = filtered.map(f => f.i);
    const allSelected = filteredIdx.every(i => selectedTx.has(i));
    setSelectedTx(prev => {
      const next = new Set(prev);
      filteredIdx.forEach(i => allSelected ? next.delete(i) : next.add(i));
      return next;
    });
  };

  const handleImport = async () => {
    if (!transactions) return;
    const txs = transactions.filter((_, i) => selectedTx.has(i));
    if (txs.length === 0) { setError('No transactions selected'); return; }
    if (!window.confirm(`Import ${txs.length} transactions into accounting?`)) return;

    setImporting(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/tbc-bank/statements/import', { transactions: txs });
      setSuccess(`${res.data.imported} transactions imported successfully`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import');
    } finally {
      setImporting(false);
    }
  };

  // ── Summary stats (grouped by currency) ──
  const stats = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const byCcy = {};
    transactions.forEach(tx => {
      const ccy = tx.currency || 'GEL';
      if (!byCcy[ccy]) byCcy[ccy] = { count: 0, income: 0, expense: 0 };
      byCcy[ccy].count += 1;
      if ((tx.amount || 0) >= 0) byCcy[ccy].income += tx.amount;
      else byCcy[ccy].expense += Math.abs(tx.amount);
    });
    return Object.entries(byCcy).map(([ccy, s]) => ({ ccy, ...s, net: s.income - s.expense }));
  }, [transactions]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(f => selectedTx.has(f.i));

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 3, background: 'var(--surface-2)', borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content' }}>
        {[
          { key: 'upload', label: 'Upload Excel' },
          { key: 'api', label: 'Fetch via API' },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => switchMode(m.key)}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              background: mode === m.key ? 'var(--surface)' : 'transparent',
              color: mode === m.key ? 'var(--text)' : 'var(--text-3)',
              boxShadow: mode === m.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s',
            }}
          >{m.label}</button>
        ))}
      </div>

      {mode === 'upload' && !transactions && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#3b82f6' : 'var(--border-2)'}`,
            borderRadius: 16, padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
            background: dragOver ? 'rgba(59,130,246,0.06)' : 'var(--surface-2)',
            transition: 'all 0.15s', marginBottom: 16,
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} style={{ display: 'none' }} />
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'rgba(59,130,246,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <IconUpload />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            Drop your TBC bank statement here
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>
            or click to browse · .xlsx or .xls
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 12 }}>
            Supports Date, Description, Counterparty, Debit/Credit or Amount, Currency columns (English or Georgian)
          </div>
        </div>
      )}

      {mode === 'upload' && fileName && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 16px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{fileName}</span>
          <button onClick={clearFile} style={{ ...secondaryBtn, padding: '5px 12px', fontSize: 12 }}>Clear</button>
        </div>
      )}

      {mode === 'upload' && parseError && <div style={{ ...errBox, marginBottom: 14 }}>{parseError}</div>}

      {mode === 'api' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Account ID / IBAN *</label>
            <input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="GE29TB..." style={{ ...inpStyle, width: 260 }} />
          </div>
          <div>
            <label style={lbl}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inpStyle, width: 160 }} />
          </div>
          <div>
            <label style={lbl}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inpStyle, width: 160 }} />
          </div>
          <button onClick={loadStatements} disabled={apiLoading} style={primaryBtn}>
            {apiLoading ? 'Loading...' : 'Fetch Statements'}
          </button>
        </div>
      )}

      {error && <div style={{ ...errBox, marginBottom: 14 }}>{error}</div>}
      {success && <div style={{ ...successBox, marginBottom: 14 }}>{success}</div>}

      {transactions && transactions.length > 0 && (
        <>
          {/* Summary stat cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={statCard()}>
              <div style={statLabel}>Transactions</div>
              <div style={{ ...statValue, color: 'var(--text)' }}>{transactions.length}</div>
            </div>
            {stats.map(s => (
              <React.Fragment key={s.ccy}>
                <div style={statCard('#16a34a')}>
                  <div style={statLabel}>Income {stats.length > 1 ? `(${s.ccy})` : ''}</div>
                  <div style={{ ...statValue, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconArrowUp />{fmt(s.income)} {s.ccy}
                  </div>
                </div>
                <div style={statCard('#dc2626')}>
                  <div style={statLabel}>Expense {stats.length > 1 ? `(${s.ccy})` : ''}</div>
                  <div style={{ ...statValue, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconArrowDown />{fmt(s.expense)} {s.ccy}
                  </div>
                </div>
                <div style={statCard(s.net >= 0 ? '#16a34a' : '#dc2626')}>
                  <div style={statLabel}>Net {stats.length > 1 ? `(${s.ccy})` : ''}</div>
                  <div style={{ ...statValue, color: s.net >= 0 ? '#4ade80' : '#f87171' }}>
                    {s.net >= 0 ? '+' : ''}{fmt(s.net)} {s.ccy}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Search */}
          <div style={{ marginBottom: 14 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search description or counterparty..."
              style={{ ...inpStyle, width: 320 }}
            />
          </div>

          <div style={{
            border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden', marginBottom: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                    <th style={{ ...th, width: 40, position: 'sticky', top: 0, background: 'var(--surface-2)' }}>
                      <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
                    </th>
                    <th style={{ ...th, position: 'sticky', top: 0, background: 'var(--surface-2)' }}>Date</th>
                    <th style={{ ...th, position: 'sticky', top: 0, background: 'var(--surface-2)' }}>Description</th>
                    <th style={{ ...th, position: 'sticky', top: 0, background: 'var(--surface-2)' }}>Counterparty</th>
                    <th style={{ ...th, textAlign: 'right', position: 'sticky', top: 0, background: 'var(--surface-2)' }}>Amount</th>
                    <th style={{ ...th, position: 'sticky', top: 0, background: 'var(--surface-2)' }}>Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ tx, i }) => {
                    const isIncome = (tx.amount || 0) >= 0;
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid var(--border-2)',
                          background: selectedTx.has(i) ? 'rgba(59,130,246,0.05)' : (i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)'),
                          transition: 'background 0.1s',
                        }}
                      >
                        <td style={td}><input type="checkbox" checked={selectedTx.has(i)} onChange={() => toggleTx(i)} /></td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{tx.bookingDate || tx.date || '-'}</td>
                        <td style={{ ...td, color: 'var(--text-2)' }}>{tx.remittanceInformation || tx.description || '-'}</td>
                        <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{tx.creditorName || tx.debtorName || '-'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontFamily: 'monospace', fontWeight: 700,
                            color: isIncome ? '#4ade80' : '#f87171',
                            background: isIncome ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                            padding: '3px 9px', borderRadius: 6, fontSize: 12.5,
                          }}>
                            {isIncome ? <IconArrowUp /> : <IconArrowDown />}
                            {isIncome ? '+' : ''}{fmt(tx.amount)}
                          </span>
                        </td>
                        <td style={{ ...td, fontSize: 12, color: 'var(--text-3)' }}>{tx.currency || 'GEL'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button onClick={handleImport} disabled={importing || selectedTx.size === 0} style={{ ...primaryBtn, opacity: (importing || selectedTx.size === 0) ? 0.6 : 1 }}>
            {importing ? 'Importing...' : `Import ${selectedTx.size} Transaction${selectedTx.size !== 1 ? 's' : ''} to Accounting`}
          </button>
        </>
      )}

      {transactions && transactions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>No transactions found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting the date range.</div>
        </div>
      )}
    </div>
  );
}

// ── INVOICE PAYMENT ──────────────────────────────────
function InvoicePayment() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadInvoices(); }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/invoices');
      // Show unpaid invoices with account numbers
      setInvoices((res.data.records || []).filter(inv => inv.status !== 'paid'));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (invoice) => {
    if (!invoice.account_number) {
      setError(`Invoice "${invoice.invoice_number}" has no account number/IBAN. Edit the invoice to add one.`);
      return;
    }

    if (!window.confirm(`Pay ${fmt(invoice.total)} ${invoice.currency || 'GEL'} to ${invoice.client}?`)) return;

    setPaying(invoice.id); setError(''); setSuccess('');
    try {
      const res = await api.post('/tbc-bank/pay-invoice', {
        invoiceId: invoice.id,
        creditorIban: invoice.account_number,
        creditorName: invoice.client,
        amount: invoice.total,
        currency: invoice.currency || 'GEL',
        description: `Invoice ${invoice.invoice_number || ''} - ${invoice.client}`,
      });
      setSuccess(res.data.message);
      loadInvoices();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to pay invoice');
    } finally {
      setPaying(null);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 24 }}>Loading invoices...</div>;

  return (
    <div>
      {error && <div style={{ ...errBox, marginBottom: 14 }}>{error}</div>}
      {success && <div style={{ ...successBox, marginBottom: 14 }}>{success}</div>}

      {invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>No unpaid invoices</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>All invoices are paid or no invoices exist.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                <th style={th}>Invoice #</th>
                <th style={th}>Client</th>
                <th style={th}>Account/IBAN</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={th}>Due Date</th>
                <th style={th}>Status</th>
                <th style={{ ...th, width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{inv.invoice_number || '-'}</td>
                  <td style={{ ...td, color: 'var(--text)' }}>{inv.client}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: inv.account_number ? 'var(--text-2)' : '#f87171' }}>
                    {inv.account_number || 'No account'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>
                    {fmt(inv.total)} {inv.currency || 'GEL'}
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>{inv.due_date || '-'}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      color: '#fbbf24', background: 'rgba(234,179,8,0.12)',
                    }}>
                      {inv.status || 'pending'}
                    </span>
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => handlePay(inv)}
                      disabled={paying === inv.id || !inv.account_number}
                      style={{
                        ...primaryBtn,
                        fontSize: 12,
                        padding: '6px 14px',
                        opacity: (paying === inv.id || !inv.account_number) ? 0.5 : 1,
                      }}
                    >
                      {paying === inv.id ? 'Paying...' : 'Pay via TBC'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared styles ────────────────────────────────────
const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', whiteSpace: 'nowrap' };
const td = { padding: '9px 14px', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 };
const inpStyle = { padding: '8px 10px', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface-2)', color: 'var(--text)' };
const errBox = { background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 };
const successBox = { background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 };
const primaryBtn = { padding: '8px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const secondaryBtn = { padding: '8px 18px', border: '1px solid var(--border-2)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 };
const statCard = (accent) => ({
  flex: '1 1 160px', minWidth: 160, padding: '14px 18px', borderRadius: 12,
  background: 'var(--surface)', border: '1px solid var(--border-2)',
  borderLeft: accent ? `3px solid ${accent}` : '1px solid var(--border-2)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
});
const statLabel = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 };
const statValue = { fontSize: 18, fontWeight: 800, fontFamily: 'monospace' };

export default TbcBanking;
