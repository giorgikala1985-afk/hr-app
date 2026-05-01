import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const fmt = (n) =>
  n ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';

const TYPE_STYLE = {
  Asset:     { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  Liability: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' },
  Equity:    { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
  Revenue:   { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  Expense:   { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
};

const EMPTY_LINE = { debitAccount: '', creditAccount: '', amount: '' };

function Bookkeeping() {
  const { t } = useLanguage();
  const [view, setView] = useState('transactions');

  // Entries
  const [entries, setEntries] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState('');

  // Standard transaction form
  const [showTxForm, setShowTxForm] = useState(false);
  const [editTxId, setEditTxId] = useState(null);
  const [txSaving, setTxSaving] = useState(false);
  const [txFormError, setTxFormError] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formDesc, setFormDesc] = useState('');
  const [formLines, setFormLines] = useState([{ ...EMPTY_LINE }]);
  const [formAgentId, setFormAgentId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [agentOpen, setAgentOpen] = useState(false);

  // T-Account form
  const [showTModal, setShowTModal] = useState(false);
  const [tDate, setTDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tDesc, setTDesc] = useState('');
  const [tDebit, setTDebit] = useState([]);   // [{id, account, code, amount}]
  const [tCredit, setTCredit] = useState([]); // [{id, account, code, amount}]
  const [tAgentId, setTAgentId] = useState('');
  const [tAgentSearch, setTAgentSearch] = useState('');
  const [tAgentOpen, setTAgentOpen] = useState(false);
  const [tError, setTError] = useState('');
  const [tSaving, setTSaving] = useState(false);
  const [tAccSearch, setTAccSearch] = useState('');
  const [dragOver, setDragOver] = useState(null); // 'debit' | 'credit'
  const dragAcc = useRef(null);

  // Filters
  const [filterMonth, setFilterMonth] = useState('');
  const [filterText, setFilterText] = useState('');

  // Trial Balance
  const [tbFilterMonth, setTbFilterMonth] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const toggleAccount = (account) => setExpandedAccounts(prev => {
    const next = new Set(prev);
    next.has(account) ? next.delete(account) : next.add(account);
    return next;
  });

  // Accounts state (used for transaction datalist + T-account modal)
  const [accounts, setAccounts] = useState([]);
  const [agents, setAgents] = useState([]);

  useEffect(() => { loadEntries(); loadAccounts(); loadAgents(); }, []);

  const loadEntries = async () => {
    setTxLoading(true); setTxError('');
    try {
      const res = await api.get('/accounting/bookkeeping');
      setEntries(res.data.entries || []);
    } catch (err) {
      setTxError(err.response?.data?.error || 'Failed to load transactions.');
    } finally { setTxLoading(false); }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/accounting/bookkeeping-accounts');
      setAccounts(res.data.accounts || []);
    } catch {}
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/accounting/agents');
      setAgents(res.data.records || []);
    } catch {}
  };

  const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));
  const accountCodeMap = accounts.reduce((m, a) => {
    if (a.code) { m[a.name] = a.code; m[`${a.code} - ${a.name}`] = a.code; }
    return m;
  }, {});
  const accountNames = accounts.map(a => a.code ? `${a.code} - ${a.name}` : a.name);

  // ── TRANSACTIONS ──────────────────────────────────────

  const grouped = entries.reduce((acc, e) => {
    if (!acc[e.transaction_id]) acc[e.transaction_id] = { debit: [], credit: [], meta: e };
    if (e.debit > 0) acc[e.transaction_id].debit.push(e);
    else acc[e.transaction_id].credit.push(e);
    return acc;
  }, {});

  const allTxRows = Object.values(grouped)
    .sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''))
    .flatMap(g => {
      const len = Math.max(g.debit.length, g.credit.length, 1);
      return Array.from({ length: len }, (_, i) => ({
        txId: g.meta.transaction_id, date: g.meta.date, isFirst: i === 0,
        debit: g.debit[i] || null, credit: g.credit[i] || null,
        desc: g.meta.description, agentId: g.meta.agent_id,
        amount: g.debit[i]?.debit || g.credit[i]?.credit || 0,
      }));
    });

  const filteredRows = allTxRows.filter(r => {
    if (filterMonth && !(r.date || '').startsWith(filterMonth)) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      if (!(r.desc || '').toLowerCase().includes(q) &&
          !(r.debit?.account || '').toLowerCase().includes(q) &&
          !(r.credit?.account || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openNewTx = () => {
    setEditTxId(null); setFormDate(new Date().toISOString().slice(0, 10));
    setFormDesc(''); setFormLines([{ ...EMPTY_LINE }]);
    setFormAgentId(''); setAgentSearch(''); setAgentOpen(false);
    setTxFormError(''); setShowTxForm(true);
  };

  const openEditTx = (txId) => {
    const g = grouped[txId];
    if (!g) return;
    const len = Math.max(g.debit.length, g.credit.length, 1);
    setEditTxId(txId);
    setFormDate(g.meta.date || new Date().toISOString().slice(0, 10));
    setFormDesc(g.meta.description || '');
    setFormLines(Array.from({ length: len }, (_, i) => ({
      debitAccount: g.debit[i]?.account || '',
      creditAccount: g.credit[i]?.account || '',
      amount: g.debit[i]?.debit ? String(g.debit[i].debit) : (g.credit[i]?.credit ? String(g.credit[i].credit) : ''),
    })));
    const agent = agents.find(a => a.id === g.meta.agent_id);
    setFormAgentId(g.meta.agent_id || '');
    setAgentSearch(agent ? agent.name : '');
    setAgentOpen(false); setTxFormError(''); setShowTxForm(true);
  };

  const handleSaveTx = async () => {
    if (!formDate) { setTxFormError('Date is required.'); return; }
    if (!formDesc.trim()) { setTxFormError('Description is required.'); return; }
    const validLines = formLines.filter(l => l.debitAccount.trim() && l.creditAccount.trim() && parseFloat(l.amount) > 0);
    if (validLines.length < 1) { setTxFormError('At least one complete line is required.'); return; }
    setTxSaving(true); setTxFormError('');
    const transaction_id = editTxId || uuidv4();
    try {
      if (editTxId) await api.delete(`/accounting/bookkeeping/transaction/${editTxId}`);
      await api.post('/accounting/bookkeeping/bulk', {
        entries: validLines.flatMap(l => [
          { transaction_id, date: formDate, description: formDesc.trim(), account: l.debitAccount.trim(), debit: parseFloat(l.amount), credit: 0, agent_id: formAgentId || null },
          { transaction_id, date: formDate, description: formDesc.trim(), account: l.creditAccount.trim(), debit: 0, credit: parseFloat(l.amount), agent_id: formAgentId || null },
        ]),
      });
      setShowTxForm(false); loadEntries();
    } catch (err) {
      setTxFormError(err.response?.data?.error || 'Failed to save.');
    } finally { setTxSaving(false); }
  };

  const handleDeleteTx = async (txId) => {
    if (!window.confirm('Delete transaction?')) return;
    try {
      await api.delete(`/accounting/bookkeeping/transaction/${txId}`);
      loadEntries();
    } catch (err) { setTxError(err.response?.data?.error || 'Failed to delete.'); }
  };

  // ── T-ACCOUNT FORM ────────────────────────────────────

  const openTModal = () => {
    setTDate(new Date().toISOString().slice(0, 10));
    setTDesc(''); setTDebit([]); setTCredit([]);
    setTAgentId(''); setTAgentSearch(''); setTAgentOpen(false);
    setTError(''); setTAccSearch(''); setShowTModal(true);
  };

  const dropOnSide = (side) => {
    const acc = dragAcc.current;
    if (!acc) return;
    const newEntry = { id: uuidv4(), account: acc.name, code: acc.code || '', amount: '' };
    if (side === 'debit') setTDebit(prev => [...prev, newEntry]);
    else setTCredit(prev => [...prev, newEntry]);
    setDragOver(null);
    dragAcc.current = null;
  };

  const updateTEntry = (side, id, amount) => {
    const setter = side === 'debit' ? setTDebit : setTCredit;
    setter(prev => prev.map(e => e.id === id ? { ...e, amount } : e));
  };

  const removeTEntry = (side, id) => {
    const setter = side === 'debit' ? setTDebit : setTCredit;
    setter(prev => prev.filter(e => e.id !== id));
  };

  const tDebitTotal = tDebit.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const tCreditTotal = tCredit.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const handleTSave = async () => {
    if (!tDate) { setTError('Date is required.'); return; }
    if (!tDesc.trim()) { setTError('Description is required.'); return; }
    const validD = tDebit.filter(e => e.account && parseFloat(e.amount) > 0);
    const validC = tCredit.filter(e => e.account && parseFloat(e.amount) > 0);
    if (validD.length === 0) { setTError('At least one debit entry is required.'); return; }
    if (validC.length === 0) { setTError('At least one credit entry is required.'); return; }
    setTSaving(true); setTError('');
    const transaction_id = uuidv4();
    try {
      await api.post('/accounting/bookkeeping/bulk', {
        entries: [
          ...validD.map(e => ({ transaction_id, date: tDate, description: tDesc.trim(), account: e.account, debit: parseFloat(e.amount), credit: 0, agent_id: tAgentId || null })),
          ...validC.map(e => ({ transaction_id, date: tDate, description: tDesc.trim(), account: e.account, debit: 0, credit: parseFloat(e.amount), agent_id: tAgentId || null })),
        ],
      });
      setShowTModal(false); loadEntries();
    } catch (err) {
      setTError(err.response?.data?.error || 'Failed to save.');
    } finally { setTSaving(false); }
  };

  // ── TRIAL BALANCE ─────────────────────────────────────
  const tbEntries = tbFilterMonth ? entries.filter(e => (e.date || '').startsWith(tbFilterMonth)) : entries;
  const trialBalance = Object.values(
    tbEntries.reduce((acc, e) => {
      if (!acc[e.account]) acc[e.account] = { account: e.account, debit: 0, credit: 0 };
      acc[e.account].debit  += e.debit  || 0;
      acc[e.account].credit += e.credit || 0;
      return acc;
    }, {})
  ).sort((a, b) => a.account.localeCompare(b.account));
  const tbTotalDebit  = trialBalance.reduce((s, r) => s + r.debit,  0);
  const tbTotalCredit = trialBalance.reduce((s, r) => s + r.credit, 0);

  // filtered accounts for T-modal sidebar
  const tAccList = accounts.filter(a =>
    !tAccSearch ||
    a.name.toLowerCase().includes(tAccSearch.toLowerCase()) ||
    (a.code || '').includes(tAccSearch)
  );

  // ── RENDER ────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{t('bk.title')}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 14 }}>{t('bk.subtitle')}</p>
        </div>
        {view === 'transactions' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={openTModal} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'var(--surface-2)', color: '#7c3aed', border: '1px solid var(--border-2)', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              {t('bk.tAccountEntry')}
            </button>
            <button onClick={openNewTx} className="btn-add">
              {t('bk.newTransaction')}
            </button>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {[{ key: 'transactions', label: t('bk.transactions') }, { key: 'trial-balance', label: t('bk.trialBalance') }].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)} style={{
            padding: '7px 20px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            background: view === tab.key ? 'var(--surface)' : 'transparent',
            color: view === tab.key ? 'var(--text)' : 'var(--text-3)',
            boxShadow: view === tab.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
            transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── TRANSACTIONS VIEW ── */}
      {view === 'transactions' && (
        <>
          {txError && <div style={errBox}>{txError}</div>}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input placeholder={t('bk.searchPlaceholder')} value={filterText} onChange={e => setFilterText(e.target.value)} style={{ flex: 1, minWidth: 200, ...inpStyle }} />
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inpStyle, width: 'auto' }} />
            {(filterText || filterMonth) && (
              <button onClick={() => { setFilterText(''); setFilterMonth(''); }} style={{ padding: '8px 14px', border: '1px solid var(--border-2)', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>{t('bk.clear')}</button>
            )}
          </div>

          {txLoading ? (
            <div style={{ color: 'var(--text-4)', padding: 24 }}>{t('bk.loading')}</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-4)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-3)' }}>{t('bk.noTransactions')}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{t('bk.noTransactionsHint')}</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                    <th style={th}>{t('bk.colDate')}</th>
                    <th style={{ ...th, color: '#16a34a' }}>{t('bk.colDebit')}</th>
                    <th style={{ ...th, color: '#dc2626' }}>{t('bk.colCredit')}</th>
                    <th style={th}>{t('bk.colDescription')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('bk.colAmount')}</th>
                    <th style={th}>{t('bk.colProject')}</th>
                    <th style={{ ...th, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => {
                    const debitCode = row.debit ? (accountCodeMap[row.debit.account] || '—') : '—';
                    const creditCode = row.credit ? (accountCodeMap[row.credit.account] || '—') : '—';
                    const isLastInTx = i === filteredRows.length - 1 || filteredRows[i + 1]?.txId !== row.txId;
                    return (
                      <tr key={`${row.txId}-${i}`} style={{ borderBottom: isLastInTx ? '2px solid var(--border-2)' : '1px solid var(--border-3)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                        <td style={{ ...td, color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{row.isFirst ? row.date : ''}</td>
                        <td style={{ ...td, color: '#15803d', fontWeight: 500 }}>{row.debit?.account || ''}</td>
                        <td style={{ ...td, color: '#b91c1c', fontWeight: 500 }}>{row.credit?.account || ''}</td>
                        <td style={{ ...td, color: 'var(--text-2)' }}>{row.isFirst ? row.desc : ''}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text)' }}>{row.amount > 0 ? fmt(row.amount) : ''}</td>
                        <td style={td}>
                          {row.isFirst && row.agentId && agentMap[row.agentId] && (
                            <span style={{ fontSize: 11, background: '#f0f4ff', color: '#4f46e5', padding: '2px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {agentMap[row.agentId]}
                            </span>
                          )}
                        </td>
                        <td style={td}>
                          {row.isFirst && (
                            <div style={{ display: 'flex', gap: 2 }}>
                              <button onClick={() => openEditTx(row.txId)} title="Edit"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button onClick={() => handleDeleteTx(row.txId)} title="Delete"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Standard Transaction Modal */}
          {showTxForm && (
            <div style={overlay} onClick={() => setShowTxForm(false)}>
              <div style={{ ...modal, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{editTxId ? t('bk.editTransaction') : t('bk.newTransactionModal')}</h3>
                {txFormError && <div style={{ ...errBox, marginBottom: 14 }}>{txFormError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
                  <div><label style={lbl}>{t('bk.date')}</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inpStyle} /></div>
                  <div><label style={lbl}>{t('bk.description')}</label><input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="e.g. Office rent" style={inpStyle} /></div>
                </div>
                <datalist id="bk-accs">
                  {accountNames.map((n, i) => <option key={i} value={n} />)}
                </datalist>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 28px', gap: 6, marginBottom: 4 }}>
                    <div style={{ ...lbl, marginBottom: 0, color: '#15803d' }}>{t('bk.debitAccount')}</div>
                    <div style={{ ...lbl, marginBottom: 0, color: '#b91c1c' }}>{t('bk.creditAccount')}</div>
                    <div style={{ ...lbl, marginBottom: 0, textAlign: 'right' }}>{t('bk.amount')}</div>
                    <div />
                  </div>
                  {formLines.map((line, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 28px', gap: 6, marginBottom: 6 }}>
                      <input list="bk-accs" value={line.debitAccount} onChange={e => { const l = [...formLines]; l[idx] = { ...l[idx], debitAccount: e.target.value }; setFormLines(l); }} placeholder="Debit account…" style={{ ...inpStyle, borderColor: line.debitAccount ? '#bbf7d0' : '#e2e8f0', color: '#15803d' }} />
                      <input list="bk-accs" value={line.creditAccount} onChange={e => { const l = [...formLines]; l[idx] = { ...l[idx], creditAccount: e.target.value }; setFormLines(l); }} placeholder="Credit account…" style={{ ...inpStyle, borderColor: line.creditAccount ? '#fca5a5' : '#e2e8f0', color: '#b91c1c' }} />
                      <input type="number" min="0" step="0.01" value={line.amount} onChange={e => { const l = [...formLines]; l[idx] = { ...l[idx], amount: e.target.value }; setFormLines(l); }} placeholder="0.00" style={{ ...inpStyle, textAlign: 'right', fontFamily: 'monospace' }} />
                      {formLines.length > 1 ? (
                        <button type="button" onClick={() => setFormLines(formLines.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 18, lineHeight: 1, padding: 0, alignSelf: 'center' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>×</button>
                      ) : <div />}
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormLines([...formLines, { ...EMPTY_LINE }])} style={{ marginTop: 4, padding: '5px 14px', border: '1px dashed #86efac', borderRadius: 7, background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t('bk.addLine')}</button>
                </div>
                <div style={{ marginBottom: 20, position: 'relative' }}>
                  <label style={lbl}>{t('bk.projectAgent')}</label>
                  <input value={agentSearch} onChange={e => { setAgentSearch(e.target.value); setAgentOpen(true); if (!e.target.value) setFormAgentId(''); }} onFocus={() => setAgentOpen(true)} onBlur={() => setTimeout(() => setAgentOpen(false), 150)} placeholder={t('bk.searchAgent')} style={inpStyle} />
                  {agentOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                      {agents.filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase())).map(a => (
                        <div key={a.id} onMouseDown={() => { setFormAgentId(a.id); setAgentSearch(a.name); setAgentOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--border-3)', color: 'var(--text)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                          <span style={{ fontWeight: 600 }}>{a.name}</span>
                          {a.type && <span style={{ color: 'var(--text-4)', fontSize: 12, marginLeft: 8 }}>{a.type}</span>}
                        </div>
                      ))}
                      {agents.filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase())).length === 0 && <div style={{ padding: '8px 12px', color: 'var(--text-4)', fontSize: 13 }}>{t('bk.agentNotFound')}</div>}
                    </div>
                  )}
                  {formAgentId && <button type="button" onClick={() => { setFormAgentId(''); setAgentSearch(''); }} style={{ position: 'absolute', right: 8, top: 30, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowTxForm(false)} style={cancelBtn}>{t('bk.cancel')}</button>
                  <button onClick={handleSaveTx} disabled={txSaving} style={{ ...primaryBtn, opacity: txSaving ? 0.7 : 1 }}>{txSaving ? t('bk.saving') : editTxId ? t('bk.saveChanges') : t('bk.postTransaction')}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TRIAL BALANCE VIEW ── */}
      {view === 'trial-balance' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{t('bk.filterByMonth')}</span>
            <input type="month" value={tbFilterMonth} onChange={e => setTbFilterMonth(e.target.value)} style={{ ...inpStyle, width: 'auto' }} />
            {tbFilterMonth && <button onClick={() => setTbFilterMonth('')} style={{ padding: '8px 14px', border: '1px solid var(--border-2)', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>{t('bk.clear')}</button>}
          </div>
          {trialBalance.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-4)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-3)' }}>{t('bk.noEntries')}</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                    <th style={{ ...th, width: 70 }}>{t('bk.colCode')}</th><th style={th}>{t('bk.colAccount')}</th>
                    <th style={{ ...th, textAlign: 'right', color: '#16a34a' }}>{t('bk.colDebit')}</th>
                    <th style={{ ...th, textAlign: 'right', color: '#dc2626' }}>{t('bk.colCredit')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('bk.colBalance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.map((row, i) => {
                    const net = row.debit - row.credit;
                    const isExpanded = expandedAccounts.has(row.account);
                    const accountEntries = tbEntries.filter(e => e.account === row.account);
                    const rowBg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)';
                    return (
                      <React.Fragment key={row.account}>
                        <tr onClick={() => toggleAccount(row.account)} style={{ borderBottom: '1px solid var(--border-3)', background: rowBg, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{accountCodeMap[row.account] || '—'}</td>
                          <td style={{ ...td, fontWeight: 500, color: 'var(--text)' }}><span style={{ marginRight: 8, color: 'var(--text-4)', fontSize: 10, display: 'inline-block', width: 10 }}>{isExpanded ? '▼' : '▶'}</span>{row.account}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#15803d' }}>{row.debit > 0 ? fmt(row.debit) : '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#b91c1c' }}>{row.credit > 0 ? fmt(row.credit) : '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: net > 0 ? '#15803d' : net < 0 ? '#b91c1c' : 'var(--text-3)' }}>{net !== 0 ? `${fmt(Math.abs(net))} ${net > 0 ? 'Dr' : 'Cr'}` : '0.00'}</td>
                        </tr>
                        {isExpanded && accountEntries.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(e => {
                          const agent = e.agent_id ? agentMap[e.agent_id] : null;
                          return (
                            <tr key={e.id} style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-3)' }}>
                              <td style={td} />
                              <td style={{ ...td, paddingLeft: 30, fontSize: 12, color: 'var(--text-3)' }}>
                                <span style={{ fontFamily: 'monospace', marginRight: 12, color: 'var(--text-4)' }}>{e.date}</span>
                                {e.description}
                                {agent && (
                                  <span style={{ marginLeft: 8, color: 'var(--text-4)' }}>
                                    {'| '}
                                    <span style={{ color: '#818cf8', fontWeight: 600 }}>{agent}</span>
                                  </span>
                                )}
                              </td>
                              <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#15803d' }}>{e.debit > 0 ? fmt(e.debit) : ''}</td>
                              <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#b91c1c' }}>{e.credit > 0 ? fmt(e.credit) : ''}</td>
                              <td style={td} />
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border-2)' }}>
                    <td style={td} /><td style={{ ...td, fontWeight: 700, color: 'var(--text)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{t('bk.total')}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#15803d' }}>{fmt(tbTotalDebit)}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#b91c1c' }}>{fmt(tbTotalCredit)}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: Math.abs(tbTotalDebit - tbTotalCredit) < 0.001 ? '#16a34a' : '#dc2626' }}>
                      {Math.abs(tbTotalDebit - tbTotalCredit) < 0.001 ? t('bk.balanced') : `${t('bk.difference')}: ${fmt(Math.abs(tbTotalDebit - tbTotalCredit))}`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── T-ACCOUNT MODAL ── */}
      {showTModal && (
        <div style={overlay} onClick={() => setShowTModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '96vw', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginRight: 8 }}>{t('bk.tModalTitle')}</div>
              <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 140 }}>
                  <label style={{ ...lbl, marginBottom: 3 }}>{t('bk.date')}</label>
                  <input type="date" value={tDate} onChange={e => setTDate(e.target.value)} style={{ ...inpStyle, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ ...lbl, marginBottom: 3 }}>{t('bk.description')}</label>
                  <input value={tDesc} onChange={e => setTDesc(e.target.value)} placeholder="e.g. Monthly rent" style={{ ...inpStyle, fontSize: 13 }} />
                </div>
                <div style={{ minWidth: 180, position: 'relative' }}>
                  <label style={{ ...lbl, marginBottom: 3 }}>{t('bk.projectAgent')}</label>
                  <input value={tAgentSearch} onChange={e => { setTAgentSearch(e.target.value); setTAgentOpen(true); if (!e.target.value) setTAgentId(''); }} onFocus={() => setTAgentOpen(true)} onBlur={() => setTimeout(() => setTAgentOpen(false), 150)} placeholder={t('bk.searchAgent')} style={{ ...inpStyle, fontSize: 13 }} />
                  {tAgentOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 20, maxHeight: 160, overflowY: 'auto' }}>
                      {agents.filter(a => a.name.toLowerCase().includes(tAgentSearch.toLowerCase())).map(a => (
                        <div key={a.id} onMouseDown={() => { setTAgentId(a.id); setTAgentSearch(a.name); setTAgentOpen(false); }} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-3)', color: 'var(--text)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>{a.name}</div>
                      ))}
                    </div>
                  )}
                  {tAgentId && <button type="button" onClick={() => { setTAgentId(''); setTAgentSearch(''); }} style={{ position: 'absolute', right: 8, top: 28, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 15 }}>×</button>}
                </div>
              </div>
            </div>

            {tError && <div style={{ ...errBox, margin: '12px 28px 0' }}>{tError}</div>}

            {/* Body: accounts list + T-shape */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

              {/* Left: accounts panel */}
              <div style={{ width: 220, borderRight: '1px solid var(--border-3)', display: 'flex', flexDirection: 'column', background: 'var(--surface-2)' }}>
                <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border-3)' }}>
                  <input value={tAccSearch} onChange={e => setTAccSearch(e.target.value)} placeholder={t('bk.searchAccounts')} style={{ ...inpStyle, fontSize: 12, padding: '6px 9px' }} />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
                  {tAccList.length === 0 ? (
                    <div style={{ color: 'var(--text-4)', fontSize: 12, textAlign: 'center', padding: 16 }}>{t('bk.noAccountsFound')}</div>
                  ) : tAccList.map(a => {
                    const ts = TYPE_STYLE[a.type] || TYPE_STYLE.Asset;
                    return (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={() => { dragAcc.current = a; }}
                        onDragEnd={() => { dragAcc.current = null; }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 4, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, cursor: 'grab', userSelect: 'none', transition: 'box-shadow 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <span style={{ fontSize: 14, color: 'var(--text-4)', cursor: 'grab' }}>⠿</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                            {a.code && <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)' }}>{a.code}</span>}
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '0px 5px', borderRadius: 3, ...ts }}>{a.type}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-3)', fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>
                  Drag accounts to T
                </div>
              </div>

              {/* Right: T-Account shape */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'auto' }}>
                {/* T name bar */}
                <div style={{ textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ display: 'inline-block', borderBottom: '3px solid var(--text)', padding: '0 40px 6px', fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {tDesc || 'Transaction'}
                  </div>
                </div>

                {/* T columns */}
                <div style={{ display: 'flex', flex: 1, minHeight: 300 }}>

                  {/* Debit side */}
                  <div style={{ flex: 1, borderRight: '3px solid var(--text)', borderTop: '3px solid var(--text)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-2)', background: 'rgba(22,163,74,0.08)' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: 1 }}>Debit (Dr)</span>
                    </div>

                    {/* Drop zone */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver('debit'); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => dropOnSide('debit')}
                      style={{ flex: 1, padding: 10, minHeight: 120, background: dragOver === 'debit' ? '#dcfce7' : 'transparent', border: dragOver === 'debit' ? '2px dashed #16a34a' : '2px dashed transparent', borderRadius: 6, transition: 'all 0.15s' }}
                    >
                      {tDebit.length === 0 && dragOver !== 'debit' && (
                        <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 20 }}>Drop accounts here</div>
                      )}
                      {tDebit.map(entry => (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, background: 'var(--surface)', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {entry.code && <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)', marginRight: 5 }}>{entry.code}</span>}
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{entry.account}</span>
                          </div>
                          <input
                            type="number" min="0" step="0.01"
                            value={entry.amount}
                            onChange={e => updateTEntry('debit', entry.id, e.target.value)}
                            placeholder="0.00"
                            style={{ width: 90, padding: '4px 7px', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', textAlign: 'right', outline: 'none' }}
                          />
                          <button onClick={() => removeTEntry('debit', entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 16, lineHeight: 1, padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>×</button>
                        </div>
                      ))}
                    </div>

                    {/* Debit total */}
                    <div style={{ borderTop: '2px solid var(--text)', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', background: 'var(--surface-2)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Total Dr</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#15803d' }}>{tDebitTotal > 0 ? fmt(tDebitTotal) : '0.00'}</span>
                    </div>
                  </div>

                  {/* Credit side */}
                  <div style={{ flex: 1, borderTop: '3px solid var(--text)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-2)', background: 'rgba(185,28,28,0.08)' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 1 }}>Credit (Cr)</span>
                    </div>

                    {/* Drop zone */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver('credit'); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => dropOnSide('credit')}
                      style={{ flex: 1, padding: 10, minHeight: 120, background: dragOver === 'credit' ? '#fee2e2' : 'transparent', border: dragOver === 'credit' ? '2px dashed #dc2626' : '2px dashed transparent', borderRadius: 6, transition: 'all 0.15s' }}
                    >
                      {tCredit.length === 0 && dragOver !== 'credit' && (
                        <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 20 }}>Drop accounts here</div>
                      )}
                      {tCredit.map(entry => (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, background: 'var(--surface)', border: '1px solid #fca5a5', borderRadius: 8, padding: '6px 10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {entry.code && <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)', marginRight: 5 }}>{entry.code}</span>}
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>{entry.account}</span>
                          </div>
                          <input
                            type="number" min="0" step="0.01"
                            value={entry.amount}
                            onChange={e => updateTEntry('credit', entry.id, e.target.value)}
                            placeholder="0.00"
                            style={{ width: 90, padding: '4px 7px', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', textAlign: 'right', outline: 'none' }}
                          />
                          <button onClick={() => removeTEntry('credit', entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 16, lineHeight: 1, padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>×</button>
                        </div>
                      ))}
                    </div>

                    {/* Credit total */}
                    <div style={{ borderTop: '2px solid var(--text)', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', background: 'var(--surface-2)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>Total Cr</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#b91c1c' }}>{tCreditTotal > 0 ? fmt(tCreditTotal) : '0.00'}</span>
                    </div>
                  </div>
                </div>

                {/* Balance indicator */}
                {(tDebitTotal > 0 || tCreditTotal > 0) && (
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    {Math.abs(tDebitTotal - tCreditTotal) < 0.001 ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 14px', borderRadius: 20 }}>✓ Balanced</span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c', background: '#fff7ed', border: '1px solid #fed7aa', padding: '4px 14px', borderRadius: 20 }}>
                        Difference: {fmt(Math.abs(tDebitTotal - tCreditTotal))} ({tDebitTotal > tCreditTotal ? 'Dr' : 'Cr'} side is more)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border-3)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--surface-2)' }}>
              <button onClick={() => setShowTModal(false)} style={cancelBtn}>{t('bk.cancel')}</button>
              <button onClick={handleTSave} disabled={tSaving} style={{ ...primaryBtn, background: '#7c3aed', opacity: tSaving ? 0.7 : 1 }}>
                {tSaving ? t('bk.saving') : t('bk.postTAccount')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', whiteSpace: 'nowrap' };
const td = { padding: '9px 14px', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 };
const inpStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' };
const errBox = { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal = { background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' };
const cancelBtn = { padding: '8px 18px', border: '1px solid var(--border-2)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 14 };
const primaryBtn = { padding: '8px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };

export default Bookkeeping;
