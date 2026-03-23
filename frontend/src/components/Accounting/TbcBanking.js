import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const fmt = (n) =>
  n != null ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';

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

// ── BANK STATEMENTS ──────────────────────────────────
function BankStatements() {
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statements, setStatements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTx, setSelectedTx] = useState(new Set());

  const loadStatements = async () => {
    if (!accountId.trim()) { setError('Account ID / IBAN is required'); return; }
    setLoading(true); setError(''); setStatements(null);
    try {
      const params = new URLSearchParams({ accountId: accountId.trim() });
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      const res = await api.get(`/tbc-bank/statements?${params.toString()}`);
      const data = res.data.statements;
      setStatements(data);
      // Auto-select all transactions
      if (data?.transactions) {
        setSelectedTx(new Set(data.transactions.map((_, i) => i)));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch statements');
    } finally {
      setLoading(false);
    }
  };

  const toggleTx = (idx) => {
    setSelectedTx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleImport = async () => {
    if (!statements?.transactions) return;
    const txs = statements.transactions.filter((_, i) => selectedTx.has(i));
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

  return (
    <div>
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
        <button onClick={loadStatements} disabled={loading} style={primaryBtn}>
          {loading ? 'Loading...' : 'Fetch Statements'}
        </button>
      </div>

      {error && <div style={{ ...errBox, marginBottom: 14 }}>{error}</div>}
      {success && <div style={{ ...successBox, marginBottom: 14 }}>{success}</div>}

      {statements?.transactions && statements.transactions.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                  <th style={{ ...th, width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedTx.size === statements.transactions.length}
                      onChange={() => {
                        if (selectedTx.size === statements.transactions.length) setSelectedTx(new Set());
                        else setSelectedTx(new Set(statements.transactions.map((_, i) => i)));
                      }}
                    />
                  </th>
                  <th style={th}>Date</th>
                  <th style={th}>Description</th>
                  <th style={th}>Counterparty</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                  <th style={th}>Currency</th>
                </tr>
              </thead>
              <tbody>
                {statements.transactions.map((tx, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <td style={td}><input type="checkbox" checked={selectedTx.has(i)} onChange={() => toggleTx(i)} /></td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{tx.bookingDate || tx.date}</td>
                    <td style={{ ...td, color: 'var(--text-2)' }}>{tx.remittanceInformation || tx.description || '-'}</td>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{tx.creditorName || tx.debtorName || '-'}</td>
                    <td style={{
                      ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700,
                      color: (tx.amount || 0) >= 0 ? '#4ade80' : '#f87171',
                    }}>
                      {(tx.amount || 0) >= 0 ? '+' : ''}{fmt(tx.amount)}
                    </td>
                    <td style={{ ...td, fontSize: 12, color: 'var(--text-3)' }}>{tx.currency || 'GEL'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={handleImport} disabled={importing || selectedTx.size === 0} style={{ ...primaryBtn, opacity: (importing || selectedTx.size === 0) ? 0.6 : 1 }}>
            {importing ? 'Importing...' : `Import ${selectedTx.size} Transactions to Accounting`}
          </button>
        </>
      )}

      {statements && (!statements.transactions || statements.transactions.length === 0) && (
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

export default TbcBanking;
