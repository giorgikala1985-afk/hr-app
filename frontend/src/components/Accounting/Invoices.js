import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const DEFAULT_WIDTHS = [80, 160, 110, 110, 120, 100, 160, 80];

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

function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

const EMPTY_ITEM = { description: '', qty: 1, unit_price: '' };
const EMPTY_FORM = { client: '', client_email: '', invoice_number: '', date: '', due_date: '', currency: 'USD', status: 'draft', notes: '', account_number: '', items: [{ ...EMPTY_ITEM }] };

function Invoices() {
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const [tab, setTab] = useState('list');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [previewInv, setPreviewInv] = useState(null);
  const printRef = useRef();

  // Scanner state
  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanSaving, setScanSaving] = useState(false);
  const [scanSaved, setScanSaved] = useState(false);
  const scanInputRef = useRef();

  const handleScanFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanFile(file);
    setScanResult(null);
    setScanError('');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setScanPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setScanPreview(null);
    }
  };

  const handleScan = async () => {
    if (!scanFile) return;
    setScanning(true);
    setScanError('');
    setScanResult(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(scanFile);
      });
      const res = await api.post('/accounting/invoices/scan', {
        data: base64,
        mimeType: scanFile.type,
      });
      setScanResult(res.data.result);
    } catch (err) {
      setScanError(err.response?.data?.error || err.message);
    } finally {
      setScanning(false);
    }
  };

  const resetScan = () => {
    setScanFile(null);
    setScanPreview(null);
    setScanResult(null);
    setScanError('');
    setScanSaved(false);
    if (scanInputRef.current) scanInputRef.current.value = '';
  };

  const handleSaveScanned = async () => {
    if (!scanResult) return;
    setScanSaving(true);
    setScanError('');
    try {
      const bankDetails = [
        scanResult.bank_name && `Bank: ${scanResult.bank_name}`,
        scanResult.account_number && `Account: ${scanResult.account_number}`,
        scanResult.swift_bic && `SWIFT/BIC: ${scanResult.swift_bic}`,
        scanResult.notes,
      ].filter(Boolean).join('\n');

      const num = scanResult.invoice_number || `INV-${Date.now().toString().slice(-6)}`;
      const items = [{ description: scanResult.description || 'Invoice payment', qty: 1, unit_price: parseFloat(scanResult.amount) || 0 }];
      const total = parseFloat(scanResult.amount) || 0;

      await api.post('/accounting/invoices', {
        client: scanResult.payee || 'Unknown',
        client_email: '',
        invoice_number: num,
        date: scanResult.invoice_date || today(),
        due_date: scanResult.due_date || null,
        currency: scanResult.currency || 'USD',
        status: 'draft',
        notes: bankDetails,
        account_number: scanResult.account_number || null,
        items,
        total,
      });
      setScanSaved(true);
      load();
    } catch (err) {
      setScanError(err.response?.data?.error || err.message);
    } finally {
      setScanSaving(false);
    }
  };

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
    setForm({ client: r.client, client_email: r.client_email || '', invoice_number: r.invoice_number, date: r.date, due_date: r.due_date || '', currency: r.currency, status: r.status, notes: r.notes || '', account_number: r.account_number || '', items: r.items || [{ ...EMPTY_ITEM }] });
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
    const payload = { ...form, account_number: form.account_number || null, total: calcTotal(form.items) };
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
    if (!window.confirm(`Delete ${selectedIds.size} selected invoice(s)?`)) return;
    try {
      await api.delete('/accounting/invoices/bulk', { data: { ids: Array.from(selectedIds) } });
      setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      if (previewInv && selectedIds.has(previewInv.id)) setPreviewInv(null);
      setSelectedIds(new Set());
    } catch { setError('Failed to delete selected invoices.'); }
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

      {/* Sub-tabs */}
      <div className="docs-inner-tabs" style={{ marginBottom: 24 }}>
        <button className={`docs-inner-tab${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>Invoice List</button>
        <button className={`docs-inner-tab${tab === 'scanner' ? ' active' : ''}`} onClick={() => setTab('scanner')}>
          🔍 Invoice Scanner
        </button>
      </div>

      {/* ── SCANNER TAB ─────────────────────────── */}
      {tab === 'scanner' && (
        <div style={{ maxWidth: 780 }}>
          {/* Upload area */}
          {!scanResult && (
            <div
              onClick={() => scanInputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setScanFile(f); setScanResult(null); setScanError(''); if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setScanPreview(ev.target.result); r.readAsDataURL(f); } else setScanPreview(null); } }}
              style={{
                border: '2px dashed var(--border)', borderRadius: 14, padding: '48px 32px',
                textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)',
                transition: 'border-color 0.2s', marginBottom: 20,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <input ref={scanInputRef} type="file" accept="image/*,.pdf" onChange={handleScanFile} style={{ display: 'none' }} />
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
                {scanFile ? scanFile.name : 'Drop invoice here or click to upload'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Supports JPG, PNG, WEBP, PDF · Max 20MB</div>
            </div>
          )}

          {/* Image preview */}
          {scanPreview && !scanResult && (
            <div style={{ marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', maxHeight: 320 }}>
              <img src={scanPreview} alt="Invoice preview" style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
            </div>
          )}

          {/* Action buttons */}
          {scanFile && !scanResult && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                className="btn-add"
                onClick={handleScan}
                disabled={scanning}
                style={{ opacity: scanning ? 0.7 : 1 }}
              >
                {scanning ? '🔍 Analyzing…' : '🔍 Analyze Invoice'}
              </button>
              <button className="btn-secondary-outline" onClick={resetScan}>Clear</button>
            </div>
          )}

          {scanError && (
            <div className="msg-error" style={{ marginBottom: 16 }}>{scanError}</div>
          )}

          {/* Scanning spinner */}
          {scanning && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 15 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚙️</div>
              Gemini is reading your invoice…
            </div>
          )}

          {/* Results */}
          {scanResult && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-2)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>✅ Invoice Analyzed</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Extracted payment details below</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {scanSaved ? (
                    <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>✅ Saved to Invoices</span>
                  ) : (
                    <button className="btn-add" onClick={handleSaveScanned} disabled={scanSaving} style={{ fontSize: 13 }}>
                      {scanSaving ? 'Saving…' : '💾 Save to Invoices'}
                    </button>
                  )}
                  <button className="btn-secondary-outline" onClick={resetScan} style={{ fontSize: 13 }}>Scan Another</button>
                </div>
              </div>

              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Amount highlight */}
                <div style={{ gridColumn: '1 / -1', background: 'rgba(37,99,235,0.08)', border: '1.5px solid rgba(37,99,235,0.2)', borderRadius: 10, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ fontSize: 36 }}>💰</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 4 }}>Amount to Transfer</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                      {scanResult.amount ? `${scanResult.amount} ${scanResult.currency || ''}` : '—'}
                    </div>
                  </div>
                </div>

                {[
                  { icon: '🏢', label: 'Pay To', value: scanResult.payee },
                  { icon: '📅', label: 'Due Date', value: scanResult.due_date },
                  { icon: '📋', label: 'Invoice Date', value: scanResult.invoice_date },
                  { icon: '🔢', label: 'Invoice #', value: scanResult.invoice_number },
                  { icon: '🏦', label: 'Bank', value: scanResult.bank_name },
                  { icon: '💳', label: 'Account / IBAN', value: scanResult.account_number },
                  { icon: '🌐', label: 'SWIFT / BIC', value: scanResult.swift_bic },
                  { icon: '📝', label: 'Description', value: scanResult.description },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-4)' }}>{icon} {label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: value ? 'var(--text)' : 'var(--text-4)', fontStyle: value ? 'normal' : 'italic' }}>
                      {value || 'Not found'}
                    </div>
                  </div>
                ))}

                {scanResult.notes && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-2)', paddingTop: 16, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-4)', marginBottom: 6 }}>📌 Notes</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{scanResult.notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIST TAB ─────────────────────────────── */}
      {tab === 'list' && <>

      <div className="acc-summary">
        <div className="acc-summary-card"><span className="acc-summary-label">Total</span><span className="acc-summary-value">{records.length}</span></div>
        <div className="acc-summary-card"><span className="acc-summary-label">Paid</span><span className="acc-summary-value green">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
        <div className="acc-summary-card"><span className="acc-summary-label">Pending</span><span className="acc-summary-value blue">${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
      </div>

      <div className="acc-header-row">
        <div />
        <button className="btn-add" onClick={openNew}>+ New Invoice</button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, fontWeight: 500, color: '#555' }}>
          <span>{selectedIds.size} invoice(s) selected</span>
          <button
            onClick={handleBulkDelete}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#e53935', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <IconDelete /> Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ background: '#f5f5f5', color: '#666', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Clear
          </button>
        </div>
      )}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>Loading…</p></div> : records.length === 0 ? (
          <div className="acc-empty"><div className="acc-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg></div><p>No invoices yet. Create your first one.</p></div>
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
                  title="Select all"
                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                />
              </th>
              <th style={{ position: 'relative', width: colWidths[0], whiteSpace: 'nowrap' }}>#<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[1], whiteSpace: 'nowrap' }}>Client<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[2], whiteSpace: 'nowrap' }}>Date<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[3], whiteSpace: 'nowrap' }}>Due Date<div onMouseDown={e => onResizeMouseDown(e, 3)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[4], whiteSpace: 'nowrap' }}>Total<div onMouseDown={e => onResizeMouseDown(e, 4)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[5], whiteSpace: 'nowrap' }}>Status<div onMouseDown={e => onResizeMouseDown(e, 5)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[6], whiteSpace: 'nowrap' }}>Account / IBAN<div onMouseDown={e => onResizeMouseDown(e, 6)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[7], whiteSpace: 'nowrap' }}><div onMouseDown={e => onResizeMouseDown(e, 7)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
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
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.invoice_number}</strong></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.client}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.date}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.due_date || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-amount">{r.currency} {parseFloat(r.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className={statusClass(r.status)}>{r.status}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{r.account_number || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    <div className="action-btns">
                      <button className="btn-icon" title="Preview" onClick={() => setPreviewInv(r)} style={{ color: '#64748b' }}><IconEye /></button>
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
                <button className="ut-cancel-btn" style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }} onClick={addItem}>+ Add Item</button>
                <div className="inv-total-row"><span className="inv-total">Total: {form.currency} {calcTotal(form.items).toFixed(2)}</span></div>
              </div>
            </div>

            <div className="acc-form-grid">
              <div className="acc-form-group"><label>Account / IBAN</label><input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="GE00TB0000000000000000" /></div>
              <div className="acc-form-group full"><label>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Payment terms, bank details…" /></div>
            </div>

            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Invoice'}</button>
            </div>
          </div>
        </div>
      )}
      </>}

    </>
  );
}

const today = () => new Date().toISOString().split('T')[0];
export default Invoices;
