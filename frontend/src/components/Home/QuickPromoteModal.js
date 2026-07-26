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

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function QuickPromoteModal({ onClose }) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    api.get('/employees').then(r => setEmployees((r.data.employees || []).filter(e => !e.end_date))).catch(() => {});
    api.get('/positions').then(r => setPositions(r.data.positions || [])).catch(() => {});
  }, []);

  const emp = employees.find(x => x.id === employeeId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !newSalary || !effectiveDate) return;
    setSaving(true); setError('');
    try {
      await api.post(`/employees/${employeeId}/salary-changes`, {
        salary: newSalary, effective_date: effectiveDate, note: notes,
        position: newPosition || undefined,
      });
      addLocalOrder('hr_promotion_orders', user?.id, {
        employeeId, empName: emp ? `${emp.first_name} ${emp.last_name}` : '',
        oldPosition: emp?.position || '', newPosition: newPosition || emp?.position || '',
        oldSalary: emp?.salary || '', newSalary, effectiveDate, notes,
      }, user?.name || user?.email || 'Unknown');
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to promote employee.');
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
        background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-2)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Promote Employee</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && <div style={{ padding: '9px 14px', background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ padding: '9px 14px', background: 'rgba(71,156,115,0.12)', color: '#479c73', border: '1px solid rgba(71,156,115,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>✓ Promoted successfully.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Employee *</label>
              <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} required style={INPUT}>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Current Position</label>
              <input value={emp?.position || ''} readOnly style={{ ...INPUT, opacity: 0.6 }} />
            </div>
            <div>
              <label style={LABEL}>New Position</label>
              <select value={newPosition} onChange={e => setNewPosition(e.target.value)} style={INPUT}>
                <option value="">Keep current</option>
                {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Current Salary</label>
              <input value={emp?.salary || ''} readOnly style={{ ...INPUT, opacity: 0.6 }} />
            </div>
            <div>
              <label style={LABEL}>New Salary *</label>
              <input type="number" step="0.01" min="0" value={newSalary} onChange={e => setNewSalary(e.target.value)} required style={INPUT} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Effective Date *</label>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} required style={INPUT} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} style={INPUT} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving || success || !employeeId || !newSalary || !effectiveDate} style={{
              padding: '9px 24px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
              background: saving || success || !employeeId || !newSalary || !effectiveDate ? 'var(--surface-2)' : '#479c73',
              color: saving || success || !employeeId || !newSalary || !effectiveDate ? 'var(--text-3)' : '#fff',
              cursor: saving || success || !employeeId || !newSalary || !effectiveDate ? 'not-allowed' : 'pointer',
            }}>{saving ? 'Saving…' : 'Promote'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
