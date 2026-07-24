import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const REQUEST_TYPES = [
  'Leave / Time Off',
  'Equipment / Devices',
  'Document Request',
  'IT Support',
  'HR Inquiry',
  'Finance / Expense',
  'Other',
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const STATUS_CONFIG = {
  pending:     { labelKey: 'req.statusPending',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  in_progress: { labelKey: 'req.statusInProgress',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  approved:    { labelKey: 'req.statusApproved',    color: '#479c73', bg: 'rgba(71,156,115,0.12)' },
  rejected:    { labelKey: 'req.statusRejected',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  closed:      { labelKey: 'req.statusClosed',      color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const PRIORITY_CONFIG = {
  low:    { labelKey: 'req.priorityLow',    color: '#479c73' },
  medium: { labelKey: 'req.priorityMedium', color: '#f59e0b' },
  high:   { labelKey: 'req.priorityHigh',   color: '#f97316' },
  urgent: { labelKey: 'req.priorityUrgent', color: '#ef4444' },
};

const EMPTY_FORM = { title: '', type: '', priority: 'medium', description: '' };

function StatusBadge({ status }) {
  const { t } = useLanguage();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg,
    }}>{t(cfg.labelKey)}</span>
  );
}

function PriorityDot({ priority }) {
  const { t } = useLanguage();
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: cfg.color, fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {t(cfg.labelKey)}
    </span>
  );
}

function Requests() {
  const { t } = useLanguage();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/requests');
      setRequests(res.data.requests || []);
    } catch (err) {
      setError('Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchText && !r.title.toLowerCase().includes(searchText.toLowerCase()) &&
        !r.type.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }), [requests, statusFilter, searchText]);

  const counts = useMemo(() => {
    const c = { all: requests.length };
    Object.keys(STATUS_CONFIG).forEach(s => { c[s] = requests.filter(r => r.status === s).length; });
    return c;
  }, [requests]);

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditId(r.id);
    setForm({ title: r.title, type: r.type, priority: r.priority, description: r.description || '' });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.type) { setError('Type is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await api.put(`/requests/${editId}`, form);
        setSuccess('Request updated.');
      } else {
        await api.post('/requests', form);
        setSuccess('Request submitted.');
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save request.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete request "${r.title}"?`)) return;
    setError(''); setSuccess('');
    try {
      await api.delete(`/requests/${r.id}`);
      setSuccess('Request deleted.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>{t('docs.requests')}</h2>
      <p className="acc-subtitle">{t('req.subtitle')}</p>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: t('req.filterAll') },
          ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: t(v.labelKey) })),
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              borderColor: statusFilter === key ? (STATUS_CONFIG[key]?.color || 'var(--text)') : 'var(--border-2)',
              background: statusFilter === key ? (STATUS_CONFIG[key]?.bg || 'var(--surface-2)') : 'var(--surface)',
              color: statusFilter === key ? (STATUS_CONFIG[key]?.color || 'var(--text)') : 'var(--text-3)',
              transition: 'all 0.15s',
            }}
          >
            {label}
            <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.8 }}>({counts[key] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="acc-header-row" style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder={t('req.searchPlaceholder')}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{
            padding: '8px 14px', border: '1.5px solid var(--border-2)', borderRadius: 8,
            fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
            outline: 'none', width: 260,
          }}
        />
        <button className="btn-add" onClick={openNew}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('req.newRequest')}
        </button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="msg-success" style={{ marginBottom: 12 }}>{success}</div>}

      <div className="acc-table-wrapper">
        {loading ? (
          <div className="acc-empty"><p>Loading…</p></div>
        ) : filtered.length === 0 ? (
          <div className="acc-empty">
            <p>{requests.length === 0 ? t('req.emptyNoRequests') : t('req.emptyNoFilter')}</p>
          </div>
        ) : (
          <table className="acc-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: 110 }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: 150 }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 72 }} />
            </colgroup>
            <thead>
              <tr>
                <th>{t('req.colDate')}</th>
                <th>{t('req.colTitle')}</th>
                <th>{t('req.colType')}</th>
                <th>{t('req.colRequester')}</th>
                <th>{t('req.colPriority')}</th>
                <th>{t('req.colStatus')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</td>
                  <td style={{ fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={r.title}>{r.title}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 13, color: 'var(--text-2)' }}>{r.type}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 12, color: 'var(--text-3)' }} title={r.requester_email}>{r.requester_email || '—'}</td>
                  <td><PriorityDot priority={r.priority} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit" style={{ color: '#3b82f6' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="btn-icon btn-delete" onClick={() => handleDelete(r)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" style={{ maxWidth: 520, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700 }}>
              {editId ? t('req.editRequest') : t('req.newRequest')}
            </h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

            <div className="acc-form-grid">
              <div className="acc-form-group full">
                <label>{t('req.formTitle')}</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('req.formTitlePlaceholder')}
                  autoFocus
                />
              </div>

              <div className="acc-form-group">
                <label>{t('req.formType')}</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="">{t('req.formTypeSelect')}</option>
                  {REQUEST_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                </select>
              </div>

              <div className="acc-form-group">
                <label>{t('req.formPriority')}</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>{t(PRIORITY_CONFIG[p].labelKey)}</option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group full">
                <label>{t('req.formDescription')}</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('req.formDescPlaceholder')}
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('req.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('req.saving') : editId ? t('req.update') : t('req.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Requests;
