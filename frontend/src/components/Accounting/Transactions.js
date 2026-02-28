import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const DEFAULT_WIDTHS = [110, 160, 150, 110, 220, 70];

const TX_EMPTY = { date: '', client: '', item_type: '', amount: '', note: '' };

const EMPTY_FILTERS = { date: '', client: '', item_type: '', amount: '', note: '' };

/* ── SVG icon components ── */
function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconDelete() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

function IconExcel() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/>
    </svg>
  );
}

function IconClear() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function Transactions() {
  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(TX_EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState([]);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);

  useEffect(() => { load(); loadAgents(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/transactions');
      setRecords(res.data.records || []);
    } catch { setError('Failed to load purchases.'); }
    finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/accounting/agents');
      setAgents(res.data.records || []);
    } catch { /* non-critical */ }
  };

  const clientOptions = [...new Set(records.map(r => r.client).filter(Boolean))];
  const itemTypeOptions = [...new Set(records.map(r => r.item_type).filter(Boolean))];

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filters.date && !r.date.includes(filters.date)) return false;
      if (filters.client && !r.client.toLowerCase().includes(filters.client.toLowerCase())) return false;
      if (filters.item_type && !r.item_type.toLowerCase().includes(filters.item_type.toLowerCase())) return false;
      if (filters.amount && !String(r.amount).includes(filters.amount)) return false;
      if (filters.note && !(r.note || '').toLowerCase().includes(filters.note.toLowerCase())) return false;
      return true;
    });
  }, [records, filters]);

  const hasFilters = Object.values(filters).some(v => v !== '');
  const setFilter = (col, val) => setFilters(prev => ({ ...prev, [col]: val }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  /* ── Suggestion logic ── */
  const computeSuggestion = (client, currentEditId) => {
    if (!client) { setSuggestion([]); return; }
    const clientRecords = records.filter(r => r.client === client && r.id !== currentEditId);
    if (clientRecords.length === 0) { setSuggestion([]); return; }
    const counts = {};
    clientRecords.forEach(r => { counts[r.item_type] = (counts[r.item_type] || 0) + 1; });
    const all = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type]) => type);
    setSuggestion(all);
    setSuggestionDismissed(false);
  };

  const handleClientChange = (val) => {
    setForm(prev => ({ ...prev, client: val }));
    computeSuggestion(val, editId);
  };

  const openNew = () => {
    setForm({ ...TX_EMPTY, date: today() });
    setEditId(null); setShowForm(true); setError('');
    setSuggestion([]); setSuggestionDismissed(false);
  };

  const openEdit = (r) => {
    setForm({ date: r.date, client: r.client, item_type: r.item_type, amount: r.amount, note: r.note || '' });
    setEditId(r.id); setShowForm(true); setError('');
    setSuggestion([]); setSuggestionDismissed(false);
  };

  const handleSave = async () => {
    if (!form.client || !form.item_type || !form.amount || !form.date) {
      setError('Date, client, item type and amount are required.'); return;
    }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/transactions/${editId}`, form);
      else await api.post('/accounting/transactions', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase?')) return;
    try { await api.delete(`/accounting/transactions/${id}`); load(); }
    catch { setError('Failed to delete.'); }
  };

  /* ── Excel export ── */
  const exportToExcel = () => {
    const header = ['Date', 'Client', 'Item Type', 'Amount', 'Note'];
    const rows = filtered.map(r => [
      r.date,
      r.client,
      r.item_type,
      parseFloat(r.amount),
      r.note || '',
    ]);
    const totalRow = ['', '', 'TOTAL', filtered.reduce((s, r) => s + parseFloat(r.amount || 0), 0), ''];
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow]);
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    XLSX.writeFile(wb, `purchases-${today()}.xlsx`);
  };

  const total = filtered.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  /* ── Filter input style ── */
  const filterInputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 11,
    padding: '3px 6px',
    border: '1px solid #d1d5db',
    borderRadius: 5,
    background: '#f9fafb',
    color: '#374151',
    outline: 'none',
    marginTop: 4,
    fontFamily: 'inherit',
  };

  return (
    <div>
      <h2>Purchases</h2>
      <p className="acc-subtitle">Track purchase transactions. Item type is suggested based on past entries per client.</p>

      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total Records</span>
          <span className="acc-summary-value">{filtered.length}{hasFilters && records.length !== filtered.length ? ` / ${records.length}` : ''}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total Amount</span>
          <span className="acc-summary-value red">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="acc-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', background: '#fef3c7',
                border: '1px solid #f59e0b', borderRadius: 7,
                fontSize: 12, fontWeight: 500, color: '#92400e',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <IconClear /> Clear filters ({records.length - filtered.length} hidden)
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportToExcel}
            disabled={filtered.length === 0}
            title="Download as Excel"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: 'white',
              border: '1.5px solid #e5e7eb', borderRadius: 7,
              fontSize: 13, fontWeight: 500, color: '#16a34a',
              cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filtered.length === 0 ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            <IconExcel /> Excel
          </button>
          <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconPlus /> Add Purchase
          </button>
        </div>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>Loading…</p></div> : records.length === 0 ? (
          <div className="acc-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <p>No purchases yet. Add your first one.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="acc-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/>
            </svg>
            <p>No results match your filters.</p>
          </div>
        ) : (
          <table className="acc-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
            <colgroup>
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead>
              <tr>
                {[
                  { label: 'Date', key: 'date', type: 'date' },
                  { label: 'Client', key: 'client', type: 'text' },
                  { label: 'Item Type', key: 'item_type', type: 'text' },
                  { label: 'Amount', key: 'amount', type: 'text' },
                  { label: 'Note', key: 'note', type: 'text' },
                  { label: '', key: null },
                ].map((col, i) => (
                  <th key={i} style={{ position: 'relative', width: colWidths[i], overflow: 'hidden', verticalAlign: 'top', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      {col.label}
                      {col.key && filters[col.key] && (
                        <span style={{ color: '#f59e0b', display: 'flex' }}><IconFilter /></span>
                      )}
                    </div>
                    {col.key && (
                      <input
                        type={col.type}
                        value={filters[col.key]}
                        onChange={e => setFilter(col.key, e.target.value)}
                        placeholder={col.type === 'date' ? 'YYYY-MM-DD' : `Filter…`}
                        style={filterInputStyle}
                      />
                    )}
                    <div
                      onMouseDown={(e) => onResizeMouseDown(e, i)}
                      style={RESIZE_HANDLE_STYLE}
                      onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.date}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.client}</strong></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-category-badge">{r.item_type}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-amount expense">${parseFloat(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#64748b' }}>{r.note || '—'}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit" style={{ color: '#3b82f6' }}>
                        <IconEdit />
                      </button>
                      <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete">
                        <IconDelete />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit Purchase' : 'New Purchase'}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group">
                <label>Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>

              <div className="acc-form-group">
                <label>Client *</label>
                <select
                  value={form.client}
                  onChange={(e) => handleClientChange(e.target.value)}
                >
                  <option value="">— Select client —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group full">
                <label>Item Type *</label>
                {suggestion.length > 0 && !suggestionDismissed && (
                  <div className="tx-suggestion">
                    <span>Previous:</span>
                    {suggestion.filter(s => s !== form.item_type).map(s => (
                      <button key={s} className="tx-sug-accept" onClick={() => setForm(p => ({ ...p, item_type: s }))}>{s}</button>
                    ))}
                    <button className="tx-sug-dismiss" onClick={() => setSuggestionDismissed(true)}>✕</button>
                  </div>
                )}
                <input
                  list="tx-item-types"
                  value={form.item_type}
                  onChange={(e) => setForm({ ...form, item_type: e.target.value })}
                  placeholder="Type or select item type"
                  autoComplete="off"
                />
                <datalist id="tx-item-types">
                  {itemTypeOptions.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>

              <div className="acc-form-group">
                <label>Amount *</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>

              <div className="acc-form-group full">
                <label>Note</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional note…" />
              </div>
            </div>

            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Purchase'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const today = () => new Date().toISOString().split('T')[0];
export default Transactions;
