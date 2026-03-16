import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const fmt = (n) =>
  n ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';

const STATUS_OPTIONS = [
  { value: 'normal',      label: '🟢 Normal' },
  { value: 'urgent',      label: '🟠 Urgent' },
  { value: 'super_urgent', label: '🔴 Super Urgent' },
];

const statusStyle = (status) =>
  status === 'super_urgent'
    ? { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }
    : status === 'urgent'
    ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }
    : { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' };

const statusLabel = (status) =>
  status === 'super_urgent' ? '🔴 Super Urgent' : status === 'urgent' ? '🟠 Urgent' : '🟢 Normal';

function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
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
  const [status, setStatus] = useState('normal');

  useEffect(() => { loadTransfers(); loadAgents(); }, []);

  const loadTransfers = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/accounting/transfers');
      setTransfers(res.data.records || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load transfers.');
    } finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/accounting/agents');
      setAgents(res.data.records || []);
    } catch {}
  };

  const openNew = () => {
    setEditId(null); setClientName(''); setAgentId(''); setAgentSearch('');
    setAmount(''); setDueDate(''); setDesc(''); setStatus('normal');
    setFormError(''); setShowForm(true);
  };

  const openEdit = (tr) => {
    setEditId(tr.id); setClientName(tr.client_name || '');
    const agent = agents.find(a => a.id === tr.agent_id);
    setAgentId(tr.agent_id || ''); setAgentSearch(agent ? agent.name : '');
    setAmount(tr.amount ? String(tr.amount) : ''); setDueDate(tr.due_date || '');
    setDesc(tr.description || ''); setStatus(tr.status || 'normal');
    setFormError(''); setShowForm(true);
  };

  const handleSave = async () => {
    if (!clientName.trim()) { setFormError('Client name is required.'); return; }
    if (!amount || parseFloat(amount) <= 0) { setFormError('Amount is required.'); return; }
    if (!dueDate) { setFormError('Due date is required.'); return; }
    setSaving(true); setFormError('');
    const payload = { client_name: clientName.trim(), agent_id: agentId || null, amount: parseFloat(amount), due_date: dueDate, description: desc.trim(), status };
    try {
      if (editId) await api.put(`/accounting/transfers/${editId}`, payload);
      else await api.post('/accounting/transfers', payload);
      setShowForm(false); loadTransfers();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transfer?')) return;
    try {
      await api.delete(`/accounting/transfers/${id}`);
      loadTransfers();
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete.'); }
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Transfers</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Manage payment transfers</p>
        </div>
        <button onClick={openNew} className="btn-add">+ New Transfer</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {loading ? (
        <div style={{ color: '#94a3b8', padding: 24 }}>Loading…</div>
      ) : transfers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>No transfers yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Click "+ New Transfer" to add one.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={th}>Status</th>
                <th style={th}>Client</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={th}>Due Date</th>
                <th style={th}>Description</th>
                <th style={{ ...th, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((tr, i) => (
                <tr key={tr.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 5, ...statusStyle(tr.status) }}>
                      {statusLabel(tr.status)}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: '#1e293b' }}>{tr.client_name}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>{fmt(tr.amount)}</td>
                  <td style={{ ...td, color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{tr.due_date}</td>
                  <td style={{ ...td, color: '#334155' }}>{tr.description}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => openEdit(tr)} title="Edit"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                        onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(tr.id)} title="Delete"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
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
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{editId ? 'Edit Transfer' : 'New Transfer'}</h3>
            {formError && <div style={{ ...errBox, marginBottom: 14 }}>{formError}</div>}

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} type="button" onClick={() => setStatus(s.value)} style={{
                    flex: 1, padding: '8px 0', border: `2px solid ${status === s.value ? '#2563eb' : '#e2e8f0'}`,
                    borderRadius: 8, background: status === s.value ? '#eff6ff' : '#fff',
                    color: status === s.value ? '#1d4ed8' : '#64748b',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{s.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={lbl}>Client Name *</label>
              <input
                value={agentSearch || clientName}
                onChange={e => { setAgentSearch(e.target.value); setClientName(e.target.value); setAgentId(''); setAgentOpen(true); }}
                onFocus={() => setAgentOpen(true)}
                onBlur={() => setTimeout(() => setAgentOpen(false), 150)}
                placeholder="Type or search agents…"
                style={inpStyle}
              />
              {agentOpen && agents.filter(a => a.name.toLowerCase().includes((agentSearch || clientName).toLowerCase())).length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                  {agents.filter(a => a.name.toLowerCase().includes((agentSearch || clientName).toLowerCase())).map(a => (
                    <div key={a.id}
                      onMouseDown={() => { setAgentId(a.id); setClientName(a.name); setAgentSearch(a.name); setAgentOpen(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <span style={{ fontWeight: 600 }}>{a.name}</span>
                      {a.type && <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 8 }}>{a.type}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Amount *</label>
                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inpStyle, fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={lbl}>Due Date *</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inpStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Description</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Invoice payment" style={inpStyle} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Transfer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', whiteSpace: 'nowrap' };
const td = { padding: '9px 14px', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 };
const inpStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const errBox = { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal = { background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const cancelBtn = { padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', fontSize: 14 };
const primaryBtn = { padding: '8px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };

export default Transfers;
