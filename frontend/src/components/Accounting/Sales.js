import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import { useLanguage } from '../../contexts/LanguageContext';

const DEFAULT_WIDTHS = [110, 160, 150, 130, 200, 120, 80];

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

const EMPTY = { client: '', product: '', description: '', amount: '', currency: 'USD', category: '', date: '' };
const CATEGORIES = ['Product', 'Service', 'Consulting', 'License', 'Subscription', 'Other'];

function Sales() {
  const { t } = useLanguage();
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => { load(); loadAgents(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/sales');
      setRecords(res.data.records || []);
    } catch { setError(t('sales.failedLoad')); }
    finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/accounting/agents');
      setAgents(res.data.records || []);
    } catch { /* non-critical */ }
  };

  const openNew = () => { setForm({ ...EMPTY, date: today() }); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = (r) => { setForm({ client: r.client, product: r.product || '', description: r.description || '', amount: r.amount, currency: r.currency, category: r.category || '', date: r.date }); setEditId(r.id); setShowForm(true); setError(''); };

  const handleSave = async () => {
    if (!form.client || !form.amount || !form.date) { setError(t('sales.validationError')); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/sales/${editId}`, form);
      else await api.post('/accounting/sales', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('sales.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('sales.deleteConfirm'))) return;
    try { await api.delete(`/accounting/sales/${id}`); load(); }
    catch { setError(t('sales.failedDelete')); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length && records.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(t('sales.deleteSelectedConfirm', { count: selectedIds.size }))) return;
    try {
      await api.delete('/accounting/sales/bulk', { data: { ids: Array.from(selectedIds) } });
      setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch { setError(t('sales.failedDeleteSelected')); }
  };

  const total = records.reduce((s, r) => s + parseFloat(r.amount), 0);

  return (
    <>
      <h2>{t('sales.title')}</h2>
      <p className="acc-subtitle">{t('sales.subtitle')}</p>

      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('sales.totalRecords')}</span>
          <span className="acc-summary-value">{records.length}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('sales.totalRevenue')}</span>
          <span className="acc-summary-value green">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="acc-header-row">
        <div />
        <button className="btn-add" onClick={openNew}>{t('sales.addSale')}</button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, fontWeight: 500, color: '#555' }}>
          <span>{t('sales.selectedCount', { count: selectedIds.size })}</span>
          <button
            onClick={handleBulkDelete}
            style={{ background: '#e53935', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <IconDelete /> {t('sales.deleteSelected')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ background: '#f5f5f5', color: '#666', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('sales.clear')}
          </button>
        </div>
      )}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>{t('sales.loading')}</p></div> : records.length === 0 ? (
          <div className="acc-empty"><div className="acc-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><p>{t('sales.noSales')}</p></div>
        ) : (
          <table className="acc-table">
            <colgroup>
              <col style={{ width: 40 }} />
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead><tr>
              <th style={{ width: 40, textAlign: 'center', verticalAlign: 'middle' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === records.length && records.length > 0}
                  onChange={toggleSelectAll}
                  title={t('sales.selectAll')}
                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                />
              </th>
              <th style={{ position: 'relative', width: colWidths[0], whiteSpace: 'nowrap' }}>{t('sales.colDate')}<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[1], whiteSpace: 'nowrap' }}>{t('sales.colClient')}<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[2], whiteSpace: 'nowrap' }}>{t('sales.colProduct')}<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[3], whiteSpace: 'nowrap' }}>{t('sales.colCategory')}<div onMouseDown={e => onResizeMouseDown(e, 3)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[4], whiteSpace: 'nowrap' }}>{t('sales.colDescription')}<div onMouseDown={e => onResizeMouseDown(e, 4)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[5], whiteSpace: 'nowrap' }}>{t('sales.colAmount')}<div onMouseDown={e => onResizeMouseDown(e, 5)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[6], whiteSpace: 'nowrap' }}><div onMouseDown={e => onResizeMouseDown(e, 6)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
            </tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={selectedIds.has(r.id) ? { background: '#f0f9ff' } : {}}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.date}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.client}</strong></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.product || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.category && <span className="acc-category-badge">{r.category}</span>}</td>
                  <td style={{ color: '#64748b', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.description || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-amount income">+{r.currency} {parseFloat(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit" style={{ color: '#3b82f6' }}><IconEdit /></button>
                      <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete"><IconDelete /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="acc-modal-overlay">
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? t('sales.editSale') : t('sales.newSale')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group">
                <label>{t('sales.client')}</label>
                <select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                  <option value="">{t('sales.selectClient')}</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="acc-form-group"><label>{t('sales.product')}</label><input type="text" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="e.g. Website design" /></div>
              <div className="acc-form-group"><label>{t('sales.date')}</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="acc-form-group"><label>{t('sales.amount')}</label><input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></div>
              <div className="acc-form-group"><label>{t('sales.currency')}</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option>USD</option><option>GEL</option><option>EUR</option>
                </select>
              </div>
              <div className="acc-form-group"><label>{t('sales.category')}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">{t('sales.selectCategory')}</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="acc-form-group full"><label>{t('sales.colDescription')}</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('sales.optionalNotes')} /></div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('sales.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('sales.saving') : t('sales.save')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const today = () => new Date().toISOString().split('T')[0];
export default Sales;
