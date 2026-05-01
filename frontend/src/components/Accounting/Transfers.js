import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const fmt = (n) =>
  n != null ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '—';

const CURRENCIES = ['GEL', 'USD', 'EUR'];

const STATUS_VALUES = ['normal', 'urgent', 'super_urgent'];

const urgencyStyle = (status) =>
  status === 'super_urgent'
    ? { background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }
    : status === 'urgent'
    ? { background: 'rgba(234,88,12,0.12)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.25)' }
    : { background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)' };

const approvalStyle = (s) =>
  s === 'approved'
    ? { background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)' }
    : s === 'rejected'
    ? { background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }
    : { background: 'rgba(234,179,8,0.12)', color: '#facc15', border: '1px solid rgba(234,179,8,0.25)' };

// ── Transfers (existing) ──────────────────────────────────────────────────────

function TransfersList() {
  const { t } = useLanguage();
  const STATUS_OPTIONS = [
    { value: 'normal',       label: t('tr.statusNormal') },
    { value: 'urgent',       label: t('tr.statusUrgent') },
    { value: 'super_urgent', label: t('tr.statusSuperUrgent') },
  ];
  const statusLabel = (s) =>
    s === 'super_urgent' ? t('tr.statusSuperUrgent') : s === 'urgent' ? t('tr.statusUrgent') : t('tr.statusNormal');

  const [transfers, setTransfers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState('agent');
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [clientName, setClientName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [agentOpen, setAgentOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [desc, setDesc] = useState('');
  const [iban, setIban] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [status, setStatus] = useState('normal');
  const [requesterName, setRequesterName] = useState('');
  const [canInitiate, setCanInitiate] = useState(true);
  const [canApprove, setCanApprove] = useState(true);
  const [canReject, setCanReject] = useState(true);
  const [isCFO, setIsCFO] = useState(false);
  const [partialModal, setPartialModal] = useState(null); // { id, amount }
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNote, setPartialNote] = useState('');
  const [invoiceRaw, setInvoiceRaw] = useState(null); // { data: base64, mimeType }
  const [invoiceProcessing, setInvoiceProcessing] = useState(false);
  const [invoiceProcessError, setInvoiceProcessError] = useState('');
  const [invoiceFileKey, setInvoiceFileKey] = useState(0);
  const [invoiceReading, setInvoiceReading] = useState(false);
  const [invoiceReadData, setInvoiceReadData] = useState(null);
  const readInvoiceRef = useRef(null);

  useEffect(() => { loadTransfers(); loadAgents(); loadPermission(); }, []);

  const loadPermission = async () => {
    try {
      const stored = localStorage.getItem('member_user');
      if (!stored) { setCanInitiate(true); setCanApprove(true); setCanReject(true); setIsCFO(true); return; } // Super Admin / Supabase user
      const member = JSON.parse(stored);
      const role = member?.rights;
      setIsCFO(role === 'CFO');
      if (!role) { setCanInitiate(true); setCanApprove(true); setCanReject(true); return; }
      const res = await api.get('/user-matrix');
      const matches = (res.data.rows || []).filter(r => r.role === role);
      const denied = (key) => matches.some(r => r[key] === 'No');
      setCanInitiate(matches.length > 0 ? !denied('initiate_transfer') : true);
      setCanApprove(matches.length > 0 ? !denied('approve_transfer') : true);
      setCanReject(matches.length > 0 ? !denied('reject_transfer') : true);
    } catch { setCanInitiate(true); setCanApprove(true); setCanReject(true); setIsCFO(false); }
  };

  const doAction = async (id, action, body) => {
    try {
      await api.post(`/accounting/transfers/${id}/${action}`, body || {});
      loadTransfers();
    } catch (err) { setError(err.response?.data?.error || `Failed: ${action}`); }
  };
  const handleApprove = (id) => doAction(id, 'approve');
  const handleReject = (id) => {
    const note = window.prompt(t('tr.rejectReasonPrompt')) || '';
    doAction(id, 'reject', { note });
  };
  const handleWait = (id) => {
    const note = window.prompt(t('tr.waitReasonPrompt')) || '';
    doAction(id, 'wait', { note });
  };
  const openPartial = (tr) => { setPartialModal(tr); setPartialAmount(String(tr.amount || '')); setPartialNote(''); };
  const submitPartial = async () => {
    const amt = parseFloat(partialAmount);
    if (!amt || amt <= 0) return;
    await doAction(partialModal.id, 'partial', { approved_amount: amt, note: partialNote });
    setPartialModal(null);
  };

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setInvoiceProcessing(true); setInvoiceProcessError(''); setInvoiceRaw(null);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = ev => res(ev.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      setInvoiceRaw({ data: dataUrl.split(',')[1], mimeType: file.type });
    } catch {
      setInvoiceProcessError('Failed to process file');
    } finally {
      setInvoiceProcessing(false);
    }
  };

  const applyInvoiceResult = (d, setters) => {
    if (d.payee) { setters.setClientName(d.payee); setters.setAgentSearch(d.payee); setters.setAgentId(''); }
    if (d.amount != null) setters.setAmount(String(d.amount));
    if (d.due_date) setters.setDueDate(d.due_date);
    if (d.description) setters.setDesc(d.description);
    if (d.account_number) setters.setIban(d.account_number);
    if (d.invoice_number) setters.setInvoiceNumber(d.invoice_number);
  };

  const runScan = async (base64, mimeType) => {
    setInvoiceReading(true);
    setInvoiceReadData(null);
    try {
      const res = await api.post('/accounting/invoices/scan', { data: base64, mimeType });
      const d = res.data.result || {};
      setInvoiceReadData(d);
      applyInvoiceResult(d, { setClientName, setAgentSearch, setAgentId, setAmount, setDueDate, setDesc, setIban, setInvoiceNumber });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to read invoice.';
      setInvoiceReadData({ _error: msg });
    } finally {
      setInvoiceReading(false);
      setTimeout(() => readInvoiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  };

  const handleReadInvoice = () => {
    if (!invoiceRaw || invoiceReading) return;
    runScan(invoiceRaw.data, invoiceRaw.mimeType);
  };

  const handleReadInvoiceFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setInvoiceFileKey(k => k + 1);
    const dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = ev => res(ev.target.result);
      reader.onerror = () => rej(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(',')[1];
    const mimeType = file.type || 'application/pdf';
    setInvoiceRaw({ data: base64, mimeType });
    runScan(base64, mimeType);
  };

  const approvalBadge = (s) => {
    const map = {
      pending:  { bg: 'rgba(234,179,8,0.12)',  color: '#facc15', label: t('tr.approvalPending') },
      approved: { bg: 'rgba(22,163,74,0.12)',  color: '#4ade80', label: t('tr.approvalApproved') },
      rejected: { bg: 'rgba(220,38,38,0.12)',  color: '#f87171', label: t('tr.approvalRejected') },
      partial:  { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', label: t('tr.approvalPartial') },
      wait:     { bg: 'rgba(148,163,184,0.18)',color: '#cbd5e1', label: t('tr.approvalWait') },
      archived: { bg: 'rgba(100,116,139,0.15)',color: '#94a3b8', label: t('tr.approvalArchived') },
    };
    return map[s] || map.pending;
  };

  const loadTransfers = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/accounting/transfers');
      setTransfers(res.data.records || []);
    } catch (err) { setError(err.response?.data?.error || t('tr.failedLoad')); }
    finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try { const res = await api.get('/accounting/agents'); setAgents(res.data.records || []); } catch {}
  };

  const openNew = () => {
    setFormTab('agent');
    setEditId(null); setClientName(''); setAgentId(''); setAgentSearch('');
    setAmount(''); setDueDate(''); setDesc(''); setIban(''); setInvoiceNumber('');
    setStatus('normal'); setRequesterName('');
    setFormError(''); setInvoiceRaw(null); setInvoiceProcessing(false); setInvoiceProcessError(''); setInvoiceFileKey(k => k + 1); setInvoiceReadData(null);
    setShowForm(true);
  };

  const openEdit = (tr) => {
    setEditId(tr.id); setClientName(tr.client_name || '');
    const agent = agents.find(a => a.id === tr.agent_id);
    setAgentId(tr.agent_id || ''); setAgentSearch(agent ? agent.name : '');
    setAmount(tr.amount ? String(tr.amount) : ''); setDueDate(tr.due_date || '');
    setDesc(tr.description || ''); setIban(tr.iban || ''); setInvoiceNumber(tr.invoice_number || '');
    setStatus(tr.status || 'normal');
    setRequesterName(tr.requester_name || '');
    setInvoiceRaw(tr.invoice_raw || null); setInvoiceProcessing(false); setInvoiceProcessError(''); setInvoiceFileKey(k => k + 1); setInvoiceReadData(null);
    setFormError(''); setShowForm(true);
  };

  const handleSave = async () => {
    if (!clientName.trim()) { setFormError(t('tr.clientRequired')); return; }
    if (!amount || parseFloat(amount) <= 0) { setFormError(t('tr.amountRequired')); return; }
    if (!dueDate) { setFormError(t('tr.dueDateRequired')); return; }
    setSaving(true); setFormError('');
    const payload = { client_name: clientName.trim(), agent_id: agentId || null, amount: parseFloat(amount), due_date: dueDate, description: desc.trim(), iban: iban.trim() || null, invoice_number: invoiceNumber.trim() || null, status, invoice_raw: invoiceRaw || null };
    if (editId) payload.requester_name = requesterName.trim();
    try {
      if (editId) await api.put(`/accounting/transfers/${editId}`, payload);
      else await api.post('/accounting/transfers', payload);
      setShowForm(false); loadTransfers();
    } catch (err) { setFormError(err.response?.data?.error || t('tr.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('tr.deleteConfirm'))) return;
    try { await api.delete(`/accounting/transfers/${id}`); loadTransfers(); }
    catch (err) { setError(err.response?.data?.error || t('tr.failedDelete')); }
  };

  const handleArchive = async (id) => {
    if (!window.confirm(t('tr.archiveConfirm'))) return;
    try { await api.post(`/accounting/transfers/${id}/archive`); loadTransfers(); }
    catch (err) { setError(err.response?.data?.error || t('tr.failedArchive')); }
  };

  const filteredTransfers = transfers.filter(tr => filter === 'all' || (tr.approval_status || 'pending') === filter);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: 3, gap: 2 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' }
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: filter === f.key ? 'var(--surface)' : 'transparent',
              color: filter === f.key ? 'var(--text)' : 'var(--text-3)',
              boxShadow: filter === f.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s',
            }}>{f.label}</button>
          ))}
        </div>
        <button
          onClick={openNew}
          className="btn-add"
          disabled={!canInitiate}
          title={canInitiate ? '' : t('tr.noPermission')}
          style={!canInitiate ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          {t('tr.newTransfer')}
        </button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {loading ? (
        <div style={{ color: 'var(--text-3)', padding: 24 }}>{t('tr.loading')}</div>
      ) : transfers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>{t('tr.noTransfers')}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{t('tr.noTransfersHint')}</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                <th style={th}>{t('tr.colStatus')}</th>
                <th style={th}>{t('tr.colClient')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('tr.colAmount')}</th>
                <th style={th}>{t('tr.colDueDate')}</th>
                <th style={th}>{t('tr.colDescription')}</th>
                <th style={th}>{t('tr.colRequester')}</th>
                <th style={th}>{t('tr.colApproval')}</th>
                <th style={{ ...th, width: 240, whiteSpace: 'nowrap' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map((tr, i) => (
                <tr key={tr.id} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, ...urgencyStyle(tr.status) }}>
                      {statusLabel(tr.status)}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{tr.client_name}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>{fmt(tr.amount)}</td>
                  <td style={{ ...td, color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 12 }}>{tr.due_date}</td>
                  <td style={{ ...td, color: 'var(--text-2)' }}>{tr.description}</td>
                  <td style={{ ...td, color: 'var(--text-2)', fontSize: 12 }}>{tr.requester_name || '—'}</td>
                  <td style={td}>
                    {(() => { const b = approvalBadge(tr.approval_status || 'pending'); return (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: b.bg, color: b.color }} title={tr.approver_note || ''}>
                        {b.label}{tr.approval_status === 'partial' && tr.approved_amount != null ? ` (${fmt(tr.approved_amount)})` : ''}
                      </span>
                    ); })()}
                    {tr.approver_name && tr.approval_status !== 'pending' && (
                      <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>{tr.approver_name}</div>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center' }}>
                      {(tr.approval_status || 'pending') === 'pending' && canApprove && (
                        <>
                          <button onClick={() => handleApprove(tr.id)} style={approveBtn} title={t('tr.approve')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button onClick={() => openPartial(tr)} style={partialBtn} title={t('tr.partial')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                          </button>
                          <button onClick={() => handleWait(tr.id)} style={waitBtn} title={t('tr.wait')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </button>
                          {canReject && (
                            <button onClick={() => handleReject(tr.id)} style={rejectBtn} title={t('tr.reject')}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                            </button>
                          )}
                        </>
                      )}
                      <button onClick={() => openEdit(tr)} style={iconBtn} onMouseEnter={e => e.currentTarget.style.color='#3b82f6'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      {tr.invoice_raw && (
                        <span title="Invoice attached" style={{ display: 'inline-flex', alignItems: 'center', padding: 4, color: '#60a5fa' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </span>
                      )}
                      {['approved', 'rejected', 'partial'].includes(tr.approval_status) ? (
                        <button onClick={() => handleArchive(tr.id)} style={iconBtn} title={t('tr.archive')} onMouseEnter={e => e.currentTarget.style.color='#a78bfa'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
                        </button>
                      ) : tr.approval_status !== 'archived' && (
                        <button onClick={() => handleDelete(tr.id)} style={iconBtn} onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={overlay} onClick={() => setShowForm(false)}>
          <div style={{ ...modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{editId ? t('tr.editTransfer') : t('tr.newTransferModal')}</h3>
            
            {!editId && isCFO && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--surface-2)', padding: 4, borderRadius: 10, border: '1px solid var(--border-2)' }}>
                {[
                  { id: 'agent', label: 'By Agent' },
                  { id: 'invoice', label: 'By Invoice' },
                  { id: 'manual', label: 'Manual Input' }
                ].map(tab => (
                  <button key={tab.id} type="button" onClick={() => { setFormTab(tab.id); setInvoiceProcessError(''); }} style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, background: formTab === tab.id ? 'var(--surface)' : 'transparent', color: formTab === tab.id ? 'var(--text)' : 'var(--text-3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: formTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {formError && <div style={{ ...errBox, marginBottom: 14 }}>{formError}</div>}

            {(editId || formTab === 'invoice') && (
              <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10 }}>
                <input
                  key={invoiceFileKey}
                  id="extractInvoiceInput"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleReadInvoiceFile}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    disabled={invoiceReading}
                    onClick={() => {
                      if (invoiceReading) return;
                      if (invoiceRaw) { handleReadInvoice(); }
                      else { document.getElementById('extractInvoiceInput').click(); }
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '9px 20px',
                      border: `1.5px solid ${invoiceReading ? 'var(--border-2)' : '#2563eb'}`,
                      borderRadius: 8,
                      background: invoiceReading ? 'var(--surface-2)' : '#2563eb',
                      color: invoiceReading ? 'var(--text-3)' : '#fff',
                      fontWeight: 700, fontSize: 14,
                      cursor: invoiceReading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {invoiceReading
                      ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Extracting…</>
                      : <>Extract Data</>
                    }
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {invoiceRaw ? '📄 Invoice attached' : 'No invoice — upload a PDF to extract'}
                  </span>
                </div>
              </div>
            )}

            {/* Extraction result — shown full-width between button and form fields */}
            {(editId || formTab === 'invoice') && invoiceReadData && (
              <div ref={readInvoiceRef} style={{ marginBottom: 20 }}>
                {invoiceReadData._error ? (
                  <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 600 }}>
                    ✕ {invoiceReadData._error}
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>✓ Extracted from invoice</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      {[
                        { label: 'Company', value: invoiceReadData.payee },
                        { label: 'Amount', value: invoiceReadData.amount ? `${invoiceReadData.amount} ${invoiceReadData.currency || ''}`.trim() : null },
                        { label: 'Invoice ID', value: invoiceReadData.invoice_number },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: value ? 'var(--text)' : 'var(--text-4)' }}>{value || '—'}</div>
                        </div>
                      ))}
                    </div>
                    {[
                      ['IBAN / Account', invoiceReadData.account_number],
                      ['Bank', invoiceReadData.bank_name],
                      ['SWIFT / BIC', invoiceReadData.swift_bic],
                      ['Due Date', invoiceReadData.due_date],
                      ['Notes', invoiceReadData.notes],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 10, fontSize: 12, marginTop: 4 }}>
                        <span style={{ color: 'var(--text-3)', width: 110, flexShrink: 0 }}>{k}</span>
                        <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: k.includes('IBAN') || k.includes('SWIFT') ? 'monospace' : undefined }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{t('tr.status')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} type="button" onClick={() => setStatus(s.value)} style={{ flex: 1, padding: '8px 0', border: `2px solid ${status === s.value ? 'var(--accent,#2563eb)' : 'var(--border-2)'}`, borderRadius: 8, background: status === s.value ? 'rgba(37,99,235,0.12)' : 'var(--surface-2)', color: status === s.value ? 'var(--accent,#60a5fa)' : 'var(--text-3)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{s.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={lbl}>{t('tr.clientName')}</label>
              {editId || formTab === 'agent' ? (
                <>
                  <input value={agentSearch || clientName} onChange={e => { setAgentSearch(e.target.value); setClientName(e.target.value); setAgentId(''); setAgentOpen(true); }} onFocus={() => setAgentOpen(true)} onBlur={() => setTimeout(() => setAgentOpen(false), 150)} placeholder={t('tr.typeOrSearch')} style={inpStyle} />
                  {agentOpen && agents.filter(a => a.name.toLowerCase().includes((agentSearch || clientName).toLowerCase())).length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                      {agents.filter(a => a.name.toLowerCase().includes((agentSearch || clientName).toLowerCase())).map(a => (
                        <div key={a.id} onMouseDown={() => { setAgentId(a.id); setClientName(a.name); setAgentSearch(a.name); setIban(a.account_number || ''); setAgentOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--border-2)', color: 'var(--text)' }} onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}>
                          <span style={{ fontWeight: 600 }}>{a.name}</span>
                          {a.type && <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>{a.type}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <input value={clientName} onChange={e => { setClientName(e.target.value); setAgentSearch(''); setAgentId(''); }} placeholder="Name of company or person" style={inpStyle} />
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>{t('tr.amount')}</label><input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inpStyle, fontFamily: 'monospace' }} /></div>
              <div><label style={lbl}>{t('tr.dueDate')}</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inpStyle} /></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{t('tr.description')}</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('tr.descPlaceholder')} style={inpStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>IBAN</label>
                <input value={iban} onChange={e => setIban(e.target.value)} placeholder="GE00XX0000000000000000" style={{ ...inpStyle, fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={lbl}>Invoice Number</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-0001" style={inpStyle} />
              </div>
            </div>
            {!editId && formTab !== 'invoice' && (
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Invoice PDF / Image <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(optional)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input key={invoiceFileKey} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleInvoiceUpload} style={{ display: 'none' }} id="invoiceUploadInput" />
                <label htmlFor="invoiceUploadInput" style={{ ...cancelBtn, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {invoiceProcessing ? 'Processing...' : invoiceRaw ? 'Replace Invoice' : 'Attach Invoice'}
                </label>
                {invoiceProcessing && <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Processing…</span>}
                {!invoiceProcessing && invoiceRaw && <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 600 }}>✓ Invoice attached</span>}
              </div>
              {invoiceProcessError && <div style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{invoiceProcessError}</div>}
            </div>
            )}
            {editId && (
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>{t('tr.colRequester')}</label>
                <input value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder={t('tr.requesterPlaceholder')} style={inpStyle} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>{t('tr.cancel')}</button>
              <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>{saving ? t('tr.saving') : editId ? t('tr.saveChanges') : t('tr.createTransfer')}</button>
            </div>
          </div>
        </div>
      )}

      {partialModal && (
        <div style={overlay} onClick={() => setPartialModal(null)}>
          <div style={{ ...modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('tr.partialApproval')}</h3>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-3)' }}>
              {t('tr.requestedAmount')}: <strong style={{ color: 'var(--text)' }}>{fmt(partialModal.amount)}</strong>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{t('tr.approvedAmount')}</label>
              <input type="number" min="0" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} style={{ ...inpStyle, fontFamily: 'monospace' }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>{t('tr.note')}</label>
              <input value={partialNote} onChange={e => setPartialNote(e.target.value)} placeholder={t('tr.optionalNote')} style={inpStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setPartialModal(null)} style={cancelBtn}>{t('tr.cancel')}</button>
              <button onClick={submitPartial} style={primaryBtn}>{t('tr.confirmPartial')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Approval Requests ─────────────────────────────────────────────────────────

function ApprovalRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | pending | approved | rejected
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [rejectModal, setRejectModal] = useState(null); // request object
  const [rejectReason, setRejectReason] = useState('');

  // Form fields
  const [requesterName, setRequesterName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GEL');
  const [recipientName, setRecipientName] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/accounting/transfer-requests');
      setRequests(res.data.requests || []);
    } catch (err) { setError(err.response?.data?.error || 'Failed to load requests'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setRequesterName(''); setAmount(''); setCurrency('GEL');
    setRecipientName(''); setRecipientAccount(''); setDescription('');
    setFormError('');
  };

  const handleSubmit = async () => {
    if (!requesterName.trim()) { setFormError('Requester name is required'); return; }
    if (!amount || parseFloat(amount) <= 0) { setFormError('Amount must be greater than 0'); return; }
    if (!recipientName.trim()) { setFormError('Recipient name is required'); return; }
    setSaving(true); setFormError('');
    try {
      await api.post('/accounting/transfer-requests', { requester_name: requesterName, amount: parseFloat(amount), currency, recipient_name: recipientName, recipient_account: recipientAccount, description });
      setShowForm(false); resetForm(); load();
    } catch (err) { setFormError(err.response?.data?.error || 'Failed to submit request'); }
    finally { setSaving(false); }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/accounting/transfer-requests/${id}/approve`);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to approve'); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await api.put(`/accounting/transfer-requests/${rejectModal.id}/reject`, { reason: rejectReason });
      setRejectModal(null); setRejectReason(''); load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to reject'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this request?')) return;
    try { await api.delete(`/accounting/transfer-requests/${id}`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Failed to delete'); }
  };

  const filtered = requests.filter(r => filter === 'all' || r.approval_status === filter);
  const pendingCount = requests.filter(r => r.approval_status === 'pending').length;

  const statusLabel = (s) => s === 'approved' ? 'Approved' : s === 'rejected' ? 'Rejected' : 'Pending';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['all', 'pending', 'approved', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid',
              borderColor: filter === f ? '#2563eb' : 'var(--border-2)',
              background: filter === f ? 'rgba(37,99,235,0.12)' : 'var(--surface-2)',
              color: filter === f ? '#60a5fa' : 'var(--text-3)',
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pendingCount > 0 && (
                <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-add">+ New Request</button>
      </div>

      {error && <div style={{ ...errBox, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ color: 'var(--text-3)', padding: 24 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>No requests found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Submit a transfer request to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Status indicator */}
              <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', flexShrink: 0, background: r.approval_status === 'approved' ? '#22c55e' : r.approval_status === 'rejected' ? '#ef4444' : '#facc15' }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{r.recipient_name}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{fmt(r.amount)} {r.currency}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, ...approvalStyle(r.approval_status) }}>{statusLabel(r.approval_status)}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                  <span>Requested by: <strong style={{ color: 'var(--text-2)' }}>{r.requester_name}</strong></span>
                  {r.recipient_account && <span>Account: <strong style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>{r.recipient_account}</strong></span>}
                  <span>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {r.description && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}>{r.description}</div>}
                {r.approval_status === 'rejected' && r.rejection_reason && (
                  <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', fontSize: 12, color: '#f87171' }}>
                    <strong>Rejection reason:</strong> {r.rejection_reason}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                {r.approval_status === 'pending' && (
                  <>
                    <button onClick={() => handleApprove(r.id)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'rgba(22,163,74,0.15)', color: '#4ade80', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(22,163,74,0.3)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,163,74,0.15)'}>
                      ✓ Approve
                    </button>
                    <button onClick={() => { setRejectModal(r); setRejectReason(''); }} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'rgba(220,38,38,0.12)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,0.12)'}>
                      ✕ Reject
                    </button>
                  </>
                )}
                <button onClick={() => handleDelete(r.id)} style={{ ...iconBtn, padding: 6 }} onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color='#cbd5e1'}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Request Modal */}
      {showForm && (
        <div style={overlay} onClick={() => setShowForm(false)}>
          <div style={{ ...modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>New Transfer Request</h3>
            {formError && <div style={{ ...errBox, marginBottom: 14 }}>{formError}</div>}

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Requested By</label>
              <input value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Name of requester" style={inpStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Amount</label>
                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inpStyle, fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={lbl}>Currency</label>
                <div style={{ display: 'flex', gap: 4, height: 38 }}>
                  {CURRENCIES.map((c, i, arr) => (
                    <button key={c} type="button" onClick={() => setCurrency(c)} style={{
                      padding: '0 10px', border: `1.5px solid ${currency === c ? '#2563eb' : 'var(--border-2)'}`,
                      borderRadius: i === 0 ? '7px 0 0 7px' : i === arr.length - 1 ? '0 7px 7px 0' : 0,
                      borderRight: i < arr.length - 1 ? 'none' : undefined,
                      background: currency === c ? 'rgba(37,99,235,0.15)' : 'var(--surface-2)',
                      color: currency === c ? '#60a5fa' : 'var(--text-3)',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}>{c}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Recipient Name</label>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Who should receive the funds" style={inpStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Recipient Account <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(optional)</span></label>
              <input value={recipientAccount} onChange={e => setRecipientAccount(e.target.value)} placeholder="IBAN or account number" style={{ ...inpStyle, fontFamily: 'monospace' }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>Description <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(optional)</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Purpose of transfer..." rows={3} style={{ ...inpStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>{saving ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={overlay} onClick={() => setRejectModal(null)}>
          <div style={{ ...modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Reject Request</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-3)' }}>
              Rejecting transfer of <strong>{fmt(rejectModal.amount)} {rejectModal.currency}</strong> to <strong>{rejectModal.recipient_name}</strong>
            </p>
            <label style={lbl}>Reason <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why this request is being rejected..." rows={3} style={{ ...inpStyle, resize: 'vertical', marginBottom: 20 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setRejectModal(null)} style={cancelBtn}>Cancel</button>
              <button onClick={handleReject} style={{ ...primaryBtn, background: '#dc2626' }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Transfers page with sub-tabs ─────────────────────────────────────────

function Transfers() {
  const { t } = useLanguage();

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{t('tr.title')}</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 14 }}>{t('tr.subtitle')}</p>
      </div>

      <TransfersList />
    </div>
  );
}

const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', whiteSpace: 'nowrap' };
const td = { padding: '9px 14px', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 };
const inpStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface-2)', color: 'var(--text)' };
const errBox = { background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, padding: '10px 14px' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal = { background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-2)' };
const cancelBtn = { padding: '8px 18px', border: '1px solid var(--border-2)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 };
const primaryBtn = { padding: '8px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 };
const actionBtnBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 8, padding: 0, cursor: 'pointer',
  border: '1px solid transparent', transition: 'transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease',
};
const approveBtn = { ...actionBtnBase, background: 'rgba(22,163,74,0.14)',  color: '#4ade80', borderColor: 'rgba(22,163,74,0.35)',  boxShadow: '0 0 0 0 rgba(74,222,128,0)' };
const rejectBtn  = { ...actionBtnBase, background: 'rgba(220,38,38,0.14)',  color: '#f87171', borderColor: 'rgba(220,38,38,0.35)' };
const partialBtn = { ...actionBtnBase, background: 'rgba(59,130,246,0.14)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.35)' };
const waitBtn    = { ...actionBtnBase, background: 'rgba(148,163,184,0.16)',color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.30)' };

export default Transfers;
