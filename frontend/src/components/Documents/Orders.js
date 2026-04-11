import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { generateOrderPDF } from '../../utils/generateOrderPDF';

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const CURRENCIES = [
  { code: 'USD', symbol: '$', color: '#16a34a' },
  { code: 'GEL', symbol: '₾', color: '#92400e' },
  { code: 'EUR', symbol: '€', color: '#7c3aed' },
];

const INPUT = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border-2)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
  outline: 'none',
};

const LABEL = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-3)', marginBottom: 5,
};

function fmt(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

const ORDER_SUBTABS = [
  { key: 'adjusting', label: 'Adjusting' },
  { key: 'promotion', label: 'Promotion' },
  { key: 'hiring',    label: 'Hiring'    },
  { key: 'firing',    label: 'Firing'    },
];

// ── Shared helpers ───────────────────────────────────────────────────────────
function useLocalOrders(key) {
  const [orders, setOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  });
  const save = (next) => { setOrders(next); localStorage.setItem(key, JSON.stringify(next)); };
  const add = (row) => save([{ id: Date.now(), createdAt: new Date().toISOString(), ...row }, ...orders]);
  const update = (id, row) => save(orders.map(o => o.id === id ? { ...o, ...row } : o));
  const remove = (id) => save(orders.filter(o => o.id !== id));
  return { orders, add, update, remove };
}

function SubTabModal({ title, onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-2)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{title}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function SubTabActions({ onSave, onCancel, saving, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
      <button type="button" onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      <button type="submit" disabled={saving || disabled} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, background: saving || disabled ? 'var(--surface-2)' : 'var(--accent,#3b82f6)', color: saving || disabled ? 'var(--text-3)' : '#fff', cursor: saving || disabled ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function EmptyState({ label, onAdd }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15, marginBottom: 6 }}>No {label} orders yet</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Click "Add New Order" to create the first one.</div>
      <button onClick={onAdd} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent,#3b82f6)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Add New Order</button>
    </div>
  );
}

// ── Promotion Tab ─────────────────────────────────────────────────────────────
function PromotionTab({ employees }) {
  const { orders, add, update, remove } = useLocalOrders('hr_promotion_orders');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const EMPTY = { employeeId: '', newPosition: '', oldSalary: '', newSalary: '', effectiveDate: '', notes: '' };
  const [form, setForm] = useState(EMPTY);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (o) => { setEditing(o.id); setForm({ employeeId: o.employeeId, newPosition: o.newPosition, oldSalary: o.oldSalary, newSalary: o.newSalary, effectiveDate: o.effectiveDate, notes: o.notes || '' }); setShowForm(true); };
  const close = () => { setShowForm(false); setEditing(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const emp = employees.find(x => x.id === form.employeeId);
    const row = { ...form, empName: emp ? `${emp.first_name} ${emp.last_name}` : '', oldPosition: emp?.position || '' };
    editing ? update(editing, row) : add(row);
    close();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--accent,#3b82f6)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add New Order</button>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? <EmptyState label="promotion" onAdd={openAdd} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Date', 'Employee', 'Old Position', 'New Position', 'Old Salary', 'New Salary', 'Effective Date', 'Notes', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)' }}>{o.empName}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.oldPosition || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#4ade80', fontWeight: 600 }}>{o.newPosition}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.oldSalary || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#4ade80', fontWeight: 600 }}>{o.newSalary}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{o.effectiveDate}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.notes || '—'}</td>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(o)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}><EditIcon /></button>
                      <button onClick={() => remove(o.id)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && (
        <SubTabModal title={editing ? 'Edit Promotion Order' : 'New Promotion Order'} onClose={close}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><label style={LABEL}>Employee *</label>
                <select value={form.employeeId} onChange={f('employeeId')} required style={{ ...INPUT, width: '100%' }}>
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LABEL}>Old Position</label><input value={form.oldPosition || employees.find(e => e.id === form.employeeId)?.position || ''} readOnly style={{ ...INPUT, width: '100%', opacity: 0.6 }} /></div>
                <div><label style={LABEL}>New Position *</label><input value={form.newPosition} onChange={f('newPosition')} required style={{ ...INPUT, width: '100%' }} /></div>
                <div><label style={LABEL}>Old Salary</label><input type="number" value={form.oldSalary} onChange={f('oldSalary')} style={{ ...INPUT, width: '100%' }} /></div>
                <div><label style={LABEL}>New Salary *</label><input type="number" value={form.newSalary} onChange={f('newSalary')} required style={{ ...INPUT, width: '100%' }} /></div>
              </div>
              <div><label style={LABEL}>Effective Date *</label><input type="date" value={form.effectiveDate} onChange={f('effectiveDate')} required style={{ ...INPUT, width: '100%' }} /></div>
              <div><label style={LABEL}>Notes</label><input value={form.notes} onChange={f('notes')} style={{ ...INPUT, width: '100%' }} /></div>
            </div>
            <SubTabActions onCancel={close} disabled={!form.employeeId || !form.newPosition || !form.newSalary || !form.effectiveDate} />
          </form>
        </SubTabModal>
      )}
    </div>
  );
}

// ── Hiring Tab ────────────────────────────────────────────────────────────────
function HiringTab() {
  const { orders, add, update, remove } = useLocalOrders('hr_hiring_orders');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const EMPTY = { firstName: '', lastName: '', personalId: '', position: '', department: '', startDate: '', salary: '', notes: '' };
  const [form, setForm] = useState(EMPTY);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (o) => { setEditing(o.id); setForm({ firstName: o.firstName, lastName: o.lastName, personalId: o.personalId, position: o.position, department: o.department, startDate: o.startDate, salary: o.salary, notes: o.notes || '' }); setShowForm(true); };
  const close = () => { setShowForm(false); setEditing(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    editing ? update(editing, form) : add(form);
    close();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--accent,#3b82f6)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add New Order</button>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? <EmptyState label="hiring" onAdd={openAdd} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Date', 'Full Name', 'Personal ID', 'Position', 'Department', 'Start Date', 'Salary', 'Notes', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)' }}>{o.firstName} {o.lastName}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.personalId || '—'}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text)' }}>{o.position}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.department || '—'}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{o.startDate}</td>
                  <td style={{ padding: '11px 14px', color: '#4ade80', fontWeight: 600 }}>{o.salary}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.notes || '—'}</td>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(o)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}><EditIcon /></button>
                      <button onClick={() => remove(o.id)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && (
        <SubTabModal title={editing ? 'Edit Hiring Order' : 'New Hiring Order'} onClose={close}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LABEL}>First Name *</label><input value={form.firstName} onChange={f('firstName')} required style={{ ...INPUT, width: '100%' }} /></div>
                <div><label style={LABEL}>Last Name *</label><input value={form.lastName} onChange={f('lastName')} required style={{ ...INPUT, width: '100%' }} /></div>
                <div><label style={LABEL}>Personal ID</label><input value={form.personalId} onChange={f('personalId')} style={{ ...INPUT, width: '100%' }} /></div>
                <div><label style={LABEL}>Salary *</label><input type="number" value={form.salary} onChange={f('salary')} required style={{ ...INPUT, width: '100%' }} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LABEL}>Position *</label><input value={form.position} onChange={f('position')} required style={{ ...INPUT, width: '100%' }} /></div>
                <div><label style={LABEL}>Department</label><input value={form.department} onChange={f('department')} style={{ ...INPUT, width: '100%' }} /></div>
              </div>
              <div><label style={LABEL}>Start Date *</label><input type="date" value={form.startDate} onChange={f('startDate')} required style={{ ...INPUT, width: '100%' }} /></div>
              <div><label style={LABEL}>Notes</label><input value={form.notes} onChange={f('notes')} style={{ ...INPUT, width: '100%' }} /></div>
            </div>
            <SubTabActions onCancel={close} disabled={!form.firstName || !form.lastName || !form.position || !form.startDate || !form.salary} />
          </form>
        </SubTabModal>
      )}
    </div>
  );
}

// ── Firing Tab ────────────────────────────────────────────────────────────────
function FiringTab({ employees }) {
  const { orders, add, update, remove } = useLocalOrders('hr_firing_orders');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const EMPTY = { employeeId: '', terminationDate: '', reason: '', notes: '' };
  const [form, setForm] = useState(EMPTY);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (o) => { setEditing(o.id); setForm({ employeeId: o.employeeId, terminationDate: o.terminationDate, reason: o.reason, notes: o.notes || '' }); setShowForm(true); };
  const close = () => { setShowForm(false); setEditing(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const emp = employees.find(x => x.id === form.employeeId);
    const row = { ...form, empName: emp ? `${emp.first_name} ${emp.last_name}` : '', position: emp?.position || '' };
    editing ? update(editing, row) : add(row);
    close();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--accent,#3b82f6)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add New Order</button>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? <EmptyState label="firing" onAdd={openAdd} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Date', 'Employee', 'Position', 'Termination Date', 'Reason', 'Notes', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)' }}>{o.empName}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.position || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#f87171', fontWeight: 600, whiteSpace: 'nowrap' }}>{o.terminationDate}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text)' }}>{o.reason}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.notes || '—'}</td>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(o)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}><EditIcon /></button>
                      <button onClick={() => remove(o.id)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && (
        <SubTabModal title={editing ? 'Edit Firing Order' : 'New Firing Order'} onClose={close}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><label style={LABEL}>Employee *</label>
                <select value={form.employeeId} onChange={f('employeeId')} required style={{ ...INPUT, width: '100%' }}>
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div><label style={LABEL}>Termination Date *</label><input type="date" value={form.terminationDate} onChange={f('terminationDate')} required style={{ ...INPUT, width: '100%' }} /></div>
              <div><label style={LABEL}>Reason *</label><input value={form.reason} onChange={f('reason')} required style={{ ...INPUT, width: '100%' }} /></div>
              <div><label style={LABEL}>Notes</label><input value={form.notes} onChange={f('notes')} style={{ ...INPUT, width: '100%' }} /></div>
            </div>
            <SubTabActions onCancel={close} disabled={!form.employeeId || !form.terminationDate || !form.reason} />
          </form>
        </SubTabModal>
      )}
    </div>
  );
}

// ── Shared icon/button styles ─────────────────────────────────────────────────
const actionBtn = { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' };
function EditIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}

export default function Orders() {
  const [subTab, setSubTab] = useState('adjusting');
  const [month, setMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);
  const [overtimeRates, setOvertimeRates] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [gelRate, setGelRate] = useState(null);
  const [eurRate, setEurRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterEmp, setFilterEmp] = useState('');
  const [filterType, setFilterType] = useState('');
  const { user } = useAuth();
  const orderCounterRef = useRef(1);

  const EMPTY_FORM = { employeeId: '', type: 'OT', amount: '', otRate: '', otHours: '', currency: 'USD', includeInSalary: true };
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingUnit, setEditingUnit] = useState(null);

  // ── Data loading ────────────────────────────────────────────
  const loadStatic = useCallback(async () => {
    try {
      const [empRes, unitRes, otRes] = await Promise.all([
        api.get('/employees'),
        api.get('/units'),
        api.get('/overtime-rates'),
      ]);
      const emps = empRes.data.employees || [];
      const types = unitRes.data.unit_types || [];
      const rates = otRes.data.overtime_rates || [];
      setEmployees(emps);
      setUnitTypes(types);
      setOvertimeRates(rates);
      setForm(prev => ({
        ...prev,
        employeeId: emps[0]?.id || '',
        otRate: rates[0] ? String(rates[0].rate) : '',
      }));
    } catch {}
  }, []);

  const loadSalaries = useCallback(async (m) => {
    setLoading(true);
    try {
      const res = await api.get('/salaries', { params: { month: m } });
      setSalaries(res.data.salaries || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const loadRates = useCallback(async () => {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      if (data.rates?.GEL) setGelRate(data.rates.GEL);
      if (data.rates?.EUR) setEurRate(data.rates.EUR);
    } catch {}
  }, []);

  useEffect(() => { loadStatic(); loadRates(); }, [loadStatic, loadRates]);
  useEffect(() => { loadSalaries(month); }, [month, loadSalaries]);

  // ── Helpers ──────────────────────────────────────────────────
  const monthLastDay = (() => {
    const [y, m] = month.split('-');
    const last = new Date(Number(y), Number(m), 0).getDate();
    return `${month}-${String(last).padStart(2, '0')}`;
  })();

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  })();

  const toUSD = (amount, currency) => {
    const val = parseFloat(amount);
    if (currency === 'GEL' && gelRate) return Math.round((val / gelRate) * 100) / 100;
    if (currency === 'EUR' && eurRate) return Math.round((val / eurRate) * 100) / 100;
    return val;
  };

  const getDirection = (type) => {
    if (type === 'OT' || type === 'Overtime') return 'addition';
    return unitTypes.find(u => u.name === type)?.direction || 'deduction';
  };

  const getWorkingDays = (empId) => salaries.find(s => s.employee?.id === empId)?.total_days || 0;
  const getEmpSalary = (empId) => parseFloat(salaries.find(s => s.employee?.id === empId)?.employee?.salary || 0);

  const calcOtAmount = (empId, rate, hours) => {
    const wdays = getWorkingDays(empId);
    const salary = getEmpSalary(empId);
    const hr = wdays > 0 ? salary / (wdays * 8) : 0;
    if (!hr || !hours || !rate) return '';
    return (hr * (parseFloat(rate) / 100) * parseFloat(hours)).toFixed(2);
  };

  const isOT = form.type === 'OT' || form.type === 'Overtime';

  const allUnits = salaries.flatMap(s =>
    (s.deductions || []).map(u => ({
      ...u, employee: s.employee, direction: getDirection(u.type),
    }))
  );

  const filteredUnits = allUnits.filter(u => {
    const name = `${u.employee?.first_name} ${u.employee?.last_name}`.toLowerCase();
    if (filterEmp && !name.includes(filterEmp.toLowerCase())) return false;
    if (filterType && u.type !== filterType) return false;
    return true;
  });

  const totalAdditions = filteredUnits.filter(u => u.direction === 'addition').reduce((s, u) => s + parseFloat(u.amount), 0);
  const totalDeductions = filteredUnits.filter(u => u.direction === 'deduction').reduce((s, u) => s + parseFloat(u.amount), 0);
  const uniqueTypes = [...new Set(allUnits.map(u => u.type))];

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.employeeId || !form.amount) return;
    setSaving(true);
    setError('');
    try {
      const amountUSD = toUSD(form.amount, form.currency);
      await api.post(`/employees/${form.employeeId}/units`, {
        type: form.type,
        amount: amountUSD,
        date: monthLastDay,
        currency: 'USD',
        include_in_salary: form.includeInSalary,
      });

      if (!form.includeInSalary) {
        const emp = employees.find(e => e.id === form.employeeId);
        const empName = emp ? `${emp.first_name} ${emp.last_name}` : '';
        await api.post('/accounting/transfers', {
          client_name: empName,
          agent_id: null,
          amount: amountUSD,
          due_date: monthLastDay,
          description: `${form.type} — ${empName}`,
          status: 'normal',
        });
      }

      setShowForm(false);
      setForm(EMPTY_FORM);
      loadSalaries(month);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add order.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u) => {
    setEditingUnit({ id: u.id, employeeId: u.employee?.id });
    setForm({
      employeeId: u.employee?.id || '',
      type: u.type,
      amount: String(u.amount),
      otRate: '',
      otHours: '',
      currency: 'USD',
      includeInSalary: u.include_in_salary !== false,
    });
    setError('');
    setShowForm(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingUnit || !form.amount) return;
    setSaving(true);
    setError('');
    try {
      const amountUSD = toUSD(form.amount, form.currency);
      await api.put(`/employees/${editingUnit.employeeId}/units/${editingUnit.id}`, {
        type: form.type,
        amount: amountUSD,
        currency: 'USD',
        include_in_salary: form.includeInSalary,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingUnit(null);
      loadSalaries(month);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update order.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (employeeId, unitId) => {
    if (!window.confirm('Remove this order?')) return;
    try {
      await api.delete(`/employees/${employeeId}/units/${unitId}`);
      loadSalaries(month);
    } catch {
      setError('Failed to delete order.');
    }
  };

  const handleDownloadPdf = (u, i) => {
    generateOrderPDF({
      employee: u.employee || {},
      type: u.type,
      direction: u.direction,
      amount: parseFloat(u.amount),
      date: u.date,
      month,
      companyName: user?.user_metadata?.company_name || user?.email || 'Company',
      orderNumber: i + 1,
    });
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Orders</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            Bonuses, deductions, overtime and adjustments · {monthLabel}
          </p>
        </div>
        {subTab === 'adjusting' && <button
          onClick={() => { setShowForm(true); setError(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 20px', borderRadius: 9, border: 'none',
            background: 'var(--accent, #3b82f6)', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(59,130,246,0.3)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add New Order
        </button>}
      </div>

      {/* Subtabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {ORDER_SUBTABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            style={{
              padding: '7px 22px', border: 'none', borderRadius: 7,
              fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              background: subTab === tab.key ? 'var(--surface)' : 'transparent',
              color: subTab === tab.key ? 'var(--text)' : 'var(--text-3)',
              boxShadow: subTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Non-adjusting tabs */}
      {subTab === 'promotion' && <PromotionTab employees={employees} />}
      {subTab === 'hiring'    && <HiringTab />}
      {subTab === 'firing'    && <FiringTab employees={employees} />}

      {/* Month picker — adjusting only */}
      {subTab === 'adjusting' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...INPUT, width: 'auto', padding: '6px 12px', colorScheme: 'dark' }} />
        <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>}

      {subTab === 'adjusting' && <>
      {/* Summary pills */}
      {allUnits.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ padding: '8px 16px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-2)' }}>
            <strong style={{ color: 'var(--text)' }}>{allUnits.length}</strong> orders
          </div>
          {totalAdditions > 0 && (
            <div style={{ padding: '8px 16px', borderRadius: 20, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', fontSize: 13, color: '#4ade80' }}>
              +{fmt(totalAdditions)} additions
            </div>
          )}
          {totalDeductions > 0 && (
            <div style={{ padding: '8px 16px', borderRadius: 20, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', fontSize: 13, color: '#f87171' }}>
              -{fmt(totalDeductions)} deductions
            </div>
          )}
        </div>
      )}

      {/* Search/filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search employee…"
            value={filterEmp}
            onChange={e => setFilterEmp(e.target.value)}
            style={{ ...INPUT, paddingLeft: 32 }}
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ ...INPUT, width: 160 }}
        >
          <option value="">All types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(filterEmp || filterType) && (
          <button onClick={() => { setFilterEmp(''); setFilterType(''); }}
            style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {/* Orders list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '56px 0', fontSize: 13 }}>Loading orders…</div>
        ) : filteredUnits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ marginBottom: 16 }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="6" width="28" height="36" rx="4" stroke="var(--text-3)" strokeWidth="2" opacity="0.5"/>
                <rect x="10" y="6" width="28" height="10" rx="4" fill="var(--text-3)" opacity="0.12"/>
                <line x1="17" y1="24" x2="31" y2="24" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
                <line x1="17" y1="30" x2="27" y2="30" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" opacity="0.25"/>
                <line x1="17" y1="36" x2="24" y2="36" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" opacity="0.15"/>
                <circle cx="36" cy="36" r="9" fill="var(--surface)" stroke="var(--text-3)" strokeWidth="2" opacity="0.5"/>
                <line x1="36" y1="32" x2="36" y2="40" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                <line x1="32" y1="36" x2="40" y2="36" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
              </svg>
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15, marginBottom: 6 }}>No orders for {monthLabel}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Click "Add New Order" to create the first one.</div>
            <button
              onClick={() => { setShowForm(true); setError(''); }}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent, #3b82f6)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              + Add New Order
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {[['Employee', false], ['Type', false], ['Direction', false], ['Amount', true], ['Date', true], ['Created', true], ['Modified', true], ['', true], ['', true]].map(([h, right], i) => (
                  <th key={i} style={{ padding: '11px 16px', textAlign: right ? 'right' : 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((u, i) => (
                <tr key={`${u.id}-${i}`} style={{ borderBottom: '1px solid var(--border-2)', transition: 'background 0.1s', opacity: u.include_in_salary === false ? 0.6 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Employee */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
                      {u.employee?.first_name} {u.employee?.last_name}
                    </div>
                    {u.employee?.position && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{u.employee.position}</div>
                    )}
                    {u.include_in_salary === false && (
                      <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Not in salary
                      </div>
                    )}
                  </td>

                  {/* Type badge */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: u.direction === 'addition' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                      color: u.direction === 'addition' ? '#4ade80' : '#f87171',
                      border: `1px solid ${u.direction === 'addition' ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.2)'}`,
                    }}>
                      {u.type}
                    </span>
                  </td>

                  {/* Direction */}
                  <td style={{ padding: '12px 16px', color: u.direction === 'addition' ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 500 }}>
                    {u.direction === 'addition' ? '▲ Addition' : '▼ Deduction'}
                  </td>

                  {/* Amount */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: u.direction === 'addition' ? '#4ade80' : '#f87171' }}>
                    {u.direction === 'addition' ? '+' : '−'}{fmt(u.amount)}
                  </td>

                  {/* Date */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-3)', fontSize: 12 }}>
                    {u.date}
                  </td>

                  {/* Created */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-4)', fontSize: 11 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>

                  {/* Modified */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-4)', fontSize: 11 }}>
                    {u.updated_at && u.updated_at !== u.created_at ? new Date(u.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(u)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                        title="Edit"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {/* PDF */}
                      <button
                        onClick={() => handleDownloadPdf(u, i)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-3)'; }}
                        title="Download PDF"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="18" x2="12" y2="12"/>
                          <polyline points="9 15 12 18 15 15"/>
                        </svg>
                        PDF
                      </button>
                    </div>
                  </td>

                  {/* Delete */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(u.employee?.id, u.id)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                      title="Delete"
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL FORM OVERLAY ── */}
      {showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditingUnit(null); setForm(EMPTY_FORM); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-2)', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{editingUnit ? 'Edit Order' : 'New Order'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{monthLabel}</div>
              </div>
              <button onClick={() => { setShowForm(false); setEditingUnit(null); setForm(EMPTY_FORM); }} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Modal body */}
            <form onSubmit={editingUnit ? handleUpdate : handleAdd} style={{ padding: 24 }}>
              {error && (
                <div style={{ padding: '9px 14px', background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>

                {/* Employee */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Employee *</label>
                  <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} required disabled={!!editingUnit} style={{ ...INPUT, opacity: editingUnit ? 0.6 : 1 }}>
                    <option value="">Select employee…</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Order Type *</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value, amount: '', otHours: '' }))} required style={INPUT}>
                    <option value="OT">OT — Overtime (+)</option>
                    {unitTypes.map(ut => (
                      <option key={ut.id} value={ut.name}>{ut.name} ({ut.direction === 'addition' ? '+' : '−'})</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, marginTop: 5, color: getDirection(form.type) === 'addition' ? '#4ade80' : '#f87171' }}>
                    {getDirection(form.type) === 'addition' ? '▲ Will be added to net salary' : '▼ Will be deducted from net salary'}
                  </div>
                </div>

                {/* OT extras */}
                {isOT && (
                  <>
                    <div>
                      <label style={LABEL}>OT Rate</label>
                      <select value={form.otRate} onChange={e => {
                        const rate = e.target.value;
                        setForm(p => ({ ...p, otRate: rate, amount: calcOtAmount(p.employeeId, rate, p.otHours) }));
                      }} style={INPUT}>
                        {overtimeRates.length > 0
                          ? overtimeRates.map(r => <option key={r.id} value={String(r.rate)}>{r.label} ({r.rate}%)</option>)
                          : <><option value="110">110%</option><option value="200">200%</option></>
                        }
                      </select>
                    </div>
                    <div>
                      <label style={LABEL}>OT Hours</label>
                      <input type="number" min="0" step="0.5" placeholder="e.g. 8" value={form.otHours}
                        onChange={e => {
                          const hours = e.target.value;
                          setForm(p => ({ ...p, otHours: hours, amount: calcOtAmount(p.employeeId, p.otRate, hours) }));
                        }}
                        style={INPUT}
                      />
                    </div>
                  </>
                )}

                {/* Amount */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>
                    Amount *
                    {form.currency !== 'USD' && form.amount
                      ? <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>≈ ${toUSD(form.amount, form.currency)}</span>
                      : null}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" step="0.01" min="0" placeholder="e.g. 150.00" value={form.amount}
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      required style={{ ...INPUT, flex: 1 }}
                    />
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-2)' }}>
                      {CURRENCIES.map(({ code, symbol, color }) => (
                        <button key={code} type="button"
                          onClick={() => setForm(p => ({ ...p, currency: code }))}
                          style={{
                            padding: '0 12px', height: '100%', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                            background: form.currency === code ? color : 'var(--surface-2)',
                            color: form.currency === code ? '#fff' : color,
                            transition: 'all 0.12s',
                          }}
                        >{symbol}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Include in salary toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, padding: '12px 14px', borderRadius: 9, border: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Include in salary calculation</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {form.includeInSalary ? 'This order will affect the net salary' : 'This order will not affect the net salary'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, includeInSalary: !p.includeInSalary }))}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: form.includeInSalary ? '#16a34a' : 'var(--border-2)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: form.includeInSalary ? 22 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    display: 'block',
                  }} />
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving || !form.amount || !form.employeeId}
                  style={{
                    padding: '9px 24px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
                    background: saving || !form.amount || !form.employeeId ? 'var(--surface-2)' : 'var(--accent, #3b82f6)',
                    color: saving || !form.amount || !form.employeeId ? 'var(--text-3)' : '#fff',
                    cursor: saving || !form.amount || !form.employeeId ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                  }}>
                  {saving ? (
                    <>
                      <svg style={{ animation: 'spin 0.8s linear infinite' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="15"/></svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {editingUnit ? 'Update Order' : 'Save'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>}
    </div>
  );
}
