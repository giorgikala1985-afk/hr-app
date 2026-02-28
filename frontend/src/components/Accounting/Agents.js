import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const DEFAULT_WIDTHS = [180, 100, 110, 160, 200, 130, 60];
const AGENT_TYPES = ['LLC', 'IS', 'JSC', 'Other'];
const EMPTY = { name: '', type: 'LLC', add_date: '', account_number: '', address: '', phone: '' };
const EMPTY_F = { name: '', type: '', add_date: '', account_number: '', address: '', phone: '' };
const today = () => new Date().toISOString().split('T')[0];

const TYPE_COLORS = {
  LLC:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  IS:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  JSC:   { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
  Other: { bg: '#f9fafb', color: '#374151', border: '#e5e7eb' },
};

const COLS = [
  { label: 'Agent Name', key: 'name',           type: 'text' },
  { label: 'Type',       key: 'type',            type: 'text' },
  { label: 'Date Added', key: 'add_date',        type: 'date' },
  { label: 'Account №',  key: 'account_number',  type: 'text' },
  { label: 'Address',    key: 'address',         type: 'text' },
  { label: 'Phone',      key: 'phone',           type: 'text' },
  { label: '',           key: null },
];

const filterInput = {
  width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '3px 6px',
  border: '1px solid #d1d5db', borderRadius: 5, background: '#f9fafb',
  color: '#374151', outline: 'none', marginTop: 4, fontFamily: 'inherit',
};

function Agents() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(EMPTY_F);
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/accounting/agents'); setRecords(res.data.records || []); }
    catch (err) { setError(err.response?.data?.error || err.message || 'Failed to load agents.'); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => records.filter(r =>
    COLS.filter(c => c.key).every(c =>
      !filters[c.key] || (r[c.key] || '').toLowerCase().includes(filters[c.key].toLowerCase())
    )
  ), [records, filters]);

  const hasFilters = Object.values(filters).some(Boolean);
  const setF = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  const openNew = () => { setForm({ ...EMPTY, add_date: today() }); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = r => { setForm({ name: r.name || '', type: r.type || 'LLC', add_date: r.add_date || '', account_number: r.account_number || '', address: r.address || '', phone: r.phone || '' }); setEditId(r.id); setShowForm(true); setError(''); };

  const handleSave = async () => {
    if (!form.name) { setError('Agent name is required.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/agents/${editId}`, form);
      else await api.post('/accounting/agents', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this agent?')) return;
    try { await api.delete(`/accounting/agents/${id}`); load(); }
    catch { setError('Failed to delete.'); }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Type', 'Date Added', 'Account Number', 'Address', 'Phone'],
      ...filtered.map(r => [r.name, r.type, r.add_date, r.account_number, r.address, r.phone]),
    ]);
    ws['!cols'] = [24, 10, 14, 20, 30, 16].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agents');
    XLSX.writeFile(wb, `agents-${today()}.xlsx`);
  };

  return (
    <div>
      <h2>Agents</h2>
      <p className="acc-subtitle">Manage counterparty agents — companies and individuals you work with.</p>

      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total</span>
          <span className="acc-summary-value">{filtered.length}{hasFilters && filtered.length !== records.length ? ` / ${records.length}` : ''}</span>
        </div>
        {AGENT_TYPES.map(t => {
          const s = TYPE_COLORS[t]; const n = filtered.filter(r => r.type === t).length;
          return n ? <div key={t} className="acc-summary-card"><span className="acc-summary-label">{t}</span><span className="acc-summary-value" style={{ color: s.color }}>{n}</span></div> : null;
        })}
      </div>

      <div className="acc-header-row">
        <div>
          {hasFilters && (
            <button onClick={() => setFilters(EMPTY_F)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 7, fontSize: 12, fontWeight: 500, color: '#92400e', cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Clear filters ({records.length - filtered.length} hidden)
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportToExcel} disabled={!filtered.length} title="Download as Excel" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontWeight: 500, color: '#16a34a', cursor: filtered.length ? 'pointer' : 'not-allowed', opacity: filtered.length ? 1 : 0.5, fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel
          </button>
          <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Agent
          </button>
        </div>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>Loading…</p></div>
          : records.length === 0 ? <div className="acc-empty"><p>No agents yet. Add your first one.</p></div>
          : filtered.length === 0 ? <div className="acc-empty"><p>No results match your filters.</p></div>
          : (
          <table className="acc-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
            <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
            <thead>
              <tr>
                {COLS.map((col, i) => (
                  <th key={i} style={{ position: 'relative', width: colWidths[i], overflow: 'hidden', verticalAlign: 'top', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      {col.label}
                      {col.key && filters[col.key] && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg>}
                    </div>
                    {col.key && <input type={col.type} value={filters[col.key]} onChange={e => setF(col.key, e.target.value)} placeholder={col.type === 'date' ? 'YYYY-MM-DD' : 'Filter…'} style={filterInput} />}
                    <div onMouseDown={e => onResizeMouseDown(e, i)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const s = TYPE_COLORS[r.type] || TYPE_COLORS.Other;
                return (
                  <tr key={r.id}>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.name}</strong></td>
                    <td><span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 5, padding: '2px 7px' }}>{r.type}</span></td>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#64748b' }}>{r.add_date || '—'}</td>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: 'monospace', fontSize: 12 }}>{r.account_number || '—'}</td>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#64748b' }}>{r.address || '—'}</td>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.phone || '—'}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon" onClick={() => openEdit(r)} title="Edit" style={{ color: '#3b82f6' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={e => e.stopPropagation()}>
            <h3>{editId ? 'Edit Agent' : 'New Agent'}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group full"><label>Agent Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Corp" /></div>
              <div className="acc-form-group"><label>Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{AGENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="acc-form-group"><label>Date Added</label><input type="date" value={form.add_date} onChange={e => setForm({ ...form, add_date: e.target.value })} /></div>
              <div className="acc-form-group full"><label>Account Number</label><input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} placeholder="e.g. GE00TB0000000000001234" /></div>
              <div className="acc-form-group full"><label>Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="e.g. 123 Main St, Tbilisi" /></div>
              <div className="acc-form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +995 555 000 000" /></div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Agent'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Agents;
