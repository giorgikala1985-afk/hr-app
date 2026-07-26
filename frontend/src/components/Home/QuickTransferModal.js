import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

const INPUT = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border-2)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none',
};

const LABEL = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-3)', marginBottom: 5,
};

export default function QuickTransferModal({ onClose }) {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    api.get('/accounting/agents').then(r => setAgents(r.data.records || [])).catch(() => {});
  }, []);

  const handleAgentChange = (id) => {
    setAgentId(id);
    const agent = agents.find(a => a.id === id);
    if (agent) setClientName(agent.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientName.trim() || !amount || !dueDate) return;
    setSaving(true); setError('');
    try {
      await api.post('/accounting/transfers', {
        client_name: clientName.trim(), agent_id: agentId || null,
        amount: parseFloat(amount), due_date: dueDate, description: description.trim(),
      });
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit transfer.');
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = (e) => { if (e.target === overlayRef.current) onClose(); };

  return (
    <div ref={overlayRef} onClick={handleOverlayClick} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-2)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>New Transfer</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && <div style={{ padding: '9px 14px', background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ padding: '9px 14px', background: 'rgba(71,156,115,0.12)', color: '#479c73', border: '1px solid rgba(71,156,115,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>✓ Transfer submitted for approval.</div>}

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={LABEL}>Coagent</label>
              <select value={agentId} onChange={e => handleAgentChange(e.target.value)} style={INPUT}>
                <option value="">— None / type name manually —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Recipient Name *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Amount (GEL) *</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Due Date *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} style={INPUT} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving || success || !clientName.trim() || !amount || !dueDate} style={{
              padding: '9px 24px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
              background: saving || success || !clientName.trim() || !amount || !dueDate ? 'var(--surface-2)' : '#3b82f6',
              color: saving || success || !clientName.trim() || !amount || !dueDate ? 'var(--text-3)' : '#fff',
              cursor: saving || success || !clientName.trim() || !amount || !dueDate ? 'not-allowed' : 'pointer',
            }}>{saving ? 'Saving…' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
