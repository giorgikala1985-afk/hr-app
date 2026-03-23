import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const SAMPLE_ACCOUNTS = [
  { code: '1000', name: 'Cash',                     type: 'Asset'     },
  { code: '1100', name: 'Accounts Receivable',      type: 'Asset'     },
  { code: '1200', name: 'Prepaid Expenses',         type: 'Asset'     },
  { code: '1300', name: 'Inventory',                type: 'Asset'     },
  { code: '1400', name: 'Other Current Assets',     type: 'Asset'     },
  { code: '1500', name: 'Fixed Assets',             type: 'Asset'     },
  { code: '1600', name: 'Accumulated Depreciation', type: 'Asset'     },
  { code: '2000', name: 'Accounts Payable',         type: 'Liability' },
  { code: '2100', name: 'Accrued Liabilities',      type: 'Liability' },
  { code: '2200', name: 'Notes Payable',            type: 'Liability' },
  { code: '2300', name: 'Unearned Revenue',         type: 'Liability' },
  { code: '2500', name: 'Loans Payable',            type: 'Liability' },
  { code: '3000', name: "Owner's Equity",           type: 'Equity'    },
  { code: '3100', name: 'Retained Earnings',        type: 'Equity'    },
  { code: '3200', name: 'Common Stock',             type: 'Equity'    },
  { code: '4000', name: 'Sales Revenue',            type: 'Revenue'   },
  { code: '4100', name: 'Service Revenue',          type: 'Revenue'   },
  { code: '4200', name: 'Other Revenue',            type: 'Revenue'   },
  { code: '5000', name: 'Cost of Goods Sold',       type: 'Expense'   },
  { code: '5100', name: 'Salaries Expense',         type: 'Expense'   },
  { code: '5200', name: 'Rent Expense',             type: 'Expense'   },
  { code: '5300', name: 'Utilities Expense',        type: 'Expense'   },
  { code: '5400', name: 'Office Supplies',          type: 'Expense'   },
  { code: '5500', name: 'Marketing Expense',        type: 'Expense'   },
  { code: '5600', name: 'Depreciation Expense',     type: 'Expense'   },
  { code: '5700', name: 'Insurance Expense',        type: 'Expense'   },
  { code: '5800', name: 'Travel Expense',           type: 'Expense'   },
  { code: '5900', name: 'Miscellaneous Expense',    type: 'Expense'   },
];

const TYPE_STYLE = {
  Asset:     { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  Liability: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' },
  Equity:    { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
  Revenue:   { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  Expense:   { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
};

const EMPTY_ACCOUNT = { code: '', name: '', account_geo: '', type: 'Asset' };

function AccountsSettings() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_ACCOUNT);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/accounting/bookkeeping-accounts');
      setAccounts(res.data.accounts || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load accounts.');
    } finally { setLoading(false); }
  };

  const openNew = () => { setForm(EMPTY_ACCOUNT); setEditId(null); setError(''); setShowForm(true); };
  const openEdit = (a) => { setForm({ code: a.code || '', name: a.name, account_geo: a.account_geo || '', type: a.type }); setEditId(a.id); setError(''); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Account (Eng) is required.'); return; }
    const dup = accounts.find(a => a.id !== editId && ((form.code.trim() && a.code === form.code.trim()) || a.name.toLowerCase() === form.name.toLowerCase().trim()));
    if (dup) { setError(`An account named "${dup.name}" (code: ${dup.code || '—'}) already exists.`); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/bookkeeping-accounts/${editId}`, form);
      else await api.post('/accounting/bookkeeping-accounts', form);
      setShowForm(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete account "${a.name}"?`)) return;
    try {
      await api.delete(`/accounting/bookkeeping-accounts/${a.id}`);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete.'); }
  };

  const handleLoadSample = async () => {
    const existingCodes = new Set(accounts.map(a => a.code).filter(Boolean));
    const existingNames = new Set(accounts.map(a => a.name.toLowerCase()));
    const toAdd = SAMPLE_ACCOUNTS.filter(a => !existingCodes.has(a.code) && !existingNames.has(a.name.toLowerCase()));
    if (toAdd.length === 0) { setError('All sample accounts already exist — nothing to add.'); return; }
    setLoading(true); setError('');
    try {
      await Promise.all(toAdd.map(a => api.post('/accounting/bookkeeping-accounts', a)));
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sample accounts.');
      setLoading(false);
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
    if (!window.confirm(`Delete ${toDelete.length} duplicate account(s)?`)) return;
    setLoading(true); setError('');
    try {
      await Promise.all(toDelete.map(a => api.delete(`/accounting/bookkeeping-accounts/${a.id}`)));
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete duplicates.');
      setLoading(false);
    }
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

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadError('');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) { setUploadError('File is empty or has no data.'); return; }
    const header = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_').replace(/#/, 'num'));
    const colCode = header.findIndex(h => h.includes('num') || h === 'code' || h === 'account_no');
    const colType = header.findIndex(h => h === 'type');
    const colGeo  = header.findIndex(h => h.includes('geo'));
    const colEng  = header.findIndex(h => h.includes('eng'));
    if (colEng === -1) { setUploadError('"Account Eng" column not found in file.'); return; }
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
    if (parsed.length === 0) { setUploadError('No valid rows found in file.'); return; }
    setUploading(true);
    try {
      await api.post('/accounting/bookkeeping-accounts/bulk', { accounts: parsed });
      load();
      if (errors.length > 0) setUploadError(`Imported ${parsed.length} accounts with warnings: ${errors.join('; ')}`);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed.');
    } finally { setUploading(false); }
  };

  return (
    <div className="unit-types-settings">
      <h3>Chart of Accounts</h3>
      <p className="pagination-desc">Manage bookkeeping accounts used in double-entry transactions.</p>

      {(error || uploadError) && (
        <div className="msg-error" style={{ marginBottom: 16 }}>{uploadError || error}</div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={handleRemoveDuplicates} style={{ padding: '8px 16px', background: 'var(--surface-2)', color: '#ea580c', border: '1px solid var(--border-2)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Remove Duplicates
        </button>
        <button onClick={handleLoadSample} style={{ padding: '8px 16px', background: 'var(--surface-2)', color: '#16a34a', border: '1px solid var(--border-2)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          ✦ Load Sample Data
        </button>
        <button onClick={handleDownloadTemplate} style={{ padding: '8px 16px', background: 'var(--surface-2)', color: '#0369a1', border: '1px solid var(--border-2)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↓ Template
        </button>
        <button onClick={() => uploadRef.current?.click()} disabled={uploading} style={{ padding: '8px 16px', background: 'var(--surface-2)', color: '#7c3aed', border: '1px solid var(--border-2)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: uploading ? 0.7 : 1 }}>
          {uploading ? 'Uploading…' : '↑ Upload Excel'}
        </button>
        <input ref={uploadRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleUpload} />
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-add btn-sm" onClick={openNew}>+ Add Account</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: '20px 0', color: 'var(--text-4)' }}>Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="ut-empty">
          No accounts yet.{' '}
          <button onClick={handleLoadSample} style={{ background: 'none', border: 'none', color: '#16a34a', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>
            Load sample chart of accounts
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                <th style={thStyle}>Account #</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Account Geo</th>
                <th style={thStyle}>Account Eng</th>
                <th style={{ ...thStyle, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => {
                const ts = TYPE_STYLE[a.type] || TYPE_STYLE.Asset;
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border-3)' }}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: 'var(--text-3)', fontSize: 13 }}>{a.code || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, ...ts }}>{a.type}</span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text)' }}>{a.account_geo || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text)' }}>{a.name}</td>
                    <td style={tdStyle}>
                      <div className="action-btns">
                        <button className="btn-icon" onClick={() => openEdit(a)} title="Edit" style={{ color: '#3b82f6' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button className="btn-icon btn-delete" onClick={() => handleDelete(a)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
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

      {/* Form modal */}
      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={e => e.stopPropagation()}>
            <h3>{editId ? 'Edit Account' : 'New Account'}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>
              <div className="acc-form-group">
                <label>Account #</label>
                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1000" />
              </div>
              <div className="acc-form-group">
                <label>Type *</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="acc-form-grid" style={{ marginBottom: 20 }}>
              <div className="acc-form-group">
                <label>Account (Geo)</label>
                <input value={form.account_geo} onChange={e => setForm({ ...form, account_geo: e.target.value })} placeholder="e.g. ნაღდი" />
              </div>
              <div className="acc-form-group">
                <label>Account (Eng) *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cash" />
              </div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-3)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 14px',
  verticalAlign: 'middle',
};

export default AccountsSettings;
