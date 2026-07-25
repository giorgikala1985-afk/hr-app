import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useKeyedColumnWidths, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import { useLanguage } from '../../contexts/LanguageContext';
import { useExcelTable, ExcelFilterDropdown, ColumnVisibilityMenu, PaginationBar } from '../common/ExcelTable';

const today = () => new Date().toISOString().split('T')[0];

const EMPTY = {
  sku: '', name: '', stock_name: '',
  move_in_date: '', move_in_qty: '', move_in_price: '',
  move_out_date: '', move_out_qty: '', move_out_price: '',
};

const DEFAULT_COL_WIDTHS = {
  sku: 110, name: 150, stock_name: 130, move_in_date: 110, move_in_qty: 90,
  move_in_price: 100, move_out_date: 110, move_out_qty: 90, move_out_price: 100,
};

/* ── Icons ── */
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconDelete() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function IconExcel() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function IconPlus() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconClear() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

const fmtNum = (v, decimals = 2) => v != null && v !== '' ? parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';

export default function Stock() {
  const { t } = useLanguage();
  const [records, setRecords]         = useState([]);
  const [stockLocations, setStockLocations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(EMPTY);
  const [editId, setEditId]           = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const { widths: colWidths, onResizeMouseDown } = useKeyedColumnWidths('stock_col_widths', DEFAULT_COL_WIDTHS);

  useEffect(() => { load(); loadLocations(); }, []);

  const loadLocations = async () => {
    try {
      const res = await api.get('/stock-locations');
      setStockLocations(res.data.locations || []);
    } catch { /* non-critical */ }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/stock');
      setRecords(res.data.records || []);
    } catch { setError(t('stock.failedLoad')); }
    finally { setLoading(false); }
  };

  /* ── Sort / filter ── */
  const STOCK_COLUMNS = [
    { key: 'sku', label: t('stock.colSku'), getValue: r => r.sku || '—' },
    { key: 'name', label: t('stock.colName'), getValue: r => r.name || '—' },
    { key: 'stock_name', label: t('stock.colStockName'), getValue: r => r.stock_name || '—' },
    { key: 'move_in_date', label: t('stock.colMoveInDate'), getValue: r => r.move_in_date ? new Date(r.move_in_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', getSortValue: r => r.move_in_date || '' },
    { key: 'move_in_qty', label: t('stock.colMoveInQty'), getValue: r => fmtNum(r.move_in_qty, 0), getSortValue: r => parseFloat(r.move_in_qty) || 0 },
    { key: 'move_in_price', label: t('stock.colMoveInPrice'), getValue: r => r.move_in_price != null ? `$${fmtNum(r.move_in_price)}` : '—', getSortValue: r => parseFloat(r.move_in_price) || 0 },
    { key: 'move_out_date', label: t('stock.colMoveOutDate'), getValue: r => r.move_out_date ? new Date(r.move_out_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', getSortValue: r => r.move_out_date || '' },
    { key: 'move_out_qty', label: t('stock.colMoveOutQty'), getValue: r => fmtNum(r.move_out_qty, 0), getSortValue: r => parseFloat(r.move_out_qty) || 0 },
    { key: 'move_out_price', label: t('stock.colMoveOutPrice'), getValue: r => r.move_out_price != null ? `$${fmtNum(r.move_out_price)}` : '—', getSortValue: r => parseFloat(r.move_out_price) || 0 },
  ];
  const table = useExcelTable({ storageKey: 'stock_list', columns: STOCK_COLUMNS, rows: records });
  const filtered = table.sortedRows;
  const hasFilters = table.hasActiveFilters;
  const clearFilters = table.clearAllColumnFilters;

  /* ── Summary stats ── */
  const totalInValue  = filtered.reduce((s, r) => s + (parseFloat(r.move_in_qty  || 0) * parseFloat(r.move_in_price  || 0)), 0);
  const totalOutValue = filtered.reduce((s, r) => s + (parseFloat(r.move_out_qty || 0) * parseFloat(r.move_out_price || 0)), 0);
  const netValue = totalInValue - totalOutValue;

  /* ── Form helpers ── */
  const openNew = () => { setForm({ ...EMPTY, move_in_date: today() }); setEditId(null); setShowForm(true); setError(''); };
  const openEdit = (r) => {
    setForm({
      sku: r.sku || '', name: r.name || '', stock_name: r.stock_name || '',
      move_in_date: r.move_in_date || '', move_in_qty: r.move_in_qty ?? '', move_in_price: r.move_in_price ?? '',
      move_out_date: r.move_out_date || '', move_out_qty: r.move_out_qty ?? '', move_out_price: r.move_out_price ?? '',
    });
    setEditId(r.id); setShowForm(true); setError('');
  };
  const f = (k) => e => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name) { setError(t('stock.nameRequired')); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/stock/${editId}`, form);
      else        await api.post('/accounting/stock', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('stock.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('stock.deleteConfirm'))) return;
    try { await api.delete(`/accounting/stock/${id}`); load(); }
    catch { setError(t('stock.failedDelete')); }
  };

  /* ── Excel export ── */
  const exportToExcel = () => {
    const header = ['SKU', 'Name', 'Stock Name', 'Move In Date', 'Move In Qty', 'Move In Price', 'Move Out Date', 'Move Out Qty', 'Move Out Price'];
    const rows = filtered.map(r => [
      r.sku || '', r.name || '', r.stock_name || '',
      r.move_in_date || '', r.move_in_qty ?? '', r.move_in_price ?? '',
      r.move_out_date || '', r.move_out_qty ?? '', r.move_out_price ?? '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [10,20,18,14,12,14,14,12,14].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `stock-${today()}.xlsx`);
  };

  return (
    <div>
      <h2>{t('stock.title')}</h2>
      <p className="acc-subtitle">{t('stock.subtitle')}</p>

      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('stock.totalRecords')}</span>
          <span className="acc-summary-value">{filtered.length}{hasFilters && records.length !== filtered.length ? ` / ${records.length}` : ''}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('stock.totalInValue')}</span>
          <span className="acc-summary-value" style={{ color: '#479c73' }}>${totalInValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('stock.totalOutValue')}</span>
          <span className="acc-summary-value red">${totalOutValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('stock.netStockValue')}</span>
          <span className="acc-summary-value" style={{ color: netValue >= 0 ? '#479c73' : '#dc2626' }}>${netValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="acc-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasFilters && (
            <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 7, fontSize: 12, fontWeight: 500, color: '#92400e', cursor: 'pointer', fontFamily: 'inherit' }}>
              <IconClear /> {t('stock.clearFilters', { hidden: records.length - filtered.length })}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportToExcel} disabled={filtered.length === 0} title="Download as Excel" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontWeight: 500, color: '#479c73', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.5 : 1, fontFamily: 'inherit' }}>
            <IconExcel /> {t('stock.excel')}
          </button>
          <ColumnVisibilityMenu table={table} t={t} />
          <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#479c73', borderColor: '#479c73' }}>
            <IconPlus /> {t('stock.addItem')}
          </button>
        </div>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="acc-table-wrapper">
        {loading ? (
          <div className="acc-empty"><p>{t('stock.loading')}</p></div>
        ) : records.length === 0 ? (
          <div className="acc-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <p>{t('stock.noRecords')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="acc-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/>
            </svg>
            <p>{t('stock.noResults')}</p>
          </div>
        ) : (
          <>
          <table className="acc-table" style={{ tableLayout: 'fixed', width: table.displayCols.reduce((a, k) => a + colWidths[k], 70) }}>
            <colgroup>
              {table.displayCols.map((key) => <col key={key} style={{ width: colWidths[key] }} />)}
              <col style={{ width: 70 }} />
            </colgroup>
            <thead>
              <tr>
                {table.displayCols.map((key) => {
                  const col = table.colByKey[key];
                  return (
                    <th key={key} style={{ position: 'relative', width: colWidths[key], overflow: 'hidden', verticalAlign: 'top', paddingBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
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
                      <div onMouseDown={e => onResizeMouseDown(e, key)} style={RESIZE_HANDLE_STYLE}
                        onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                    </th>
                  );
                })}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {table.hasActiveFilters && filtered.length === 0 && (
                <tr>
                  <td colSpan={table.displayCols.length + 1} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: 13 }}>
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
              {table.pagedRows.map(r => (
                <tr key={r.id}>
                  {table.displayCols.includes('sku') && (
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {r.sku ? <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#475569' }}>{r.sku}</span> : '—'}
                    </td>
                  )}
                  {table.displayCols.includes('name') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.name}</strong></td>}
                  {table.displayCols.includes('stock_name') && (
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {r.stock_name ? <span className="acc-category-badge">{r.stock_name}</span> : '—'}
                    </td>
                  )}
                  {table.displayCols.includes('move_in_date') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#64748b' }}>{r.move_in_date ? new Date(r.move_in_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>}
                  {table.displayCols.includes('move_in_qty') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{fmtNum(r.move_in_qty, 0)}</td>}
                  {table.displayCols.includes('move_in_price') && (
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {r.move_in_price != null ? <span className="acc-amount income">${fmtNum(r.move_in_price)}</span> : '—'}
                    </td>
                  )}
                  {table.displayCols.includes('move_out_date') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#64748b' }}>{r.move_out_date ? new Date(r.move_out_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>}
                  {table.displayCols.includes('move_out_qty') && <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{fmtNum(r.move_out_qty, 0)}</td>}
                  {table.displayCols.includes('move_out_price') && (
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {r.move_out_price != null ? <span className="acc-amount expense">${fmtNum(r.move_out_price)}</span> : '—'}
                    </td>
                  )}
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit" style={{ color: '#3b82f6' }}><IconEdit /></button>
                      <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete"><IconDelete /></button>
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

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" style={{ maxWidth: 820 }} onClick={e => e.stopPropagation()}>
            <h3>{editId ? t('stock.editItem') : t('stock.newItem')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">

              <div className="acc-form-group">
                <label>{t('stock.sku')}</label>
                <input type="text" value={form.sku} onChange={f('sku')} placeholder="e.g. ITEM-001" />
              </div>
              <div className="acc-form-group">
                <label>{t('stock.name')}</label>
                <input type="text" value={form.name} onChange={f('name')} placeholder="Item name" />
              </div>
              <div className="acc-form-group full">
                <label>{t('stock.stockName')}</label>
                <select value={form.stock_name} onChange={f('stock_name')}>
                  <option value="">{t('stock.selectLocation')}</option>
                  {stockLocations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}{loc.area ? ` (${loc.area})` : ''}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#479c73', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {t('stock.moveIn')}
                </div>
                <div className="acc-form-grid" style={{ marginTop: 0 }}>
                  <div className="acc-form-group">
                    <label>{t('stock.moveInDate')}</label>
                    <input type="date" value={form.move_in_date} onChange={f('move_in_date')} />
                  </div>
                  <div className="acc-form-group">
                    <label>{t('stock.moveInQty')}</label>
                    <input type="number" step="1" min="0" value={form.move_in_qty} onChange={f('move_in_qty')} placeholder="0" />
                  </div>
                  <div className="acc-form-group">
                    <label>{t('stock.moveInPrice')}</label>
                    <input type="number" step="0.01" min="0" value={form.move_in_price} onChange={f('move_in_price')} placeholder="0.00" />
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {t('stock.moveOut')}
                </div>
                <div className="acc-form-grid" style={{ marginTop: 0 }}>
                  <div className="acc-form-group">
                    <label>{t('stock.moveOutDate')}</label>
                    <input type="date" value={form.move_out_date} onChange={f('move_out_date')} />
                  </div>
                  <div className="acc-form-group">
                    <label>{t('stock.moveOutQty')}</label>
                    <input type="number" step="1" min="0" value={form.move_out_qty} onChange={f('move_out_qty')} placeholder="0" />
                  </div>
                  <div className="acc-form-group">
                    <label>{t('stock.moveOutPrice')}</label>
                    <input type="number" step="0.01" min="0" value={form.move_out_price} onChange={f('move_out_price')} placeholder="0.00" />
                  </div>
                </div>
              </div>

            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('stock.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('stock.saving') : t('stock.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
