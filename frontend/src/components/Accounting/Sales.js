import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const DEFAULT_WIDTHS = [110, 160, 130, 200, 120, 80];

const EMPTY = { client: '', description: '', amount: '', currency: 'USD', category: '', date: '' };
const CATEGORIES = ['Product', 'Service', 'Consulting', 'License', 'Subscription', 'Other'];

function Sales() {
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); loadAgents(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/sales');
      setRecords(res.data.records || []);
    } catch { setError('Failed to load sales.'); }
    finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/accounting/agents');
      setAgents(res.data.records || []);
    } catch { /* non-critical */ }
  };

  const openNew = () => { setForm({ ...EMPTY, date: today() }); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = (r) => { setForm({ client: r.client, description: r.description || '', amount: r.amount, currency: r.currency, category: r.category || '', date: r.date }); setEditId(r.id); setShowForm(true); setError(''); };

  const handleSave = async () => {
    if (!form.client || !form.amount || !form.date) { setError('Client, amount and date are required.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/sales/${editId}`, form);
      else await api.post('/accounting/sales', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sale?')) return;
    try { await api.delete(`/accounting/sales/${id}`); load(); }
    catch { setError('Failed to delete.'); }
  };

  const total = records.reduce((s, r) => s + parseFloat(r.amount), 0);

  return (
    <>
      <h2>Sales</h2>
      <p className="acc-subtitle">Track your revenue and sales transactions.</p>

      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total Records</span>
          <span className="acc-summary-value">{records.length}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total Revenue</span>
          <span className="acc-summary-value green">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="acc-header-row">
        <div />
        <button className="btn-primary" onClick={openNew}>+ Add Sale</button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>Loading…</p></div> : records.length === 0 ? (
          <div className="acc-empty"><div className="acc-empty-icon">💰</div><p>No sales yet. Add your first one.</p></div>
        ) : (
          <table className="acc-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
            <colgroup>
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead><tr>
              <th style={{ position: 'relative', width: colWidths[0], overflow: 'hidden', whiteSpace: 'nowrap' }}>Date<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[1], overflow: 'hidden', whiteSpace: 'nowrap' }}>Client<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[2], overflow: 'hidden', whiteSpace: 'nowrap' }}>Category<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[3], overflow: 'hidden', whiteSpace: 'nowrap' }}>Description<div onMouseDown={e => onResizeMouseDown(e, 3)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[4], overflow: 'hidden', whiteSpace: 'nowrap' }}>Amount<div onMouseDown={e => onResizeMouseDown(e, 4)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[5], overflow: 'hidden', whiteSpace: 'nowrap' }}><div onMouseDown={e => onResizeMouseDown(e, 5)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
            </tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.date}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.client}</strong></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.category && <span className="acc-category-badge">{r.category}</span>}</td>
                  <td style={{ color: '#64748b', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.description || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-amount income">+{r.currency} {parseFloat(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)}>✏️</button>
                      <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)}>🗑️</button>
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
            <h3>{editId ? 'Edit Sale' : 'New Sale'}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group">
                <label>Client *</label>
                <select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                  <option value="">— Select client —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="acc-form-group"><label>Date *</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="acc-form-group"><label>Amount *</label><input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></div>
              <div className="acc-form-group"><label>Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option>USD</option><option>GEL</option><option>EUR</option>
                </select>
              </div>
              <div className="acc-form-group"><label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">— Select —</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="acc-form-group full"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes…" /></div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const today = () => new Date().toISOString().split('T')[0];
export default Sales;
