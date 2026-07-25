import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { fmtExcelDate } from '../../utils/formatDate';
import './Employees.css';
import '../Options/Options.css';
import { useKeyedColumnWidths, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import { useExcelTable, ExcelFilterDropdown, ColumnVisibilityMenu, PaginationBar } from '../common/ExcelTable';
import EmployeeForm from './EmployeeForm';

// Default proportional widths (px) per column. With table-layout:fixed + width:100%
// these set the relative proportions; the browser stretches them to fill the table,
// so hiding a column makes the rest expand to fill the gap. Each is drag-resizable.
const DEFAULT_COL_WIDTHS = {
  photo: 60, name: 200, personalId: 140, birthdate: 130, position: 140,
  salary: 130, account: 210, startDate: 130, endDate: 120, pension: 90,
};

function EmployeeList() {
  const { t } = useLanguage();
  const { widths: colWidths, onResizeMouseDown } = useKeyedColumnWidths('emp_col_widths', DEFAULT_COL_WIDTHS);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const EMP_COLUMNS = [
    { key: 'photo', label: t('col.photo'), sortable: false, filterable: false, getValue: () => '' },
    { key: 'name', label: t('col.name'), getValue: e => `${e.first_name || ''} ${e.last_name || ''}`.trim() || '—' },
    { key: 'personalId', label: t('col.personalId'), getValue: e => e.personal_id || '—' },
    { key: 'birthdate', label: t('col.birthdate'), getValue: e => e.birthdate ? formatDate(e.birthdate) : '—', getSortValue: e => e.birthdate || '' },
    { key: 'position', label: t('col.position'), getValue: e => e.position || '—' },
    { key: 'salary', label: t('col.salary'), getValue: e => `${Number(e.salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${e.salary_currency || 'GEL'}`, getSortValue: e => parseFloat(e.salary) || 0 },
    { key: 'account', label: t('col.account'), getValue: e => e.account_number || '—' },
    { key: 'startDate', label: t('col.startDate'), getValue: e => e.start_date ? formatDate(e.start_date) : '—', getSortValue: e => e.start_date || '' },
    { key: 'endDate', label: t('col.endDate'), getValue: e => e.end_date ? formatDate(e.end_date) : t('emp.active'), getSortValue: e => e.end_date || '' },
    { key: 'pension', label: 'Pension', getValue: e => e.pension ? '✔' : '—' },
  ];

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const table = useExcelTable({ storageKey: 'emp_list', columns: EMP_COLUMNS, rows: employees });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/employees');
      setEmployees(response.data?.employees || []);
    } catch (err) {
      setError(t('emp.loadFailed') + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (employee) => {
    if (!window.confirm(t('emp.deleteConfirm', { name: `${employee.first_name} ${employee.last_name}` }))) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await api.delete(`/employees/${employee.id}`);
      setSuccess(t('emp.deletedSuccess'));
      loadEmployees();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete employee');
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === table.sortedRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(table.sortedRows.map((e) => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    const count = selected.size;
    if (!window.confirm(t('emp.bulkDeleteConfirm', { count }))) return;
    setBulkDeleting(true);
    setError('');
    setSuccess('');
    try {
      for (const id of selected) {
        await api.delete(`/employees/${id}`);
      }
      setSuccess(t('emp.bulkDeletedSuccess', { count }));
      setSelected(new Set());
      loadEmployees();
    } catch (err) {
      setError(t('emp.bulkDeleteFailed'));
      loadEmployees();
    } finally {
      setBulkDeleting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const exportToExcel = () => {
    const today = new Date().toISOString().slice(0, 10);
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Personal ID', 'Birthdate', 'Position', 'Department', 'Salary', 'Account Number', 'Start Date', 'End Date', 'Pension'],
      ...table.sortedRows.map(e => [
        `${e.first_name} ${e.last_name}`,
        e.personal_id,
        fmtExcelDate(e.birthdate),
        e.position,
        e.department,
        e.salary,
        e.account_number,
        fmtExcelDate(e.start_date),
        fmtExcelDate(e.end_date),
        e.pension ? 'Yes' : 'No',
      ]),
    ]);
    ws['!cols'] = [22, 14, 12, 22, 18, 10, 24, 12, 12, 8].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `employees-${today}.xlsx`);
  };

  if (loading && employees.length === 0) {
    return <div className="emp-loading">{t('emp.loading')}</div>;
  }

  return (
    <div className="emp-container">
      <div className={`emp-header ${selected.size > 0 ? 'sticky-active' : ''}`}>
        <div>
          <h1>{t('emp.title')}</h1>
          <p>{t('emp.subtitle')}</p>
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
            return (
              <div className="action-btns" style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditingEmployeeId(selId)} className="btn-icon" title={t('action.edit')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => handleDelete(employees.find(e => e.id === selId))} className="btn-icon btn-delete" title={t('action.delete')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {employees.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3>{t('emp.noEmployees')}</h3>
          <p>{t('emp.noEmployeesDesc')}</p>
        </div>
      ) : (
        <div className="emp-table-wrapper">
          <table className="emp-table">
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
                        onClick={col.sortable !== false ? () => table.toggleSort(key) : undefined}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: col.sortable !== false ? 'pointer' : 'default' }}
                      >
                        {col.label}
                        {col.sortable !== false && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ opacity: table.sortKey === key ? 1 : 0.25, transform: table.sortKey === key && table.sortDir === 'desc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        )}
                      </span>
                      {col.filterable !== false && (
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
                      )}
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
              {table.pagedRows.map((emp) => (
                <tr key={emp.id} className={selected.has(emp.id) ? 'row-selected' : ''}>
                  <td className="td-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                    />
                  </td>
                  {table.displayCols.includes('photo') && (
                    <td>
                      <div className="emp-photo-thumb">
                        {emp.photo_url ? (
                          <img src={emp.photo_url} alt={`${emp.first_name} ${emp.last_name}`} />
                        ) : (
                          <span className="no-photo">👤</span>
                        )}
                      </div>
                    </td>
                  )}
                  {table.displayCols.includes('name') && (
                    <td className="emp-name" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {emp.first_name} {emp.last_name}
                    </td>
                  )}
                  {table.displayCols.includes('personalId') && <td>{emp.personal_id}</td>}
                  {table.displayCols.includes('birthdate') && <td>{formatDate(emp.birthdate)}</td>}
                  {table.displayCols.includes('position') && <td><span className="position-badge">{emp.position}</span></td>}
                  {table.displayCols.includes('salary') && <td className="salary" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono), monospace' }}>{Number(emp.salary).toLocaleString('en-US', { minimumFractionDigits: 2 })} {emp.salary_currency || 'GEL'}</td>}
                  {table.displayCols.includes('account') && <td className={`account-num${emp.account_number ? (emp.account_number.toLowerCase().includes('gb') ? ' acct-gb' : emp.account_number.toLowerCase().includes('tb') ? ' acct-tb' : '') : ''}`}>{emp.account_number || '—'}</td>}
                  {table.displayCols.includes('startDate') && <td>{formatDate(emp.start_date)}</td>}
                  {table.displayCols.includes('endDate') && <td>{emp.end_date ? formatDate(emp.end_date) : <span className="status-active">{t('emp.active')}</span>}</td>}
                  {table.displayCols.includes('pension') && <td style={{ textAlign: 'center' }}>{emp.pension ? <span style={{ color: '#479c73', fontWeight: 700, fontSize: 16 }}>✔</span> : '—'}</td>}
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => setEditingEmployeeId(emp.id)} title={t('action.edit')} style={{ color: '#3b82f6' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {selected.has(emp.id) && (
                        <button className="btn-icon btn-delete" onClick={() => handleDelete(emp)} title={t('action.delete')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar table={table} t={t} />
        </div>
      )}
      {editingEmployeeId && (
        <EmployeeForm
          employeeId={editingEmployeeId}
          onClose={() => setEditingEmployeeId(null)}
          onSaved={() => { setEditingEmployeeId(null); loadEmployees(); }}
        />
      )}
    </div>
  );
}

export default EmployeeList;
