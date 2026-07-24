import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useKeyedColumnWidths, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import { useLanguage } from '../../contexts/LanguageContext';
import '../Employees/Employees.css';
import '../Options/Options.css';

// Proportional default widths per column key (table-layout:fixed stretches to fill).
const DEFAULT_COL_WIDTHS = {
  name: 200, contact_name: 160, type: 110, add_date: 130, account_number: 200, address: 230, phone: 150,
};
const AGENT_TYPES = ['LLC', 'IS', 'JSC', 'Other'];
const EMPTY = { name: '', contact_name: '', type: 'LLC', add_date: '', account_number: '', address: '', phone: '' };
const today = () => new Date().toISOString().split('T')[0];

const TYPE_COLORS = {
  LLC:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  IS:    { bg: '#f0fdf4', color: '#479c73', border: '#bbf7d0' },
  JSC:   { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
  Other: { bg: '#f9fafb', color: '#374151', border: '#e5e7eb' },
};

// Data columns (the trailing actions column is rendered separately and always shown).
const COL_KEYS = [
  { labelKey: 'agents.colName',      key: 'name',           hideable: false },
  { labelKey: 'agents.colType',      key: 'type',           hideable: true },
  { labelKey: 'agents.colDateAdded', key: 'add_date',       hideable: true },
  { labelKey: 'agents.colAccount',   key: 'account_number', hideable: true },
  { labelKey: 'agents.colAddress',   key: 'address',        hideable: true },
  { labelKey: 'agents.colContact',   key: 'contact_name',   hideable: true },
  { labelKey: 'agents.colPhone',     key: 'phone',          hideable: true },
];
const ALL_COL_KEYS = COL_KEYS.map(c => c.key);

function Agents() {
  const { t } = useLanguage();
  const COLS = COL_KEYS.map(c => ({ ...c, label: c.labelKey ? t(c.labelKey) : '' }));
  const { widths: colWidths, onResizeMouseDown } = useKeyedColumnWidths('agents_col_widths', DEFAULT_COL_WIDTHS);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('agents_visible_cols');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(ALL_COL_KEYS);
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [paginationSettings, setPaginationSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('pagination_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: false, pageSize: 50 };
  });

  const onPaginationChange = useCallback(() => {
    try {
      const saved = localStorage.getItem('pagination_settings');
      if (saved) setPaginationSettings(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener('pagination-changed', onPaginationChange);
    return () => window.removeEventListener('pagination-changed', onPaginationChange);
  }, [onPaginationChange]);

  const isCol = (key) => visibleCols.has(key);
  const toggleColumn = (key) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('agents_visible_cols', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  useEffect(() => {
    const onClickOutside = (e) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => { setCurrentPage(1); }, [search, paginationSettings]);

  const load = async () => {
    setLoading(true);
    setError('');
    try { const res = await api.get('/accounting/agents'); setRecords(res.data.records || []); }
    catch (err) { setError(err.response?.data?.error || err.message || t('agents.failedLoad')); }
    finally { setLoading(false); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      ['name', 'contact_name', 'type', 'account_number', 'address', 'phone']
        .some(k => (r[k] || '').toLowerCase().includes(q))
    );
  }, [records, search]);

  const usePagination = paginationSettings.enabled && paginationSettings.pageSize !== 'all';
  const pageSize = usePagination ? paginationSettings.pageSize : filtered.length;
  const totalPages = usePagination ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginated = usePagination
    ? filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filtered;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const openNew = () => { setForm({ ...EMPTY, add_date: today() }); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = r => { setForm({ name: r.name || '', contact_name: r.contact_name || '', type: r.type || 'LLC', add_date: r.add_date || '', account_number: r.account_number || '', address: r.address || '', phone: r.phone || '' }); setEditId(r.id); setShowForm(true); setError(''); };

  const handleSave = async () => {
    if (!form.name) { setError(t('agents.nameRequired')); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/agents/${editId}`, form);
      else await api.post('/accounting/agents', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('agents.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(t('agents.deleteConfirm'))) return;
    setError(''); setSuccess('');
    try { await api.delete(`/accounting/agents/${r.id}`); load(); }
    catch { setError(t('agents.failedDelete')); }
  };

  const handleBulkDelete = async () => {
    const count = selected.size;
    if (!window.confirm(t('emp.bulkDeleteConfirm', { count }))) return;
    setBulkDeleting(true); setError(''); setSuccess('');
    try {
      for (const id of selected) {
        await api.delete(`/accounting/agents/${id}`);
      }
      setSuccess(t('emp.bulkDeletedSuccess', { count }));
      setSelected(new Set());
      load();
    } catch {
      setError(t('emp.bulkDeleteFailed'));
      load();
    } finally {
      setBulkDeleting(false);
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Contact Name', 'Type', 'Date Added', 'Account Number', 'Address', 'Phone'],
      ...filtered.map(r => [r.name, r.contact_name, r.type, r.add_date, r.account_number, r.address, r.phone]),
    ]);
    ws['!cols'] = [24, 18, 10, 14, 20, 30, 16].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agents');
    XLSX.writeFile(wb, `agents-${today()}.xlsx`);
  };

  if (loading && records.length === 0) {
    return <div className="emp-loading">{t('agents.loading')}</div>;
  }

  return (
    <div className="emp-container">
      <div className={`emp-header ${selected.size > 0 ? 'sticky-active' : ''}`}>
        <div>
          <h1>{t('agents.title')}</h1>
          <p>{t('agents.subtitle')}</p>
        </div>
        <div className="emp-header-actions">
          <button
            onClick={exportToExcel}
            disabled={!filtered.length}
            title="Download as Excel"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 36, boxSizing: 'border-box', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: '#479c73', cursor: filtered.length ? 'pointer' : 'not-allowed', opacity: filtered.length ? 1 : 0.5, fontFamily: 'inherit' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t('agents.excel')}
          </button>
          <div className="col-toggle-wrapper" ref={colMenuRef}>
            <button
              className="btn-col-toggle"
              onClick={() => setShowColMenu((v) => !v)}
              title={t('action.showHideColumns')}
            >
              {t('emp.columns')}
            </button>
            {showColMenu && (
              <div className="col-toggle-menu">
                {COLS.map((col) => (
                  <label key={col.key} className={`col-toggle-item${!col.hideable ? ' col-locked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      disabled={!col.hideable}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {selected.size > 1 && (
            <button onClick={handleBulkDelete} className="btn-icon btn-delete" disabled={bulkDeleting} title={t('emp.deleteSelected', { count: selected.size })}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              <span style={{ fontSize: 11, marginLeft: 4 }}>{selected.size}</span>
            </button>
          )}
          {selected.size === 1 && (() => {
            const selId = [...selected][0];
            const rec = records.find(r => r.id === selId);
            return (
              <div className="action-btns" style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => rec && openEdit(rec)} className="btn-icon" title={t('action.edit')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => rec && handleDelete(rec)} className="btn-icon btn-delete" title={t('action.delete')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            );
          })()}
          <button className="btn-add" onClick={openNew}>
            + {t('agents.addCoagent')}
          </button>
        </div>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      <form className="search-bar" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          placeholder={t('agents.subtitle')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button type="button" className="btn-clear" onClick={() => setSearch('')}>
            {t('emp.clear')}
          </button>
        )}
      </form>

      {records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
          </div>
          <h3>{t('agents.noAgents')}</h3>
          <p>{t('agents.subtitle')}</p>
          <button onClick={openNew} className="btn-add">
            + {t('agents.addCoagent')}
          </button>
        </div>
      ) : (
        <div className="emp-table-wrapper">
          <table className="emp-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: 40 }} />
              {COLS.filter((c) => isCol(c.key)).map((c) => (
                <col key={c.key} style={{ width: colWidths[c.key] }} />
              ))}
              <col style={{ width: 64 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {COLS.filter((c) => isCol(c.key)).map((c) => (
                  <th key={c.key} style={{ position: 'relative', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {c.label}
                    <div
                      onMouseDown={(e) => onResizeMouseDown(e, c.key)}
                      style={RESIZE_HANDLE_STYLE}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#cbd5e1')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    />
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => {
                const s = TYPE_COLORS[r.type] || TYPE_COLORS.Other;
                return (
                  <tr key={r.id} className={selected.has(r.id) ? 'row-selected' : ''}>
                    <td className="td-checkbox">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                      />
                    </td>
                    {isCol('name') && (
                      <td className="emp-name" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {r.name}
                      </td>
                    )}
                    {isCol('type') && (
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 5, padding: '2px 7px' }}>{r.type}</span>
                      </td>
                    )}
                    {isCol('add_date') && <td>{formatDate(r.add_date)}</td>}
                    {isCol('account_number') && <td className="account-num">{r.account_number || '—'}</td>}
                    {isCol('address') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#64748b' }}>{r.address || '—'}</td>}
                    {isCol('contact_name') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.contact_name || '—'}</td>}
                    {isCol('phone') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.phone || '—'}</td>}
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon" onClick={() => openEdit(r)} title={t('action.edit')} style={{ color: '#3b82f6' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {selected.has(r.id) && (
                          <button className="btn-icon btn-delete" onClick={() => handleDelete(r)} title={t('action.delete')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {usePagination && totalPages > 1 && (
            <div className="pagination-controls">
              <button className="pagination-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>&laquo;</button>
              <button className="pagination-btn" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>&lsaquo;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`dot-${i}`} className="pagination-info">...</span>
                  ) : (
                    <button key={p} className={`pagination-btn ${p === safePage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                  )
                )}
              <button className="pagination-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>&rsaquo;</button>
              <button className="pagination-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>&raquo;</button>
              <span className="pagination-info">{t('emp.total', { count: filtered.length })}</span>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={e => e.stopPropagation()}>
            <h3>{editId ? t('agents.editCoagent') : t('agents.newCoagent')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group full"><label>{t('agents.coagentName')}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Corp" /></div>
              <div className="acc-form-group"><label>{t('agents.type')}</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{AGENT_TYPES.map(ty => <option key={ty}>{ty}</option>)}</select></div>
              <div className="acc-form-group"><label>{t('agents.dateAdded')}</label><input type="date" value={form.add_date} onChange={e => setForm({ ...form, add_date: e.target.value })} /></div>
              <div className="acc-form-group full"><label>{t('agents.accountNumber')}</label><input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} placeholder="e.g. GE00TB0000000000001234" /></div>
              <div className="acc-form-group full"><label>{t('agents.address')}</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="e.g. 123 Main St, Tbilisi" /></div>
              <div className="acc-form-group full"><label>{t('agents.contactName')}</label><input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="e.g. John Doe" /></div>
              <div className="acc-form-group"><label>{t('agents.phone')}</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +995 555 000 000" /></div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('agents.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('agents.saving') : t('agents.saveCoagent')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Agents;
