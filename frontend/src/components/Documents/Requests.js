import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useExcelTable, ExcelFilterDropdown, ColumnVisibilityMenu, PaginationBar } from '../common/ExcelTable';
import TableSkeleton from '../common/TableSkeleton';

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
    return true;
  }), [requests, statusFilter]);

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

  const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const REQUEST_COLUMNS = [
    { key: 'date', label: t('req.colDate'), getValue: r => formatDate(r.created_at), getSortValue: r => r.created_at || '' },
    { key: 'title', label: t('req.colTitle'), getValue: r => r.title || '—' },
    { key: 'type', label: t('req.colType'), getValue: r => r.type || '—' },
    { key: 'requester', label: t('req.colRequester'), getValue: r => r.requester_email || '—' },
    { key: 'priority', label: t('req.colPriority'), getValue: r => t(PRIORITY_CONFIG[r.priority]?.labelKey || PRIORITY_CONFIG.medium.labelKey) },
    { key: 'status', label: t('req.colStatus'), getValue: r => t(STATUS_CONFIG[r.status]?.labelKey || STATUS_CONFIG.pending.labelKey) },
  ];
  const table = useExcelTable({ storageKey: 'requests_list', columns: REQUEST_COLUMNS, rows: filtered });

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
        <ColumnVisibilityMenu table={table} t={t} />
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
          <TableSkeleton
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            }
            color="#ec4899"
            label="Loading…"
            cols={[
              { width: '13%' }, { width: '24%' }, { width: '15%' }, { width: '20%' },
              { width: '13%' }, { width: '15%' },
            ]}
          />
        ) : filtered.length === 0 ? (
          <div className="acc-empty">
            <p>{requests.length === 0 ? t('req.emptyNoRequests') : t('req.emptyNoFilter')}</p>
          </div>
        ) : (
          <>
          <table className="acc-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              {table.displayCols.map((key) => <col key={key} style={{ width: key === 'title' ? '22%' : key === 'requester' ? '20%' : key === 'type' ? 150 : key === 'date' ? 110 : 100 }} />)}
              <col style={{ width: 72 }} />
            </colgroup>
            <thead>
              <tr>
                {table.displayCols.map((key) => {
                  const col = table.colByKey[key];
                  return (
                    <th key={key} style={{ position: 'relative' }}>
                      <span onClick={() => table.toggleSort(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        {col.label}
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ opacity: table.sortKey === key ? 1 : 0.25, transform: table.sortKey === key && table.sortDir === 'desc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </span>
                      <button
                        onClick={e => table.openColumnFilterDropdown(e, key)}
                        title={t('table.filterTooltip')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, padding: 0,
                          marginLeft: 4, border: 'none', borderRadius: 4, cursor: 'pointer', verticalAlign: 'middle',
                          background: table.openFilterCol === key ? 'var(--surface-2)' : 'transparent',
                          color: table.columnFilters[key] ? '#479c73' : 'var(--text-4)',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill={table.columnFilters[key] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4"/>
                        </svg>
                      </button>
                      {table.openFilterCol === key && table.filterDropdownPos && (
                        <ExcelFilterDropdown
                          dropdownRef={table.filterDropdownRef}
                          pos={table.filterDropdownPos}
                          options={table.getColumnFilterOptions(key)}
                          selected={table.columnFilters[key]}
                          search={table.filterSearch}
                          onSearchChange={table.setFilterSearch}
                          onToggleValue={(value) => {
                            const opts = table.getColumnFilterOptions(key);
                            const activeSet = table.columnFilters[key] ?? new Set(opts);
                            table.setColumnFilterValues(key, opts, [value], !activeSet.has(value));
                          }}
                          onToggleAll={(visible, checked) => table.setColumnFilterValues(key, table.getColumnFilterOptions(key), visible, checked)}
                          onClear={() => table.clearColumnFilter(key)}
                          t={t}
                        />
                      )}
                    </th>
                  );
                })}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {table.hasActiveFilters && table.sortedRows.length === 0 && (
                <tr>
                  <td colSpan={table.displayCols.length + 1} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 13 }}>
                    {t('table.noFilterMatches')}
                    <div>
                      <button
                        onClick={table.clearAllColumnFilters}
                        style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {t('table.clear')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {table.pagedRows.map(r => (
                <tr key={r.id}>
                  {table.displayCols.includes('date') && <td style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</td>}
                  {table.displayCols.includes('title') && <td style={{ fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={r.title}>{r.title}</td>}
                  {table.displayCols.includes('type') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 13, color: 'var(--text-2)' }}>{r.type}</td>}
                  {table.displayCols.includes('requester') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 12, color: 'var(--text-3)' }} title={r.requester_email}>{r.requester_email || '—'}</td>}
                  {table.displayCols.includes('priority') && <td><PriorityDot priority={r.priority} /></td>}
                  {table.displayCols.includes('status') && <td><StatusBadge status={r.status} /></td>}
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
          <PaginationBar table={table} t={t} />
          </>
        )}
      </div>

      {/* Modal */}
      {showForm && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}

export default Requests;
