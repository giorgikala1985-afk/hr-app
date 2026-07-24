import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import { useLanguage } from '../../contexts/LanguageContext';
import ProjectInvoices from './ProjectInvoices';

const DEFAULT_WIDTHS = [170, 130, 130, 110, 120, 105, 105, 80];

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconDelete() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

const EMPTY = { name: '', client: '', owner: '', status: 'Active', budget: '', currency: 'GEL', start_date: '', end_date: '', description: '' };
const STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled'];
const STATUS_COLORS = {
  Active:    { bg: 'rgba(71,156,115,0.12)',  color: '#479c73' },
  'On Hold': { bg: 'rgba(234,179,8,0.12)',  color: '#b45309' },
  Completed: { bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8' },
  Cancelled: { bg: 'rgba(220,38,38,0.12)',  color: '#dc2626' },
};

function Projects() {
  const { t } = useLanguage();
  const [mainTab, setMainTab] = useState('projects');
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => { load(); loadAgents(); loadUsers(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/projects');
      setRecords(res.data.records || []);
    } catch { setError(t('projects.failedLoad')); }
    finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/accounting/agents');
      setAgents(res.data.records || []);
    } catch { /* non-critical */ }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch { /* non-critical */ }
  };

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = (r) => {
    setForm({
      name: r.name, client: r.client || '', owner: r.owner || '', status: r.status || 'Active',
      budget: r.budget ?? '', currency: r.currency || 'GEL',
      start_date: r.start_date || '', end_date: r.end_date || '', description: r.description || '',
    });
    setEditId(r.id); setShowForm(true); setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('projects.validationError')); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/projects/${editId}`, form);
      else await api.post('/accounting/projects', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('projects.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('projects.deleteConfirm'))) return;
    try { await api.delete(`/accounting/projects/${id}`); load(); }
    catch { setError(t('projects.failedDelete')); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length && records.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(records.map(r => r.id)));
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(t('projects.deleteSelectedConfirm').replace('{count}', selectedIds.size))) return;
    try {
      await api.delete('/accounting/projects/bulk', { data: { ids: Array.from(selectedIds) } });
      setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch { setError(t('projects.failedDeleteSelected')); }
  };

  const activeCount = records.filter(r => r.status === 'Active').length;
  const totalBudget = records.reduce((s, r) => s + (parseFloat(r.budget) || 0), 0);

  return (
    <>
      <h2>{t('projects.title')}</h2>
      <p className="acc-subtitle">{t('projects.subtitle')}</p>

      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {[
          { key: 'projects', label: t('projects.tabProjects') },
          { key: 'invoices', label: t('projects.tabInvoices') },
        ].map(tab => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)} style={{
            padding: '7px 16px', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: mainTab === tab.key ? 'var(--surface)' : 'transparent',
            color: mainTab === tab.key ? 'var(--text)' : 'var(--text-3)',
            boxShadow: mainTab === tab.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
            transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {mainTab === 'invoices' && <ProjectInvoices projects={records} />}

      {mainTab === 'projects' && <>
      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('projects.totalProjects')}</span>
          <span className="acc-summary-value">{records.length}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('projects.activeProjects')}</span>
          <span className="acc-summary-value green">{activeCount}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('projects.totalBudget')}</span>
          <span className="acc-summary-value">{totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="acc-header-row">
        <div />
        <button className="btn-add" onClick={openNew}>{t('projects.addProject')}</button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, fontWeight: 500, color: '#555' }}>
          <span>{t('projects.selectedCount').replace('{count}', selectedIds.size)}</span>
          <button
            onClick={handleBulkDelete}
            style={{ background: '#e53935', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <IconDelete /> {t('projects.deleteSelected')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ background: '#f5f5f5', color: '#666', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('projects.clear')}
          </button>
        </div>
      )}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>{t('projects.loading')}</p></div> : records.length === 0 ? (
          <div className="acc-empty"><div className="acc-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg></div><p>{t('projects.noProjects')}</p></div>
        ) : (
          <table className="acc-table">
            <colgroup>
              <col style={{ width: 40 }} />
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead><tr>
              <th style={{ width: 40, textAlign: 'center', verticalAlign: 'middle' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === records.length && records.length > 0}
                  onChange={toggleSelectAll}
                  title={t('projects.selectAll')}
                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                />
              </th>
              <th style={{ position: 'relative', width: colWidths[0], whiteSpace: 'nowrap' }}>{t('projects.colName')}<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[1], whiteSpace: 'nowrap' }}>{t('projects.colClient')}<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[2], whiteSpace: 'nowrap' }}>{t('projects.colOwner')}<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[3], whiteSpace: 'nowrap' }}>{t('projects.colStatus')}<div onMouseDown={e => onResizeMouseDown(e, 3)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[4], whiteSpace: 'nowrap' }}>{t('projects.colBudget')}<div onMouseDown={e => onResizeMouseDown(e, 4)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[5], whiteSpace: 'nowrap' }}>{t('projects.colStart')}<div onMouseDown={e => onResizeMouseDown(e, 5)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[6], whiteSpace: 'nowrap' }}>{t('projects.colEnd')}<div onMouseDown={e => onResizeMouseDown(e, 6)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[7], whiteSpace: 'nowrap' }}><div onMouseDown={e => onResizeMouseDown(e, 7)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
            </tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={selectedIds.has(r.id) ? { background: '#f0f9ff' } : {}}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.name}</strong></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.client || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.owner || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, ...(STATUS_COLORS[r.status] || STATUS_COLORS.Active) }}>
                      {r.status || 'Active'}
                    </span>
                  </td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {r.budget != null ? `${r.currency || 'GEL'} ${parseFloat(r.budget).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.start_date || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.end_date || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit" style={{ color: '#3b82f6' }}><IconEdit /></button>
                      <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete"><IconDelete /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && createPortal(
        <div className="acc-modal-overlay">
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? t('projects.editProject') : t('projects.newProject')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group full"><label>{t('projects.name')}</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website Redesign" /></div>
              <div className="acc-form-group">
                <label>{t('projects.client')}</label>
                <select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                  <option value="">{t('projects.selectClient')}</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="acc-form-group">
                <label>{t('projects.owner')}</label>
                <select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
                  <option value="">{t('projects.selectOwner')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="acc-form-group"><label>{t('projects.status')}</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="acc-form-group"><label>{t('projects.budget')}</label><input type="number" step="0.01" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0.00" /></div>
              <div className="acc-form-group"><label>{t('projects.currency')}</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option>GEL</option><option>USD</option><option>EUR</option>
                </select>
              </div>
              <div className="acc-form-group"><label>{t('projects.startDate')}</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="acc-form-group"><label>{t('projects.endDate')}</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <div className="acc-form-group full"><label>{t('projects.description')}</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('projects.optionalNotes')} /></div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('projects.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('projects.saving') : t('projects.save')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </>}
    </>
  );
}

export default Projects;
