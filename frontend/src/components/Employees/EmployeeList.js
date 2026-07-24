import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import './Employees.css';
import '../Options/Options.css';
import { useKeyedColumnWidths, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const DEFAULT_COLUMN_KEYS = ['photo', 'name', 'personalId', 'birthdate', 'position', 'salary', 'account', 'startDate', 'endDate', 'pension'];
const DEFAULT_VISIBLE = new Set(DEFAULT_COLUMN_KEYS);

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

  const ALL_COLUMNS = [
    { key: 'photo', label: t('col.photo'), hideable: true },
    { key: 'name', label: t('col.name'), hideable: false },
    { key: 'personalId', label: t('col.personalId'), hideable: true },
    { key: 'birthdate', label: t('col.birthdate'), hideable: true },
    { key: 'position', label: t('col.position'), hideable: true },
    { key: 'salary', label: t('col.salary'), hideable: false },
    { key: 'account', label: t('col.account'), hideable: true },
    { key: 'startDate', label: t('col.startDate'), hideable: true },
    { key: 'endDate', label: t('col.endDate'), hideable: true },
    { key: 'pension', label: 'Pension', hideable: true },
  ];

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('emp_visible_cols');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(DEFAULT_VISIBLE);
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filters, setFilters] = useState({
    name: '', personalId: '', birthdate: '', position: '',
    salary: '', startDate: '', endDate: '', status: '', account: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationSettings, setPaginationSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('pagination_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: false, pageSize: 50 };
  });
  const navigate = useNavigate();

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

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, search, paginationSettings]);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    localStorage.setItem('emp_visible_cols', JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const toggleColumn = (key) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isCol = (key) => visibleCols.has(key);

  const loadEmployees = async (searchTerm = '') => {
    setLoading(true);
    setError('');
    try {
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await api.get('/employees', { params });
      setEmployees(response.data?.employees || []);
    } catch (err) {
      setError(t('emp.loadFailed') + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadEmployees(search);
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
      loadEmployees(search);
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
    if (selected.size === filteredEmployees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredEmployees.map((e) => e.id)));
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
      loadEmployees(search);
    } catch (err) {
      setError(t('emp.bulkDeleteFailed'));
      loadEmployees(search);
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

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ name: '', personalId: '', birthdate: '', position: '', salary: '', otRate: '', startDate: '', endDate: '', status: '', account: '' });
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    if (filters.name && !fullName.includes(filters.name.toLowerCase())) return false;
    if (filters.personalId && !emp.personal_id.toLowerCase().includes(filters.personalId.toLowerCase())) return false;
    if (filters.birthdate && !emp.birthdate.includes(filters.birthdate)) return false;
    if (filters.position && !emp.position.toLowerCase().includes(filters.position.toLowerCase())) return false;
    if (filters.salary && !String(emp.salary).includes(filters.salary)) return false;
    if (filters.startDate && !emp.start_date.includes(filters.startDate)) return false;
    if (filters.endDate) {
      if (!emp.end_date || !emp.end_date.includes(filters.endDate)) return false;
    }
    if (filters.status === 'active' && emp.end_date) return false;
    if (filters.status === 'inactive' && !emp.end_date) return false;
    if (filters.account && !(emp.account_number || '').toLowerCase().includes(filters.account.toLowerCase())) return false;
    return true;
  });

  const usePagination = paginationSettings.enabled && paginationSettings.pageSize !== 'all';
  const pageSize = usePagination ? paginationSettings.pageSize : filteredEmployees.length;
  const totalPages = usePagination ? Math.max(1, Math.ceil(filteredEmployees.length / pageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEmployees = usePagination
    ? filteredEmployees.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filteredEmployees;

  const exportToExcel = () => {
    const today = new Date().toISOString().slice(0, 10);
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Personal ID', 'Birthdate', 'Position', 'Department', 'Salary', 'Account Number', 'Start Date', 'End Date', 'Pension'],
      ...filteredEmployees.map(e => [
        `${e.first_name} ${e.last_name}`,
        e.personal_id,
        e.birthdate ? new Date(e.birthdate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        e.position,
        e.department,
        e.salary,
        e.account_number,
        e.start_date ? new Date(e.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        e.end_date ? new Date(e.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
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
            disabled={!filteredEmployees.length}
            title="Download as Excel"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 36, boxSizing: 'border-box', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: '#479c73', cursor: filteredEmployees.length ? 'pointer' : 'not-allowed', opacity: filteredEmployees.length ? 1 : 0.5, fontFamily: 'inherit' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel
          </button>
          <div className="col-toggle-wrapper">
            <button
              className="btn-col-toggle"
              onClick={() => setShowColMenu((v) => !v)}
              title={t('action.showHideColumns')}
            >
              {t('emp.columns')}
            </button>
            {showColMenu && (
              <div className="col-toggle-menu">
                {ALL_COLUMNS.map((col) => (
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
            return (
              <div className="action-btns" style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => navigate(`/employees/${selId}/edit`)} className="btn-icon" title={t('action.edit')}>
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

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder={t('emp.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-search">{t('emp.search')}</button>
        {search && (
          <button
            type="button"
            className="btn-clear"
            onClick={() => { setSearch(''); loadEmployees(); }}
          >
            {t('emp.clear')}
          </button>
        )}
      </form>

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
              {ALL_COLUMNS.filter((c) => isCol(c.key)).map((c) => (
                <col key={c.key} style={{ width: colWidths[c.key] }} />
              ))}
              <col style={{ width: 64 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={filteredEmployees.length > 0 && selected.size === filteredEmployees.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {ALL_COLUMNS.filter((c) => isCol(c.key)).map((c) => (
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
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className={selected.has(emp.id) ? 'row-selected' : ''}>
                  <td className="td-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                    />
                  </td>
                  {isCol('photo') && (
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
                  {isCol('name') && (
                    <td className="emp-name" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {emp.first_name} {emp.last_name}
                    </td>
                  )}
                  {isCol('personalId') && <td>{emp.personal_id}</td>}
                  {isCol('birthdate') && <td>{formatDate(emp.birthdate)}</td>}
                  {isCol('position') && <td><span className="position-badge">{emp.position}</span></td>}
                  {isCol('salary') && <td className="salary" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono), monospace' }}>{Number(emp.salary).toLocaleString('en-US', { minimumFractionDigits: 2 })} {emp.salary_currency || 'GEL'}</td>}
                  {isCol('account') && <td className={`account-num${emp.account_number ? (emp.account_number.toLowerCase().includes('gb') ? ' acct-gb' : emp.account_number.toLowerCase().includes('tb') ? ' acct-tb' : '') : ''}`}>{emp.account_number || '—'}</td>}
                  {isCol('startDate') && <td>{formatDate(emp.start_date)}</td>}
                  {isCol('endDate') && <td>{emp.end_date ? formatDate(emp.end_date) : <span className="status-active">{t('emp.active')}</span>}</td>}
                  {isCol('pension') && <td style={{ textAlign: 'center' }}>{emp.pension ? <span style={{ color: '#479c73', fontWeight: 700, fontSize: 16 }}>✔</span> : '—'}</td>}
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => navigate(`/employees/${emp.id}/edit`)} title={t('action.edit')} style={{ color: '#3b82f6' }}>
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
              <span className="pagination-info">{t('emp.total', { count: filteredEmployees.length })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmployeeList;
