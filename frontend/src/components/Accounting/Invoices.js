import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const DEFAULT_WIDTHS = [80, 160, 110, 110, 120, 100, 80];

const EMPTY_ITEM = { description: '', qty: 1, unit_price: '' };
const EMPTY_FORM = { client: '', client_email: '', invoice_number: '', date: '', due_date: '', currency: 'USD', status: 'draft', notes: '', items: [{ ...EMPTY_ITEM }] };

function Invoices() {
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewInv, setPreviewInv] = useState(null);
  const printRef = useRef();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/invoices');
      setRecords(res.data.records || []);
    } catch { setError('Failed to load invoices.'); }
    finally { setLoading(false); }
  };

  const calcTotal = (items) => items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.unit_price) || 0), 0);

  const openNew = () => {
    const num = `INV-${Date.now().toString().slice(-6)}`;
    setForm({ ...EMPTY_FORM, invoice_number: num, date: today(), due_date: '' });
    setEditId(null); setShowForm(true); setError('');
  };

  const openEdit = (r) => {
    setForm({ client: r.client, client_email: r.client_email || '', invoice_number: r.invoice_number, date: r.date, due_date: r.due_date || '', currency: r.currency, status: r.status, notes: r.notes || '', items: r.items || [{ ...EMPTY_ITEM }] });
    setEditId(r.id); setShowForm(true); setError('');
  };

  const setItem = (i, field, val) => setForm((prev) => {
    const items = [...prev.items];
    items[i] = { ...items[i], [field]: val };
    return { ...prev, items };
  });

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  const removeItem = (i) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.client || !form.invoice_number || !form.date) { setError('Client, invoice number and date are required.'); return; }
    setSaving(true); setError('');
    const payload = { ...form, total: calcTotal(form.items) };
    try {
      if (editId) await api.put(`/accounting/invoices/${editId}`, payload);
      else await api.post('/accounting/invoices', payload);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try { await api.delete(`/accounting/invoices/${id}`); load(); if (previewInv?.id === id) setPreviewInv(null); }
    catch { setError('Failed to delete.'); }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Invoice</title><style>
      body{font-family:Arial,sans-serif;padding:48px;color:#1e293b;font-size:14px}
      h1{color:#0f3460;font-size:24px;margin-bottom:4px}
      .meta{color:#64748b;font-size:13px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{padding:10px;background:#f8fafc;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:600}
      td{padding:10px;border-bottom:1px solid #f1f5f9}
      .total-row{font-weight:700;font-size:16px}
      .notes{color:#64748b;font-size:13px;margin-top:16px}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };

  const statusClass = (s) => `acc-status acc-status-${s}`;
  const totalPaid = records.filter((r) => r.status === 'paid').reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const totalPending = records.filter((r) => r.status !== 'paid').reduce((s, r) => s + parseFloat(r.total || 0), 0);

  return (
    <>
      <h2>Invoices</h2>
      <p className="acc-subtitle">Create and manage client invoices.</p>

      <div className="acc-summary">
        <div className="acc-summary-card"><span className="acc-summary-label">Total</span><span className="acc-summary-value">{records.length}</span></div>
        <div className="acc-summary-card"><span className="acc-summary-label">Paid</span><span className="acc-summary-value green">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
        <div className="acc-summary-card"><span className="acc-summary-label">Pending</span><span className="acc-summary-value blue">${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
      </div>

      <div className="acc-header-row">
        <div />
        <button className="btn-primary" onClick={openNew}>+ New Invoice</button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>Loading…</p></div> : records.length === 0 ? (
          <div className="acc-empty"><div className="acc-empty-icon">🧾</div><p>No invoices yet. Create your first one.</p></div>
        ) : (
          <table className="acc-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
            <colgroup>
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead><tr>
              <th style={{ position: 'relative', width: colWidths[0], overflow: 'hidden', whiteSpace: 'nowrap' }}>#<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[1], overflow: 'hidden', whiteSpace: 'nowrap' }}>Client<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[2], overflow: 'hidden', whiteSpace: 'nowrap' }}>Date<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[3], overflow: 'hidden', whiteSpace: 'nowrap' }}>Due Date<div onMouseDown={e => onResizeMouseDown(e, 3)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[4], overflow: 'hidden', whiteSpace: 'nowrap' }}>Total<div onMouseDown={e => onResizeMouseDown(e, 4)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[5], overflow: 'hidden', whiteSpace: 'nowrap' }}>Status<div onMouseDown={e => onResizeMouseDown(e, 5)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[6], overflow: 'hidden', whiteSpace: 'nowrap' }}><div onMouseDown={e => onResizeMouseDown(e, 6)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
            </tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.invoice_number}</strong></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.client}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.date}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.due_date || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-amount">{r.currency} {parseFloat(r.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className={statusClass(r.status)}>{r.status}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    <div className="action-btns">
                      <button className="btn-icon" title="Preview" onClick={() => setPreviewInv(r)}>👁️</button>
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

      {/* Preview */}
      {previewInv && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 15 }}>Invoice Preview — {previewInv.invoice_number}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary btn-sm" onClick={handlePrint}>🖨️ Print / PDF</button>
              <button className="ut-cancel-btn" onClick={() => setPreviewInv(null)}>Close</button>
            </div>
          </div>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '40px 48px', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#1e293b' }} ref={printRef}>
            <h1 style={{ color: '#0f3460', fontSize: 24, marginBottom: 4 }}>INVOICE</h1>
            <div className="meta" style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              <div><strong>Invoice #:</strong> {previewInv.invoice_number}</div>
              <div><strong>Date:</strong> {previewInv.date}</div>
              {previewInv.due_date && <div><strong>Due:</strong> {previewInv.due_date}</div>}
              <div><strong>Client:</strong> {previewInv.client}</div>
              {previewInv.client_email && <div><strong>Email:</strong> {previewInv.client_email}</div>}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead><tr>
                <th style={{ padding: 10, background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Description</th>
                <th style={{ padding: 10, background: '#f8fafc', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>Qty</th>
                <th style={{ padding: 10, background: '#f8fafc', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>Unit Price</th>
                <th style={{ padding: 10, background: '#f8fafc', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>Total</th>
              </tr></thead>
              <tbody>
                {(previewInv.items || []).map((it, i) => (
                  <tr key={i}><td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{it.description}</td><td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{it.qty}</td><td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{previewInv.currency} {parseFloat(it.unit_price || 0).toFixed(2)}</td><td style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{previewInv.currency} {(parseFloat(it.qty || 0) * parseFloat(it.unit_price || 0)).toFixed(2)}</td></tr>
                ))}
                <tr><td colSpan="3" style={{ padding: 10, textAlign: 'right', fontWeight: 700, fontSize: 16 }}>TOTAL</td><td style={{ padding: 10, textAlign: 'right', fontWeight: 700, fontSize: 16 }}>{previewInv.currency} {parseFloat(previewInv.total || 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
            {previewInv.notes && <div style={{ color: '#64748b', fontSize: 13 }}><strong>Notes:</strong> {previewInv.notes}</div>}
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit Invoice' : 'New Invoice'}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group"><label>Invoice # *</label><input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
              <div className="acc-form-group"><label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
                </select>
              </div>
              <div className="acc-form-group"><label>Client *</label><input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Client name" /></div>
              <div className="acc-form-group"><label>Client Email</label><input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="client@example.com" /></div>
              <div className="acc-form-group"><label>Date *</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="acc-form-group"><label>Due Date</label><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div className="acc-form-group"><label>Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option>USD</option><option>GEL</option><option>EUR</option>
                </select>
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Line Items</label>
              <table className="inv-items-table">
                <thead><tr><th>Description</th><th style={{ width: 60 }}>Qty</th><th style={{ width: 110 }}>Unit Price</th><th style={{ width: 100 }}>Total</th><th style={{ width: 32 }}></th></tr></thead>
                <tbody>
                  {form.items.map((it, i) => (
                    <tr key={i}>
                      <td><input value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} placeholder="Item description" /></td>
                      <td><input type="number" min="1" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} /></td>
                      <td><input type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} placeholder="0.00" /></td>
                      <td style={{ fontWeight: 600, paddingLeft: 8 }}>{((parseFloat(it.qty) || 0) * (parseFloat(it.unit_price) || 0)).toFixed(2)}</td>
                      <td><button style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 16 }} onClick={() => removeItem(i)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="ut-cancel-btn" style={{ fontSize: 12 }} onClick={addItem}>+ Add Item</button>
                <div className="inv-total-row"><span className="inv-total">Total: {form.currency} {calcTotal(form.items).toFixed(2)}</span></div>
              </div>
            </div>

            <div className="acc-form-grid">
              <div className="acc-form-group full"><label>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Payment terms, bank details…" /></div>
            </div>

            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Invoice'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const today = () => new Date().toISOString().split('T')[0];
export default Invoices;
