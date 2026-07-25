import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useKeyedColumnWidths, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import { useLanguage } from '../../contexts/LanguageContext';
import { fmtExcelDate } from '../../utils/formatDate';
import '../Employees/Employees.css';
import '../Options/Options.css';
import { useExcelTable, ExcelFilterDropdown, ColumnVisibilityMenu, PaginationBar } from '../common/ExcelTable';

const TYPES = ['Service', 'Supply', 'NDA', 'Lease', 'Partnership', 'Loan', 'Other'];
const CURRENCIES = ['GEL', 'USD', 'EUR'];
const STATUSES = ['active', 'pending', 'expired', 'terminated'];

const STATUS_COLORS = {
  active:     { bg: 'rgba(71,156,115,0.15)', color: '#479c73', border: '#bbf7d0' },
  pending:    { bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
  expired:    { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' },
  terminated: { bg: '#fee2e2', color: '#dc2626', border: '#fecaca' },
};

const DEFAULT_COL_WIDTHS = {
  title: 220, party_name: 180, type: 120, status: 110, start_date: 120, end_date: 120, amount: 140,
};

const EMPTY = {
  title: '', type: 'Service', party_name: '',
  start_date: '', end_date: '', amount: '',
  currency: 'GEL', status: 'active', notes: '',
};

export default function Agreements() {
  const { t } = useLanguage();
  const { widths: colWidths, onResizeMouseDown } = useKeyedColumnWidths('agreements_col_widths', DEFAULT_COL_WIDTHS);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try { const res = await api.get('/agreements'); setRecords(res.data.agreements || []); }
    catch (err) { setError(err.response?.data?.error || 'Failed to load agreements.'); }
    finally { setLoading(false); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isExpired = (a) => a.end_date && new Date(a.end_date) < new Date() && a.status === 'active';

  const AGREEMENT_COLUMNS = [
    { key: 'title', label: 'Title', getValue: r => r.title || '—' },
    { key: 'party_name', label: 'Party', getValue: r => r.party_name || '—' },
    { key: 'type', label: 'Type', getValue: r => r.type || '—' },
    { key: 'status', label: 'Status', getValue: r => r.status || '—' },
    { key: 'start_date', label: 'Start', getValue: r => formatDate(r.start_date), getSortValue: r => r.start_date || '' },
    { key: 'end_date', label: 'End', getValue: r => formatDate(r.end_date), getSortValue: r => r.end_date || '' },
    {
      key: 'amount', label: 'Amount',
      getValue: r => r.amount != null && r.amount !== '' ? `${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${r.currency || 'GEL'}` : '—',
      getSortValue: r => parseFloat(r.amount) || 0,
    },
  ];
  const table = useExcelTable({ storageKey: 'agreements_list', columns: AGREEMENT_COLUMNS, rows: records });

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === table.sortedRows.length) setSelected(new Set());
    else setSelected(new Set(table.sortedRows.map((r) => r.id)));
  };

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = (a) => {
    setForm({
      title: a.title || '', type: a.type || 'Service', party_name: a.party_name || '',
      start_date: a.start_date || '', end_date: a.end_date || '',
      amount: a.amount ?? '', currency: a.currency || 'GEL',
      status: a.status || 'active', notes: a.notes || '',
    });
    setEditId(a.id); setShowForm(true); setError('');
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.party_name.trim()) { setError('Title and Party are required.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/agreements/${editId}`, form);
      else await api.post('/agreements', form);
      setShowForm(false); setEditId(null); load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save. Try again.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (a) => {
    if (!window.confirm('Delete this agreement?')) return;
    setError(''); setSuccess('');
    try { await api.delete(`/agreements/${a.id}`); load(); }
    catch { setError('Failed to delete.'); }
  };

  const handleBulkDelete = async () => {
    const count = selected.size;
    if (!window.confirm(t('emp.bulkDeleteConfirm', { count }))) return;
    setBulkDeleting(true); setError(''); setSuccess('');
    try {
      for (const id of selected) {
        await api.delete(`/agreements/${id}`);
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
    const today = new Date().toISOString().slice(0, 10);
    const ws = XLSX.utils.aoa_to_sheet([
      ['Title', 'Party', 'Type', 'Status', 'Start', 'End', 'Amount', 'Currency', 'Notes'],
      ...table.sortedRows.map(r => [r.title, r.party_name, r.type, r.status, fmtExcelDate(r.start_date), fmtExcelDate(r.end_date), r.amount, r.currency, r.notes]),
    ]);
    ws['!cols'] = [24, 20, 12, 12, 12, 12, 12, 10, 30].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agreements');
    XLSX.writeFile(wb, `agreements-${today}.xlsx`);
  };

  if (loading && records.length === 0) {
    return <div className="emp-loading">Loading...</div>;
  }

  return (
    <div className="emp-container">
      <div className={`emp-header ${selected.size > 0 ? 'sticky-active' : ''}`}>
        <div>
          <h1>Agreements</h1>
          <p>{records.length} agreement{records.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="emp-header-actions">
          <button
            onClick={exportToExcel}
            disabled={!table.sortedRows.length}
            title="Download as Excel"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 36, boxSizing: 'border-box', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: '#479c73', cursor: table.sortedRows.length ? 'pointer' : 'not-allowed', opacity: table.sortedRows.length ? 1 : 0.5, fontFamily: 'inherit' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel
          </button>
          <ColumnVisibilityMenu table={table} t={t} />
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
            + New Agreement
          </button>
        </div>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h3>No agreements yet</h3>
          <p>Click "New Agreement" to add your first one.</p>
          <button onClick={openNew} className="btn-add">+ New Agreement</button>
        </div>
      ) : (
        <div className="emp-table-wrapper">
          <table className="emp-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: 40 }} />
              {table.displayCols.map((key) => (
                <col key={key} style={{ width: colWidths[key] }} />
              ))}
              <col style={{ width: 64 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={table.sortedRows.length > 0 && selected.size === table.sortedRows.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {table.displayCols.map((key) => {
                  const col = table.colByKey[key];
                  return (
                    <th key={key} style={{ position: 'relative', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <span
                        onClick={() => table.toggleSort(key)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                      >
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
                          background: table.openFilterCol === key ? 'rgba(0,0,0,0.08)' : 'transparent',
                          color: table.columnFilters[key] ? '#479c73' : '#94a3b8',
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
                      <div
                        onMouseDown={(e) => onResizeMouseDown(e, key)}
                        style={RESIZE_HANDLE_STYLE}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#cbd5e1')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      />
                    </th>
                  );
                })}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {table.hasActiveFilters && table.sortedRows.length === 0 && (
                <tr>
                  <td colSpan={table.displayCols.length + 2} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 13 }}>
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
              {table.pagedRows.map((r) => {
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.active;
                return (
                  <tr key={r.id} className={selected.has(r.id) ? 'row-selected' : ''}>
                    <td className="td-checkbox">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                      />
                    </td>
                    {table.displayCols.includes('title') && (
                      <td className="emp-name" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {r.title}
                      </td>
                    )}
                    {table.displayCols.includes('party_name') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#475569' }}>{r.party_name || '—'}</td>}
                    {table.displayCols.includes('type') && <td style={{ color: '#64748b' }}>{r.type || '—'}</td>}
                    {table.displayCols.includes('status') && (
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 5, padding: '2px 7px' }}>{r.status}</span>
                        {isExpired(r) && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 5, padding: '2px 7px' }}>overdue</span>}
                      </td>
                    )}
                    {table.displayCols.includes('start_date') && <td>{formatDate(r.start_date)}</td>}
                    {table.displayCols.includes('end_date') && <td>{formatDate(r.end_date)}</td>}
                    {table.displayCols.includes('amount') && <td className="salary" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono), monospace' }}>{r.amount != null && r.amount !== '' ? `${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${r.currency || 'GEL'}` : '—'}</td>}
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
          <PaginationBar table={table} t={t} />
        </div>
      )}

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={e => e.stopPropagation()}>
            <h3>{editId ? 'Edit Agreement' : 'New Agreement'}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group full"><label>Title *</label><input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Agreement title" /></div>
              <div className="acc-form-group full"><label>Party / Company *</label><input value={form.party_name} onChange={e => setField('party_name', e.target.value)} placeholder="Counterparty name" /></div>
              <div className="acc-form-group"><label>Type</label><select value={form.type} onChange={e => setField('type', e.target.value)}>{TYPES.map(ty => <option key={ty} value={ty}>{ty}</option>)}</select></div>
              <div className="acc-form-group"><label>Status</label><select value={form.status} onChange={e => setField('status', e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
              <div className="acc-form-group"><label>Start Date</label><input type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} /></div>
              <div className="acc-form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} /></div>
              <div className="acc-form-group"><label>Amount</label><input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0.00" /></div>
              <div className="acc-form-group"><label>Currency</label><select value={form.currency} onChange={e => setField('currency', e.target.value)}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="acc-form-group full"><label>Notes</label><textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} placeholder="Additional notes..." style={{ resize: 'vertical' }} /></div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Agreement'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
