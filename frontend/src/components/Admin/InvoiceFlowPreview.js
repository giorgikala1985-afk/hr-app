import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';

// ── A redesigned invoice upload → extract → review → send-to-transfer flow.
// Preview only (Admin section) -- the live version stays at Accounting >
// Invoices untouched. Point of the redesign: one continuous flow instead of
// upload-tab / edit-tab / send being three separate places.

const CURRENCIES = ['GEL', 'USD', 'EUR'];

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toCardRecord(r, prevAgentId) {
  return {
    id: r.id,
    fileName: r.file_name,
    fileType: r.file_type,
    uploadDate: r.upload_date,
    sent: r.sent || false,
    urgent: r.urgent || false,
    extractError: r.extracted?.error || null,
    payee: r.extracted?.payee || '',
    amount: r.extracted?.amount != null ? String(r.extracted.amount) : '',
    currency: r.extracted?.currency || 'GEL',
    invoiceNumber: r.extracted?.invoice_number || '',
    dueDate: r.due_date || r.extracted?.due_date || '',
    iban: r.extracted?.account_number || '',
    description: r.extracted?.description || '',
    matchedAgent: r.extracted?.matched_agent || null,
    agentId: prevAgentId || null,
  };
}

function IconUpload() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function IconFile() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
function IconCheck() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function IconRefresh() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
}
function IconTrash() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
}
function IconEye() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function IconSend() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}
function IconClose() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

const inp = {
  width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
  border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text)',
  fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
};
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' };

function Field({ label, full, children }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ rec }) {
  if (rec.extractError) return <span style={{ ...badgeBase, background: 'rgba(220,38,38,0.12)', color: '#ef4444', border: '1px solid rgba(220,38,38,0.3)' }}>Couldn't read file</span>;
  if (rec.sent) return <span style={{ ...badgeBase, background: 'rgba(71,156,115,0.12)', color: '#479c73', border: '1px solid rgba(71,156,115,0.3)' }}><IconCheck /> Sent</span>;
  return <span style={{ ...badgeBase, background: 'rgba(217,119,6,0.12)', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)' }}>Needs review</span>;
}
const badgeBase = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' };

export default function InvoiceFlowPreview() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('needsReview');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [rescanningId, setRescanningId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [previewFor, setPreviewFor] = useState(null); // record id
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/invoices/uploads');
      setRecords((res.data.uploads || []).map(r => toCardRecord(r)));
    } catch { /* non-critical */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const showToast = (msg, tone = 'ok') => { setToast({ msg, tone }); setTimeout(() => setToast(null), 3500); };

  const updateField = (id, field, value) => setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const applyMatch = (id) => setRecords(prev => prev.map(r => {
    if (r.id !== id || !r.matchedAgent) return r;
    return { ...r, payee: r.matchedAgent.name, iban: r.matchedAgent.account_number || r.iban, agentId: r.matchedAgent.id, matchedAgent: null };
  }));

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.size <= 10 * 1024 * 1024);
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      try {
        const fileData = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = (e) => resolve(e.target.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const res = await api.post('/accounting/invoices/uploads', {
          file_name: file.name,
          file_type: file.type,
          file_data: fileData,
          upload_date: new Date().toISOString().slice(0, 10),
        });
        setRecords(prev => [toCardRecord(res.data.upload), ...prev]);
      } catch {
        showToast(`Failed to upload ${file.name}`, 'error');
      }
    }
    setUploading(false);
  };

  const handleRescan = async (id) => {
    setRescanningId(id);
    try {
      const res = await api.post(`/accounting/invoices/uploads/${id}/rescan`);
      setRecords(prev => prev.map(r => r.id === id ? toCardRecord(res.data.upload, r.agentId) : r));
    } catch {
      showToast('Rescan failed', 'error');
    } finally { setRescanningId(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this invoice from the list?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/accounting/invoices/uploads/${id}`);
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch {
      showToast('Delete failed', 'error');
    } finally { setDeletingId(null); }
  };

  const toggleUrgent = async (rec) => {
    const next = !rec.urgent;
    updateField(rec.id, 'urgent', next);
    api.patch(`/accounting/invoices/uploads/${rec.id}`, { urgent: next }).catch(() => {});
  };

  const handleSend = async (rec) => {
    if (!rec.payee.trim() || !rec.amount || !rec.dueDate) {
      showToast('Fill in recipient, amount and due date before sending.', 'error');
      return;
    }
    setSendingId(rec.id);
    try {
      await api.post('/accounting/transfers', {
        client_name: rec.payee.trim(),
        agent_id: rec.agentId || null,
        amount: parseFloat(rec.amount),
        due_date: rec.dueDate,
        description: rec.description || '',
        iban: rec.iban || null,
        invoice_number: rec.invoiceNumber || null,
        status: rec.urgent ? 'urgent' : 'normal',
      });
      updateField(rec.id, 'sent', true);
      api.patch(`/accounting/invoices/uploads/${rec.id}`, { sent: true }).catch(() => {});
      showToast(`Sent to Transfers — ${rec.payee}`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send.', 'error');
    } finally { setSendingId(null); }
  };

  const openPreview = async (id) => {
    setPreviewFor(id);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const res = await api.get(`/accounting/invoices/uploads/${id}/file`);
      setPreviewData(res.data);
    } catch { /* leave null, modal shows a fallback */ } finally { setPreviewLoading(false); }
  };

  const filtered = records.filter(r => filter === 'all' ? true : filter === 'sent' ? r.sent : !r.sent && !r.extractError);
  const counts = {
    all: records.length,
    needsReview: records.filter(r => !r.sent && !r.extractError).length,
    sent: records.filter(r => r.sent).length,
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Invoice Flow — redesign preview</h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-4)' }}>
          Same data as Accounting → Invoices, one continuous flow instead of separate upload/edit tabs. Upload, review, and send all happen right here.
        </p>
      </div>

      {/* Upload dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#3b82f6' : 'var(--border-2)'}`,
          borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(59,130,246,0.06)' : 'var(--surface)',
          transition: 'all 0.15s', marginBottom: 20,
        }}
      >
        <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }}
          onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
        <div style={{ color: dragOver ? '#3b82f6' : 'var(--text-3)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconUpload /></div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {uploading ? 'Uploading and reading…' : 'Drop invoices here, or click to browse'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>PDF or image, up to 10MB each · multiple files at once</div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'needsReview', label: 'Needs Review', count: counts.needsReview },
          { key: 'sent', label: 'Sent', count: counts.sent },
          { key: 'all', label: 'All', count: counts.all },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 9,
            border: `1.5px solid ${filter === f.key ? '#3b82f6' : 'var(--border-2)'}`,
            background: filter === f.key ? 'rgba(59,130,246,0.1)' : 'var(--surface)',
            color: filter === f.key ? '#3b82f6' : 'var(--text-3)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {f.label}
            <span style={{ background: filter === f.key ? '#3b82f6' : 'var(--border-2)', color: filter === f.key ? '#fff' : 'var(--text-3)', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, color: 'var(--text-3)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{filter === 'sent' ? 'Nothing sent yet' : 'Nothing to review'}</div>
          <div style={{ fontSize: 12 }}>Drop an invoice above to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(rec => (
            <div key={rec.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, padding: 16, opacity: rec.sent ? 0.75 : 1 }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: rec.extractError ? 0 : 14, gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconFile /></div>
                  <div style={{ minWidth: 0 }}>
                    <button onClick={() => openPreview(rec.id)} title="Preview file" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 5, maxWidth: 320, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: 'inherit' }}>
                      <IconEye /> {rec.fileName}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{formatDate(rec.uploadDate)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <StatusBadge rec={rec} />
                  <button onClick={() => handleDelete(rec.id)} disabled={deletingId === rec.id} title="Remove" style={{ width: 26, height: 26, border: '1px solid var(--border-2)', borderRadius: 7, background: 'var(--surface-2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconTrash /></button>
                </div>
              </div>

              {rec.extractError ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', marginTop: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 9 }}>
                  <span style={{ fontSize: 12, color: '#ef4444' }}>{rec.extractError}</span>
                  <button onClick={() => handleRescan(rec.id)} disabled={rescanningId === rec.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(220,38,38,0.3)', background: 'var(--surface)', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    <IconRefresh /> {rescanningId === rec.id ? 'Retrying…' : 'Retry'}
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10 }}>
                    <Field label="Recipient">
                      <input value={rec.payee} onChange={e => updateField(rec.id, 'payee', e.target.value)} placeholder="Company or person" style={inp} disabled={rec.sent} />
                      {rec.matchedAgent && (
                        <button type="button" onClick={() => applyMatch(rec.id)} title={rec.matchedAgent.account_number || ''}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, padding: '3px 8px', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%' }}>
                          🔎 {rec.matchedAgent.name}{rec.matchedAgent.account_number ? ` · ${rec.matchedAgent.account_number}` : ''}
                        </button>
                      )}
                    </Field>
                    <Field label="Amount">
                      <input type="number" min="0" step="0.01" value={rec.amount} onChange={e => updateField(rec.id, 'amount', e.target.value)} placeholder="0.00" style={{ ...inp, fontFamily: 'var(--font-mono)' }} disabled={rec.sent} />
                    </Field>
                    <Field label="Currency">
                      <select value={rec.currency} onChange={e => updateField(rec.id, 'currency', e.target.value)} style={inp} disabled={rec.sent}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Invoice #">
                      <input value={rec.invoiceNumber} onChange={e => updateField(rec.id, 'invoiceNumber', e.target.value)} placeholder="INV-0001" style={inp} disabled={rec.sent} />
                    </Field>
                    <Field label="Due Date">
                      <input type="date" value={rec.dueDate} onChange={e => updateField(rec.id, 'dueDate', e.target.value)} style={inp} disabled={rec.sent} />
                    </Field>
                    <Field label="IBAN">
                      <input value={rec.iban} onChange={e => updateField(rec.id, 'iban', e.target.value)} placeholder="GE00XX..." style={{ ...inp, fontFamily: 'var(--font-mono)' }} disabled={rec.sent} />
                    </Field>
                    <Field label="Description" full>
                      <input value={rec.description} onChange={e => updateField(rec.id, 'description', e.target.value)} placeholder="What this invoice is for" style={inp} disabled={rec.sent} />
                    </Field>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleRescan(rec.id)} disabled={rescanningId === rec.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <IconRefresh /> {rescanningId === rec.id ? 'Rescanning…' : 'Rescan'}
                      </button>
                      <button onClick={() => toggleUrgent(rec)} disabled={rec.sent} style={{ padding: '6px 11px', borderRadius: 7, border: `1px solid ${rec.urgent ? 'rgba(239,68,68,0.4)' : 'var(--border-2)'}`, background: rec.urgent ? 'rgba(239,68,68,0.1)' : 'var(--surface-2)', color: rec.urgent ? '#ef4444' : 'var(--text-3)', fontSize: 11, fontWeight: 700, cursor: rec.sent ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {rec.urgent ? '⚡ Urgent' : 'Mark urgent'}
                      </button>
                    </div>
                    {rec.sent ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#479c73' }}><IconCheck /> Sent to Transfers</span>
                    ) : (
                      <button onClick={() => handleSend(rec)} disabled={sendingId === rec.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: sendingId === rec.id ? 'not-allowed' : 'pointer', opacity: sendingId === rec.id ? 0.6 : 1, fontFamily: 'inherit' }}>
                        <IconSend /> {sendingId === rec.id ? 'Sending…' : 'Send to Transfer'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewFor && createPortal(
        <div onClick={() => setPreviewFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-2)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{previewData?.file_name || 'Loading…'}</span>
              <button onClick={() => setPreviewFor(null)} style={{ width: 28, height: 28, border: 'none', background: 'var(--surface-2)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClose /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              {previewLoading ? (
                <div style={{ color: 'var(--text-4)', fontSize: 13 }}>Loading file…</div>
              ) : !previewData ? (
                <div style={{ color: 'var(--text-4)', fontSize: 13 }}>Couldn't load this file.</div>
              ) : previewData.file_type?.startsWith('image/') ? (
                <img src={previewData.file_data} alt={previewData.file_name} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />
              ) : (
                <iframe title="invoice-preview" src={previewData.file_data} style={{ width: '100%', height: '75vh', border: 'none' }} />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && createPortal(
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1100,
          padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#fff',
          background: toast.tone === 'error' ? '#dc2626' : '#479c73', boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        }}>
          {toast.msg}
        </div>,
        document.body
      )}
    </div>
  );
}
