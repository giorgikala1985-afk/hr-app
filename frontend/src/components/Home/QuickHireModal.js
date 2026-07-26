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

const EMPTY_FORM = {
  firstName: '', lastName: '', personalId: '', birthdate: '',
  position: '', department: '', startDate: '', salary: '', salaryCurrency: 'GEL',
};

export default function QuickHireModal({ onClose }) {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    api.get('/positions').then(r => setPositions(r.data.positions || [])).catch(() => {});
    api.get('/departments').then(r => setDepartments(r.data.departments || [])).catch(() => {});
  }, []);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const data = new FormData();
      data.append('first_name', form.firstName.trim());
      data.append('last_name', form.lastName.trim());
      data.append('personal_id', form.personalId.trim());
      data.append('birthdate', form.birthdate);
      data.append('position', form.position.trim());
      data.append('salary', form.salary);
      data.append('salary_currency', form.salaryCurrency);
      data.append('start_date', form.startDate);
      if (form.department) data.append('department', form.department.trim());
      await api.post('/employees', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      addLocalOrder('hr_hiring_orders', user?.id, {
        firstName: form.firstName, lastName: form.lastName,
        position: form.position, department: form.department,
      }, user?.name || user?.email || 'Unknown');
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to hire employee.');
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = (e) => { if (e.target === overlayRef.current) onClose(); };
  const canSave = form.firstName && form.lastName && form.personalId && form.birthdate && form.position && form.salary && form.startDate;

  return (
    <div ref={overlayRef} onClick={handleOverlayClick} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-2)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>New Hire</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && <div style={{ padding: '9px 14px', background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ padding: '9px 14px', background: 'rgba(71,156,115,0.12)', color: '#479c73', border: '1px solid rgba(71,156,115,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>✓ Hired successfully.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
            <div>
              <label style={LABEL}>First Name *</label>
              <input value={form.firstName} onChange={f('firstName')} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Last Name *</label>
              <input value={form.lastName} onChange={f('lastName')} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Personal ID *</label>
              <input value={form.personalId} onChange={f('personalId')} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Birthdate *</label>
              <input type="date" value={form.birthdate} onChange={f('birthdate')} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Position *</label>
              <select value={form.position} onChange={f('position')} required style={INPUT}>
                <option value="">Select position</option>
                {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Department</label>
              <select value={form.department} onChange={f('department')} style={INPUT}>
                <option value="">—</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Start Date *</label>
              <input type="date" value={form.startDate} onChange={f('startDate')} required style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Salary *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" min="0" value={form.salary} onChange={f('salary')} required style={{ ...INPUT, flex: 1 }} />
                <select value={form.salaryCurrency} onChange={f('salaryCurrency')} style={{ ...INPUT, width: 80 }}>
                  <option value="GEL">GEL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving || success || !canSave} style={{
              padding: '9px 24px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
              background: saving || success || !canSave ? 'var(--surface-2)' : '#479c73',
              color: saving || success || !canSave ? 'var(--text-3)' : '#fff',
              cursor: saving || success || !canSave ? 'not-allowed' : 'pointer',
            }}>{saving ? 'Saving…' : 'Hire'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
