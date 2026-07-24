import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

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
function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function IconAttachment() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}

const today = () => new Date().toISOString().split('T')[0];
const genInvoiceNumber = () => `INV-${Math.floor(100000 + Math.random() * 900000)}`;

// Last working day (Mon-Fri, excluding company holidays) of a given YYYY-MM.
function lastWorkingDay(yearMonth, holidayDates) {
  const [y, m] = yearMonth.split('-').map(Number);
  let d = new Date(y, m, 0); // day 0 of next month = last day of this month
  while (true) {
    const dow = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidayDates.has(iso)) return iso;
    d.setDate(d.getDate() - 1);
  }
}

const EMPTY_FORM = {
  invoice_number: '', client: '', client_email: '', amount: '', currency: 'GEL',
  description: '', due_date: '', notes: '', attachment_name: '', attachment_data: '',
  schedule_mode: 'auto', schedule_month: new Date().toISOString().slice(0, 7),
  scheduled_send_date: '', auto_send: true,
};

const STATUS_COLORS = {
  draft:     { bg: 'rgba(148,163,184,0.15)', color: '#64748b', label: 'Draft' },
  scheduled: { bg: 'rgba(234,179,8,0.12)',   color: '#b45309', label: 'Scheduled' },
  sent:      { bg: 'rgba(71,156,115,0.12)',   color: '#479c73', label: 'Sent' },
};

function ProjectInvoices({ projects }) {
  const { t } = useLanguage();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [computedDate, setComputedDate] = useState('');
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const loadInvoices = useCallback(async () => {
    if (!selectedProjectId) { setInvoices([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/accounting/invoices?project_id=${selectedProjectId}`);
      setInvoices(res.data.records || []);
    } catch { setError(t('projInv.failedLoad')); }
    finally { setLoading(false); }
  }, [selectedProjectId, t]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // Recompute the auto "last working day" whenever the schedule month changes.
  useEffect(() => {
    if (form.schedule_mode !== 'auto' || !showForm) return;
    const year = form.schedule_month.slice(0, 4);
    setHolidaysLoading(true);
    api.get(`/holidays?year=${year}`)
      .then(res => {
        const set = new Set((res.data.holidays || []).map(h => h.date));
        setComputedDate(lastWorkingDay(form.schedule_month, set));
      })
      .catch(() => setComputedDate(''))
      .finally(() => setHolidaysLoading(false));
  }, [form.schedule_mode, form.schedule_month, showForm]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, invoice_number: genInvoiceNumber(), client: selectedProject?.client || '' });
    setEditId(null); setShowForm(true); setError('');
  };

  const openEdit = (inv) => {
    const items = Array.isArray(inv.items) ? inv.items : [];
    const isAuto = !!inv.scheduled_send_date; // we don't persist mode, infer manual by default on edit
    setForm({
      invoice_number: inv.invoice_number || '', client: inv.client || '', client_email: inv.client_email || '',
      amount: inv.total ?? '', currency: inv.currency || 'GEL',
      description: items[0]?.description || '', due_date: inv.due_date || '', notes: inv.notes || '',
      attachment_name: inv.attachment_name || '', attachment_data: '',
      schedule_mode: 'manual', schedule_month: new Date().toISOString().slice(0, 7),
      scheduled_send_date: inv.scheduled_send_date || '', auto_send: !!inv.auto_send,
    });
    setEditId(inv.id); setShowForm(true); setError('');
    void isAuto;
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setForm(f => ({ ...f, attachment_name: file.name, attachment_data: e.target.result }));
    reader.readAsDataURL(file);
  };

  const finalSendDate = form.schedule_mode === 'auto' ? computedDate : form.scheduled_send_date;

  const handleSave = async () => {
    if (!form.invoice_number.trim() || !form.client.trim() || !form.amount) {
      setError(t('projInv.validationError')); return;
    }
    if (form.auto_send && !form.client_email.trim()) {
      setError(t('projInv.emailRequiredForAutoSend')); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        project_id: selectedProjectId,
        client: form.client, client_email: form.client_email || null,
        invoice_number: form.invoice_number, date: today(), due_date: form.due_date || null,
        currency: form.currency, status: 'draft', notes: form.notes,
        items: [{ description: form.description, qty: 1, unit_price: parseFloat(form.amount) || 0 }],
        total: parseFloat(form.amount) || 0,
        recurrence: 'none', auto_send: form.auto_send,
        scheduled_send_date: finalSendDate || null,
      };
      if (form.attachment_data) {
        payload.attachment_name = form.attachment_name;
        payload.attachment_data = form.attachment_data;
      }
      if (editId) await api.put(`/accounting/invoices/${editId}`, payload);
      else await api.post('/accounting/invoices', payload);
      setShowForm(false); loadInvoices();
    } catch (err) { setError(err.response?.data?.error || t('projInv.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('projInv.deleteConfirm'))) return;
    try { await api.delete(`/accounting/invoices/${id}`); loadInvoices(); }
    catch { setError(t('projInv.failedDelete')); }
  };

  const handleSendNow = async (inv) => {
    if (!inv.client_email) { setError(t('projInv.noEmail')); return; }
    if (!window.confirm(t('projInv.sendConfirm'))) return;
    setSendingId(inv.id); setError(''); setSuccess('');
    try {
      await api.post(`/accounting/invoices/${inv.id}/send`);
      setSuccess(t('projInv.sendSuccess'));
      setTimeout(() => setSuccess(''), 4000);
      loadInvoices();
    } catch (err) { setError(err.response?.data?.error || t('projInv.sendFailed')); }
    finally { setSendingId(null); }
  };

  const statusOf = (inv) => inv.status === 'sent' ? 'sent' : (inv.scheduled_send_date ? 'scheduled' : 'draft');

  return (
    <div>
      <div style={{ marginBottom: 20, maxWidth: 360 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>
          {t('projInv.selectProject')}
        </label>
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border-2)', borderRadius: 8, fontSize: 14, background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <option value="">{t('projInv.selectProjectPlaceholder')}</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selectedProjectId ? (
        <div className="acc-empty"><p>{t('projInv.pickProjectHint')}</p></div>
      ) : (
        <>
          <div className="acc-header-row">
            <div />
            <button className="btn-add" onClick={openNew}>{t('projInv.addInvoice')}</button>
          </div>

          {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ background: 'rgba(71,156,115,0.1)', color: '#479c73', border: '1px solid rgba(71,156,115,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{success}</div>}

          <div className="acc-table-wrapper">
            {loading ? <div className="acc-empty"><p>{t('projInv.loading')}</p></div> : invoices.length === 0 ? (
              <div className="acc-empty"><p>{t('projInv.noInvoices')}</p></div>
            ) : (
              <table className="acc-table">
                <thead><tr>
                  <th>{t('projInv.colNumber')}</th>
                  <th>{t('projInv.colClient')}</th>
                  <th style={{ textAlign: 'right' }}>{t('projInv.colAmount')}</th>
                  <th>{t('projInv.colScheduled')}</th>
                  <th>{t('projInv.colFile')}</th>
                  <th>{t('projInv.colStatus')}</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {invoices.map((inv, i) => {
                    const st = statusOf(inv);
                    const sc = STATUS_COLORS[st];
                    return (
                      <tr key={inv.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{inv.invoice_number}</td>
                        <td>{inv.client}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{parseFloat(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {inv.currency}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>{inv.scheduled_send_date || '—'}</td>
                        <td>{inv.attachment_name ? <span title={inv.attachment_name} style={{ color: '#3b82f6', display: 'inline-flex' }}><IconAttachment /></span> : '—'}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: sc.bg, color: sc.color }}>
                            {t(`projInv.status${sc.label}`)}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            {st !== 'sent' && (
                              <button className="btn-icon" onClick={() => handleSendNow(inv)} disabled={sendingId === inv.id} title={t('projInv.sendNow')} style={{ color: '#479c73' }}>
                                <IconSend />
                              </button>
                            )}
                            <button className="btn-icon" onClick={() => openEdit(inv)} title="Edit" style={{ color: '#3b82f6' }}><IconEdit /></button>
                            <button className="btn-icon btn-delete" onClick={() => handleDelete(inv.id)} title="Delete"><IconDelete /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {showForm && createPortal(
        <div className="acc-modal-overlay">
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? t('projInv.editInvoice') : t('projInv.newInvoice')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group"><label>{t('projInv.invoiceNumber')}</label><input type="text" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} /></div>
              <div className="acc-form-group"><label>{t('projInv.client')}</label><input type="text" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} /></div>
              <div className="acc-form-group"><label>{t('projInv.clientEmail')}</label><input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} placeholder="client@example.com" /></div>
              <div className="acc-form-group"><label>{t('projInv.amount')}</label><input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="acc-form-group"><label>{t('projInv.currency')}</label>
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                  <option>GEL</option><option>USD</option><option>EUR</option>
                </select>
              </div>
              <div className="acc-form-group"><label>{t('projInv.dueDate')}</label><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div className="acc-form-group full"><label>{t('projInv.description')}</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t('projInv.descriptionPlaceholder')} /></div>
              <div className="acc-form-group full"><label>{t('projInv.notes')}</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

              <div className="acc-form-group full">
                <label>{t('projInv.attachment')}</label>
                <input type="file" onChange={e => handleFile(e.target.files[0])} />
                {form.attachment_name && <span style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{form.attachment_name}</span>}
              </div>

              <div className="acc-form-group full" style={{ borderTop: '1px solid var(--border-2)', paddingTop: 14, marginTop: 4 }}>
                <label style={{ marginBottom: 8 }}>{t('projInv.scheduleLabel')}</label>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer' }}>
                    <input type="radio" checked={form.schedule_mode === 'auto'} onChange={() => setForm({ ...form, schedule_mode: 'auto' })} />
                    {t('projInv.scheduleAuto')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer' }}>
                    <input type="radio" checked={form.schedule_mode === 'manual'} onChange={() => setForm({ ...form, schedule_mode: 'manual' })} />
                    {t('projInv.scheduleManual')}
                  </label>
                </div>

                {form.schedule_mode === 'auto' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <input type="month" value={form.schedule_month} onChange={e => setForm({ ...form, schedule_month: e.target.value })} style={{ padding: '8px 12px', border: '1.5px solid var(--border-2)', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text)' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      {holidaysLoading ? t('projInv.computing') : (computedDate ? `${t('projInv.willSendOn')} ${computedDate}` : '—')}
                    </span>
                  </div>
                ) : (
                  <input type="date" value={form.scheduled_send_date} onChange={e => setForm({ ...form, scheduled_send_date: e.target.value })} style={{ padding: '8px 12px', border: '1.5px solid var(--border-2)', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text)' }} />
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginTop: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.auto_send} onChange={e => setForm({ ...form, auto_send: e.target.checked })} />
                  {t('projInv.autoSendCheckbox')}
                </label>
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{t('projInv.autoSendHint')}</div>
              </div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('projInv.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('projInv.saving') : t('projInv.save')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ProjectInvoices;
