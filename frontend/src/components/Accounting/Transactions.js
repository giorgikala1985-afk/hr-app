import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useKeyedColumnWidths, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { fmtExcelDate } from '../../utils/formatDate';
import { useExcelTable, ExcelFilterDropdown, ColumnVisibilityMenu, PaginationBar } from '../common/ExcelTable';
import TableSkeleton from '../common/TableSkeleton';

const DEFAULT_COL_WIDTHS = { date: 110, client: 160, item_type: 150, amount: 110, note: 220 };

const TX_EMPTY = { date: '', client: '', item_type: '', amount: '', note: '' };

/* ── SVG icon components ── */
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

function IconExcel() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconClear() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function Transactions() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(TX_EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState([]);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { widths: colWidths, onResizeMouseDown } = useKeyedColumnWidths('tx_col_widths', DEFAULT_COL_WIDTHS);

  const TX_COLUMNS = [
    { key: 'date', label: t('tx.colDate'), getValue: r => r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', getSortValue: r => r.date || '' },
    { key: 'client', label: t('tx.colClient'), getValue: r => r.client || '—' },
    { key: 'item_type', label: t('tx.colItemType'), getValue: r => r.item_type || '—' },
    { key: 'amount', label: t('tx.colAmount'), getValue: r => `$${parseFloat(r.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, getSortValue: r => parseFloat(r.amount) || 0 },
    { key: 'note', label: t('tx.colNote'), getValue: r => r.note || '—' },
  ];

  useEffect(() => { load(); loadAgents(); }, []);

  useEffect(() => {
    if (user?.email !== 'giorgi@powerbi.ge') return;
    if (localStorage.getItem('hr_demo_purchases_seeded')) return;
    const mkDate = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().split('T')[0]; };
    const items = [
      { client: 'Tegeta Motors', item_type: 'Vehicle maintenance', amount: 450, note: 'Fleet service Q2' },
      { client: 'Geocell', item_type: 'Mobile services', amount: 230, note: 'Corporate SIM plan' },
      { client: 'Delta Office', item_type: 'Office supplies', amount: 180, note: 'Stationery & paper' },
      { client: 'TBC Bank', item_type: 'Banking fees', amount: 95, note: 'Monthly service charge' },
      { client: 'Biliki', item_type: 'Catering', amount: 320, note: 'Staff lunch July' },
      { client: 'Cartu Group', item_type: 'IT services', amount: 1200, note: 'Network setup' },
      { client: 'Georgian Post', item_type: 'Courier', amount: 45, note: 'Document delivery' },
      { client: 'Tbilisi Water', item_type: 'Utilities', amount: 85, note: 'Water bill June' },
      { client: 'PSPC', item_type: 'Security', amount: 560, note: 'Office security system' },
      { client: 'Amazon Web Services', item_type: 'Cloud hosting', amount: 340, note: 'Server costs' },
    ];
    items.forEach((item, i) => {
      api.post('/accounting/transactions', { ...item, date: mkDate(i * 6 + 1) }).catch(() => {});
    });
    localStorage.setItem('hr_demo_purchases_seeded', 'true');
  }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/transactions');
      setRecords(res.data.records || []);
    } catch { setError(t('tx.failedLoad')); }
    finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/accounting/agents');
      setAgents(res.data.records || []);
    } catch { /* non-critical */ }
  };

  const clientOptions = [...new Set(records.map(r => r.client).filter(Boolean))];
  const itemTypeOptions = [...new Set(records.map(r => r.item_type).filter(Boolean))];

  const table = useExcelTable({ storageKey: 'tx_list', columns: TX_COLUMNS, rows: records });
  const filtered = table.sortedRows;
  const hasFilters = table.hasActiveFilters;
  const clearFilters = table.clearAllColumnFilters;

  /* ── Selection ── */
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(t('tx.deleteSelectedConfirm', { count: selectedIds.size }))) return;
    try {
      await api.delete('/accounting/transactions/bulk', { data: { ids: Array.from(selectedIds) } });
      setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err) { setError(err.response?.data?.error || err.message || t('tx.failedDeleteSelected')); }
  };

  /* ── Suggestion logic ── */
  const computeSuggestion = (client, currentEditId) => {
    if (!client) { setSuggestion([]); return; }
    const clientRecords = records.filter(r => r.client === client && r.id !== currentEditId);
    if (clientRecords.length === 0) { setSuggestion([]); return; }
    const counts = {};
    clientRecords.forEach(r => { counts[r.item_type] = (counts[r.item_type] || 0) + 1; });
    const all = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type]) => type);
    setSuggestion(all);
    setSuggestionDismissed(false);
  };

  const handleClientChange = (val) => {
    setForm(prev => ({ ...prev, client: val }));
    computeSuggestion(val, editId);
  };

  const openNew = () => {
    setForm({ ...TX_EMPTY, date: today() });
    setEditId(null); setShowForm(true); setError('');
    setSuggestion([]); setSuggestionDismissed(false);
  };

  const openEdit = (r) => {
    setForm({ date: r.date, client: r.client, item_type: r.item_type, amount: r.amount, note: r.note || '' });
    setEditId(r.id); setShowForm(true); setError('');
    setSuggestion([]); setSuggestionDismissed(false);
  };

  const handleSave = async () => {
    if (!form.client || !form.item_type || !form.amount || !form.date) {
      setError(t('tx.validationError')); return;
    }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/transactions/${editId}`, form);
      else await api.post('/accounting/transactions', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('tx.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('tx.deleteOneConfirm'))) return;
    try { await api.delete(`/accounting/transactions/${id}`); load(); }
    catch { setError(t('tx.failedDelete')); }
  };

  /* ── Excel export ── */
  const exportToExcel = () => {
    const header = ['Date', 'Client', 'Item Type', 'Amount', 'Note'];
    const rows = filtered.map(r => [
      fmtExcelDate(r.date),
      r.client,
      r.item_type,
      parseFloat(r.amount),
      r.note || '',
    ]);
    const totalRow = ['', '', 'TOTAL', filtered.reduce((s, r) => s + parseFloat(r.amount || 0), 0), ''];
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow]);
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    XLSX.writeFile(wb, `purchases-${today()}.xlsx`);
  };

  const total = filtered.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  return (
    <div>
      <h2>{t('tx.title')}</h2>
      <p className="acc-subtitle">{t('tx.subtitle')}</p>

      <div className="acc-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', background: '#fef3c7',
                border: '1px solid #f59e0b', borderRadius: 7,
                fontSize: 12, fontWeight: 500, color: '#92400e',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <IconClear /> {t('tx.clearFilters', { hidden: records.length - filtered.length })}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportToExcel}
            disabled={filtered.length === 0}
            title="Download as Excel"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: 'white',
              border: '1.5px solid #e5e7eb', borderRadius: 7,
              fontSize: 13, fontWeight: 500, color: '#479c73',
              cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filtered.length === 0 ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            <IconExcel /> {t('tx.excel')}
          </button>
          <ColumnVisibilityMenu table={table} t={t} />
          <button className="btn-add" onClick={openNew}>
            <IconPlus /> {t('tx.addPurchase')}
          </button>
        </div>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, fontWeight: 500, color: '#555' }}>
          <span>{t('tx.selectedCount', { count: selectedIds.size })}</span>
          <button
            onClick={handleBulkDelete}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#e53935', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <IconDelete /> {t('tx.deleteSelected')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ background: '#f5f5f5', color: '#666', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('tx.clear')}
          </button>
        </div>
      )}

      <div className="acc-table-wrapper">
        {loading ? (
          <TableSkeleton
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            }
            color="#f97316"
            label={t('tx.loading')}
            cols={[
              { size: 18 },
              { width: '12%' }, { width: '18%' }, { width: '16%' }, { width: '12%', align: 'right' }, { width: '30%' },
              { size: 18 },
            ]}
          />
        ) : records.length === 0 ? (
          <div className="acc-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <p>{t('tx.noPurchases')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="acc-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/>
            </svg>
            <p>{t('tx.noResults')}</p>
          </div>
        ) : (
          <>
          <table className="acc-table">
            <colgroup>
              <col style={{ width: 40 }} />
              {table.displayCols.map((key) => <col key={key} style={{ width: colWidths[key] }} />)}
              <col style={{ width: 70 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center', verticalAlign: 'middle' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    title={t('tx.selectAll')}
                    style={{ width: 15, height: 15, cursor: 'pointer' }}
                  />
                </th>
                {table.displayCols.map((key) => {
                  const col = table.colByKey[key];
                  return (
                    <th key={key} style={{ position: 'relative', width: colWidths[key], verticalAlign: 'top', paddingBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
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
                            border: 'none', borderRadius: 4, cursor: 'pointer',
                            background: table.openFilterCol === key ? '#f3f4f6' : 'transparent',
                            color: table.columnFilters[key] ? '#479c73' : '#9ca3af',
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill={table.columnFilters[key] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4"/>
                          </svg>
                        </button>
                      </div>
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
                        onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      />
                    </th>
                  );
                })}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {table.hasActiveFilters && filtered.length === 0 && (
                <tr>
                  <td colSpan={table.displayCols.length + 2} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: 13 }}>
                    {t('table.noFilterMatches')}
                    <div>
                      <button
                        onClick={clearFilters}
                        style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {t('table.clear')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {table.pagedRows.map((r) => (
                <tr key={r.id} style={selectedIds.has(r.id) ? { background: '#f0f9ff' } : {}}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                  </td>
                  {table.displayCols.includes('date') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>}
                  {table.displayCols.includes('client') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.client}</strong></td>}
                  {table.displayCols.includes('item_type') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-category-badge">{r.item_type}</span></td>}
                  {table.displayCols.includes('amount') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-amount expense">${parseFloat(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>}
                  {table.displayCols.includes('note') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#64748b' }}>{r.note || '—'}</td>}
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit" style={{ color: '#3b82f6' }}>
                        <IconEdit />
                      </button>
                      <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete">
                        <IconDelete />
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

      {showForm && createPortal(
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? t('tx.editPurchase') : t('tx.newPurchase')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group">
                <label>{t('tx.date')}</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>

              <div className="acc-form-group">
                <label>{t('tx.client')}</label>
                <select
                  value={form.client}
                  onChange={(e) => handleClientChange(e.target.value)}
                >
                  <option value="">{t('tx.selectClient')}</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group full">
                <label>{t('tx.itemType')}</label>
                {suggestion.length > 0 && !suggestionDismissed && (
                  <div className="tx-suggestion">
                    <span>{t('tx.previous')}</span>
                    {suggestion.filter(s => s !== form.item_type).map(s => (
                      <button key={s} className="tx-sug-accept" onClick={() => setForm(p => ({ ...p, item_type: s }))}>{s}</button>
                    ))}
                    <button className="tx-sug-dismiss" onClick={() => setSuggestionDismissed(true)}>✕</button>
                  </div>
                )}
                <input
                  list="tx-item-types"
                  value={form.item_type}
                  onChange={(e) => setForm({ ...form, item_type: e.target.value })}
                  placeholder={t('tx.typeOrSelectItemType')}
                  autoComplete="off"
                />
                <datalist id="tx-item-types">
                  {itemTypeOptions.map(opt => <option key={opt} value={opt} />)}
                </datalist>
              </div>

              <div className="acc-form-group">
                <label>{t('tx.amount')}</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>

              <div className="acc-form-group full">
                <label>{t('tx.note')}</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t('tx.optionalNote')} />
              </div>
            </div>

            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('tx.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('tx.saving') : t('tx.savePurchase')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const today = () => new Date().toISOString().split('T')[0];
export default Transactions;
