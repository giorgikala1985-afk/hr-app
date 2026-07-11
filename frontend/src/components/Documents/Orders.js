import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { generateOrderPDF, generatePromotionPDF } from '../../utils/generateOrderPDF';
import '../Employees/Employees.css';

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

const ORDER_SUBTAB_KEYS = [
  { key: 'hiring',           labelKey: 'orders.hiring'          },
  { key: 'firing',           labelKey: 'orders.firing'          },
  { key: 'promotion',        labelKey: 'orders.promotion'       },
  { key: 'adjusting',        labelKey: 'orders.adjusting'       },
  { key: 'business-trip',    labelKey: 'orders.businessTrip'    },
  { key: 'advance-payment',  labelKey: 'orders.advancePayment'  },
  { key: 'handover',         labelKey: 'orders.handover'        },
];

// ── Shared helpers ───────────────────────────────────────────────────────────
const DEFAULT_ORDERS_MATRIX = [
  { role: 'Super Admin',         description: 'Full access to all orders',   create_hiring: 'Yes', create_firing: 'Yes', create_promotion: 'Yes', create_adjusting: 'Yes', create_business_trip: 'Yes', view_orders: 'Yes' },
  { role: 'Admin',               description: 'Can manage most orders',      create_hiring: 'Yes', create_firing: 'Yes', create_promotion: 'Yes', create_adjusting: 'Yes', create_business_trip: 'Yes', view_orders: 'Yes' },
  { role: 'Member',              description: 'Standard access',             create_hiring: 'No',  create_firing: 'No',  create_promotion: 'No',  create_adjusting: 'No',  create_business_trip: 'Yes', view_orders: 'Own only' },
];

function useOrdersPermissions() {
  const currentRights = (() => {
    try { const s = localStorage.getItem('member_user'); return s ? JSON.parse(s).rights : 'Super Admin'; } catch { return 'Super Admin'; }
  })();

  const [matrix, setMatrix] = useState(() => {
    try {
      const local = localStorage.getItem('orders_matrix');
      return local ? JSON.parse(local) : DEFAULT_ORDERS_MATRIX;
    } catch {
      return DEFAULT_ORDERS_MATRIX;
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        const local = localStorage.getItem('orders_matrix');
        setMatrix(local ? JSON.parse(local) : DEFAULT_ORDERS_MATRIX);
      } catch {}
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return matrix.find(r => r.role === currentRights) || DEFAULT_ORDERS_MATRIX.find(r => r.role === 'Member') || {};
}

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
    <div
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
  const { t } = useLanguage();
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
      <button type="button" onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{t('orders.cancel')}</button>
      <button type="submit" disabled={saving || disabled} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, background: saving || disabled ? 'var(--surface-2)' : 'var(--accent,#3b82f6)', color: saving || disabled ? 'var(--text-3)' : '#fff', cursor: saving || disabled ? 'not-allowed' : 'pointer' }}>
        {saving ? t('orders.saving') : t('orders.save')}
      </button>
    </div>
  );
}

const endOfMonth = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).toISOString().split('T')[0];
};
const currentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function ImmediateEffectToggle({ value, onToggle }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <label style={LABEL}>Effect Timing</label>
      <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => onToggle(true)}
          style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: value ? '#3b82f6' : 'var(--surface-2)', color: value ? '#fff' : 'var(--text-3)', transition: 'all 0.15s' }}
        >
          ⚡ Immediate Effect
        </button>
        <button
          type="button"
          onClick={() => onToggle(false)}
          style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, border: 'none', borderLeft: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'inherit', background: !value ? '#3b82f6' : 'var(--surface-2)', color: !value ? '#fff' : 'var(--text-3)', transition: 'all 0.15s' }}
        >
          📅 End of month
        </button>
      </div>
    </div>
  );
}

function EmptyState({ label, onAdd }) {
  const { t } = useLanguage();
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15, marginBottom: 6 }}>{t('orders.noOrders', { month: label })}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>{t('orders.noOrdersHint')}</div>
      {onAdd && <button onClick={onAdd} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ {t('orders.addNew')}</button>}
    </div>
  );
}

// ── Promotion Tab ─────────────────────────────────────────────────────────────
function PromotionTab({ employees }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { orders, add, update, remove } = useLocalOrders('hr_promotion_orders');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [positions, setPositions] = useState([]);
  const [pdfLoadingId, setPdfLoadingId] = useState(null);
  const EMPTY = { employeeId: '', newPosition: '', oldSalary: '', newSalary: '', effectiveDate: '', notes: '', immediateEffect: true };

  const handleDownloadPDF = async (o, idx) => {
    setPdfLoadingId(o.id);
    try {
      await generatePromotionPDF({
        order: o,
        companyName: user?.user_metadata?.company_name || user?.email || 'Company',
        orderNumber: idx + 1,
      });
    } finally {
      setPdfLoadingId(null);
    }
  };
  const [form, setForm] = useState(EMPTY);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    api.get('/positions').then(res => setPositions(res.data.positions || [])).catch(() => {});
  }, []);

  const perms = useOrdersPermissions();
  const canCreate = perms.create_promotion === 'Yes';

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
        {canCreate && <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ {t('orders.addNew')}</button>}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? <EmptyState label={t('orders.promotion')} onAdd={canCreate ? openAdd : undefined} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {[t('orders.date'), t('orders.employee'), t('orders.oldPosition'), t('orders.newPosition'), t('orders.oldSalary'), t('orders.newSalary'), t('orders.effectiveDate'), t('orders.notes'), ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o, idx) => (
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
                      <button onClick={() => handleDownloadPDF(o, idx)} disabled={pdfLoadingId === o.id} title="Download PDF"
                        style={{ ...actionBtn, color: pdfLoadingId === o.id ? 'var(--text-4)' : 'var(--text-3)' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                        </svg>
                      </button>
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
        <SubTabModal title={editing ? t('orders.editPromotion') : t('orders.newPromotion')} onClose={close}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><label style={LABEL}>{t('orders.employee')} *</label>
                <select value={form.employeeId} onChange={e => {
                  const emp = employees.find(x => x.id === e.target.value);
                  setForm(p => ({ ...p, employeeId: e.target.value, oldSalary: emp?.salary ? String(emp.salary) : '' }));
                }} required style={{ ...INPUT, width: '100%' }}>
                  <option value="">{t('orders.selectEmployee')}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LABEL}>{t('orders.oldPosition')}</label><input value={form.oldPosition || employees.find(e => e.id === form.employeeId)?.position || ''} readOnly style={{ ...INPUT, width: '100%', opacity: 0.6 }} /></div>
                <div><label style={LABEL}>{t('orders.newPosition')}</label>
                  <select value={form.newPosition} onChange={f('newPosition')} style={{ ...INPUT, width: '100%' }}>
                    <option value="">{t('orders.selectPosition')}</option>
                    {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div><label style={LABEL}>{t('orders.oldSalary')}</label><input type="number" value={form.oldSalary} readOnly style={{ ...INPUT, width: '100%', opacity: 0.6 }} /></div>
                <div><label style={LABEL}>{t('orders.newSalary')} *</label><input type="number" value={form.newSalary} onChange={f('newSalary')} required style={{ ...INPUT, width: '100%' }} /></div>
              </div>
              <ImmediateEffectToggle value={form.immediateEffect} onToggle={v => setForm(p => ({ ...p, immediateEffect: v, effectiveDate: v ? p.effectiveDate : endOfMonth(currentMonthStr()) }))} />
              <div><label style={LABEL}>{t('orders.effectiveDate')} *</label><input type="date" value={form.effectiveDate} onChange={f('effectiveDate')} required style={{ ...INPUT, width: '100%' }} /></div>
              <div><label style={LABEL}>{t('orders.notes')}</label><input value={form.notes} onChange={f('notes')} style={{ ...INPUT, width: '100%' }} /></div>
            </div>
            <SubTabActions onCancel={close} disabled={!form.employeeId || !form.newSalary || !form.effectiveDate} />
          </form>
        </SubTabModal>
      )}
    </div>
  );
}

// ── Hiring Tab ────────────────────────────────────────────────────────────────
function HiringTab() {
  const { t } = useLanguage();
  const { orders, add, update, remove } = useLocalOrders('hr_hiring_orders');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const EMPTY = {
    firstName: '', lastName: '', personalId: '', birthdate: '',
    position: '', department: '', startDate: '', endDate: '',
    salary: '', salaryCurrency: 'GEL', accountNumber: '', pitRate: '20',
    pension: false, personalEmail: '', phone: '', address: '', notes: '',
    immediateEffect: true,
  };
  const [form, setForm] = useState(EMPTY);
  const fv = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const fc = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.checked }));

  useEffect(() => {
    api.get('/positions').then(r => setPositions(r.data.positions || [])).catch(() => {});
    api.get('/departments').then(r => setDepartments(r.data.departments || [])).catch(() => {});
    api.get('/tax-codes').then(r => setTaxCodes(r.data.tax_codes || [])).catch(() => {});
  }, []);

  const TABS = [
    { key: 'info',      label: t('orders.employeeInfo'),  icon: 'i'  },
    { key: 'account',   label: t('orders.accountChanges'), icon: '#'  },
    { key: 'documents', label: t('orders.documents'),      icon: 'D'  },
    { key: 'agreement', label: t('orders.agreement'),      icon: '📄' },
    { key: 'portal',    label: t('orders.portalAccess'),   icon: '🔑' },
  ];

  const perms = useOrdersPermissions();
  const canCreate = perms.create_hiring === 'Yes';

  const openAdd = () => { setEditing(null); setForm(EMPTY); setActiveTab('info'); setShowForm(true); };
  const openEdit = (o) => {
    setEditing(o.id);
    setForm({
      firstName: o.firstName || '', lastName: o.lastName || '',
      personalId: o.personalId || '', birthdate: o.birthdate || '',
      position: o.position || '', department: o.department || '',
      startDate: o.startDate || '', endDate: o.endDate || '',
      salary: o.salary || '', salaryCurrency: o.salaryCurrency || 'GEL', accountNumber: o.accountNumber || '',
      pitRate: o.pitRate || '20',
      pension: o.pension || false, personalEmail: o.personalEmail || '',
      phone: o.phone || '', address: o.address || '', notes: o.notes || '',
    });
    setActiveTab('info');
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditing(null); setSubmitError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!editing) {
      setSaving(true);
      try {
        const data = new FormData();
        data.append('first_name', form.firstName.trim());
        data.append('last_name', form.lastName.trim());
        data.append('personal_id', form.personalId.trim());
        data.append('birthdate', form.birthdate);
        data.append('position', form.position.trim());
        data.append('salary', form.salary);
        data.append('salary_currency', form.salaryCurrency || 'GEL');
        data.append('start_date', form.startDate);
        if (form.endDate) data.append('end_date', form.endDate);
        if (form.department) data.append('department', form.department.trim());
        if (form.accountNumber) data.append('account_number', form.accountNumber.trim());
        if (form.phone) data.append('mobile_number', form.phone.trim());
        if (form.personalEmail) data.append('personal_email', form.personalEmail.trim());
        data.append('pit_rate', form.pitRate || 20);
        data.append('pension', form.pension ? 'true' : 'false');
        await api.post('/employees', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      } catch (err) {
        setSubmitError(err.response?.data?.error || 'Failed to create employee.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    editing ? update(editing, form) : add(form);
    close();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {canCreate && <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ {t('orders.addNew')}</button>}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? <EmptyState label={t('orders.hiring')} onAdd={canCreate ? openAdd : undefined} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {[t('orders.date'), t('orders.fullName'), t('orders.personalId'), t('orders.position'), t('orders.department'), t('orders.startDate'), t('orders.salary'), t('orders.notes'), ''].map((h, i) => (
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

      {/* Full-screen form overlay */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg, #0f172a)', zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div className="emp-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-2)', background: 'var(--surface)', marginBottom: 0 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{editing ? t('orders.editHiringOrder') : t('orders.newHiringOrder')}</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>{t('orders.enterDetails')}</p>
            </div>
            <button onClick={close} style={{ padding: '8px 20px', borderRadius: 9, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {t('orders.backToList')}
            </button>
          </div>

          {/* Body: sidebar + content */}
          <div className="emp-edit-layout" style={{ flex: 1, padding: '32px' }}>
            {/* Sidebar */}
            <div className="emp-sidebar">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`emp-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="emp-tab-content">
              {activeTab === 'info' && (
                <div className="form-card">
                  <form onSubmit={handleSubmit}>
                    {submitError && (
                      <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                        {submitError}
                      </div>
                    )}
                    <div className="form-grid-4">
                      <div className="form-group">
                        <label>{t('orders.firstName')} *</label>
                        <input value={form.firstName} onChange={fv('firstName')} placeholder="John" required />
                      </div>
                      <div className="form-group">
                        <label>{t('orders.lastName')} *</label>
                        <input value={form.lastName} onChange={fv('lastName')} placeholder="Doe" required />
                      </div>
                      <div className="form-group">
                        <label>{t('orders.personalId')} *</label>
                        <input value={form.personalId} onChange={fv('personalId')} placeholder="e.g. 01234567890" required />
                      </div>
                      <div className="form-group">
                        <label>{t('orders.birthdate')} *</label>
                        <input type="date" value={form.birthdate} onChange={fv('birthdate')} required />
                      </div>
                      <div className="form-group">
                        <label>{t('orders.position')} *</label>
                        {positions.length > 0 ? (
                          <select value={form.position} onChange={fv('position')} required>
                            <option value="">{t('orders.selectPosition')}</option>
                            {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                        ) : (
                          <input value={form.position} onChange={fv('position')} placeholder="e.g. Software Engineer" required />
                        )}
                      </div>
                      <div className="form-group">
                        <label>{t('orders.department')}</label>
                        {departments.length > 0 ? (
                          <select value={form.department} onChange={fv('department')}>
                            <option value="">{t('orders.selectDepartment')}</option>
                            {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                          </select>
                        ) : (
                          <input value={form.department} onChange={fv('department')} placeholder="e.g. Engineering" />
                        )}
                      </div>
                      <div className="form-group">
                        <label>{t('orders.salary')} *</label>
                        <div style={{ display: 'flex', gap: 0, borderRadius: 8, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
                          <input
                            type="number" step="0.01" min="0"
                            value={form.salary} onChange={fv('salary')}
                            placeholder="e.g. 5000.00" required
                            style={{ flex: 1, border: 'none', outline: 'none', padding: '9px 12px', fontSize: 14, background: 'var(--surface)', color: 'var(--text)', minWidth: 0 }}
                          />
                          {['GEL', 'USD', 'EUR'].map(cur => (
                            <button
                              key={cur} type="button"
                              onClick={() => setForm(p => ({ ...p, salaryCurrency: cur }))}
                              style={{
                                padding: '0 14px', border: 'none', borderLeft: '1px solid var(--border-2)',
                                cursor: 'pointer', fontSize: 13, fontWeight: 700,
                                background: form.salaryCurrency === cur ? '#3b82f6' : 'var(--surface-2)',
                                color: form.salaryCurrency === cur ? '#fff' : 'var(--text-3)',
                                transition: 'all 0.12s',
                              }}
                            >{cur}</button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <ImmediateEffectToggle value={form.immediateEffect} onToggle={v => setForm(p => ({ ...p, immediateEffect: v, startDate: v ? p.startDate : endOfMonth(currentMonthStr()) }))} />
                      </div>
                      <div className="form-group">
                        <label>{t('orders.startDate')} *</label>
                        <input type="date" value={form.startDate} onChange={fv('startDate')} required />
                      </div>
                      <div className="form-group">
                        <label>{t('orders.endDate')}</label>
                        <input type="date" value={form.endDate} onChange={fv('endDate')} />
                        <span className="photo-hint">{t('orders.endDateHint')}</span>
                      </div>
                      <div className="form-group">
                        <label>{t('orders.accountNumber')}</label>
                        <input value={form.accountNumber} onChange={fv('accountNumber')} placeholder="e.g. GE29TB7894545082100008" maxLength={22} />
                      </div>
                      <div className="form-group">
                        <label>{t('orders.pitRate')}</label>
                        <select value={form.pitRate} onChange={fv('pitRate')}>
                          <option value="5">5%</option>
                          <option value="20">20%</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>{t('orders.personalEmail')}</label>
                        <input type="email" value={form.personalEmail} onChange={fv('personalEmail')} placeholder="e.g. john@example.com" />
                      </div>
                      <div className="form-group">
                        <label>{t('orders.phone')}</label>
                        <input type="tel" value={form.phone} onChange={fv('phone')} placeholder="e.g. +995 555 000 000" />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 3' }}>
                        <label>{t('orders.address')}</label>
                        <input value={form.address} onChange={fv('address')} placeholder="e.g. 123 Main St, Tbilisi" />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>{t('orders.notes')}</label>
                        <input value={form.notes} onChange={fv('notes')} placeholder="Additional notes…" />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="pension-toggle-row" style={{ width: 'fit-content' }} onClick={() => setForm(p => ({ ...p, pension: !p.pension }))}>
                          <label className="toggle-switch" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={form.pension} onChange={fc('pension')} />
                            <span className="toggle-track" />
                          </label>
                          <span className="pension-label">
                            {t('orders.pension')}
                            <span className="pension-label-sub">{t('orders.pensionScheme')}</span>
                          </span>
                        </label>
                      </div>

                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn-secondary" onClick={close}>{t('orders.cancel')}</button>
                      <button type="submit" className="btn-add" disabled={saving}>
                        {saving ? t('orders.saving') : editing ? t('orders.updateOrder') : t('orders.createEmployee')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Account Changes */}
              {activeTab === 'account' && editing && (
                <HiringAccountChanges
                  orderId={editing}
                  currentAccount={orders.find(o => o.id === editing)?.accountNumber}
                />
              )}
              {activeTab === 'account' && !editing && (
                <HiringTabPlaceholder icon="#" title={t('orders.accountChanges')} text={t('orders.saveFirst') + ' to record account changes.'} />
              )}

              {/* Documents */}
              {activeTab === 'documents' && editing && <HiringDocuments orderId={editing} />}
              {activeTab === 'documents' && !editing && (
                <HiringTabPlaceholder icon="D" title={t('orders.documents')} text={t('orders.saveFirst') + ' to upload documents.'} />
              )}

              {/* Agreement */}
              {activeTab === 'agreement' && editing && (
                <HiringAgreement orderId={editing} order={orders.find(o => o.id === editing)} />
              )}
              {activeTab === 'agreement' && !editing && (
                <HiringTabPlaceholder icon="📄" title={t('orders.agreement')} text={t('orders.saveFirst') + ' to create agreements.'} />
              )}

              {/* Portal Access */}
              {activeTab === 'portal' && (
                <HiringTabPlaceholder icon="🔑" title={t('orders.portalAccess')} text="Link this hiring order to a system employee to configure portal access." />
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HiringTabPlaceholder({ icon, title, text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--text-3)' }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 320 }}>{text}</div>
      </div>
    </div>
  );
}

function HiringAccountChanges({ orderId, currentAccount }) {
  const storageKey = `hr_hiring_account_changes_${orderId}`;
  const [changes, setChanges] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
  });
  const [newAccount, setNewAccount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const save = (next) => { setChanges(next); localStorage.setItem(storageKey, JSON.stringify(next)); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newAccount.length !== 22) { setError('Account number must be exactly 22 characters'); return; }
    setError(''); setSuccess('');
    const entry = {
      id: Date.now(),
      old_account: changes.length > 0 ? changes[0].new_account : (currentAccount || ''),
      new_account: newAccount,
      effective_date: effectiveDate,
      note,
      created_at: new Date().toISOString(),
    };
    save([entry, ...changes]);
    setSuccess('Account change recorded.');
    setNewAccount(''); setEffectiveDate(''); setNote('');
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this account change?')) return;
    save(changes.filter(c => c.id !== id));
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const acctColor = (a = '') => a.toUpperCase().includes('TB') ? '#60a5fa' : a.toUpperCase().includes('BG') ? '#d9673a' : 'var(--text)';

  const latestAccount = changes.length > 0 ? changes[0].new_account : currentAccount;

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>Account Changes</h3>
        <p>Current account: <strong style={{ color: acctColor(latestAccount) }}>{latestAccount || 'Not set'}</strong></p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      <div className="sc-form-card">
        <h4>Record New Account Change</h4>
        <form onSubmit={handleSubmit}>
          <div className="sc-form-grid">
            <div className="form-group">
              <label>New Account Number</label>
              <input
                type="text" value={newAccount} maxLength={22}
                onChange={e => setNewAccount(e.target.value)}
                placeholder="e.g. GE29TB7894545082100008" required
                style={newAccount && newAccount.length !== 22 ? { borderColor: '#f87171' } : {}}
              />
              {newAccount && newAccount.length !== 22 && (
                <span style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{newAccount.length}/22 characters</span>
              )}
            </div>
            <div className="form-group">
              <label>Effective Date</label>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Note</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note…" />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm">Record Change</button>
        </form>
      </div>

      {changes.length === 0 ? (
        <div className="sc-empty">No account changes recorded yet.</div>
      ) : (
        <div className="sc-timeline">
          {changes.map(c => (
            <div key={c.id} className="sc-item">
              <div className="sc-item-date">{fmtDate(c.effective_date)}</div>
              <div className="sc-item-detail">
                <div className="sc-item-salary">
                  <span style={{ color: acctColor(c.old_account), fontFamily: 'monospace', fontSize: 13 }}>{c.old_account || '—'}</span>
                  <span className="sc-arrow">→</span>
                  <span style={{ color: acctColor(c.new_account), fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{c.new_account}</span>
                </div>
                {c.note && <div className="sc-item-note">{c.note}</div>}
              </div>
              <button onClick={() => handleDelete(c.id)} className="btn-icon btn-delete" title="Delete">🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HiringDocuments({ orderId }) {
  const metaKey = `hr_hiring_docs_meta_${orderId}`;
  const [docs, setDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(metaKey)) || []; } catch { return []; }
  });
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef();

  const saveMeta = (next) => { setDocs(next); localStorage.setItem(metaKey, JSON.stringify(next)); };

  const readAsBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('File too large. Max 5 MB.'); return; }
    setDocFile(file);
    if (!docName) setDocName(file.name.replace(/\.[^.]+$/, ''));
    setError('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!docFile) { setError('Please select a file.'); return; }
    setUploading(true); setError(''); setSuccess('');
    try {
      const b64 = await readAsBase64(docFile);
      const id = Date.now();
      localStorage.setItem(`hr_hiring_doc_file_${orderId}_${id}`, b64);
      const entry = {
        id,
        name: docName || docFile.name,
        filename: docFile.name,
        size: docFile.size,
        type: docFile.type,
        uploaded_at: new Date().toISOString(),
      };
      saveMeta([entry, ...docs]);
      setSuccess('Document uploaded successfully.');
      setDocName(''); setDocFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch { setError('Upload failed. File may be too large for browser storage.'); }
    finally { setUploading(false); }
  };

  const handleDownload = (doc) => {
    const b64 = localStorage.getItem(`hr_hiring_doc_file_${orderId}_${doc.id}`);
    if (!b64) { alert('File not found.'); return; }
    const a = document.createElement('a');
    a.href = b64;
    a.download = doc.filename;
    a.click();
  };

  const handleDelete = (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    localStorage.removeItem(`hr_hiring_doc_file_${orderId}_${doc.id}`);
    saveMeta(docs.filter(d => d.id !== doc.id));
  };

  const fmtSize = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fileIcon = (type = '') => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    return '📎';
  };

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>Documents</h3>
        <p>Upload and manage documents for this hiring order</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* Upload form */}
      <div className="sc-form-card">
        <h4>Upload Document</h4>
        <form onSubmit={handleUpload}>
          <input ref={fileRef} type="file" hidden onChange={e => handleFile(e.target.files[0])} />
          <div className="sc-form-grid">
            <div className="form-group">
              <label>Document Name</label>
              <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Passport copy" required />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: docFile ? '#4ade80' : 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {docFile ? `${docFile.name} (${fmtSize(docFile.size)})` : 'Choose File'}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={uploading || !docFile}>
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        </form>
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="sc-empty">No documents uploaded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              background: 'var(--surface-2)', border: '1px solid var(--border-2)',
              borderRadius: 10, transition: 'background 0.12s',
            }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{fileIcon(doc.type)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 10 }}>
                  <span>{doc.filename}</span>
                  <span>·</span>
                  <span>{fmtSize(doc.size)}</span>
                  <span>·</span>
                  <span>Uploaded {fmtDate(doc.uploaded_at)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => handleDownload(doc)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HiringAgreement({ orderId, order }) {
  const storageKey = `hr_hiring_agreements_${orderId}`;
  const [agreements, setAgreements] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
  });
  const emptyForm = {
    title: 'Employment Agreement',
    type: 'Employment',
    party_name: order ? `${order.firstName} ${order.lastName}` : '',
    start_date: order?.startDate || '',
    end_date: order?.endDate || '',
    amount: order?.salary || '',
    currency: 'GEL',
    status: 'active',
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [signUrls, setSignUrls] = useState({});
  const [emailOverride, setEmailOverride] = useState('');
  const [emailPromptId, setEmailPromptId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const saveAll = (next) => { setAgreements(next); localStorage.setItem(storageKey, JSON.stringify(next)); };
  const hc = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleCreate = (e) => {
    e.preventDefault();
    setSaving(true);
    const ag = { id: Date.now(), ...form, created_at: new Date().toISOString() };
    saveAll([ag, ...agreements]);
    setSuccess('Agreement created.');
    setShowForm(false);
    setForm(emptyForm);
    setSaving(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this agreement?')) return;
    saveAll(agreements.filter(a => a.id !== id));
  };

  const generatePDF = (ag) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 20, pageW = 210, contentW = pageW - margin * 2;
    let y = 25;

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 14, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    doc.text('EMPLOYMENT AGREEMENT', margin, 9.5);
    doc.text(new Date().toLocaleDateString('en-GB'), pageW - margin, 9.5, { align: 'right' });

    doc.setTextColor(15, 23, 42); doc.setFontSize(20);
    doc.text(ag.title || 'Employment Agreement', pageW / 2, y + 10, { align: 'center' });
    y += 22;

    const statusColors = { active: [220, 252, 231], inactive: [241, 245, 249], terminated: [254, 242, 242] };
    const statusText  = { active: [21, 128, 61],  inactive: [71, 85, 105],    terminated: [220, 38, 38] };
    doc.setFillColor(...(statusColors[ag.status] || statusColors.inactive));
    doc.roundedRect(pageW / 2 - 20, y, 40, 7, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(...(statusText[ag.status] || statusText.inactive));
    doc.text((ag.status || 'active').toUpperCase(), pageW / 2, y + 4.8, { align: 'center' });
    y += 16;

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y); y += 10;

    const section = (t) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(37, 99, 235);
      doc.text(t, margin, y); doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.3);
      doc.line(margin, y + 1, margin + doc.getTextWidth(t), y + 1); y += 7;
    };
    const row = (lbl, val) => {
      if (!val) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(71, 85, 105);
      doc.text(lbl + ':', margin, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
      doc.text(String(val), margin + 45, y); y += 7;
    };

    section('PARTIES');
    row('Party Name', ag.party_name || '—');
    row('Agreement Type', ag.type || '—');
    y += 3;

    section('TERMS & CONDITIONS');
    row('Start Date', ag.start_date ? new Date(ag.start_date).toLocaleDateString('en-GB') : '—');
    row('End Date', ag.end_date ? new Date(ag.end_date).toLocaleDateString('en-GB') : 'Open-ended');
    row('Amount', ag.amount ? `${Number(ag.amount).toLocaleString()} ${ag.currency}` : '—');
    y += 3;

    if (ag.notes) {
      section('ADDITIONAL NOTES');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(ag.notes, contentW);
      doc.text(lines, margin, y); y += lines.length * 5.5 + 8;
    }

    y = Math.max(y + 10, 210);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y); y += 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(37, 99, 235);
    doc.text('SIGNATURES', margin, y); y += 12;

    const sigBox = (x, label, name) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, 75, 28, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240); doc.roundedRect(x, y, 75, 28, 3, 3, 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
      doc.text(label, x + 4, y + 6);
      doc.setLineWidth(0.3); doc.setDrawColor(148, 163, 184);
      doc.line(x + 4, y + 20, x + 70, y + 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
      doc.text(name, x + 4, y + 25);
    };
    sigBox(margin, 'EMPLOYER', 'Authorized Signature & Date');
    sigBox(pageW - margin - 75, 'EMPLOYEE', `${ag.party_name || 'Employee'} & Date`);

    doc.setFillColor(37, 99, 235); doc.rect(0, 282, pageW, 15, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')}  |  Agreement ID: ${ag.id}`, pageW / 2, 290, { align: 'center' });
    doc.save(`${(ag.title || 'agreement').replace(/\s+/g, '-')}.pdf`);
  };

  const doSendSignLink = async (ag, email) => {
    setSendingId(ag.id); setError(''); setSuccess(''); setEmailPromptId(null);
    try {
      const createRes = await api.post('/documents', {
        employee_id: null,
        employee_name: ag.party_name,
        type: 'hiring',
        title: ag.title,
        content: {
          job_title: ag.type,
          start_date: ag.start_date ? new Date(ag.start_date).toLocaleDateString('en-GB') : '',
          end_date: ag.end_date ? new Date(ag.end_date).toLocaleDateString('en-GB') : '',
          salary: ag.amount,
          currency: ag.currency,
          notes: ag.notes,
        },
      });
      const docId = createRes.data.document.id;
      const sendRes = await api.post(`/documents/${docId}/send`, { email: email || null, employee_name: ag.party_name });
      setSignUrls(p => ({ ...p, [ag.id]: sendRes.data.sign_url }));
      setSuccess(email ? `Sign link sent to ${email}` : 'Sign link created — copy it below.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send sign link.');
    } finally { setSendingId(null); }
  };

  const handleSend = (ag) => {
    const email = order?.personalEmail;
    if (!email) { setEmailPromptId(ag.id); setEmailOverride(''); }
    else doSendSignLink(ag, email);
  };

  const statusBadge = (s) => {
    const map = { active: ['#dcfce7','#15803d'], inactive: ['#f1f5f9','#475569'], terminated: ['#fef2f2','#dc2626'] };
    const [bg, color] = map[s] || map.inactive;
    return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{s}</span>;
  };

  const agLs = {
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
    input: { width: '100%', padding: '9px 12px', border: '1.5px solid var(--border-2)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' },
  };

  return (
    <div style={{ padding: '24px 0', maxWidth: 740 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Agreements</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Create, sign and send employment agreements</p>
        </div>
        <button onClick={() => { setShowForm(f => !f); setError(''); setSuccess(''); }}
          style={{ padding: '8px 18px', background: 'var(--accent,#3b82f6)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Create Agreement'}
        </button>
      </div>

      {error   && <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.15)', color: '#f87171', borderRadius: 8, fontSize: 13, marginBottom: 14, border: '1px solid rgba(220,38,38,0.3)' }}>{error}</div>}
      {success && <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,0.15)', color: '#4ade80', borderRadius: 8, fontSize: 13, marginBottom: 14, border: '1px solid rgba(22,163,74,0.3)' }}>{success}</div>}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[['Title', 'title'], ['Party Name', 'party_name']].map(([lbl, name]) => (
              <div key={name}><label style={agLs.label}>{lbl}</label><input name={name} value={form[name]} onChange={hc} required style={agLs.input} /></div>
            ))}
            <div><label style={agLs.label}>Type</label>
              <select name="type" value={form.type} onChange={hc} style={agLs.input}>
                {['Employment','Service','Contractor','NDA','Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={agLs.label}>Status</label>
              <select name="status" value={form.status} onChange={hc} style={agLs.input}>
                {['active','inactive','terminated'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={agLs.label}>Start Date</label><input name="start_date" type="date" value={form.start_date} onChange={hc} style={agLs.input} /></div>
            <div><label style={agLs.label}>End Date</label><input name="end_date" type="date" value={form.end_date} onChange={hc} style={agLs.input} /></div>
            <div><label style={agLs.label}>Amount</label><input name="amount" type="number" step="0.01" min="0" value={form.amount} onChange={hc} style={agLs.input} /></div>
            <div><label style={agLs.label}>Currency</label>
              <select name="currency" value={form.currency} onChange={hc} style={agLs.input}>
                {['GEL','USD','EUR'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={agLs.label}>Notes</label>
              <textarea name="notes" value={form.notes} onChange={hc} rows={3} style={{ ...agLs.input, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="submit" disabled={saving}
              style={{ padding: '9px 24px', background: 'var(--accent,#3b82f6)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Create Agreement'}
            </button>
          </div>
        </form>
      )}

      {agreements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-4)', fontSize: 14, border: '1px dashed var(--border-2)', borderRadius: 10 }}>
          No agreements yet. Click "+ Create Agreement" to add one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agreements.map(ag => (
            <div key={ag.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{ag.title}</span>
                    {statusBadge(ag.status)}
                    <span style={{ fontSize: 12, color: 'var(--text-4)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 12 }}>{ag.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {ag.party_name && <span>Party: {ag.party_name}</span>}
                    {ag.amount && <span>Amount: {ag.amount} {ag.currency}</span>}
                    {ag.start_date && <span>From: {new Date(ag.start_date).toLocaleDateString('en-GB')}</span>}
                    {ag.end_date && <span>To: {new Date(ag.end_date).toLocaleDateString('en-GB')}</span>}
                  </div>
                  {ag.notes && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-4)' }}>{ag.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  {/* Download PDF */}
                  <button onClick={() => generatePDF(ag)}
                    style={btnStyle('#3b82f6')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    PDF
                  </button>
                  {/* Send Sign Link */}
                  <button onClick={() => handleSend(ag)} disabled={sendingId === ag.id}
                    style={btnStyle('#8b5cf6')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    {sendingId === ag.id ? 'Sending…' : 'Send for Signature'}
                  </button>
                  {/* Delete */}
                  <button onClick={() => handleDelete(ag.id)}
                    style={{ background: 'none', border: '1px solid rgba(220,38,38,0.35)', color: '#f87171', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Email prompt */}
              {emailPromptId === ag.id && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="email" placeholder="Enter employee email…" value={emailOverride} onChange={e => setEmailOverride(e.target.value)}
                    style={{ ...agLs.input, flex: 1, padding: '6px 10px', fontSize: 12 }} />
                  <button onClick={() => doSendSignLink(ag, emailOverride || null)} disabled={!emailOverride}
                    style={{ padding: '6px 14px', background: 'var(--accent,#3b82f6)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Send
                  </button>
                  <button onClick={() => setEmailPromptId(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              )}

              {/* Sign URL */}
              {signUrls[ag.id] && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(22,163,74,0.08)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flex: 1, wordBreak: 'break-all' }}>{signUrls[ag.id]}</span>
                  <button onClick={() => navigator.clipboard.writeText(signUrls[ag.id])}
                    style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: 5, padding: '3px 8px', fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Copy
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle = (color) => ({
  background: 'none', border: `1px solid var(--border-2)`, color: 'var(--text-3)',
  borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600,
  transition: 'color 0.15s, border-color 0.15s',
});

// ── Firing Tab ────────────────────────────────────────────────────────────────
function FiringTab({ employees }) {
  const { t } = useLanguage();
  const { orders, add, update, remove } = useLocalOrders('hr_firing_orders');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const EMPTY = { employeeId: '', terminationDate: '', reason: '', notes: '', immediateEffect: true };
  const [form, setForm] = useState(EMPTY);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const perms = useOrdersPermissions();
  const canCreate = perms.create_firing === 'Yes';

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
        {canCreate && <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ {t('orders.addNew')}</button>}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? <EmptyState label={t('orders.firing')} onAdd={canCreate ? openAdd : undefined} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {[t('orders.date'), t('orders.employee'), t('orders.position'), t('orders.terminationDate'), t('orders.reason'), t('orders.notes'), ''].map((h, i) => (
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
        <SubTabModal title={editing ? t('orders.editFiringOrder') : t('orders.newFiringOrder')} onClose={close}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><label style={LABEL}>{t('orders.employee')} *</label>
                <select value={form.employeeId} onChange={f('employeeId')} required style={{ ...INPUT, width: '100%' }}>
                  <option value="">{t('orders.selectEmployee')}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <ImmediateEffectToggle value={form.immediateEffect} onToggle={v => setForm(p => ({ ...p, immediateEffect: v, terminationDate: v ? p.terminationDate : endOfMonth(currentMonthStr()) }))} />
              <div><label style={LABEL}>{t('orders.terminationDate')} *</label><input type="date" value={form.terminationDate} onChange={f('terminationDate')} required style={{ ...INPUT, width: '100%' }} /></div>
              <div><label style={LABEL}>{t('orders.reason')} *</label><input value={form.reason} onChange={f('reason')} required style={{ ...INPUT, width: '100%' }} /></div>
              <div><label style={LABEL}>{t('orders.notes')}</label><input value={form.notes} onChange={f('notes')} style={{ ...INPUT, width: '100%' }} /></div>
            </div>
            <SubTabActions onCancel={close} disabled={!form.employeeId || !form.terminationDate || !form.reason} />
          </form>
        </SubTabModal>
      )}
    </div>
  );
}

// ── Business Trip Per Diem rates (USD/day, Georgian government decree) ────────
const COUNTRIES = [
  { code: 'us', name: 'United States',          perDiem: 65, cities: [{ name: 'Washington D.C.', perDiem: 90 }, { name: 'New York', perDiem: 100 }, { name: 'San Francisco', perDiem: 95 }] },
  { code: 'gb', name: 'United Kingdom',         perDiem: 70, cities: [{ name: 'London', perDiem: 90 }, { name: 'Edinburgh', perDiem: 80 }] },
  { code: 'de', name: 'Germany',                perDiem: 65, cities: [{ name: 'Berlin', perDiem: 80 }, { name: 'Munich', perDiem: 85 }] },
  { code: 'fr', name: 'France',                 perDiem: 65, cities: [{ name: 'Paris', perDiem: 85 }, { name: 'Lyon', perDiem: 75 }] },
  { code: 'it', name: 'Italy',                  perDiem: 65, cities: [{ name: 'Rome', perDiem: 80 }, { name: 'Milan', perDiem: 85 }] },
  { code: 'es', name: 'Spain',                  perDiem: 60, cities: [{ name: 'Madrid', perDiem: 75 }] },
  { code: 'nl', name: 'Netherlands',            perDiem: 65, cities: [{ name: 'Amsterdam', perDiem: 80 }] },
  { code: 'be', name: 'Belgium',                perDiem: 65, cities: [{ name: 'Brussels', perDiem: 80 }] },
  { code: 'ch', name: 'Switzerland',            perDiem: 80, cities: [{ name: 'Bern', perDiem: 95 }] },
  { code: 'at', name: 'Austria',                perDiem: 65, cities: [{ name: 'Vienna', perDiem: 80 }] },
  { code: 'se', name: 'Sweden',                 perDiem: 65, cities: [{ name: 'Stockholm', perDiem: 80 }] },
  { code: 'no', name: 'Norway',                 perDiem: 70, cities: [{ name: 'Oslo', perDiem: 85 }] },
  { code: 'dk', name: 'Denmark',                perDiem: 65, cities: [{ name: 'Copenhagen', perDiem: 80 }] },
  { code: 'fi', name: 'Finland',                perDiem: 60, cities: [{ name: 'Helsinki', perDiem: 75 }] },
  { code: 'pl', name: 'Poland',                 perDiem: 50, cities: [{ name: 'Warsaw', perDiem: 65 }] },
  { code: 'cz', name: 'Czech Republic',         perDiem: 50, cities: [{ name: 'Prague', perDiem: 65 }] },
  { code: 'hu', name: 'Hungary',                perDiem: 45, cities: [{ name: 'Budapest', perDiem: 60 }] },
  { code: 'ro', name: 'Romania',                perDiem: 40, cities: [{ name: 'Bucharest', perDiem: 55 }] },
  { code: 'gr', name: 'Greece',                 perDiem: 55, cities: [{ name: 'Athens', perDiem: 70 }] },
  { code: 'pt', name: 'Portugal',               perDiem: 55, cities: [{ name: 'Lisbon', perDiem: 70 }] },
  { code: 'tr', name: 'Turkey',                 perDiem: 45, cities: [{ name: 'Ankara', perDiem: 55 }] },
  { code: 'ru', name: 'Russia',                 perDiem: 40, cities: [{ name: 'Moscow', perDiem: 55 }] },
  { code: 'ua', name: 'Ukraine',                perDiem: 35, cities: [{ name: 'Kyiv', perDiem: 50 }] },
  { code: 'am', name: 'Armenia',                perDiem: 30, cities: [{ name: 'Yerevan', perDiem: 45 }] },
  { code: 'az', name: 'Azerbaijan',             perDiem: 35, cities: [{ name: 'Baku', perDiem: 50 }] },
  { code: 'kz', name: 'Kazakhstan',             perDiem: 40, cities: [{ name: 'Astana', perDiem: 55 }] },
  { code: 'ae', name: 'United Arab Emirates',   perDiem: 60, cities: [{ name: 'Abu Dhabi', perDiem: 75 }] },
  { code: 'sa', name: 'Saudi Arabia',           perDiem: 55, cities: [{ name: 'Riyadh', perDiem: 70 }] },
  { code: 'il', name: 'Israel',                 perDiem: 65, cities: [{ name: 'Jerusalem', perDiem: 80 }] },
  { code: 'cn', name: 'China',                  perDiem: 55, cities: [{ name: 'Beijing', perDiem: 70 }] },
  { code: 'jp', name: 'Japan',                  perDiem: 65, cities: [{ name: 'Tokyo', perDiem: 80 }] },
  { code: 'kr', name: 'South Korea',            perDiem: 60, cities: [{ name: 'Seoul', perDiem: 75 }] },
  { code: 'in', name: 'India',                  perDiem: 45, cities: [{ name: 'New Delhi', perDiem: 60 }] },
  { code: 'sg', name: 'Singapore',              perDiem: 65, cities: [{ name: 'Singapore', perDiem: 80 }] },
  { code: 'th', name: 'Thailand',               perDiem: 45, cities: [{ name: 'Bangkok', perDiem: 60 }] },
  { code: 'ca', name: 'Canada',                 perDiem: 65, cities: [{ name: 'Ottawa', perDiem: 80 }] },
  { code: 'au', name: 'Australia',              perDiem: 65, cities: [{ name: 'Canberra', perDiem: 80 }] },
  { code: 'nz', name: 'New Zealand',            perDiem: 60, cities: [{ name: 'Wellington', perDiem: 75 }] },
  { code: 'za', name: 'South Africa',           perDiem: 45, cities: [{ name: 'Pretoria', perDiem: 60 }] },
  { code: 'eg', name: 'Egypt',                  perDiem: 40, cities: [{ name: 'Cairo', perDiem: 55 }] },
  { code: 'ma', name: 'Morocco',                perDiem: 40, cities: [{ name: 'Rabat', perDiem: 55 }] },
  { code: 'br', name: 'Brazil',                 perDiem: 50, cities: [{ name: 'Brasilia', perDiem: 65 }] },
  { code: 'mx', name: 'Mexico',                 perDiem: 50, cities: [{ name: 'Mexico City', perDiem: 65 }] },
  { code: 'ar', name: 'Argentina',              perDiem: 45, cities: [{ name: 'Buenos Aires', perDiem: 60 }] },
  { code: 'lt', name: 'Lithuania',              perDiem: 50, cities: [{ name: 'Vilnius', perDiem: 65 }] },
  { code: 'lv', name: 'Latvia',                 perDiem: 50, cities: [{ name: 'Riga', perDiem: 65 }] },
  { code: 'ee', name: 'Estonia',                perDiem: 50, cities: [{ name: 'Tallinn', perDiem: 65 }] },
  { code: 'by', name: 'Belarus',                perDiem: 35, cities: [{ name: 'Minsk', perDiem: 50 }] },
  { code: 'md', name: 'Moldova',                perDiem: 30, cities: [{ name: 'Chișinău', perDiem: 45 }] },
  { code: 'rs', name: 'Serbia',                 perDiem: 40, cities: [{ name: 'Belgrade', perDiem: 55 }] },
  { code: 'hr', name: 'Croatia',                perDiem: 50, cities: [{ name: 'Zagreb', perDiem: 65 }] },
  { code: 'sk', name: 'Slovakia',               perDiem: 50, cities: [{ name: 'Bratislava', perDiem: 65 }] },
  { code: 'bg', name: 'Bulgaria',               perDiem: 40, cities: [{ name: 'Sofia', perDiem: 55 }] },
].sort((a, b) => a.name.localeCompare(b.name));

function flagUrl(code) {
  return `https://flagcdn.com/w40/${code}.png`;
}

function calcDays(from, to) {
  if (!from || !to) return 0;
  const ms = new Date(to) - new Date(from);
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

// ── Trip Costs ────────────────────────────────────────────────────────────────
function TripCosts({ tripId }) {
  const storageKey = `hr_bt_costs_${tripId}`;
  const [costs, setCosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
  });
  const [costName, setCostName] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costFile, setCostFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef();

  const saveCosts = (next) => { setCosts(next); localStorage.setItem(storageKey, JSON.stringify(next)); };

  const readAsBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!costName.trim()) return;
    setUploading(true);
    try {
      let fileData = null, fileName = null, fileType = null;
      if (costFile) {
        fileData = await readAsBase64(costFile);
        fileName = costFile.name;
        fileType = costFile.type;
      }
      saveCosts([...costs, { id: Date.now(), name: costName.trim(), amount: costAmount, fileName, fileType, fileData, addedAt: new Date().toISOString() }]);
      setCostName(''); setCostAmount(''); setCostFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } finally { setUploading(false); }
  };

  const handleDownload = (c) => {
    const a = document.createElement('a');
    a.href = c.fileData;
    a.download = c.fileName;
    a.click();
  };

  const totalCosts = costs.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  const fileIcon = (type) => {
    if (!type) return '📎';
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    return '📎';
  };

  return (
    <div>
      {/* Add cost form */}
      <form onSubmit={handleAdd} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid var(--border-2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={LABEL}>Cost Name *</label>
            <input value={costName} onChange={e => setCostName(e.target.value)} placeholder="e.g. Hotel, Taxi, Meals…" style={INPUT} required />
          </div>
          <div>
            <label style={LABEL}>Amount (USD)</label>
            <input type="number" min="0" step="0.01" value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder="0.00" style={INPUT} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={e => setCostFile(e.target.files[0] || null)} />
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border-2)', background: 'var(--surface)', color: costFile ? '#4ade80' : 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {costFile ? costFile.name.slice(0, 22) + (costFile.name.length > 22 ? '…' : '') : 'Attach PDF / Image'}
          </button>
          {costFile && <button type="button" onClick={() => { setCostFile(null); if (fileRef.current) fileRef.current.value = ''; }} style={{ color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>}
          <button type="submit" disabled={uploading || !costName.trim()} style={{ marginLeft: 'auto', padding: '7px 18px', borderRadius: 7, border: 'none', background: uploading || !costName.trim() ? 'var(--surface-3)' : '#0ea5e9', color: uploading || !costName.trim() ? 'var(--text-4)' : '#fff', fontWeight: 700, fontSize: 13, cursor: uploading || !costName.trim() ? 'not-allowed' : 'pointer' }}>
            {uploading ? 'Adding…' : '+ Add Cost'}
          </button>
        </div>
      </form>

      {/* Cost list */}
      {costs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-3)', fontSize: 13 }}>No costs added yet</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 9, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['#', 'Name', 'File', 'Amount', ''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: i === 3 ? 'right' : 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {costs.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-2)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '9px 12px', color: 'var(--text-4)', fontSize: 12, width: 32 }}>{idx + 1}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text)' }}>{c.name}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--text-3)', fontSize: 12 }}>
                    {c.fileData
                      ? <button onClick={() => handleDownload(c)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: 0 }}>
                          <span>{fileIcon(c.fileType)}</span>{c.fileName}
                        </button>
                      : <span style={{ color: 'var(--text-4)' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: '#4ade80', textAlign: 'right', whiteSpace: 'nowrap' }}>{c.amount ? `$${c.amount}` : '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                    <button onClick={() => saveCosts(costs.filter(x => x.id !== c.id))}
                      style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border-2)', background: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(74,222,128,0.08)', borderRadius: 8, border: '1px solid rgba(74,222,128,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Total Costs</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>${totalCosts.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function getTripCostsTotal(tripId) {
  try {
    const costs = JSON.parse(localStorage.getItem(`hr_bt_costs_${tripId}`)) || [];
    return costs.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  } catch { return 0; }
}

function BusinessTripTab({ employees }) {
  const { orders, add, update, remove } = useLocalOrders('hr_business_trip_orders');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalTab, setModalTab] = useState('details');
  const [, forceUpdate] = useState(0);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = React.useRef(null);
  const [citySearch, setCitySearch] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const cityRef = React.useRef(null);
  const [empOpen, setEmpOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const empRef = React.useRef(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  const EMPTY = {
    employeeId: '', employeeIds: [], isGroup: false, groupName: '',
    fromDate: '', toDate: '',
    countryCode: '', countryName: '', cityName: '',
    perDiem: '', amount: '', notes: '',
    immediateEffect: true,
  };
  const [form, setForm] = useState(EMPTY);

  const days = calcDays(form.fromDate, form.toDate);
  const autoAmount = form.perDiem && days > 0 ? (parseFloat(form.perDiem) * days).toFixed(2) : '';

  const perms = useOrdersPermissions();
  const canCreate = perms.create_business_trip === 'Yes';

  React.useEffect(() => {
    const handler = (e) => {
      if (countryRef.current && !countryRef.current.contains(e.target)) setCountryOpen(false);
      if (cityRef.current && !cityRef.current.contains(e.target)) setCityOpen(false);
      if (empRef.current && !empRef.current.contains(e.target)) setEmpOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCountry = (c) => {
    setForm(f => ({
      ...f,
      countryCode: c.code,
      countryName: c.name,
      cityName: '',
      perDiem: String(c.perDiem),
      amount: f.amount || (c.perDiem * calcDays(f.fromDate, f.toDate)).toFixed(2),
    }));
    setCountryOpen(false);
    setCountrySearch('');
  };

  const selectCity = (city) => {
    setForm(f => ({
      ...f,
      cityName: city.name,
      perDiem: String(city.perDiem),
      amount: (city.perDiem * calcDays(f.fromDate, f.toDate)).toFixed(2),
    }));
    setCityOpen(false);
  };

  const filteredCountries = countrySearch
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRIES;

  const openAdd = () => { setEditing(null); setForm(EMPTY); setCountrySearch(''); setEmpSearch(''); setModalTab('details'); setShowForm(true); };
  const openEdit = (o) => {
    setEditing(o.id);
    setForm({ employeeId: o.employeeId, employeeIds: [], isGroup: false, fromDate: o.fromDate, toDate: o.toDate, countryCode: o.countryCode, countryName: o.countryName, cityName: o.cityName || '', perDiem: o.perDiem || '', amount: o.amount || '', notes: o.notes || '' });
    setModalTab('details');
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditing(null); forceUpdate(n => n + 1); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalAmount = form.amount || autoAmount;
    const destination = [form.countryName, form.cityName].filter(Boolean).join(', ');

    const targetIds = !editing && form.isGroup
      ? form.employeeIds
      : [form.employeeId];

    const groupId = !editing && form.isGroup && targetIds.length > 1
      ? `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : null;
    const groupName = groupId ? (form.groupName.trim() || `Group of ${targetIds.length}`) : null;

    for (const eid of targetIds) {
      const emp = employees.find(x => x.id === eid);
      const { employeeIds, isGroup, groupName: _gn, ...rest } = form;
      const row = {
        ...rest,
        employeeId: eid,
        empName: emp ? `${emp.first_name} ${emp.last_name}` : '',
        days,
        amount: finalAmount,
        ...(groupId ? { groupId, groupName } : {}),
      };
      editing ? update(editing, row) : add(row);

      if (!editing && finalAmount) {
        try {
          await api.post('/accounting/transfers', {
            client_name: emp ? `${emp.first_name} ${emp.last_name}` : eid,
            amount: parseFloat(finalAmount),
            due_date: form.toDate,
            description: `Business Trip: ${destination} (${form.fromDate} → ${form.toDate})`,
            status: 'normal',
            auto_approved: true,
          });
        } catch (err) {
          console.warn('Could not create transfer for business trip:', err.message);
        }
      }
    }

    if (!editing) { close(); } else { setModalTab('details'); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const MODAL_TABS = [
    { key: 'details', label: 'Details' },
    { key: 'costs',   label: 'Costs'   },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {canCreate && <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#0ea5e9', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + New Business Trip
        </button>}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✈️</div>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15, marginBottom: 6 }}>No business trips recorded</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Click "New Business Trip" to add one</div>
            {canCreate && <button onClick={openAdd} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0ea5e9', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ New Business Trip</button>}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Employee', 'Period', 'Days', 'Destination', 'Per Diem/day', 'Amount', 'Total Costs', 'Notes', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rendered = [];
                const seenGroups = new Set();
                for (const o of orders) {
                  if (o.groupId && seenGroups.has(o.groupId)) continue;
                  if (o.groupId) {
                    seenGroups.add(o.groupId);
                    const members = orders.filter(x => x.groupId === o.groupId);
                    const expanded = !!expandedGroups[o.groupId];
                    const totalAmount = members.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
                    const totalCosts = members.reduce((s, m) => s + getTripCostsTotal(m.id), 0);
                    rendered.push(
                      <tr key={`grp-${o.groupId}`}
                        style={{ borderBottom: '1px solid var(--border-2)', background: 'var(--surface-2)', cursor: 'pointer' }}
                        onClick={() => setExpandedGroups(g => ({ ...g, [o.groupId]: !g[o.groupId] }))}>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-block', width: 16, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', marginRight: 6, color: 'var(--text-3)' }}>▶</span>
                          {o.groupName || 'Group'} <span style={{ fontWeight: 500, color: 'var(--text-3)', fontSize: 12 }}>({members.length})</span>
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>
                          {formatDate(o.fromDate)} – {formatDate(o.toDate)}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0ea5e9' }}>{o.days}d</td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-2)' }}>
                          {o.countryCode && <img src={flagUrl(o.countryCode)} alt="" width="18" style={{ borderRadius: 2, verticalAlign: 'middle', marginRight: 6 }} />}
                          {o.countryName}{o.cityName ? `, ${o.cityName}` : ''}
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.perDiem ? `$${o.perDiem}` : '—'}</td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: '#4ade80' }}>${totalAmount.toFixed(2)}</td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {totalCosts > 0 ? <span style={{ fontWeight: 700, color: '#f59e0b' }}>${totalCosts.toFixed(2)}</span> : <span style={{ color: 'var(--text-4)' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.notes || '—'}</td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete entire group (${members.length} trips)?`)) members.forEach(m => remove(m.id)); }}
                            style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>×</button>
                        </td>
                      </tr>
                    );
                    if (expanded) {
                      for (const m of members) {
                        rendered.push(
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--border-2)', background: 'rgba(14,165,233,0.04)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.10)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,165,233,0.04)'}>
                            <td style={{ padding: '9px 14px 9px 38px', fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>↳ {m.empName}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text-3)', whiteSpace: 'nowrap', fontSize: 12 }}>{formatDate(m.fromDate)} – {formatDate(m.toDate)}</td>
                            <td style={{ padding: '9px 14px', fontWeight: 600, color: '#0ea5e9', fontSize: 12 }}>{m.days}d</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text-3)', fontSize: 12 }}>{m.countryName}{m.cityName ? `, ${m.cityName}` : ''}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text-3)', fontSize: 12 }}>{m.perDiem ? `$${m.perDiem}` : '—'}</td>
                            <td style={{ padding: '9px 14px', fontWeight: 600, color: '#4ade80', fontSize: 12 }}>{m.amount ? `$${m.amount}` : '—'}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12 }}>
                              {(() => { const t = getTripCostsTotal(m.id); return t > 0 ? <span style={{ fontWeight: 600, color: '#f59e0b' }}>${t.toFixed(2)}</span> : <span style={{ color: 'var(--text-4)' }}>—</span>; })()}
                            </td>
                            <td style={{ padding: '9px 14px', color: 'var(--text-3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{m.notes || '—'}</td>
                            <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => openEdit(m)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}><EditIcon /></button>
                                <button onClick={() => remove(m.id)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>×</button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    }
                  } else {
                    rendered.push(
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--border-2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{o.empName}</td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>
                          {formatDate(o.fromDate)} – {formatDate(o.toDate)}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0ea5e9' }}>{o.days}d</td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-2)' }}>
                          {o.countryCode && <img src={flagUrl(o.countryCode)} alt="" width="18" style={{ borderRadius: 2, verticalAlign: 'middle', marginRight: 6 }} />}
                          {o.countryName}{o.cityName ? `, ${o.cityName}` : ''}
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.perDiem ? `$${o.perDiem}` : '—'}</td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: '#4ade80' }}>{o.amount ? `$${o.amount}` : '—'}</td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {(() => { const t = getTripCostsTotal(o.id); return t > 0 ? <span style={{ fontWeight: 700, color: '#f59e0b' }}>${t.toFixed(2)}</span> : <span style={{ color: 'var(--text-4)' }}>—</span>; })()}
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.notes || '—'}</td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEdit(o)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f59e0b'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}><EditIcon /></button>
                            <button onClick={() => remove(o.id)} style={actionBtn} onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>×</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                }
                return rendered;
              })()}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <SubTabModal title={editing ? 'Edit Business Trip' : 'New Business Trip'} onClose={close}>
          {/* Inner tab switcher */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3, marginBottom: 20, width: 'fit-content' }}>
            {MODAL_TABS.map(tab => (
              <button key={tab.key} type="button" onClick={() => setModalTab(tab.key)}
                disabled={tab.key === 'costs' && !editing}
                style={{
                  padding: '6px 18px', border: 'none', borderRadius: 6,
                  fontWeight: 600, fontSize: 13, cursor: tab.key === 'costs' && !editing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  background: modalTab === tab.key ? 'var(--surface)' : 'transparent',
                  color: tab.key === 'costs' && !editing ? 'var(--text-4)' : modalTab === tab.key ? 'var(--text)' : 'var(--text-3)',
                  boxShadow: modalTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}>
                {tab.label}
                {tab.key === 'costs' && !editing && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>(save first)</span>}
              </button>
            ))}
          </div>

          {/* Details tab */}
          {modalTab === 'details' && (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ ...LABEL, marginBottom: 0 }}>Employee *</label>
                    {!editing && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', userSelect: 'none' }}>
                        Group
                        <span style={{ position: 'relative', display: 'inline-block', width: 32, height: 18 }}>
                          <input type="checkbox" checked={form.isGroup}
                            onChange={e => setForm(f => ({ ...f, isGroup: e.target.checked, employeeId: '', employeeIds: [] }))}
                            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: form.isGroup ? '#0ea5e9' : 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 18, transition: '0.2s' }}>
                            <span style={{ position: 'absolute', height: 12, width: 12, left: form.isGroup ? 17 : 3, top: 2, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {!form.isGroup ? (
                      <>
                      <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} style={INPUT} required>
                        <option value="">— Select employee —</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                        ))}
                      </select>
                      </>
                    ) : (
                      <>
                      <input type="text" value={form.groupName}
                        onChange={e => setForm(f => ({ ...f, groupName: e.target.value }))}
                        placeholder="Group name (e.g. Tbilisi Conference)"
                        style={INPUT} />
                      <div ref={empRef} style={{ position: 'relative' }}>
                        <button type="button" onClick={() => setEmpOpen(v => !v)}
                          style={{ ...INPUT, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' }}>
                          {form.employeeIds.length === 0
                            ? <span style={{ color: 'var(--text-3)' }}>— Select employees —</span>
                            : <span>{form.employeeIds.length} selected</span>
                          }
                          <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {empOpen && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', overflow: 'hidden', marginTop: 4 }}>
                            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-2)' }}>
                              <input autoFocus type="text" placeholder="Search employees…" value={empSearch}
                                onChange={e => setEmpSearch(e.target.value)}
                                style={{ ...INPUT, padding: '7px 10px', fontSize: 12 }} />
                            </div>
                            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                              {employees
                                .filter(emp => {
                                  if (!empSearch) return true;
                                  const full = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                                  return full.includes(empSearch.toLowerCase());
                                })
                                .map(emp => {
                                  const checked = form.employeeIds.includes(emp.id);
                                  return (
                                    <label key={emp.id}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', background: checked ? 'rgba(14,165,233,0.12)' : 'transparent', color: 'var(--text)', fontSize: 13 }}
                                      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--surface-2)'; }}
                                      onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}>
                                      <input type="checkbox" checked={checked}
                                        onChange={() => setForm(f => ({
                                          ...f,
                                          employeeIds: checked
                                            ? f.employeeIds.filter(x => x !== emp.id)
                                            : [...f.employeeIds, emp.id]
                                        }))} />
                                      <span style={{ flex: 1 }}>{emp.first_name} {emp.last_name}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                      </>
                    )}
                  </div>
                </div>

                <ImmediateEffectToggle value={form.immediateEffect} onToggle={v => { const eom = endOfMonth(currentMonthStr()); setForm(f => ({ ...f, immediateEffect: v, fromDate: v ? f.fromDate : eom, toDate: v ? f.toDate : eom })); }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={LABEL}>From *</label>
                    <input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} style={{ ...INPUT, colorScheme: 'dark' }} required />
                  </div>
                  <div>
                    <label style={LABEL}>To *</label>
                    <input type="date" value={form.toDate} min={form.fromDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} style={{ ...INPUT, colorScheme: 'dark' }} required />
                  </div>
                </div>
                {days > 0 && (
                  <div style={{ marginTop: -8, padding: '8px 12px', background: 'rgba(14,165,233,0.1)', borderRadius: 8, fontSize: 13, color: '#0ea5e9', fontWeight: 600 }}>
                    ✈️ {days} day{days !== 1 ? 's' : ''}
                  </div>
                )}

                <div>
                  <label style={LABEL}>Country *</label>
                  <div ref={countryRef} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setCountryOpen(v => !v)}
                      style={{ ...INPUT, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' }}>
                      {form.countryCode
                        ? <><img src={flagUrl(form.countryCode)} alt="" width="20" style={{ borderRadius: 2, flexShrink: 0 }} />{form.countryName}</>
                        : <span style={{ color: 'var(--text-3)' }}>— Select country —</span>
                      }
                      <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {countryOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-2)' }}>
                          <input autoFocus type="text" placeholder="Search country…" value={countrySearch}
                            onChange={e => setCountrySearch(e.target.value)}
                            style={{ ...INPUT, padding: '7px 10px', fontSize: 12 }} />
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {filteredCountries.length === 0
                            ? <div style={{ padding: '12px 14px', color: 'var(--text-3)', fontSize: 13 }}>No countries found</div>
                            : filteredCountries.map(c => (
                              <button key={c.code} type="button" onClick={() => selectCountry(c)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', background: form.countryCode === c.code ? 'rgba(14,165,233,0.12)' : 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                                onMouseEnter={e => { if (form.countryCode !== c.code) e.currentTarget.style.background = 'var(--surface-2)'; }}
                                onMouseLeave={e => { if (form.countryCode !== c.code) e.currentTarget.style.background = 'transparent'; }}>
                                <img src={flagUrl(c.code)} alt="" width="20" style={{ borderRadius: 2, flexShrink: 0 }} />
                                <span style={{ flex: 1 }}>{c.name}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>${c.perDiem}/day</span>
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {form.countryCode && (() => {
                  const countryObj = COUNTRIES.find(c => c.code === form.countryCode);
                  const cities = countryObj?.cities || [];
                  const filteredCities = citySearch ? cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())) : cities;
                  
                  return (
                  <div>
                    <label style={LABEL}>City</label>
                    <div ref={cityRef} style={{ position: 'relative' }}>
                      <input type="text" value={form.cityName} 
                        onChange={e => {
                          const val = e.target.value;
                          setForm(f => {
                            const cPerDiem = countryObj?.perDiem || 0;
                            return { ...f, cityName: val, perDiem: String(cPerDiem), amount: (cPerDiem * calcDays(f.fromDate, f.toDate)).toFixed(2) };
                          });
                          setCitySearch(val);
                          if (!cityOpen) setCityOpen(true);
                        }}
                        onFocus={() => { if (cities.length > 0) setCityOpen(true); setCitySearch(form.cityName); }}
                        placeholder={`City in ${form.countryName}…`} style={INPUT} />
                      {cityOpen && cities.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', overflow: 'hidden', marginTop: 4 }}>
                          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                            {filteredCities.length === 0
                              ? <div style={{ padding: '12px 14px', color: 'var(--text-3)', fontSize: 13 }}>Using custom city</div>
                              : filteredCities.map(c => (
                                <button key={c.name} type="button" onClick={() => selectCity(c)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', background: form.cityName === c.name ? 'rgba(14,165,233,0.12)' : 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                                  onMouseEnter={e => { if (form.cityName !== c.name) e.currentTarget.style.background = 'var(--surface-2)'; }}
                                  onMouseLeave={e => { if (form.cityName !== c.name) e.currentTarget.style.background = 'transparent'; }}>
                                  <span style={{ flex: 1 }}>{c.name}</span>
                                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>${c.perDiem}/day</span>
                                </button>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )})()}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={LABEL}>Per Diem (USD/day)</label>
                    <input type="number" min="0" step="0.01" value={form.perDiem}
                      onChange={e => setForm(f => ({ ...f, perDiem: e.target.value }))}
                      placeholder="Auto-filled by country"
                      style={{ ...INPUT, background: form.countryCode ? 'rgba(14,165,233,0.07)' : INPUT.background }} />
                  </div>
                  <div>
                    <label style={LABEL}>
                      Amount (USD)
                      {autoAmount && !form.amount && <span style={{ fontSize: 11, color: '#0ea5e9', marginLeft: 6 }}>auto: ${autoAmount}</span>}
                    </label>
                    <input type="number" min="0" step="0.01" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder={autoAmount || 'e.g. 325.00'}
                      style={INPUT} />
                  </div>
                </div>

                <div>
                  <label style={LABEL}>Note</label>
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note…" style={INPUT} />
                </div>
              </div>
              <SubTabActions onCancel={close} disabled={(form.isGroup ? form.employeeIds.length === 0 : !form.employeeId) || !form.fromDate || !form.toDate || !form.countryCode} />
            </form>
          )}

          {/* Costs tab */}
          {modalTab === 'costs' && editing && (
            <TripCosts tripId={editing} />
          )}
        </SubTabModal>
      )}
    </div>
  );
}

// ── Advance Payment Tab ───────────────────────────────────────────────────────
function AdvancePaymentTab({ employees, gelRate, eurRate }) {
  const { orders, add, remove } = useLocalOrders('hr_advance_payment_orders');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toUSD = (amount, currency) => {
    const val = parseFloat(amount);
    if (currency === 'GEL' && gelRate) return Math.round((val / gelRate) * 100) / 100;
    if (currency === 'EUR' && eurRate) return Math.round((val / eurRate) * 100) / 100;
    return val;
  };

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const EMPTY = {
    employeeId: '',
    currency: 'GEL',
    mode: 'automatic',
    totalAmount: '',
    numMonths: 1,
    startMonth: thisMonth,
    manualSlots: Array.from({ length: 1 }, () => ({ amount: '' })),
    immediateEffect: true,
  };
  const [form, setForm] = useState(EMPTY);

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const autoInstallment = (() => {
    const total = parseFloat(form.totalAmount);
    if (!total || form.numMonths < 1) return '';
    return (total / form.numMonths).toFixed(2);
  })();

  const manualTotal = form.manualSlots.reduce((s, sl) => s + (parseFloat(sl.amount) || 0), 0);

  const getMonthLabel = (startMonth, offset) => {
    const [y, m] = startMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const handleNumMonths = (n) => {
    const count = Math.max(1, Math.min(12, Number(n)));
    setForm(p => ({
      ...p,
      numMonths: count,
      manualSlots: Array.from({ length: count }, (_, i) => ({ amount: p.manualSlots[i]?.amount || '' })),
    }));
  };

  const updateSlot = (i, val) => {
    setForm(p => {
      const slots = [...p.manualSlots];
      slots[i] = { amount: val };
      return { ...p, manualSlots: slots };
    });
  };

  const canSave = form.employeeId && (
    form.mode === 'automatic'
      ? parseFloat(form.totalAmount) > 0
      : form.manualSlots.some(s => parseFloat(s.amount) > 0)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const emp = employees.find(x => String(x.id) === String(form.employeeId));
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : '';
    const schedule = Array.from({ length: form.numMonths }, (_, i) => ({
      month: (() => {
        const [y, m] = form.startMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })(),
      amount: form.mode === 'automatic'
        ? parseFloat(autoInstallment)
        : parseFloat(form.manualSlots[i]?.amount) || 0,
    }));
    const total = form.mode === 'automatic' ? parseFloat(form.totalAmount) : manualTotal;

    try {
      await Promise.all(schedule.map(({ month, amount }) => {
        if (!amount) return Promise.resolve();
        const [y, m] = month.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const date = `${month}-${String(lastDay).padStart(2, '0')}`;
        return api.post(`/employees/${form.employeeId}/units`, {
          type: 'Advance',
          amount: toUSD(amount, form.currency),
          date,
          currency: 'USD',
          include_in_salary: true,
        });
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create salary deductions.');
      setSaving(false);
      return;
    }

    add({ employeeId: form.employeeId, empName, currency: form.currency, mode: form.mode, total, schedule });
    setShowForm(false);
    setForm(EMPTY);
    setSaving(false);
  };

  const CURR_SYMBOLS = { GEL: '₾', USD: '$', EUR: '€' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => { setForm(EMPTY); setShowForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add New Order
        </button>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? (
          <EmptyState label="Advance Payment" onAdd={() => { setForm(EMPTY); setShowForm(true); }} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Date', 'Employee', 'Total', 'Currency', 'Mode', 'Months', 'Schedule', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border-2)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)' }}>{o.empName}</td>
                  <td style={{ padding: '11px 14px', color: '#4ade80', fontWeight: 600 }}>{CURR_SYMBOLS[o.currency]}{Number(o.total).toFixed(2)}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.currency}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: o.mode === 'automatic' ? 'rgba(59,130,246,0.12)' : 'rgba(139,92,246,0.12)', color: o.mode === 'automatic' ? '#60a5fa' : '#a78bfa' }}>
                      {o.mode === 'automatic' ? 'Auto' : 'Manual'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)' }}>{o.schedule?.length || 0}</td>
                  <td style={{ padding: '11px 14px', maxWidth: 260 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(o.schedule || []).map((s, i) => (
                        <span key={i} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>
                          {s.month} · {CURR_SYMBOLS[o.currency]}{Number(s.amount).toFixed(0)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => { if (window.confirm('Delete this advance payment?')) remove(o.id); }}
                      style={{ ...actionBtn, color: '#f87171' }} title="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <SubTabModal title="Advance Payment" onClose={() => { setShowForm(false); setError(''); }}>
          <form onSubmit={handleSubmit}>

            {/* Employee */}
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>Employee</label>
              <select value={form.employeeId} onChange={e => setField('employeeId', e.target.value)} style={INPUT} required>
                <option value="">Select employee…</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>

            {/* Currency */}
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>Currency</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {CURRENCIES.map(c => (
                  <button key={c.code} type="button"
                    onClick={() => setField('currency', c.code)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `2px solid ${form.currency === c.code ? c.color : 'var(--border-2)'}`, background: form.currency === c.code ? `${c.color}22` : 'var(--surface-2)', color: form.currency === c.code ? c.color : 'var(--text-3)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {c.symbol} {c.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode toggle */}
            <div style={{ marginBottom: 18 }}>
              <label style={LABEL}>Schedule Mode</label>
              <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 9, padding: 3, gap: 3 }}>
                {['automatic', 'manual'].map(m => (
                  <button key={m} type="button" onClick={() => setField('mode', m)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', background: form.mode === m ? 'var(--surface)' : 'transparent', color: form.mode === m ? 'var(--text)' : 'var(--text-3)', boxShadow: form.mode === m ? '0 1px 4px rgba(0,0,0,0.12)' : 'none' }}>
                    {m === 'automatic' ? 'Automatic' : 'Manual'}
                  </button>
                ))}
              </div>
            </div>

            {/* Immediate Effect toggle */}
            <ImmediateEffectToggle value={form.immediateEffect} onToggle={v => setForm(p => ({ ...p, immediateEffect: v, startMonth: v ? p.startMonth : currentMonthStr() }))} />

            {/* Start month + num months (both modes) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={LABEL}>Start Month</label>
                <input type="month" value={form.startMonth} onChange={e => setField('startMonth', e.target.value)} style={{ ...INPUT, colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={LABEL}>Number of Months (max 12)</label>
                <input type="number" min={1} max={12} value={form.numMonths}
                  onChange={e => handleNumMonths(e.target.value)} style={INPUT} />
              </div>
            </div>

            {/* AUTOMATIC mode */}
            {form.mode === 'automatic' && (
              <div style={{ marginBottom: 16 }}>
                <label style={LABEL}>Total Amount</label>
                <input type="number" min={0} step="0.01" value={form.totalAmount}
                  onChange={e => setField('totalAmount', e.target.value)}
                  placeholder="e.g. 4000" style={INPUT} />
                {autoInstallment && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontWeight: 600 }}>PAYMENT SCHEDULE</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: form.numMonths }, (_, i) => (
                        <div key={i} style={{ padding: '5px 12px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 12, color: 'var(--text-2)' }}>
                          {getMonthLabel(form.startMonth, i)} · <strong style={{ color: 'var(--text)' }}>{CURR_SYMBOLS[form.currency]}{autoInstallment}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
                      Total: <strong style={{ color: '#4ade80' }}>{CURR_SYMBOLS[form.currency]}{parseFloat(form.totalAmount).toFixed(2)}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MANUAL mode */}
            {form.mode === 'manual' && (
              <div style={{ marginBottom: 16 }}>
                <label style={LABEL}>Monthly Amounts</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.manualSlots.map((slot, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)', width: 80, flexShrink: 0 }}>{getMonthLabel(form.startMonth, i)}</span>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 13 }}>{CURR_SYMBOLS[form.currency]}</span>
                        <input type="number" min={0} step="0.01" value={slot.amount}
                          onChange={e => updateSlot(i, e.target.value)}
                          placeholder="0.00"
                          style={{ ...INPUT, paddingLeft: 28 }} />
                      </div>
                    </div>
                  ))}
                </div>
                {manualTotal > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
                    Total: <strong style={{ color: '#4ade80' }}>{CURR_SYMBOLS[form.currency]}{manualTotal.toFixed(2)}</strong>
                  </div>
                )}
              </div>
            )}

            {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8, marginBottom: 0 }}>{error}</p>}
            <SubTabActions onCancel={() => { setShowForm(false); setError(''); }} saving={saving} disabled={!canSave} />
          </form>
        </SubTabModal>
      )}
    </div>
  );
}

// ── Handover Tab ──────────────────────────────────────────────────────────────
function HandoverTab({ employees }) {
  const { t } = useLanguage();
  const { orders, add, update, remove } = useLocalOrders('hr_handover_orders');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const EMPTY = { fromEmployeeId: '', toEmployeeId: '', handoverDate: '', items: '', notes: '', immediateEffect: true };
  const [form, setForm] = useState(EMPTY);
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (o) => {
    setEditing(o.id);
    setForm({ fromEmployeeId: o.fromEmployeeId, toEmployeeId: o.toEmployeeId, handoverDate: o.handoverDate, items: o.items || '', notes: o.notes || '', immediateEffect: o.immediateEffect !== false });
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditing(null); };

  const getName = (id) => { const e = employees.find(x => x.id === id); return e ? `${e.first_name} ${e.last_name}` : '—'; };

  const handleSubmit = (e) => {
    e.preventDefault();
    const row = { ...form, fromName: getName(form.fromEmployeeId), toName: getName(form.toEmployeeId) };
    editing ? update(editing, row) : add(row);
    close();
  };

  const canSave = form.fromEmployeeId && form.toEmployeeId && form.fromEmployeeId !== form.toEmployeeId && form.handoverDate;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + {t('orders.addNew')}
        </button>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.length === 0 ? <EmptyState label={t('orders.handover')} onAdd={openAdd} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {[t('orders.date'), t('orders.fromEmployee'), t('orders.toEmployee'), t('orders.handoverDate'), t('orders.handoverItems'), t('orders.notes'), ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border-2)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 14px', color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{o.fromName || getName(o.fromEmployeeId)}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#3b82f6', whiteSpace: 'nowrap' }}>{o.toName || getName(o.toEmployeeId)}</td>
                  <td style={{ padding: '11px 14px', color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>{o.handoverDate}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.items || '—'}</td>
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
        <SubTabModal title={editing ? t('orders.editHandoverOrder') : t('orders.newHandoverOrder')} onClose={close}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><label style={LABEL}>{t('orders.fromEmployee')} *</label>
                <select value={form.fromEmployeeId} onChange={f('fromEmployeeId')} required style={{ ...INPUT, width: '100%' }}>
                  <option value="">{t('orders.selectEmployee')}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div><label style={LABEL}>{t('orders.toEmployee')} *</label>
                <select value={form.toEmployeeId} onChange={f('toEmployeeId')} required style={{ ...INPUT, width: '100%' }}>
                  <option value="">{t('orders.selectEmployee')}</option>
                  {employees.filter(e => e.id !== form.fromEmployeeId).map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <ImmediateEffectToggle value={form.immediateEffect} onToggle={v => setForm(p => ({ ...p, immediateEffect: v, handoverDate: v ? p.handoverDate : endOfMonth(currentMonthStr()) }))} />
              <div><label style={LABEL}>{t('orders.handoverDate')} *</label><input type="date" value={form.handoverDate} onChange={f('handoverDate')} required style={{ ...INPUT, width: '100%' }} /></div>
              <div><label style={LABEL}>{t('orders.handoverItems')}</label><textarea value={form.items} onChange={f('items')} rows={3} placeholder="e.g. Laptop, project documentation, client contacts…" style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} /></div>
              <div><label style={LABEL}>{t('orders.notes')}</label><input value={form.notes} onChange={f('notes')} style={{ ...INPUT, width: '100%' }} /></div>
            </div>
            <SubTabActions onCancel={close} disabled={!canSave} />
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
  const { t } = useLanguage();
  const ORDER_SUBTABS = ORDER_SUBTAB_KEYS.map(s => ({ ...s, label: t(s.labelKey) }));
  const [subTab, setSubTab] = useState('hiring');
  const [loadingSubTab, setLoadingSubTab] = useState(null);
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

  const EMPTY_FORM = { employeeId: '', type: 'OT', amount: '', otRate: '110', otHours: '', currency: 'USD', includeInSalary: true, date: '', immediateEffect: true };
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingUnit, setEditingUnit] = useState(null);

  const perms = useOrdersPermissions();
  const canCreateAdjusting = perms.create_adjusting === 'Yes';

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

  // ── Demo seed (giorgi@powerbi.ge only, runs once) ────────────
  useEffect(() => {
    if (user?.email !== 'giorgi@powerbi.ge') return;
    if (localStorage.getItem('hr_demo_seeded')) return;
    if (employees.length === 0) return;

    const get = (i) => employees[i] || employees[0];
    const ts = Date.now();
    const mkId = (i) => ts - i * 100001;
    const mkDate = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().split('T')[0]; };
    const mkCAt = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

    // Hiring
    const hiringData = [
      { firstName: 'Ana', lastName: 'Beridze', personalId: '01234567891', position: 'Accountant', department: 'Finance', startDate: mkDate(10), salary: '2500', salaryCurrency: 'GEL', pitRate: '20', pension: false, immediateEffect: true },
      { firstName: 'Giorgi', lastName: 'Kvaratskhelia', personalId: '01234567892', position: 'Developer', department: 'IT', startDate: mkDate(20), salary: '3500', salaryCurrency: 'GEL', pitRate: '20', pension: true, immediateEffect: true },
      { firstName: 'Nino', lastName: 'Tsiklauri', personalId: '01234567893', position: 'HR Manager', department: 'HR', startDate: mkDate(30), salary: '2800', salaryCurrency: 'GEL', pitRate: '20', pension: true, immediateEffect: true },
      { firstName: 'Levan', lastName: 'Sharabidze', personalId: '01234567894', position: 'Sales Manager', department: 'Sales', startDate: mkDate(40), salary: '3200', salaryCurrency: 'GEL', pitRate: '20', pension: false, immediateEffect: true },
      { firstName: 'Tamar', lastName: 'Chikvanaia', personalId: '01234567895', position: 'Marketing Specialist', department: 'Marketing', startDate: mkDate(50), salary: '2200', salaryCurrency: 'GEL', pitRate: '20', pension: true, immediateEffect: true },
    ].map((d, i) => ({ id: mkId(i), createdAt: mkCAt(i * 5), ...d }));
    localStorage.setItem('hr_hiring_orders', JSON.stringify(hiringData));

    // Firing
    const firingData = [0,1,2,3,4].map((i) => {
      const emp = get(i);
      return { id: mkId(i + 10), createdAt: mkCAt(i * 4), employeeId: emp.id, empName: `${emp.first_name} ${emp.last_name}`, position: emp.position || 'Employee', terminationDate: mkDate(i * 5 + 2), reason: ['Resignation', 'End of contract', 'Mutual agreement', 'Restructuring', 'Performance'][i], notes: '', immediateEffect: true };
    });
    localStorage.setItem('hr_firing_orders', JSON.stringify(firingData));

    // Promotion
    const newPositions = ['Senior Developer', 'Team Lead', 'Project Manager', 'Senior Accountant', 'Chief Marketing Officer'];
    const newSalaries = ['4500', '5000', '6000', '3800', '4200'];
    const promotionData = [0,1,2,3,4].map((i) => {
      const emp = get(i);
      return { id: mkId(i + 20), createdAt: mkCAt(i * 3), employeeId: emp.id, empName: `${emp.first_name} ${emp.last_name}`, oldPosition: emp.position || 'Junior', newPosition: newPositions[i], oldSalary: emp.salary ? String(emp.salary) : '2000', newSalary: newSalaries[i], effectiveDate: mkDate(i * 7), notes: 'Performance-based promotion', immediateEffect: true };
    });
    localStorage.setItem('hr_promotion_orders', JSON.stringify(promotionData));

    // Business Trip
    const trips = [
      { countryCode: 'DE', countryName: 'Germany', cityName: 'Berlin', perDiem: '95' },
      { countryCode: 'FR', countryName: 'France', cityName: 'Paris', perDiem: '120' },
      { countryCode: 'TR', countryName: 'Turkey', cityName: 'Istanbul', perDiem: '65' },
      { countryCode: 'PL', countryName: 'Poland', cityName: 'Warsaw', perDiem: '70' },
      { countryCode: 'AE', countryName: 'UAE', cityName: 'Dubai', perDiem: '130' },
    ];
    const tripData = [0,1,2,3,4].map((i) => {
      const emp = get(i); const c = trips[i];
      const fromDate = mkDate(40 - i * 5); const toDate = mkDate(35 - i * 5);
      return { id: mkId(i + 30), createdAt: mkCAt(i * 6), employeeId: emp.id, empName: `${emp.first_name} ${emp.last_name}`, fromDate, toDate, days: 5, countryCode: c.countryCode, countryName: c.countryName, cityName: c.cityName, perDiem: c.perDiem, amount: String(parseFloat(c.perDiem) * 5), immediateEffect: true };
    });
    localStorage.setItem('hr_business_trip_orders', JSON.stringify(tripData));

    // Advance Payment
    const advCurrencies = ['GEL', 'USD', 'GEL', 'USD', 'GEL'];
    const advTotals = [3000, 2000, 4000, 1500, 2500];
    const [cy, cm] = currentMonth.split('-').map(Number);
    const nextM = new Date(cy, cm, 1); const nextMonthStr = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}`;
    const advanceData = [0,1,2,3,4].map((i) => {
      const emp = get(i); const total = advTotals[i];
      return { id: mkId(i + 40), createdAt: mkCAt(i * 2), employeeId: emp.id, empName: `${emp.first_name} ${emp.last_name}`, currency: advCurrencies[i], mode: 'automatic', total, schedule: [{ month: currentMonth, amount: total / 2 }, { month: nextMonthStr, amount: total / 2 }], immediateEffect: true };
    });
    localStorage.setItem('hr_advance_payment_orders', JSON.stringify(advanceData));

    // Adjusting — real API calls
    const adjTypes = ['OT', 'OT', 'OT', 'OT', 'OT'];
    const adjAmounts = [250, 180, 320, 150, 210];
    [0,1,2,3,4].forEach((i) => {
      const emp = get(i);
      api.post(`/employees/${emp.id}/units`, { type: adjTypes[i], amount: adjAmounts[i], date: mkDate(i * 3), currency: 'USD', include_in_salary: true }).catch(() => {});
    });

    localStorage.setItem('hr_demo_seeded', 'true');
  }, [user?.email, employees]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const wdays = getWorkingDays(empId) || 22;
    const salary = getEmpSalary(empId);
    if (!salary || !hours || !rate) return '';
    const hr = salary / (wdays * 8);
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
        date: form.date || monthLastDay,
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
          due_date: form.date || monthLastDay,
          description: `${form.type} — ${empName}`,
          status: 'normal',
        });
      }

      setShowForm(false);
      setForm({ ...EMPTY_FORM, date: monthLastDay, otRate: overtimeRates[0] ? String(overtimeRates[0].rate) : '110' });
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
      date: u.date ? u.date.slice(0, 10) : monthLastDay,
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
      if (form.employeeId !== editingUnit.employeeId) {
        // Employee changed — delete old unit, create new one under correct employee
        await api.delete(`/employees/${editingUnit.employeeId}/units/${editingUnit.id}`);
        await api.post(`/employees/${form.employeeId}/units`, {
          type: form.type,
          amount: amountUSD,
          date: form.date || monthLastDay,
          currency: 'USD',
          include_in_salary: form.includeInSalary,
        });
      } else {
        await api.put(`/employees/${form.employeeId}/units/${editingUnit.id}`, {
          type: form.type,
          amount: amountUSD,
          currency: 'USD',
          include_in_salary: form.includeInSalary,
        });
      }
      setShowForm(false);
      setForm({ ...EMPTY_FORM, date: monthLastDay, otRate: overtimeRates[0] ? String(overtimeRates[0].rate) : '110' });
      setEditingUnit(null);
      loadSalaries(month);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update order.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = (u) => {
    setEditingUnit(null);
    setForm({
      employeeId: u.employee?.id || '',
      type: u.type,
      amount: String(u.amount),
      otRate: '',
      otHours: '',
      currency: 'USD',
      includeInSalary: u.include_in_salary !== false,
      date: monthLastDay,
    });
    setError('');
    setShowForm(true);
  };

  const handleDelete = async (employeeId, unitId) => {
    if (!window.confirm(t('orders.removeConfirm'))) return;
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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{t('orders.title')}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            {t('orders.subtitle')} · {monthLabel}
          </p>
        </div>
        {subTab === 'adjusting' && canCreateAdjusting && <button
          onClick={() => { setForm(f => ({ ...EMPTY_FORM, date: monthLastDay, otRate: overtimeRates[0] ? String(overtimeRates[0].rate) : '110' })); setShowForm(true); setError(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 20px', borderRadius: 9, border: 'none',
            background: '#16a34a', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('orders.addNew')}
        </button>}
      </div>

      {/* Subtabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {ORDER_SUBTABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.key === subTab) return;
              setLoadingSubTab(tab.key);
              setTimeout(() => setLoadingSubTab(null), 220);
              setSubTab(tab.key);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '7px 18px', border: 'none', borderRadius: 7,
              fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              background: subTab === tab.key ? 'var(--surface)' : 'transparent',
              color: subTab === tab.key ? 'var(--text)' : 'var(--text-3)',
              boxShadow: subTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
            {loadingSubTab === tab.key && <span className="fp-spinner fp-spinner-sm" />}
          </button>
        ))}
      </div>

      {/* Non-adjusting tabs */}
      <div key={subTab} className="fp-subtab-enter">
        {subTab === 'promotion'        && <PromotionTab employees={employees} />}
        {subTab === 'hiring'           && <HiringTab />}
        {subTab === 'firing'           && <FiringTab employees={employees} />}
        {subTab === 'business-trip'    && <BusinessTripTab employees={employees} />}
        {subTab === 'advance-payment'  && <AdvancePaymentTab employees={employees} gelRate={gelRate} eurRate={eurRate} />}
        {subTab === 'handover'         && <HandoverTab employees={employees} />}
      </div>

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
            <strong style={{ color: 'var(--text)' }}>{allUnits.length}</strong> {t('orders.orders')}
          </div>
          {totalAdditions > 0 && (
            <div style={{ padding: '8px 16px', borderRadius: 20, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', fontSize: 13, color: '#4ade80' }}>
              +{fmt(totalAdditions)} {t('orders.additions')}
            </div>
          )}
          {totalDeductions > 0 && (
            <div style={{ padding: '8px 16px', borderRadius: 20, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', fontSize: 13, color: '#f87171' }}>
              -{fmt(totalDeductions)} {t('orders.deductions')}
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
            placeholder={t('orders.searchEmployee')}
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
          <option value="">{t('orders.allTypes')}</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(filterEmp || filterType) && (
          <button onClick={() => { setFilterEmp(''); setFilterType(''); }}
            style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>
            {t('orders.clear')}
          </button>
        )}
      </div>

      {/* Orders list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '56px 0', fontSize: 13 }}>{t('orders.loading')}</div>
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
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15, marginBottom: 6 }}>{t('orders.noOrders', { month: monthLabel })}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>{t('orders.noOrdersHint')}</div>
            <button
              onClick={() => { setForm(f => ({ ...EMPTY_FORM, date: monthLastDay, otRate: overtimeRates[0] ? String(overtimeRates[0].rate) : '110' })); setShowForm(true); setError(''); }}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              + {t('orders.addNew')}
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {[[t('orders.employee'), false], [t('orders.type'), false], [t('orders.direction'), false], [t('orders.amount'), true], [t('orders.date'), true], [t('orders.created'), true], [t('orders.modified'), true], ['', true], ['', true]].map(([h, right], i) => (
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
                        {t('orders.notInSalary')}
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
                    {u.direction === 'addition' ? t('orders.addition') : t('orders.deduction')}
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
                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicate(u)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                        title="Duplicate"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
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
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditingUnit(null); setForm({ ...EMPTY_FORM, date: monthLastDay, otRate: overtimeRates[0] ? String(overtimeRates[0].rate) : '110' }); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-2)', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{editingUnit ? t('orders.editOrder') : t('orders.newOrder')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{monthLabel}</div>
              </div>
              <button onClick={() => { setShowForm(false); setEditingUnit(null); setForm({ ...EMPTY_FORM, date: monthLastDay, otRate: overtimeRates[0] ? String(overtimeRates[0].rate) : '110' }); }} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
                  <label style={LABEL}>{t('orders.employee')} *</label>
                  <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} required style={INPUT}>
                    <option value="">{t('orders.selectEmployee')}</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>{t('orders.orderType')}</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value, amount: '', otHours: '' }))} required style={INPUT}>
                    <option value="OT">OT — Overtime (+)</option>
                    {unitTypes.map(ut => (
                      <option key={ut.id} value={ut.name}>{ut.name} ({ut.direction === 'addition' ? '+' : '−'})</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, marginTop: 5, color: getDirection(form.type) === 'addition' ? '#4ade80' : '#f87171' }}>
                    {getDirection(form.type) === 'addition' ? t('orders.addedToNet') : t('orders.deductedFromNet')}
                  </div>
                </div>

                {/* Immediate Effect toggle */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ImmediateEffectToggle value={form.immediateEffect} onToggle={v => setForm(p => ({ ...p, immediateEffect: v, date: v ? p.date : monthLastDay }))} />
                </div>

                {/* Date */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Date</label>
                  <input
                    type="date"
                    value={form.date || monthLastDay}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    style={INPUT}
                  />
                </div>

                {/* OT extras */}
                {isOT && (
                  <>
                    <div>
                      <label style={LABEL}>{t('orders.otRate')}</label>
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
                      <label style={LABEL}>{t('orders.otHours')}</label>
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
                    {t('orders.amount')} *
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('orders.includeInSalary')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {form.includeInSalary ? t('orders.willAffect') : t('orders.willNotAffect')}
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
                  {t('orders.cancel')}
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
                      {t('orders.saving')}
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {editingUnit ? t('orders.updateOrder') : t('orders.save')}
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
