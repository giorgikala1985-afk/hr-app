import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import api from '../../services/api';

const fmt = (n) =>
  n ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const SAMPLE_ACCOUNTS = [
  { code: '1000', name: 'Cash',                    type: 'Asset'     },
  { code: '1100', name: 'Accounts Receivable',     type: 'Asset'     },
  { code: '1200', name: 'Prepaid Expenses',        type: 'Asset'     },
  { code: '1300', name: 'Inventory',               type: 'Asset'     },
  { code: '1400', name: 'Other Current Assets',    type: 'Asset'     },
  { code: '1500', name: 'Fixed Assets',            type: 'Asset'     },
  { code: '1600', name: 'Accumulated Depreciation',type: 'Asset'     },
  { code: '2000', name: 'Accounts Payable',        type: 'Liability' },
  { code: '2100', name: 'Accrued Liabilities',     type: 'Liability' },
  { code: '2200', name: 'Notes Payable',           type: 'Liability' },
  { code: '2300', name: 'Unearned Revenue',        type: 'Liability' },
  { code: '2500', name: 'Loans Payable',           type: 'Liability' },
  { code: '3000', name: "Owner's Equity",          type: 'Equity'    },
  { code: '3100', name: 'Retained Earnings',       type: 'Equity'    },
  { code: '3200', name: 'Common Stock',            type: 'Equity'    },
  { code: '4000', name: 'Sales Revenue',           type: 'Revenue'   },
  { code: '4100', name: 'Service Revenue',         type: 'Revenue'   },
  { code: '4200', name: 'Other Revenue',           type: 'Revenue'   },
  { code: '5000', name: 'Cost of Goods Sold',      type: 'Expense'   },
  { code: '5100', name: 'Salaries Expense',        type: 'Expense'   },
  { code: '5200', name: 'Rent Expense',            type: 'Expense'   },
  { code: '5300', name: 'Utilities Expense',       type: 'Expense'   },
  { code: '5400', name: 'Office Supplies',         type: 'Expense'   },
  { code: '5500', name: 'Marketing Expense',       type: 'Expense'   },
  { code: '5600', name: 'Depreciation Expense',    type: 'Expense'   },
  { code: '5700', name: 'Insurance Expense',       type: 'Expense'   },
  { code: '5800', name: 'Travel Expense',          type: 'Expense'   },
  { code: '5900', name: 'Miscellaneous Expense',   type: 'Expense'   },
];

const TYPE_STYLE = {
  Asset:     { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  Liability: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' },
  Equity:    { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
  Revenue:   { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  Expense:   { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
};

const EMPTY_ACCOUNT = { code: '', name: '', account_geo: '', type: 'Asset' };
const EMPTY_LINE = { debitAccount: '', creditAccount: '', amount: '' };

function Bookkeeping() {
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

  // Accounts state
  const [accounts, setAccounts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState('');
  const [showAccForm, setShowAccForm] = useState(false);
  const [accForm, setAccForm] = useState(EMPTY_ACCOUNT);
  const [editAccId, setEditAccId] = useState(null);
  const [accSaving, setAccSaving] = useState(false);
  const [accUploading, setAccUploading] = useState(false);
  const [accUploadError, setAccUploadError] = useState('');
  const uploadInputRef = useRef(null);

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
    setAccLoading(true);
    try {
      const res = await api.get('/accounting/bookkeeping-accounts');
      setAccounts(res.data.accounts || []);
    } catch (err) {
      setAccError(err.response?.data?.error || 'Failed to load accounts.');
    } finally { setAccLoading(false); }
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

  // ── ACCOUNTS ─────────────────────────────────────────

  const openNewAccount = () => { setAccForm(EMPTY_ACCOUNT); setEditAccId(null); setAccError(''); setShowAccForm(true); };
  const openEditAccount = (a) => { setAccForm({ code: a.code || '', name: a.name, account_geo: a.account_geo || '', type: a.type }); setEditAccId(a.id); setAccError(''); setShowAccForm(true); };

  const handleSaveAccount = async () => {
    if (!accForm.name.trim()) { setAccError('Account (Eng) is required.'); return; }
    const dup = accounts.find(a => a.id !== editAccId && ((accForm.code.trim() && a.code === accForm.code.trim()) || a.name.toLowerCase() === accForm.name.toLowerCase().trim()));
    if (dup) { setAccError(`An account named "${dup.name}" (code: ${dup.code || '—'}) already exists.`); return; }
    setAccSaving(true); setAccError('');
    try {
      if (editAccId) await api.put(`/accounting/bookkeeping-accounts/${editAccId}`, accForm);
      else await api.post('/accounting/bookkeeping-accounts', accForm);
      setShowAccForm(false); loadAccounts();
    } catch (err) {
      setAccError(err.response?.data?.error || 'Failed to save.');
    } finally { setAccSaving(false); }
  };

  const handleDownloadTemplate = () => {
    const rows = [
      ['Account #', 'Type', 'Account Geo', 'Account Eng'],
      ['1000', 'Asset', 'ფული', 'Cash'],
      ['2000', 'Liability', 'გადასახდელი', 'Accounts Payable'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
    XLSX.writeFile(wb, 'accounts_template.xlsx');
  };

  const handleUploadXLSX = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAccUploadError('');

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) { setAccUploadError('File is empty or has no data.'); return; }

    // Normalize header
    const header = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_').replace(/#/, 'num'));
    const colCode = header.findIndex(h => h.includes('num') || h === 'code' || h === 'account_no');
    const colType = header.findIndex(h => h === 'type');
    const colGeo  = header.findIndex(h => h.includes('geo'));
    const colEng  = header.findIndex(h => h.includes('eng'));

    if (colEng === -1) { setAccUploadError('"Account Eng" column not found in file.'); return; }

    const VALID_TYPES = new Set(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
    const parsed = [];
    const errors = [];

    rows.slice(1).forEach((row, i) => {
      const eng = colEng !== -1 ? String(row[colEng] || '').trim() : '';
      if (!eng) return;
      const code = colCode !== -1 ? String(row[colCode] || '').trim() : '';
      const type = colType !== -1 ? String(row[colType] || '').trim() : '';
      const geo  = colGeo  !== -1 ? String(row[colGeo]  || '').trim() : '';

      const resolvedType = VALID_TYPES.has(type) ? type : 'Asset';
      if (type && !VALID_TYPES.has(type)) errors.push(`Row ${i + 2}: unknown type "${type}", defaulted to Asset.`);

      parsed.push({ code, name: eng, account_geo: geo, type: resolvedType });
    });

    if (parsed.length === 0) { setAccUploadError('No valid rows found in file.'); return; }

    setAccUploading(true);
    try {
      await api.post('/accounting/bookkeeping-accounts/bulk', { accounts: parsed });
      loadAccounts();
      if (errors.length > 0) setAccUploadError(`Imported ${parsed.length} accounts with warnings: ${errors.join('; ')}`);
    } catch (err) {
      setAccUploadError(err.response?.data?.error || 'Upload failed.');
    } finally { setAccUploading(false); }
  };

  const handleDeleteAccount = async (a) => {
    if (!window.confirm(`Delete account "${a.name}"?`)) return;
    try {
      await api.delete(`/accounting/bookkeeping-accounts/${a.id}`);
      loadAccounts();
    } catch (err) { setAccError(err.response?.data?.error || 'Failed to delete.'); }
  };

  const handleLoadSampleAccounts = async () => {
    const existingCodes = new Set(accounts.map(a => a.code).filter(Boolean));
    const existingNames = new Set(accounts.map(a => a.name.toLowerCase()));
    const toAdd = SAMPLE_ACCOUNTS.filter(a => !existingCodes.has(a.code) && !existingNames.has(a.name.toLowerCase()));
    if (toAdd.length === 0) { setAccError('All sample accounts already exist — nothing to add.'); return; }
    setAccLoading(true); setAccError('');
    try {
      await Promise.all(toAdd.map(a => api.post('/accounting/bookkeeping-accounts', a)));
      loadAccounts();
    } catch (err) {
      setAccError(err.response?.data?.error || 'Failed to load sample accounts.');
      setAccLoading(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    const seen = {};
    const toDelete = [];
    [...accounts].sort((a, b) => String(a.id).localeCompare(String(b.id))).forEach(acc => {
      const key = acc.code ? acc.code.trim() : acc.name.toLowerCase().trim();
      if (seen[key]) toDelete.push(acc);
      else seen[key] = true;
    });
    if (toDelete.length === 0) { alert('No duplicates found.'); return; }
    if (!window.confirm(`Delete ${toDelete.length} duplicate account(s)? Existing entries will be kept.`)) return;
    setAccLoading(true); setAccError('');
    try {
      await Promise.all(toDelete.map(a => api.delete(`/accounting/bookkeeping-accounts/${a.id}`)));
      loadAccounts();
    } catch (err) {
      setAccError(err.response?.data?.error || 'Failed to delete duplicates.');
      setAccLoading(false);
    }
  };

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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Bookkeeping</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Double-entry accounting</p>
        </div>
        {view === 'transactions' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={openTModal} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              + T-Account Entry
            </button>
            <button onClick={openNewTx} className="btn-add">
              + New Transaction
            </button>
          </div>
        )}
        {view === 'accounts' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={handleRemoveDuplicates} style={{ padding: '9px 18px', background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Remove Duplicates</button>
            <button onClick={handleLoadSampleAccounts} style={{ padding: '9px 18px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>✦ Load Sample Data</button>
            <button onClick={handleDownloadTemplate} style={{ padding: '9px 18px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>↓ Template</button>
            <button onClick={() => uploadInputRef.current?.click()} disabled={accUploading} style={{ padding: '9px 18px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: accUploading ? 0.7 : 1 }}>
              {accUploading ? 'Uploading…' : '↑ Upload Excel'}
            </button>
            <input ref={uploadInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleUploadXLSX} />
            <button onClick={openNewAccount} className="btn-add">+ Add Account</button>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {[{ key: 'transactions', label: 'Transactions' }, { key: 'accounts', label: 'Accounts' }, { key: 'trial-balance', label: 'Trial Balance' }].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)} style={{
            padding: '7px 20px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: view === tab.key ? '#fff' : 'transparent',
            color: view === tab.key ? '#1e293b' : '#64748b',
            boxShadow: view === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── TRANSACTIONS VIEW ── */}
      {view === 'transactions' && (
        <>
          {txError && <div style={errBox}>{txError}</div>}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input placeholder="Search transactions or accounts…" value={filterText} onChange={e => setFilterText(e.target.value)} style={{ flex: 1, minWidth: 200, ...inpStyle }} />
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inpStyle, width: 'auto' }} />
            {(filterText || filterMonth) && (
              <button onClick={() => { setFilterText(''); setFilterMonth(''); }} style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', cursor: 'pointer', fontSize: 13 }}>Clear</button>
            )}
          </div>

          {txLoading ? (
            <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>No transactions yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Use "New Transaction" or "T-Account Entry" to get started.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={th}>Date</th>
                    <th style={{ ...th, color: '#16a34a' }}>Debit</th>
                    <th style={{ ...th, color: '#dc2626' }}>Credit</th>
                    <th style={th}>Description</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                    <th style={th}>Project</th>
                    <th style={{ ...th, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => {
                    const debitCode = row.debit ? (accountCodeMap[row.debit.account] || '—') : '—';
                    const creditCode = row.credit ? (accountCodeMap[row.credit.account] || '—') : '—';
                    const isLastInTx = i === filteredRows.length - 1 || filteredRows[i + 1]?.txId !== row.txId;
                    return (
                      <tr key={`${row.txId}-${i}`} style={{ borderBottom: isLastInTx ? '2px solid #e2e8f0' : '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ ...td, color: '#64748b', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{row.isFirst ? row.date : ''}</td>
                        <td style={{ ...td, color: '#15803d', fontWeight: 500 }}>{row.debit?.account || ''}</td>
                        <td style={{ ...td, color: '#b91c1c', fontWeight: 500 }}>{row.credit?.account || ''}</td>
                        <td style={{ ...td, color: '#334155' }}>{row.isFirst ? row.desc : ''}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1e293b' }}>{row.amount > 0 ? fmt(row.amount) : ''}</td>
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
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{editTxId ? 'Edit Transaction' : 'New Transaction'}</h3>
                {txFormError && <div style={{ ...errBox, marginBottom: 14 }}>{txFormError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
                  <div><label style={lbl}>Date *</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inpStyle} /></div>
                  <div><label style={lbl}>Description *</label><input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="e.g. Office rent" style={inpStyle} /></div>
                </div>
                <datalist id="bk-accs">
                  {accountNames.map((n, i) => <option key={i} value={n} />)}
                </datalist>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 28px', gap: 6, marginBottom: 4 }}>
                    <div style={{ ...lbl, marginBottom: 0, color: '#15803d' }}>Debit Account</div>
                    <div style={{ ...lbl, marginBottom: 0, color: '#b91c1c' }}>Credit Account</div>
                    <div style={{ ...lbl, marginBottom: 0, textAlign: 'right' }}>Amount</div>
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
                  <button type="button" onClick={() => setFormLines([...formLines, { ...EMPTY_LINE }])} style={{ marginTop: 4, padding: '5px 14px', border: '1px dashed #86efac', borderRadius: 7, background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Add Line</button>
                </div>
                <div style={{ marginBottom: 20, position: 'relative' }}>
                  <label style={lbl}>Project / Agent</label>
                  <input value={agentSearch} onChange={e => { setAgentSearch(e.target.value); setAgentOpen(true); if (!e.target.value) setFormAgentId(''); }} onFocus={() => setAgentOpen(true)} onBlur={() => setTimeout(() => setAgentOpen(false), 150)} placeholder="Search agent…" style={inpStyle} />
                  {agentOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                      {agents.filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase())).map(a => (
                        <div key={a.id} onMouseDown={() => { setFormAgentId(a.id); setAgentSearch(a.name); setAgentOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                          <span style={{ fontWeight: 600 }}>{a.name}</span>
                          {a.type && <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 8 }}>{a.type}</span>}
                        </div>
                      ))}
                      {agents.filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase())).length === 0 && <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 13 }}>Agent not found</div>}
                    </div>
                  )}
                  {formAgentId && <button type="button" onClick={() => { setFormAgentId(''); setAgentSearch(''); }} style={{ position: 'absolute', right: 8, top: 30, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowTxForm(false)} style={cancelBtn}>Cancel</button>
                  <button onClick={handleSaveTx} disabled={txSaving} style={{ ...primaryBtn, opacity: txSaving ? 0.7 : 1 }}>{txSaving ? 'Saving…' : editTxId ? 'Save Changes' : 'Post Transaction'}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ACCOUNTS VIEW ── */}
      {view === 'accounts' && (
        <>
          {(accError || accUploadError) && <div style={errBox}>{accUploadError || accError}</div>}
          {accLoading ? <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>
          : accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>No accounts yet</div>
              <div style={{ fontSize: 13, marginTop: 4, marginBottom: 20 }}>Add accounts to use in transactions.</div>
              <button onClick={handleLoadSampleAccounts} style={{ padding: '10px 22px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>✦ Load Sample Chart of Accounts</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ ...th, width: 90 }}>Account #</th><th style={th}>Type</th><th style={th}>Account Geo</th><th style={th}>Account Eng</th><th style={{ ...th, width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => {
                    const ts = TYPE_STYLE[a.type] || TYPE_STYLE.Asset;
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...td, fontFamily: 'monospace', color: '#64748b', fontSize: 13 }}>{a.code || '—'}</td>
                        <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, ...ts }}>{a.type}</span></td>
                        <td style={{ ...td, color: '#1e293b' }}>{a.account_geo || '—'}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#1e293b' }}>{a.name}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEditAccount(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 4 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => handleDeleteAccount(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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
          {showAccForm && (
            <div style={overlay} onClick={() => setShowAccForm(false)}>
              <div style={modal} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{editAccId ? 'Edit Account' : 'New Account'}</h3>
                {accError && <div style={{ ...errBox, marginBottom: 14 }}>{accError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>
                  <div><label style={lbl}>Account #</label><input value={accForm.code} onChange={e => setAccForm({ ...accForm, code: e.target.value })} placeholder="e.g. 1000" style={inpStyle} /></div>
                  <div>
                    <label style={lbl}>Type *</label>
                    <select value={accForm.type} onChange={e => setAccForm({ ...accForm, type: e.target.value })} style={{ ...inpStyle, background: '#fff' }}>
                      {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div><label style={lbl}>Account (Geo)</label><input value={accForm.account_geo} onChange={e => setAccForm({ ...accForm, account_geo: e.target.value })} placeholder="e.g. Naghdi" style={inpStyle} /></div>
                  <div><label style={lbl}>Account (Eng) *</label><input value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} placeholder="e.g. Cash" style={inpStyle} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowAccForm(false)} style={cancelBtn}>Cancel</button>
                  <button onClick={handleSaveAccount} disabled={accSaving} style={primaryBtn}>{accSaving ? 'Saving…' : 'Save'}</button>
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
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Filter by month:</span>
            <input type="month" value={tbFilterMonth} onChange={e => setTbFilterMonth(e.target.value)} style={{ ...inpStyle, width: 'auto' }} />
            {tbFilterMonth && <button onClick={() => setTbFilterMonth('')} style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', cursor: 'pointer', fontSize: 13 }}>Clear</button>}
          </div>
          {trialBalance.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>No entries found</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ ...th, width: 70 }}>Code</th><th style={th}>Account</th>
                    <th style={{ ...th, textAlign: 'right', color: '#16a34a' }}>Debit</th>
                    <th style={{ ...th, textAlign: 'right', color: '#dc2626' }}>Credit</th>
                    <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.map((row, i) => {
                    const net = row.debit - row.credit;
                    const isExpanded = expandedAccounts.has(row.account);
                    const accountEntries = tbEntries.filter(e => e.account === row.account);
                    const rowBg = i % 2 === 0 ? '#fff' : '#fafbfc';
                    return (
                      <React.Fragment key={row.account}>
                        <tr onClick={() => toggleAccount(row.account)} style={{ borderBottom: '1px solid #f1f5f9', background: rowBg, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'} onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: '#64748b', fontWeight: 700 }}>{accountCodeMap[row.account] || '—'}</td>
                          <td style={{ ...td, fontWeight: 500, color: '#1e293b' }}><span style={{ marginRight: 8, color: '#94a3b8', fontSize: 10, display: 'inline-block', width: 10 }}>{isExpanded ? '▼' : '▶'}</span>{row.account}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#15803d' }}>{row.debit > 0 ? fmt(row.debit) : '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#b91c1c' }}>{row.credit > 0 ? fmt(row.credit) : '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: net > 0 ? '#15803d' : net < 0 ? '#b91c1c' : '#64748b' }}>{net !== 0 ? `${fmt(Math.abs(net))} ${net > 0 ? 'Dr' : 'Cr'}` : '0.00'}</td>
                        </tr>
                        {isExpanded && accountEntries.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(e => {
                          const agent = e.agent_id ? agentMap[e.agent_id] : null;
                          return (
                            <tr key={e.id} style={{ background: '#f8faff', borderBottom: '1px solid #f1f5f9' }}>
                              <td style={td} />
                              <td style={{ ...td, paddingLeft: 30, fontSize: 12, color: '#64748b' }}>
                                <span style={{ fontFamily: 'monospace', marginRight: 12, color: '#94a3b8' }}>{e.date}</span>
                                {e.description}
                                {agent && (
                                  <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                                    {'| '}
                                    <span style={{ color: '#4f46e5', fontWeight: 600 }}>{agent}</span>
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
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #e2e8f0' }}>
                    <td style={td} /><td style={{ ...td, fontWeight: 700, color: '#1e293b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Total</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#15803d' }}>{fmt(tbTotalDebit)}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#b91c1c' }}>{fmt(tbTotalCredit)}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: Math.abs(tbTotalDebit - tbTotalCredit) < 0.001 ? '#16a34a' : '#dc2626' }}>
                      {Math.abs(tbTotalDebit - tbTotalCredit) < 0.001 ? '✓ Balanced' : `Difference: ${fmt(Math.abs(tbTotalDebit - tbTotalCredit))}`}
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
          <div style={{ background: '#fff', borderRadius: 16, width: '96vw', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#1e293b', marginRight: 8 }}>⊤ T-Account Entry</div>
              <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 140 }}>
                  <label style={{ ...lbl, marginBottom: 3 }}>Date *</label>
                  <input type="date" value={tDate} onChange={e => setTDate(e.target.value)} style={{ ...inpStyle, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ ...lbl, marginBottom: 3 }}>Description *</label>
                  <input value={tDesc} onChange={e => setTDesc(e.target.value)} placeholder="e.g. Monthly rent" style={{ ...inpStyle, fontSize: 13 }} />
                </div>
                <div style={{ minWidth: 180, position: 'relative' }}>
                  <label style={{ ...lbl, marginBottom: 3 }}>Project / Agent</label>
                  <input value={tAgentSearch} onChange={e => { setTAgentSearch(e.target.value); setTAgentOpen(true); if (!e.target.value) setTAgentId(''); }} onFocus={() => setTAgentOpen(true)} onBlur={() => setTimeout(() => setTAgentOpen(false), 150)} placeholder="Search agent…" style={{ ...inpStyle, fontSize: 13 }} />
                  {tAgentOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 20, maxHeight: 160, overflowY: 'auto' }}>
                      {agents.filter(a => a.name.toLowerCase().includes(tAgentSearch.toLowerCase())).map(a => (
                        <div key={a.id} onMouseDown={() => { setTAgentId(a.id); setTAgentSearch(a.name); setTAgentOpen(false); }} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>{a.name}</div>
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
              <div style={{ width: 220, borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', background: '#fafbfc' }}>
                <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #f1f5f9' }}>
                  <input value={tAccSearch} onChange={e => setTAccSearch(e.target.value)} placeholder="Search accounts…" style={{ ...inpStyle, fontSize: 12, padding: '6px 9px' }} />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
                  {tAccList.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 16 }}>No accounts found</div>
                  ) : tAccList.map(a => {
                    const ts = TYPE_STYLE[a.type] || TYPE_STYLE.Asset;
                    return (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={() => { dragAcc.current = a; }}
                        onDragEnd={() => { dragAcc.current = null; }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'grab', userSelect: 'none', transition: 'box-shadow 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <span style={{ fontSize: 14, color: '#94a3b8', cursor: 'grab' }}>⠿</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                            {a.code && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b' }}>{a.code}</span>}
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '0px 5px', borderRadius: 3, ...ts }}>{a.type}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                  Drag accounts to T
                </div>
              </div>

              {/* Right: T-Account shape */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'auto' }}>
                {/* T name bar */}
                <div style={{ textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ display: 'inline-block', borderBottom: '3px solid #1e293b', padding: '0 40px 6px', fontSize: 13, fontWeight: 700, color: '#1e293b', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {tDesc || 'Transaction'}
                  </div>
                </div>

                {/* T columns */}
                <div style={{ display: 'flex', flex: 1, minHeight: 300 }}>

                  {/* Debit side */}
                  <div style={{ flex: 1, borderRight: '3px solid #1e293b', borderTop: '3px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
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
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, background: '#fff', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {entry.code && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b', marginRight: 5 }}>{entry.code}</span>}
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
                    <div style={{ borderTop: '2px solid #1e293b', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', background: '#f8fafc' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Dr</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#15803d' }}>{tDebitTotal > 0 ? fmt(tDebitTotal) : '0.00'}</span>
                    </div>
                  </div>

                  {/* Credit side */}
                  <div style={{ flex: 1, borderTop: '3px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid #e2e8f0', background: '#fef2f2' }}>
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
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, padding: '6px 10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {entry.code && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b', marginRight: 5 }}>{entry.code}</span>}
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
                    <div style={{ borderTop: '2px solid #1e293b', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', background: '#f8fafc' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Cr</span>
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
            <div style={{ padding: '14px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fafbfc' }}>
              <button onClick={() => setShowTModal(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleTSave} disabled={tSaving} style={{ ...primaryBtn, background: '#7c3aed', opacity: tSaving ? 0.7 : 1 }}>
                {tSaving ? 'Saving…' : 'Post T-Account Entry'}
              </button>
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
const errBox = { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal = { background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const cancelBtn = { padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', fontSize: 14 };
const primaryBtn = { padding: '8px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };

export default Bookkeeping;
