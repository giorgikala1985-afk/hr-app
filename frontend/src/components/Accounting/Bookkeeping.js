import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../../services/api';

const fmt = (n) =>
  n ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const TYPE_STYLE = {
  Asset:     { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  Liability: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' },
  Equity:    { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
  Revenue:   { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  Expense:   { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
};

const EMPTY_LINE = { account: '', debit: '', credit: '' };
const EMPTY_ACCOUNT = { code: '', name: '', type: 'Asset' };

function Bookkeeping() {
  const [view, setView] = useState('journal'); // 'journal' | 'accounts'

  // Journal state
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formDesc, setFormDesc] = useState('');
  const [formLines, setFormLines] = useState([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [formError, setFormError] = useState('');

  // Accounts state
  const [accounts, setAccounts] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState('');
  const [showAccForm, setShowAccForm] = useState(false);
  const [accForm, setAccForm] = useState(EMPTY_ACCOUNT);
  const [editAccId, setEditAccId] = useState(null);
  const [accSaving, setAccSaving] = useState(false);

  useEffect(() => { loadEntries(); loadAccounts(); }, []);

  const loadEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/accounting/bookkeeping');
      setEntries(res.data.entries || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    setAccLoading(true);
    try {
      const res = await api.get('/accounting/bookkeeping-accounts');
      setAccounts(res.data.accounts || []);
    } catch (err) {
      setAccError(err.response?.data?.error || 'Failed to load accounts.');
    } finally {
      setAccLoading(false);
    }
  };

  // ── JOURNAL ──────────────────────────────────────────

  const grouped = entries.reduce((acc, e) => {
    if (!acc[e.transaction_id]) acc[e.transaction_id] = [];
    acc[e.transaction_id].push(e);
    return acc;
  }, {});

  const transactions = Object.values(grouped).sort((a, b) =>
    (b[0]?.date || '').localeCompare(a[0]?.date || '')
  );

  const filtered = transactions.filter((rows) => {
    const desc = (rows[0]?.description || '').toLowerCase();
    const accs = rows.map(r => r.account.toLowerCase()).join(' ');
    const date = rows[0]?.date || '';
    if (filterText && !desc.includes(filterText.toLowerCase()) && !accs.includes(filterText.toLowerCase())) return false;
    if (filterMonth && !date.startsWith(filterMonth)) return false;
    return true;
  });

  const totalDebit = filtered.reduce((s, rows) => s + rows.reduce((ss, r) => ss + (r.debit || 0), 0), 0);
  const totalCredit = filtered.reduce((s, rows) => s + rows.reduce((ss, r) => ss + (r.credit || 0), 0), 0);

  const updateLine = (i, field, value) =>
    setFormLines(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });

  const addLine = () => setFormLines(prev => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (i) => { if (formLines.length > 2) setFormLines(prev => prev.filter((_, idx) => idx !== i)); };

  const lineDebitTotal = formLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const lineCreditTotal = formLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(lineDebitTotal - lineCreditTotal) < 0.01;

  const openNewEntry = () => {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDesc('');
    setFormLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
    setFormError('');
    setShowForm(true);
  };

  const handleSaveEntry = async () => {
    if (!formDate) { setFormError('Date is required.'); return; }
    if (!formDesc.trim()) { setFormError('Description is required.'); return; }
    const validLines = formLines.filter(l => l.account.trim() && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) { setFormError('At least 2 lines with account and amount are required.'); return; }
    if (!isBalanced) { setFormError('Debits and credits must be equal.'); return; }
    setSaving(true); setFormError('');
    const transaction_id = uuidv4();
    try {
      await api.post('/accounting/bookkeeping/bulk', {
        entries: validLines.map(l => ({
          transaction_id, date: formDate, description: formDesc.trim(),
          account: l.account.trim(), debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0,
        })),
      });
      setShowForm(false);
      loadEntries();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleDeleteTransaction = async (transaction_id) => {
    if (!window.confirm('Delete this journal entry?')) return;
    try {
      await api.delete(`/accounting/bookkeeping/transaction/${transaction_id}`);
      loadEntries();
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete.'); }
  };

  // ── ACCOUNTS ─────────────────────────────────────────

  const openNewAccount = () => { setAccForm(EMPTY_ACCOUNT); setEditAccId(null); setAccError(''); setShowAccForm(true); };
  const openEditAccount = (a) => { setAccForm({ code: a.code || '', name: a.name, type: a.type }); setEditAccId(a.id); setAccError(''); setShowAccForm(true); };

  const handleSaveAccount = async () => {
    if (!accForm.name.trim()) { setAccError('Name is required.'); return; }
    setAccSaving(true); setAccError('');
    try {
      if (editAccId) await api.put(`/accounting/bookkeeping-accounts/${editAccId}`, accForm);
      else await api.post('/accounting/bookkeeping-accounts', accForm);
      setShowAccForm(false);
      loadAccounts();
    } catch (err) {
      setAccError(err.response?.data?.error || 'Failed to save.');
    } finally { setAccSaving(false); }
  };

  const handleDeleteAccount = async (a) => {
    if (!window.confirm(`Delete account "${a.name}"?`)) return;
    try {
      await api.delete(`/accounting/bookkeeping-accounts/${a.id}`);
      loadAccounts();
    } catch (err) { setAccError(err.response?.data?.error || 'Failed to delete.'); }
  };

  const accountNames = accounts.map(a => (a.code ? `${a.code} - ${a.name}` : a.name));

  // ── RENDER ────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Bookkeeping</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Double-entry journal — debits always equal credits</p>
        </div>
        {view === 'journal' && (
          <button onClick={openNewEntry} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            + New Entry
          </button>
        )}
        {view === 'accounts' && (
          <button onClick={openNewAccount} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            + Add Account
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {[{ key: 'journal', label: 'Journal' }, { key: 'accounts', label: 'Accounts' }].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)} style={{
            padding: '7px 20px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: view === tab.key ? '#fff' : 'transparent',
            color: view === tab.key ? '#1e293b' : '#64748b',
            boxShadow: view === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── JOURNAL VIEW ── */}
      {view === 'journal' && (
        <>
          {error && <div style={errBox}>{error}</div>}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input placeholder="Search description or account…" value={filterText} onChange={e => setFilterText(e.target.value)}
              style={{ flex: 1, minWidth: 200, ...inpStyle }} />
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={inpStyle} />
            {(filterText || filterMonth) && (
              <button onClick={() => { setFilterText(''); setFilterMonth(''); }} style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', cursor: 'pointer', fontSize: 13 }}>Clear</button>
            )}
          </div>

          {/* Summary */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 18px' }}>
              <div style={summLabel}>Total Debit</div>
              <div style={{ ...summVal, color: '#15803d' }}>{fmt(totalDebit)}</div>
            </div>
            <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 18px' }}>
              <div style={summLabel}>Total Credit</div>
              <div style={{ ...summVal, color: '#b91c1c' }}>{fmt(totalCredit)}</div>
            </div>
            <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 18px' }}>
              <div style={summLabel}>Entries</div>
              <div style={{ ...summVal, color: '#334155' }}>{filtered.length}</div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>No journal entries yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Click "New Entry" to record your first transaction.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={th}>Date</th>
                    <th style={th}>Description</th>
                    <th style={th}>Account</th>
                    <th style={{ ...th, textAlign: 'right', color: '#16a34a' }}>Debit</th>
                    <th style={{ ...th, textAlign: 'right', color: '#dc2626' }}>Credit</th>
                    <th style={{ ...th, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rows) => {
                    const txId = rows[0].transaction_id;
                    const txDebit = rows.reduce((s, r) => s + (r.debit || 0), 0);
                    const txCredit = rows.reduce((s, r) => s + (r.credit || 0), 0);
                    return (
                      <React.Fragment key={txId}>
                        {rows.map((r, i) => (
                          <tr key={r.id} style={{ borderBottom: i === rows.length - 1 ? '2px solid #e2e8f0' : '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            <td style={{ ...td, color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{i === 0 ? r.date : ''}</td>
                            <td style={{ ...td, color: '#334155' }}>{i === 0 ? <strong>{r.description}</strong> : ''}</td>
                            <td style={{ ...td, paddingLeft: r.credit > 0 ? 32 : 14, color: '#1e293b' }}>{r.account}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#15803d', fontWeight: r.debit > 0 ? 600 : 400 }}>{r.debit > 0 ? fmt(r.debit) : ''}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#b91c1c', fontWeight: r.credit > 0 ? 600 : 400 }}>{r.credit > 0 ? fmt(r.credit) : ''}</td>
                            <td style={td}>
                              {i === 0 && (
                                <button onClick={() => handleDeleteTransaction(txId)} title="Delete"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }}
                                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                  onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                  </svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f8fafc', borderBottom: '3px solid #e2e8f0' }}>
                          <td colSpan={3} style={{ ...td, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>transaction total</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16a34a' }}>{fmt(txDebit)}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>{fmt(txCredit)}</td>
                          <td style={td}></td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── ACCOUNTS VIEW ── */}
      {view === 'accounts' && (
        <>
          {accError && <div style={errBox}>{accError}</div>}
          {accLoading ? (
            <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>
          ) : accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>No accounts yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Add accounts to use them in journal entries.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={th}>Code</th>
                    <th style={th}>Name</th>
                    <th style={th}>Type</th>
                    <th style={{ ...th, width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => {
                    const ts = TYPE_STYLE[a.type] || TYPE_STYLE.Asset;
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...td, fontFamily: 'monospace', color: '#64748b', fontSize: 13 }}>{a.code || '—'}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#1e293b' }}>{a.name}</td>
                        <td style={td}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, ...ts }}>{a.type}</span>
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEditAccount(a)} title="Edit"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 4 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button onClick={() => handleDeleteAccount(a)} title="Delete"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }}
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Account Form Modal */}
          {showAccForm && (
            <div style={overlay} onClick={() => setShowAccForm(false)}>
              <div style={modal} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
                  {editAccId ? 'Edit Account' : 'New Account'}
                </h3>
                {accError && <div style={{ ...errBox, marginBottom: 14 }}>{accError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Code</label>
                    <input value={accForm.code} onChange={e => setAccForm({ ...accForm, code: e.target.value })}
                      placeholder="e.g. 1000" style={inpStyle} />
                  </div>
                  <div>
                    <label style={lbl}>Name *</label>
                    <input value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })}
                      placeholder="e.g. Cash" style={inpStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Type *</label>
                  <select value={accForm.type} onChange={e => setAccForm({ ...accForm, type: e.target.value })}
                    style={{ ...inpStyle, background: '#fff' }}>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowAccForm(false)} style={cancelBtn}>Cancel</button>
                  <button onClick={handleSaveAccount} disabled={accSaving} style={primaryBtn}>
                    {accSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* New Journal Entry Modal */}
      {showForm && (
        <div style={overlay} onClick={() => setShowForm(false)}>
          <div style={{ ...modal, maxWidth: 660 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>New Journal Entry</h3>
            {formError && <div style={{ ...errBox, marginBottom: 14 }}>{formError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inpStyle} />
              </div>
              <div>
                <label style={lbl}>Description *</label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)}
                  placeholder="e.g. Office rent payment" style={inpStyle} />
              </div>
            </div>

            {/* datalist for account autocomplete */}
            <datalist id="bk-accounts">
              {accountNames.map((n, i) => <option key={i} value={n} />)}
            </datalist>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 32px', background: '#f8fafc', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <span>Account</span>
                <span style={{ textAlign: 'right', color: '#16a34a' }}>Debit</span>
                <span style={{ textAlign: 'right', color: '#dc2626' }}>Credit</span>
                <span></span>
              </div>
              {formLines.map((line, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 32px', borderTop: '1px solid #f1f5f9', padding: '6px 12px', alignItems: 'center' }}>
                  <input list="bk-accounts" value={line.account} onChange={e => updateLine(i, 'account', e.target.value)}
                    placeholder="Account name" style={{ ...inpStyle, borderRadius: 6, fontSize: 13 }} />
                  <input type="number" min="0" step="0.01" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)}
                    placeholder="0.00" style={{ ...inpStyle, borderRadius: 6, fontSize: 13, textAlign: 'right', color: '#15803d' }} />
                  <input type="number" min="0" step="0.01" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)}
                    placeholder="0.00" style={{ ...inpStyle, borderRadius: 6, fontSize: 13, textAlign: 'right', color: '#b91c1c' }} />
                  <button onClick={() => removeLine(i)} disabled={formLines.length <= 2}
                    style={{ background: 'none', border: 'none', cursor: formLines.length <= 2 ? 'default' : 'pointer', color: formLines.length <= 2 ? '#e2e8f0' : '#94a3b8', fontSize: 16 }}>×</button>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 32px', borderTop: '2px solid #e2e8f0', padding: '8px 12px', background: '#f8fafc' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Total</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#15803d' }}>{fmt(lineDebitTotal)}</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#b91c1c' }}>{fmt(lineCreditTotal)}</span>
                <span></span>
              </div>
            </div>

            <div style={{ marginBottom: 20, fontSize: 13 }}>
              {isBalanced && lineDebitTotal > 0
                ? <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Balanced</span>
                : <span style={{ color: '#dc2626', fontWeight: 600 }}>Difference: {fmt(Math.abs(lineDebitTotal - lineCreditTotal))}</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={addLine} style={{ background: 'none', border: '1px dashed #cbd5e1', borderRadius: 7, padding: '6px 14px', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
                + Add line
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
                <button onClick={handleSaveEntry} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Post Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', whiteSpace: 'nowrap' };
const td = { padding: '9px 14px', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 };
const inpStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const summLabel = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' };
const summVal = { fontSize: 20, fontWeight: 700, marginTop: 2 };
const errBox = { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal = { background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const cancelBtn = { padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', fontSize: 14 };
const primaryBtn = { padding: '8px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };

export default Bookkeeping;
