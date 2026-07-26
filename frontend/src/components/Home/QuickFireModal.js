import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { addLocalOrder } from '../../utils/localOrderLog';

const INPUT = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border-2)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none',
};

const LABEL = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-3)', marginBottom: 5,
};

export default function QuickFireModal({ onClose }) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    api.get('/employees').then(r => setEmployees((r.data.employees || []).filter(e => !e.end_date))).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !endDate) return;
    setSaving(true); setError('');
    try {
      await api.patch(`/employees/${employeeId}/end-date`, { end_date: endDate });
      const emp = employees.find(x => x.id === employeeId);
      addLocalOrder('hr_firing_orders', user?.id, {
        employeeId, empName: emp ? `${emp.first_name} ${emp.last_name}` : '',
        terminationDate: endDate, reason,
      }, user?.name || user?.email || 'Unknown');
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to terminate employee.');
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
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Terminate Employee</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && <div style={{ padding: '9px 14px', background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ padding: '9px 14px', background: 'rgba(71,156,115,0.12)', color: '#479c73', border: '1px solid rgba(71,156,115,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>✓ Terminated successfully.</div>}

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={LABEL}>Employee *</label>
              <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} required style={INPUT}>
                <option value="">Select employee</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Last Day *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Reason</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. resignation" style={INPUT} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving || success || !employeeId || !endDate} style={{
              padding: '9px 24px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
              background: saving || success || !employeeId || !endDate ? 'var(--surface-2)' : '#ef4444',
              color: saving || success || !employeeId || !endDate ? 'var(--text-3)' : '#fff',
              cursor: saving || success || !employeeId || !endDate ? 'not-allowed' : 'pointer',
            }}>{saving ? 'Saving…' : 'Terminate'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
