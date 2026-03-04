import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Documents.css';

const TYPES = ['Service', 'Supply', 'NDA', 'Lease', 'Partnership', 'Loan', 'Other'];
const CURRENCIES = ['GEL', 'USD', 'EUR'];
const STATUSES = ['active', 'pending', 'expired', 'terminated'];

const STATUS_COLORS = {
  active:     { bg: '#dcfce7', color: '#16a34a' },
  pending:    { bg: '#fef9c3', color: '#b45309' },
  expired:    { bg: '#f1f5f9', color: '#64748b' },
  terminated: { bg: '#fee2e2', color: '#dc2626' },
};

const emptyForm = {
  title: '', type: 'Service', party_name: '',
  start_date: '', end_date: '', amount: '',
  currency: 'GEL', status: 'active', notes: ''
};

export default function Agreements() {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/agreements');
      setAgreements(res.data.agreements || []);
    } catch {
      setError('Failed to load agreements.');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = (a) => {
    setForm({
      title: a.title || '', type: a.type || 'Service', party_name: a.party_name || '',
      start_date: a.start_date || '', end_date: a.end_date || '',
      amount: a.amount ?? '', currency: a.currency || 'GEL',
      status: a.status || 'active', notes: a.notes || ''
    });
    setEditId(a.id);
    setShowForm(true);
    setError('');
  };

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.party_name.trim()) {
      setError('Title and Party are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        const res = await api.put(`/agreements/${editId}`, form);
        setAgreements(a => a.map(x => x.id === editId ? res.data.agreement : x));
      } else {
        const res = await api.post('/agreements', form);
        setAgreements(a => [res.data.agreement, ...a]);
      }
      setShowForm(false);
      setEditId(null);
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this agreement?')) return;
    try {
      await api.delete(`/agreements/${id}`);
      setAgreements(a => a.filter(x => x.id !== id));
    } catch {
      alert('Failed to delete.');
    }
  };

  const isExpired = (end_date) => end_date && new Date(end_date) < new Date();

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Agreements</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {agreements.length} agreement{agreements.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="docs-btn-primary" onClick={openAdd}>+ New Agreement</button>
      </div>

      {showForm && (
        <div className="docs-form-panel" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              {editId ? 'Edit Agreement' : 'New Agreement'}
            </h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>×</button>
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="docs-form-grid">
              <div className="docs-field">
                <label className="docs-label">Title *</label>
                <input className="docs-input" name="title" value={form.title} onChange={handleChange} placeholder="Agreement title" />
              </div>
              <div className="docs-field">
                <label className="docs-label">Party / Company *</label>
                <input className="docs-input" name="party_name" value={form.party_name} onChange={handleChange} placeholder="Counterparty name" />
              </div>
              <div className="docs-field">
                <label className="docs-label">Type</label>
                <select className="docs-input" name="type" value={form.type} onChange={handleChange}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="docs-field">
                <label className="docs-label">Status</label>
                <select className="docs-input" name="status" value={form.status} onChange={handleChange}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="docs-field">
                <label className="docs-label">Start Date</label>
                <input className="docs-input" type="date" name="start_date" value={form.start_date} onChange={handleChange} />
              </div>
              <div className="docs-field">
                <label className="docs-label">End Date</label>
                <input className="docs-input" type="date" name="end_date" value={form.end_date} onChange={handleChange} />
              </div>
              <div className="docs-field">
                <label className="docs-label">Amount</label>
                <input className="docs-input" type="number" name="amount" value={form.amount} onChange={handleChange} placeholder="0.00" />
              </div>
              <div className="docs-field">
                <label className="docs-label">Currency</label>
                <select className="docs-input" name="currency" value={form.currency} onChange={handleChange}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="docs-field" style={{ gridColumn: '1 / -1' }}>
                <label className="docs-label">Notes</label>
                <textarea className="docs-input" name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Additional notes..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="docs-btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Agreement'}
              </button>
              <button type="button" className="docs-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', paddingTop: 40 }}>Loading...</p>
      ) : agreements.length === 0 ? (
        <div className="docs-blank">
          <div className="docs-blank-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h3>No agreements yet</h3>
          <p>Click "New Agreement" to add your first one.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agreements.map(a => {
            const sc = STATUS_COLORS[a.status] || STATUS_COLORS.active;
            const expired = isExpired(a.end_date) && a.status === 'active';
            return (
              <div key={a.id} className="docs-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{a.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                      {a.status}
                    </span>
                    {expired && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>
                        overdue
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: 20 }}>{a.type}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569' }}>
                    <span style={{ fontWeight: 500 }}>{a.party_name}</span>
                    {a.amount && <span style={{ marginLeft: 16 }}>{Number(a.amount).toLocaleString()} {a.currency}</span>}
                    {a.start_date && <span style={{ marginLeft: 16, color: '#94a3b8' }}>{a.start_date}{a.end_date ? ` → ${a.end_date}` : ''}</span>}
                  </div>
                  {a.notes && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{a.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="docs-btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => openEdit(a)}>Edit</button>
                  <button className="docs-btn-danger" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => handleDelete(a.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
